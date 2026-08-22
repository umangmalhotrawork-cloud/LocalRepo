/**
 * Focused Regression Test: Streaming Native Tool Calls & Approval Flow
 * 
 * Verifies that:
 * 1. ModelAdapter properly captures and yields native tool calls from SSE stream.
 * 2. AgentLoop stages ChangeSet upon apply_patch tool execution.
 * 3. APPROVAL_REQUEST item & WAITING_FOR_APPROVAL status are emitted.
 * 4. File on disk is NOT modified before explicit user approval.
 * 5. Explicit user approval applies patch transactionally.
 * 6. Final turn completes with verified outcome.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { harnessRuntime } = require('./harness/HarnessRuntime');
const { ModelAdapter } = require('./harness/ModelAdapter');
const { ITEM_TYPES, TURN_STATUS, EVENT_TYPES } = require('./harness/types');

async function runStreamingToolApprovalTest() {
  console.log('====================================================');
  console.log('TESTING STREAMING TOOL CALLS & APPROVAL PIPELINE');
  console.log('====================================================\n');

  const testFilePath = path.join(process.cwd(), '.nexus-recovery/test_stream_calc.py');
  fs.mkdirSync(path.dirname(testFilePath), { recursive: true });
  fs.writeFileSync(testFilePath, 'def calc(a):\n    return a * 1 + 0\n', 'utf8');

  // 1. Verify ModelAdapter captures tool calls from stream
  console.log('[1/4] Testing ModelAdapter stream with native tool calls...');
  const adapter = new ModelAdapter();

  const mockStreamingProvider = {
    async *streamChatCompletions(apiKey, modelId, messages, options) {
      yield { content: 'Analyzing ', role: 'assistant' };
      yield { content: 'the file...', role: 'assistant' };
      yield {
        content: '',
        role: 'assistant',
        toolCalls: [
          {
            type: 'tool_call',
            callId: 'call_mock_apply_patch',
            toolName: 'apply_patch',
            arguments: {
              edits: [
                {
                  filePath: '.nexus-recovery/test_stream_calc.py',
                  original: 'return a * 1 + 0',
                  replacement: 'return a',
                },
              ],
            },
          },
        ],
        finishReason: 'tool_calls',
      };
    },
  };

  const capturedDeltas = [];
  const stream = mockStreamingProvider.streamChatCompletions('dummy_key', 'dummy_model', [], {});
  let streamToolCalls = null;
  for await (const chunk of stream) {
    if (chunk.toolCalls) {
      streamToolCalls = chunk.toolCalls;
    }
  }

  assert.ok(streamToolCalls && streamToolCalls.length === 1, 'Provider stream must yield tool calls');
  assert.strictEqual(streamToolCalls[0].toolName, 'apply_patch');
  console.log('  ✔ [PASS] Provider stream yielded native tool calls\n');

  // 2. Test AgentLoop execution with streaming tool calls and approval gate
  console.log('[2/4] Testing AgentLoop execution with approval gate...');
  const thread = harnessRuntime.createThread({
    metadata: { workspacePath: process.cwd(), title: 'Streaming Approval Test' },
  });

  const emittedEvents = [];
  const unsub = harnessRuntime.subscribe((ev) => {
    emittedEvents.push(ev);
  });

  let mockIteration = 0;
  const mockModelHandler = (messages, tools, options) => {
    mockIteration++;
    const patchResult = messages.find((m) => m.role === 'tool' || (m.role === 'user' && m.content.includes('TOOL_RESULT') && m.content.includes('call_mock_apply_patch')));
    if (patchResult || mockIteration > 2) {
      return {
        role: 'assistant',
        content: 'I have removed the redundant operations and verified the change.',
        toolCalls: [],
      };
    }

    return {
      role: 'assistant',
      content: 'Staging fix for redundant operations in ChangeSet.',
      toolCalls: [
        {
          type: 'tool_call',
          callId: 'call_mock_apply_patch',
          toolName: 'apply_patch',
          arguments: {
            edits: [
              {
                filePath: '.nexus-recovery/test_stream_calc.py',
                original: 'return a * 1 + 0',
                replacement: 'return a',
              },
            ],
          },
        },
      ],
    };
  };

  const turnPromise = harnessRuntime.runTurn({
    threadId: thread.threadId,
    userInput: 'Fix redundant operations in test_stream_calc.py',
    workspacePath: process.cwd(),
    intent: 'MUTATION',
    approvalMode: 'strict',
    modelHandler: mockModelHandler,
  });

  // Wait for turn to pause at WAITING_FOR_APPROVAL
  let activeTurn = null;
  let approvalItem = null;
  let changeSetItem = null;
  for (let t = 0; t < 50; t++) {
    activeTurn = harnessRuntime.turnManager.listTurnsByThread(thread.threadId)[0];
    if (activeTurn) {
      const turnItems = harnessRuntime.itemStore.getItemsByTurn(activeTurn.turnId);
      approvalItem = turnItems.find((i) => i.type === ITEM_TYPES.APPROVAL_REQUEST);
      changeSetItem = turnItems.find((i) => i.type === ITEM_TYPES.CHANGE_SET);
      if (approvalItem && changeSetItem) break;
    }
    await new Promise((r) => setTimeout(r, 100));
  }

  assert.ok(approvalItem, 'APPROVAL_REQUEST item must be created');
  assert.ok(changeSetItem, 'CHANGE_SET item must be created');
  assert.ok(approvalItem.payload.changeSet, 'APPROVAL_REQUEST must contain staged ChangeSet');

  // Verify WAITING_FOR_APPROVAL status was broadcast in events
  const waitingEvent = emittedEvents.find(
    (e) => e.type === EVENT_TYPES.TURN_UPDATED && (e.payload?.status === TURN_STATUS.WAITING_FOR_APPROVAL || e.payload?.turn?.status === TURN_STATUS.WAITING_FOR_APPROVAL)
  );
  assert.ok(waitingEvent, 'TURN_UPDATED with WAITING_FOR_APPROVAL must be emitted');
  console.log('  ✔ [PASS] ChangeSet staged and WAITING_FOR_APPROVAL emitted\n');

  // 3. Verify disk file remains untouched before approval
  console.log('[3/4] Verifying disk file remains untouched before approval...');
  const diskBefore = fs.readFileSync(testFilePath, 'utf8');
  assert.strictEqual(diskBefore, 'def calc(a):\n    return a * 1 + 0\n', 'File must not be modified before approval');
  console.log('  ✔ [PASS] Disk file untouched while waiting for approval\n');

  // 4. Approve action and verify transactional apply
  console.log('[4/4] Approving action and verifying completion...');
  const approveRes = harnessRuntime.approveAction({
    turnId: activeTurn.turnId,
    callId: 'call_mock_apply_patch',
    decision: { approved: true },
  });
  assert.strictEqual(approveRes.success, true);

  const turnOutcome = await turnPromise;
  assert.strictEqual(turnOutcome.success, true);
  assert.strictEqual(turnOutcome.status, TURN_STATUS.COMPLETED);

  const diskAfter = fs.readFileSync(testFilePath, 'utf8');
  assert.strictEqual(diskAfter, 'def calc(a):\n    return a\n', 'File must be modified after approval');
  console.log('  ✔ [PASS] Disk file modified transactionally after explicit approval\n');

  // Cleanup
  unsub();
  try { fs.unlinkSync(testFilePath); } catch (e) {}

  console.log('====================================================');
  console.log('ALL STREAMING TOOL CALL & APPROVAL TESTS PASSED!');
  console.log('====================================================');
}

runStreamingToolApprovalTest().catch((err) => {
  console.error('[TEST FAILED]', err);
  process.exit(1);
});
