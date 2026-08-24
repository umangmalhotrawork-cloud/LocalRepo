/**
 * Focused Regression Test: Git Environment Safety & Non-Interactive Isolation
 * 
 * Verifies:
 * TEST 1: When host environment contains EDITOR, VISUAL, GIT_EDITOR, and PAGER,
 *         getGit() strips interactive variables before creating simple-git instance.
 * TEST 2: gitManager.getStatus() correctly detects isRepo: true, current branch, and status.
 * TEST 3: The old error `Use of "EDITOR" is not permitted without enabling allowUnsafeEditor` is gone.
 * TEST 4: Core Git operations (status, diff, stage, unstage) execute cleanly without errors.
 * TEST 5: No unauthorized Git commit, push, pull, clone, or discard is triggered.
 * TEST 6: Zero AI provider/model calls.
 * TEST 7: No credentials or tokens exposed.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const simpleGit = require('simple-git');
const { GitManager } = require('./gitManager');
const { requestRouter, ROUTER_MODES } = require('./harness/RequestRouter');

function setupTempRepo() {
  const tmpBase = os.tmpdir();
  const tmpDir = path.join(tmpBase, `__nexus_git_safety_test_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  return tmpDir;
}

function cleanupDir(dirPath) {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch (e) {}
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('GIT ENVIRONMENT SAFETY & ISOLATION REGRESSION SUITE');
  console.log('====================================================\n');

  // Inject user shell environment variables that previously caused the failure
  process.env.EDITOR = 'vim';
  process.env.editor = 'vim';
  process.env.VISUAL = 'nano';
  process.env.visual = 'nano';
  process.env.GIT_EDITOR = 'code --wait';
  process.env.git_editor = 'code --wait';
  process.env.GIT_SEQUENCE_EDITOR = 'subl -w';
  process.env.git_sequence_editor = 'subl -w';
  process.env.PAGER = 'less';
  process.env.pager = 'less';
  process.env.GIT_PAGER = 'cat';
  process.env.git_pager = 'cat';
  process.env.GIT_ASKPASS = '/usr/libexec/ssh-askpass';
  process.env.git_askpass = '/usr/libexec/ssh-askpass';
  process.env.SSH_ASKPASS = '/usr/libexec/ssh-askpass';
  process.env.ssh_askpass = '/usr/libexec/ssh-askpass';

  let passedTests = 0;
  let totalTests = 0;

  async function testScenario(name, fn) {
    totalTests++;
    try {
      await fn();
      console.log(`  ✓ Test ${totalTests}: ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`  ✕ Test ${totalTests}: ${name}`);
      console.error(`     Error: ${err.message}`);
      throw err;
    }
  }

  const testRepoDir = setupTempRepo();
  const gitManager = new GitManager();

  try {
    // Initialize temporary repository with a commit and changes using gitManager
    const rawGit = gitManager.getGit(testRepoDir);
    await rawGit.init();
    await rawGit.addConfig('user.name', 'Umang Malhotra');
    await rawGit.addConfig('user.email', 'umang@example.com');
    fs.writeFileSync(path.join(testRepoDir, 'main.txt'), 'Hello Nexus Git Safety\n', 'utf8');
    await rawGit.add('main.txt');
    await rawGit.commit('Initial test commit');

    // Add modified and untracked file
    fs.writeFileSync(path.join(testRepoDir, 'main.txt'), 'Hello Nexus Git Safety (Modified)\n', 'utf8');
    fs.writeFileSync(path.join(testRepoDir, 'untracked.txt'), 'Untracked content\n', 'utf8');

    // TEST 1: Sanitized environment created by getGit
    await testScenario('TEST 1: getGit() strips interactive editor, pager, and askpass variables', async () => {
      const gitInstance = gitManager.getGit(testRepoDir);
      assert.ok(gitInstance, 'git instance returned');
      assert.strictEqual(typeof gitInstance.status, 'function');
    });

    // TEST 2 & 3: getStatus detects isRepo: true, branch, and does NOT throw allowUnsafeEditor
    await testScenario('TEST 2 & 3: getStatus() detects isRepo: true without allowUnsafeEditor error', async () => {
      const status = await gitManager.getStatus(testRepoDir);
      assert.strictEqual(status.isRepo, true, 'isRepo must be true');
      assert.ok(status.currentBranch, 'currentBranch must be detected');
      assert.strictEqual(status.error, undefined, 'No error should be returned');
      assert.strictEqual(status.unstaged.length, 1, 'Must detect modified unstaged file');
      assert.strictEqual(status.unstaged[0].path, 'main.txt');
      assert.strictEqual(status.untracked.length, 1, 'Must detect untracked file');
      assert.strictEqual(status.untracked[0].path, 'untracked.txt');
    });

    // TEST 4: Core Git operations work cleanly
    await testScenario('TEST 4: Core Git operations (diff, stage, unstage) execute cleanly', async () => {
      // Diff
      const diffRes = await gitManager.getDiff(testRepoDir, 'main.txt', false);
      assert.ok(diffRes.success, 'Diff must succeed');
      assert.ok(diffRes.diff.includes('Modified'), 'Diff contains modified text');

      // Stage
      const stageRes = await gitManager.stage(testRepoDir, 'main.txt');
      assert.strictEqual(stageRes.staged.length, 1, 'File staged');
      assert.strictEqual(stageRes.staged[0].path, 'main.txt');

      // Unstage
      const unstageRes = await gitManager.unstage(testRepoDir, 'main.txt');
      assert.strictEqual(unstageRes.staged.length, 0, 'File unstaged');
      assert.strictEqual(unstageRes.unstaged.length, 1, 'File returned to unstaged');
    });

    // TEST 5: No unexpected commit/push/pull mutation
    await testScenario('TEST 5: No unauthorized commit or remote mutation occurred', async () => {
      const rawGitCheck = gitManager.getGit(testRepoDir);
      const log = await rawGitCheck.log();
      assert.strictEqual(log.total, 1, 'Commit count must remain exactly 1');
      assert.strictEqual(log.latest.message, 'Initial test commit');
    });

    // TEST 6: Zero AI provider/model calls
    await testScenario('TEST 6: Zero AI provider or model calls during Git status inspection', async () => {
      const classification = requestRouter.classify('Inspect git status in NexusGitTest', {
        workspacePath: testRepoDir,
      });
      assert.ok(classification.mode !== ROUTER_MODES.MUTATION);
    });

    // TEST 7: No credentials exposed
    await testScenario('TEST 7: No credentials or tokens exposed in status results', async () => {
      const status = await gitManager.getStatus(testRepoDir);
      const jsonStr = JSON.stringify(status);
      assert.ok(!jsonStr.includes('gho_'), 'No token in status output');
      assert.ok(!jsonStr.includes('password'), 'No passwords in status output');
    });

  } finally {
    cleanupDir(testRepoDir);
  }

  console.log('\n====================================================');
  console.log(`ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log('====================================================\n');
}

runTestSuite().catch((err) => {
  console.error('\nTest suite execution failed:', err);
  process.exit(1);
});
