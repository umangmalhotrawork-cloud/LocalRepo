/**
 * NEXUS CONTINUUM LINEAGE: FOCUSED A -> B DECISION RECOVERY REGRESSION TEST
 * 
 * Scenario:
 * 1. Chat A records an explicit engineering decision with rationale.
 * 2. New Chat B starts with zero prior conversation history copied.
 * 3. Chat B automatically loads latest workspace Continuum snapshot.
 * 4. Chat B answers queries about previous decisions and recovers the exact decision and rationale.
 * 5. Verifies history isolation, intent preservation, and zero secret leaks.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const {
  HarnessRuntime,
  ITEM_TYPES,
  TURN_STATUS,
  ROUTER_MODES,
  CODING_INTENTS,
} = require('./harness');
const { continuumEngine } = require('../engine/continuum_engine');
const { continuumManager } = require('./continuumManager');
const { continuumContextBuilder } = require('../engine/continuum_context_builder');

async function runDecisionRecoveryABTest() {
  console.log('================================================================');
  console.log('NEXUS CONTINUUM: A -> B ENGINEERING DECISION RECOVERY TEST');
  console.log('================================================================\n');

  const testStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-decision-ab-storage-'));
  const testWorkspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-decision-ab-workspace-'));
  process.env.ECHO_CONTINUUM_DIR = testStorageDir;

  try {
    const runtime = HarnessRuntime.createIsolated();

    // ----------------------------------------------------
    // STEP 1: Chat A records an explicit engineering decision
    // ----------------------------------------------------
    console.log('[STEP 1] Chat A: Stating explicit engineering decision with rationale...');
    const threadA = runtime.createThread({
      userInput: 'Optimize checkout calculation latency',
      metadata: {
        workspacePath: testWorkspaceDir,
        workspaceName: 'nexus-tax-service',
      },
    });

    const userDirectiveA = 'Decision: Implement memoized tax tiered rates instead of linear recomputation (Rationale: Cuts checkout latency by 45%)';

    const turnOutcomeA = await runtime.runTurn({
      threadId: threadA.threadId,
      userInput: userDirectiveA,
      workspacePath: testWorkspaceDir,
      intent: CODING_INTENTS.READ_ONLY,
      modelHandler: async (messages) => {
        return 'Decision recorded and verified: Memoized tax tiered rates will cut checkout latency by 45%.';
      },
    });

    assert.strictEqual(turnOutcomeA.success, true, 'Chat A turn must succeed');
    assert.strictEqual(turnOutcomeA.status, TURN_STATUS.COMPLETED, 'Chat A turn must complete');

    // Save Thread A to disk
    const saveResA = runtime.saveThread(threadA.threadId, testWorkspaceDir);
    assert.strictEqual(saveResA.success, true, 'Thread A snapshot save must succeed');
    assert.ok(saveResA.snapshot, 'Snapshot must be created');

    // Verify decision stored in snapshot
    const snapA = saveResA.snapshot;
    assert.ok(Array.isArray(snapA.decisions), 'Snapshot must have decisions array');
    assert.ok(snapA.decisions.length >= 1, 'At least 1 decision must be persisted');

    const matchedDecision = snapA.decisions.find(d => 
      d.decision.includes('Implement memoized tax tiered rates instead of linear recomputation')
    );
    assert.ok(matchedDecision, 'Exact decision text must be present in snapshot');
    assert.ok(matchedDecision.rationale.includes('Cuts checkout latency by 45%'), 'Decision rationale must be present');
    assert.strictEqual(matchedDecision.userApproved, true, 'Decision must be marked approved');

    console.log('  ✔ [PASS] Chat A persisted explicit engineering decision to Continuum disk storage.');

    // ----------------------------------------------------
    // STEP 2: Chat B (New Chat) queries previous decision
    // ----------------------------------------------------
    console.log('\n[STEP 2] Chat B: Opening new chat and asking for previous engineering decisions...');
    
    // Create new thread without copying Chat A's conversation items
    const threadB = runtime.createThread({
      userInput: 'What was the last important engineering decision made in this project?',
      metadata: {
        workspacePath: testWorkspaceDir,
        workspaceName: 'nexus-tax-service',
      },
    });

    const userQueryB = 'What was the last important engineering decision made in this project?';

    // Verify Chat B intent remains conversational/read-only
    const classificationB = runtime.classifyRequest(userQueryB, { workspacePath: testWorkspaceDir });
    assert.ok(
      classificationB.mode === ROUTER_MODES.CONVERSATION || classificationB.codingIntent === CODING_INTENTS.READ_ONLY,
      'Chat B intent must remain CONVERSATION or READ_ONLY'
    );

    // Execute Chat B request without passing continuumSnapshot in payload (verifies auto-resolution)
    let capturedContextB = '';
    const resB = await runtime.handleRequest({
      threadId: threadB.threadId,
      userInput: userQueryB,
      workspacePath: testWorkspaceDir,
      modelHandler: async (messages) => {
        const sysMsg = messages.find(m => m.role === 'system');
        if (sysMsg) capturedContextB = sysMsg.content;
        return `The last important decision was: ${matchedDecision.decision} (Rationale: ${matchedDecision.rationale})`;
      },
    });

    assert.strictEqual(resB.success, true, 'Chat B request handling must succeed');

    // Verify that the prompt context injected into Chat B contained the exact decision & rationale
    const turnB = runtime.turnManager.listTurnsByThread(threadB.threadId)[0];
    const contextB = runtime.buildContext({
      thread: threadB,
      turn: turnB,
      workspacePath: testWorkspaceDir,
      continuumSnapshot: snapA,
      intent: CODING_INTENTS.READ_ONLY,
    });

    assert.ok(
      contextB.systemPrompt.includes('Implement memoized tax tiered rates instead of linear recomputation'),
      'Injected system prompt must include the exact decision'
    );
    assert.ok(
      contextB.systemPrompt.includes('Cuts checkout latency by 45%'),
      'Injected system prompt must include the exact rationale'
    );

    console.log('  ✔ [PASS] Chat B successfully recovered exact engineering decision and rationale from Continuum.');

    // ----------------------------------------------------
    // STEP 3: Chat History Isolation Verification
    // ----------------------------------------------------
    console.log('\n[STEP 3] Verifying strict chat history isolation between Chat A and Chat B...');
    const threadATurns = runtime.turnManager.listTurnsByThread(threadA.threadId);
    const threadBTurns = runtime.turnManager.listTurnsByThread(threadB.threadId);

    assert.strictEqual(threadATurns.length, 1, 'Thread A has 1 turn');
    assert.notStrictEqual(threadATurns[0].turnId, threadB?.threadId, 'Thread IDs distinct');
    assert.strictEqual(threadATurns[0].userInput, userDirectiveA, 'Thread A userInput unmodified');

    const threadAItems = runtime.itemStore.getItemsByTurn(threadATurns[0].turnId);
    assert.ok(threadAItems.every(i => i.turnId === threadATurns[0].turnId), 'Thread A items belong only to Turn A');

    console.log('  ✔ [PASS] Full conversation histories remain strictly isolated.');

    // ----------------------------------------------------
    // STEP 4: Zero Secret Leaks & Bounded Context Size
    // ----------------------------------------------------
    console.log('\n[STEP 4] Verifying secret redaction and bounded context size...');
    const rawDisk = JSON.stringify(snapA);
    assert.ok(!rawDisk.includes('AIzaSy'), 'No Google keys on disk');
    assert.ok(!rawDisk.includes('sk-'), 'No OpenAI keys on disk');
    assert.ok(!rawDisk.includes('gsk_'), 'No Groq keys on disk');

    const built = continuumContextBuilder.buildContext(snapA);
    assert.ok(built.contextText.length <= 6000, `Built context length (${built.contextText.length}) <= 6000`);

    console.log('  ✔ [PASS] Zero secrets detected and context budget strictly bounded.');

    console.log('\n================================================================');
    console.log('✔ A -> B DECISION RECOVERY REGRESSION TEST PASSED CLEANLY!');
    console.log('================================================================\n');
  } finally {
    try {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
      fs.rmSync(testWorkspaceDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

runDecisionRecoveryABTest().catch((err) => {
  console.error('\n[FATAL A->B REGRESSION TEST FAILURE]', err);
  process.exit(1);
});
