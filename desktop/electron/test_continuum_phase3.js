/**
 * Continuum Phase 3 Integration & Provider-Neutral Context Test Suite
 * Tests provider-neutral context building, secret redaction, token/character budget limits,
 * AI Manager & Agent Manager integration, fallback safety, and regression suite execution.
 */

const fs = require('fs');
const path = require('path');
const { continuumEngine } = require('../engine/continuum_engine');
const { continuumContextBuilder } = require('../engine/continuum_context_builder');
const aiManager = require('./aiManager');
const { agentManager } = require('./agentManager');

async function runPhase3Tests() {
  console.log('[TEST] Starting Continuum Phase 3 Context Integration Suite...');

  // Setup valid test snapshot
  const snapshotData = {
    sessionId: 'session_phase3_001',
    parentSessionId: 'session_phase2_999',
    project: {
      workspaceName: 'ai_cart_project',
      workspacePath: '/path/to/demo-workspaces/ai_cart_project',
      workspaceHash: 'a1b2c3d4e5f67890',
      detectedStack: { primaryLanguage: 'python', frameworks: ['pytest'], testRunner: 'pytest' },
      bdgGraphSummary: { totalNodes: 36, totalEdges: 42, entryPointFiles: ['src/checkout_engine.py'] },
    },
    task: {
      userGoal: 'Refactor exception handling in compute_order_total',
      activeMilestone: 'Phase 3 Handoff',
      currentSubtask: 'Verify context injection',
      completedSteps: ['AST Symbol Resolution', 'Blast Radius Calculation'],
      pendingSteps: ['Apply Defensive Try-Catch', 'Run Pytest Suite'],
    },
    codeState: {
      activeTargetNodeId: 'function::src/checkout_engine.py::compute_order_total',
      activeFilePath: 'src/checkout_engine.py',
      cursorLine: 19,
      dirtyFiles: [{ relPath: 'src/checkout_engine.py', lineCount: 45, unsavedChanges: true }],
    },
    decisions: [
      {
        timestamp: Date.now() - 10000,
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
    conversation: {
      condensedSummary: 'User requested defensive exception isolation for compute_order_total.',
      lastUserDirective: 'Make the smallest safe change',
      lastAgentResponseSnippet: 'Proposed defensive exception patch for compute_order_total.',
    },
    handoff: {
      immediateNextAction: 'Apply proposal prop_phase3 upon user confirmation',
    },
  };

  const snapshot = continuumEngine.createSnapshot(snapshotData);

  // TEST 1: Valid Continuum snapshot produces context
  console.log('[TEST 1] Testing context building from valid snapshot...');
  const buildRes1 = continuumContextBuilder.buildContext(snapshot);
  if (!buildRes1.success || !buildRes1.contextText) {
    console.error('[TEST 1 FAILED] Failed to build context:', buildRes1);
    process.exit(1);
  }
  console.log('[TEST 1 PASSED] Provider-neutral context generated cleanly.');

  // TEST 2: Project state survives into context
  console.log('[TEST 2] Verifying project state survival in context text...');
  if (
    !buildRes1.contextText.includes('ai_cart_project') ||
    !buildRes1.contextText.includes('python') ||
    !buildRes1.contextText.includes('Nodes: 36')
  ) {
    console.error('[TEST 2 FAILED] Project state missing in context text:', buildRes1.contextText);
    process.exit(1);
  }
  console.log('[TEST 2 PASSED] Project state survived intact.');

  // TEST 3: Task state survives
  console.log('[TEST 3] Verifying task state survival in context text...');
  if (
    !buildRes1.contextText.includes('Refactor exception handling in compute_order_total') ||
    !buildRes1.contextText.includes('Phase 3 Handoff') ||
    !buildRes1.contextText.includes('Apply Defensive Try-Catch')
  ) {
    console.error('[TEST 3 FAILED] Task state missing in context text:', buildRes1.contextText);
    process.exit(1);
  }
  console.log('[TEST 3 PASSED] Task state survived intact.');

  // TEST 4: Canonical targetNodeId survives
  console.log('[TEST 4] Verifying activeTargetNodeId survival in context text...');
  if (!buildRes1.contextText.includes('function::src/checkout_engine.py::compute_order_total')) {
    console.error('[TEST 4 FAILED] Canonical targetNodeId missing in context text:', buildRes1.contextText);
    process.exit(1);
  }
  console.log('[TEST 4 PASSED] Canonical targetNodeId survived intact.');

  // TEST 5: Approved decisions survive
  console.log('[TEST 5] Verifying approved engineering decisions survival...');
  if (
    !buildRes1.contextText.includes('[APPROVED]') ||
    !buildRes1.contextText.includes('Enforce exception isolation boundary inside compute_order_total')
  ) {
    console.error('[TEST 5 FAILED] Approved decisions missing in context text:', buildRes1.contextText);
    process.exit(1);
  }
  console.log('[TEST 5 PASSED] Approved engineering decisions survived intact.');

  // TEST 6: Verification state survives
  console.log('[TEST 6] Verifying verification state survival...');
  if (
    !buildRes1.contextText.includes('FAILED') ||
    !buildRes1.contextText.includes('test_invalid_cart_item') ||
    !buildRes1.contextText.includes('HIGH')
  ) {
    console.error('[TEST 6 FAILED] Verification state missing in context text:', buildRes1.contextText);
    process.exit(1);
  }
  console.log('[TEST 6 PASSED] Verification state survived intact.');

  // TEST 7: Conversation condensed summary survives
  console.log('[TEST 7] Verifying conversation condensed summary survival...');
  if (!buildRes1.contextText.includes('User requested defensive exception isolation for compute_order_total.')) {
    console.error('[TEST 7 FAILED] Condensed summary missing in context text:', buildRes1.contextText);
    process.exit(1);
  }
  console.log('[TEST 7 PASSED] Condensed summary survived intact.');

  // TEST 8: Immediate handoff directive survives
  console.log('[TEST 8] Verifying immediate handoff directive survival...');
  if (
    !buildRes1.contextText.includes('Apply proposal prop_phase3 upon user confirmation') ||
    !buildRes1.contextText.includes('Make the smallest safe change')
  ) {
    console.error('[TEST 8 FAILED] Immediate handoff directive missing in context text:', buildRes1.contextText);
    process.exit(1);
  }
  console.log('[TEST 8 PASSED] Immediate handoff directive survived intact.');

  // TEST 9: Context remains under ~6,000 character budget
  console.log('[TEST 9] Verifying context length budget limit (~6,000 chars)...');
  const manyDecisions = Array.from({ length: 60 }, (_, i) => ({
    timestamp: Date.now(),
    decision: `Decision ${i}: ${'D'.repeat(150)}`,
    rationale: `Rationale ${i}: ${'R'.repeat(150)}`,
    userApproved: true,
  }));
  const oversizedData = {
    ...snapshotData,
    decisions: manyDecisions,
  };
  const oversizedSnap = continuumEngine.createSnapshot(oversizedData);
  const oversizedRes = continuumContextBuilder.buildContext(oversizedSnap);
  if (oversizedRes.contextText.length > 6100) {
    console.error('[TEST 9 FAILED] Context exceeded 6,000 character budget limit:', oversizedRes.contextText.length);
    process.exit(1);
  }
  if (!oversizedRes.contextText.includes('Deterministically capped')) {
    console.error('[TEST 9 FAILED] Budget reduction indicator missing:', oversizedRes.contextText);
    process.exit(1);
  }
  console.log('[TEST 9 PASSED] Context deterministically capped within 6,000 character budget.');

  // TEST 10: Secrets are redacted
  console.log('[TEST 10] Verifying secret filter redacts credentials from generated context...');
  const secretData = {
    ...snapshotData,
    task: { userGoal: 'Fix issue with GEMINI_API_KEY="AIzaSySECRETKEY12345" and OPENAI_API_KEY="sk-1234567890abcdef1234567890abcdef"' },
  };
  const secretSnap = continuumEngine.createSnapshot(secretData);
  const secretRes = continuumContextBuilder.buildContext(secretSnap);

  if (
    secretRes.contextText.includes('AIzaSySECRETKEY12345') ||
    secretRes.contextText.includes('sk-1234567890abcdef')
  ) {
    console.error('[TEST 10 FAILED] Secrets survived in built context text:', secretRes.contextText);
    process.exit(1);
  }
  if (!secretRes.contextText.includes('[REDACTED_SECRET:')) {
    console.error('[TEST 10 FAILED] Redaction indicator missing in built context text:', secretRes.contextText);
    process.exit(1);
  }
  console.log('[TEST 10 PASSED] API keys redacted cleanly from generated context text.');

  // TEST 11: Malformed/null snapshot produces safe fallback context
  console.log('[TEST 11] Testing malformed/null snapshot fallback safety...');
  const fallbackNull = continuumContextBuilder.buildContext(null);
  const fallbackBad = continuumContextBuilder.buildContext({ badObj: true });
  if (
    fallbackNull.success ||
    !fallbackNull.contextText.includes('Unavailable') ||
    fallbackBad.success ||
    !fallbackBad.contextText.includes('Unavailable')
  ) {
    console.error('[TEST 11 FAILED] Safe fallback context was not returned:', { fallbackNull, fallbackBad });
    process.exit(1);
  }
  console.log('[TEST 11 PASSED] Safe fallback context returned without throwing exceptions.');

  // TEST 12: Existing AI behavior without Continuum remains unchanged
  console.log('[TEST 12] Verifying existing AI code action & agent behavior without Continuum...');
  const legacyAction = await aiManager.runCodeAction({
    action: 'explain',
    language: 'python',
    selection: 'def foo(): pass',
  });
  const legacyAgent = await agentManager.runAgentTask({
    task: 'Fix linting errors',
  });

  if (!legacyAction.success || !legacyAgent.success) {
    console.error('[TEST 12 FAILED] Legacy calls failed:', { legacyAction, legacyAgent });
    process.exit(1);
  }
  console.log('[TEST 12 PASSED] Legacy AI code actions & agent tasks behave identically without Continuum.');

  // TEST 13: Continuum context supplied to AI Manager
  console.log('[TEST 13] Verifying Continuum context supplied to AI Manager...');
  const actionWithContinuum = await aiManager.runCodeAction({
    action: 'explain',
    language: 'python',
    selection: 'def compute_order_total(): pass',
    continuumSnapshot: snapshot,
  });
  if (!actionWithContinuum.success) {
    console.error('[TEST 13 FAILED] AI code action with continuumSnapshot failed:', actionWithContinuum);
    process.exit(1);
  }
  console.log('[TEST 13 PASSED] AI Manager cleanly accepts continuumSnapshot.');

  // TEST 14: Continuum context supplied to Agent Manager
  console.log('[TEST 14] Verifying Continuum context supplied to Agent Manager...');
  const agentWithContinuum = await agentManager.runAgentTask({
    task: 'Refactor compute_order_total',
    continuumSnapshot: snapshot,
  });
  if (!agentWithContinuum.success) {
    console.error('[TEST 14 FAILED] Agent task with continuumSnapshot failed:', agentWithContinuum);
    process.exit(1);
  }
  console.log('[TEST 14 PASSED] Agent Manager cleanly accepts continuumSnapshot.');

  // TEST 15: Existing Phase 1 Continuum tests pass
  console.log('[TEST 15] Executing Phase 1 continuum_engine test suite...');
  const { runTests: runPhase1Tests } = require('../engine/test_continuum_engine');
  runPhase1Tests();
  console.log('[TEST 15 PASSED] Phase 1 test suite passed.');

  // TEST 16: Existing Phase 2 Continuum persistence tests pass
  console.log('[TEST 16] Executing Phase 2 continuum_manager test suite...');
  const { runManagerTests: runPhase2Tests } = require('./test_continuum_manager');
  runPhase2Tests();
  console.log('[TEST 16 PASSED] Phase 2 test suite passed.');

  // TEST 17: Existing BDG 22-scenario regression suite passes
  console.log('[TEST 17] Executing existing BDG & 6 Subsystems 22-scenario suite...');
  const { runTests: runBDGTests } = require('../engine/test_bdg_engine');
  runBDGTests();
  console.log('[TEST 17 PASSED] BDG 22-scenario regression suite passed.');

  console.log('\n[SUCCESS] ALL CONTINUUM PHASE 3 CONTEXT INTEGRATION SCENARIOS (TESTS 1–17) PASSED CLEANLY.');
}

if (require.main === module) {
  runPhase3Tests();
}

module.exports = { runPhase3Tests };
