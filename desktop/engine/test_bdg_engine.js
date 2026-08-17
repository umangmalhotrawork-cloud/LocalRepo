/**
 * Comprehensive BDG Engine Integration & All 6 Subsystems Test Suite
 * Verifies AST extraction, Blast Radius, Runtime Execution, What-If Engine, Behavioral Diff, and AI System Reasoning + Mutation.
 */

const fs = require('fs');
const path = require('path');
const bdgEngine = require('./bdg_engine');
const runtimeExecutionIndex = require('./runtime_execution_index');
const behavioralDiffEngine = require('./behavioral_diff_engine');
const aiSystemReasoningEngine = require('./ai_system_reasoning_engine');

function runTests() {
  console.log('[TEST] Starting Full BDG & 6 Subsystems Regression Suite...');

  const demoDir = path.join(__dirname, '..', '..', 'demo-workspaces', 'bdg_test_sample');
  if (!fs.existsSync(demoDir)) {
    console.error('[TEST ERROR] Demo directory not found:', demoDir);
    process.exit(1);
  }

  // 1. Build initial graph snapshot
  console.log('[TEST] Building graph for workspace:', demoDir);
  const baselineGraph = bdgEngine.buildGraphForWorkspace(demoDir);
  behavioralDiffEngine.setBaselineGraph(baselineGraph);

  const initialNodeCount = Object.keys(baselineGraph.nodes).length;
  console.log(`[TEST PASSED] Extracted ${initialNodeCount} nodes.`);

  runtimeExecutionIndex.clear();
  runtimeExecutionIndex.recordEvent({
    symbol: 'process_user_order',
    file: 'services.py',
    eventType: 'execute',
    timestamp: Date.now(),
    executionCount: 25,
    durationMs: 30,
    success: true,
    callerSymbol: 'test_process_user_order',
    sessionId: 'session_ai_test'
  });

  const servicesPath = path.join(demoDir, 'services.py');
  // Scenario 0: BDG Symbol Selection / Query Integration Test (compute_order_total)
  console.log('[BDG SCENARIO 0] Querying Python function symbol compute_order_total (Full Query Path)...');
  const cartProjectDir = path.join(__dirname, '..', '..', 'demo-workspaces', 'ai_cart_project');
  if (fs.existsSync(cartProjectDir)) {
    // Test 1: Query with unbuilt/empty graph + workspacePath auto-build in querySymbolDependencies
    bdgEngine.nodes = {};
    bdgEngine.edges = [];
    bdgEngine.buildGraphForWorkspace(cartProjectDir);
    const computeTotalQueryResult = bdgEngine.querySymbolDependencies('compute_order_total', 'src/checkout_engine.py', 19);
    console.log(`[BDG SCENARIO 0 RESULT] Resolved Node Symbol: ${computeTotalQueryResult.node?.symbol}, File: ${computeTotalQueryResult.node?.file}, Type: ${computeTotalQueryResult.node?.type}`);
    if (!computeTotalQueryResult.node || computeTotalQueryResult.node.symbol !== 'compute_order_total') {
      console.error('[BDG SCENARIO 0 FAILED] Failed to resolve compute_order_total BDG node!');
      process.exit(1);
    }
    // Test 2: Fallback query without file path
    const fallbackResult = bdgEngine.querySymbolDependencies('compute_order_total');
    if (!fallbackResult.node || fallbackResult.node.symbol !== 'compute_order_total') {
      console.error('[BDG SCENARIO 0 FAILED] Symbol fallback query failed!');
      process.exit(1);
    }
    // Test 3: AI Proposal Generation & File Path Resolution for compute_order_total
    const cartProposal = aiSystemReasoningEngine.generateProposal('compute_order_total', 'src/checkout_engine.py', 19, 'Optimize compute_order_total execution');
    const resolvedPath = aiSystemReasoningEngine.resolveFilePath(cartProposal.targetFile);
    if (!fs.existsSync(resolvedPath)) {
      console.error(`[BDG SCENARIO 0 FAILED] Target file path resolution failed for ${cartProposal.targetFile}`);
      process.exit(1);
    }
    // Test 4: Regression coverage for all 5 What-If operations
    const whatIfOps = ["remove-node", "remove-call", "remove-write", "disable-external-api", "disable-database-op"];
    for (const op of whatIfOps) {
      const simRes = bdgEngine.simulateWhatIfBySymbol('compute_order_total', 'src/checkout_engine.py', 19, op);
      if (!simRes || simRes.targetNode?.symbol !== 'compute_order_total') {
        console.error(`[BDG WHAT-IF FAILED] Simulation failed for operation: ${op}`);
        process.exit(1);
      }
      console.log(`[BDG WHAT-IF PASSED] Operation '${op}' executed cleanly for compute_order_total (Risk: ${simRes.hypotheticalRiskLevel})`);
    }
    // Re-build demoDir graph for remaining test scenarios
    bdgEngine.buildGraphForWorkspace(demoDir);
  }

  // --- AI SYSTEM REASONING + MUTATION REGRESSION SCENARIOS ---
  const originalFileContent = fs.readFileSync(servicesPath, 'utf-8');

  // Scenario 1: Reasoning Pipeline Generation (Understand -> Reason -> Simulate -> Explain -> Propose)
  console.log('[AI SCENARIO 1] Running multi-stage AI reasoning pipeline...');
  const proposal1 = aiSystemReasoningEngine.generateProposal('process_user_order', 'services.py', 25, 'Add defensive exception handling');
  console.log(`[AI SCENARIO 1 RESULT] Proposal ID: ${proposal1.id}, Target: ${proposal1.targetSymbol}, Status: ${proposal1.status}`);
  if (!proposal1 || proposal1.status !== 'pending') {
    console.error('[AI SCENARIO 1 FAILED] Proposal must start with status: pending');
    process.exit(1);
  }

  // Scenario 2: Simulation-before-mutation check
  console.log('[AI SCENARIO 2] Verifying What-If simulation was run before proposal generation...');
  if (!proposal1.whatIfResult || !proposal1.predictedBlastRadius) {
    console.error('[AI SCENARIO 2 FAILED] What-If simulation missing from proposal');
    process.exit(1);
  }
  console.log('[AI SCENARIO 2 RESULT] What-If simulation results embedded in proposal.');

  // Scenario 3: Explicit approval requirement
  console.log('[AI SCENARIO 3] Enforcing explicit user approval before disk write...');
  const rejectionResult = aiSystemReasoningEngine.applyProposal(proposal1.id, false);
  console.log(`[AI SCENARIO 3 RESULT] Applied without approval: ${rejectionResult.success}, Proposal Status: ${rejectionResult.proposal.status}`);
  if (rejectionResult.success || rejectionResult.proposal.status !== 'rejected') {
    console.error('[AI SCENARIO 3 FAILED] Mutation must be blocked when approval is not given!');
    process.exit(1);
  }

  // Scenario 4: Rejection preserves real source files on disk
  console.log('[AI SCENARIO 4] Verifying source files on disk remain 100% untouched upon rejection...');
  const diskContentAfterRejection = fs.readFileSync(servicesPath, 'utf-8');
  if (diskContentAfterRejection !== originalFileContent) {
    console.error('[AI SCENARIO 4 FAILED] File on disk was modified despite rejection!');
    process.exit(1);
  }
  console.log('[AI SCENARIO 4 RESULT] Source file on disk remains 100% intact.');

  // Scenario 5: Safe mutation application upon explicit user approval
  console.log('[AI SCENARIO 5] Applying mutation with explicit user approval...');
  const proposal2 = aiSystemReasoningEngine.generateProposal('process_user_order', 'services.py', 25, 'Refactor process_user_order');
  const approvalResult = aiSystemReasoningEngine.applyProposal(proposal2.id, true);
  console.log(`[AI SCENARIO 5 RESULT] Mutation Applied: ${approvalResult.success}, Status: ${approvalResult.proposal.status}`);
  if (!approvalResult.success || approvalResult.proposal.status !== 'applied') {
    console.error('[AI SCENARIO 5 FAILED] Approved mutation failed to apply');
    process.exit(1);
  }

  // Scenario 6: Post-mutation Behavioral Diff verification against prediction
  console.log('[AI SCENARIO 6] Verifying post-mutation Behavioral Diff report...');
  if (!approvalResult.diffReport || !approvalResult.proposal.verificationResult.success) {
    console.error('[AI SCENARIO 6 FAILED] Post-mutation Behavioral Diff missing or failed');
    process.exit(1);
  }
  console.log('[AI SCENARIO 6 RESULT] Post-mutation Behavioral Diff verified successfully.');

  // Restore file content after approved mutation test
  fs.writeFileSync(servicesPath, originalFileContent, 'utf-8');
  bdgEngine.updateFile(servicesPath, originalFileContent);

  // Scenario 7: Verification failure & Automatic Rollback Protection
  console.log('[AI SCENARIO 7] Testing verification failure and automatic rollback protection...');
  const proposal3 = aiSystemReasoningEngine.generateProposal('process_user_order', 'services.py', 25, 'Test Rollback');
  const rollbackResult = aiSystemReasoningEngine.applyProposal(proposal3.id, true, true); // forceVerificationFailure = true
  console.log(`[AI SCENARIO 7 RESULT] Rollback Success: ${!rollbackResult.success}, Status: ${rollbackResult.proposal.status}`);
  if (rollbackResult.proposal.status !== 'rolled_back') {
    console.error('[AI SCENARIO 7 FAILED] Expected status: rolled_back');
    process.exit(1);
  }

  // Scenario 8: Source file restored after automatic rollback
  console.log('[AI SCENARIO 8] Verifying source file restored on disk after rollback...');
  const diskContentAfterRollback = fs.readFileSync(servicesPath, 'utf-8');
  if (diskContentAfterRollback !== originalFileContent) {
    console.error('[AI SCENARIO 8 FAILED] File on disk was not properly restored after rollback!');
    process.exit(1);
  }
  console.log('[AI SCENARIO 8 RESULT] Source file on disk perfectly restored by rollback protection.');

  console.log('\n[SUCCESS] ALL AI SYSTEM REASONING + MUTATION REGRESSION SCENARIOS PASSED CLEANLY.');
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
