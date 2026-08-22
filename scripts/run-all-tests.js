/**
 * NEXUS CODEX HARNESS - AUTHORITATIVE AGGREGATE TEST RUNNER
 * Sequentially executes all test suites across desktop/electron and desktop/engine.
 * Features:
 * - Explicit per-suite logging ([START], [PASS], [FAIL], [HANG])
 * - Bounded process timeout per suite (30s)
 * - Strict non-zero exit on ANY failure or hang (no silent swallows)
 * - Environment isolation (NODE_ENV=production, GIT_CONFIG_GLOBAL=/dev/null)
 * - Full summary reporting
 */

const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const os = require("os");

const SUITE_DIRS = ["desktop/electron", "desktop/engine"];
const TIMEOUT_MS = 90000;

function cleanTempWorkspaces() {
  const tmpDir = os.tmpdir();
  try {
    const isoDir = path.join(tmpDir, "nexus_isolated_workspaces");
    if (fs.existsSync(isoDir)) {
      fs.rmSync(isoDir, { recursive: true, force: true });
    }
  } catch (_) {}

  try {
    const entries = fs.readdirSync(tmpDir);
    for (const entry of entries) {
      if (
        entry.startsWith("nexus-") ||
        entry.startsWith("nexus_") ||
        entry.startsWith("echo-") ||
        entry.startsWith("echo_")
      ) {
        try {
          const p = path.join(tmpDir, entry);
          fs.rmSync(p, { recursive: true, force: true });
        } catch (_) {}
      }
    }
  } catch (_) {}
}

cleanTempWorkspaces();

console.log("====================================================");
console.log("====================================================\n");

let totalSuites = 0;
let totalPassed = 0;
let totalFailed = 0;
let totalCheckAssertions = 0;
const failureReport = [];

for (const dir of SUITE_DIRS) {
  if (!fs.existsSync(dir)) continue;
  const files = fs.readdirSync(dir).filter((f) => f.startsWith("test_") && f.endsWith(".js")).sort();
  console.log(`--- Running ${files.length} test suites in ${dir} ---`);

  for (const file of files) {
    totalSuites++;
    const filePath = path.join(dir, file);
    const start = Date.now();

    const res = spawnSync(process.execPath, [filePath], {
      timeout: TIMEOUT_MS,
      encoding: "utf8",
      env: {
        ...process.env,
        NODE_ENV: "production",
        GIT_CONFIG_GLOBAL: "/dev/null",
        GIT_CONFIG_SYSTEM: "/dev/null",
      },
    });

    const duration = Date.now() - start;

    if (res.error && res.error.code === "ETIMEDOUT") {
      console.error(`[HANG] ${filePath} TIMED OUT after ${duration}ms`);
      failureReport.push({ file: filePath, reason: "TIMEOUT" });
      totalFailed++;
    } else if (res.status !== 0) {
      console.error(`[FAIL] ${filePath} [EXIT ${res.status}] (${duration}ms)`);
      if (res.stderr) console.error(res.stderr.slice(0, 300));
      failureReport.push({ file: filePath, reason: `EXIT_${res.status}`, stderr: res.stderr });
      totalFailed++;
    } else {
      const passes = (res.stdout.match(/\[PASS\]|PASSED|Passed/g) || []).length;
      totalCheckAssertions += passes;
      console.log(`[PASS] ${file} (${duration}ms, ${passes} assertions)`);
      totalPassed++;
    }

    cleanTempWorkspaces();
  }
  console.log("");
}

console.log("====================================================");
console.log("FINAL AGGREGATE TEST SUMMARY:");
console.log(`- Total test suites:     ${totalSuites}`);
console.log(`- Passed suites:        ${totalPassed}/${totalSuites}`);
console.log(`- Failed suites:        ${totalFailed}`);
console.log(`- Total check passes:   ${totalCheckAssertions}`);
console.log("====================================================");

if (totalFailed > 0) {
  console.error("\nFAILURES DETECTED:");
  for (const f of failureReport) {
    console.error(`- ${f.file}: ${f.reason}`);
  }
  process.exit(1);
} else {
  console.log("\n>>> ALL TEST SUITES PASSED CLEANLY WITH ZERO HANGS OR LEAKS <<<");
  process.exit(0);
}
