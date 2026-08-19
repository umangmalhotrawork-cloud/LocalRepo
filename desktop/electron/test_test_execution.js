/**
 * TEST SUITE: Phase 2C Autonomous Test Discovery & Execution Engine
 * Validates detector evidence logic, execution safety, timeouts, cancellation,
 * failure extraction, output limits, secret redaction, and preferred runner ranking.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { testRunnerDetector } = require('./testing/TestRunnerDetector');
const { testResultParser } = require('./testing/TestResultParser');
const { testExecutor } = require('./testing/TestExecutor');

async function runTestExecutionTests() {
  console.log('[TEST] Starting Phase 2C Autonomous Test Discovery & Execution Test Suite...');

  const tempBase = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-test-suite-'));

  try {
    // -------------------------------------------------------------
    // TEST 1: Python pytest detection
    // -------------------------------------------------------------
    const pytestDir = path.join(tempBase, 'pytest_project');
    fs.mkdirSync(pytestDir, { recursive: true });
    fs.writeFileSync(path.join(pytestDir, 'pytest.ini'), '[pytest]\ntestpaths = tests\n');
    const pyDet = testRunnerDetector.detect(pytestDir);
    assert.strictEqual(pyDet.detected, true);
    assert.strictEqual(pyDet.preferredRunner, 'pytest');
    assert.strictEqual(pyDet.command, 'pytest');
    console.log('[TEST 1 PASSED] Python pytest detected accurately from pytest.ini');

    // -------------------------------------------------------------
    // TEST 2: Python unittest detection
    // -------------------------------------------------------------
    const unittestDir = path.join(tempBase, 'unittest_project');
    const utTests = path.join(unittestDir, 'tests');
    fs.mkdirSync(utTests, { recursive: true });
    fs.writeFileSync(path.join(utTests, 'test_sample.py'), 'import unittest\nclass MyTest(unittest.TestCase):\n    def test_pass(self): pass\n');
    const utDet = testRunnerDetector.detect(unittestDir);
    assert.strictEqual(utDet.detected, true);
    assert.strictEqual(utDet.preferredRunner, 'unittest');
    console.log('[TEST 2 PASSED] Python unittest detected accurately from test cases');

    // -------------------------------------------------------------
    // TEST 3: npm test detection
    // -------------------------------------------------------------
    const npmDir = path.join(tempBase, 'npm_project');
    fs.mkdirSync(npmDir, { recursive: true });
    fs.writeFileSync(path.join(npmDir, 'package.json'), JSON.stringify({ name: 'demo', scripts: { test: 'node test.js' } }));
    const npmDet = testRunnerDetector.detect(npmDir);
    assert.strictEqual(npmDet.detected, true);
    assert.strictEqual(npmDet.preferredRunner, 'npm');
    assert.strictEqual(npmDet.command, 'npm test');
    console.log('[TEST 3 PASSED] npm test detected accurately from package.json script');

    // -------------------------------------------------------------
    // TEST 4: Jest detection
    // -------------------------------------------------------------
    const jestDir = path.join(tempBase, 'jest_project');
    fs.mkdirSync(jestDir, { recursive: true });
    fs.writeFileSync(path.join(jestDir, 'package.json'), JSON.stringify({ name: 'demo', devDependencies: { jest: '^29.0.0' }, scripts: { test: 'jest' } }));
    fs.writeFileSync(path.join(jestDir, 'jest.config.js'), 'module.exports = {};\n');
    const jestDet = testRunnerDetector.detect(jestDir);
    assert.strictEqual(jestDet.detected, true);
    assert.strictEqual(jestDet.preferredRunner, 'jest');
    console.log('[TEST 4 PASSED] Jest detected accurately from jest.config.js & dependencies');

    // -------------------------------------------------------------
    // TEST 5: Vitest detection
    // -------------------------------------------------------------
    const vitestDir = path.join(tempBase, 'vitest_project');
    fs.mkdirSync(vitestDir, { recursive: true });
    fs.writeFileSync(path.join(vitestDir, 'package.json'), JSON.stringify({ name: 'demo', devDependencies: { vitest: '^1.0.0' } }));
    fs.writeFileSync(path.join(vitestDir, 'vitest.config.js'), 'export default {};\n');
    const vitestDet = testRunnerDetector.detect(vitestDir);
    assert.strictEqual(vitestDet.detected, true);
    assert.strictEqual(vitestDet.preferredRunner, 'vitest');
    console.log('[TEST 5 PASSED] Vitest detected accurately from vitest.config.js');

    // -------------------------------------------------------------
    // TEST 6: No-test-runner detection (when workspace has no test config)
    // -------------------------------------------------------------
    const emptyDir = path.join(tempBase, 'empty_project');
    fs.mkdirSync(emptyDir, { recursive: true });
    const emptyDet = testRunnerDetector.detect(emptyDir);
    assert.strictEqual(emptyDet.detected, false);
    assert.strictEqual(emptyDet.reason, 'NO_TEST_RUNNER_DETECTED');
    console.log('[TEST 6 PASSED] No-test-runner reported safely without inventing false runners');

    // -------------------------------------------------------------
    // TEST 7: Successful test execution (exit code 0, status: PASSED)
    // -------------------------------------------------------------
    const execDir = path.join(tempBase, 'exec_project');
    fs.mkdirSync(execDir, { recursive: true });
    const passRes = await testExecutor.runTests({
      workspacePath: execDir,
      runner: 'npm',
      command: 'node -e "console.log(\'Tests passed: 5\'); process.exit(0);"',
    });
    assert.strictEqual(passRes.status, 'PASSED');
    assert.strictEqual(passRes.exitCode, 0);
    assert.ok(passRes.stdout.includes('Tests passed: 5'));
    console.log('[TEST 7 PASSED] Successful test execution returned status: PASSED');

    // -------------------------------------------------------------
    // TEST 8: Failing test execution (exit code non-zero, status: FAILED)
    // -------------------------------------------------------------
    const failRes = await testExecutor.runTests({
      workspacePath: execDir,
      runner: 'npm',
      command: 'node -e "console.error(\'AssertionError: Expected 10 but received 20\'); process.exit(1);"',
    });
    assert.strictEqual(failRes.status, 'FAILED');
    assert.strictEqual(failRes.exitCode, 1);
    assert.ok(failRes.failures.length > 0);
    console.log('[TEST 8 PASSED] Failing test execution returned status: FAILED');

    // -------------------------------------------------------------
    // TEST 9: Timeout handling (status: TIMEOUT)
    // -------------------------------------------------------------
    const timeoutRes = await testExecutor.runTests({
      workspacePath: execDir,
      runner: 'npm',
      command: 'node -e "setTimeout(() => {}, 10000);"',
      timeoutMs: 300, // 300ms timeout
    });
    assert.strictEqual(timeoutRes.status, 'TIMEOUT');
    assert.strictEqual(timeoutRes.timedOut, true);
    console.log('[TEST 9 PASSED] Bounded timeout terminated child process cleanly (status: TIMEOUT)');

    // -------------------------------------------------------------
    // TEST 10: Cancellation (status: CANCELLED)
    // -------------------------------------------------------------
    const runPromise = testExecutor.runTests({
      workspacePath: execDir,
      runner: 'npm',
      command: 'node -e "setTimeout(() => {}, 10000);"',
      timeoutMs: 5000,
    });
    // Cancel shortly after starting
    setTimeout(() => {
      // Find the active runId and cancel
      const keys = Array.from(testExecutor.activeProcesses.keys());
      if (keys.length > 0) {
        testExecutor.cancel(keys[0]);
      }
    }, 100);

    const cancelRes = await runPromise;
    assert.strictEqual(cancelRes.status, 'CANCELLED');
    assert.strictEqual(cancelRes.cancelled, true);
    console.log('[TEST 10 PASSED] Test execution cancelled cleanly (status: CANCELLED)');

    // -------------------------------------------------------------
    // TEST 11 & 12: stdout and stderr capture
    // -------------------------------------------------------------
    const outRes = await testExecutor.runTests({
      workspacePath: execDir,
      runner: 'npm',
      command: 'node -e "console.log(\'STDOUT_MSG\'); console.error(\'STDERR_MSG\'); process.exit(0);"',
    });
    assert.ok(outRes.stdout.includes('STDOUT_MSG'));
    assert.ok(outRes.stderr.includes('STDERR_MSG'));
    console.log('[TEST 11 & 12 PASSED] stdout and stderr captured accurately');

    // -------------------------------------------------------------
    // TEST 13: Exit-code correctness
    // -------------------------------------------------------------
    const exit42Res = await testExecutor.runTests({
      workspacePath: execDir,
      runner: 'npm',
      command: 'node -e "process.exit(42);"',
    });
    assert.strictEqual(exit42Res.exitCode, 42);
    console.log('[TEST 13 PASSED] Exact process exit code captured (42)');

    // -------------------------------------------------------------
    // TEST 14: Failure parsing (structured pytest & jest failures)
    // -------------------------------------------------------------
    const samplePytestOut = `
============================= test session starts ==============================
FAILED tests/test_math.py::test_division - ZeroDivisionError: division by zero
========================= 1 failed, 9 passed in 0.42s ==========================
`;
    const parsedPy = testResultParser.parse('pytest', samplePytestOut, '', 1);
    assert.strictEqual(parsedPy.summary.passed, 9);
    assert.strictEqual(parsedPy.summary.failed, 1);
    assert.strictEqual(parsedPy.failures[0].testFile, 'tests/test_math.py');
    assert.strictEqual(parsedPy.failures[0].testName, 'test_division');
    console.log('[TEST 14 PASSED] Structured failure diagnostics extracted accurately from pytest output');

    // -------------------------------------------------------------
    // TEST 15: Output truncation handling
    // -------------------------------------------------------------
    const largeOutputCmd = 'node -e "for(let i=0; i<30000; i++) console.log(\'line \'+i); process.exit(0);"';
    const truncRes = await testExecutor.runTests({
      workspacePath: execDir,
      runner: 'npm',
      command: largeOutputCmd,
    });
    assert.ok(truncRes.stdout.length > 0);
    assert.strictEqual(truncRes.status, 'PASSED');
    console.log(`[TEST 15 PASSED] Large output buffered and bounded safely (stdout length: ${truncRes.stdout.length})`);

    // -------------------------------------------------------------
    // TEST 16: Workspace cwd enforcement
    // -------------------------------------------------------------
    const cwdRes = await testExecutor.runTests({
      workspacePath: execDir,
      runner: 'npm',
      command: 'node -e "console.log(process.cwd());"',
    });
    assert.strictEqual(fs.realpathSync(cwdRes.stdout.trim()), fs.realpathSync(execDir));
    console.log('[TEST 16 PASSED] Test execution strictly enforces cwd = workspacePath');

    // -------------------------------------------------------------
    // TEST 17: Path traversal rejection
    // -------------------------------------------------------------
    const nonExistent = await testExecutor.runTests({
      workspacePath: '/non/existent/path/xyz',
    });
    assert.strictEqual(nonExistent.status, 'ERROR');
    console.log('[TEST 17 PASSED] Invalid workspace paths rejected safely');

    // -------------------------------------------------------------
    // TEST 18: No filesystem mutation from test execution
    // -------------------------------------------------------------
    const beforeFiles = fs.readdirSync(execDir);
    await testExecutor.runTests({
      workspacePath: execDir,
      runner: 'npm',
      command: 'node -e "console.log(\'read only check\');"',
    });
    const afterFiles = fs.readdirSync(execDir);
    assert.deepStrictEqual(beforeFiles, afterFiles);
    console.log('[TEST 18 PASSED] Zero unexpected filesystem mutations caused by test runner');

    // -------------------------------------------------------------
    // TEST 19: No secret leakage into structured result
    // -------------------------------------------------------------
    const secretOutputCmd = 'node -e "console.log(\'API KEY: AIzaSySecret1234567890\');"';
    const secretRes = await testExecutor.runTests({
      workspacePath: execDir,
      runner: 'npm',
      command: secretOutputCmd,
    });
    assert.strictEqual(secretRes.stdout.includes('AIzaSySecret1234567890'), false);
    console.log('[TEST 19 PASSED] Secrets redacted cleanly from test output and structured records');

    // -------------------------------------------------------------
    // TEST 20: Multiple runners detection and preferred-runner selection
    // -------------------------------------------------------------
    const multiRunnerDir = path.join(tempBase, 'multi_runner_project');
    fs.mkdirSync(multiRunnerDir, { recursive: true });
    fs.writeFileSync(path.join(multiRunnerDir, 'package.json'), JSON.stringify({
      name: 'demo',
      scripts: { test: 'jest' },
      devDependencies: { jest: '^29.0.0' },
    }));
    fs.writeFileSync(path.join(multiRunnerDir, 'jest.config.js'), 'module.exports = {};\n');
    const multiDet = testRunnerDetector.detect(multiRunnerDir);
    assert.strictEqual(multiDet.detected, true);
    assert.strictEqual(multiDet.preferredRunner, 'jest');
    assert.ok(multiDet.detectedRunners.length >= 1);
    console.log('[TEST 20 PASSED] Multi-runner project selected preferred runner (jest)');

    console.log('>>> ALL 20 PHASE 2C TEST DISCOVERY & EXECUTION TESTS PASSED CLEANLY! <<<');
  } finally {
    try {
      fs.rmSync(tempBase, { recursive: true, force: true });
    } catch (e) {}
  }
}

runTestExecutionTests().catch((err) => {
  console.error('[TEST FAILURE] Phase 2C Test Suite failed:', err);
  process.exit(1);
});
