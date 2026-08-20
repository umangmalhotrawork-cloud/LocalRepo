/**
 * Verifies the local git workflow without constructing a GitHub user,
 * repository, remote, or credential. Real remote push is verified through the
 * authenticated desktop flow when a user has configured GitHub OAuth.
 */
const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const simpleGit = require('simple-git');
const gitManager = require('./gitManager');

async function runGitWorkflowTestSuite() {
  console.log('[TEST SUITE] Starting NEXUS local Git workflow verification...');
  process.env.GIT_CONFIG_GLOBAL = '/dev/null';
  const workspacePath = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus_git_workspace_'));

  try {
    const git = simpleGit(workspacePath);
    await git.init();

    fs.writeFileSync(path.join(workspacePath, 'tracked-file.txt'), 'NEXUS local commit\n', 'utf8');
    const initialCommit = await gitManager.commitAndPush(workspacePath, 'feat: create local workspace commit');
    assert.strictEqual(initialCommit.success, true);
    assert.strictEqual(initialCommit.committed, true);
    assert.strictEqual(initialCommit.noRemote, true);
    console.log('✓ TEST 1 PASSED: git add . and local commit completed without a remote.');

    const status = await gitManager.getStatus(workspacePath);
    assert.strictEqual(status.isRepo, true);
    assert.ok(status.currentBranch);
    console.log('✓ TEST 2 PASSED: Current branch is detected.');

    const noChanges = await gitManager.commitAndPush(workspacePath, 'chore: no changes');
    assert.strictEqual(noChanges.success, false);
    assert.strictEqual(noChanges.noChanges, true);
    console.log('✓ TEST 3 PASSED: Empty commits are prevented.');

    const noRemotePush = await gitManager.push(workspacePath);
    assert.strictEqual(noRemotePush.success, false);
    assert.strictEqual(noRemotePush.noRemote, true);
    console.log('✓ TEST 4 PASSED: Push is blocked until a real remote is associated.');

    assert.ok(gitManager.formatPushError('Authentication failed').includes('Push authentication failed'));
    assert.ok(gitManager.formatPushError('non-fast-forward').includes('Push rejected (non-fast-forward)'));
    console.log('✓ TEST 5 PASSED: Push errors are safely formatted.');
  } finally {
    fs.rmSync(workspacePath, { recursive: true, force: true });
  }

  console.log('ALL LOCAL GIT WORKFLOW TESTS PASSED.');
}

runGitWorkflowTestSuite().catch((err) => {
  console.error('Git workflow test failed:', err);
  process.exit(1);
});
