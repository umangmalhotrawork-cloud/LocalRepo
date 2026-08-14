const fs = require('fs');
const path = require('path');
const os = require('os');
const { snapshotManager } = require('./snapshotManager');

async function main() {
  console.log("[TEST] Starting Workspace Snapshots & Checkpoints (Milestone 36) Test Suite...");

  const tempWorkspace = fs.mkdtempSync(path.join(os.tmpdir(), 'echo_snapshot_ws_'));
  console.log(`[SETUP] Sandbox workspace created: ${tempWorkspace}`);

  try {
    // 1. Initial workspace files setup
    const fileA = path.join(tempWorkspace, 'app.py');
    const fileB = path.join(tempWorkspace, 'utils.py');
    fs.writeFileSync(fileA, 'def main():\n    print("version 1")\n', 'utf8');
    fs.writeFileSync(fileB, 'def add(a, b):\n    return a + b\n', 'utf8');

    // Setup protected dir file
    const nodeModulesDir = path.join(tempWorkspace, 'node_modules', 'dep');
    fs.mkdirSync(nodeModulesDir, { recursive: true });
    fs.writeFileSync(path.join(nodeModulesDir, 'index.js'), 'module.exports = {};', 'utf8');

    // --- TEST 1: Create Snapshot ---
    const createRes1 = await snapshotManager.createSnapshot({
      workspacePath: tempWorkspace,
      name: 'Initial State v1',
      description: 'First baseline snapshot',
      openTabs: [{ path: fileA, name: 'app.py' }],
      activeTab: fileA,
    });
    console.log(`[TEST 1] Create snapshot: id=${createRes1.snapshotId}`);
    if (!createRes1.success || !createRes1.snapshotId) throw new Error("Test 1 failed: Snapshot not created");

    // --- TEST 2: List Snapshots ---
    const list1 = snapshotManager.listSnapshots(tempWorkspace);
    console.log(`[TEST 2] List snapshots: count=${list1.length}`);
    if (list1.length !== 1 || list1[0].id !== createRes1.snapshotId) {
      throw new Error("Test 2 failed: Snapshot listing mismatch");
    }

    // --- TEST 3: Load Snapshot ---
    const loadedSnap = snapshotManager.getSnapshot(tempWorkspace, createRes1.snapshotId);
    console.log(`[TEST 3] Load snapshot: totalFiles=${loadedSnap.files.length}`);
    if (!loadedSnap || loadedSnap.files.length !== 2 || loadedSnap.name !== 'Initial State v1') {
      throw new Error("Test 3 failed: Loaded snapshot contents invalid");
    }

    // Modify workspace files
    fs.writeFileSync(fileA, 'def main():\n    print("version 2 modified")\n', 'utf8');
    const fileC = path.join(tempWorkspace, 'config.json');
    fs.writeFileSync(fileC, '{"port": 8080}', 'utf8');

    // --- TEST 4: Compare Snapshots ---
    const compareRes = snapshotManager.compareSnapshots({
      workspacePath: tempWorkspace,
      snapshotId1: createRes1.snapshotId,
    });
    console.log(`[TEST 4] Compare: added=${compareRes.summary.added}, modified=${compareRes.summary.modified}`);
    if (compareRes.summary.modified !== 1 || compareRes.summary.added !== 1) {
      throw new Error("Test 4 failed: Diff comparison summary mismatch");
    }

    // --- TEST 5: Restore Single File ---
    const restoreFileRes = await snapshotManager.restoreFile({
      workspacePath: tempWorkspace,
      snapshotId: createRes1.snapshotId,
      relativePath: 'app.py',
    });
    console.log(`[TEST 5] Restore single file: ${restoreFileRes.relativePath}`);
    const restoredContent = fs.readFileSync(fileA, 'utf8');
    if (!restoredContent.includes('version 1')) {
      throw new Error("Test 5 failed: Single file content was not restored to version 1");
    }

    // --- TEST 6: Restore Entire Workspace ---
    // Modify fileB and add another extra file
    fs.writeFileSync(fileB, 'def add(a, b):\n    return a * b\n', 'utf8');
    const restoreWsRes = await snapshotManager.restoreWorkspace({
      workspacePath: tempWorkspace,
      snapshotId: createRes1.snapshotId,
    });
    console.log(`[TEST 6] Restore workspace: restoredFiles=${restoreWsRes.restoredFilesCount}`);
    const fileBContent = fs.readFileSync(fileB, 'utf8');
    if (!fileBContent.includes('return a + b') || fs.existsSync(fileC)) {
      throw new Error("Test 6 failed: Full workspace rollback did not restore file contents or prune extra files");
    }

    // --- TEST 7: Ignore Protected Directories ---
    const filesInSnap = loadedSnap.files.map((f) => f.relativePath);
    console.log(`[TEST 7] Protected dirs ignored: ${!filesInSnap.some((f) => f.includes('node_modules'))}`);
    if (filesInSnap.some((f) => f.includes('node_modules'))) {
      throw new Error("Test 7 failed: node_modules was indexed in snapshot");
    }

    // --- TEST 8: Atomic Overwrite Behavior ---
    const snapshotDir = snapshotManager.getWorkspaceSnapshotDir(tempWorkspace);
    const snapFilePath = path.join(snapshotDir, `${createRes1.snapshotId}.json`);
    console.log(`[TEST 8] Snapshot file exists atomically: ${fs.existsSync(snapFilePath)}`);
    if (!fs.existsSync(snapFilePath)) {
      throw new Error("Test 8 failed: Atomic snapshot file does not exist");
    }

    // --- TEST 9: Auto-checkpoint Retention Limit (20 max) ---
    for (let i = 0; i < 25; i++) {
      await snapshotManager.createSnapshot({
        workspacePath: tempWorkspace,
        name: `Auto Checkpoint ${i}`,
        isAuto: true,
      });
    }
    const autoList = snapshotManager.listSnapshots(tempWorkspace).filter((s) => s.isAuto);
    console.log(`[TEST 9] Auto-checkpoint retention: count=${autoList.length} (max 20)`);
    if (autoList.length > 20) {
      throw new Error(`Test 9 failed: Auto-checkpoints exceeded 20 (got ${autoList.length})`);
    }

    // --- TEST 10: Deterministic Ordering (Timestamp Descending) ---
    const fullList = snapshotManager.listSnapshots(tempWorkspace);
    for (let i = 0; i < fullList.length - 1; i++) {
      if (fullList[i].timestamp < fullList[i + 1].timestamp) {
        throw new Error("Test 10 failed: Snapshots not in descending timestamp order");
      }
    }
    console.log(`[TEST 10] Deterministic descending timestamp ordering verified`);

    console.log("\nALL WORKSPACE SNAPSHOT TESTS PASSED SUCCESSFULLY\n");
  } finally {
    try {
      fs.rmSync(tempWorkspace, { recursive: true, force: true });
    } catch (e) {}
  }
}

main().catch((err) => {
  console.error("[TEST ERROR]", err);
  process.exit(1);
});
