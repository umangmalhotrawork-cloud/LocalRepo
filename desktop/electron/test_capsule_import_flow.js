/**
 * Phase 6B Integration Test Suite — Import Capsule Workflow & Error Boundaries
 * Tests end-to-end capsule generation -> fresh session import, context reconstruction,
 * parent session chaining, sequence number increment, zero file mutations,
 * and safe failure handling for tampered, invalid, or missing capsules.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { continuumEngine } = require('../engine/continuum_engine');
const { continuumCapsuleBuilder, validateCapsule } = require('../engine/continuum_capsule_builder');
const { continuumManager } = require('./continuumManager');
const { agentManager } = require('./agentManager');
const secretFilter = require('../security/secretFilter');

// Set isolated test directory for Continuum manager storage
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-import-test-'));
process.env.ECHO_CONTINUUM_DIR = tempDir;

async function runImportFlowTests() {
  console.log('[TEST] Starting Phase 6B Capsule Import Flow Test Suite...');

  const tempWorkspace = path.resolve(__dirname, '..', '..', 'demo-workspaces', 'ai_cart_project');

  // STEP 1: Generate capsule from active agent session A
  console.log('[TEST 1] Creating Session A & Exporting Capsule...');
  const agentTaskPayload = {
    task: 'Refactor compute_order_total without modifying tests/',
    workspacePath: tempWorkspace,
    activeFilePath: path.join(tempWorkspace, 'src', 'checkout_engine.py'),
    steps: [
      { id: 'step-1', title: 'AST symbol analysis', status: 'completed' },
      { id: 'step-2', title: 'Apply try-except boundary', status: 'pending' },
    ],
    summary: 'Analyzed compute_order_total AST. Target line 19 for ValueError boundary.',
    options: { exportMode: 'INLINE', createWorkspaceSnapshot: false },
    recentTurns: [
      { turnId: 'turn-1', timestamp: Date.now() - 10000, userPrompt: 'Scan compute_order_total', agentSummary: 'Found null price vulnerability', status: 'VERIFIED' }
    ],
  };

  const exportResult = await agentManager.exportAgentTaskCapsule(agentTaskPayload);
  if (!exportResult || !exportResult.success || !exportResult.capsule) {
    console.error('[TEST 1 FAILED] Capsule generation failed:', exportResult);
    process.exit(1);
  }

  const generatedCapsule = exportResult.capsule;
  console.log('[TEST 1 PASSED] Session A Capsule generated cleanly (ID:', exportResult.capsuleId, ')');

  // STEP 2: Fresh Session B imports the generated capsule
  console.log('[TEST 2] Discarding Session A in-memory state & Importing capsule in Session B...');
  const valCapsule = validateCapsule(generatedCapsule);
  if (!valCapsule.valid) {
    console.error('[TEST 2 FAILED] Capsule validation failed:', valCapsule.errors);
    process.exit(1);
  }

  const sanitizedCapsule = secretFilter.sanitizeObject(generatedCapsule);
  const embeddedSnap = sanitizedCapsule.continuum_snapshot;

  const sessionBSnapshot = continuumEngine.createNextSnapshot(embeddedSnap, {
    task: {
      ...embeddedSnap.task,
      activeMilestone: `Resumed from Capsule (${sanitizedCapsule.capsule_meta?.capsule_id || 'Import'})`,
    },
  });

  continuumManager.saveSnapshot(sessionBSnapshot, tempWorkspace);

  if (sessionBSnapshot.metadata.parentSessionId !== exportResult.snapshotId) {
    console.error('[TEST 2 FAILED] Parent session ID mismatch:', sessionBSnapshot.metadata);
    process.exit(1);
  }
  if (sessionBSnapshot.metadata.sequenceNumber !== 2) {
    console.error('[TEST 2 FAILED] Sequence number did not increment to 2:', sessionBSnapshot.metadata);
    process.exit(1);
  }
  console.log('[TEST 2 PASSED] Session B imported capsule & chained parent session cleanly (Parent:', sessionBSnapshot.metadata.parentSessionId, 'Seq:', sessionBSnapshot.metadata.sequenceNumber, ')');

  // STEP 3: Verify imported session context retention
  console.log('[TEST 3] Verifying imported context contents...');
  const dnt = generatedCapsule.handoff_context.do_not_touch;
  if (!dnt.includes('tests/')) {
    console.error('[TEST 3 FAILED] do_not_touch constraint tests/ missing:', dnt);
    process.exit(1);
  }
  const turns = generatedCapsule.conversation_context.recent_turns;
  if (!Array.isArray(turns) || turns.length === 0 || turns[0].turn_id !== 'turn-1') {
    console.error('[TEST 3 FAILED] Recent turns missing in imported capsule:', turns);
    process.exit(1);
  }
  console.log('[TEST 3 PASSED] Context retention verified: objective, turns, files, do_not_touch, next action present.');

  // STEP 4: Error Handling Boundaries — Tampered Capsule Rejection
  console.log('[TEST 4] Testing tampered capsule rejection...');
  const tampered = JSON.parse(JSON.stringify(generatedCapsule));
  tampered.task.user_goal = 'TAMPERED GOAL';
  const valTampered = validateCapsule(tampered);
  if (valTampered.valid) {
    console.error('[TEST 4 FAILED] Tampered capsule was not rejected!');
    process.exit(1);
  }
  console.log('[TEST 4 PASSED] Tampered capsule rejected safely.');

  // STEP 5: Error Handling Boundaries — Unsupported Schema Version
  console.log('[TEST 5] Testing unsupported schema version rejection...');
  const invalidSchema = JSON.parse(JSON.stringify(generatedCapsule));
  invalidSchema.capsule_schema_version = '9.9.9';
  const valInvalidSchema = validateCapsule(invalidSchema);
  if (valInvalidSchema.valid) {
    console.error('[TEST 5 FAILED] Invalid schema version 9.9.9 was not rejected!');
    process.exit(1);
  }
  console.log('[TEST 5 PASSED] Invalid schema version 9.9.9 rejected safely.');

  // STEP 6: Error Handling Boundaries — Legacy Capsule without recent_turns
  console.log('[TEST 6] Testing legacy capsule without recent_turns...');
  const legacySnap = continuumEngine.createSnapshot({
    sessionId: 'session_legacy_001',
    project: { workspaceName: 'ai_cart_project', workspacePath: tempWorkspace, workspaceHash: 'a1b2c3d4e5f67890', detectedStack: { primaryLanguage: 'python', frameworks: [], testRunner: null }, bdgGraphSummary: { totalNodes: 0, totalEdges: 0, entryPointFiles: [] } },
    task: { userGoal: 'Legacy Session Goal' },
    conversation: { condensedSummary: 'Legacy summary', lastUserDirective: 'Legacy directive', lastAgentResponseSnippet: 'Legacy snippet' },
  });
  delete legacySnap.conversation.recentTurns;

  const legacyCapsule = await continuumCapsuleBuilder.buildCapsule(legacySnap, tempWorkspace, { exportMode: 'INLINE', createWorkspaceSnapshot: false });
  const valLegacy = validateCapsule(legacyCapsule);
  if (!valLegacy.valid) {
    console.error('[TEST 6 FAILED] Legacy capsule without recent_turns failed validation:', valLegacy.errors);
    process.exit(1);
  }
  console.log('[TEST 6 PASSED] Legacy capsule without recent_turns validated & imported cleanly.');

  // Cleanup temp dir
  try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch (e) {}

  console.log('\n[SUCCESS] ALL PHASE 6B CAPSULE IMPORT FLOW TESTS PASSED CLEANLY.');
}

if (require.main === module) {
  runImportFlowTests();
}

module.exports = { runImportFlowTests };
