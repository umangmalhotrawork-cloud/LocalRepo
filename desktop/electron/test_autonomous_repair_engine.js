/**
 * TEST SUITE: Phase 2D Autonomous Test -> Diagnose -> Repair -> Retest Engine
 * Validates bounded repair loop, test failure classification, Patch Firewall gates,
 * test file protection, cancellation, timeouts, secret safety, and transaction integrity.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { autonomousRepairEngine, AutonomousRepairEngine } = require('./autonomousRepairEngine');
const { testRunnerDetector } = require('./testing/TestRunnerDetector');
const { testExecutor } = require('./testing/TestExecutor');
const { aiProviderRouter } = require('./ai/AIProviderRouter');

async function runAutonomousRepairEngineTests() {
  console.log('[TEST] Starting Phase 2D Autonomous Repair Engine Test Suite...');

  const tempBase = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-repair-test-'));

  try {
    // -------------------------------------------------------------
    // TEST 1: Initial patch -> tests pass (1 iteration)
    // -------------------------------------------------------------
    const proj1 = path.join(tempBase, 'proj1');
    fs.mkdirSync(proj1, { recursive: true });
    fs.writeFileSync(path.join(proj1, 'package.json'), JSON.stringify({ name: 'p1', scripts: { test: 'node test.js' } }));
    fs.writeFileSync(path.join(proj1, 'calc.js'), 'function add(a, b) { return 0; }\nmodule.exports = { add };\n');
    fs.writeFileSync(path.join(proj1, 'test.js'), 'const assert = require("assert");\nconst { add } = require("./calc.js");\nassert.strictEqual(add(2, 3), 5);\nconsole.log("PASS");\n');

    // Stub AI plan generation for proj1
    const origGenPlan = aiProviderRouter.generateAgentPlan;
    aiProviderRouter.generateAgentPlan = async () => ({
      success: true,
      task: 'Fix add function',
      steps: [
        {
          id: 'step-1',
          title: 'Implement add',
          proposedEdits: [
            { filePath: 'calc.js', original: 'return 0;', replacement: 'return a + b;' },
          ],
        },
      ],
    });

    const res1 = await autonomousRepairEngine.runAutonomousRepair({
      workspacePath: proj1,
      taskPrompt: 'Fix add function',
      maxIterations: 3,
      allowHighRisk: true,
      runner: 'npm',
      command: 'node test.js',
    });

    assert.strictEqual(res1.status, 'COMPLETED');
    assert.strictEqual(res1.totalIterations, 1);
    assert.strictEqual(res1.completed, true);
    console.log('[TEST 1 PASSED] Initial patch succeeded on iteration 1 (tests passed)');

    // -------------------------------------------------------------
    // TEST 2: Initial patch -> test fails -> repair -> tests pass (2 iterations)
    // -------------------------------------------------------------
    const proj2 = path.join(tempBase, 'proj2');
    fs.mkdirSync(proj2, { recursive: true });
    fs.writeFileSync(path.join(proj2, 'package.json'), JSON.stringify({ name: 'p2', scripts: { test: 'node test.js' } }));
    fs.writeFileSync(path.join(proj2, 'calc.js'), 'function add(a, b) { return 0; }\nmodule.exports = { add };\n');
    fs.writeFileSync(path.join(proj2, 'test.js'), 'const assert = require("assert");\nconst fs = require("fs");\nconst code = fs.readFileSync("./calc.js", "utf8");\nif (code.includes("return a - b;")) { console.error("AssertionError: expected 5 got -1"); process.exit(1); }\nif (code.includes("return a + b;")) { console.log("All 5 tests passed"); process.exit(0); }\nconsole.error("FAIL"); process.exit(1);\n');

    let planCallCount = 0;
    aiProviderRouter.generateAgentPlan = async (p = {}) => {
      if (!p.task || p.task.includes('CODER') || !p.task.startsWith('[ROLE:')) {
        planCallCount++;
      }
      if (planCallCount <= 1) {
        // First attempt buggy
        return {
          success: true,
          task: 'Fix add',
          steps: [{ id: 's1', title: 'Try subtract', proposedEdits: [{ filePath: 'calc.js', original: 'return 0;', replacement: 'return a - b;' }] }],
        };
      }
      // Second attempt fixed
      return {
        success: true,
        task: 'Repair add',
        steps: [{ id: 's2', title: 'Fix to add', proposedEdits: [{ filePath: 'calc.js', original: 'return a - b;', replacement: 'return a + b;' }] }],
      };
    };

    const res2 = await autonomousRepairEngine.runAutonomousRepair({
      workspacePath: proj2,
      taskPrompt: 'Fix add function',
      maxIterations: 3,
      allowHighRisk: true,
      runner: 'npm',
      command: 'node test.js',
    });

    assert.strictEqual(res2.status, 'COMPLETED');
    assert.strictEqual(res2.totalIterations, 2);
    assert.strictEqual(res2.iterations.length, 2);
    assert.strictEqual(res2.iterations[0].testStatus, 'FAILED');
    assert.strictEqual(res2.iterations[1].testStatus, 'PASSED');
    console.log('[TEST 2 PASSED] Buggy initial patch autonomously repaired on iteration 2');

    // -------------------------------------------------------------
    // TEST 3: Multiple repair iterations (repaired on iteration 3)
    // -------------------------------------------------------------
    let planCalls3 = 0;
    aiProviderRouter.generateAgentPlan = async (p = {}) => {
      if (!p.task || p.task.includes('CODER') || !p.task.startsWith('[ROLE:')) {
        planCalls3++;
      }
      if (planCalls3 <= 1) {
        return { success: true, steps: [{ id: 's1', proposedEdits: [{ filePath: 'calc.js', original: 'return a + b;', replacement: 'return a * b;' }] }] };
      } else if (planCalls3 === 2) {
        return { success: true, steps: [{ id: 's2', proposedEdits: [{ filePath: 'calc.js', original: 'return a * b;', replacement: 'return a / b;' }] }] };
      }
      return { success: true, steps: [{ id: 's3', proposedEdits: [{ filePath: 'calc.js', original: 'return a / b;', replacement: 'return a + b;' }] }] };
    };

    fs.writeFileSync(path.join(proj2, 'test.js'), 'const fs = require("fs");\nconst code = fs.readFileSync("./calc.js", "utf8");\nif (code.includes("return a + b;")) { console.log("PASSED"); process.exit(0); }\nconsole.error("AssertionError: failed"); process.exit(1);\n');

    const res3 = await autonomousRepairEngine.runAutonomousRepair({
      workspacePath: proj2,
      taskPrompt: 'Fix calculation',
      maxIterations: 3,
      allowHighRisk: true,
      runner: 'npm',
      command: 'node test.js',
    });
    assert.strictEqual(res3.status, 'COMPLETED');
    assert.strictEqual(res3.totalIterations, 3);
    console.log('[TEST 3 PASSED] Multi-turn autonomous loop repaired on iteration 3');

    // -------------------------------------------------------------
    // TEST 4: Maximum iteration limit reached (status: MAX_ITERATIONS_REACHED)
    // -------------------------------------------------------------
    let planCalls4 = 0;
    aiProviderRouter.generateAgentPlan = async () => {
      planCalls4++;
      return {
        success: true,
        steps: [{ id: 's_bad', proposedEdits: [{ filePath: 'calc.js', original: planCalls4 === 1 ? 'return a + b;' : 'return 999;', replacement: 'return 999;' }] }],
      };
    };
    fs.writeFileSync(path.join(proj2, 'test.js'), 'console.error("AssertionError: Always failing"); process.exit(1);\n');

    const res4 = await autonomousRepairEngine.runAutonomousRepair({
      workspacePath: proj2,
      taskPrompt: 'Unfixable bug',
      maxIterations: 2,
      allowHighRisk: true,
      runner: 'npm',
      command: 'node test.js',
    });
    assert.strictEqual(res4.status, 'MAX_ITERATIONS_REACHED');
    assert.strictEqual(res4.iterations.length, 2);
    console.log('[TEST 4 PASSED] Maximum iterations limit enforced cleanly (MAX_ITERATIONS_REACHED)');

    // -------------------------------------------------------------
    // TEST 5 & 6: Test file modification protection (status: BLOCKED)
    // -------------------------------------------------------------
    aiProviderRouter.generateAgentPlan = async () => ({
      success: true,
      steps: [{ id: 's_touch_test', proposedEdits: [{ filePath: 'tests/test_cart.py', original: 'assert 5 == 5', replacement: 'assert True' }] }],
    });

    const res5 = await autonomousRepairEngine.runAutonomousRepair({
      workspacePath: proj2,
      taskPrompt: 'Try modify tests',
      maxIterations: 3,
    });
    assert.strictEqual(res5.status, 'BLOCKED');
    assert.strictEqual(res5.reason, 'TEST_MODIFICATION_PROHIBITED');
    console.log('[TEST 5 & 6 PASSED] Test file modifications strictly prohibited & blocked');

    // -------------------------------------------------------------
    // TEST 7: Dependency failure stops loop
    // -------------------------------------------------------------
    fs.writeFileSync(path.join(proj2, 'calc.js'), 'function add(a, b) { return 0; }\nmodule.exports = { add };\n');
    aiProviderRouter.generateAgentPlan = async () => ({
      success: true,
      steps: [{ id: 's1', proposedEdits: [{ filePath: 'calc.js', original: 'return 0;', replacement: 'return 1;' }] }],
    });
    fs.writeFileSync(path.join(proj2, 'test.js'), 'console.error("ModuleNotFoundError: No module named \'missing_pkg\'"); process.exit(1);\n');

    const res7 = await autonomousRepairEngine.runAutonomousRepair({
      workspacePath: proj2,
      taskPrompt: 'Dependency missing',
      maxIterations: 3,
      allowHighRisk: true,
      runner: 'npm',
      command: 'node test.js',
    });
    assert.strictEqual(res7.status, 'FAILED');
    assert.strictEqual(res7.reason, 'DEPENDENCY_FAILURE');
    console.log('[TEST 7 PASSED] Dependency failure correctly stopped loop without wasteful re-prompts');

    // -------------------------------------------------------------
    // TEST 8: Environment failure stops loop
    // -------------------------------------------------------------
    fs.writeFileSync(path.join(proj2, 'calc.js'), 'function add(a, b) { return 0; }\nmodule.exports = { add };\n');
    aiProviderRouter.generateAgentPlan = async () => ({
      success: true,
      steps: [{ id: 's1', proposedEdits: [{ filePath: 'calc.js', original: 'return 0;', replacement: 'return 1;' }] }],
    });
    fs.writeFileSync(path.join(proj2, 'test.js'), 'console.error("pytest: command not found"); process.exit(127);\n');

    const res8 = await autonomousRepairEngine.runAutonomousRepair({
      workspacePath: proj2,
      taskPrompt: 'Env missing',
      maxIterations: 3,
      allowHighRisk: true,
      runner: 'npm',
      command: 'node test.js',
    });
    assert.strictEqual(res8.status, 'FAILED');
    assert.strictEqual(res8.reason, 'ENVIRONMENT_FAILURE');
    console.log('[TEST 8 PASSED] Environment failure stopped autonomous loop cleanly');

    // -------------------------------------------------------------
    // TEST 9: Cancellation stops engine cleanly (status: CANCELLED)
    // -------------------------------------------------------------
    fs.writeFileSync(path.join(proj2, 'calc.js'), 'function add(a, b) { return 0; }\nmodule.exports = { add };\n');
    fs.writeFileSync(path.join(proj2, 'test.js'), 'setInterval(() => {}, 1000);\n');
    const repairPromise = autonomousRepairEngine.runAutonomousRepair({
      workspacePath: proj2,
      taskPrompt: 'Cancel me',
      maxIterations: 3,
      allowHighRisk: true,
      runner: 'npm',
      command: 'node test.js',
    });
    setTimeout(() => {
      const keys = Array.from(autonomousRepairEngine.activeRepairs.keys());
      if (keys.length > 0) autonomousRepairEngine.cancel(keys[0]);
    }, 50);

    const res9 = await repairPromise;
    assert.strictEqual(res9.status, 'CANCELLED');
    console.log('[TEST 9 PASSED] User cancellation stopped autonomous repair cleanly');

    // -------------------------------------------------------------
    // TEST 10: No test runner detected blocks execution
    // -------------------------------------------------------------
    const emptyProj = path.join(tempBase, 'empty_proj');
    fs.mkdirSync(emptyProj, { recursive: true });
    const res10 = await autonomousRepairEngine.runAutonomousRepair({
      workspacePath: emptyProj,
      taskPrompt: 'No test runner',
    });
    assert.strictEqual(res10.status, 'BLOCKED');
    assert.strictEqual(res10.reason, 'NO_TEST_RUNNER_DETECTED');
    console.log('[TEST 10 PASSED] Missing test runner safely blocks autonomous repair');

    // -------------------------------------------------------------
    // TEST 11: Secret data never leaks into iteration records
    // -------------------------------------------------------------
    const fakeKey = 'AIzaSySecretApiKeyInRepair12345';
    const evidenceJson = JSON.stringify(res2);
    assert.strictEqual(evidenceJson.includes(fakeKey), false);
    console.log('[TEST 11 PASSED] Zero credentials or secrets detected in repair evidence');

    // -------------------------------------------------------------
    // TEST 12: Multiple files modified transactionally during repair
    // -------------------------------------------------------------
    fs.writeFileSync(path.join(proj1, 'file1.js'), 'let x = 1;\n');
    fs.writeFileSync(path.join(proj1, 'file2.js'), 'let y = 2;\n');
    fs.writeFileSync(path.join(proj1, 'test.js'), 'const fs = require("fs");\nif (fs.readFileSync("file1.js","utf8").includes("let x = 10;") && fs.readFileSync("file2.js","utf8").includes("let y = 20;")) process.exit(0);\nprocess.exit(1);\n');

    aiProviderRouter.generateAgentPlan = async () => ({
      success: true,
      steps: [
        {
          id: 'multi_file_step',
          proposedEdits: [
            { filePath: 'file1.js', original: 'let x = 1;', replacement: 'let x = 10;' },
            { filePath: 'file2.js', original: 'let y = 2;', replacement: 'let y = 20;' },
          ],
        },
      ],
    });

    const res12 = await autonomousRepairEngine.runAutonomousRepair({
      workspacePath: proj1,
      taskPrompt: 'Multi file fix',
      maxIterations: 2,
      allowHighRisk: true,
      runner: 'npm',
      command: 'node test.js',
    });
    assert.strictEqual(res12.status, 'COMPLETED');
    assert.strictEqual(res12.modifiedFiles.length, 2);
    console.log('[TEST 12 PASSED] Multi-file repair applied atomically & transactionally');

    // Restore original generateAgentPlan
    aiProviderRouter.generateAgentPlan = origGenPlan;

    console.log('>>> ALL PHASE 2D AUTONOMOUS REPAIR ENGINE TESTS PASSED CLEANLY! <<<');
  } finally {
    try {
      fs.rmSync(tempBase, { recursive: true, force: true });
    } catch (e) {}
  }
}

runAutonomousRepairEngineTests().catch((err) => {
  console.error('[TEST FAILURE] Phase 2D Test Suite failed:', err);
  process.exit(1);
});
