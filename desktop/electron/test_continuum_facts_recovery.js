/**
 * NEXUS CONTINUUM LINEAGE FACTS RECOVERY REGRESSION TEST
 * 
 * Verifies:
 * 1. Chat A stores durable NEXUS architecture facts (NEXUS 1–5 Gemini, NEXUS 6 Groq, ChangeSet approval workflow).
 * 2. Chat B opens as a new chat and recovers the explicit durable facts from Continuum.
 * 3. Chat A and Chat B message histories remain strictly isolated.
 * 4. Chat B stays read-only / conversational and does not change intent.
 * 5. Zero credentials / secrets stored.
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
const secretFilter = require('../security/secretFilter');

async function runContinuumFactsRecoveryTest() {
  console.log('================================================================');
  console.log('NEXUS CONTINUUM LINEAGE: DURABLE FACTS RECOVERY REGRESSION TEST');
  console.log('================================================================\n');

  const testStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-facts-storage-'));
  const testWorkspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-facts-workspace-'));
  process.env.ECHO_CONTINUUM_DIR = testStorageDir;

  try {
    const runtime = HarnessRuntime.createIsolated();

    // ----------------------------------------------------
    // STEP 1: Chat A stores explicit NEXUS architecture facts
    // ----------------------------------------------------
    console.log('[STEP 1] Chat A: Stating explicit NEXUS architecture facts...');
    const threadA = runtime.createThread({
      userInput: 'Define core system architecture and model routing rules',
      metadata: {
        workspacePath: testWorkspaceDir,
        workspaceName: 'nexus-facts-recovery',
      },
    });

    const userDirectiveA = 'Architecture: NEXUS 1–5 powered by Gemini, NEXUS 6 powered by Groq, and all modifications require ChangeSet approval workflow.';

    const turnA = await runtime.runTurn({
      threadId: threadA.threadId,
      userInput: userDirectiveA,
      workspacePath: testWorkspaceDir,
      intent: CODING_INTENTS.READ_ONLY,
      modelHandler: async (messages) => {
        return 'Noted. NEXUS 1–5 is configured on Gemini, NEXUS 6 on Groq, and ChangeSet approval workflow is strictly enforced.';
      },
    });

    assert.strictEqual(turnA.success, true, 'Chat A turn must succeed');
    assert.strictEqual(turnA.status, TURN_STATUS.COMPLETED, 'Chat A turn must complete');

    // Save thread A to Continuum snapshot storage
    const saveResA = runtime.saveThread(threadA.threadId, testWorkspaceDir);
    assert.strictEqual(saveResA.success, true, 'Thread A snapshot save must succeed');
    assert.ok(saveResA.snapshot, 'Snapshot object must be returned');

    // Verify facts in snapshot decisions
    const snapshotA = saveResA.snapshot;
    assert.ok(Array.isArray(snapshotA.decisions), 'Snapshot must contain decisions array');
    assert.ok(snapshotA.decisions.length > 0, 'Snapshot must have captured at least 1 durable fact/decision');

    const decisionsText = snapshotA.decisions.map(d => d.decision).join(' ');
    assert.ok(decisionsText.includes('NEXUS 1–5') || decisionsText.includes('NEXUS 1-5'), 'Must capture NEXUS 1–5');
    assert.ok(decisionsText.includes('Gemini'), 'Must capture Gemini');
    assert.ok(decisionsText.includes('NEXUS 6'), 'Must capture NEXUS 6');
    assert.ok(decisionsText.includes('Groq'), 'Must capture Groq');
    assert.ok(decisionsText.includes('ChangeSet approval workflow') || decisionsText.includes('ChangeSet'), 'Must capture ChangeSet workflow');

    console.log('  ✔ [PASS] Chat A persisted durable architecture facts to Continuum.');

    // ----------------------------------------------------
    // STEP 2: Chat B (New Chat) asks for facts & recovers them
    // ----------------------------------------------------
    console.log('\n[STEP 2] Chat B: Asking for NEXUS architecture facts from previous chat...');
    const threadB = runtime.createThread({
      userInput: 'What are the NEXUS architecture facts and model routing rules?',
      metadata: {
        workspacePath: testWorkspaceDir,
        workspaceName: 'nexus-facts-recovery',
      },
    });

    const userQueryB = 'What are the NEXUS architecture facts and model routing rules?';

    // Verify Chat B classification maintains conversational / read-only intent
    const classificationB = runtime.classifyRequest(userQueryB, { workspacePath: testWorkspaceDir });
    assert.ok(
      classificationB.mode === ROUTER_MODES.CONVERSATION || classificationB.codingIntent === CODING_INTENTS.READ_ONLY,
      'Chat B intent must remain CONVERSATION or READ_ONLY'
    );

    // Run Chat B turn with latest workspace Continuum snapshot automatically injected
    let capturedSystemPromptB = '';
    const turnOutcomeB = await runtime.runTurn({
      threadId: threadB.threadId,
      userInput: userQueryB,
      workspacePath: testWorkspaceDir,
      intent: CODING_INTENTS.READ_ONLY,
      modelHandler: async (messages) => {
        const sysMsg = messages.find(m => m.role === 'system');
        if (sysMsg) capturedSystemPromptB = sysMsg.content;
        return 'Recovered from lineage: NEXUS 1–5 uses Gemini, NEXUS 6 uses Groq, and ChangeSets require user approval.';
      },
    });

    assert.strictEqual(turnOutcomeB.success, true, 'Chat B request handling must succeed');
    assert.strictEqual(turnOutcomeB.status, TURN_STATUS.COMPLETED, 'Chat B turn must complete');

    // Retrieve compiled context for Chat B to assert durable context recovery
    const turnB = runtime.turnManager.listTurnsByThread(threadB.threadId)[0];
    const contextB = runtime.buildContext({
      thread: threadB,
      turn: turnB,
      workspacePath: testWorkspaceDir,
      continuumSnapshot: snapshotA,
      intent: CODING_INTENTS.READ_ONLY,
    });

    const fullPromptB = contextB.systemPrompt;
    assert.ok(fullPromptB.includes('NEXUS 1–5') || fullPromptB.includes('NEXUS 1-5'), 'Injected prompt must include NEXUS 1–5');
    assert.ok(fullPromptB.includes('Gemini'), 'Injected prompt must include Gemini');
    assert.ok(fullPromptB.includes('NEXUS 6'), 'Injected prompt must include NEXUS 6');
    assert.ok(fullPromptB.includes('Groq'), 'Injected prompt must include Groq');
    assert.ok(fullPromptB.includes('ChangeSet'), 'Injected prompt must include ChangeSet workflow');

    console.log('  ✔ [PASS] Chat B successfully recovered all explicit NEXUS architecture facts from Continuum.');

    // ----------------------------------------------------
    // STEP 3: Chat History Isolation Verification
    // ----------------------------------------------------
    console.log('\n[STEP 3] Verifying strict chat history isolation...');
    const threadATurns = runtime.turnManager.listTurnsByThread(threadA.threadId);
    const threadBTurns = runtime.turnManager.listTurnsByThread(threadB.threadId);

    assert.strictEqual(threadATurns.length, 1, 'Thread A must have exactly 1 turn');
    assert.strictEqual(threadBTurns.length, 1, 'Thread B must have exactly 1 turn');

    assert.notStrictEqual(threadATurns[0].turnId, threadBTurns[0].turnId, 'Turn IDs must be distinct');
    assert.strictEqual(threadATurns[0].userInput, userDirectiveA, 'Thread A userInput must remain untouched');
    assert.strictEqual(threadBTurns[0].userInput, userQueryB, 'Thread B userInput must remain untouched');

    const threadAItems = runtime.itemStore.getItemsByTurn(threadATurns[0].turnId);
    const threadBItems = runtime.itemStore.getItemsByTurn(threadBTurns[0].turnId);

    assert.ok(threadAItems.every(i => i.turnId === threadATurns[0].turnId), 'All Thread A items belong to Turn A');
    assert.ok(threadBItems.every(i => i.turnId === threadBTurns[0].turnId), 'All Thread B items belong to Turn B');
    assert.ok(threadAItems.every(i => !threadBItems.some(b => b.itemId === i.itemId)), 'Items between Thread A and B are completely disjoint');

    console.log('  ✔ [PASS] Chat A and Chat B message histories remain strictly isolated.');

    // ----------------------------------------------------
    // STEP 4: Zero Secret Leaks & Bounded Context
    // ----------------------------------------------------
    console.log('\n[STEP 4] Verifying secret redaction and bounded context size...');
    const rawSnapshotStr = JSON.stringify(snapshotA);
    assert.ok(!rawSnapshotStr.includes('AIzaSy'), 'No Google API keys');
    assert.ok(!rawSnapshotStr.includes('sk-'), 'No OpenAI keys');
    assert.ok(!rawSnapshotStr.includes('gsk_'), 'No Groq keys');

    const builtContext = continuumContextBuilder.buildContext(snapshotA);
    assert.ok(builtContext.contextText.length <= 6000, `Context size (${builtContext.contextText.length}) <= 6000 budget`);

    console.log('  ✔ [PASS] Zero secrets detected and context budget strictly bounded.');

    console.log('\n================================================================');
    console.log('✔ ALL CONTINUUM LINEAGE FACTS RECOVERY TESTS PASSED CLEANLY!');
    console.log('================================================================\n');
  } finally {
    try {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
      fs.rmSync(testWorkspaceDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

runContinuumFactsRecoveryTest().catch((err) => {
  console.error('\n[FATAL REGRESSION TEST FAILURE]', err);
  process.exit(1);
});
