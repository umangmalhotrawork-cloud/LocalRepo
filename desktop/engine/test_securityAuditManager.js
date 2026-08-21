const fs = require('fs');
const path = require('path');
const os = require('os');
const { securityAuditManager } = require('../electron/securityAuditManager');

async function main() {
  console.log("[TEST] Starting Security & Dependency Audit (Milestone 41) Test Suite...");

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echo_sec_audit_'));
  console.log(`[SETUP] Sandbox test workspace: ${tempDir}`);

  try {
    // 1. Setup file with OpenAI and GitHub secrets
    const secretsFile = path.join(tempDir, 'secrets.py');
    fs.writeFileSync(secretsFile, `
OPENAI_API_KEY = "sk-abcdef1234567890abcdef1234567890"
GITHUB_TOKEN = "ghp_1234567890abcdefghijklmnopqrstuvwxyz"
`, 'utf8');

    // 2. Setup file with AWS key
    const awsFile = path.join(tempDir, 'aws_config.ts');
    fs.writeFileSync(awsFile, `
const AWS_ACCESS_KEY = "AKIA1234567890ABCDEF";
`, 'utf8');

    // 3. Setup file with JWT
    const jwtFile = path.join(tempDir, 'auth.js');
    fs.writeFileSync(jwtFile, `
const token = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTY3ODkwIiwibmFtZSI6IkpvaG4gRG9lIiwiaWF0IjoxNTE2MjM5MDIyfQ.SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
`, 'utf8');

    // 4. Setup file with eval
    const evalFile = path.join(tempDir, 'calculator.js');
    fs.writeFileSync(evalFile, `
function calculate(expr) {
  return eval(expr);
}
`, 'utf8');

    // 5. Setup file with execSync
    const execFile = path.join(tempDir, 'deploy.ts');
    fs.writeFileSync(execFile, `
const child_process = require('child_process');
child_process.execSync("rm -rf /tmp/cache");
`, 'utf8');

    // 6. Setup file with shell=True
    const shellFile = path.join(tempDir, 'backup.py');
    fs.writeFileSync(shellFile, `
import subprocess
subprocess.run("tar -czf backup.tar.gz /data", shell=True)
`, 'utf8');

    // 7. Setup package.json with vulnerable dependency
    const pkgFile = path.join(tempDir, 'package.json');
    fs.writeFileSync(pkgFile, JSON.stringify({
      name: "test-app",
      dependencies: {
        "lodash": "4.17.15",
        "axios": "0.19.0"
      }
    }, null, 2), 'utf8');

    // Setup requirements.txt with vulnerable dependency
    const reqFile = path.join(tempDir, 'requirements.txt');
    fs.writeFileSync(reqFile, "requests==2.28.0\nflask==2.1.0\n", 'utf8');

    // 8. Setup ignored directory with fake secret
    const ignoredDir = path.join(tempDir, 'node_modules', 'fake_dep');
    fs.mkdirSync(ignoredDir, { recursive: true });
    fs.writeFileSync(path.join(ignoredDir, 'index.js'), 'const secret = "sk-fakeignoredkey1234567890";');

    // --- EXECUTE AUDIT SCAN ---
    const report = securityAuditManager.scanWorkspace(tempDir);
    console.log(`[SCAN RESULT] Total findings: ${report.findings.length}, Critical: ${report.summary.critical}, High: ${report.summary.high}`);

    // --- TEST 1: Secret Detection (OpenAI/GitHub) ---
    const openAiFinding = report.findings.find((f) => f.id.startsWith('SEC-OPENAI'));
    const ghFinding = report.findings.find((f) => f.id.startsWith('SEC-GITHUB'));
    console.log(`[TEST 1] Secret detection: openAI=${!!openAiFinding}, github=${!!ghFinding}`);
    if (!openAiFinding || !ghFinding) throw new Error("Test 1 failed: Secrets not detected");

    // --- TEST 2: AWS Key Detection ---
    const awsFinding = report.findings.find((f) => f.id.startsWith('SEC-AWS'));
    console.log(`[TEST 2] AWS key detection: found=${!!awsFinding}, sev=${awsFinding?.severity}`);
    if (!awsFinding || awsFinding.severity !== 'critical') throw new Error("Test 2 failed: AWS key not detected as critical");

    // --- TEST 3: JWT Detection ---
    const jwtFinding = report.findings.find((f) => f.id.startsWith('SEC-JWT'));
    console.log(`[TEST 3] JWT detection: found=${!!jwtFinding}`);
    if (!jwtFinding) throw new Error("Test 3 failed: JWT not detected");

    // --- TEST 4: eval() Detection ---
    const evalFinding = report.findings.find((f) => f.id.startsWith('PAT-EVAL'));
    console.log(`[TEST 4] eval() pattern: found=${!!evalFinding}, line=${evalFinding?.line}`);
    if (!evalFinding || evalFinding.line !== 3) throw new Error("Test 4 failed: eval() not detected at line 3");

    // --- TEST 5: execSync Detection ---
    const execFinding = report.findings.find((f) => f.id.startsWith('PAT-EXEC'));
    console.log(`[TEST 5] execSync pattern: found=${!!execFinding}`);
    if (!execFinding) throw new Error("Test 5 failed: execSync not detected");

    // --- TEST 6: shell=True Detection ---
    const shellFinding = report.findings.find((f) => f.id.startsWith('PAT-SHELL-TRUE'));
    console.log(`[TEST 6] shell=True pattern: found=${!!shellFinding}`);
    if (!shellFinding) throw new Error("Test 6 failed: shell=True not detected");

    // --- TEST 7: Dependency Advisory Match ---
    const lodashDep = report.findings.find((f) => f.id.includes('DEP-NPM-lodash'));
    const reqDep = report.findings.find((f) => f.id.includes('DEP-PY-requests'));
    console.log(`[TEST 7] Dependency advisories: lodash=${!!lodashDep}, requests=${!!reqDep}`);
    if (!lodashDep || !reqDep) throw new Error("Test 7 failed: Dependency advisories not matched");

    // --- TEST 8: Ignore Directory Exclusion ---
    const nodeModulesFinding = report.findings.find((f) => f.file.includes('node_modules'));
    console.log(`[TEST 8] node_modules exclusion: excluded=${!nodeModulesFinding}`);
    if (nodeModulesFinding) throw new Error("Test 8 failed: node_modules was not ignored");

    // --- TEST 9: Markdown Export Validity ---
    const mdExport = securityAuditManager.exportReport(report, 'markdown');
    console.log(`[TEST 9] Markdown export: length=${mdExport.content.length}`);
    if (!mdExport.success || (!mdExport.content.includes('# NEXUS Security') && !mdExport.content.includes('# Echo Nullity Security')) || !mdExport.content.includes('## Findings')) {
      throw new Error("Test 9 failed: Markdown export format invalid");
    }

    // --- TEST 10: Deterministic Output Ordering ---
    const severities = report.findings.map((f) => f.severity);
    const weightMap = { critical: 4, high: 3, medium: 2, low: 1, info: 0 };
    for (let i = 0; i < severities.length - 1; i++) {
      if (weightMap[severities[i]] < weightMap[severities[i + 1]]) {
        throw new Error("Test 10 failed: Findings not sorted by descending severity");
      }
    }
    console.log(`[TEST 10] Deterministic ordering verified (top severity: ${severities[0]})`);

    console.log("\n>>> ALL SECURITY AUDIT TESTS PASSED SUCCESSFULLY! <<<\n");
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

main().catch((err) => {
  console.error("[TEST ERROR]", err);
  process.exit(1);
});
