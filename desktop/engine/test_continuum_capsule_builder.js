/**
 * Continuum Capsule Builder (Phase 1 + 2) Integration Test Suite
 * Tests capsule generation, schema validation, truth boundaries, secret filtering,
 * INLINE vs REFERENCE_ONLY export modes, hash integrity, and backward compatibility.
 */

const fs = require('fs');
const path = require('path');
const { continuumEngine } = require('./continuum_engine');
const { continuumCapsuleBuilder, validateCapsule, CAPSULE_SCHEMA_VERSION } = require('./continuum_capsule_builder');
const secretFilter = require('../security/secretFilter');

async function runCapsuleTests() {
  console.log('[TEST] Starting Continuum Capsule Builder (Phase 1 + 2) Test Suite...');

  // Setup valid input Continuum snapshot
  const inputSnapshot = continuumEngine.createSnapshot({
    sessionId: 'session_capsule_test_001',
    project: {
      workspaceName: 'ai_cart_project',
      workspacePath: path.resolve(__dirname, '..', '..', 'demo-workspaces', 'ai_cart_project'),
      workspaceHash: 'a1b2c3d4e5f67890',
      detectedStack: { primaryLanguage: 'python', frameworks: ['pytest'], testRunner: 'pytest' },
      bdgGraphSummary: { totalNodes: 36, totalEdges: 42, entryPointFiles: ['src/checkout_engine.py'] },
    },
    task: {
      userGoal: 'Refactor exception handling in compute_order_total',
      activeMilestone: 'Phase 3 Handoff',
      currentSubtask: 'Verify context injection',
      completedSteps: ['AST Symbol Resolution', 'Blast Radius Evaluation'],
      pendingSteps: ['Apply Defensive Try-Catch', 'Run Pytest Suite'],
      blockers: [],
    },
    codeState: {
      activeTargetNodeId: 'function::src/checkout_engine.py::compute_order_total',
      activeFilePath: 'src/checkout_engine.py',
      cursorLine: 19,
      dirtyFiles: [{ relPath: 'src/checkout_engine.py', lineCount: 45, unsavedChanges: false }],
      modifiedSymbols: [
        { symbol: 'compute_order_total', file: 'src/checkout_engine.py', type: 'function', mutationStatus: 'applied' },
      ],
      workspaceSnapshotId: 'snap_1234567890',
      surgerySessionIds: ['surg_001'],
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
    debugging: {
      discoveredBugs: [
        {
          symbol: 'compute_order_total',
          file: 'src/checkout_engine.py',
          line: 19,
          description: 'Unhandled ValueError when price is None',
          rootCause: 'Missing type guard',
          status: 'investigating',
        },
      ],
      failedFixes: [],
      successfulFixes: [],
    },
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
    aiState: {
      provider: 'google',
      modelName: 'gemini-pro',
      temperature: 0.1,
      maxTokens: 2048,
      activeRole: 'software-engineer',
    },
    handoff: {
      immediateNextAction: 'Apply defensive try-except guard to compute_order_total line 19',
      requiredFilesToLoad: ['src/checkout_engine.py'],
      unresolvedQuestions: [],
      systemInstructionOverride: '',
    },
  });

  const workspacePath = inputSnapshot.project.workspacePath;

  // TEST 1: Build valid capsule in INLINE mode
  console.log('[TEST 1] Building Continuum Capsule in INLINE mode...');
  const capsuleInline = await continuumCapsuleBuilder.buildCapsule(inputSnapshot, workspacePath, {
    exportMode: 'INLINE',
    createWorkspaceSnapshot: false,
  });

  if (!capsuleInline || capsuleInline.capsule_schema_version !== CAPSULE_SCHEMA_VERSION) {
    console.error('[TEST 1 FAILED] Invalid capsule produced:', capsuleInline);
    process.exit(1);
  }
  console.log('[TEST 1 PASSED] Continuum Capsule generated cleanly (Capsule ID:', capsuleInline.capsule_meta.capsule_id, ')');

  // TEST 2: Validate capsule structure and SHA-256 integrity hash
  console.log('[TEST 2] Validating capsule structure & integrity hash...');
  const valResult = validateCapsule(capsuleInline);
  if (!valResult.valid) {
    console.error('[TEST 2 FAILED] Capsule validation failed:', valResult.errors);
    process.exit(1);
  }
  console.log('[TEST 2 PASSED] Capsule structure and hash integrity validated cleanly.');

  // TEST 3: Verify Truth Boundary status assignment
  console.log('[TEST 3] Verifying Truth Boundary status classification...');
  const workItems = capsuleInline.task.work_items;
  if (!Array.isArray(workItems) || workItems.length === 0) {
    console.error('[TEST 3 FAILED] Work items missing in capsule task:', capsuleInline.task);
    process.exit(1);
  }
  const plannedItem = workItems.find((w) => w.description.includes('Apply Defensive Try-Catch'));
  if (!plannedItem || plannedItem.status !== 'PLANNED') {
    console.error('[TEST 3 FAILED] Expected status PLANNED for pending step:', plannedItem);
    process.exit(1);
  }
  console.log('[TEST 3 PASSED] Truth boundary correctly classified PLANNED steps.');

  // TEST 4: Test REFERENCE_ONLY export mode
  console.log('[TEST 4] Testing REFERENCE_ONLY export mode...');
  const capsuleRefOnly = await continuumCapsuleBuilder.buildCapsule(inputSnapshot, workspacePath, {
    exportMode: 'REFERENCE_ONLY',
    createWorkspaceSnapshot: false,
  });
  const refValResult = validateCapsule(capsuleRefOnly);
  if (!refValResult.valid) {
    console.error('[TEST 4 FAILED] REFERENCE_ONLY capsule validation failed:', refValResult.errors);
    process.exit(1);
  }
  const inlineFiles = capsuleRefOnly.important_files.filter((f) => f.inline_content !== null);
  if (inlineFiles.length > 0) {
    console.error('[TEST 4 FAILED] REFERENCE_ONLY mode embedded file contents:', inlineFiles);
    process.exit(1);
  }
  console.log('[TEST 4 PASSED] REFERENCE_ONLY mode excluded inline file contents correctly.');

  // TEST 5: Verify Secret Redaction in Capsule
  console.log('[TEST 5] Testing secret filter redaction inside capsule...');
  const dirtySnapshot = JSON.parse(JSON.stringify(inputSnapshot));
  dirtySnapshot.conversation.condensedSummary = 'User provided secret GEMINI_API_KEY="AIzaSyA1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p" for setup.';

  const capsuleDirty = await continuumCapsuleBuilder.buildCapsule(dirtySnapshot, workspacePath, {
    exportMode: 'INLINE',
    createWorkspaceSnapshot: false,
  });

  const summaryText = capsuleDirty.conversation_context.condensed_summary;
  if (summaryText.includes('AIzaSyA1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p')) {
    console.error('[TEST 5 FAILED] Secret key survived in capsule:', summaryText);
    process.exit(1);
  }
  if (!summaryText.includes('[REDACTED_SECRET:')) {
    console.error('[TEST 5 FAILED] Missing redaction placeholder in capsule:', summaryText);
    process.exit(1);
  }
  console.log('[TEST 5 PASSED] Secret key redacted from capsule cleanly.');

  // TEST 6: Verify Phase 1 linkages in codeState
  console.log('[TEST 6] Verifying Phase 1 workspaceSnapshotId and surgerySessionIds linkages...');
  if (
    capsuleInline.continuum_snapshot.codeState.workspaceSnapshotId !== 'snap_1234567890' ||
    !Array.isArray(capsuleInline.continuum_snapshot.codeState.surgerySessionIds)
  ) {
    console.error('[TEST 6 FAILED] Linkage fields missing in codeState:', capsuleInline.continuum_snapshot.codeState);
    process.exit(1);
  }
  console.log('[TEST 6 PASSED] Phase 1 linkage fields preserved cleanly.');

  // TEST 7: Verify Tampered Hash Rejection
  console.log('[TEST 7] Testing tampered capsule hash rejection...');
  const tamperedCapsule = JSON.parse(JSON.stringify(capsuleInline));
  tamperedCapsule.task.user_goal = 'TAMPERED GOAL';
  const tamperedVal = validateCapsule(tamperedCapsule);
  if (tamperedVal.valid || !tamperedVal.errors.some((e) => e.includes('integrity mismatch'))) {
    console.error('[TEST 7 FAILED] Tampered capsule was not rejected:', tamperedVal);
    process.exit(1);
  }
  console.log('[TEST 7 PASSED] Tampered capsule hash mismatch cleanly detected and rejected.');

  console.log('\n[SUCCESS] ALL CONTINUUM CAPSULE PHASE 1 + 2 TESTS PASSED CLEANLY.');
}

if (require.main === module) {
  runCapsuleTests();
}

module.exports = { runCapsuleTests };
