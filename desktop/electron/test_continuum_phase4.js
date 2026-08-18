/**
 * Continuum Phase 4 Integration, Handoff & Chained Session Test Suite
 * Tests creation from active session state, snapshot loading/listing/deleting,
 * workspace safety, resume chaining (S1 -> S2 -> S3), context building, secret redaction,
 * and full Phase 1-3 + BDG regression suite execution.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { continuumEngine } = require('../engine/continuum_engine');
const { continuumManager } = require('./continuumManager');
const { continuumContextBuilder } = require('../engine/continuum_context_builder');
const secretFilter = require('../security/secretFilter');
const { agentManager } = require('./agentManager');

async function runPhase4Tests() {
  console.log('[TEST] Starting Continuum Phase 4 Handoff Integration Suite...');

  // Setup isolated temporary test directory for ECHO_CONTINUUM_DIR
  const testStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-continuum-phase4-'));
  process.env.ECHO_CONTINUUM_DIR = testStorageDir;

  const workspaceA = '/path/to/demo-workspaces/ai_cart_project';
  const workspaceB = '/path/to/demo-workspaces/other_project';

  try {
    // TEST 1: Create snapshot from active session state
    console.log('[PHASE 4 TEST 1] Creating snapshot from active session state...');
    const activePayload = {
      sessionId: 'session_s1_init',
      userGoal: 'Refactor exception handling in compute_order_total',
      activeMilestone: 'Phase 4 Handoff',
      currentSubtask: 'Create Continuum Snapshot',
      completedSteps: ['AST Symbol Resolution', 'Blast Radius Calculation'],
      pendingSteps: ['Apply Defensive Try-Catch', 'Run Pytest Suite'],
      activeTargetNodeId: 'function::src/checkout_engine.py::compute_order_total',
      activeFilePath: 'src/checkout_engine.py',
      cursorLine: 19,
      dirtyFiles: [{ relPath: 'src/checkout_engine.py', lineCount: 45, unsavedChanges: true }],
      decisions: [
        {
          timestamp: Date.now() - 5000,
          decision: 'Enforce exception isolation boundary inside compute_order_total',
          rationale: 'Prevents caller contexts from crashing on unhandled exception',
          rejectedAlternatives: ['Global error handler'],
          userApproved: true,
        },
      ],
      verification: {
        lastTestStatus: 'FAILED',
        failingTestNames: ['test_invalid_cart_item'],
        behavioralDiffSummary: { riskLevel: 'HIGH', disconnectedNodesCount: 0, affectedFilesCount: 1 },
      },
      summary: 'User requested defensive exception isolation for compute_order_total.',
      immediateNextAction: 'Apply proposal prop_phase4 upon user confirmation',
    };

    const snapshotInput = {
      sessionId: activePayload.sessionId,
      parentSessionId: null,
      sequenceNumber: 1,
      project: {
        workspaceName: path.basename(workspaceA),
        workspacePath: workspaceA,
        workspaceHash: continuumManager.getWorkspaceHash(workspaceA),
        detectedStack: { primaryLanguage: 'python', frameworks: ['pytest'], testRunner: 'pytest' },
        bdgGraphSummary: { totalNodes: 36, totalEdges: 42, entryPointFiles: ['src/checkout_engine.py'] },
      },
      task: {
        userGoal: activePayload.userGoal,
        activeMilestone: activePayload.activeMilestone,
        currentSubtask: activePayload.currentSubtask,
        completedSteps: activePayload.completedSteps,
        pendingSteps: activePayload.pendingSteps,
        blockers: [],
      },
      codeState: {
        activeTargetNodeId: activePayload.activeTargetNodeId,
        activeFilePath: activePayload.activeFilePath,
        cursorLine: activePayload.cursorLine,
        dirtyFiles: activePayload.dirtyFiles,
      },
      decisions: activePayload.decisions,
      verification: activePayload.verification,
      conversation: {
        condensedSummary: activePayload.summary,
        lastUserDirective: activePayload.userGoal,
      },
      handoff: {
        immediateNextAction: activePayload.immediateNextAction,
      },
    };

    const snapshot1 = continuumEngine.createSnapshot(snapshotInput);
    if (!snapshot1 || snapshot1.metadata.sessionId !== 'session_s1_init') {
      console.error('[PHASE 4 TEST 1 FAILED] Snapshot creation failed:', snapshot1);
      process.exit(1);
    }
    console.log('[PHASE 4 TEST 1 PASSED] Active session snapshot created cleanly.');

    // TEST 2: Snapshot validation
    console.log('[PHASE 4 TEST 2] Validating snapshot structure...');
    const valResult = continuumEngine.validateSnapshot(snapshot1);
    if (!valResult.valid) {
      console.error('[PHASE 4 TEST 2 FAILED] Validation errors:', valResult.errors);
      process.exit(1);
    }
    console.log('[PHASE 4 TEST 2 PASSED] Snapshot validation passed.');

    // TEST 3: Snapshot persistence
    console.log('[PHASE 4 TEST 3] Saving snapshot to local persistent storage...');
    const saveRes = continuumManager.saveSnapshot(snapshot1, workspaceA);
    if (!saveRes.success || !fs.existsSync(saveRes.path)) {
      console.error('[PHASE 4 TEST 3 FAILED] Failed to save snapshot:', saveRes);
      process.exit(1);
    }
    console.log('[PHASE 4 TEST 3 PASSED] Snapshot persisted cleanly.');

    // TEST 4: Snapshot listing
    console.log('[PHASE 4 TEST 4] Listing snapshots for Workspace A...');
    const listRes = continuumManager.listSnapshots(workspaceA);
    if (!Array.isArray(listRes) || listRes.length !== 1 || listRes[0].sessionId !== 'session_s1_init') {
      console.error('[PHASE 4 TEST 4 FAILED] Snapshot listing failed:', listRes);
      process.exit(1);
    }
    console.log('[PHASE 4 TEST 4 PASSED] Snapshot list returned saved session.');

    // TEST 5: Snapshot loading
    console.log('[PHASE 4 TEST 5] Loading snapshot S1...');
    const loadRes = continuumManager.loadSnapshot('session_s1_init', workspaceA);
    if (!loadRes.success || !loadRes.snapshot) {
      console.error('[PHASE 4 TEST 5 FAILED] Failed to load snapshot:', loadRes);
      process.exit(1);
    }
    console.log('[PHASE 4 TEST 5 PASSED] Snapshot loaded cleanly.');

    // TEST 6: Cross-workspace rejection
    console.log('[PHASE 4 TEST 6] Testing cross-workspace load rejection...');
    const crossRes = continuumManager.loadSnapshot('session_s1_init', workspaceB);
    if (crossRes.success) {
      console.error('[PHASE 4 TEST 6 FAILED] Cross-workspace load succeeded unexpectedly!');
      process.exit(1);
    }
    console.log('[PHASE 4 TEST 6 PASSED] Cross-workspace load attempt cleanly rejected.');

    // TEST 7: Malformed snapshot rejection
    console.log('[PHASE 4 TEST 7] Testing malformed snapshot handling...');
    const malformedRes = continuumEngine.validateSnapshot({ invalid: true });
    if (malformedRes.valid) {
      console.error('[PHASE 4 TEST 7 FAILED] Malformed snapshot marked valid!');
      process.exit(1);
    }
    console.log('[PHASE 4 TEST 7 PASSED] Malformed snapshot cleanly rejected.');

    // TEST 8, 9, 10: Resume session creates new sessionId, parentSessionId = S1, sequenceNumber = 2
    console.log('[PHASE 4 TEST 8, 9, 10] Testing session resume and chaining (S1 -> S2)...');
    const snapshot2 = continuumEngine.createNextSnapshot(loadRes.snapshot, {
      task: { userGoal: 'Refactor exception handling in compute_order_total (Resumed S2)' },
    });
    if (
      snapshot2.metadata.sessionId === 'session_s1_init' ||
      snapshot2.metadata.parentSessionId !== 'session_s1_init' ||
      snapshot2.metadata.sequenceNumber !== 2
    ) {
      console.error('[PHASE 4 TEST 8-10 FAILED] Session chaining failed:', snapshot2.metadata);
      process.exit(1);
    }
    continuumManager.saveSnapshot(snapshot2, workspaceA);
    console.log('[PHASE 4 TEST 8-10 PASSED] Resumed session S2 created with parentSessionId=session_s1_init and sequenceNumber=2.');

    // TEST 11: Agent execution / session state reset receives new task plan
    console.log('[PHASE 4 TEST 11] Verifying Agent task execution with resumed session context...');
    const contextRes2 = continuumContextBuilder.buildContext(snapshot2);
    const agentRes = await agentManager.runAgentTask({
      task: snapshot2.task.userGoal,
      workspacePath: workspaceA,
      maxSteps: 5,
      continuumSnapshot: snapshot2,
      continuumContextText: contextRes2.contextText,
    });
    if (!agentRes || !agentRes.success) {
      console.error('[PHASE 4 TEST 11 FAILED] Agent task execution failed:', agentRes);
      process.exit(1);
    }
    console.log('[PHASE 4 TEST 11 PASSED] Agent task executed with Continuum context injected.');

    // TEST 12: Continuum context is generated by buildContext
    console.log('[PHASE 4 TEST 12] Verifying provider-neutral context string...');
    if (!contextRes2.contextText || !contextRes2.contextText.includes('CONTINUUM CONTEXT HANDOFF SNAPSHOT')) {
      console.error('[PHASE 4 TEST 12 FAILED] Context string missing expected header:', contextRes2);
      process.exit(1);
    }
    console.log('[PHASE 4 TEST 12 PASSED] Provider-neutral context generated cleanly.');

    // TEST 13: targetNodeId survives
    console.log('[PHASE 4 TEST 13] Verifying canonical targetNodeId survival in context...');
    if (!contextRes2.contextText.includes('function::src/checkout_engine.py::compute_order_total')) {
      console.error('[PHASE 4 TEST 13 FAILED] targetNodeId missing in context:', contextRes2.contextText);
      process.exit(1);
    }
    console.log('[PHASE 4 TEST 13 PASSED] Canonical targetNodeId survived handoff intact.');

    // TEST 14: Approved decisions survive
    console.log('[PHASE 4 TEST 14] Verifying approved decisions survival in context...');
    if (!contextRes2.contextText.includes('Enforce exception isolation boundary inside compute_order_total')) {
      console.error('[PHASE 4 TEST 14 FAILED] Approved decisions missing in context:', contextRes2.contextText);
      process.exit(1);
    }
    console.log('[PHASE 4 TEST 14 PASSED] Approved decisions survived handoff intact.');

    // TEST 15: Verification state survives
    console.log('[PHASE 4 TEST 15] Verifying verification state survival in context...');
    if (!contextRes2.contextText.includes('FAILED') || !contextRes2.contextText.includes('test_invalid_cart_item')) {
      console.error('[PHASE 4 TEST 15 FAILED] Verification state missing in context:', contextRes2.contextText);
      process.exit(1);
    }
    console.log('[PHASE 4 TEST 15 PASSED] Verification state survived handoff intact.');

    // TEST 16: Immediate next action survives
    console.log('[PHASE 4 TEST 16] Verifying immediate next action survival in context...');
    if (!contextRes2.contextText.includes('Apply proposal prop_phase4 upon user confirmation')) {
      console.error('[PHASE 4 TEST 16 FAILED] Immediate next action missing in context:', contextRes2.contextText);
      process.exit(1);
    }
    console.log('[PHASE 4 TEST 16 PASSED] Immediate next action survived handoff intact.');

    // TEST 17: Secrets never reach generated AI context
    console.log('[PHASE 4 TEST 17] Verifying secret filter redacts credentials from generated context...');
    const secretSnapshot = continuumEngine.createSnapshot({
      sessionId: 'session_secret_p4',
      project: { workspacePath: workspaceA },
      task: { userGoal: 'Fix auth issue with GEMINI_API_KEY="AIzaSyTESTSECRETKEY999" and OPENAI_API_KEY="sk-1234567890abcdef1234567890abcdef"' },
    });
    const secretCtx = continuumContextBuilder.buildContext(secretSnapshot);
    if (
      secretCtx.contextText.includes('AIzaSyTESTSECRETKEY999') ||
      secretCtx.contextText.includes('sk-1234567890abcdef')
    ) {
      console.error('[PHASE 4 TEST 17 FAILED] Raw secret leaked into context text:', secretCtx.contextText);
      process.exit(1);
    }
    if (!secretCtx.contextText.includes('[REDACTED_SECRET:')) {
      console.error('[PHASE 4 TEST 17 FAILED] Redaction indicator missing in context text:', secretCtx.contextText);
      process.exit(1);
    }
    console.log('[PHASE 4 TEST 17 PASSED] Secrets redacted cleanly from generated AI context.');

    // TEST 18: Agent execution without Continuum remains unchanged
    console.log('[PHASE 4 TEST 18] Verifying agent execution without Continuum...');
    const defaultAgent = await agentManager.runAgentTask({ task: 'Run lint check' });
    if (!defaultAgent || !defaultAgent.success) {
      console.error('[PHASE 4 TEST 18 FAILED] Default agent execution failed:', defaultAgent);
      process.exit(1);
    }
    console.log('[PHASE 4 TEST 18 PASSED] Default agent execution without Continuum behaves identically.');

    // TEST 19: Phase 1 suite passes
    console.log('[PHASE 4 TEST 19] Running Phase 1 continuum_engine test suite...');
    const { runTests: runPhase1Tests } = require('../engine/test_continuum_engine');
    runPhase1Tests();
    console.log('[PHASE 4 TEST 19 PASSED] Phase 1 suite passed.');

    // TEST 20: Phase 2 suite passes
    console.log('[PHASE 4 TEST 20] Running Phase 2 continuum_manager test suite...');
    const { runManagerTests: runPhase2Tests } = require('./test_continuum_manager');
    runPhase2Tests();
    console.log('[PHASE 4 TEST 20 PASSED] Phase 2 suite passed.');

    // TEST 21: Phase 3 suite passes
    console.log('[PHASE 4 TEST 21] Running Phase 3 test suite...');
    const { runPhase3Tests } = require('./test_continuum_phase3');
    await runPhase3Tests();
    console.log('[PHASE 4 TEST 21 PASSED] Phase 3 suite passed.');

    // TEST 22: BDG 22-scenario suite passes
    console.log('[PHASE 4 TEST 22] Running BDG & 6 Subsystems 22-scenario regression suite...');
    const { runTests: runBDGTests } = require('../engine/test_bdg_engine');
    runBDGTests();
    console.log('[PHASE 4 TEST 22 PASSED] BDG 22-scenario suite passed.');

    console.log('\n[SUCCESS] ALL CONTINUUM PHASE 4 HANDOFF & NEW SESSION SCENARIOS (TESTS 1–22) PASSED CLEANLY.');
  } finally {
    try {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

if (require.main === module) {
  runPhase4Tests();
}

module.exports = { runPhase4Tests };
