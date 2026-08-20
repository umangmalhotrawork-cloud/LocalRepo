/**
 * NEXUS CODEX HARNESS CORE - COMPREHENSIVE INTEGRATION & LIFECYCLE TEST SUITE
 * 
 * Verifies:
 * 1. Thread creation (createThread)
 * 2. Thread retrieval (getThread, listThreads)
 * 3. Thread persistence via Continuum adapter
 * 4. Turn creation (startTurn)
 * 5. Multiple turns in one thread
 * 6. Item creation across typed items (USER_MESSAGE, AGENT_MESSAGE, PLAN, TOOL_CALL, TOOL_RESULT, FILE_CHANGE, APPROVAL_REQUEST, ERROR)
 * 7. Item completion (completeItem)
 * 8. Turn completion (completeTurn)
 * 9. Failed turn handling (failTurn)
 * 10. Cancelled turn handling (cancelTurn)
 * 11. Invalid lifecycle transitions (item to completed turn, re-running completed item)
 * 12. Deterministic event ordering and sequence numbers
 * 13. Concurrent thread isolation
 * 14. Application restart / persistence reload round-trip
 * 15. Expected canonical event sequence: THREAD_CREATED -> TURN_STARTED -> ITEM_STARTED -> ITEM_COMPLETED -> TURN_COMPLETED
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  harnessRuntime,
  HarnessRuntime,
  THREAD_STATUS,
  TURN_STATUS,
  ITEM_STATUS,
  ITEM_TYPES,
  EVENT_TYPES,
} = require('./harness');

function assert(condition, message) {
  if (!condition) {
    console.error(`[ASSERTION FAILED] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runHarnessCoreTests() {
  console.log('====================================================');
  console.log('[TEST] Starting NEXUS Codex Harness Core Test Suite...');
  console.log('====================================================\n');

  // Setup isolated temporary storage directory for Continuum
  const testStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-harness-test-'));
  process.env.ECHO_CONTINUUM_DIR = testStorageDir;

  const workspaceA = '/test/workspace/alpha';
  const workspaceB = '/test/workspace/beta';

  try {
    harnessRuntime.reset();

    // ----------------------------------------------------
    // TEST 1: Thread Creation
    // ----------------------------------------------------
    console.log('[TEST 1] Testing Thread Creation (createThread)...');
    const thread1 = harnessRuntime.createThread({
      metadata: { workspacePath: workspaceA, title: 'Session Alpha 1' },
    });
    assert(thread1 && thread1.threadId, 'Thread must have a valid threadId');
    assert(thread1.threadId.startsWith('thread_'), 'threadId must have prefix thread_');
    assert(thread1.status === THREAD_STATUS.ACTIVE, `Thread status must be ACTIVE, got ${thread1.status}`);
    assert(typeof thread1.createdAt === 'number', 'Thread must have numeric createdAt');
    assert(typeof thread1.updatedAt === 'number', 'Thread must have numeric updatedAt');
    console.log(`[TEST 1 PASSED] Thread created cleanly: ${thread1.threadId}`);

    // ----------------------------------------------------
    // TEST 2: Thread Retrieval
    // ----------------------------------------------------
    console.log('[TEST 2] Testing Thread Retrieval (getThread, listThreads)...');
    const retrieved1 = harnessRuntime.getThread(thread1.threadId);
    assert(retrieved1 !== null, 'getThread must return created thread');
    assert(retrieved1.threadId === thread1.threadId, 'Thread ID must match');
    assert(Array.isArray(retrieved1.turnIds), 'turnIds must be an array');
    assert(Array.isArray(retrieved1.turns), 'turns must be an array');

    const threadList = harnessRuntime.listThreads({ workspacePath: workspaceA });
    assert(threadList.length === 1, `Expected 1 thread for workspaceA, got ${threadList.length}`);
    assert(threadList[0].threadId === thread1.threadId, 'listThreads must return thread1');
    console.log('[TEST 2 PASSED] Thread retrieval verified.');

    // ----------------------------------------------------
    // TEST 3: Thread Persistence via Continuum Adapter
    // ----------------------------------------------------
    console.log('[TEST 3] Testing Thread Persistence via Continuum adapter...');
    const saveRes1 = harnessRuntime.saveThread(thread1.threadId, workspaceA);
    assert(saveRes1.success, `saveThread must succeed: ${saveRes1.error}`);
    assert(fs.existsSync(saveRes1.path), `Saved snapshot file must exist on disk at ${saveRes1.path}`);
    console.log(`[TEST 3 PASSED] Thread persisted to Continuum at: ${saveRes1.path}`);

    // ----------------------------------------------------
    // TEST 4: Turn Creation
    // ----------------------------------------------------
    console.log('[TEST 4] Testing Turn Creation (startTurn)...');
    const turn1 = harnessRuntime.startTurn(thread1.threadId, 'Refactor cart calculation logic', {
      source: 'user_chat',
    });
    assert(turn1 && turn1.turnId, 'Turn must have a valid turnId');
    assert(turn1.turnId.startsWith('turn_'), 'turnId must have prefix turn_');
    assert(turn1.threadId === thread1.threadId, 'Turn threadId must match parent threadId');
    assert(turn1.status === TURN_STATUS.RUNNING, `Turn status must be RUNNING, got ${turn1.status}`);
    assert(turn1.userInput === 'Refactor cart calculation logic', 'Turn userInput must match');
    assert(typeof turn1.startedAt === 'number', 'startedAt must be numeric timestamp');

    const updatedThread1 = harnessRuntime.getThread(thread1.threadId);
    assert(updatedThread1.turnIds.includes(turn1.turnId), 'Parent thread turnIds must include turn1');
    assert(updatedThread1.turns.length === 1, 'Parent thread turns must contain 1 turn');
    console.log(`[TEST 4 PASSED] Turn created cleanly: ${turn1.turnId}`);

    // ----------------------------------------------------
    // TEST 5: Item Creation (across typed items)
    // ----------------------------------------------------
    console.log('[TEST 5] Testing Item Creation across typed items...');
    const userMsgItem = harnessRuntime.startItem(turn1.turnId, ITEM_TYPES.USER_MESSAGE, {
      text: 'Refactor cart calculation logic',
    });
    assert(userMsgItem.itemId.startsWith('item_'), 'itemId must have prefix item_');
    assert(userMsgItem.type === ITEM_TYPES.USER_MESSAGE, 'Item type must match USER_MESSAGE');
    assert(userMsgItem.status === ITEM_STATUS.STARTED, 'Item status must be STARTED');

    const planItem = harnessRuntime.startItem(turn1.turnId, ITEM_TYPES.PLAN, {
      steps: ['Step 1: Inspect AST', 'Step 2: Apply patch'],
    });
    assert(planItem.type === ITEM_TYPES.PLAN, 'Item type must match PLAN');

    const toolCallItem = harnessRuntime.startItem(turn1.turnId, ITEM_TYPES.TOOL_CALL, {
      tool: 'read_file',
      args: { path: 'src/cart.py' },
    });
    assert(toolCallItem.type === ITEM_TYPES.TOOL_CALL, 'Item type must match TOOL_CALL');

    const fileChangeItem = harnessRuntime.startItem(turn1.turnId, ITEM_TYPES.FILE_CHANGE, {
      filePath: 'src/cart.py',
      diff: '+ def calculate(): pass',
    });
    assert(fileChangeItem.type === ITEM_TYPES.FILE_CHANGE, 'Item type must match FILE_CHANGE');

    const approvalItem = harnessRuntime.startItem(turn1.turnId, ITEM_TYPES.APPROVAL_REQUEST, {
      action: 'apply_patch',
    });
    assert(approvalItem.type === ITEM_TYPES.APPROVAL_REQUEST, 'Item type must match APPROVAL_REQUEST');

    const agentMsgItem = harnessRuntime.startItem(turn1.turnId, ITEM_TYPES.AGENT_MESSAGE, {
      summary: 'Refactoring plan prepared and verified.',
    });
    assert(agentMsgItem.type === ITEM_TYPES.AGENT_MESSAGE, 'Item type must match AGENT_MESSAGE');

    const turnWithItems = harnessRuntime.getTurn(turn1.turnId);
    assert(turnWithItems.items.length === 6, `Expected 6 items in turn1, got ${turnWithItems.items.length}`);
    console.log('[TEST 5 PASSED] Typed items created cleanly.');

    // ----------------------------------------------------
    // TEST 6: Item Update & Completion
    // ----------------------------------------------------
    console.log('[TEST 6] Testing Item Update and Completion...');
    const updatedPlan = harnessRuntime.updateItem(planItem.itemId, {
      progress: 'Step 1 complete',
    });
    assert(updatedPlan.status === ITEM_STATUS.IN_PROGRESS, 'Status must be IN_PROGRESS after update');
    assert(updatedPlan.payload.progress === 'Step 1 complete', 'Payload must be updated');

    const completedPlan = harnessRuntime.completeItem(planItem.itemId, {
      result: 'All steps planned',
    });
    assert(completedPlan.status === ITEM_STATUS.COMPLETED, 'Status must be COMPLETED');
    assert(typeof completedPlan.completedAt === 'number', 'completedAt must be numeric');
    assert(completedPlan.payload.result === 'All steps planned', 'Payload must include completed fields');

    // Complete all items in turn1
    harnessRuntime.completeItem(userMsgItem.itemId);
    harnessRuntime.completeItem(toolCallItem.itemId, { output: 'File contents read' });
    harnessRuntime.completeItem(fileChangeItem.itemId, { applied: true });
    harnessRuntime.completeItem(approvalItem.itemId, { approved: true });
    harnessRuntime.completeItem(agentMsgItem.itemId, { text: 'Done.' });

    console.log('[TEST 6 PASSED] Item update and completion verified.');

    // ----------------------------------------------------
    // TEST 7: Turn Completion
    // ----------------------------------------------------
    console.log('[TEST 7] Testing Turn Completion (completeTurn)...');
    const completedTurn1 = harnessRuntime.completeTurn(turn1.turnId, { outcome: 'SUCCESS' });
    assert(completedTurn1.status === TURN_STATUS.COMPLETED, 'Turn status must be COMPLETED');
    assert(typeof completedTurn1.completedAt === 'number', 'Turn completedAt must be numeric');
    assert(completedTurn1.metadata.outcome === 'SUCCESS', 'Turn metadata must be updated');
    console.log('[TEST 7 PASSED] Turn completion verified.');

    // ----------------------------------------------------
    // TEST 8: Multiple Turns in One Thread
    // ----------------------------------------------------
    console.log('[TEST 8] Testing Multiple Turns in One Thread...');
    const turn2 = harnessRuntime.startTurn(thread1.threadId, 'Run unit test validation', {
      source: 'user_chat_turn_2',
    });
    assert(turn2.turnId !== turn1.turnId, 'turn2 ID must be distinct from turn1');

    const turn2UserMsg = harnessRuntime.startItem(turn2.turnId, ITEM_TYPES.USER_MESSAGE, {
      text: 'Run unit test validation',
    });
    harnessRuntime.completeItem(turn2UserMsg.itemId);

    const testToolItem = harnessRuntime.startItem(turn2.turnId, ITEM_TYPES.TOOL_CALL, {
      tool: 'run_tests',
      cmd: 'pytest tests/',
    });
    harnessRuntime.completeItem(testToolItem.itemId, { exitCode: 0, passed: 5 });

    const turn2AgentMsg = harnessRuntime.startItem(turn2.turnId, ITEM_TYPES.AGENT_MESSAGE, {
      summary: 'All 5 unit tests passed cleanly.',
    });
    harnessRuntime.completeItem(turn2AgentMsg.itemId);

    const completedTurn2 = harnessRuntime.completeTurn(turn2.turnId);
    assert(completedTurn2.status === TURN_STATUS.COMPLETED, 'Turn 2 status must be COMPLETED');

    const threadWithMultipleTurns = harnessRuntime.getThread(thread1.threadId);
    assert(threadWithMultipleTurns.turnIds.length === 2, `Expected 2 turnIds, got ${threadWithMultipleTurns.turnIds.length}`);
    assert(threadWithMultipleTurns.turns.length === 2, `Expected 2 turns, got ${threadWithMultipleTurns.turns.length}`);
    assert(threadWithMultipleTurns.turns[0].turnId === turn1.turnId, 'First turn must be turn1');
    assert(threadWithMultipleTurns.turns[1].turnId === turn2.turnId, 'Second turn must be turn2');
    console.log('[TEST 8 PASSED] Multiple turns preserved in sequence within thread.');

    // ----------------------------------------------------
    // TEST 9: Failed Turn Handling
    // ----------------------------------------------------
    console.log('[TEST 9] Testing Failed Turn Handling (failTurn)...');
    const threadFail = harnessRuntime.createThread({ metadata: { workspacePath: workspaceA } });
    const turnFail = harnessRuntime.startTurn(threadFail.threadId, 'Invalid task command');

    const errorItem = harnessRuntime.startItem(turnFail.turnId, ITEM_TYPES.ERROR, {
      code: 'COMMAND_NOT_FOUND',
    });
    harnessRuntime.failItem(errorItem.itemId, 'Command failed with exit code 127');

    const failedTurn = harnessRuntime.failTurn(turnFail.turnId, 'Execution terminated due to command error');
    assert(failedTurn.status === TURN_STATUS.FAILED, 'Turn status must be FAILED');
    assert(failedTurn.error.includes('Execution terminated'), 'Turn error message must be recorded');
    console.log('[TEST 9 PASSED] Failed turn handled cleanly.');

    // ----------------------------------------------------
    // TEST 10: Cancelled Turn Handling
    // ----------------------------------------------------
    console.log('[TEST 10] Testing Cancelled Turn Handling (cancelTurn)...');
    const threadCancel = harnessRuntime.createThread({ metadata: { workspacePath: workspaceA } });
    const turnCancel = harnessRuntime.startTurn(threadCancel.threadId, 'Long running operation');

    const activeItem = harnessRuntime.startItem(turnCancel.turnId, ITEM_TYPES.TOOL_CALL, {
      tool: 'long_scan',
    });
    assert(activeItem.status === ITEM_STATUS.STARTED, 'Item should start as STARTED');

    const cancelledTurn = harnessRuntime.cancelTurn(turnCancel.turnId, { reason: 'User requested abort' });
    assert(cancelledTurn.status === TURN_STATUS.CANCELLED, 'Turn status must be CANCELLED');

    const cancelledItem = harnessRuntime.getItem(activeItem.itemId);
    assert(cancelledItem.status === ITEM_STATUS.CANCELLED, `Active item must be transitioned to CANCELLED, got ${cancelledItem.status}`);
    console.log('[TEST 10 PASSED] Cancelled turn and child items handled cleanly.');

    // ----------------------------------------------------
    // TEST 11: Invalid Lifecycle Transitions (Invariants Enforced)
    // ----------------------------------------------------
    console.log('[TEST 11] Testing Invalid Lifecycle Transitions (Invariants)...');

    // Invariant 1: Turn cannot exist without Thread
    let threwInv1 = false;
    try {
      harnessRuntime.startTurn('non_existent_thread_id', 'Hello');
    } catch (e) {
      threwInv1 = true;
    }
    assert(threwInv1, 'startTurn without existing thread must throw');

    // Invariant 2: Item cannot exist without Turn
    let threwInv2 = false;
    try {
      harnessRuntime.startItem('non_existent_turn_id', ITEM_TYPES.USER_MESSAGE);
    } catch (e) {
      threwInv2 = true;
    }
    assert(threwInv2, 'startItem without existing turn must throw');

    // Invariant 3: Completed Turn cannot accept new Items
    let threwInv3 = false;
    try {
      harnessRuntime.startItem(turn1.turnId, ITEM_TYPES.USER_MESSAGE, { text: 'Late message' });
    } catch (e) {
      threwInv3 = true;
    }
    assert(threwInv3, 'Adding item to completed turn must throw');

    // Invariant 4: Completed Item cannot transition back to running or completed
    let threwInv4 = false;
    try {
      harnessRuntime.updateItem(completedPlan.itemId, { extra: 123 });
    } catch (e) {
      threwInv4 = true;
    }
    assert(threwInv4, 'Updating completed item must throw');

    // Invariant 5: Cancelled Turn cannot accept new items
    let threwInv5 = false;
    try {
      harnessRuntime.startItem(turnCancel.turnId, ITEM_TYPES.TOOL_CALL, { tool: 'late_tool' });
    } catch (e) {
      threwInv5 = true;
    }
    assert(threwInv5, 'Adding item to cancelled turn must throw');

    console.log('[TEST 11 PASSED] All lifecycle transition invariants strictly enforced.');

    // ----------------------------------------------------
    // TEST 12: Event Ordering and Monotonic Sequence Numbers
    // ----------------------------------------------------
    console.log('[TEST 12] Testing Event Ordering and Monotonic Sequence Numbers...');
    const allEvents = harnessRuntime.getEvents();
    assert(allEvents.length > 10, `Expected many events emitted, got ${allEvents.length}`);

    // Verify monotonic strictly increasing sequence numbers
    for (let i = 0; i < allEvents.length; i++) {
      assert(allEvents[i].sequenceNumber === i + 1, `Sequence number mismatch at index ${i}: expected ${i + 1}, got ${allEvents[i].sequenceNumber}`);
      assert(allEvents[i].eventId.startsWith('evt_'), `Event ID must start with evt_, got ${allEvents[i].eventId}`);
      assert(typeof allEvents[i].timestamp === 'number', 'Event timestamp must be numeric');
    }
    console.log(`[TEST 12 PASSED] Deterministic event stream verified across ${allEvents.length} events.`);

    // ----------------------------------------------------
    // TEST 13: Concurrent Thread Isolation
    // ----------------------------------------------------
    console.log('[TEST 13] Testing Concurrent Thread Isolation...');
    const threadIsoA = harnessRuntime.createThread({ metadata: { workspacePath: workspaceA } });
    const threadIsoB = harnessRuntime.createThread({ metadata: { workspacePath: workspaceB } });

    const turnIsoA = harnessRuntime.startTurn(threadIsoA.threadId, 'Task for Alpha');
    const turnIsoB = harnessRuntime.startTurn(threadIsoB.threadId, 'Task for Beta');

    const itemIsoA = harnessRuntime.startItem(turnIsoA.turnId, ITEM_TYPES.USER_MESSAGE, { target: 'Alpha' });
    const itemIsoB = harnessRuntime.startItem(turnIsoB.turnId, ITEM_TYPES.USER_MESSAGE, { target: 'Beta' });

    harnessRuntime.completeItem(itemIsoA.itemId);
    harnessRuntime.completeTurn(turnIsoA.turnId);

    // Verify Thread A has completed turn, while Thread B is still running
    const checkA = harnessRuntime.getThread(threadIsoA.threadId);
    const checkB = harnessRuntime.getThread(threadIsoB.threadId);

    assert(checkA.turns.length === 1 && checkA.turns[0].status === TURN_STATUS.COMPLETED, 'Thread A turn must be COMPLETED');
    assert(checkB.turns.length === 1 && checkB.turns[0].status === TURN_STATUS.RUNNING, 'Thread B turn must still be RUNNING');
    assert(checkA.turns[0].items[0].payload.target === 'Alpha', 'Thread A item payload isolated');
    assert(checkB.turns[0].items[0].payload.target === 'Beta', 'Thread B item payload isolated');

    harnessRuntime.completeItem(itemIsoB.itemId);
    harnessRuntime.completeTurn(turnIsoB.turnId);
    console.log('[TEST 13 PASSED] Concurrent threads and their child turns/items strictly isolated.');

    // ----------------------------------------------------
    // TEST 14: Application Restart & Reload Persistence
    // ----------------------------------------------------
    console.log('[TEST 14] Testing Application Restart & Persistence Reload...');
    // Save thread1 with multiple turns & items to disk
    const saveThread1 = harnessRuntime.saveThread(thread1.threadId, workspaceA);
    assert(saveThread1.success, `saveThread1 failed: ${saveThread1.error}`);

    // Create a brand new isolated HarnessRuntime instance (simulating app restart)
    const freshRuntime = HarnessRuntime.createIsolated();
    assert(freshRuntime.getThread(thread1.threadId) === null, 'Fresh runtime must have empty in-memory state');

    // Load persisted thread
    const loadResult = freshRuntime.loadThread(thread1.threadId, workspaceA);
    assert(loadResult.success, `loadThread failed: ${loadResult.error}`);
    assert(loadResult.thread !== null, 'Loaded thread must be non-null');
    assert(loadResult.thread.threadId === thread1.threadId, 'Loaded thread ID must match original');
    assert(loadResult.thread.turnIds.length === 2, `Expected 2 turnIds restored, got ${loadResult.thread.turnIds.length}`);
    assert(loadResult.thread.turns.length === 2, `Expected 2 turns restored, got ${loadResult.thread.turns.length}`);

    const restoredTurn1 = loadResult.thread.turns[0];
    assert(restoredTurn1.turnId === turn1.turnId, 'Restored turn1 ID must match');
    assert(restoredTurn1.status === TURN_STATUS.COMPLETED, 'Restored turn1 status must be COMPLETED');
    assert(restoredTurn1.items.length === 6, `Restored turn1 must have 6 items, got ${restoredTurn1.items.length}`);

    const restoredTurn2 = loadResult.thread.turns[1];
    assert(restoredTurn2.turnId === turn2.turnId, 'Restored turn2 ID must match');
    assert(restoredTurn2.items.length === 3, `Restored turn2 must have 3 items, got ${restoredTurn2.items.length}`);

    console.log('[TEST 14 PASSED] Full Thread, Turn, and Item hierarchy successfully restored across restart.');

    // ----------------------------------------------------
    // TEST 15: Canonical Event Sequence Verification
    // ----------------------------------------------------
    console.log('[TEST 15] Testing Canonical Event Sequence (THREAD_CREATED -> TURN_STARTED -> ITEM_STARTED -> ITEM_COMPLETED -> TURN_COMPLETED)...');
    const seqRuntime = HarnessRuntime.createIsolated();
    const recordedEvents = [];
    seqRuntime.subscribe((evt) => recordedEvents.push(evt.type));

    const seqThread = seqRuntime.createThread({ metadata: { workspacePath: workspaceA } });
    const seqTurn = seqRuntime.startTurn(seqThread.threadId, 'Canonical flow test');
    const seqItem = seqRuntime.startItem(seqTurn.turnId, ITEM_TYPES.USER_MESSAGE, { text: 'Hello' });
    seqRuntime.completeItem(seqItem.itemId);
    seqRuntime.completeTurn(seqTurn.turnId);

    const expectedSequence = [
      EVENT_TYPES.THREAD_CREATED,
      EVENT_TYPES.TURN_STARTED,
      EVENT_TYPES.ITEM_STARTED,
      EVENT_TYPES.ITEM_COMPLETED,
      EVENT_TYPES.TURN_COMPLETED,
    ];

    assert(recordedEvents.length === 5, `Expected 5 events, got ${recordedEvents.length}: ${JSON.stringify(recordedEvents)}`);
    for (let i = 0; i < expectedSequence.length; i++) {
      assert(recordedEvents[i] === expectedSequence[i], `Event ${i} expected ${expectedSequence[i]}, got ${recordedEvents[i]}`);
    }
    console.log('[TEST 15 PASSED] Canonical event flow verified: ' + expectedSequence.join(' -> '));

    console.log('\n====================================================');
    console.log('[SUCCESS] ALL 15 HARNESS CORE TESTS PASSED CLEANLY.');
    console.log('====================================================\n');
  } finally {
    try {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

if (require.main === module) {
  runHarnessCoreTests().catch((err) => {
    console.error('[TEST SUITE CRASHED]', err);
    process.exit(1);
  });
}

module.exports = { runHarnessCoreTests };
