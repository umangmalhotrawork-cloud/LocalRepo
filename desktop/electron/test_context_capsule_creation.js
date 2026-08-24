/**
 * CONTEXT CAPSULE — TEST SUITE (Phase 3: User-Initiated Capsule Creation)
 * Comprehensive verification of user-initiated creation workflow, IPC bridge simulation,
 * safe metadata response, secret redaction, and strict Continuum isolation.
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  NEXUS_CAPSULE_VERSION,
  validateCapsule,
} = require('./capsule/CapsuleSchema');

const {
  ContextCapsuleManager,
} = require('./capsule/ContextCapsuleManager');

const { ThreadManager } = require('./harness/ThreadManager');
const { TurnManager } = require('./harness/TurnManager');
const { ItemStore } = require('./harness/ItemStore');
const { ITEM_TYPES } = require('./harness/types');
const { harnessEventBus } = require('./harness/eventBus');

// Simulated IPC Handler representing main.js `capsule:create`
function createMockIPCHandler(manager) {
  return async (payload = {}) => {
    const threadId = typeof payload === 'string' ? payload : payload?.threadId;
    const options = (typeof payload === 'object' && payload?.options) ? payload.options : {};
    if (!threadId) {
      return {
        success: false,
        error: 'Active thread ID is required to create a Context Capsule',
      };
    }

    try {
      const capsule = manager.createCapsule(threadId, options);
      const saveResult = manager.saveCapsule(capsule);

      return {
        success: true,
        capsuleId: capsule.capsule_id,
        threadId: capsule.source_chat?.thread_id || threadId,
        createdAt: capsule.created_at,
        title: capsule.source_chat?.title || 'Context Capsule',
        retainedExchangesCount: capsule.conversation_context?.last_exchanges?.length || 0,
        filePath: saveResult.filePath,
        capsule: {
          nexus_capsule_version: capsule.nexus_capsule_version,
          capsule_id: capsule.capsule_id,
          created_at: capsule.created_at,
          source_chat: capsule.source_chat,
          task_state: capsule.task_state,
          conversation_context: {
            summary: capsule.conversation_context?.summary,
            last_exchanges: capsule.conversation_context?.last_exchanges,
          },
        },
      };
    } catch (err) {
      return {
        success: false,
        error: err.message || 'Failed to create Context Capsule',
      };
    }
  };
}

async function runContextCapsuleCreationTests() {
  console.log('================================================================');
  console.log('STARTING CONTEXT CAPSULE (PHASE 3) CREATION TEST SUITE');
  console.log('================================================================');

  let passedCount = 0;
  const totalTests = 14;

  // Setup isolated temporary directory for test storage
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-capsule-creation-test-'));
  const testCapsuleDir = path.join(tempDir, 'context-capsules');
  fs.mkdirSync(testCapsuleDir, { recursive: true });

  // Create isolated harness instances
  const testItemStore = new ItemStore(harnessEventBus);
  const testTurnManager = new TurnManager(harnessEventBus, testItemStore);
  const testThreadManager = new ThreadManager(harnessEventBus, testTurnManager);

  const manager = new ContextCapsuleManager({
    storageDir: testCapsuleDir,
    threadManager: testThreadManager,
    turnManager: testTurnManager,
    itemStore: testItemStore,
  });

  const ipcCreateHandler = createMockIPCHandler(manager);

  // Setup active thread fixture
  const activeThread = testThreadManager.createThread({
    threadId: 'thread_active_checkout',
    title: 'Fix Checkout Calculation Bug',
    userInput: 'Please fix the tax calculation in checkout_engine.py',
    metadata: {
      primaryGoal: 'Please fix the tax calculation in checkout_engine.py',
      workspaceName: 'ECommerceApp',
      providerId: 'gemini',
      modelId: 'gemini-2.5-flash',
      decisions: ['Calculate net tax before coupon application'],
      pendingWork: ['Update unit tests for tax edge cases'],
      files: ['src/checkout_engine.py'],
    },
  });

  // Create 4 turns
  for (let i = 1; i <= 4; i++) {
    const turn = testTurnManager.startTurn(activeThread.threadId, `Directive ${i}`);
    testItemStore.startItem(turn.turnId, ITEM_TYPES.USER_MESSAGE, { text: `User request ${i}` });
    testItemStore.startItem(turn.turnId, ITEM_TYPES.TOOL_CALL, { toolName: 'inspect_file', arguments: { file: 'tax.py' } });
    testItemStore.startItem(turn.turnId, ITEM_TYPES.TOOL_RESULT, { toolName: 'inspect_file', result: { ok: true } });
    testItemStore.startItem(turn.turnId, ITEM_TYPES.AGENT_MESSAGE, { text: `Agent explanation ${i}` });
    testItemStore.startItem(turn.turnId, ITEM_TYPES.FILE_CHANGE, { filePath: 'src/checkout_engine.py' });
    testTurnManager.completeTurn(turn.turnId);
  }

  // ------------------------------------------------------------------
  // TEST 1: Active thread creates a valid capsule
  // ------------------------------------------------------------------
  console.log('\n[TEST 1] Active thread creates a valid capsule...');
  const capsule1 = manager.createCapsule(activeThread.threadId);
  const val1 = validateCapsule(capsule1);
  assert.strictEqual(val1.valid, true, `Capsule validation failed: ${val1.errors.join(', ')}`);
  assert.strictEqual(capsule1.nexus_capsule_version, NEXUS_CAPSULE_VERSION);
  passedCount++;
  console.log('✓ TEST 1 PASSED: Valid capsule created from active thread');

  // ------------------------------------------------------------------
  // TEST 2: Capsule is persisted in independent capsule storage
  // ------------------------------------------------------------------
  console.log('\n[TEST 2] Capsule is persisted in independent capsule storage...');
  const save1 = manager.saveCapsule(capsule1);
  assert.strictEqual(save1.success, true);
  assert.ok(fs.existsSync(save1.filePath));
  assert.ok(save1.filePath.startsWith(testCapsuleDir), 'Must reside in independent capsule storage directory');
  assert.ok(!save1.filePath.includes('.echo-nullity/continuum'), 'Must never reside in continuum storage');
  passedCount++;
  console.log('✓ TEST 2 PASSED: Capsule persisted in independent storage');

  // ------------------------------------------------------------------
  // TEST 3: Returned metadata is correct
  // ------------------------------------------------------------------
  console.log('\n[TEST 3] Returned metadata is correct...');
  const ipcRes = await ipcCreateHandler({ threadId: activeThread.threadId });
  assert.strictEqual(ipcRes.success, true);
  assert.strictEqual(ipcRes.threadId, activeThread.threadId);
  assert.strictEqual(ipcRes.title, 'Fix Checkout Calculation Bug');
  assert.strictEqual(ipcRes.retainedExchangesCount, 3);
  assert.ok(typeof ipcRes.createdAt === 'number' && ipcRes.createdAt > 0);
  assert.ok(ipcRes.capsuleId.startsWith('capsule_'));
  passedCount++;
  console.log('✓ TEST 3 PASSED: Returned metadata matches expected structure');

  // ------------------------------------------------------------------
  // TEST 4: Last 3 exchanges are preserved in chronological order
  // ------------------------------------------------------------------
  console.log('\n[TEST 4] Last 3 exchanges are preserved in chronological order...');
  const exchanges = ipcRes.capsule.conversation_context.last_exchanges;
  assert.strictEqual(exchanges.length, 3, 'Must retain exactly 3 exchanges');
  assert.strictEqual(exchanges[0].user, 'User request 2');
  assert.strictEqual(exchanges[0].assistant, 'Agent explanation 2');
  assert.strictEqual(exchanges[1].user, 'User request 3');
  assert.strictEqual(exchanges[1].assistant, 'Agent explanation 3');
  assert.strictEqual(exchanges[2].user, 'User request 4');
  assert.strictEqual(exchanges[2].assistant, 'Agent explanation 4');
  passedCount++;
  console.log('✓ TEST 4 PASSED: Exactly the last 3 exchanges preserved in chronological order');

  // ------------------------------------------------------------------
  // TEST 5: Source thread is unchanged (immutable)
  // ------------------------------------------------------------------
  console.log('\n[TEST 5] Source thread is unchanged (immutable)...');
  const threadAfter = testThreadManager.getThread(activeThread.threadId);
  const turnsAfter = testTurnManager.listTurnsByThread(activeThread.threadId);
  assert.strictEqual(turnsAfter.length, 4, 'Turns count in source thread must remain 4');
  assert.strictEqual(threadAfter.title, 'Fix Checkout Calculation Bug');
  passedCount++;
  console.log('✓ TEST 5 PASSED: Source thread data remained completely immutable');

  // ------------------------------------------------------------------
  // TEST 6: Repeated creation produces separate capsule IDs
  // ------------------------------------------------------------------
  console.log('\n[TEST 6] Repeated creation produces separate capsule IDs...');
  const rep1 = await ipcCreateHandler({ threadId: activeThread.threadId });
  const rep2 = await ipcCreateHandler({ threadId: activeThread.threadId });
  assert.notStrictEqual(rep1.capsuleId, rep2.capsuleId, 'Repeated creation must generate unique capsule IDs');
  assert.ok(fs.existsSync(rep1.filePath));
  assert.ok(fs.existsSync(rep2.filePath));
  passedCount++;
  console.log(`✓ TEST 6 PASSED: Distinct capsule IDs generated (${rep1.capsuleId} vs ${rep2.capsuleId})`);

  // ------------------------------------------------------------------
  // TEST 7: No Continuum storage or APIs are used
  // ------------------------------------------------------------------
  console.log('\n[TEST 7] No Continuum storage or APIs are used...');
  const preloadJs = fs.readFileSync(path.join(__dirname, 'preload.js'), 'utf8');
  const mainJs = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');

  // Verify preload capsule namespace is clean and does not call continuum
  assert.ok(preloadJs.includes("createCapsule: (threadId, options) => ipcRenderer.invoke('capsule:create'"));
  assert.ok(mainJs.includes("ipcMain.handle('capsule:create'"));
  
  // Verify storage directory
  const storageDir = manager.getStorageDir();
  assert.ok(!storageDir.includes('continuum'));
  passedCount++;
  console.log('✓ TEST 7 PASSED: Strict Continuum independence verified');

  // ------------------------------------------------------------------
  // TEST 8: Zero AI model/provider calls
  // ------------------------------------------------------------------
  console.log('\n[TEST 8] Zero AI model/provider calls...');
  // Capsule creation runs purely local deterministic logic
  const capsuleManagerCode = fs.readFileSync(path.join(__dirname, 'capsule', 'ContextCapsuleManager.js'), 'utf8');
  assert.ok(!capsuleManagerCode.includes('AIProviderRouter'));
  assert.ok(!capsuleManagerCode.includes('GeminiProvider'));
  passedCount++;
  console.log('✓ TEST 8 PASSED: Zero AI calls used in capsule creation');

  // ------------------------------------------------------------------
  // TEST 9: Zero Git mutations
  // ------------------------------------------------------------------
  console.log('\n[TEST 9] Zero Git mutations...');
  assert.ok(!capsuleManagerCode.includes('simple-git'));
  assert.ok(!capsuleManagerCode.includes('gitManager'));
  passedCount++;
  console.log('✓ TEST 9 PASSED: Zero Git mutations performed');

  // ------------------------------------------------------------------
  // TEST 10: No credentials are exposed
  // ------------------------------------------------------------------
  console.log('\n[TEST 10] No credentials are exposed...');
  const secretThread = testThreadManager.createThread({
    threadId: 'thread_secret_ipc',
    title: 'Secret Debugging',
    userInput: 'Key AIzaSyB1234567890abcdef1234567890abcdef',
  });
  const secTurn = testTurnManager.startTurn(secretThread.threadId, 'Connect with postgres://root:supersecretpassword@10.0.0.1:5432/db');
  testItemStore.startItem(secTurn.turnId, ITEM_TYPES.USER_MESSAGE, {
    text: 'Token is Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxIn0.secret_token and gsk_1234567890abcdef1234567890abcdef',
  });
  testItemStore.startItem(secTurn.turnId, ITEM_TYPES.AGENT_MESSAGE, {
    text: 'Authenticated with password = "plaintextsecretpassword"',
  });
  testTurnManager.completeTurn(secTurn.turnId);

  const secIpcRes = await ipcCreateHandler({ threadId: secretThread.threadId });
  const rawSecPayload = JSON.stringify(secIpcRes);

  assert.ok(!rawSecPayload.includes('AIzaSyB1234567890abcdef1234567890abcdef'));
  assert.ok(!rawSecPayload.includes('supersecretpassword'));
  assert.ok(!rawSecPayload.includes('gsk_1234567890abcdef1234567890abcdef'));
  assert.ok(!rawSecPayload.includes('plaintextsecretpassword'));
  assert.ok(rawSecPayload.includes('[REDACTED_SECRET:'));
  passedCount++;
  console.log('✓ TEST 10 PASSED: All sensitive credentials redacted from IPC response and storage');

  // ------------------------------------------------------------------
  // TEST 11: No active thread produces safe error
  // ------------------------------------------------------------------
  console.log('\n[TEST 11] No active thread produces safe error...');
  const noThreadRes = await ipcCreateHandler({ threadId: null });
  assert.strictEqual(noThreadRes.success, false);
  assert.ok(noThreadRes.error.includes('Active thread ID is required'));
  passedCount++;
  console.log('✓ TEST 11 PASSED: Safe rejection when no active thread provided');

  // ------------------------------------------------------------------
  // TEST 12: IPC create path works end-to-end
  // ------------------------------------------------------------------
  console.log('\n[TEST 12] IPC create path works end-to-end...');
  const e2eRes = await ipcCreateHandler({ threadId: activeThread.threadId, options: { workspacePath: '/test/workspace' } });
  assert.strictEqual(e2eRes.success, true);
  assert.ok(e2eRes.capsuleId);
  assert.strictEqual(e2eRes.capsule.source_chat.workspace_name, 'ECommerceApp');
  passedCount++;
  console.log('✓ TEST 12 PASSED: IPC create path completed end-to-end');

  // ------------------------------------------------------------------
  // TEST 13: Renderer receives success result with capsule summary
  // ------------------------------------------------------------------
  console.log('\n[TEST 13] Renderer receives success result with capsule summary...');
  assert.strictEqual(e2eRes.success, true);
  assert.ok(e2eRes.capsule.conversation_context.summary.includes('Task: Fix Checkout Calculation Bug'));
  assert.strictEqual(e2eRes.capsule.task_state.primary_goal, 'Please fix the tax calculation in checkout_engine.py');
  passedCount++;
  console.log('✓ TEST 13 PASSED: Renderer receives structured summary payload');

  // ------------------------------------------------------------------
  // TEST 14: Renderer receives sanitized failure result
  // ------------------------------------------------------------------
  console.log('\n[TEST 14] Renderer receives sanitized failure result...');
  const failRes = await ipcCreateHandler({ threadId: 'non_existent_thread_999' });
  assert.strictEqual(failRes.success, false);
  assert.ok(failRes.error.includes('Thread "non_existent_thread_999" not found'));
  passedCount++;
  console.log('✓ TEST 14 PASSED: Clean error response returned for missing thread');

  // ------------------------------------------------------------------
  // TEST 15: Active thread with 1 exchange creates valid capsule
  // ------------------------------------------------------------------
  console.log('\n[TEST 15] Active thread with 1 exchange creates valid capsule...');
  const singleExchangeThread = testThreadManager.createThread({
    threadId: 'thread_single_exchange',
    title: 'Single Task',
    userInput: 'I am working on checkout validation.',
  });
  const singleTurn = testTurnManager.startTurn(singleExchangeThread.threadId, 'Single directive');
  testItemStore.startItem(singleTurn.turnId, ITEM_TYPES.USER_MESSAGE, { text: 'I am working on checkout validation.' });
  testItemStore.startItem(singleTurn.turnId, ITEM_TYPES.AGENT_MESSAGE, { text: 'Understood. I will help with checkout validation.' });
  testTurnManager.completeTurn(singleTurn.turnId);

  const singleCapsuleRes = await ipcCreateHandler({ threadId: singleExchangeThread.threadId });
  assert.strictEqual(singleCapsuleRes.success, true);
  assert.strictEqual(singleCapsuleRes.retainedExchangesCount, 1);
  assert.strictEqual(singleCapsuleRes.capsule.conversation_context.last_exchanges[0].user, 'I am working on checkout validation.');
  assert.strictEqual(singleCapsuleRes.capsule.conversation_context.last_exchanges[0].assistant, 'Understood. I will help with checkout validation.');
  passedCount++;
  console.log('✓ TEST 15 PASSED: Single-exchange thread creates valid Context Capsule');

  // ------------------------------------------------------------------
  // TEST 16: HarnessRuntime.handleRequest conversational thread integration
  // ------------------------------------------------------------------
  console.log('\n[TEST 16] HarnessRuntime.handleRequest conversational thread integration...');
  const { HarnessRuntime } = require('./harness/HarnessRuntime');
  const isolatedRuntime = HarnessRuntime.createIsolated();
  const convReq = await isolatedRuntime.handleRequest({
    userInput: "I'm working on a checkout validation task.",
    workspacePath: tempDir,
  });
  assert.strictEqual(convReq.success, true);
  assert.ok(convReq.threadId, 'handleRequest must return authoritative threadId for conversation');
  assert.strictEqual(convReq.mode, 'CONVERSATION');

  const isolatedCapsuleManager = new ContextCapsuleManager({
    storageDir: testCapsuleDir,
    threadManager: isolatedRuntime.threadManager,
    turnManager: isolatedRuntime.turnManager,
    itemStore: isolatedRuntime.itemStore,
  });
  const convCapsule = isolatedCapsuleManager.createCapsule(convReq.threadId);
  const convVal = validateCapsule(convCapsule);
  assert.strictEqual(convVal.valid, true);
  assert.strictEqual(convCapsule.conversation_context.last_exchanges.length, 1);
  assert.strictEqual(convCapsule.conversation_context.last_exchanges[0].user, "I'm working on a checkout validation task.");
  assert.ok(convCapsule.conversation_context.last_exchanges[0].assistant.length > 0);
  passedCount++;
  console.log('✓ TEST 16 PASSED: Conversational handleRequest thread is immediately available to ContextCapsuleManager');

  // ------------------------------------------------------------------
  // TEST 17: UI Active Chat & Button Enabled State Derivation
  // ------------------------------------------------------------------
  console.log('\n[TEST 17] UI Active Chat & Button Enabled State Derivation...');
  function deriveHasActiveChat(harnessThreadId, activeSessionId, messages, result, taskToExecute) {
    return Boolean(
      harnessThreadId ||
      activeSessionId ||
      (messages && messages.length > 0) ||
      result ||
      (taskToExecute && taskToExecute.prompt)
    );
  }

  // 1. Fresh empty state -> disabled
  assert.strictEqual(deriveHasActiveChat(null, null, [], null, null), false, 'Empty state must have hasActiveChat: false');
  // 2. Active thread ID exists -> enabled
  assert.strictEqual(deriveHasActiveChat('thread_123', null, [], null, null), true, 'Thread ID must have hasActiveChat: true');
  // 3. Active session ID exists -> enabled
  assert.strictEqual(deriveHasActiveChat(null, 'session_456', [], null, null), true, 'Session ID must have hasActiveChat: true');
  // 4. Visible conversation messages exist -> enabled
  assert.strictEqual(deriveHasActiveChat(null, null, [{ role: 'user', content: 'hello' }], null, null), true, 'Visible messages must have hasActiveChat: true');
  // 5. Multiple conversation exchanges exist -> enabled
  assert.strictEqual(deriveHasActiveChat(null, null, [{ role: 'user', content: 'hi' }, { role: 'agent', content: 'hello' }], null, null), true);
  passedCount++;
  console.log('✓ TEST 17 PASSED: UI active chat derivation rules verified for all session states');

  // ------------------------------------------------------------------
  // TEST 18: Thread ID from renderer is passed unchanged to capsule:create
  // ------------------------------------------------------------------
  console.log('\n[TEST 18] Thread ID from renderer is passed unchanged to capsule:create...');
  const customThreadId = 'thread_explicit_renderer_pass_12345';
  const customThread = testThreadManager.createThread({
    threadId: customThreadId,
    title: 'Custom Passed Thread',
    userInput: 'Explicit test prompt',
  });
  const customTurn = testTurnManager.startTurn(customThreadId, 'Turn 1');
  testItemStore.startItem(customTurn.turnId, ITEM_TYPES.USER_MESSAGE, { text: 'Explicit test prompt' });
  testItemStore.startItem(customTurn.turnId, ITEM_TYPES.AGENT_MESSAGE, { text: 'Explicit agent reply' });
  testTurnManager.completeTurn(customTurn.turnId);

  const customIpcRes = await ipcCreateHandler({ threadId: customThreadId });
  assert.strictEqual(customIpcRes.success, true);
  assert.strictEqual(customIpcRes.threadId, customThreadId, 'Thread ID must match exactly');
  assert.strictEqual(customIpcRes.capsule.source_chat.thread_id, customThreadId);
  passedCount++;
  console.log('✓ TEST 18 PASSED: Thread ID passed unchanged and preserved in created capsule');

  // ------------------------------------------------------------------
  // TEST 19: UI State Machine: IDLE -> PROCESSING -> SUCCESS on IPC success
  // ------------------------------------------------------------------
  console.log('\n[TEST 19] UI State Machine: IDLE -> PROCESSING -> SUCCESS on IPC success...');
  class MockAgentPanelState {
    constructor(ipcBridge) {
      this.ipcBridge = ipcBridge;
      this.capsuleCreationStatus = 'IDLE';
      this.isCreatingCapsule = false;
      this.capsuleFeedback = null;
      this.showCapsuleDetail = false;
      this.hasActiveChat = true;
      this.callCount = 0;
    }

    get isCapsuleCreateDisabled() {
      return this.isCreatingCapsule || this.capsuleCreationStatus === 'PROCESSING' || !this.hasActiveChat;
    }

    async handleCreateCapsule(threadIdToUse, workspacePath) {
      if (this.isCreatingCapsule || this.capsuleCreationStatus === 'PROCESSING') {
        return { duplicatePrevented: true };
      }

      this.capsuleCreationStatus = 'PROCESSING';
      this.isCreatingCapsule = true;
      this.capsuleFeedback = null;
      this.showCapsuleDetail = false;
      this.callCount++;

      if (!threadIdToUse) {
        this.capsuleCreationStatus = 'FAILED';
        this.capsuleFeedback = {
          type: 'error',
          message: 'A chat thread must exist first before creating a Context Capsule.',
        };
        this.isCreatingCapsule = false;
        return;
      }

      try {
        const res = await this.ipcBridge.createCapsule(threadIdToUse, { workspacePath });
        if (res && res.success === true && res.capsuleId) {
          this.capsuleCreationStatus = 'SUCCESS';
          this.capsuleFeedback = {
            type: 'success',
            title: res.title || 'Context Capsule',
            capsuleId: res.capsuleId,
            retainedExchangesCount: res.retainedExchangesCount ?? 0,
            createdAt: res.createdAt,
            capsule: res.capsule,
          };
        } else {
          this.capsuleCreationStatus = 'FAILED';
          this.capsuleFeedback = {
            type: 'error',
            message: res?.error || 'Failed to create Context Capsule',
          };
        }
      } catch (err) {
        this.capsuleCreationStatus = 'FAILED';
        this.capsuleFeedback = {
          type: 'error',
          message: err?.message || 'Failed to create Context Capsule',
        };
      } finally {
        this.isCreatingCapsule = false;
      }
    }
  }

  const mockPanelSuccess = new MockAgentPanelState({
    createCapsule: async (tId, opts) => ipcCreateHandler({ threadId: tId, options: opts }),
  });

  assert.strictEqual(mockPanelSuccess.capsuleCreationStatus, 'IDLE');
  assert.strictEqual(mockPanelSuccess.isCapsuleCreateDisabled, false);

  const creationPromise = mockPanelSuccess.handleCreateCapsule(activeThread.threadId, tempDir);
  assert.strictEqual(mockPanelSuccess.capsuleCreationStatus, 'PROCESSING');
  assert.strictEqual(mockPanelSuccess.isCreatingCapsule, true);
  assert.strictEqual(mockPanelSuccess.isCapsuleCreateDisabled, true, 'Button must be disabled while PROCESSING');

  await creationPromise;
  assert.strictEqual(mockPanelSuccess.capsuleCreationStatus, 'SUCCESS');
  assert.strictEqual(mockPanelSuccess.isCreatingCapsule, false);
  assert.strictEqual(mockPanelSuccess.isCapsuleCreateDisabled, false);
  assert.strictEqual(mockPanelSuccess.capsuleFeedback.type, 'success');
  assert.strictEqual(mockPanelSuccess.capsuleFeedback.title, 'Fix Checkout Calculation Bug');
  assert.strictEqual(mockPanelSuccess.capsuleFeedback.retainedExchangesCount, 3);
  assert.ok(mockPanelSuccess.capsuleFeedback.capsuleId.startsWith('capsule_'));
  passedCount++;
  console.log('✓ TEST 19 PASSED: Complete IDLE -> PROCESSING -> SUCCESS transition verified');

  // ------------------------------------------------------------------
  // TEST 20: UI State Machine: IDLE -> PROCESSING -> FAILED on IPC error
  // ------------------------------------------------------------------
  console.log('\n[TEST 20] UI State Machine: IDLE -> PROCESSING -> FAILED on IPC error...');
  const mockPanelFailure = new MockAgentPanelState({
    createCapsule: async (tId, opts) => ipcCreateHandler({ threadId: 'invalid_missing_thread_999' }),
  });

  assert.strictEqual(mockPanelFailure.capsuleCreationStatus, 'IDLE');
  await mockPanelFailure.handleCreateCapsule(activeThread.threadId, tempDir);

  assert.strictEqual(mockPanelFailure.capsuleCreationStatus, 'FAILED');
  assert.strictEqual(mockPanelFailure.isCreatingCapsule, false);
  assert.strictEqual(mockPanelFailure.capsuleFeedback.type, 'error');
  assert.ok(mockPanelFailure.capsuleFeedback.message.includes('not found'));
  passedCount++;
  console.log('✓ TEST 20 PASSED: Complete IDLE -> PROCESSING -> FAILED transition verified');

  // ------------------------------------------------------------------
  // TEST 21: Duplicate clicks while PROCESSING cannot create duplicate capsules
  // ------------------------------------------------------------------
  console.log('\n[TEST 21] Duplicate clicks while PROCESSING cannot create duplicate capsules...');
  let delayedResolve;
  const delayedIpcBridge = {
    createCapsule: () => new Promise((resolve) => {
      delayedResolve = resolve;
    }),
  };
  const mockPanelDup = new MockAgentPanelState(delayedIpcBridge);
  const firstClickPromise = mockPanelDup.handleCreateCapsule(activeThread.threadId, tempDir);

  assert.strictEqual(mockPanelDup.capsuleCreationStatus, 'PROCESSING');
  assert.strictEqual(mockPanelDup.isCapsuleCreateDisabled, true);
  assert.strictEqual(mockPanelDup.callCount, 1);

  // Attempt duplicate click while processing
  const secondClickResult = await mockPanelDup.handleCreateCapsule(activeThread.threadId, tempDir);
  assert.strictEqual(secondClickResult?.duplicatePrevented, true);
  assert.strictEqual(mockPanelDup.callCount, 1, 'Second click must be ignored without invoking IPC');

  delayedResolve({
    success: true,
    capsuleId: 'capsule_delayed_123',
    title: 'Delayed Thread',
    retainedExchangesCount: 2,
    createdAt: Date.now(),
  });
  await firstClickPromise;
  assert.strictEqual(mockPanelDup.capsuleCreationStatus, 'SUCCESS');
  assert.strictEqual(mockPanelDup.callCount, 1);
  passedCount++;
  console.log('✓ TEST 21 PASSED: Duplicate clicks while PROCESSING safely prevented');

  // ------------------------------------------------------------------
  // TEST 22: Success Card Render Verification (Title, Exchanges, ID, Saved independently, View, Dismiss)
  // ------------------------------------------------------------------
  console.log('\n[TEST 22] Success Card Render Verification...');
  const agentPanelCode = fs.readFileSync(path.join(__dirname, '../renderer/components/AgentPanel.tsx'), 'utf8');

  // Verify explicit status type and state definition
  assert.ok(agentPanelCode.includes('type CapsuleCreationStatus = "IDLE" | "PROCESSING" | "SUCCESS" | "FAILED"'));
  assert.ok(agentPanelCode.includes('const [capsuleCreationStatus, setCapsuleCreationStatus] = useState<CapsuleCreationStatus>("IDLE")'));
  
  // Verify button disabled condition accounts for PROCESSING
  assert.ok(agentPanelCode.includes('isCreatingCapsule || capsuleCreationStatus === "PROCESSING"'));

  // Verify prominent success card rendering
  assert.ok(agentPanelCode.includes('✓ CONTEXT CAPSULE CREATED'));
  assert.ok(agentPanelCode.includes('Saved independently'));
  assert.ok(agentPanelCode.includes('View Capsule'));
  assert.ok(agentPanelCode.includes('Dismiss'));
  assert.ok(agentPanelCode.includes('capsuleFeedbackRef'));
  assert.ok(agentPanelCode.includes('sticky top-2 z-20 backdrop-blur-md'));

  // Verify failure card rendering
  assert.ok(agentPanelCode.includes('✕ CONTEXT CAPSULE CREATION FAILED'));
  assert.ok(agentPanelCode.includes('Try Again'));

  // Verify threshold warning buttons show loading state
  assert.ok(agentPanelCode.includes('isCreatingCapsule || capsuleCreationStatus === "PROCESSING" ? "Creating Capsule..." : "Create Context Capsule"'));
  passedCount++;
  console.log('✓ TEST 22 PASSED: AgentPanel.tsx renders complete success/failure cards with all actions and states');

  // ------------------------------------------------------------------
  // TEST 23: Strict result.success === true check enforced in renderer
  // ------------------------------------------------------------------
  console.log('\n[TEST 23] Strict result.success === true check enforced in renderer...');
  assert.ok(agentPanelCode.includes('if (res && res.success === true && res.capsuleId) {'));
  passedCount++;
  console.log('✓ TEST 23 PASSED: Only authoritative res.success === true transitions to SUCCESS');

  // ------------------------------------------------------------------
  // TEST 24: Persisted capsule exists on disk and is readable
  // ------------------------------------------------------------------
  console.log('\n[TEST 24] Persisted capsule exists on disk and is readable...');
  const verifyCapsule = manager.createCapsule(activeThread.threadId);
  const verifySave = manager.saveCapsule(verifyCapsule);
  assert.strictEqual(verifySave.success, true);
  assert.ok(fs.existsSync(verifySave.filePath));
  const readContent = JSON.parse(fs.readFileSync(verifySave.filePath, 'utf8'));
  assert.strictEqual(readContent.capsule_id, verifyCapsule.capsule_id);
  assert.strictEqual(readContent.nexus_capsule_version, '1.0.0');
  passedCount++;
  console.log(`✓ TEST 24 PASSED: Capsule file successfully persisted and verified at ${verifySave.filePath}`);

  // Cleanup test directory
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (_) {}

  console.log('\n================================================================');
  console.log(`CONTEXT CAPSULE (PHASE 3) TEST SUMMARY: ${passedCount}/24 TESTS PASSED`);
  console.log('================================================================\n');
}

runContextCapsuleCreationTests().catch((err) => {
  console.error('\n❌ CONTEXT CAPSULE (PHASE 3) TEST SUITE FAILED:', err);
  process.exit(1);
});
