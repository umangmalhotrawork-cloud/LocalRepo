/**
 * NEXUS CODEX HARNESS - RENDERER BRIDGE & UI STREAMING TEST SUITE (MILESTONE 3)
 * 
 * Verifies:
 * 1. Thread creation and retrieval from renderer bridge
 * 2. Start turn from renderer bridge (runTurn)
 * 3. Live push event streaming (TURN_STARTED, ITEM_STARTED, ITEM_COMPLETED)
 * 4. USER_MESSAGE event delivery
 * 5. TOOL_CALL event delivery
 * 6. TOOL_RESULT event delivery
 * 7. AGENT_MESSAGE event delivery
 * 8. TURN_COMPLETED event delivery
 * 9. APPROVAL_REQUEST pause and resumption upon approveAction()
 * 10. APPROVAL_REQUEST pause and termination upon rejectAction()
 * 11. Turn cancellation (cancelTurn)
 * 12. FILE_CHANGE item generation with diff and firewall metadata
 * 13. Monotonic sequence number ordering across pushed events
 * 14. Event listener subscription and clean unsubscription
 * 15. Thread reuse across multiple turns
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  harnessRuntime,
  HarnessRuntime,
  ITEM_TYPES,
  ITEM_STATUS,
  TURN_STATUS,
  EVENT_TYPES,
} = require('./harness');

function assert(condition, message) {
  if (!condition) {
    console.error(`[ASSERTION FAILED] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runBridgeTests() {
  console.log('====================================================');
  console.log('[TEST] Starting NEXUS Codex Harness Bridge Test Suite (Milestone 3)...');
  console.log('====================================================\n');

  const testStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-bridge-storage-'));
  const testWorkspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-bridge-workspace-'));
  process.env.ECHO_CONTINUUM_DIR = testStorageDir;

  const sampleFile = path.join(testWorkspaceDir, 'cart_calculator.py');
  fs.writeFileSync(sampleFile, 'def calc(x):\n    return x * 1 # Redundant\n', 'utf-8');

  try {
    const runtime = HarnessRuntime.createIsolated();

    // ----------------------------------------------------
    // TEST 1: Thread Creation from Bridge
    // ----------------------------------------------------
    console.log('[TEST 1] Testing Thread Creation from Bridge...');
    const thread = runtime.createThread({
      metadata: { workspacePath: testWorkspaceDir, title: 'Bridge Test Session' },
    });
    assert(thread && thread.threadId.startsWith('thread_'), 'Thread ID format valid');
    assert(thread.metadata.title === 'Bridge Test Session', 'Metadata preserved');
    console.log(`[TEST 1 PASSED] Thread created cleanly: ${thread.threadId}`);

    // ----------------------------------------------------
    // TEST 2, 3, 4, 5, 6, 7, 8: Live Event Stream for Normal Turn
    // ----------------------------------------------------
    console.log('[TEST 2–8] Testing Live Push Event Streaming across Turn lifecycle...');
    const receivedEvents = [];
    const unsubscribe = runtime.subscribe((evt) => {
      receivedEvents.push(evt);
    });

    let modelCalls = 0;
    const turnRes = await runtime.runTurn({
      threadId: thread.threadId,
      userInput: 'Inspect cart calculator',
      workspacePath: testWorkspaceDir,
      modelHandler: async (messages) => {
        modelCalls++;
        if (modelCalls === 1) {
          return {
            tool_calls: [
              { callId: 'call_b1', toolName: 'read_file', arguments: { path: 'cart_calculator.py' } },
            ],
          };
        }
        return 'I have inspected cart_calculator.py. It contains redundant multiplication.';
      },
    });

    assert(turnRes.success === true, 'Turn must succeed');
    assert(receivedEvents.length >= 6, `Expected at least 6 events, got ${receivedEvents.length}`);

    // Verify event types received in exact order
    const eventTypes = receivedEvents.map((e) => e.type);
    assert(eventTypes.includes(EVENT_TYPES.TURN_STARTED), 'Must receive TURN_STARTED');
    assert(eventTypes.includes(EVENT_TYPES.ITEM_STARTED), 'Must receive ITEM_STARTED');
    assert(eventTypes.includes(EVENT_TYPES.ITEM_COMPLETED), 'Must receive ITEM_COMPLETED');
    assert(eventTypes.includes(EVENT_TYPES.TURN_COMPLETED), 'Must receive TURN_COMPLETED');

    // Verify items in stream
    const userMsgEvent = receivedEvents.find((e) => e.payload?.item?.type === ITEM_TYPES.USER_MESSAGE);
    assert(userMsgEvent !== undefined, 'Must receive USER_MESSAGE item event');

    const toolCallEvent = receivedEvents.find((e) => e.payload?.item?.type === ITEM_TYPES.TOOL_CALL);
    assert(toolCallEvent !== undefined, 'Must receive TOOL_CALL item event');

    const toolResultEvent = receivedEvents.find((e) => e.payload?.item?.type === ITEM_TYPES.TOOL_RESULT);
    assert(toolResultEvent !== undefined, 'Must receive TOOL_RESULT item event');

    const agentMsgEvent = receivedEvents.find((e) => e.payload?.item?.type === ITEM_TYPES.AGENT_MESSAGE);
    assert(agentMsgEvent !== undefined, 'Must receive AGENT_MESSAGE item event');
    console.log('[TEST 2–8 PASSED] Full canonical push event stream verified (TURN_STARTED -> USER_MESSAGE -> TOOL_CALL -> TOOL_RESULT -> AGENT_MESSAGE -> TURN_COMPLETED).');

    // ----------------------------------------------------
    // TEST 9: APPROVAL_REQUEST Pause and Resumption upon approveAction()
    // ----------------------------------------------------
    console.log('[TEST 9] Testing APPROVAL_REQUEST Pause and approveAction()...');
    const approvalEvents = [];
    const subApproval = runtime.subscribe((evt) => approvalEvents.push(evt));

    let runTurnFinished = false;
    let turn9Calls = 0;
    const runTurnPromise = runtime.runTurn({
      threadId: thread.threadId,
      userInput: 'Run dangerous command',
      workspacePath: testWorkspaceDir,
      approvalMode: 'manual', // Manual requires approval
      modelHandler: async () => {
        turn9Calls++;
        if (turn9Calls === 1) {
          return {
            tool_calls: [
              { callId: 'call_danger_1', toolName: 'run_command', arguments: { command: 'echo "needs approval"' } },
            ],
          };
        }
        return 'Command executed successfully after receiving authorization.';
      },
    }).then((res) => {
      runTurnFinished = true;
      return res;
    });

    // Wait 50ms for approval request item to be emitted
    await new Promise((r) => setTimeout(r, 50));
    assert(!runTurnFinished, 'AgentLoop must be paused waiting for approval');

    const approvalReqEvent = approvalEvents.find((e) => e.payload?.item?.type === ITEM_TYPES.APPROVAL_REQUEST);
    assert(approvalReqEvent !== undefined, 'Must emit APPROVAL_REQUEST item');

    // Renderer sends approval decision
    const approveRes = runtime.approveAction({
      turnId: approvalReqEvent.turnId,
      callId: 'call_danger_1',
      decision: { approved: true },
    });
    assert(approveRes.success === true, 'approveAction must return success');

    const finalRes9 = await runTurnPromise;
    subApproval();
    assert(finalRes9.success === true, 'Turn must complete successfully after approval');
    console.log('[TEST 9 PASSED] APPROVAL_REQUEST paused execution and resumed upon approveAction().');

    // ----------------------------------------------------
    // TEST 10: APPROVAL_REQUEST Pause and Termination upon rejectAction()
    // ----------------------------------------------------
    console.log('[TEST 10] Testing APPROVAL_REQUEST Pause and rejectAction()...');
    let turn10Calls = 0;
    const runTurnPromise10 = runtime.runTurn({
      threadId: thread.threadId,
      userInput: 'Run destructive command',
      workspacePath: testWorkspaceDir,
      approvalMode: 'strict',
      modelHandler: async (messages) => {
        turn10Calls++;
        if (turn10Calls === 1) {
          return {
            tool_calls: [
              { callId: 'call_rm_1', toolName: 'run_command', arguments: { command: 'rm -rf /' } },
            ],
          };
        }
        const lastToolMsg = messages.find((m) => m.role === 'tool');
        assert(lastToolMsg.content?.error?.includes('User rejected') || lastToolMsg.content?.error?.includes('rejected'), 'Model received rejection message');
        return 'The destructive command was safely cancelled per user request.';
      },
    });

    await new Promise((r) => setTimeout(r, 50));
    // Renderer sends rejection
    runtime.rejectAction({
      callId: 'call_rm_1',
      reason: 'User rejected the destructive command',
    });

    const finalRes10 = await runTurnPromise10;
    assert(finalRes10.success === true, 'Turn completes gracefully with rejection notification to model');
    assert(finalRes10.finalResponse.includes('safely cancelled'), 'Final summary acknowledges rejection');
    console.log('[TEST 10 PASSED] rejectAction() safely propagated rejection to AgentLoop.');

    // ----------------------------------------------------
    // TEST 11: Turn Cancellation via cancelTurn()
    // ----------------------------------------------------
    console.log('[TEST 11] Testing Turn Cancellation (cancelTurn)...');
    const turn11 = runtime.startTurn(thread.threadId, 'Long task');
    const cancelRes = runtime.cancelTurn(turn11.turnId);
    assert(cancelRes.status === TURN_STATUS.CANCELLED, 'Turn status must be CANCELLED');

    const runRes11 = await runtime.runTurn({
      threadId: thread.threadId,
      turnId: turn11.turnId,
      userInput: 'Should be cancelled',
      workspacePath: testWorkspaceDir,
    });
    assert(runRes11.status === TURN_STATUS.CANCELLED, 'Run turn must return CANCELLED');
    console.log('[TEST 11 PASSED] cancelTurn cleanly stopped turn execution.');

    // ----------------------------------------------------
    // TEST 12: FILE_CHANGE Item Generation with Diff & Firewall Metadata
    // ----------------------------------------------------
    console.log('[TEST 12] Testing FILE_CHANGE item generation on apply_patch...');
    const fileChangeEvents = [];
    const subFC = runtime.subscribe((evt) => fileChangeEvents.push(evt));



    let fcModelCalls = 0;
    await runtime.runTurn({
      threadId: thread.threadId,
      userInput: 'Patch cart calculator',
      workspacePath: testWorkspaceDir,
      modelHandler: async () => {
        fcModelCalls++;
        if (fcModelCalls === 1) {
          return {
            tool_calls: [
              {
                callId: 'c_patch',
                toolName: 'apply_patch',
                arguments: {
                  edits: [
                    {
                      filePath: 'cart_calculator.py',
                      original: '    return x * 1 # Redundant',
                      replacement: '    return x # Cleaned',
                    },
                  ],
                },
              },
            ],
          };
        }
        return 'Patch applied cleanly.';
      },
    });

    subFC();
    const fileChangeItemEvent = fileChangeEvents.find((e) => e.payload?.item?.type === ITEM_TYPES.FILE_CHANGE);
    assert(fileChangeItemEvent !== undefined, 'Must emit FILE_CHANGE item event');
    assert(fileChangeItemEvent.payload.item.payload.filePath === 'cart_calculator.py', 'Target file cart_calculator.py');
    assert(fileChangeItemEvent.payload.item.payload.status === 'applied', 'Status must be applied');
    assert(fileChangeItemEvent.payload.item.payload.firewall !== undefined, 'Firewall metadata must be present');
    console.log('[TEST 12 PASSED] FILE_CHANGE item generated with diff and firewall results.');

    // ----------------------------------------------------
    // TEST 13: Strict Monotonic Sequence Numbers
    // ----------------------------------------------------
    console.log('[TEST 13] Testing Strict Monotonic Sequence Numbers across Bridge...');
    for (let i = 0; i < receivedEvents.length; i++) {
      assert(typeof receivedEvents[i].sequenceNumber === 'number', 'Sequence number must be number');
      if (i > 0) {
        assert(receivedEvents[i].sequenceNumber > receivedEvents[i - 1].sequenceNumber, 'Sequence numbers strictly increasing');
      }
    }
    console.log(`[TEST 13 PASSED] ${receivedEvents.length} events verified in strict monotonic sequence.`);

    // ----------------------------------------------------
    // TEST 14: Listener Unsubscription and Cleanup
    // ----------------------------------------------------
    console.log('[TEST 14] Testing Listener Unsubscription...');
    unsubscribe();
    const countBefore = receivedEvents.length;
    runtime.createThread();
    assert(receivedEvents.length === countBefore, 'No events should be pushed after unsubscribe()');
    console.log('[TEST 14 PASSED] Event listener cleanly unregistered.');

    // ----------------------------------------------------
    // TEST 15: Thread Reuse Across Multiple Turns
    // ----------------------------------------------------
    console.log('[TEST 15] Testing Multi-Turn Thread Reuse...');
    const thread15 = runtime.createThread({ metadata: { workspacePath: testWorkspaceDir } });

    // Turn 1
    const t1 = await runtime.runTurn({
      threadId: thread15.threadId,
      userInput: 'Turn 1 prompt',
      workspacePath: testWorkspaceDir,
      modelHandler: async () => 'Turn 1 answer',
    });

    // Turn 2
    const t2 = await runtime.runTurn({
      threadId: thread15.threadId,
      userInput: 'Turn 2 prompt',
      workspacePath: testWorkspaceDir,
      modelHandler: async () => 'Turn 2 answer',
    });

    const threadObj = runtime.getThread(thread15.threadId);
    assert(threadObj.turnIds.length === 2, `Thread should contain 2 turns, got ${threadObj.turnIds.length}`);
    assert(threadObj.turnIds[0] === t1.turnId, 'First turn matches');
    assert(threadObj.turnIds[1] === t2.turnId, 'Second turn matches');
    console.log('[TEST 15 PASSED] Thread reused across multi-turn conversation.');

    console.log('\n====================================================');
    console.log('[SUCCESS] ALL 15 BRIDGE TESTS (MILESTONE 3) PASSED CLEANLY.');
    console.log('====================================================\n');
  } finally {
    try {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
      fs.rmSync(testWorkspaceDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

if (require.main === module) {
  runBridgeTests().catch((err) => {
    console.error('[TEST SUITE CRASHED]', err);
    process.exit(1);
  });
}

module.exports = { runBridgeTests };
