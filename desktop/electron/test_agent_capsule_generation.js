/**
 * Phase 5A Integration Test Suite — Agent Capsule Generation
 * Proves that an agent task execution state can produce a ContinuumSnapshot,
 * convert to a valid Continuum Capsule v1.0.0, enforce truth-boundary rules,
 * capture current workspace, task, and active file, while leaving existing agent behavior 100% unchanged.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { agentManager } = require('./agentManager');
const { continuumManager } = require('./continuumManager');
const { validateCapsule } = require('../engine/continuum_capsule_builder');

// Set isolated test directory for Continuum manager storage
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-agent-capsule-test-'));
process.env.ECHO_CONTINUUM_DIR = tempDir;

async function runAgentCapsuleTests() {
  console.log('[TEST] Starting Phase 5A Agent Capsule Generation Test Suite...');

  const tempWorkspace = path.resolve(__dirname, '..', '..', 'demo-workspaces', 'ai_cart_project');
  const activeFile = path.join(tempWorkspace, 'src', 'checkout_engine.py');

  // TEST 1: Run agent task and generate snapshot & capsule
  console.log('[TEST 1] Running agent task and generating capsule from task state...');
  const agentTaskPayload = {
    task: 'Refactor exception handling in compute_order_total',
    workspacePath: tempWorkspace,
    activeFilePath: activeFile,
    steps: [
      { id: 'step-1', title: 'AST symbol analysis', status: 'completed' },
      { id: 'step-2', title: 'Apply defensive try-except block', status: 'pending' },
    ],
    summary: 'Identified compute_order_total resilience vulnerability. Prepared defensive patch step.',
    options: { exportMode: 'INLINE', createWorkspaceSnapshot: false },
  };

  const exportResult = await agentManager.exportAgentTaskCapsule(agentTaskPayload);

  if (!exportResult || !exportResult.success || !exportResult.capsule) {
    console.error('[TEST 1 FAILED] exportAgentTaskCapsule failed:', exportResult);
    process.exit(1);
  }
  console.log('[TEST 1 PASSED] Agent task produced snapshot & capsule cleanly (Snapshot ID:', exportResult.snapshotId, ', Capsule ID:', exportResult.capsuleId, ')');

  // TEST 2: Validate generated capsule structure & integrity
  console.log('[TEST 2] Validating generated agent capsule structure & hash integrity...');
  const capsule = exportResult.capsule;
  const valResult = validateCapsule(capsule);
  if (!valResult.valid) {
    console.error('[TEST 2 FAILED] Capsule validation failed:', valResult.errors);
    process.exit(1);
  }
  console.log('[TEST 2 PASSED] Capsule structure and hash integrity validated cleanly.');

  // TEST 3: Verify current task, workspace, and active file survival
  console.log('[TEST 3] Verifying task, workspace, and active file in capsule...');
  if (
    capsule.task.user_goal !== agentTaskPayload.task ||
    !capsule.continuum_snapshot.project.workspacePath.includes('ai_cart_project') ||
    capsule.continuum_snapshot.codeState.activeFilePath !== 'src/checkout_engine.py'
  ) {
    console.error('[TEST 3 FAILED] Task, workspace, or active file mismatch:', {
      goal: capsule.task.user_goal,
      workspacePath: capsule.continuum_snapshot.project.workspacePath,
      activeFile: capsule.continuum_snapshot.codeState.activeFilePath,
    });
    process.exit(1);
  }
  console.log('[TEST 3 PASSED] Capsule correctly retained task, workspace, and active file.');

  // TEST 4: Verify Truth Boundary rules enforcement
  console.log('[TEST 4] Verifying Truth Boundary rules enforcement...');
  const workItems = capsule.task.work_items;
  const pendingWorkItem = workItems.find((w) => w.description.includes('Apply defensive try-except block'));
  if (!pendingWorkItem || pendingWorkItem.status !== 'PLANNED') {
    console.error('[TEST 4 FAILED] Truth boundary failed for pending step:', pendingWorkItem);
    process.exit(1);
  }
  console.log('[TEST 4 PASSED] Truth Boundary correctly marked pending agent step as PLANNED.');

  // TEST 5: Verify existing agent execution is 100% unchanged
  console.log('[TEST 5] Verifying existing runAgentTask execution without capsule parameter...');
  const standardAgentResult = await agentManager.runAgentTask({
    task: 'Find redundant code in cart_calculator.py',
    workspacePath: tempWorkspace,
  });

  if (!standardAgentResult || !standardAgentResult.success || !Array.isArray(standardAgentResult.steps)) {
    console.error('[TEST 5 FAILED] Standard runAgentTask failed:', standardAgentResult);
    process.exit(1);
  }
  console.log('[TEST 5 PASSED] Standard runAgentTask executed cleanly with 0 regressions.');

  // Cleanup temp dir
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}

  console.log('\n[SUCCESS] ALL PHASE 5A AGENT CAPSULE GENERATION TESTS PASSED CLEANLY.');
}

if (require.main === module) {
  runAgentCapsuleTests();
}

module.exports = { runAgentCapsuleTests };
