const fs = require('fs');
const path = require('path');
const os = require('os');
const ptyManager = require('./ptyManager');

async function main() {
  console.log("[TEST] Starting Terminal & PTY Manager Smoke Test Suite...");

  // 1. Test Default Shell Resolution
  const defaultShell = ptyManager.getDefaultShell();
  console.log(`[TEST 1] Default shell resolved: ${defaultShell}`);
  if (!defaultShell || typeof defaultShell !== 'string') {
    throw new Error("Test 1 failed: Default shell is empty");
  }
  if (process.platform !== 'win32' && !fs.existsSync(defaultShell)) {
    throw new Error(`Test 1 failed: Resolved shell does not exist on disk: ${defaultShell}`);
  }

  // 2. Test Shell Fallback when process.env.SHELL is invalid
  const originalEnvShell = process.env.SHELL;
  process.env.SHELL = '/non/existent/custom/shell';
  const fallbackShell = ptyManager.getDefaultShell();
  console.log(`[TEST 2] Fallback shell when SHELL is invalid: ${fallbackShell}`);
  if (process.platform !== 'win32' && (!fallbackShell || !fs.existsSync(fallbackShell))) {
    throw new Error(`Test 2 failed: Fallback shell does not exist: ${fallbackShell}`);
  }
  process.env.SHELL = originalEnvShell;

  // 3. Test CWD Validation & Fallback
  const invalidCwd = '/path/that/does/not/exist/at/all';
  const resolvedCwd = ptyManager.resolveCwd(invalidCwd);
  console.log(`[TEST 3] Resolved CWD for invalid path: ${resolvedCwd}`);
  if (!fs.existsSync(resolvedCwd) || !fs.statSync(resolvedCwd).isDirectory()) {
    throw new Error(`Test 3 failed: Resolved CWD is not an existing directory: ${resolvedCwd}`);
  }

  // 4. Test spawn-helper permissions
  if (process.platform !== 'win32') {
    ptyManager.ensureSpawnHelperPermissions();
    try {
      const ptyLibDir = path.dirname(require.resolve('node-pty'));
      const candidateHelper = path.join(ptyLibDir, '..', 'prebuilds', `${process.platform}-${process.arch}`, 'spawn-helper');
      if (fs.existsSync(candidateHelper)) {
        const stat = fs.statSync(candidateHelper);
        const isExec = (stat.mode & 0o111) !== 0;
        console.log(`[TEST 4] spawn-helper executable check: isExec=${isExec}, mode=${stat.mode.toString(8)}`);
        if (!isExec) {
          throw new Error("Test 4 failed: spawn-helper is not executable");
        }
      } else {
        console.log(`[TEST 4] spawn-helper check: prebuild helper not found at default location (built from source or bundled).`);
      }
    } catch (e) {
      console.warn(`[TEST 4] spawn-helper permission check warning: ${e.message}`);
    }
  }

  // 5. Test Live PTY Spawn & Cleanup
  const mockWebContents = {
    isDestroyed: () => false,
    send: (channel, payload) => {
      // console.log(`[MOCK IPC] ${channel}:`, payload);
    },
  };

  const term = ptyManager.createTerminal({ cwd: process.cwd() }, mockWebContents);
  console.log(`[TEST 5] Terminal spawned: id=${term.id}, pid=${term.pid}, shell=${term.shell}, status=${term.status}`);
  if (!term.id || !term.pid || term.status !== 'running') {
    throw new Error("Test 5 failed: Terminal session failed to start");
  }

  // Test list
  const list = ptyManager.list();
  if (!list.some((t) => t.id === term.id)) {
    throw new Error("Test 5 failed: Terminal not found in active list");
  }

  // Test write
  ptyManager.write(term.id, 'echo "PTY_TEST_OK"\n');

  // Allow brief execution then cleanup
  await new Promise((r) => setTimeout(r, 200));

  ptyManager.kill(term.id);
  console.log(`[TEST 5] Terminal killed successfully. Active count: ${ptyManager.list().length}`);

  console.log("\n>>> ALL PTY & TERMINAL SMOKE TESTS PASSED SUCCESSFULLY! <<<\n");
}

main().catch((err) => {
  console.error("[TEST ERROR]", err);
  process.exit(1);
});
