/**
 * Continuum Manager Phase 2 Integration & Persistence Test Suite
 * Tests per-workspace storage, secret redaction on disk, newest-first ordering,
 * path traversal guards, workspace isolation, and snapshot CRUD operations.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { continuumManager } = require('./continuumManager');
const { continuumEngine } = require('../engine/continuum_engine');

function runManagerTests() {
  console.log('[TEST] Starting Continuum Phase 2 Persistence Suite...');

  // Setup isolated test directory for ECHO_CONTINUUM_DIR
  const testStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-continuum-test-'));
  process.env.ECHO_CONTINUUM_DIR = testStorageDir;

  const workspaceA = '/path/to/workspace_alpha';
  const workspaceB = '/path/to/workspace_beta';

  try {
    // TEST 1: Save valid snapshot
    console.log('[MANAGER TEST 1] Saving valid snapshot for Workspace A...');
    const snapshot1 = continuumEngine.createSnapshot({
      sessionId: 'session_alpha_001',
      project: {
        workspaceName: 'workspace_alpha',
        workspacePath: workspaceA,
        workspaceHash: continuumManager.getWorkspaceHash(workspaceA),
      },
      task: { userGoal: 'Implement authentication middleware' },
      codeState: { activeTargetNodeId: 'function::src/auth.js::verifyToken' },
    });

    const saveRes1 = continuumManager.saveSnapshot(snapshot1, workspaceA);
    if (!saveRes1.success || !saveRes1.path || !fs.existsSync(saveRes1.path)) {
      console.error('[MANAGER TEST 1 FAILED] Failed to save snapshot:', saveRes1);
      process.exit(1);
    }
    console.log('[MANAGER TEST 1 PASSED] Snapshot saved cleanly at:', saveRes1.path);

    // TEST 2: Load saved snapshot
    console.log('[MANAGER TEST 2] Loading saved snapshot for Workspace A...');
    const loadRes1 = continuumManager.loadSnapshot('session_alpha_001', workspaceA);
    if (!loadRes1.success || !loadRes1.snapshot) {
      console.error('[MANAGER TEST 2 FAILED] Failed to load snapshot:', loadRes1);
      process.exit(1);
    }
    if (loadRes1.snapshot.metadata.sessionId !== 'session_alpha_001') {
      console.error('[MANAGER TEST 2 FAILED] Session ID mismatch:', loadRes1.snapshot.metadata);
      process.exit(1);
    }
    console.log('[MANAGER TEST 2 PASSED] Snapshot loaded cleanly.');

    // TEST 3: List snapshots
    console.log('[MANAGER TEST 3] Listing snapshots for Workspace A...');
    const listRes1 = continuumManager.listSnapshots(workspaceA);
    if (!Array.isArray(listRes1) || listRes1.length !== 1 || listRes1[0].sessionId !== 'session_alpha_001') {
      console.error('[MANAGER TEST 3 FAILED] Snapshot list invalid:', listRes1);
      process.exit(1);
    }
    console.log('[MANAGER TEST 3 PASSED] Snapshot list returned 1 snapshot for Workspace A.');

    // TEST 4: Delete snapshot
    console.log('[MANAGER TEST 4] Deleting snapshot for Workspace A...');
    const snapshotToDelete = continuumEngine.createSnapshot({
      sessionId: 'session_alpha_to_delete',
      project: { workspacePath: workspaceA },
    });
    continuumManager.saveSnapshot(snapshotToDelete, workspaceA);
    const deleteRes = continuumManager.deleteSnapshot('session_alpha_to_delete', workspaceA);
    if (!deleteRes.success) {
      console.error('[MANAGER TEST 4 FAILED] Failed to delete snapshot:', deleteRes);
      process.exit(1);
    }
    const checkDeleted = continuumManager.loadSnapshot('session_alpha_to_delete', workspaceA);
    if (checkDeleted.success) {
      console.error('[MANAGER TEST 4 FAILED] Deleted snapshot was still loadable!');
      process.exit(1);
    }
    console.log('[MANAGER TEST 4 PASSED] Snapshot deleted cleanly.');

    // TEST 5 & 6: Save multiple snapshots and verify newest-first ordering
    console.log('[MANAGER TEST 5 & 6] Testing multiple snapshots & newest-first ordering...');
    const snapshot2 = continuumEngine.createNextSnapshot(snapshot1, {
      sessionId: 'session_alpha_002',
      updatedAt: Date.now() + 5000,
      task: { userGoal: 'Implement authorization middleware (Sequence 2)' },
    });
    continuumManager.saveSnapshot(snapshot2, workspaceA);

    const listResMulti = continuumManager.listSnapshots(workspaceA);
    if (listResMulti.length !== 2) {
      console.error('[MANAGER TEST 5 FAILED] Expected 2 snapshots, got:', listResMulti.length);
      process.exit(1);
    }
    if (listResMulti[0].sessionId !== 'session_alpha_002') {
      console.error('[MANAGER TEST 6 FAILED] Newest snapshot was not first in list:', listResMulti);
      process.exit(1);
    }
    console.log('[MANAGER TEST 5 & 6 PASSED] Multiple snapshots stored and listed newest-first.');

    // TEST 7: Verify parentSessionId survives
    console.log('[MANAGER TEST 7] Verifying parentSessionId survival in loaded chained snapshot...');
    const loadRes2 = continuumManager.loadSnapshot('session_alpha_002', workspaceA);
    if (loadRes2.snapshot.metadata.parentSessionId !== 'session_alpha_001') {
      console.error('[MANAGER TEST 7 FAILED] parentSessionId lost:', loadRes2.snapshot.metadata);
      process.exit(1);
    }
    console.log('[MANAGER TEST 7 PASSED] parentSessionId session_alpha_001 survived persistence.');

    // TEST 8: Workspace isolation
    console.log('[MANAGER TEST 8] Testing workspace storage isolation (Workspace A vs Workspace B)...');
    const snapshotB = continuumEngine.createSnapshot({
      sessionId: 'session_beta_001',
      project: { workspaceName: 'workspace_beta', workspacePath: workspaceB },
      task: { userGoal: 'Refactor database migration' },
    });
    continuumManager.saveSnapshot(snapshotB, workspaceB);

    const listA = continuumManager.listSnapshots(workspaceA);
    const listB = continuumManager.listSnapshots(workspaceB);

    if (listA.some((s) => s.sessionId === 'session_beta_001') || listB.some((s) => s.sessionId === 'session_alpha_001')) {
      console.error('[MANAGER TEST 8 FAILED] Workspace isolation breach:', { listA, listB });
      process.exit(1);
    }
    console.log('[MANAGER TEST 8 PASSED] Workspace A and Workspace B snapshots strictly isolated.');

    // TEST 9: Attempt cross-workspace load
    console.log('[MANAGER TEST 9] Testing cross-workspace load protection...');
    const crossLoad = continuumManager.loadSnapshot('session_beta_001', workspaceA);
    if (crossLoad.success) {
      console.error('[MANAGER TEST 9 FAILED] Workspace A successfully loaded Workspace B snapshot!', crossLoad);
      process.exit(1);
    }
    console.log('[MANAGER TEST 9 PASSED] Cross-workspace load attempt safely rejected.');

    // TEST 10: Attempt path traversal
    console.log('[MANAGER TEST 10] Testing path traversal defense (../, /etc/passwd)...');
    const traversalLoad1 = continuumManager.loadSnapshot('../../etc/passwd', workspaceA);
    const traversalLoad2 = continuumManager.loadSnapshot('../continuum/a1b2c3d4e5f67890_session_alpha_001', workspaceA);
    const traversalDelete = continuumManager.deleteSnapshot('../../../file.txt', workspaceA);

    if (traversalLoad1.success || traversalLoad2.success || traversalDelete.success) {
      console.error('[MANAGER TEST 10 FAILED] Path traversal attack was not blocked!', { traversalLoad1, traversalLoad2, traversalDelete });
      process.exit(1);
    }
    console.log('[MANAGER TEST 10 PASSED] Path traversal attacks safely blocked.');

    // TEST 11: Attempt malformed snapshot save
    console.log('[MANAGER TEST 11] Testing malformed snapshot save rejection...');
    const malformedSave = continuumManager.saveSnapshot({ badField: true }, workspaceA);
    if (malformedSave.success) {
      console.error('[MANAGER TEST 11 FAILED] Malformed snapshot save was accepted!', malformedSave);
      process.exit(1);
    }
    console.log('[MANAGER TEST 11 PASSED] Malformed snapshot save rejected.');

    // TEST 12: Attempt invalid snapshot ID load
    console.log('[MANAGER TEST 12] Testing invalid snapshot ID handling...');
    const invalidIdLoad = continuumManager.loadSnapshot('!@#$%^&*()', workspaceA);
    if (invalidIdLoad.success) {
      console.error('[MANAGER TEST 12 FAILED] Invalid snapshot ID load succeeded!', invalidIdLoad);
      process.exit(1);
    }
    console.log('[MANAGER TEST 12 PASSED] Invalid snapshot ID load safely rejected.');

    // TEST 13: Verify secrets are not persisted on disk
    console.log('[TEST 13] Verifying secrets are redacted before writing to disk...');
    const secretSnapshot = continuumEngine.createSnapshot({
      sessionId: 'session_secret_test',
      project: { workspacePath: workspaceA },
      conversation: {
        condensedSummary: 'Connecting with GEMINI_API_KEY="AIzaSySECRETKEY12345" and password="mySecretPassword99"',
      },
    });
    const saveSecretRes = continuumManager.saveSnapshot(secretSnapshot, workspaceA);
    const rawDiskContent = fs.readFileSync(saveSecretRes.path, 'utf-8');

    if (
      rawDiskContent.includes('AIzaSySECRETKEY12345') ||
      rawDiskContent.includes('mySecretPassword99')
    ) {
      console.error('[MANAGER TEST 13 FAILED] Raw secret persisted to disk file!', rawDiskContent);
      process.exit(1);
    }
    if (!rawDiskContent.includes('[REDACTED_SECRET:')) {
      console.error('[MANAGER TEST 13 FAILED] Redaction placeholder missing on disk:', rawDiskContent);
      process.exit(1);
    }
    console.log('[MANAGER TEST 13 PASSED] Secrets redacted on disk before serialization.');

    // TEST 14: Verify Phase 1 tests remain passing
    console.log('[MANAGER TEST 14] Verifying Phase 1 continuum_engine tests pass...');
    const { runTests: runPhase1Tests } = require('../engine/test_continuum_engine');
    runPhase1Tests();
    console.log('[MANAGER TEST 14 PASSED] Phase 1 tests fully verified.');

    console.log('\n[SUCCESS] ALL CONTINUUM PHASE 2 PERSISTENCE SCENARIOS (TESTS 1–14) PASSED CLEANLY.');
  } finally {
    // Clean up temporary test storage directory
    try {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

if (require.main === module) {
  runManagerTests();
}

module.exports = { runManagerTests };
