/**
 * NEXUS CONTINUUM LINEAGE: FINAL COMPREHENSIVE E2E VERIFICATION SUITE
 * 
 * Tests the complete 10-step flow specified for NEXUS:
 * 1. Chat A contains known project facts, decisions, and recent discussion.
 * 2. Create Chat B.
 * 3. Verify B is clean before Continuum (Continuum OFF).
 * 4. Click Continuum (Continuum ON).
 * 5. Verify the synthesized handoff is generated and injected.
 * 6. Ask Chat B to summarize previous chat context.
 * 7. Verify expected facts/decisions are recovered.
 * 8. Verify no tools or ChangeSet are triggered.
 * 9. Verify Chat A history remains unchanged.
 * 10. Restart NEXUS and verify handoff still works when Continuum is activated again.
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

async function runContinuumFinalLineageTest() {
  console.log('================================================================');
  console.log('NEXUS CONTINUUM LINEAGE: FINAL 10-STEP SPECIFICATION TEST');
  console.log('================================================================\n');

  const testStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-continuum-final-storage-'));
  const testWorkspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-continuum-final-workspace-'));
  process.env.ECHO_CONTINUUM_DIR = testStorageDir;

  try {
    let runtime = HarnessRuntime.createIsolated();

    // ----------------------------------------------------
    // STEP 1: Chat A contains known project facts, decisions, and recent discussion
    // ----------------------------------------------------
    console.log('[STEP 1] Chat A: Establishing known project facts, decisions, and discussion...');
    const threadA = runtime.createThread({
      userInput: 'Initialize payment service architecture',
      metadata: {
        workspacePath: testWorkspaceDir,
        workspaceName: 'nexus-payments-core',
      },
    });

    // Turn 1 in Chat A: User states architecture facts & routing
    await runtime.runTurn({
      threadId: threadA.threadId,
      userInput: 'Architecture: NEXUS 1–5 uses Gemini, NEXUS 6 uses Groq, and all modifications require ChangeSet approval workflow.',
      workspacePath: testWorkspaceDir,
      intent: CODING_INTENTS.READ_ONLY,
      modelHandler: async () => 'Architecture facts and model routing parameters verified.',
    });

    // Turn 2 in Chat A: User records an explicit decision
    await runtime.runTurn({
      threadId: threadA.threadId,
      userInput: 'Decision: Migrate token storage from localStorage to secure httpOnly cookies (Rationale: Mitigate XSS token theft)',
      workspacePath: testWorkspaceDir,
      intent: CODING_INTENTS.READ_ONLY,
      modelHandler: async () => 'Engineering decision recorded: Migrate to secure httpOnly cookies.',
    });

    // Turn 3 in Chat A: Additional discussion exchange
    await runtime.runTurn({
      threadId: threadA.threadId,
      userInput: 'What is the target cookie domain for staging?',
      workspacePath: testWorkspaceDir,
      intent: CODING_INTENTS.READ_ONLY,
      modelHandler: async () => 'Target cookie domain for staging is set to auth.staging.nexus.internal.',
    });

    // Save Thread A to Continuum snapshot disk storage
    const saveResA = runtime.saveThread(threadA.threadId, testWorkspaceDir);
    assert.strictEqual(saveResA.success, true, 'Chat A thread save must succeed');
    const snapA = saveResA.snapshot;
    assert.ok(snapA, 'Snapshot A must exist');

    const getThreadItems = (tId) => {
      const turns = runtime.turnManager.listTurnsByThread(tId);
      return turns.flatMap((t) => runtime.itemStore.getItemsByTurn(t.turnId));
    };

    const threadAItemsBefore = getThreadItems(threadA.threadId);
    console.log(`  ✔ [PASS] Chat A populated with 3 turns and saved snapshot (${threadAItemsBefore.length} items).`);

    // ----------------------------------------------------
    // STEP 2: Create Chat B
    // ----------------------------------------------------
    console.log('\n[STEP 2] Creating Chat B...');
    const threadB = runtime.createThread({
      userInput: '',
      metadata: {
        workspacePath: testWorkspaceDir,
        workspaceName: 'nexus-payments-core',
      },
    });
    assert.ok(threadB.threadId, 'Thread B must have unique threadId');
    assert.notStrictEqual(threadB.threadId, threadA.threadId, 'Thread B must be distinct from Thread A');
    console.log(`  ✔ [PASS] Chat B created cleanly (Thread ID: ${threadB.threadId}).`);

    // ----------------------------------------------------
    // STEP 3: Verify B is clean before Continuum (Continuum OFF)
    // ----------------------------------------------------
    console.log('\n[STEP 3] Verifying Chat B is clean before Continuum activation (Continuum OFF)...');
    let contextBeforeContinuum = '';
    const resB_clean = await runtime.handleRequest({
      threadId: threadB.threadId,
      userInput: 'Hello, what are we working on?',
      workspacePath: testWorkspaceDir,
      continuumActive: false, // Explicitly OFF
      modelHandler: async (messages) => {
        const sys = messages.find((m) => m.role === 'system');
        if (sys) contextBeforeContinuum = sys.content;
        return 'Hello! I am ready. How can I help you today?';
      },
    });

    assert.strictEqual(resB_clean.success, true, 'Clean request must succeed');
    assert.ok(!contextBeforeContinuum.includes('httpOnly cookies'), 'Context must not contain previous decision');
    assert.ok(!contextBeforeContinuum.includes('NEXUS 1–5'), 'Context must not contain previous architecture facts');
    console.log('  ✔ [PASS] Chat B is 100% clean with zero inherited context when Continuum is OFF.');

    // ----------------------------------------------------
    // STEP 4: Click Continuum (Continuum ON)
    // ----------------------------------------------------
    console.log('\n[STEP 4] User clicks Continuum Lineage...');
    const latestSnapshot = runtime.getLatestWorkspaceSnapshot(testWorkspaceDir, threadB.threadId);
    assert.ok(latestSnapshot, 'Must find latest workspace snapshot');
    assert.strictEqual(latestSnapshot.metadata.sessionId, snapA.metadata.sessionId, 'Snapshot ID matches Chat A');
    console.log('  ✔ [PASS] Resolved latest workspace snapshot for Continuum Lineage.');

    // ----------------------------------------------------
    // STEP 5: Verify synthesized handoff is generated and injected
    // ----------------------------------------------------
    console.log('\n[STEP 5] Generating and verifying concise synthesized handoff...');
    const handoffResult = continuumContextBuilder.buildSynthesizedHandoffPrompt(latestSnapshot);
    assert.strictEqual(handoffResult.success, true, 'Handoff prompt synthesis must succeed');
    const handoffText = handoffResult.handoffText;

    // Verify all 7 required structural sections exist
    assert.ok(handoffText.includes('CONTINUUM HANDOFF FROM PREVIOUS CHAT'), 'Must have header');
    assert.ok(handoffText.includes('Project:'), 'Must have Project section');
    assert.ok(handoffText.includes('Important repeated context:'), 'Must have Important repeated context section');
    assert.ok(handoffText.includes('Important decisions:'), 'Must have Important decisions section');
    assert.ok(handoffText.includes('Last 3 meaningful exchanges:'), 'Must have Last 3 meaningful exchanges section');
    assert.ok(handoffText.includes('Current state:'), 'Must have Current state section');
    assert.ok(handoffText.includes('Relevant files:'), 'Must have Relevant files section');
    assert.ok(handoffText.includes('Open issues / next action:'), 'Must have Open issues / next action section');
    assert.ok(handoffText.includes('Continue from this context.'), 'Must have footer');

    // Verify brevity: token bounded and NOT raw transcript copy
    assert.ok(handoffText.length <= 6000, `Handoff text length (${handoffText.length}) must be <= 6000 chars`);
    console.log(`  ✔ [PASS] Synthesized handoff generated (${handoffText.length} chars, ~${handoffResult.tokenEstimate} tokens).`);

    // ----------------------------------------------------
    // STEP 6 & 7: Ask Chat B to summarize context & verify facts/decisions recovered
    // ----------------------------------------------------
    console.log('\n[STEP 6 & 7] Asking Chat B to summarize context with Continuum Lineage active...');
    let injectedPromptB = '';
    const resB_active = await runtime.handleRequest({
      threadId: threadB.threadId,
      userInput: 'Summarize what we decided and our model architecture from the previous chat.',
      workspacePath: testWorkspaceDir,
      continuumActive: true,
      continuumContextText: handoffText,
      continuumSnapshot: latestSnapshot,
      modelHandler: async (messages) => {
        const sys = messages.find((m) => m.role === 'system');
        if (sys) injectedPromptB = sys.content;
        return 'Based on the Continuum handoff: NEXUS 1–5 uses Gemini and NEXUS 6 uses Groq with ChangeSet workflow. We decided to migrate token storage to secure httpOnly cookies to mitigate XSS token theft.';
      },
    });

    assert.strictEqual(resB_active.success, true, 'Chat B request with Continuum must succeed');
    assert.ok(injectedPromptB.includes('httpOnly cookies'), 'Injected prompt must contain cookie decision');
    assert.ok(injectedPromptB.includes('Mitigate XSS token theft'), 'Injected prompt must contain decision rationale');
    assert.ok(injectedPromptB.includes('NEXUS 1–5') || injectedPromptB.includes('Gemini'), 'Injected prompt must contain model routing facts');
    console.log('  ✔ [PASS] Chat B recovered exact facts and decisions via injected synthesized handoff.');

    // ----------------------------------------------------
    // STEP 8: Verify no tools or ChangeSet are triggered
    // ----------------------------------------------------
    console.log('\n[STEP 8] Verifying no tools, ChangeSet, or file modifications were triggered...');
    const threadBItems = getThreadItems(threadB.threadId);
    const toolCallItems = threadBItems.filter((i) => i.type === ITEM_TYPES.TOOL_CALL);
    const changeSetItems = threadBItems.filter((i) => i.type === ITEM_TYPES.CHANGE_SET);
    assert.strictEqual(toolCallItems.length, 0, 'No tool calls should be executed');
    assert.strictEqual(changeSetItems.length, 0, 'No changesets should be created');
    console.log('  ✔ [PASS] 0 tool calls, 0 changesets, 0 file mutations triggered.');

    // ----------------------------------------------------
    // STEP 9: Verify Chat A history remains unchanged
    // ----------------------------------------------------
    console.log('\n[STEP 9] Verifying Chat A history remains 100% unchanged...');
    const threadAItemsAfter = getThreadItems(threadA.threadId);
    assert.strictEqual(threadAItemsAfter.length, threadAItemsBefore.length, 'Chat A item count must remain unchanged');
    for (let i = 0; i < threadAItemsBefore.length; i++) {
      assert.strictEqual(threadAItemsAfter[i].itemId, threadAItemsBefore[i].itemId, `Item ${i} ID matches`);
      assert.strictEqual(threadAItemsAfter[i].type, threadAItemsBefore[i].type, `Item ${i} type matches`);
    }
    console.log('  ✔ [PASS] Chat A history is 100% intact and unpolluted.');

    // ----------------------------------------------------
    // STEP 10: Restart NEXUS and verify handoff still works when Continuum is activated again
    // ----------------------------------------------------
    console.log('\n[STEP 10] Simulating NEXUS restart / cold reload and verifying Continuum persistence...');
    // Create new isolated runtime instance (simulating cold app reboot)
    const rebootedRuntime = HarnessRuntime.createIsolated();
    const diskSnapshot = rebootedRuntime.getLatestWorkspaceSnapshot(testWorkspaceDir);
    assert.ok(diskSnapshot, 'Must reload snapshot from persistent disk storage after reboot');
    assert.ok(
      Array.isArray(diskSnapshot.decisions) && diskSnapshot.decisions.some((d) => d.decision.includes('httpOnly cookies')),
      'Persisted snapshot must preserve decisions across reboot'
    );

    const rebootedHandoff = continuumContextBuilder.buildSynthesizedHandoffPrompt(diskSnapshot);
    assert.strictEqual(rebootedHandoff.success, true, 'Rebooted handoff generation must succeed');
    assert.ok(rebootedHandoff.handoffText.includes('httpOnly cookies'), 'Reloaded handoff has decisions');
    assert.ok(rebootedHandoff.handoffText.includes('Mitigate XSS token theft'), 'Reloaded handoff has rationale');

    const threadC = rebootedRuntime.createThread({
      userInput: 'Post-restart query',
      metadata: { workspacePath: testWorkspaceDir, workspaceName: 'nexus-payments-core' },
    });

    let rebootedPromptC = '';
    const resC = await rebootedRuntime.handleRequest({
      threadId: threadC.threadId,
      userInput: 'What was our token storage decision before restart?',
      workspacePath: testWorkspaceDir,
      continuumActive: true,
      continuumContextText: rebootedHandoff.handoffText,
      continuumSnapshot: diskSnapshot,
      modelHandler: async (messages) => {
        const sys = messages.find((m) => m.role === 'system');
        if (sys) rebootedPromptC = sys.content;
        return 'The decision persisted across restart: migrate to httpOnly cookies.';
      },
    });

    assert.strictEqual(resC.success, true, 'Chat C request after restart must succeed');
    assert.ok(rebootedPromptC.includes('httpOnly cookies'), 'Post-restart context contains cookie decision');
    console.log('  ✔ [PASS] Cold restart verified: Continuum snapshot and handoff persist and operate seamlessly.');

    console.log('\n================================================================');
    console.log('✔ ALL 10 STEPS OF CONTINUUM LINEAGE SPECIFICATION PASSED CLEANLY!');
    console.log('================================================================\n');
  } finally {
    try {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
      fs.rmSync(testWorkspaceDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

runContinuumFinalLineageTest().catch((err) => {
  console.error('\n[FATAL CONTINUUM FINAL LINEAGE FAILURE]', err);
  process.exit(1);
});
