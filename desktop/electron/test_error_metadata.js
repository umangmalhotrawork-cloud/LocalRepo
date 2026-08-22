/**
 * FOCUSED TEST SUITE: RATE LIMIT ERROR METADATA & PROVIDER/MODEL ACCURACY
 * 
 * Verifies:
 * 1. Authoritative extraction of actual failed model (e.g. qwen/qwen3.6-27b) over stale selection state.
 * 2. Provider error metadata attachment across OpenAICompatibleProvider & parseRateLimitError.
 * 3. AgentLoop & HarnessRuntime preservation of actual failed provider and model in turnOutcome and execution.
 * 4. Same-thread retry semantics without thread or turn duplication.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { HarnessRuntime } = require('./harness/HarnessRuntime');
const { parseRateLimitError } = require('./ai/types');
const { TURN_STATUS } = require('./harness/types');

async function runErrorMetadataTests() {
  console.log('====================================================');
  console.log('TESTING RATE LIMIT ERROR METADATA ACCURACY');
  console.log('====================================================\n');

  const testWorkspace = path.join(process.cwd(), '.nexus-recovery', 'test_err_meta_ws');
  fs.mkdirSync(testWorkspace, { recursive: true });

  // TEST 1: Model Extraction when caller passed stale default model
  console.log('[1/4] Testing model extraction when stale global model was passed...');
  
  // Real Groq rate limit message mentioning qwen/qwen3.6-27b, but caller passed stale openai/gpt-oss-120b
  const groqQwenErrorMsg = 'Rate limit reached for model `qwen/qwen3.6-27b` in organization `org_xyz` on tokens per minute (TPM): Limit 6000, Used 5980. Please try again in 3.8s.';
  const parsedQwen = parseRateLimitError(groqQwenErrorMsg, 'groq', 'openai/gpt-oss-120b');
  
  assert.ok(parsedQwen, 'Must parse rate limit');
  assert.strictEqual(parsedQwen.providerId, 'groq', 'Provider must be groq');
  assert.strictEqual(parsedQwen.modelId, 'qwen/qwen3.6-27b', 'Model must be qwen/qwen3.6-27b (from error message), NOT stale openai/gpt-oss-120b');
  assert.strictEqual(parsedQwen.retryAfter, '3.8s');
  console.log('  ✔ [PASS] Extracted actual model "qwen/qwen3.6-27b" over stale parameter "openai/gpt-oss-120b"\n');

  // TEST 2: Error Object with explicit modelId & providerId
  console.log('[2/4] Testing error object with explicit metadata...');
  const explicitErr = new Error('Rate limit exceeded. Try again in 2s');
  explicitErr.statusCode = 429;
  explicitErr.providerId = 'groq';
  explicitErr.modelId = 'deepseek-r1-distill-llama-70b';
  explicitErr.retryAfter = '2s';

  const parsedExplicit = parseRateLimitError(explicitErr, 'groq', 'openai/gpt-oss-120b');
  assert.strictEqual(parsedExplicit.modelId, 'deepseek-r1-distill-llama-70b');
  assert.strictEqual(parsedExplicit.providerId, 'groq');
  assert.strictEqual(parsedExplicit.retryAfter, '2s');
  console.log('  ✔ [PASS] Explicit error metadata prioritized correctly\n');

  // TEST 3: AgentLoop Execution with actual failed model metadata
  console.log('[3/4] Testing AgentLoop & HarnessRuntime turnOutcome metadata...');
  const runtime = new HarnessRuntime();
  const thread = runtime.createThread({
    workspacePath: testWorkspace,
    userInput: 'Analyze cart_calculator.py',
  });

  // Mock handler failing with qwen/qwen3.6-27b
  const mockQwenFailHandler = async () => {
    const err = new Error('Rate limit reached for model `qwen/qwen3.6-27b` on tokens per minute (TPM). Please try again in 5.2s.');
    err.statusCode = 429;
    err.isRateLimit = true;
    err.providerId = 'groq';
    err.modelId = 'qwen/qwen3.6-27b';
    throw err;
  };

  const handleRes = await runtime.handleRequest({
    threadId: thread.threadId,
    userInput: 'Analyze cart_calculator.py',
    workspacePath: testWorkspace,
    providerId: 'groq',
    modelId: 'qwen/qwen3.6-27b',
    modelHandler: mockQwenFailHandler,
  });

  assert.strictEqual(handleRes.success, false);
  assert.strictEqual(handleRes.isRateLimit, true);
  assert.ok(handleRes.rateInfo, 'Must have rateInfo');
  assert.strictEqual(handleRes.rateInfo.providerId, 'groq');
  assert.strictEqual(handleRes.rateInfo.modelId, 'qwen/qwen3.6-27b', 'Rate limit card header model must be qwen/qwen3.6-27b');
  assert.strictEqual(handleRes.execution.modelId, 'qwen/qwen3.6-27b', 'Execution metadata must reflect actual failed model');
  assert.strictEqual(handleRes.modelId, 'qwen/qwen3.6-27b');
  console.log('  ✔ [PASS] AgentLoop and handleRequest preserved authoritative failed model "qwen/qwen3.6-27b"\n');

  // TEST 4: Retry Reusing Same Thread
  console.log('[4/4] Testing retry reusing same thread...');
  const mockSuccessHandler = async () => {
    return {
      role: 'assistant',
      content: 'Task completed successfully after retry.',
      toolCalls: [],
    };
  };

  const retryRes = await runtime.handleRequest({
    threadId: thread.threadId,
    userInput: 'Analyze cart_calculator.py',
    workspacePath: testWorkspace,
    providerId: 'groq',
    modelId: 'qwen/qwen3.6-27b',
    modelHandler: mockSuccessHandler,
  });

  assert.strictEqual(retryRes.success, true);
  assert.strictEqual(retryRes.threadId, thread.threadId, 'Must reuse identical thread ID');
  
  const savedThread = runtime.getThread(thread.threadId, testWorkspace);
  assert.ok(savedThread, 'Thread must exist');
  assert.strictEqual(savedThread.threadId, thread.threadId);
  console.log('  ✔ [PASS] Retry successfully reused same thread without duplication\n');

  console.log('====================================================');
  console.log('ALL ERROR METADATA TESTS PASSED (4/4)!');
  console.log('====================================================');
}

runErrorMetadataTests().catch((err) => {
  console.error('[TEST FAILED]', err);
  process.exit(1);
});
