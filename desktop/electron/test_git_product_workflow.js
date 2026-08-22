/**
 * test_git_product_workflow.js
 * Comprehensive 18-scenario test suite for Milestone 26: Git Workflow UX Completion.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const simpleGit = require('simple-git');
const gitManager = require('./gitManager');

let passedTests = 0;
let totalTests = 0;

function runScenario(name, fn) {
  totalTests++;
  try {
    fn();
    console.log(`  ✓ Scenario ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ Scenario ${totalTests} FAILED: ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

async function runScenarioAsync(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ Scenario ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ Scenario ${totalTests} FAILED: ${name}`);
    console.error(`    ${err.message}`);
    throw err;
  }
}

function createTempGitRepo() {
  const tmpBase = path.join(__dirname, '../../tmp_test_repos');
  if (!fs.existsSync(tmpBase)) {
    fs.mkdirSync(tmpBase, { recursive: true });
  }
  const tmpDir = fs.mkdtempSync(path.join(tmpBase, 'nexus-git-test-'));
  return tmpDir;
}

function cleanupDir(dirPath) {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch (e) {}
}

async function main() {
  process.env.GIT_CONFIG_GLOBAL = '/dev/null';
  process.env.GIT_CONFIG_SYSTEM = '/dev/null';
  process.env.GIT_CONFIG_NOSYSTEM = '1';

  console.log('\n==================================================');
  console.log('MILESTONE 26: GIT WORKFLOW UX TEST SUITE');
  console.log('==================================================\n');

  const testRepo = createTempGitRepo();
  const rawGit = simpleGit(testRepo);

  try {
    // 1. Branch Name Validation - Valid names
    runScenario('validateBranchName accepts valid branch names', () => {
      assert.strictEqual(gitManager.validateBranchName('feature/login').valid, true);
      assert.strictEqual(gitManager.validateBranchName('bugfix-123').valid, true);
      assert.strictEqual(gitManager.validateBranchName('user/john_doe/fix').valid, true);
      assert.strictEqual(gitManager.validateBranchName('release-2.0.0').valid, true);
    });

    // 2. Branch Name Validation - Empty & Whitespace
    runScenario('validateBranchName rejects empty strings and whitespace-only', () => {
      assert.strictEqual(gitManager.validateBranchName('').valid, false);
      assert.strictEqual(gitManager.validateBranchName('   ').valid, false);
      assert.strictEqual(gitManager.validateBranchName(null).valid, false);
    });

    // 3. Branch Name Validation - Contains spaces
    runScenario('validateBranchName rejects names containing spaces', () => {
      const res = gitManager.validateBranchName('feature login');
      assert.strictEqual(res.valid, false);
      assert.ok(res.error.includes('whitespace'));
    });

    // 4. Branch Name Validation - Leading/trailing slashes
    runScenario('validateBranchName rejects leading or trailing slashes', () => {
      assert.strictEqual(gitManager.validateBranchName('/feature').valid, false);
      assert.strictEqual(gitManager.validateBranchName('feature/').valid, false);
    });

    // 5. Branch Name Validation - Leading/trailing periods
    runScenario('validateBranchName rejects leading or trailing periods', () => {
      assert.strictEqual(gitManager.validateBranchName('.feature').valid, false);
      assert.strictEqual(gitManager.validateBranchName('feature.').valid, false);
    });

    // 6. Branch Name Validation - Ending with .lock
    runScenario('validateBranchName rejects names ending with .lock', () => {
      const res = gitManager.validateBranchName('feature.lock');
      assert.strictEqual(res.valid, false);
      assert.ok(res.error.includes('.lock'));
    });

    // 7. Branch Name Validation - Starting with hyphen
    runScenario('validateBranchName rejects names starting with hyphen', () => {
      const res = gitManager.validateBranchName('-feature');
      assert.strictEqual(res.valid, false);
      assert.ok(res.error.includes('hyphen'));
    });

    // 8. Branch Name Validation - Invalid characters
    runScenario('validateBranchName rejects names with invalid characters (~, ^, :, ?, *, [, @{, ..)', () => {
      assert.strictEqual(gitManager.validateBranchName('feature..login').valid, false);
      assert.strictEqual(gitManager.validateBranchName('feat~1').valid, false);
      assert.strictEqual(gitManager.validateBranchName('feat^2').valid, false);
      assert.strictEqual(gitManager.validateBranchName('feat:test').valid, false);
      assert.strictEqual(gitManager.validateBranchName('feat?test').valid, false);
      assert.strictEqual(gitManager.validateBranchName('feat*test').valid, false);
      assert.strictEqual(gitManager.validateBranchName('feat@{0}').valid, false);
    });

    // 9. Branch Name Validation - HEAD keyword
    runScenario('validateBranchName rejects "HEAD"', () => {
      const res = gitManager.validateBranchName('HEAD');
      assert.strictEqual(res.valid, false);
      assert.ok(res.error.includes('HEAD'));
    });

    // Init Repo & Commit
    await rawGit.init();
    await rawGit.addConfig('user.name', 'Nexus Tester');
    await rawGit.addConfig('user.email', 'test@nexus.dev');
    fs.writeFileSync(path.join(testRepo, 'README.md'), '# Nexus Git Test\n');
    await rawGit.add('README.md');
    await rawGit.commit('Initial commit');

    // 10. getStatus on Initialized Repo
    await runScenarioAsync('getStatus returns isRepo: true, isClean: true, hasLocalChanges: false, isDetached: false', async () => {
      const status = await gitManager.getStatus(testRepo);
      assert.strictEqual(status.isRepo, true);
      assert.strictEqual(status.isClean, true);
      assert.strictEqual(status.hasLocalChanges, false);
      assert.strictEqual(status.isDetached, false);
      assert.ok(status.currentBranch);
      assert.strictEqual(status.staged.length, 0);
      assert.strictEqual(status.unstaged.length, 0);
      assert.strictEqual(status.untracked.length, 0);
      assert.ok(status.lastCommit);
      assert.strictEqual(status.lastCommit.message, 'Initial commit');
    });

    // 11. createBranch with validation & auto checkout
    await runScenarioAsync('createBranch validates and checks out a new branch', async () => {
      const status = await gitManager.createBranch(testRepo, 'feature/tax-rules', true);
      assert.strictEqual(status.currentBranch, 'feature/tax-rules');
      assert.strictEqual(status.isClean, true);
    });

    // 12. getBranches returns all branch details
    await runScenarioAsync('getBranches returns branch list with current indicator and tracking info', async () => {
      const branches = await gitManager.getBranches(testRepo);
      assert.ok(branches.all.includes('feature/tax-rules'));
      assert.strictEqual(branches.current, 'feature/tax-rules');
      assert.strictEqual(branches.detached, false);
      assert.ok(Array.isArray(branches.branches));
      const currentEntry = branches.branches.find((b) => b.name === 'feature/tax-rules');
      assert.ok(currentEntry);
      assert.strictEqual(currentEntry.current, true);
    });

    // 13. createBranch throws if branch already exists
    await runScenarioAsync('createBranch throws if branch already exists', async () => {
      let threw = false;
      try {
        await gitManager.createBranch(testRepo, 'feature/tax-rules', false);
      } catch (err) {
        threw = true;
        assert.ok(err.message.includes('already exists'));
      }
      assert.strictEqual(threw, true);
    });

    // 14. Safe checkout: checkout succeeds when clean
    await runScenarioAsync('checkout switches branch smoothly when workspace is clean', async () => {
      const branches = await gitManager.getBranches(testRepo);
      const mainBranch = branches.all.find((b) => b === 'main' || b === 'master');
      assert.ok(mainBranch, 'Main branch exists');
      const status = await gitManager.checkout(testRepo, mainBranch);
      assert.strictEqual(status.currentBranch, mainBranch);
    });

    // 15. Safe checkout: detects dirty workspace conflict
    await runScenarioAsync('checkout protects dirty workspace and rejects conflicting checkout without silent discard', async () => {
      // Switch back to feature branch and create file
      await gitManager.checkout(testRepo, 'feature/tax-rules');
      fs.writeFileSync(path.join(testRepo, 'calculator.js'), 'function calc() { return 1; }\n');
      await rawGit.add('calculator.js');
      await rawGit.commit('Add calculator on feature branch');

      // Switch to main
      const branches = await gitManager.getBranches(testRepo);
      const mainBranch = branches.all.find((b) => b === 'main' || b === 'master');
      await gitManager.checkout(testRepo, mainBranch);

      // Create conflicting uncommitted calculator.js on main
      fs.writeFileSync(path.join(testRepo, 'calculator.js'), 'function calc() { return "CONFLICT"; }\n');

      let blocked = false;
      try {
        await gitManager.checkout(testRepo, 'feature/tax-rules', { force: false });
      } catch (err) {
        blocked = true;
        assert.ok(err.message.includes('uncommitted') || err.message.includes('blocked') || err.message.includes('overwritten'));
      }
      assert.strictEqual(blocked, true, 'Dirty checkout was prevented safely');

      // Working file still preserved
      const content = fs.readFileSync(path.join(testRepo, 'calculator.js'), 'utf8');
      assert.ok(content.includes('CONFLICT'), 'Local changes were not silently discarded');
    });

    // 16. Stash Operations: stashSave
    await runScenarioAsync('stashSave stashes uncommitted local changes and restores working tree to clean', async () => {
      const res = await gitManager.stashSave(testRepo, { message: 'WIP on conflicting calculator' });
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.status.isClean, true);
      assert.strictEqual(res.status.hasLocalChanges, false);
      assert.ok(Array.isArray(res.stashes));
      assert.ok(res.stashes.length >= 1);
    });

    // 17. Stash Inspector: getStashes
    await runScenarioAsync('getStashes returns formatted stash items with identifier, message, and branch', async () => {
      const stashes = await gitManager.getStashes(testRepo);
      assert.ok(stashes.length >= 1);
      const latest = stashes[0];
      assert.ok(latest.id.startsWith('stash@{'));
      assert.ok(latest.message.includes('WIP on conflicting calculator'));
    });

    // 18. Stash Pop, Apply, Drop, and Clear
    await runScenarioAsync('stashApply, stashPop, stashDrop and stashClear manage the stash stack safely', async () => {
      // Apply stash without removing
      const applyRes = await gitManager.stashApply(testRepo, 'stash@{0}');
      assert.strictEqual(applyRes.success, true);
      assert.strictEqual(applyRes.status.hasLocalChanges, true);

      // Clean working tree with stashSave
      await gitManager.stashSave(testRepo, { message: 'Second stash' });
      let stashes = await gitManager.getStashes(testRepo);
      assert.strictEqual(stashes.length, 2);

      // Pop latest stash
      const popRes = await gitManager.stashPop(testRepo, 'stash@{0}');
      assert.strictEqual(popRes.success, true);
      stashes = await gitManager.getStashes(testRepo);
      assert.strictEqual(stashes.length, 1);

      // Drop remaining stash
      const dropRes = await gitManager.stashDrop(testRepo, 'stash@{0}');
      assert.strictEqual(dropRes.success, true);
      stashes = await gitManager.getStashes(testRepo);
      assert.strictEqual(stashes.length, 0);

      // Clear stashes
      const clearRes = await gitManager.stashClear(testRepo);
      assert.strictEqual(clearRes.success, true);
      assert.strictEqual(clearRes.stashes.length, 0);
    });

    console.log(`\n==================================================`);
    console.log(`ALL ${passedTests}/${totalTests} SCENARIOS PASSED SUCCESSFULLY!`);
    console.log(`==================================================\n`);
  } finally {
    cleanupDir(testRepo);
  }
}

main().catch((err) => {
  console.error('\nTest runner failed:', err);
  process.exit(1);
});
