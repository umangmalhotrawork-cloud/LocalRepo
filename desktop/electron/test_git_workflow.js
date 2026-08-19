/**
 * Test Suite: NEXUS One-Click [Commit & Push] & AI Milestone Suggestion
 * Verifies:
 * 1. Repo status detection with staged, unstaged, and untracked files
 * 2. Suggest commit message heuristic & conventional formatting
 * 3. One-click commitAndPush stages all files atomically
 * 4. commitAndPush handles local-only repos cleanly (no remote configured)
 * 5. User-edited commit messages are committed accurately
 * 6. Push handler returns clear status telemetry
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const simpleGit = require('simple-git');
const gitManager = require('./gitManager');

async function runGitWorkflowTestSuite() {
  console.log('[TEST] Starting NEXUS Git Workflow Test Suite...');

  // Setup isolated temporary git repository
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus_git_test_'));
  const git = simpleGit(tempDir);
  await git.init();
  await git.addConfig('user.name', 'NEXUS Test Agent');
  await git.addConfig('user.email', 'agent@nexus.internal');

  // Initial clean commit
  const readmePath = path.join(tempDir, 'README.md');
  fs.writeFileSync(readmePath, '# NEXUS Workspace Test\n', 'utf8');
  await git.add('README.md');
  await git.commit('chore: initial commit');

  // TEST 1: Initial Clean Status
  const status1 = await gitManager.getStatus(tempDir);
  assert.strictEqual(status1.isRepo, true);
  assert.strictEqual(status1.staged.length, 0);
  assert.strictEqual(status1.unstaged.length, 0);
  assert.strictEqual(status1.untracked.length, 0);
  assert.strictEqual(status1.lastCommit.message, 'chore: initial commit');
  console.log('[TEST 1 PASSED] Initial repo status verified clean');

  // TEST 2: File modifications & additions detection
  const srcDir = path.join(tempDir, 'src');
  fs.mkdirSync(srcDir, { recursive: true });
  const cartFile = path.join(srcDir, 'cart_calculator.py');
  fs.writeFileSync(cartFile, 'def calculate_total(items):\n    return sum(items)\n', 'utf8');

  const testFile = path.join(tempDir, 'test_cart.py');
  fs.writeFileSync(testFile, 'def test_total():\n    assert calculate_total([10]) == 10\n', 'utf8');

  // Append to README
  fs.appendFileSync(readmePath, 'Added cart calculator.\n', 'utf8');

  const status2 = await gitManager.getStatus(tempDir);
  assert.strictEqual(status2.isRepo, true);
  const totalDetected = status2.staged.length + status2.unstaged.length + status2.untracked.length;
  assert.strictEqual(totalDetected, 3, 'Should detect 3 modified/untracked files');
  console.log('[TEST 2 PASSED] Detected meaningful changes across files (3 files)');

  // TEST 3: AI / Heuristic Commit Message Suggestion
  const suggestion = await gitManager.suggestCommitMessage(tempDir);
  assert.strictEqual(suggestion.success, true);
  assert.ok(suggestion.suggestedMessage, 'Should return a suggested message');
  assert.ok(
    suggestion.suggestedMessage.startsWith('feat') ||
    suggestion.suggestedMessage.startsWith('fix') ||
    suggestion.suggestedMessage.startsWith('refactor'),
    `Message should follow conventional commit style: ${suggestion.suggestedMessage}`
  );
  console.log(`[TEST 3 PASSED] Generated concise commit message suggestion: "${suggestion.suggestedMessage}"`);

  // TEST 4: One-Click Commit & Push on Local-Only Repo (No Remote)
  const customMessage = 'feat(cart): implement calculate_total and add test_cart';
  const commitRes = await gitManager.commitAndPush(tempDir, customMessage);
  assert.strictEqual(commitRes.success, true);
  assert.strictEqual(commitRes.committed, true);
  assert.strictEqual(commitRes.noRemote, true);
  assert.ok(commitRes.message.includes('Committed locally'), 'Should report local commit without remote errors');

  // Verify repository is now clean
  const statusAfter = await gitManager.getStatus(tempDir);
  assert.strictEqual(statusAfter.staged.length, 0);
  assert.strictEqual(statusAfter.unstaged.length, 0);
  assert.strictEqual(statusAfter.untracked.length, 0);
  assert.strictEqual(statusAfter.lastCommit.message, customMessage);
  console.log('[TEST 4 PASSED] One-click Commit & Push staged all files & committed cleanly');

  // TEST 5: Push to Simulated Bare Remote
  const remoteDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus_remote_bare_'));
  const remoteGit = simpleGit(remoteDir);
  await remoteGit.init(true); // Bare repository

  await git.addRemote('origin', remoteDir);
  const pushRes = await gitManager.push(tempDir, 'origin', statusAfter.currentBranch);
  assert.strictEqual(pushRes.success, true);
  console.log('[TEST 5 PASSED] Push to configured remote succeeded');

  // TEST 6: Subsequent Change + Commit & Push with Remote
  fs.appendFileSync(cartFile, '# Updated version\n', 'utf8');
  const commitPushWithRemote = await gitManager.commitAndPush(tempDir, 'fix(cart): update version comment');
  assert.strictEqual(commitPushWithRemote.success, true);
  assert.strictEqual(commitPushWithRemote.committed, true);
  assert.strictEqual(commitPushWithRemote.pushed, true);
  console.log('[TEST 6 PASSED] Commit & Push to active remote succeeded in 1 click');

  // Cleanup
  fs.rmSync(tempDir, { recursive: true, force: true });
  fs.rmSync(remoteDir, { recursive: true, force: true });

  console.log('\n>>> ALL 6 NEXUS GIT WORKFLOW TESTS PASSED PERFECTLY! <<<');
}

runGitWorkflowTestSuite().catch((err) => {
  console.error('Git Workflow Test Failed:', err);
  process.exit(1);
});
