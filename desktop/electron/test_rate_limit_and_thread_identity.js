/**
 * FOCUSED TEST SUITE: 429 RATE LIMIT HANDLING & THREAD IDENTITY PERSISTENCE
 * 
 * Verifies:
 * 1. Groq / OpenAI-compatible 429 Rate Limit error parsing & normalization.
 * 2. ModelAdapter & AgentLoop graceful 429 handling without throwing unhandled exceptions.
 * 3. Retry on same thread without duplicate thread or turn creation.
 * 4. Automatic smart title generation across complex/multiline/file prompts.
 * 5. Single thread identity across projects, recents, and workspace sessions.
 * 6. Cold restart persistence of threads, titles, pinned status, and turns.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { HarnessRuntime } = require('./harness/HarnessRuntime');
const { ThreadManager, generateSmartThreadTitle } = require('./harness/ThreadManager');
const { parseRateLimitError } = require('./ai/types');
const { THREAD_STATUS, TURN_STATUS } = require('./harness/types');

async function runRateLimitAndThreadIdentityTests() {
  console.log('====================================================');
  console.log('TESTING 429 RATE LIMIT HANDLING & THREAD IDENTITY');
  console.log('====================================================\n');

  const testWorkspace = path.join(process.cwd(), '.nexus-recovery', 'test_rate_limit_ws');
  fs.mkdirSync(testWorkspace, { recursive: true });

  // TEST 1: Rate Limit Error Parsing & Normalization
  console.log('[1/5] Testing 429 Rate Limit Parsing & Normalization...');
  
  // Groq standard TPM limit message
  const groqErrorMsg = 'Rate limit reached for model `openai/gpt-oss-120b` in organization `org_123` on tokens per minute (TPM): Limit 6000, Used 5980, Requested 450. Please try again in 5.2s.';
  const parsed1 = parseRateLimitError(groqErrorMsg, 'groq', 'openai/gpt-oss-120b');
  assert.ok(parsed1, 'Must parse rate limit string');
  assert.strictEqual(parsed1.isRateLimit, true);
  assert.strictEqual(parsed1.statusCode, 429);
  assert.strictEqual(parsed1.providerId, 'groq');
  assert.strictEqual(parsed1.modelId, 'openai/gpt-oss-120b');
  assert.strictEqual(parsed1.retryAfter, '5.2s');
  assert.strictEqual(parsed1.retryAfterMs, 5200);
  assert.ok(parsed1.message.includes('Limit 6000'));

  // Groq JSON body format with headers
  const groqHttpError = new Error('HTTP 429: {"error":{"message":"Rate limit reached on requests per minute (RPM). Please try again in 2140ms.","type":"requests","code":"rate_limit_exceeded"}}');
  groqHttpError.statusCode = 429;
  groqHttpError.retryAfter = '2.14s';
  const parsed2 = parseRateLimitError(groqHttpError, 'groq', 'llama-3.3-70b-versatile');
  assert.ok(parsed2);
  assert.strictEqual(parsed2.isRateLimit, true);
  assert.strictEqual(parsed2.retryAfter, '2.14s');
  assert.strictEqual(parsed2.message, 'Rate limit reached on requests per minute (RPM). Please try again in 2140ms.');

  // Generic 429 error
  const generic429 = new Error('Too Many Requests');
  generic429.statusCode = 429;
  const parsed3 = parseRateLimitError(generic429, 'openai', 'gpt-4o');
  assert.strictEqual(parsed3.isRateLimit, true);
  assert.strictEqual(parsed3.retryAfter, '5s');
  assert.strictEqual(parsed3.retryAfterMs, 5000);

  // Non-429 error returns null
  const regularError = new Error('Syntax error on line 45');
  assert.strictEqual(parseRateLimitError(regularError), null);
  console.log('  ✔ [PASS] 429 Rate Limit error parsing & retry-after extraction validated\n');

  // TEST 2: AgentLoop 429 Handling Without Throwing
  console.log('[2/5] Testing AgentLoop handling of 429 rate limit...');
  const runtime = new HarnessRuntime();

  // Create thread
  const thread = runtime.createThread({
    workspacePath: testWorkspace,
    userInput: 'Inspect cart_calculator.py and fix redundant arithmetic',
  });
  assert.strictEqual(thread.metadata.title, 'Fix cart_calculator.py');

  // Mock a rate-limit error handler in model stream
  const rateLimitMockHandler = async () => {
    const err = new Error('Rate limit reached for model openai/gpt-oss-120b on Groq. Please try again in 4.5s.');
    err.statusCode = 429;
    err.isRateLimit = true;
    throw err;
  };

  const turnOutcome = await runtime.runTurn({
    threadId: thread.threadId,
    userInput: 'Inspect cart_calculator.py and fix redundant arithmetic',
    workspacePath: testWorkspace,
    providerId: 'groq',
    modelId: 'openai/gpt-oss-120b',
    modelHandler: rateLimitMockHandler,
  });

  assert.strictEqual(turnOutcome.success, false);
  assert.strictEqual(turnOutcome.status, TURN_STATUS.FAILED);
  assert.strictEqual(turnOutcome.isRateLimit, true);
  assert.ok(turnOutcome.rateInfo, 'Must include structured rateInfo');
  assert.strictEqual(turnOutcome.rateInfo.retryAfter, '4.5s');
  assert.strictEqual(turnOutcome.rateInfo.providerId, 'groq');
  console.log('  ✔ [PASS] AgentLoop handled 429 gracefully with structured rateInfo\n');

  // TEST 3: Retry Reusing Same Thread Without Duplicates
  console.log('[3/5] Testing retry reusing the SAME thread...');
  
  // Successful handler for retry
  const successMockHandler = async () => {
    return {
      role: 'assistant',
      content: 'Successfully analyzed cart_calculator.py and fixed redundant math.',
      toolCalls: [],
    };
  };

  const retryOutcome = await runtime.runTurn({
    threadId: thread.threadId, // Reusing SAME threadId
    turnId: turnOutcome.turnId, // Reusing existing turn
    userInput: 'Inspect cart_calculator.py and fix redundant arithmetic',
    workspacePath: testWorkspace,
    providerId: 'groq',
    modelId: 'openai/gpt-oss-120b',
    modelHandler: successMockHandler,
  });

  assert.strictEqual(retryOutcome.success, true);
  assert.strictEqual(retryOutcome.status, TURN_STATUS.COMPLETED);
  assert.strictEqual(retryOutcome.turnId, turnOutcome.turnId, 'Retry must reuse the same turnId');

  // Verify thread has exactly 1 turn, not duplicated
  const threadAfterRetry = runtime.getThread(thread.threadId, testWorkspace);
  assert.strictEqual(threadAfterRetry.turns.length, 1, 'Thread must not accumulate duplicate turns on retry');
  console.log('  ✔ [PASS] Retry successfully reused existing thread and turn without duplicates\n');

  // TEST 4: Smart Title Generation Across Varied Prompt Shapes
  console.log('[4/5] Testing smart title generation across complex prompt shapes...');
  
  // Shape A: Multiline prompt with instructions
  const promptA = `Inspect cart_calculator.py and propose a minimal fix for the redundant arithmetic operations.
First explain what you intend to change.
Create a ChangeSet and show me the proposed diff.
Do NOT apply the change yet. Wait for my approval.`;
  assert.strictEqual(generateSmartThreadTitle(promptA), 'Fix cart_calculator.py');

  // Shape B: Question about why something fails
  const promptB = 'Why does the login function in auth_service.ts throw 401?';
  assert.strictEqual(generateSmartThreadTitle(promptB), 'Fix auth_service.ts');

  // Shape C: Feature addition
  const promptC = 'Please implement dark mode in the settings drawer';
  assert.strictEqual(generateSmartThreadTitle(promptC), 'Implement dark mode');

  // Shape D: Tests
  const promptD = 'Add unit tests for payment_processor.py';
  assert.strictEqual(generateSmartThreadTitle(promptD), 'Tests for payment_processor.py');

  // Shape E: Explanation
  const promptE = 'Explain the NEXUS continuum state machine';
  assert.strictEqual(generateSmartThreadTitle(promptE), 'NEXUS continuum state machine');

  console.log('  ✔ [PASS] Smart titles generated accurately with zero "New Task" or "Untitled Task" defaults\n');

  // TEST 5: Thread Identity & Cold Restart Persistence
  console.log('[5/5] Testing thread identity across Projects & Recents and cold restart...');
  
  // Create 3 distinct threads with meaningful prompts
  const thread1 = runtime.createThread({
    workspacePath: testWorkspace,
    workspaceName: 'TestProject',
    userInput: 'Fix cart_calculator.py arithmetic',
  });
  const thread2 = runtime.createThread({
    workspacePath: testWorkspace,
    workspaceName: 'TestProject',
    userInput: 'Add unit tests for payment_processor.py',
    pinned: true,
  });
  const thread3 = runtime.createThread({
    workspacePath: testWorkspace,
    workspaceName: 'TestProject',
    userInput: 'Explain the NEXUS architecture',
  });

  // Verify in memory
  const memoryList = runtime.listThreads({ workspacePath: testWorkspace });
  assert.ok(memoryList.some((t) => t.threadId === thread1.threadId && t.title === 'Fix cart_calculator.py'));
  assert.ok(memoryList.some((t) => t.threadId === thread2.threadId && t.pinned === true));
  assert.ok(memoryList.some((t) => t.threadId === thread3.threadId && t.title === 'NEXUS architecture'));

  // Cold Restart: Create fresh runtime instance and verify hydration
  const restartedRuntime = new HarnessRuntime();
  const hydratedList = restartedRuntime.listThreads({ workspacePath: testWorkspace });
  
  const hydratedT1 = hydratedList.find((t) => t.threadId === thread1.threadId);
  const hydratedT2 = hydratedList.find((t) => t.threadId === thread2.threadId);
  const hydratedT3 = hydratedList.find((t) => t.threadId === thread3.threadId);

  assert.ok(hydratedT1, 'Thread 1 must survive restart');
  assert.strictEqual(hydratedT1.title, 'Fix cart_calculator.py');

  assert.ok(hydratedT2, 'Thread 2 must survive restart');
  assert.strictEqual(hydratedT2.pinned, true, 'Pinned state must survive restart');

  assert.ok(hydratedT3, 'Thread 3 must survive restart');
  assert.strictEqual(hydratedT3.title, 'NEXUS architecture');

  // Verify single identity (same threadId)
  assert.strictEqual(hydratedT1.threadId, thread1.threadId);
  assert.strictEqual(hydratedT2.threadId, thread2.threadId);
  assert.strictEqual(hydratedT3.threadId, thread3.threadId);

  console.log('  ✔ [PASS] Cold restart restored identical thread IDs, smart titles, and pinned states\n');

  console.log('====================================================');
  console.log('ALL RATE LIMIT & THREAD IDENTITY TESTS PASSED!');
  console.log('====================================================');
}

runRateLimitAndThreadIdentityTests().catch((err) => {
  console.error('[TEST FAILED]', err);
  process.exit(1);
});
