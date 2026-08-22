/**
 * Focused Regression Test: ChangeSet Approval Gate & Mutation Intent Handling
 * 
 * Verifies Manual Test 4 Scenario:
 * "Inspect cart_calculator.py and propose a minimal fix for the redundant arithmetic operations.
 * First explain what you intend to change.
 * Create a ChangeSet and show me the proposed diff.
 * Do NOT apply the change yet. Wait for my approval."
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { harnessRuntime } = require('./harness/HarnessRuntime');
const { requestRouter, ROUTER_MODES, CODING_INTENTS } = require('./harness/RequestRouter');
const { ITEM_TYPES, TURN_STATUS } = require('./harness/types');

async function runChangeSetApprovalGateTest() {
  console.log('====================================================');
  console.log('TESTING CHANGESET APPROVAL GATE & MUTATION INTENT');
  console.log('====================================================\n');

  const testPrompt = `Inspect cart_calculator.py and propose a minimal fix for the redundant arithmetic operations.

First explain what you intend to change.

Create a ChangeSet and show me the proposed diff.

Do NOT apply the change yet. Wait for my approval.`;

  // 1. Classification Verification
  console.log('[1/5] Verifying RequestRouter Classification...');
  const classification = requestRouter.classify(testPrompt, {
    workspacePath: process.cwd(),
    activeFilePath: path.join(process.cwd(), 'cart_calculator.py'),
  });

  console.log('Classification:', classification);
  assert.strictEqual(classification.mode, ROUTER_MODES.CODING_TASK, 'Mode must be CODING_TASK');
  assert.strictEqual(classification.codingIntent, CODING_INTENTS.MUTATION, 'Coding intent must be MUTATION');
  console.log('  ✔ [PASS] Classification resolved to CODING_TASK (MUTATION)\n');

  // 2. Simulated Model Proposing ChangeSet via apply_patch with strict approval
  console.log('[2/5] Testing AgentLoop ChangeSet Staging & Approval Gate...');
  
  const testFilePath = path.join(process.cwd(), '.nexus-recovery/test_cart_calc.py');
  fs.mkdirSync(path.dirname(testFilePath), { recursive: true });
  fs.writeFileSync(testFilePath, 'def calculate(x):\n    return x + 0 * 1\n', 'utf8');

  let approvalRequested = false;
  let stagedChangeSet = null;

  const mockModelHandler = (messages, tools, options) => {
    const patchResult = messages.find((m) => m.role === 'tool' && (m.name === 'apply_patch' || m.tool_call_id === 'call_apply_patch_01'));
    if (patchResult) {
      return {
        role: 'assistant',
        content: 'ChangeSet was approved and applied successfully.',
        toolCalls: [],
      };
    }

    const readFileResult = messages.find((m) => m.role === 'tool' && (m.name === 'read_file' || m.tool_call_id === 'call_read_file_01'));
    if (readFileResult) {
      return {
        role: 'assistant',
        content: 'I have analyzed test_cart_calc.py and staged the redundant arithmetic removal in a ChangeSet.',
        toolCalls: [
          {
            type: 'tool_call',
            callId: 'call_apply_patch_01',
            toolName: 'apply_patch',
            arguments: {
              edits: [
                {
                  filePath: '.nexus-recovery/test_cart_calc.py',
                  original: 'return x + 0 * 1',
                  replacement: 'return x',
                },
              ],
            },
          },
        ],
      };
    }

    return {
      role: 'assistant',
      content: 'I will inspect test_cart_calc.py first.',
      toolCalls: [
        {
          type: 'tool_call',
          callId: 'call_read_file_01',
          toolName: 'read_file',
          arguments: { path: '.nexus-recovery/test_cart_calc.py' },
        },
      ],
    };
  };

  const thread = harnessRuntime.createThread({
    metadata: { workspacePath: process.cwd(), title: 'Test 4 ChangeSet' },
  });

  // Launch turn with manual approval handler
  const turnPromise = harnessRuntime.runTurn({
    threadId: thread.threadId,
    userInput: testPrompt,
    workspacePath: process.cwd(),
    intent: 'MUTATION',
    approvalMode: 'strict',
    modelHandler: mockModelHandler,
  });

  // Allow agent loop to advance to tool call and complete safety evaluation
  let activeTurn = null;
  let approvalItem = null;
  for (let t = 0; t < 40; t++) {
    activeTurn = harnessRuntime.turnManager.listTurnsByThread(thread.threadId)[0];
    if (activeTurn) {
      const turnItems = harnessRuntime.itemStore.getItemsByTurn(activeTurn.turnId);
      approvalItem = turnItems.find((i) => i.type === ITEM_TYPES.APPROVAL_REQUEST);
      if (approvalItem) break;
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  const turnItems = harnessRuntime.itemStore.getItemsByTurn(activeTurn.turnId);
  const changeSetItem = turnItems.find((i) => i.type === ITEM_TYPES.CHANGE_SET);

  assert.ok(approvalItem, 'APPROVAL_REQUEST item must be created in turn items');
  assert.ok(approvalItem.payload.changeSet, 'APPROVAL_REQUEST must contain staged ChangeSet');
  assert.ok(changeSetItem, 'CHANGE_SET item must be recorded in turn items');
  console.log('Staged ChangeSet ID:', approvalItem.payload.changeSet.changeSetId);
  console.log('ChangeSet Files:', approvalItem.payload.changeSet.files);

  // 3. Verify disk file has NOT been modified before user approval
  console.log('\n[3/5] Verifying disk file remains untouched before approval...');
  const diskContentBefore = fs.readFileSync(testFilePath, 'utf8');
  assert.strictEqual(diskContentBefore, 'def calculate(x):\n    return x + 0 * 1\n', 'Disk file must NOT be modified before approval');
  console.log('  ✔ [PASS] Disk file untouched while waiting for approval\n');

  // 4. User Approves the Action
  console.log('[4/5] Approving staged ChangeSet action...');
  const approveRes = harnessRuntime.approveAction({
    turnId: activeTurn.turnId,
    callId: 'call_apply_patch_01',
    decision: { approved: true },
  });
  assert.strictEqual(approveRes.success, true, 'Approval action must succeed');

  const outcome = await turnPromise;
  assert.strictEqual(outcome.success, true, 'Turn must complete successfully after approval');

  // Verify disk file is now modified
  const diskContentAfter = fs.readFileSync(testFilePath, 'utf8');
  assert.strictEqual(diskContentAfter, 'def calculate(x):\n    return x\n', 'Disk file must be modified after approval');
  console.log('  ✔ [PASS] Disk file updated transactionally after explicit approval\n');

  // 5. Verify READ_ONLY request strictly blocks apply_patch
  console.log('[5/5] Verifying READ_ONLY request rejects apply_patch...');
  const readOnlyPrompt = 'Read cart_calculator.py and explain what it does. Do not modify it.';
  const roClassification = requestRouter.classify(readOnlyPrompt);
  assert.strictEqual(roClassification.codingIntent, CODING_INTENTS.READ_ONLY);

  const roThread = harnessRuntime.createThread({ metadata: { workspacePath: process.cwd() } });
  const roOutcome = await harnessRuntime.runTurn({
    threadId: roThread.threadId,
    userInput: readOnlyPrompt,
    workspacePath: process.cwd(),
    intent: 'READ_ONLY',
    modelHandler: () => ({
      role: 'assistant',
      content: 'Trying unauthorized patch',
      toolCalls: [
        {
          type: 'tool_call',
          callId: 'call_ro_patch',
          toolName: 'apply_patch',
          arguments: { edits: [{ filePath: '.nexus-recovery/test_cart_calc.py', replacement: 'foo' }] },
        },
      ],
    }),
  });

  const roTurn = harnessRuntime.turnManager.listTurnsByThread(roThread.threadId)[0];
  const roItems = harnessRuntime.itemStore.getItemsByTurn(roTurn.turnId);
  const roToolResult = roItems.find((i) => i.type === ITEM_TYPES.TOOL_RESULT);
  assert.ok(roToolResult && roToolResult.payload?.error?.includes('strictly disallowed in READ_ONLY'), 'READ_ONLY must block apply_patch');
  console.log('  ✔ [PASS] READ_ONLY intent strictly blocks apply_patch tool\n');

  // Cleanup test file
  try { fs.unlinkSync(testFilePath); } catch (e) {}

  console.log('====================================================');
  console.log('ALL CHANGESET APPROVAL GATE & MUTATION TESTS PASSED!');
  console.log('====================================================');
}

runChangeSetApprovalGateTest().catch((err) => {
  console.error('[TEST FAILED]', err);
  process.exit(1);
});
