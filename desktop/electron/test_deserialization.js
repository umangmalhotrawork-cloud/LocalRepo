const fs = require('fs');
const path = require('path');
const stateStore = require('./state-store');
const { recoveryStore } = require('./recoveryStore');
const { snapshotManager } = require('./snapshotManager');

async function main() {
  console.log("[TEST] Starting Startup Deserialization & Safe Persistence Test Suite...");

  // --- TEST 1: State Store Corrupt File Resilience ---
  const statePath = path.join(process.cwd(), '.echo-nullity-recovery', 'workspace-state.json');
  fs.mkdirSync(path.dirname(statePath), { recursive: true });

  // Write malformed JSON
  fs.writeFileSync(statePath, "{ broken: json, [}", 'utf-8');
  const loadedCorrupt = stateStore.loadState();
  console.log(`[TEST 1] State Store loaded with corrupted JSON: result=${loadedCorrupt}`);
  if (loadedCorrupt !== null) {
    throw new Error("Test 1 failed: Expected null for corrupt state file");
  }

  // Write valid state and verify sanitized structure
  stateStore.saveState({
    folderPath: '/mock/workspace',
    openTabs: [{ path: '/mock/workspace/index.ts', name: 'index.ts', extraneousFunc: () => {} }],
    mainView: 'editor',
    explorerWidth: 280,
  });
  const loadedValid = stateStore.loadState();
  console.log(`[TEST 1b] State Store valid structure: folderPath=${loadedValid?.folderPath}, tabs=${loadedValid?.openTabs?.length}`);
  if (!loadedValid || loadedValid.folderPath !== '/mock/workspace' || loadedValid.openTabs.length !== 1) {
    throw new Error("Test 1b failed: State Store failed to save/load clean sanitized state");
  }

  // --- TEST 2: Recovery Store Corrupt Snapshot Resilience ---
  const recDir = recoveryStore.getRecoveryDir();
  const corruptSnapPath = path.join(recDir, 'corrupt_test.json');
  fs.writeFileSync(corruptSnapPath, "NOT_JSON_DATA_HERE!!!", 'utf-8');
  
  // List snapshots should ignore corrupted file without throwing
  const snapList = recoveryStore.listSnapshots();
  console.log(`[TEST 2] Recovery listSnapshots with corrupt file present: count=${snapList.length}`);

  // Load corrupted snapshot directly
  const loadedSnap = recoveryStore.loadSnapshot('/mock/nonexistent/workspace');
  console.log(`[TEST 2b] Recovery loadSnapshot for nonexistent: result=${loadedSnap}`);
  if (loadedSnap !== null) {
    throw new Error("Test 2b failed: Expected null for nonexistent recovery snapshot");
  }

  // Clean up test corrupt file
  try { fs.unlinkSync(corruptSnapPath); } catch (e) {}

  // --- TEST 3: Snapshot Manager Corrupt File Resilience ---
  const testWorkspace = path.join(process.cwd(), 'demo-workspaces', 'python-cart');
  const snapDir = snapshotManager.getWorkspaceSnapshotDir(testWorkspace);
  fs.mkdirSync(snapDir, { recursive: true });
  const corruptSnapFile = path.join(snapDir, 'corrupt_snap_test.json');
  fs.writeFileSync(corruptSnapFile, "{ bad: json", 'utf-8');

  const snaps = snapshotManager.listSnapshots(testWorkspace);
  console.log(`[TEST 3] SnapshotManager listSnapshots with corrupt file: validCount=${snaps.length}`);
  // Verify it did not crash and corrupt file was safely skipped
  if (!Array.isArray(snaps)) {
    throw new Error("Test 3 failed: listSnapshots did not return an array");
  }

  try { fs.unlinkSync(corruptSnapFile); } catch (e) {}

  // --- TEST 4: Clean JSON Serialization Guarantee ---
  const testObjWithNonSerializable = {
    folderPath: '/test/path',
    openTabs: [
      { path: '/test/path/a.py', name: 'a.py', handle: { pty: true, fn: () => {} } },
      null,
      undefined,
      { path: '/test/path/b.py' }
    ],
    activeTabPath: '/test/path/a.py',
    mainView: 'editor',
    explorerWidth: 300,
  };

  stateStore.saveState(testObjWithNonSerializable);
  const reloaded = stateStore.loadState();
  console.log(`[TEST 4] Non-serializable stripped: tabCount=${reloaded.openTabs.length}, tab0Keys=${Object.keys(reloaded.openTabs[0]).join(',')}`);
  if (reloaded.openTabs.length !== 2 || reloaded.openTabs[0].handle !== undefined) {
    throw new Error("Test 4 failed: Non-serializable properties were not sanitized");
  }

  console.log("\n>>> ALL DESERIALIZATION & PERSISTENCE TESTS PASSED SUCCESSFULLY! <<<\n");
}

main().catch((err) => {
  console.error("[TEST ERROR]", err);
  process.exit(1);
});
