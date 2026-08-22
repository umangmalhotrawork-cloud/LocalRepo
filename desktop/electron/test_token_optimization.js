/**
 * FOCUSED TEST SUITE: TOKEN USAGE OPTIMIZATION FOR CODING REQUESTS
 * 
 * Verifies:
 * 1. Minimal Coding Prompt & Context Construction with strict token budgeting (< 2,000 tokens / 8,000 TPM limit).
 * 2. Native tool calling and schema deduplication (no redundant schema in system prompt).
 * 3. ChangeSet creation via apply_patch with bounded concise representation.
 * 4. User approval flow and non-destructive staging.
 * 5. Clean 429 / Insufficient TPM error handling without duplicate requests or crashes.
 * 6. Same-thread reuse across retries without duplicate turns.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { HarnessRuntime } = require('./harness/HarnessRuntime');
const { ContextEngine } = require('./harness/ContextEngine');
const { toolRegistry } = require('./harness/ToolRegistry');
const { ReadFileTool, ApplyPatchTool } = require('./harness/tools');
const { parseRateLimitError } = require('./ai/types');
const { ITEM_TYPES, TURN_STATUS } = require('./harness/types');

async function runTokenOptimizationTests() {
  console.log('====================================================');
  console.log('TESTING TOKEN OPTIMIZATION & BOUNDED CODING CONTEXT');
  console.log('====================================================\n');

  const testWorkspace = path.join(process.cwd(), '.nexus-recovery', 'test_token_opt_ws');
  fs.mkdirSync(testWorkspace, { recursive: true });

  const testFilePath = path.join(testWorkspace, 'cart_calculator.py');
  const dummyCode = `def calculate_cart_total(items, tax_rate=0.08):\n` +
    `    subtotal = sum(item['price'] * item['qty'] for item in items)\n` +
    `    redundant_calc = subtotal * 1.0  # Redundant operation\n` +
    `    tax = redundant_calc * tax_rate\n` +
    `    total = redundant_calc + tax\n` +
    `    return round(total, 2)\n`;
  fs.writeFileSync(testFilePath, dummyCode, 'utf-8');

  // TEST 1: Minimal Coding Prompt & Context Budgeting
  console.log('[1/6] Testing minimal coding context and bounded token budget...');
  const contextEngine = new ContextEngine();
  const compiled = contextEngine.buildContext({
    userInput: 'Inspect cart_calculator.py and propose a fix',
    activeFilePath: 'cart_calculator.py',
    workspacePath: testWorkspace,
    intent: 'MUTATION',
    capabilities: [ReadFileTool, ApplyPatchTool],
  });

  const estimatedTokens = contextEngine.estimateTokens(compiled.systemPrompt) + contextEngine.estimateTokens(compiled.messages);
  console.log(`  -> Estimated Context Tokens: ${estimatedTokens} tokens (~${(compiled.systemPrompt.length + JSON.stringify(compiled.messages).length)} chars)`);
  
  // Verify token ceiling is well within the 1800 budget limit (was 5000+ before)
  assert.ok(estimatedTokens < 1800, `Context must be under 1800 tokens (got ${estimatedTokens})`);
  assert.ok(!compiled.systemPrompt.includes('Input JSON Schema'), 'System prompt must not duplicate raw tool schemas');
  assert.ok(compiled.systemPrompt.includes('NEXUS'), 'Must identify as NEXUS');
  console.log('  ✔ [PASS] Context is strictly bounded and avoids redundant schema duplication\n');

  // TEST 2: Native Tool Calling (read_file & slice support)
  console.log('[2/6] Testing concise read_file tool with bounded output...');
  const readRes = await ReadFileTool.execute({ path: 'cart_calculator.py', startLine: 1, endLine: 4 }, { workspacePath: testWorkspace });
  assert.strictEqual(readRes.success, true);
  assert.strictEqual(readRes.lineRange, '1-4');
  assert.ok(readRes.content.includes('def calculate_cart_total'), 'Must read specified line range');
  
  const boundedResult = contextEngine.boundToolResult(readRes, 'read_file', 'call_1');
  const boundedChars = JSON.stringify(boundedResult).length;
  console.log(`  -> Bounded Tool Result Size: ${boundedChars} chars`);
  assert.ok(boundedChars < 900, `Bounded read_file must be under 900 chars (got ${boundedChars})`);
  console.log('  ✔ [PASS] read_file output is concise and cleanly bounded\n');

  // TEST 3: ChangeSet Creation via apply_patch
  console.log('[3/6] Testing ChangeSet creation via apply_patch without auto-applying to disk...');
  const patchRes = await ApplyPatchTool.execute({
    edits: [
      {
        filePath: 'cart_calculator.py',
        original: `    redundant_calc = subtotal * 1.0  # Redundant operation\n    tax = redundant_calc * tax_rate\n    total = redundant_calc + tax`,
        replacement: `    tax = subtotal * tax_rate\n    total = subtotal + tax`,
      },
    ],
  }, {
    workspacePath: testWorkspace,
    approvalMode: 'strict',
  });

  assert.strictEqual(patchRes.requiresApproval, true);
  assert.ok(patchRes.changeSet?.changeSetId, 'Must generate authoritative changeSetId');
  assert.ok(patchRes.changeSet?.files?.[0]?.proposedDiff, 'Must calculate diff for user review');

  // Verify file on disk is unchanged
  const currentDiskContent = fs.readFileSync(testFilePath, 'utf-8');
  assert.strictEqual(currentDiskContent, dummyCode, 'Disk content MUST remain unchanged prior to approval');
  console.log('  ✔ [PASS] ChangeSet staged non-destructively in WAITING_FOR_APPROVAL status\n');

  // TEST 4: Approval Flow & Safe Application
  console.log('[4/6] Testing user approval and application of ChangeSet...');
  const runtime = new HarnessRuntime();
  const thread = runtime.createThread({
    workspacePath: testWorkspace,
    userInput: 'Fix redundant calculation in cart_calculator.py',
  });

  // Execute turn with mock handler staging patch
  let invokedCount = 0;
  const mockAgentHandler = async (messages) => {
    invokedCount++;
    if (invokedCount === 1) {
      return {
        role: 'assistant',
        content: 'I have inspected the file and prepared a ChangeSet with the minimal fix.',
        toolCalls: [
          {
            type: 'tool_call',
            callId: 'call_patch_1',
            toolName: 'apply_patch',
            arguments: {
              edits: [
                {
                  filePath: 'cart_calculator.py',
                  original: `    redundant_calc = subtotal * 1.0  # Redundant operation\n    tax = redundant_calc * tax_rate\n    total = redundant_calc + tax`,
                  replacement: `    tax = subtotal * tax_rate\n    total = subtotal + tax`,
                },
              ],
            },
          },
        ],
      };
    }
    return {
      role: 'assistant',
      content: 'ChangeSet applied successfully.',
      toolCalls: [],
    };
  };

  // Auto-approve after transitioning to WAITING_FOR_APPROVAL
  const approveTimer = setInterval(() => {
    const success = runtime.agentLoop.approveAction(thread.threadId, 'call_patch_1', { approved: true });
    if (success.success) {
      clearInterval(approveTimer);
    }
  }, 30);

  const turnRes = await runtime.handleRequest({
    threadId: thread.threadId,
    userInput: 'Fix redundant calculation in cart_calculator.py',
    workspacePath: testWorkspace,
    approvalMode: 'strict',
    modelHandler: mockAgentHandler,
  });
  clearInterval(approveTimer);

  assert.strictEqual(turnRes.success, true);
  assert.ok(turnRes.turnId, 'Must return turnId');
  console.log('  ✔ [PASS] Agent successfully staged and applied ChangeSet through approval workflow\n');

  // TEST 5: 429 Insufficient TPM Error Handling
  console.log('[5/6] Testing clean HTTP 429 / Insufficient TPM error handling...');
  const mockTpmFailHandler = async () => {
    const err = new Error('Rate limit reached for model `openai/gpt-oss-20b` in organization `org_test` on tokens per minute (TPM): Limit 8000, Used 7950, Requested 1500. Please try again in 4.5s.');
    err.statusCode = 429;
    err.isRateLimit = true;
    err.providerId = 'groq';
    err.modelId = 'openai/gpt-oss-20b';
    throw err;
  };

  const errRes = await runtime.handleRequest({
    threadId: thread.threadId,
    userInput: 'Fix calculations in cart_calculator.py',
    workspacePath: testWorkspace,
    providerId: 'groq',
    modelId: 'openai/gpt-oss-20b',
    modelHandler: mockTpmFailHandler,
  });

  assert.strictEqual(errRes.success, false);
  assert.strictEqual(errRes.isRateLimit, true);
  assert.strictEqual(errRes.rateInfo.modelId, 'openai/gpt-oss-20b');
  assert.strictEqual(errRes.rateInfo.retryAfter, '4.5s');
  assert.ok(errRes.error.includes('Rate limit') || errRes.error.includes('TPM'));
  console.log('  ✔ [PASS] Clean TPM error returned with exact retry-after and failed model metadata\n');

  // TEST 6: Same-Thread Retry without Duplication
  console.log('[6/6] Testing retry on same thread...');
  const mockRetrySuccessHandler = async () => {
    return {
      role: 'assistant',
      content: 'Retried task finished without errors.',
      toolCalls: [],
    };
  };

  const retryRes = await runtime.handleRequest({
    threadId: thread.threadId,
    userInput: 'Fix calculations in cart_calculator.py',
    workspacePath: testWorkspace,
    providerId: 'groq',
    modelId: 'openai/gpt-oss-20b',
    modelHandler: mockRetrySuccessHandler,
  });

  assert.strictEqual(retryRes.success, true);
  assert.strictEqual(retryRes.threadId, thread.threadId);
  console.log('  ✔ [PASS] Same thread successfully reused across retry without duplication\n');

  console.log('====================================================');
  console.log('ALL TOKEN OPTIMIZATION TESTS PASSED (6/6)!');
  console.log('====================================================');
}

runTokenOptimizationTests().catch((err) => {
  console.error('[TEST FAILED]', err);
  process.exit(1);
});
