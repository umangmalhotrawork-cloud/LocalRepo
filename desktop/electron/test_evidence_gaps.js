/**
 * Evidence Gaps Integration Test Suite — Patch Firewall & do_not_touch Derivation
 * Tests real Patch Firewall decision persistence, explicit do_not_touch derivation from user constraints,
 * refusal to fabricate firewall evidence or treat ordinary file mentions as restrictions,
 * and complete backward compatibility with existing snapshots/capsules.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { continuumEngine } = require('../engine/continuum_engine');
const { continuumCapsuleBuilder, validateCapsule } = require('../engine/continuum_capsule_builder');
const { continuumManager } = require('./continuumManager');
const { agentManager } = require('./agentManager');

// Set isolated test directory for Continuum manager storage
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-evidence-test-'));
process.env.ECHO_CONTINUUM_DIR = tempDir;

async function runEvidenceTests() {
  console.log('[TEST] Starting Internal Evidence Gaps Test Suite...');

  const tempWorkspace = path.resolve(__dirname, '..', '..', 'demo-workspaces', 'ai_cart_project');

  // TEST 1 & 2: Real Patch Firewall decision is persisted and exported to capsule
  console.log('[TEST 1 & 2] Testing Patch Firewall decision persistence and capsule export...');
  const fwDecision = {
    file_path: 'src/checkout_engine.py',
    risk_level: 'AUTO_APPROVE',
    risk_score: 10,
    safe_to_auto_apply: true,
    decision_summary: 'Identity statement removal on line 12 — AUTO_APPROVE',
    timestamp: Date.now(),
    operation_id: 'op_001',
  };

  const snapWithFW = continuumEngine.createSnapshot({
    sessionId: 'session_fw_001',
    project: { workspaceName: 'ai_cart_project', workspacePath: tempWorkspace, workspaceHash: 'a1b2c3d4e5f67890', detectedStack: { primaryLanguage: 'python', frameworks: [], testRunner: null }, bdgGraphSummary: { totalNodes: 0, totalEdges: 0, entryPointFiles: [] } },
    verification: {
      lastTestStatus: 'PASSED',
      failingTestNames: [],
      behavioralDiffSummary: { riskLevel: 'LOW', disconnectedNodesCount: 0, affectedFilesCount: 1 },
      patchFirewallDecisions: [fwDecision],
    },
  });

  const capsuleFW = await continuumCapsuleBuilder.buildCapsule(snapWithFW, tempWorkspace, { exportMode: 'INLINE', createWorkspaceSnapshot: false });
  const valFW = validateCapsule(capsuleFW);
  if (!valFW.valid) {
    console.error('[TEST 1 & 2 FAILED] Capsule validation failed:', valFW.errors);
    process.exit(1);
  }

  const exportedFWDecisions = capsuleFW.verification.patch_firewall_decisions;
  if (!Array.isArray(exportedFWDecisions) || exportedFWDecisions.length !== 1) {
    console.error('[TEST 1 & 2 FAILED] Firewall decision missing in capsule verification:', capsuleFW.verification);
    process.exit(1);
  }
  if (exportedFWDecisions[0].file_path !== 'src/checkout_engine.py' || exportedFWDecisions[0].risk_score !== 10) {
    console.error('[TEST 1 & 2 FAILED] Firewall decision details corrupted:', exportedFWDecisions[0]);
    process.exit(1);
  }
  console.log('[TEST 1 & 2 PASSED] Real Patch Firewall decision persisted and exported to capsule cleanly.');

  // TEST 3: No fabricated firewall decision is created when none exists
  console.log('[TEST 3] Verifying no fabricated firewall decision is created when none exists...');
  const snapNoFW = continuumEngine.createSnapshot({
    sessionId: 'session_nofw_001',
    project: { workspaceName: 'ai_cart_project', workspacePath: tempWorkspace, workspaceHash: 'a1b2c3d4e5f67890', detectedStack: { primaryLanguage: 'python', frameworks: [], testRunner: null }, bdgGraphSummary: { totalNodes: 0, totalEdges: 0, entryPointFiles: [] } },
  });
  const capsuleNoFW = await continuumCapsuleBuilder.buildCapsule(snapNoFW, tempWorkspace, { exportMode: 'INLINE', createWorkspaceSnapshot: false });
  if (capsuleNoFW.verification.patch_firewall_decisions.length !== 0) {
    console.error('[TEST 3 FAILED] Fabricated firewall decision was created:', capsuleNoFW.verification.patch_firewall_decisions);
    process.exit(1);
  }
  console.log('[TEST 3 PASSED] Zero firewall decisions present when no evaluation occurred (no fabrication).');

  // TEST 4: Explicit "do not modify tests/" becomes do_not_touch=["tests/"]
  console.log('[TEST 4] Testing explicit "do not modify tests/" derivation...');
  const snapDoNotTouch = continuumEngine.createSnapshot({
    sessionId: 'session_dnt_001',
    project: { workspaceName: 'ai_cart_project', workspacePath: tempWorkspace, workspaceHash: 'a1b2c3d4e5f67890', detectedStack: { primaryLanguage: 'python', frameworks: [], testRunner: null }, bdgGraphSummary: { totalNodes: 0, totalEdges: 0, entryPointFiles: [] } },
    task: { userGoal: 'Refactor checkout logic without modifying tests/' },
    handoff: { systemInstructionOverride: 'CRITICAL: do not touch src/legacy.py' },
  });
  const capsuleDNT = await continuumCapsuleBuilder.buildCapsule(snapDoNotTouch, tempWorkspace, { exportMode: 'INLINE', createWorkspaceSnapshot: false });
  const dntList = capsuleDNT.handoff_context.do_not_touch;
  if (!dntList.includes('tests/') || !dntList.includes('src/legacy.py')) {
    console.error('[TEST 4 FAILED] do_not_touch derivation failed:', dntList);
    process.exit(1);
  }
  console.log('[TEST 4 PASSED] Explicit negative constraints derived cleanly into do_not_touch:', dntList);

  // TEST 5: Ordinary file mentions do NOT become do_not_touch
  console.log('[TEST 5] Verifying ordinary file mentions do NOT become do_not_touch...');
  const snapOrdinary = continuumEngine.createSnapshot({
    sessionId: 'session_ordinary_001',
    project: { workspaceName: 'ai_cart_project', workspacePath: tempWorkspace, workspaceHash: 'a1b2c3d4e5f67890', detectedStack: { primaryLanguage: 'python', frameworks: [], testRunner: null }, bdgGraphSummary: { totalNodes: 0, totalEdges: 0, entryPointFiles: [] } },
    task: { userGoal: 'Open tests/test_checkout.py and analyze failure in compute_order_total' },
  });
  const capsuleOrdinary = await continuumCapsuleBuilder.buildCapsule(snapOrdinary, tempWorkspace, { exportMode: 'INLINE', createWorkspaceSnapshot: false });
  if (capsuleOrdinary.handoff_context.do_not_touch.length !== 0) {
    console.error('[TEST 5 FAILED] Ordinary file mention was incorrectly treated as do_not_touch:', capsuleOrdinary.handoff_context.do_not_touch);
    process.exit(1);
  }
  console.log('[TEST 5 PASSED] Ordinary file mentions correctly ignored (do_not_touch = []).');

  // TEST 6: Missing constraints produce []
  console.log('[TEST 6] Verifying missing constraints produce empty array []);...');
  const snapEmptyConstraint = continuumEngine.createSnapshot({
    sessionId: 'session_empty_c_001',
    project: { workspaceName: 'ai_cart_project', workspacePath: tempWorkspace, workspaceHash: 'a1b2c3d4e5f67890', detectedStack: { primaryLanguage: 'python', frameworks: [], testRunner: null }, bdgGraphSummary: { totalNodes: 0, totalEdges: 0, entryPointFiles: [] } },
    task: { userGoal: 'Fix typo in README' },
  });
  const capsuleEmptyC = await continuumCapsuleBuilder.buildCapsule(snapEmptyConstraint, tempWorkspace, { exportMode: 'INLINE', createWorkspaceSnapshot: false });
  if (!Array.isArray(capsuleEmptyC.handoff_context.do_not_touch) || capsuleEmptyC.handoff_context.do_not_touch.length !== 0) {
    console.error('[TEST 6 FAILED] Missing constraint did not produce []:', capsuleEmptyC.handoff_context.do_not_touch);
    process.exit(1);
  }
  console.log('[TEST 6 PASSED] Missing constraints cleanly produced empty array [].');

  // TEST 7: Existing snapshots without firewall decisions remain backward compatible
  console.log('[TEST 7] Testing backward compatibility of snapshots without firewall decisions...');
  const valResultNoFW = validateCapsule(capsuleNoFW);
  if (!valResultNoFW.valid) {
    console.error('[TEST 7 FAILED] Backward compatibility validation failed:', valResultNoFW.errors);
    process.exit(1);
  }
  console.log('[TEST 7 PASSED] Snapshots/capsules without firewall decisions remain 100% valid & compatible.');

  // Cleanup temp dir
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}

  console.log('\n[SUCCESS] ALL INTERNAL EVIDENCE GAPS TESTS PASSED CLEANLY.');
}

if (require.main === module) {
  runEvidenceTests();
}

module.exports = { runEvidenceTests };
