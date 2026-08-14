const fs = require('fs');
const path = require('path');
const os = require('os');
const { testManager } = require('../electron/testManager');

async function main() {
  console.log("[TEST] Starting Test Explorer & Coverage Dashboard (Phase 1) Test Suite...");

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echo_test_runner_'));
  console.log(`[SETUP] Created sandbox test workspace: ${tempDir}`);

  try {
    // 1. Setup Pytest file
    const pytestFile = path.join(tempDir, 'test_calculator.py');
    fs.writeFileSync(pytestFile, `
def test_addition():
    assert 1 + 1 == 2

def test_subtraction():
    assert 5 - 3 == 2
`, 'utf8');

    // 2. Setup Unittest file
    const unittestFile = path.join(tempDir, 'test_auth.py');
    fs.writeFileSync(unittestFile, `
import unittest

class TestAuthentication(unittest.TestCase):
    def test_login_success(self):
        self.assertTrue(True)

    def test_invalid_token(self):
        self.assertEqual(401, 401)
`, 'utf8');

    // 3. Setup Jest file
    const jestFile = path.join(tempDir, 'cart.test.ts');
    fs.writeFileSync(jestFile, `
describe("Cart Module", () => {
  test("calculates item total", () => {
    expect(10).toBe(10);
  });

  it("applies voucher discount", () => {
    expect(5).toBe(5);
  });
});
`, 'utf8');

    // 4. Setup Vitest file
    const vitestFile = path.join(tempDir, 'invoice.spec.js');
    fs.writeFileSync(vitestFile, `
import { describe, it, expect } from 'vitest';

describe("Invoice PDF Generation", () => {
  it("formats currency correctly", () => {
    expect("$10.00").toBe("$10.00");
  });
});
`, 'utf8');

    // Ignored directory
    const ignoredDir = path.join(tempDir, 'node_modules', 'some_pkg');
    fs.mkdirSync(ignoredDir, { recursive: true });
    fs.writeFileSync(path.join(ignoredDir, 'test_ignored.py'), 'def test_ignore(): pass');

    // --- TEST 1: Pytest Discovery ---
    const pyTests = testManager.parsePythonTests(pytestFile, fs.readFileSync(pytestFile, 'utf8'));
    console.log(`[TEST 1] Pytest discovery count: ${pyTests.length}`);
    if (pyTests.length !== 2 || pyTests[0].name !== 'test_addition') {
      throw new Error("Test 1 failed: Pytest functions not discovered correctly");
    }

    // --- TEST 2: Unittest Discovery ---
    const unitTests = testManager.parsePythonTests(unittestFile, fs.readFileSync(unittestFile, 'utf8'));
    console.log(`[TEST 2] Unittest discovery count: ${unitTests.length}, suite children: ${unitTests[0]?.children?.length}`);
    if (unitTests.length !== 1 || unitTests[0].children.length !== 2) {
      throw new Error("Test 2 failed: Unittest class / methods not discovered correctly");
    }

    // --- TEST 3: Jest Discovery ---
    const jestTests = testManager.parseJsTsTests(jestFile, fs.readFileSync(jestFile, 'utf8'));
    console.log(`[TEST 3] Jest discovery count: ${jestTests.length}, describe children: ${jestTests[0]?.children?.length}`);
    if (jestTests.length !== 1 || jestTests[0].children.length !== 2) {
      throw new Error("Test 3 failed: Jest describe / test blocks not discovered");
    }

    // --- TEST 4: Vitest Discovery ---
    const vitestTests = testManager.parseJsTsTests(vitestFile, fs.readFileSync(vitestFile, 'utf8'));
    console.log(`[TEST 4] Vitest discovery count: ${vitestTests.length}, framework: ${vitestTests[0]?.framework}`);
    if (vitestTests.length !== 1 || vitestTests[0].framework !== 'vitest') {
      throw new Error("Test 4 failed: Vitest framework not detected");
    }

    // --- TEST 5: Single Test Execution ---
    const singleRes = await testManager.runTest({
      workspacePath: tempDir,
      testId: `${pytestFile}::test_addition`,
      filePath: pytestFile,
      testName: 'test_addition',
      framework: 'pytest',
    });
    console.log(`[TEST 5] Single test execution: status=${singleRes.status}, duration=${singleRes.durationMs}ms`);
    if (!singleRes || !singleRes.status) {
      throw new Error("Test 5 failed: Single test execution failed");
    }

    // --- TEST 6: File Test Execution ---
    const fileRes = await testManager.runFile({
      workspacePath: tempDir,
      filePath: pytestFile,
      framework: 'pytest',
    });
    console.log(`[TEST 6] File execution: status=${fileRes.status}`);
    if (!fileRes || !fileRes.command) {
      throw new Error("Test 6 failed: File execution failed");
    }

    // --- TEST 7: Workspace Test Execution ---
    const allRes = await testManager.runAll({ workspacePath: tempDir });
    console.log(`[TEST 7] Workspace execution: totalFiles=${allRes.totalFiles}, passed=${allRes.passedCount}`);
    if (!allRes.success || allRes.totalFiles !== 4) {
      throw new Error("Test 7 failed: Workspace execution file count mismatch");
    }

    // --- TEST 8: Coverage Parsing ---
    const covRes = await testManager.getCoverage({ workspacePath: tempDir });
    console.log(`[TEST 8] Coverage: overall=${covRes.overallCoveragePct}%, files=${covRes.files.length}`);
    if (!covRes.success || covRes.files.length === 0 || covRes.overallCoveragePct <= 0) {
      throw new Error("Test 8 failed: Coverage parsing failed");
    }

    // --- TEST 9: Failure Line Extraction ---
    const traceSample = `
Traceback (most recent call last):
  File "${pytestFile}", line 14, in test_broken
    assert 1 == 2
AssertionError: assert 1 == 2
`;
    const failInfo = testManager.extractFailureInfo(traceSample, '');
    console.log(`[TEST 9] Failure extraction: line=${failInfo.failureLine}, msg='${failInfo.failureMessage}'`);
    if (failInfo.failureLine !== 14 || !failInfo.failureMessage?.includes('AssertionError')) {
      throw new Error("Test 9 failed: Failure line extraction mismatch");
    }

    // --- TEST 10: Ignore Directory Filtering ---
    const discovery = testManager.discoverTests(tempDir);
    console.log(`[TEST 10] Discovered files count: ${discovery.testFiles.length}`);
    const foundIgnored = discovery.testFiles.some((f) => f.filePath.includes('node_modules'));
    if (foundIgnored) {
      throw new Error("Test 10 failed: node_modules directory was not ignored");
    }

    console.log("\n>>> ALL 10 TEST MANAGER & COVERAGE TESTS PASSED SUCCESSFULLY! <<<\n");
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
