const { recoveryStore } = require('./recoveryStore');

async function main() {
  console.log("[TEST] Starting Crash Recovery & Session Restore Test Suite...");

  const wsA = "/tmp/echo_test_workspace_a";
  const wsB = "/tmp/echo_test_workspace_b";

  // Clean up any previous test snapshots
  recoveryStore.clearSnapshot(wsA);
  recoveryStore.clearSnapshot(wsB);

  // 1. Save Snapshot with dirty tabs
  const snapshot1 = {
    openTabs: [
      { path: `${wsA}/file1.py`, content: "print('unsaved edit')", isDirty: true },
      { path: `${wsA}/file2.py`, content: "def clean(): pass", isDirty: false },
    ],
    activeTabPath: `${wsA}/file1.py`,
  };

  const saveRes = recoveryStore.saveSnapshot(wsA, snapshot1);
  console.log(`[TEST 1] Save snapshot: success=${saveRes.success}, path=${saveRes.path}`);
  if (!saveRes.success || !saveRes.path) throw new Error("Test 1 failed: Snapshot save failed");

  // 2. Load Snapshot
  const loaded1 = recoveryStore.loadSnapshot(wsA);
  console.log(`[TEST 2] Load snapshot: openTabs=${loaded1?.openTabs?.length}, active=${loaded1?.activeTabPath}`);
  if (!loaded1 || loaded1.openTabs.length !== 2 || loaded1.activeTabPath !== `${wsA}/file1.py`) {
    throw new Error("Test 2 failed: Snapshot content mismatch");
  }

  // 3. Unchanged Hash Skip
  const saveRes2 = recoveryStore.saveSnapshot(wsA, snapshot1);
  console.log(`[TEST 3] Unchanged hash skip: skipped=${saveRes2.skipped}`);
  if (!saveRes2.skipped) throw new Error("Test 3 failed: Did not skip unchanged hash");

  // 4. Multiple Workspaces Isolation
  const snapshotB = {
    openTabs: [{ path: `${wsB}/index.ts`, content: "export const x = 1;", isDirty: true }],
    activeTabPath: `${wsB}/index.ts`,
  };
  recoveryStore.saveSnapshot(wsB, snapshotB);

  const loadedB = recoveryStore.loadSnapshot(wsB);
  console.log(`[TEST 4] Workspace B loaded: tabs=${loadedB?.openTabs?.length}`);
  if (!loadedB || loadedB.openTabs[0].path !== `${wsB}/index.ts`) {
    throw new Error("Test 4 failed: Workspace B snapshot corrupted");
  }

  // 5. Dirty Tab Filtering / Auto-Clear when all tabs are clean
  const snapshotClean = {
    openTabs: [{ path: `${wsA}/file1.py`, content: "saved", isDirty: false }],
    activeTabPath: `${wsA}/file1.py`,
  };
  const cleanRes = recoveryStore.saveSnapshot(wsA, snapshotClean);
  console.log(`[TEST 5] Clean tabs auto-clear: cleared=${cleanRes.cleared}`);
  const loadedClean = recoveryStore.loadSnapshot(wsA);
  if (loadedClean !== null) throw new Error("Test 5 failed: Snapshot was not cleared");

  // 6. Clear Snapshot explicitly
  recoveryStore.clearSnapshot(wsB);
  const loadedBAfterClear = recoveryStore.loadSnapshot(wsB);
  console.log(`[TEST 6] Explicit clear: loaded=${loadedBAfterClear}`);
  if (loadedBAfterClear !== null) throw new Error("Test 6 failed: Workspace B not cleared");

  // 7. Crash Detection Heuristic
  recoveryStore.updateHeartbeat(false); // abnormal exit marker
  const crashState = recoveryStore.checkCrashState();
  console.log(`[TEST 7] Crash heuristic: wasCrash=${crashState.wasCrash}`);
  if (!crashState.wasCrash) throw new Error("Test 7 failed: Crash should have been detected");

  recoveryStore.updateHeartbeat(true); // clean shutdown marker
  const cleanState = recoveryStore.checkCrashState();
  console.log(`[TEST 7b] Clean exit heuristic: wasCrash=${cleanState.wasCrash}`);
  if (cleanState.wasCrash) throw new Error("Test 7b failed: Clean exit should not be crash");

  console.log(">>> ALL 7 CRASH RECOVERY TESTS PASSED SUCCESSFULLY! <<<");
}

main().catch((err) => {
  console.error("[TEST ERROR]", err);
  process.exit(1);
});
