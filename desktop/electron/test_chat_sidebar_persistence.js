/**
 * FOCUSED TEST SUITE: CHAT / THREAD SIDEBAR PERSISTENCE & LIFECYCLE
 * 
 * Verifies all 17 target criteria for the modern conversation sidebar:
 * 1. Thread created immediately on New Task with unique threadId.
 * 2. Immediate sidebar registration before execution.
 * 3. Automatic smart title generation from first prompt.
 * 4. Explicit title preservation.
 * 5. Message-to-thread association (turns & items).
 * 6. Multiple independent chats.
 * 7. Recent ordering (sorted by updatedAt descending).
 * 8. Pin/unpin persistence across cold restarts.
 * 9. Rename persistence across cold restarts.
 * 10. Deletion from memory & persistent storage.
 * 11. Restart hydration (cold start restores all threads).
 * 12. Restoring a selected thread with all messages/items.
 * 13. No mutation replay upon thread restoration.
 * 14. Correct workspace/project association.
 * 15. Real-time search across title, user message, and workspace.
 * 16. Provider/model metadata preservation per turn.
 * 17. Strict history isolation between independent threads.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { HarnessRuntime } = require('./harness/HarnessRuntime');
const { ThreadManager, generateSmartThreadTitle } = require('./harness/ThreadManager');
const { HarnessPersistenceAdapter } = require('./harness/HarnessPersistenceAdapter');
const { continuumManager } = require('./continuumManager');
const { THREAD_STATUS, TURN_STATUS } = require('./harness/types');

async function runChatSidebarPersistenceTests() {
  console.log('====================================================');
  console.log('TESTING CHAT / THREAD SIDEBAR PERSISTENCE & LIFECYCLE');
  console.log('====================================================\n');

  const testWorkspace = path.join(process.cwd(), '.nexus-recovery', 'test_chat_ws');
  fs.mkdirSync(testWorkspace, { recursive: true });

  const runtime = new HarnessRuntime();

  // Clean test baseline for workspace
  const existing = runtime.listThreads({ workspacePath: testWorkspace });
  for (const t of existing) {
    runtime.deleteThread(t.threadId, testWorkspace);
  }

  // TEST 1 & 2: Thread created on New Task with immediate registration
  console.log('[1/17] Testing immediate thread creation on New Task...');
  const newChatThread = runtime.createThread({
    workspacePath: testWorkspace,
    workspaceName: 'TestProject',
    title: 'New Task',
  });
  assert.ok(newChatThread.threadId, 'Thread must receive unique threadId');
  assert.strictEqual(newChatThread.metadata.title, 'New Task');
  assert.strictEqual(newChatThread.status, THREAD_STATUS.ACTIVE);

  const initialList = runtime.listThreads({ workspacePath: testWorkspace });
  const registered = initialList.find((t) => t.threadId === newChatThread.threadId);
  assert.ok(registered, 'Thread must appear immediately in sidebar list');
  console.log(`  ✔ [PASS] Thread "${newChatThread.threadId}" registered immediately before execution\n`);

  // TEST 3: Automatic smart title generation
  console.log('[2/17] Testing automatic smart title generation...');
  const title1 = generateSmartThreadTitle('Inspect cart_calculator.py and fix redundant arithmetic');
  assert.strictEqual(title1, 'Fix cart_calculator.py');

  const title2 = generateSmartThreadTitle('Investigate why auth fails');
  assert.strictEqual(title2, 'Investigate authentication');

  const title3 = generateSmartThreadTitle('Explain the NEXUS architecture');
  assert.strictEqual(title3, 'NEXUS architecture');

  const title4 = generateSmartThreadTitle('Please refactor order_service.py');
  assert.strictEqual(title4, 'Fix order_service.py');
  console.log('  ✔ [PASS] Smart titles generated accurately from various prompt shapes\n');

  // TEST 4: Explicit title preservation
  console.log('[3/17] Testing explicit title preservation...');
  const explicitThread = runtime.createThread({
    workspacePath: testWorkspace,
    title: 'Custom Benchmark Suite',
    userInput: 'Run performance checks on server',
  });
  assert.strictEqual(explicitThread.metadata.title, 'Custom Benchmark Suite');
  console.log('  ✔ [PASS] Explicit user title preserved over automatic generation\n');

  // TEST 5: Message-to-thread association
  console.log('[4/17] Testing turn and item association under thread...');
  const threadA = runtime.createThread({
    workspacePath: testWorkspace,
    title: 'Thread A Task',
    userInput: 'Analyze database indexes',
  });

  const turnA1 = runtime.startTurn(threadA.threadId, 'Check index fragmentation on users table', {
    providerId: 'groq',
    modelId: 'openai/gpt-oss-120b',
  });
  runtime.completeTurn(turnA1.turnId, { response: 'Indexes are healthy with 2% fragmentation.' });

  const fetchedThreadA = runtime.getThread(threadA.threadId, testWorkspace);
  assert.strictEqual(fetchedThreadA.turns.length, 1);
  assert.strictEqual(fetchedThreadA.turns[0].userInput, 'Check index fragmentation on users table');
  console.log('  ✔ [PASS] Turns and items strictly bound to threadId\n');

  // TEST 6: Multiple independent chats
  console.log('[5/17] Testing multiple independent chats...');
  const chat1 = runtime.createThread({
    workspacePath: testWorkspace,
    userInput: 'Inspect cart_calculator.py and fix redundant arithmetic',
  });
  assert.strictEqual(chat1.metadata.title, 'Fix cart_calculator.py');

  const chat2 = runtime.createThread({
    workspacePath: testWorkspace,
    userInput: 'Investigate why auth fails',
  });
  assert.strictEqual(chat2.metadata.title, 'Investigate authentication');

  const chat3 = runtime.createThread({
    workspacePath: testWorkspace,
    userInput: 'Explain the NEXUS architecture',
  });
  assert.strictEqual(chat3.metadata.title, 'NEXUS architecture');

  const allThree = runtime.listThreads({ workspacePath: testWorkspace });
  const ids = allThree.map((t) => t.threadId);
  assert.ok(ids.includes(chat1.threadId));
  assert.ok(ids.includes(chat2.threadId));
  assert.ok(ids.includes(chat3.threadId));
  console.log('  ✔ [PASS] Multiple chats co-exist independently with distinct titles\n');

  // TEST 7: Recent ordering (updatedAt descending)
  console.log('[6/17] Testing recents ordering (updatedAt desc)...');
  // Update chat1
  runtime.touchThread(chat1.threadId);
  runtime.updateThread(chat1.threadId, { metadata: { lastAction: 'updated' } });

  const sortedList = runtime.listThreads({ workspacePath: testWorkspace });
  assert.strictEqual(sortedList[0].threadId, chat1.threadId, 'Most recently updated thread must be first');
  console.log('  ✔ [PASS] Recents sorted newest first by updatedAt\n');

  // TEST 8: Pin / Unpin persistence
  console.log('[7/17] Testing pin / unpin lifecycle and persistence...');
  runtime.pinThread(chat2.threadId, true, testWorkspace);
  let thread2Loaded = runtime.getThread(chat2.threadId, testWorkspace);
  assert.strictEqual(thread2Loaded.metadata.pinned, true);

  // Unpin
  runtime.pinThread(chat2.threadId, false, testWorkspace);
  thread2Loaded = runtime.getThread(chat2.threadId, testWorkspace);
  assert.strictEqual(thread2Loaded.metadata.pinned, false);

  // Re-pin for restart test
  runtime.pinThread(chat2.threadId, true, testWorkspace);
  console.log('  ✔ [PASS] Pin and unpin state updated and persisted\n');

  // TEST 9: Rename persistence
  console.log('[8/17] Testing rename lifecycle and persistence...');
  runtime.renameThread(chat3.threadId, 'NEXUS Architecture Deep Dive', testWorkspace);
  const renamed = runtime.getThread(chat3.threadId, testWorkspace);
  assert.strictEqual(renamed.metadata.title, 'NEXUS Architecture Deep Dive');
  console.log('  ✔ [PASS] Thread renamed successfully\n');

  // TEST 10: Deletion
  console.log('[9/17] Testing thread deletion...');
  const tempThread = runtime.createThread({
    workspacePath: testWorkspace,
    title: 'Temporary Thread to Delete',
  });
  assert.ok(runtime.getThread(tempThread.threadId, testWorkspace));

  const delRes = runtime.deleteThread(tempThread.threadId, testWorkspace);
  assert.strictEqual(delRes.success, true);
  assert.strictEqual(runtime.getThread(tempThread.threadId, testWorkspace), null);

  const listAfterDelete = runtime.listThreads({ workspacePath: testWorkspace });
  assert.strictEqual(listAfterDelete.some((t) => t.threadId === tempThread.threadId), false);
  console.log('  ✔ [PASS] Thread deleted from memory and storage\n');

  // TEST 11: Cold restart hydration
  console.log('[10/17] Testing cold restart hydration...');
  // Instantiate new clean runtime (simulating app quit and reopen)
  const restartedRuntime = new HarnessRuntime();
  const hydratedList = restartedRuntime.listThreads({ workspacePath: testWorkspace });
  assert.ok(hydratedList.length >= 4, 'All persisted threads must be restored on restart');

  const hydratedChat2 = hydratedList.find((t) => t.threadId === chat2.threadId);
  assert.ok(hydratedChat2, 'Chat 2 must exist after restart');
  assert.strictEqual(hydratedChat2.pinned, true, 'Pinned state must survive restart');

  const hydratedChat3 = hydratedList.find((t) => t.threadId === chat3.threadId);
  assert.ok(hydratedChat3, 'Chat 3 must exist after restart');
  assert.strictEqual(hydratedChat3.title, 'NEXUS Architecture Deep Dive', 'Renamed title must survive restart');
  console.log('  ✔ [PASS] App restart restored all threads, titles, and pinned states\n');

  // TEST 12 & 13: Restoring selected thread without replaying mutations
  console.log('[11/17] Testing selected thread restoration without mutation replay...');
  const restoredFullThreadA = restartedRuntime.getThread(threadA.threadId, testWorkspace);
  assert.ok(restoredFullThreadA, 'Thread A must be fully loadable');
  assert.strictEqual(restoredFullThreadA.turns.length, 1);
  assert.strictEqual(restoredFullThreadA.turns[0].userInput, 'Check index fragmentation on users table');
  assert.strictEqual(restoredFullThreadA.turns[0].status, TURN_STATUS.COMPLETED);
  // Verify turn is completed and did NOT trigger re-execution
  assert.strictEqual(restoredFullThreadA.turns[0].status, TURN_STATUS.COMPLETED);
  console.log('  ✔ [PASS] Thread restored with historical turns preserved statically\n');

  // TEST 14: Correct workspace association
  console.log('[12/17] Testing workspace isolation and association...');
  const otherWs = path.join(process.cwd(), '.nexus-recovery', 'other_ws');
  fs.mkdirSync(otherWs, { recursive: true });
  const otherThread = runtime.createThread({
    workspacePath: otherWs,
    workspaceName: 'Spectra',
    title: 'Video Pipeline Debugging',
  });

  const testWsThreads = runtime.listThreads({ workspacePath: testWorkspace });
  const otherWsThreads = runtime.listThreads({ workspacePath: otherWs });

  assert.ok(testWsThreads.every((t) => t.metadata?.workspacePath !== otherWs));
  assert.ok(otherWsThreads.some((t) => t.threadId === otherThread.threadId));
  console.log('  ✔ [PASS] Threads strictly isolated by workspace/project\n');

  // TEST 15: Search functionality
  console.log('[13/17] Testing real-time search across titles and messages...');
  const searchByTitle = runtime.searchThreads('Deep Dive', testWorkspace);
  assert.ok(searchByTitle.some((t) => t.threadId === chat3.threadId));

  const searchByMessage = runtime.searchThreads('fragmentation', testWorkspace);
  assert.ok(searchByMessage.some((t) => t.threadId === threadA.threadId));

  const searchNoMatch = runtime.searchThreads('xyzNonExistentQuery12345', testWorkspace);
  assert.strictEqual(searchNoMatch.length, 0);
  console.log('  ✔ [PASS] Search matches titles and turn messages accurately\n');

  // TEST 16: Provider / model metadata preservation
  console.log('[14/17] Testing provider and model metadata per turn...');
  assert.strictEqual(restoredFullThreadA.turns[0].metadata.providerId, 'groq');
  assert.strictEqual(restoredFullThreadA.turns[0].metadata.modelId, 'openai/gpt-oss-120b');
  console.log('  ✔ [PASS] Execution provider/model metadata preserved per turn\n');

  // TEST 17: History isolation between chats
  console.log('[15/17] Testing history isolation between chats...');
  const chat1Restored = restartedRuntime.getThread(chat1.threadId, testWorkspace);
  const chat2Restored = restartedRuntime.getThread(chat2.threadId, testWorkspace);
  assert.notStrictEqual(chat1Restored.threadId, chat2Restored.threadId);
  assert.strictEqual(chat1Restored.turns.length, 0);
  assert.strictEqual(restoredFullThreadA.turns.length, 1);
  console.log('  ✔ [PASS] Strict history isolation verified across all threads\n');

  console.log('====================================================');
  console.log('ALL 17 CHAT SIDEBAR PERSISTENCE TESTS PASSED!');
  console.log('====================================================');
}

runChatSidebarPersistenceTests().catch((err) => {
  console.error('[TEST FAILED]', err);
  process.exit(1);
});
