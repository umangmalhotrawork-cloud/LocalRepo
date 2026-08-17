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
    // Test 5: Multi-File Impact Analysis (compute_order_total)
    console.log('[MULTI-FILE IMPACT] Testing multi-file impact analysis for compute_order_total...');
    const multiImpact = bdgEngine.analyzeMultiFileImpact('compute_order_total', 'src/checkout_engine.py', 19);
    console.log(`[MULTI-FILE IMPACT RESULT] Target: ${multiImpact.targetSymbol}, Affected Files: ${multiImpact.affectedFiles.length}, Risk: ${multiImpact.riskLevel}`);
    if (!multiImpact || !multiImpact.targetNode || multiImpact.affectedFiles.length === 0) {
      console.error('[MULTI-FILE IMPACT FAILED] Failed multi-file impact analysis for compute_order_total');
      process.exit(1);
    }
    // Verify direct vs indirect callers & callees
    if (multiImpact.callers.direct.length === 0 && multiImpact.callees.direct.length === 0) {
      console.error('[MULTI-FILE IMPACT FAILED] Target compute_order_total must have direct callers or callees');
      process.exit(1);
    }
    // Test 6: Multi-File Impact Analysis for isolated symbol
    const isolatedImpact = bdgEngine.analyzeMultiFileImpact('non_existent_isolated_symbol');
    if (isolatedImpact.riskLevel !== 'LOW') {
      console.error('[MULTI-FILE IMPACT FAILED] Non-existent symbol must be classified as LOW risk');
      process.exit(1);
    }
    // Test 7: Sequential query symbol switches (compute_order_total -> process_checkout -> compute_order_total)
    const switch1 = bdgEngine.analyzeMultiFileImpact('compute_order_total', 'src/checkout_engine.py', 19);
    if (switch1.targetSymbol !== 'compute_order_total') {
      console.error('[MULTI-FILE IMPACT FAILED] Target symbol must match compute_order_total');
      process.exit(1);
    }
    const switch2 = bdgEngine.analyzeMultiFileImpact('process_checkout', 'src/checkout_engine.py', 10);
    if (switch2.targetSymbol !== 'process_checkout') {
      console.error('[MULTI-FILE IMPACT FAILED] Target symbol must match process_checkout');
      process.exit(1);
    }
    const switch3 = bdgEngine.analyzeMultiFileImpact('compute_order_total', 'src/checkout_engine.py', 19);
    if (switch3.targetSymbol !== 'compute_order_total') {
      console.error('[MULTI-FILE IMPACT FAILED] Target symbol must switch back to compute_order_total');
      process.exit(1);
    }
    console.log('[MULTI-FILE IMPACT PASSED] Sequential query symbol switches verified successfully.');

    // Test 8: Non-existent symbol resolution test (xyz_completely_nonexistent_987654)
    console.log('[NON-EXISTENT SYMBOL TEST] Testing query for non-existent symbol xyz_completely_nonexistent_987654 with active editor line 8...');
    const nonexistentQuery = bdgEngine.querySymbolDependencies('xyz_completely_nonexistent_987654', 'src/checkout_engine.py', 8);
    console.log(`[NON-EXISTENT SYMBOL RESULT] Resolved Node: ${nonexistentQuery.node ? nonexistentQuery.node.symbol : 'null'}`);
    if (nonexistentQuery.node !== null) {
      console.error(`[NON-EXISTENT SYMBOL FAILED] Non-existent symbol resolved to ${nonexistentQuery.node.symbol} (${nonexistentQuery.node.id}) instead of null!`);
      process.exit(1);
    }

    const nonexistentBlast = bdgEngine.calculateBlastRadiusBySymbol('xyz_completely_nonexistent_987654', 'src/checkout_engine.py', 8);
    if (nonexistentBlast.targetNode !== null) {
      console.error(`[NON-EXISTENT SYMBOL FAILED] Blast radius for non-existent symbol resolved to ${nonexistentBlast.targetNode.symbol} instead of null!`);
      process.exit(1);
    }

    const nonexistentImpact = bdgEngine.analyzeMultiFileImpact('xyz_completely_nonexistent_987654', 'src/checkout_engine.py', 8);
    if (nonexistentImpact.targetNode !== null) {
      console.error(`[NON-EXISTENT SYMBOL FAILED] Impact analysis for non-existent symbol resolved to ${nonexistentImpact.targetNode.symbol} instead of null!`);
      process.exit(1);
    }

    // Verify valid symbols still resolve correctly
    const validCheck1 = bdgEngine.querySymbolDependencies('compute_order_total', 'src/checkout_engine.py', 8);
    if (!validCheck1.node || validCheck1.node.symbol !== 'compute_order_total') {
      console.error('[NON-EXISTENT SYMBOL FAILED] Valid symbol compute_order_total failed to resolve!');
      process.exit(1);
    }
    const validCheck2 = bdgEngine.querySymbolDependencies('process_checkout', 'src/checkout_engine.py', 19);
    if (!validCheck2.node || validCheck2.node.symbol !== 'process_checkout') {
      console.error('[NON-EXISTENT SYMBOL FAILED] Valid symbol process_checkout failed to resolve!');
      process.exit(1);
    }
    console.log('[NON-EXISTENT SYMBOL PASSED] Non-existent symbol correctly returns null and valid symbols resolve cleanly.');

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

  // --- RUNTIME EVIDENCE CORRELATION REGRESSION SCENARIOS ---

  // Rebuild ai_cart_project graph for evidence correlation tests
  bdgEngine.buildGraphForWorkspace(cartProjectDir);
  runtimeExecutionIndex.clear();

  // Record runtime events for some compute_order_total dependencies
  runtimeExecutionIndex.recordEvent({
    symbol: 'compute_order_total', file: 'src/checkout_engine.py',
    eventType: 'execute', timestamp: Date.now(),
    executionCount: 25, durationMs: 12, success: true,
    callerSymbol: 'test_compute_order_total',
    sessionId: 'session_evidence_test', sessionType: 'test_run'
  });
  runtimeExecutionIndex.recordEvent({
    symbol: 'total', file: 'src/checkout_engine.py',
    eventType: 'execute', timestamp: Date.now(),
    executionCount: 10, success: true,
    callerSymbol: 'compute_order_total',
    sessionId: 'session_evidence_test', sessionType: 'test_run'
  });
  runtimeExecutionIndex.recordEvent({
    symbol: 'items', file: 'src/checkout_engine.py',
    eventType: 'execute', timestamp: Date.now(),
    executionCount: 8, success: true,
    callerSymbol: 'compute_order_total',
    sessionId: 'session_evidence_test', sessionType: 'test_run'
  });

  // Test 9: Runtime Evidence Correlation — Basic Classification
  console.log('[EVIDENCE SCENARIO 9] Testing runtime evidence correlation for compute_order_total...');
  const evidence = runtimeExecutionIndex.correlateRuntimeEvidence('compute_order_total', 'src/checkout_engine.py', 19);
  console.log(`[EVIDENCE SCENARIO 9 RESULT] Target: ${evidence.targetSymbol}, Total: ${evidence.summary.totalDependencies}, Confirmed: ${evidence.summary.confirmedCount}, Static-Only: ${evidence.summary.staticOnlyCount}, Runtime-Only: ${evidence.summary.runtimeOnlyCount}`);

  if (evidence.targetSymbol !== 'compute_order_total') {
    console.error('[EVIDENCE SCENARIO 9 FAILED] Target symbol must be compute_order_total');
    process.exit(1);
  }
  if (evidence.correlatedDependencies.length === 0) {
    console.error('[EVIDENCE SCENARIO 9 FAILED] Must have at least one correlated dependency');
    process.exit(1);
  }
  if (evidence.summary.totalDependencies === 0) {
    console.error('[EVIDENCE SCENARIO 9 FAILED] Total dependencies must be > 0');
    process.exit(1);
  }
  // Verify at least one CONFIRMED dependency
  const confirmedDeps = evidence.correlatedDependencies.filter(d => d.classification === 'CONFIRMED');
  if (confirmedDeps.length === 0) {
    console.error('[EVIDENCE SCENARIO 9 FAILED] Must have at least one CONFIRMED dependency (total/items were observed)');
    process.exit(1);
  }
  // Verify confidence scores are in [0,1]
  for (const dep of evidence.correlatedDependencies) {
    if (dep.confidenceScore < 0 || dep.confidenceScore > 1) {
      console.error(`[EVIDENCE SCENARIO 9 FAILED] Confidence score ${dep.confidenceScore} out of range for ${dep.node?.symbol}`);
      process.exit(1);
    }
  }
  // Verify overall confidence is in [0,1]
  if (evidence.summary.overallConfidence < 0 || evidence.summary.overallConfidence > 1) {
    console.error('[EVIDENCE SCENARIO 9 FAILED] Overall confidence out of range');
    process.exit(1);
  }
  console.log(`[EVIDENCE SCENARIO 9 PASSED] Evidence correlation verified: ${confirmedDeps.length} CONFIRMED, confidence ${evidence.summary.overallConfidence}`);

  // Test 10: Sequential Symbol Switch Clears Evidence Report
  console.log('[EVIDENCE SCENARIO 10] Testing sequential symbol switch for evidence correlation...');
  const ev1 = runtimeExecutionIndex.correlateRuntimeEvidence('compute_order_total', 'src/checkout_engine.py', 19);
  if (ev1.targetSymbol !== 'compute_order_total') {
    console.error('[EVIDENCE SCENARIO 10 FAILED] First query target must be compute_order_total');
    process.exit(1);
  }
  const ev2 = runtimeExecutionIndex.correlateRuntimeEvidence('process_checkout', 'src/checkout_engine.py', 1);
  if (ev2.targetSymbol !== 'process_checkout') {
    console.error('[EVIDENCE SCENARIO 10 FAILED] Second query target must be process_checkout');
    process.exit(1);
  }
  if (ev2.targetSymbol === ev1.targetSymbol) {
    console.error('[EVIDENCE SCENARIO 10 FAILED] Evidence report must not be stale after symbol switch');
    process.exit(1);
  }
  console.log('[EVIDENCE SCENARIO 10 PASSED] Sequential symbol switch produces distinct evidence reports.');

  // Test 11: Non-Existent Symbol Returns Empty Evidence Report
  console.log('[EVIDENCE SCENARIO 11] Testing non-existent symbol evidence correlation...');
  const evNone = runtimeExecutionIndex.correlateRuntimeEvidence('nonexistent_symbol_xyz_12345');
  if (evNone.targetNode !== null) {
    console.error('[EVIDENCE SCENARIO 11 FAILED] Non-existent symbol must return null targetNode');
    process.exit(1);
  }
  if (evNone.correlatedDependencies.length !== 0) {
    console.error('[EVIDENCE SCENARIO 11 FAILED] Non-existent symbol must have 0 correlated dependencies');
    process.exit(1);
  }
  if (evNone.summary.totalDependencies !== 0) {
    console.error('[EVIDENCE SCENARIO 11 FAILED] Non-existent symbol must have 0 total dependencies');
    process.exit(1);
  }
  if (evNone.riskLevel !== 'LOW') {
    console.error('[EVIDENCE SCENARIO 11 FAILED] Non-existent symbol must be LOW risk');
    process.exit(1);
  }
  console.log('[EVIDENCE SCENARIO 11 PASSED] Non-existent symbol returns empty evidence report.');

  // --- CROSS-FEATURE TARGET CONSISTENCY REGRESSION TESTS (13A–13E) ---

  // TEST 13A: Substring symbol disambiguation (checkout vs process_checkout in same file)
  console.log('[CONSISTENCY 13A] Testing substring symbol disambiguation (checkout vs process_checkout in checkout.py)...');
  bdgEngine.nodes = {
    'fn_process_checkout': { id: 'fn_process_checkout', symbol: 'process_checkout', file: 'src/checkout.py', location: { line: 1 }, type: 'function', language: 'python' },
    'fn_checkout': { id: 'fn_checkout', symbol: 'checkout', file: 'src/checkout.py', location: { line: 20 }, type: 'function', language: 'python' },
  };

  const qCheckout = bdgEngine.querySymbolDependencies('checkout', 'src/checkout.py', 20);
  const bCheckout = bdgEngine.calculateBlastRadiusBySymbol('checkout', 'src/checkout.py', 20);
  const iCheckout = bdgEngine.analyzeMultiFileImpact('checkout', 'src/checkout.py', 20);
  const wCheckout = bdgEngine.simulateWhatIfBySymbol('checkout', 'src/checkout.py', 20, 'remove-node');

  if (qCheckout.node?.id !== 'fn_checkout') {
    console.error(`[CONSISTENCY 13A FAILED] querySymbolDependencies resolved to ${qCheckout.node?.id} instead of fn_checkout`);
    process.exit(1);
  }
  if (bCheckout.targetNode?.id !== 'fn_checkout') {
    console.error(`[CONSISTENCY 13A FAILED] calculateBlastRadiusBySymbol resolved to ${bCheckout.targetNode?.id} instead of fn_checkout`);
    process.exit(1);
  }
  if (iCheckout.targetNode?.id !== 'fn_checkout') {
    console.error(`[CONSISTENCY 13A FAILED] analyzeMultiFileImpact resolved to ${iCheckout.targetNode?.id} instead of fn_checkout`);
    process.exit(1);
  }
  if (wCheckout.targetNode?.id !== 'fn_checkout') {
    console.error(`[CONSISTENCY 13A FAILED] simulateWhatIfBySymbol resolved to ${wCheckout.targetNode?.id} instead of fn_checkout`);
    process.exit(1);
  }
  if (qCheckout.node?.id === 'fn_process_checkout' || bCheckout.targetNode?.id === 'fn_process_checkout' ||
      iCheckout.targetNode?.id === 'fn_process_checkout' || wCheckout.targetNode?.id === 'fn_process_checkout') {
    console.error('[CONSISTENCY 13A FAILED] Substring query for checkout incorrectly resolved to process_checkout!');
    process.exit(1);
  }

  const qProc = bdgEngine.querySymbolDependencies('process_checkout', 'src/checkout.py', 1);
  const bProc = bdgEngine.calculateBlastRadiusBySymbol('process_checkout', 'src/checkout.py', 1);
  if (qProc.node?.id !== 'fn_process_checkout' || bProc.targetNode?.id !== 'fn_process_checkout') {
    console.error('[CONSISTENCY 13A FAILED] process_checkout failed to resolve to fn_process_checkout');
    process.exit(1);
  }
  console.log('[CONSISTENCY 13A PASSED] Substring disambiguation verified across all 4 engine methods.');

  // TEST 13B: AI reasoning non-existent target check
  console.log('[CONSISTENCY 13B] Testing AI reasoning proposal generation for non-existent target...');
  const firstNode = Object.values(bdgEngine.nodes)[0];
  const aiErrProp = aiSystemReasoningEngine.generateProposal('xyz_nonexistent_999', 'src/checkout.py', 1);
  if (aiErrProp.targetSymbol === firstNode.symbol && aiErrProp.status !== 'error') {
    console.error('[CONSISTENCY 13B FAILED] generateProposal targeted Object.values(nodes)[0] instead of returning error proposal!');
    process.exit(1);
  }
  if (aiErrProp.status !== 'error') {
    console.error(`[CONSISTENCY 13B FAILED] generateProposal status was ${aiErrProp.status} instead of error!`);
    process.exit(1);
  }
  if (!aiErrProp.problemSummary.includes('Target symbol not found')) {
    console.error('[CONSISTENCY 13B FAILED] generateProposal problemSummary missing expected error text!');
    process.exit(1);
  }
  console.log('[CONSISTENCY 13B PASSED] AI reasoning returns explicit error proposal without targeting arbitrary nodes.');

  // TEST 13C: Cursor independence
  console.log('[CONSISTENCY 13C] Testing cursor independence for explicit symbol queries...');
  for (const testLine of [1, 8, 19, 35, 100]) {
    const qCursor = bdgEngine.querySymbolDependencies('checkout', 'src/checkout.py', testLine);
    if (qCursor.node?.id !== 'fn_checkout') {
      console.error(`[CONSISTENCY 13C FAILED] Cursor line ${testLine} caused checkout to resolve to ${qCursor.node?.id}`);
      process.exit(1);
    }
  }
  console.log('[CONSISTENCY 13C PASSED] Explicit symbol resolution is 100% independent of cursor line.');

  // TEST 13D: Existing valid symbols reconfirmation
  console.log('[CONSISTENCY 13D] Reconfirming compute_order_total and process_checkout in ai_cart_project...');
  bdgEngine.buildGraphForWorkspace(cartProjectDir);
  const qValid1 = bdgEngine.querySymbolDependencies('compute_order_total', 'src/checkout_engine.py', 19);
  const qValid2 = bdgEngine.querySymbolDependencies('process_checkout', 'src/checkout_engine.py', 1);
  if (qValid1.node?.symbol !== 'compute_order_total' || qValid2.node?.symbol !== 'process_checkout') {
    console.error('[CONSISTENCY 13D FAILED] Valid symbols failed reconfirmation!');
    process.exit(1);
  }
  console.log('[CONSISTENCY 13D PASSED] compute_order_total and process_checkout resolve correctly.');

  // TEST 13E: Existing non-existent symbol safety reconfirmation
  console.log('[CONSISTENCY 13E] Reconfirming xyz_completely_nonexistent_987654 returns null target across all BDG systems...');
  const qNon = bdgEngine.querySymbolDependencies('xyz_completely_nonexistent_987654', 'src/checkout_engine.py', 8);
  const bNon = bdgEngine.calculateBlastRadiusBySymbol('xyz_completely_nonexistent_987654', 'src/checkout_engine.py', 8);
  const iNon = bdgEngine.analyzeMultiFileImpact('xyz_completely_nonexistent_987654', 'src/checkout_engine.py', 8);
  const wNon = bdgEngine.simulateWhatIfBySymbol('xyz_completely_nonexistent_987654', 'src/checkout_engine.py', 8, 'remove-node');
  if (qNon.node !== null || bNon.targetNode !== null || iNon.targetNode !== null || wNon.targetNode !== null) {
    console.error('[CONSISTENCY 13E FAILED] Nonexistent symbol returned a non-null target!');
    process.exit(1);
  }
  console.log('[CONSISTENCY 13E PASSED] Nonexistent symbol cleanly returns null target across all systems.');

  // --- CANONICAL TARGET IDENTITY & PASS-THROUGH TESTS (14A–14F) ---

  // TEST 14A: Canonical Target Consistency for compute_order_total
  console.log('[CANONICAL 14A] Testing canonical targetNodeId pass-through for compute_order_total...');
  bdgEngine.buildGraphForWorkspace(cartProjectDir);
  const res14A = bdgEngine.querySymbolDependencies('compute_order_total', 'src/checkout_engine.py', 19);
  const targetId14A = res14A.node.id;
  const blast14A = bdgEngine.calculateBlastRadiusBySymbol('compute_order_total', 'src/checkout_engine.py', 19, targetId14A);
  const impact14A = bdgEngine.analyzeMultiFileImpact('compute_order_total', 'src/checkout_engine.py', 19, targetId14A);
  const whatif14A = bdgEngine.simulateWhatIfBySymbol('compute_order_total', 'src/checkout_engine.py', 19, 'remove-node', undefined, targetId14A);
  const evidence14A = runtimeExecutionIndex.correlateRuntimeEvidence('compute_order_total', 'src/checkout_engine.py', 19, targetId14A);
  const prop14A = aiSystemReasoningEngine.generateProposal('compute_order_total', 'src/checkout_engine.py', 19, 'test', targetId14A);

  if (blast14A.targetNode?.id !== targetId14A ||
      impact14A.targetNode?.id !== targetId14A ||
      whatif14A.targetNode?.id !== targetId14A ||
      evidence14A.targetNode?.id !== targetId14A ||
      prop14A.targetSymbol !== 'compute_order_total') {
    console.error('[CANONICAL 14A FAILED] Downstream systems resolved different target IDs when passed canonical targetNodeId!');
    process.exit(1);
  }
  console.log('[CANONICAL 14A PASSED] All 5 downstream systems resolved exact canonical targetNode.id for compute_order_total.');

  // TEST 14B: Canonical Target Consistency for process_checkout
  console.log('[CANONICAL 14B] Testing canonical targetNodeId pass-through for process_checkout...');
  const res14B = bdgEngine.querySymbolDependencies('process_checkout', 'src/checkout_engine.py', 1);
  const targetId14B = res14B.node.id;
  const blast14B = bdgEngine.calculateBlastRadiusBySymbol('process_checkout', 'src/checkout_engine.py', 1, targetId14B);
  const impact14B = bdgEngine.analyzeMultiFileImpact('process_checkout', 'src/checkout_engine.py', 1, targetId14B);
  const whatif14B = bdgEngine.simulateWhatIfBySymbol('process_checkout', 'src/checkout_engine.py', 1, 'remove-node', undefined, targetId14B);
  const evidence14B = runtimeExecutionIndex.correlateRuntimeEvidence('process_checkout', 'src/checkout_engine.py', 1, targetId14B);

  if (blast14B.targetNode?.id !== targetId14B ||
      impact14B.targetNode?.id !== targetId14B ||
      whatif14B.targetNode?.id !== targetId14B ||
      evidence14B.targetNode?.id !== targetId14B) {
    console.error('[CANONICAL 14B FAILED] Downstream systems resolved different target IDs for process_checkout!');
    process.exit(1);
  }
  console.log('[CANONICAL 14B PASSED] All downstream systems resolved exact canonical targetNode.id for process_checkout.');

  // TEST 14C: Substring safety with canonical ID
  console.log('[CANONICAL 14C] Testing canonical targetNodeId substring safety (checkout vs process_checkout)...');
  bdgEngine.nodes = {
    'fn_process_checkout': { id: 'fn_process_checkout', symbol: 'process_checkout', file: 'src/checkout.py', location: { line: 1 }, type: 'function', language: 'python' },
    'fn_checkout': { id: 'fn_checkout', symbol: 'checkout', file: 'src/checkout.py', location: { line: 20 }, type: 'function', language: 'python' },
  };
  const blast14C = bdgEngine.calculateBlastRadiusBySymbol('checkout', 'src/checkout.py', 20, 'fn_checkout');
  const impact14C = bdgEngine.analyzeMultiFileImpact('checkout', 'src/checkout.py', 20, 'fn_checkout');
  const whatif14C = bdgEngine.simulateWhatIfBySymbol('checkout', 'src/checkout.py', 20, 'remove-node', undefined, 'fn_checkout');
  const prop14C = aiSystemReasoningEngine.generateProposal('checkout', 'src/checkout.py', 20, 'test', 'fn_checkout');

  if (blast14C.targetNode?.id !== 'fn_checkout' ||
      impact14C.targetNode?.id !== 'fn_checkout' ||
      whatif14C.targetNode?.id !== 'fn_checkout' ||
      prop14C.targetSymbol !== 'checkout') {
    console.error('[CANONICAL 14C FAILED] Canonical ID fn_checkout resolved to wrong node!');
    process.exit(1);
  }
  if (blast14C.targetNode?.id === 'fn_process_checkout' || impact14C.targetNode?.id === 'fn_process_checkout') {
    console.error('[CANONICAL 14C FAILED] Canonical ID fn_checkout incorrectly resolved to fn_process_checkout!');
    process.exit(1);
  }
  console.log('[CANONICAL 14C PASSED] Canonical targetNodeId guarantees zero substring drift.');

  // TEST 14D: Nonexistent target ID handling
  console.log('[CANONICAL 14D] Testing nonexistent targetNodeId handling...');
  const blast14D = bdgEngine.calculateBlastRadiusBySymbol('unknown', 'src/checkout.py', 1, 'nonexistent::node::id');
  const impact14D = bdgEngine.analyzeMultiFileImpact('unknown', 'src/checkout.py', 1, 'nonexistent::node::id');
  const whatif14D = bdgEngine.simulateWhatIfBySymbol('unknown', 'src/checkout.py', 1, 'remove-node', undefined, 'nonexistent::node::id');
  const evidence14D = runtimeExecutionIndex.correlateRuntimeEvidence('unknown', 'src/checkout.py', 1, 'nonexistent::node::id');
  const prop14D = aiSystemReasoningEngine.generateProposal('unknown', 'src/checkout.py', 1, 'test', 'nonexistent::node::id');

  if (blast14D.targetNode !== null || impact14D.targetNode !== null || whatif14D.targetNode !== null || evidence14D.targetNode !== null) {
    console.error('[CANONICAL 14D FAILED] Nonexistent targetNodeId produced a non-null target!');
    process.exit(1);
  }
  if (prop14D.status !== 'error') {
    console.error('[CANONICAL 14D FAILED] Nonexistent targetNodeId in generateProposal did not return error status!');
    process.exit(1);
  }
  console.log('[CANONICAL 14D PASSED] Nonexistent targetNodeId produces clean null/error results across all systems.');

  // TEST 14E: Workspace switch safety
  console.log('[CANONICAL 14E] Testing workspace switch safety with targetNodeId...');
  bdgEngine.buildGraphForWorkspace(cartProjectDir);
  const nodeFromCart = Object.keys(bdgEngine.nodes)[0];
  // Rebuild demoDir workspace
  bdgEngine.buildGraphForWorkspace(demoDir);
  // Verify using nodeFromCart in demoDir does not crash or cross-contaminate
  const blast14E = bdgEngine.calculateBlastRadiusBySymbol('test', 'test.py', 1, nodeFromCart);
  if (blast14E.targetNode && blast14E.targetNode.id !== nodeFromCart) {
    console.error('[CANONICAL 14E FAILED] Stale targetNodeId resolved to an arbitrary different node!');
    process.exit(1);
  }
  console.log('[CANONICAL 14E PASSED] Workspace switch with stale targetNodeId handled cleanly without cross-contamination.');

  // TEST 14F: Backwards compatibility without targetNodeId
  console.log('[CANONICAL 14F] Testing backwards compatibility calling methods without targetNodeId...');
  bdgEngine.buildGraphForWorkspace(cartProjectDir);
  const blast14F = bdgEngine.calculateBlastRadiusBySymbol('compute_order_total', 'src/checkout_engine.py', 19);
  const impact14F = bdgEngine.analyzeMultiFileImpact('compute_order_total', 'src/checkout_engine.py', 19);
  const whatif14F = bdgEngine.simulateWhatIfBySymbol('compute_order_total', 'src/checkout_engine.py', 19, 'remove-node');
  const evidence14F = runtimeExecutionIndex.correlateRuntimeEvidence('compute_order_total', 'src/checkout_engine.py', 19);
  const prop14F = aiSystemReasoningEngine.generateProposal('compute_order_total', 'src/checkout_engine.py', 19, 'test');

  if (!blast14F.targetNode || !impact14F.targetNode || !whatif14F.targetNode || !evidence14F.targetNode || prop14F.status === 'error') {
    console.error('[CANONICAL 14F FAILED] Legacy calls without targetNodeId failed to resolve target!');
    process.exit(1);
  }
  console.log('[CANONICAL 14F PASSED] Backwards compatibility for callers without targetNodeId fully verified.');

  // Re-build demoDir graph to leave state clean for future extensions
  bdgEngine.buildGraphForWorkspace(demoDir);

  console.log('\n[SUCCESS] ALL AI SYSTEM REASONING + MUTATION + EVIDENCE CORRELATION + CROSS-FEATURE CONSISTENCY + CANONICAL PASS-THROUGH SCENARIOS PASSED CLEANLY.');
}

if (require.main === module) {
  runTests();
}

module.exports = { runTests };
