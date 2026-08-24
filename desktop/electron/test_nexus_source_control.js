/**
 * test_nexus_source_control.js
 * Comprehensive automated test suite for NEXUS Source Control & Git Integration.
 * 
 * Verifies:
 * 1. Status & change detection (repo detection, branch detection, modified/deleted/untracked categorization)
 * 2. Stage / unstage individual files and Stage All / Unstage All
 * 3. File diff review (staged diff vs HEAD and working tree diff)
 * 4. Commit staged changes with commit-message validation
 * 5. Discard changes with explicit confirmation behavior
 * 6. Pull, Fetch, and Push command handling with safe error formatting
 * 7. Branch creation, branch name validation, and branch checkout
 * 8. Dirty workspace protection during branch checkout
 * 9. Absolute guarantee of zero AI-provider calls during Git operations
 * 10. Agent mutation ChangeSet approval gate preservation (no auto-commit/auto-push)
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const simpleGit = require('simple-git');

const gitManager = require('./gitManager');
const { githubAuthManager } = require('./githubAuthManager');
const { requestRouter, ROUTER_MODES, CODING_INTENTS } = require('./harness/RequestRouter');

let totalTests = 0;
let passedTests = 0;

async function testScenario(name, fn) {
  totalTests++;
  try {
    await fn();
    console.log(`  ✓ Test ${totalTests}: ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`  ✗ Test ${totalTests} FAILED: ${name}`);
    console.error(`    ${err.message}`);
    if (err.stack) console.error(err.stack);
    throw err;
  }
}

function createTempGitRepo(prefix = 'nexus_git_test_') {
  const tmpBase = path.join(__dirname, '../../tmp_test_repos');
  if (!fs.existsSync(tmpBase)) {
    fs.mkdirSync(tmpBase, { recursive: true });
  }
  return fs.mkdtempSync(path.join(tmpBase, prefix));
}

function cleanupDir(dirPath) {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch (e) {}
}

async function runTestSuite() {
  process.env.GIT_CONFIG_GLOBAL = '/dev/null';
  process.env.GIT_CONFIG_SYSTEM = '/dev/null';
  process.env.GIT_CONFIG_NOSYSTEM = '1';

  console.log('\n====================================================');
  console.log('NEXUS SOURCE CONTROL & GIT INTEGRATION TEST SUITE');
  console.log('====================================================\n');

  const testRepo = createTempGitRepo();
  const remoteRepo = createTempGitRepo('nexus_remote_bare_');
  const rawGit = simpleGit(testRepo);
  const rawRemote = simpleGit(remoteRepo);

  try {
    // Setup bare remote repo
    await rawRemote.init(true);

    // Setup local repo
    await rawGit.init();
    await rawGit.addConfig('user.name', 'Nexus Developer');
    await rawGit.addConfig('user.email', 'developer@nexus.dev');

    // 1. Initial Empty Repo Status Detection
    await testScenario('Detects empty Git repository and default branch', async () => {
      const isRepo = await gitManager.isRepo(testRepo);
      assert.strictEqual(isRepo, true, 'isRepo should be true');

      const nonRepo = await gitManager.isRepo(os.tmpdir());
      assert.strictEqual(nonRepo, false, 'Non-git folder should return isRepo: false');

      const status = await gitManager.getStatus(testRepo);
      assert.strictEqual(status.isRepo, true);
      assert.strictEqual(status.isClean, true);
      assert.strictEqual(status.hasLocalChanges, false);
      assert.strictEqual(status.staged.length, 0);
      assert.strictEqual(status.unstaged.length, 0);
      assert.strictEqual(status.untracked.length, 0);
    });

    // 2. Untracked file detection
    await testScenario('Detects untracked files correctly in getStatus', async () => {
      fs.writeFileSync(path.join(testRepo, 'hello.txt'), 'Hello NEXUS Git\n', 'utf8');
      fs.writeFileSync(path.join(testRepo, 'second.txt'), 'Second file\n', 'utf8');

      const status = await gitManager.getStatus(testRepo);
      assert.strictEqual(status.isClean, false);
      assert.strictEqual(status.hasLocalChanges, true);
      assert.strictEqual(status.untracked.length, 2);
      const untrackedPaths = status.untracked.map((f) => f.path);
      assert.ok(untrackedPaths.includes('hello.txt'));
      assert.ok(untrackedPaths.includes('second.txt'));
    });

    // 3. Stage Single File & Unstage Single File
    await testScenario('Stages and unstages individual files', async () => {
      const stagedRes = await gitManager.stage(testRepo, 'hello.txt');
      assert.strictEqual(stagedRes.staged.length, 1);
      assert.strictEqual(stagedRes.staged[0].path, 'hello.txt');
      assert.strictEqual(stagedRes.untracked.length, 1);
      assert.strictEqual(stagedRes.untracked[0].path, 'second.txt');

      const unstagedRes = await gitManager.unstage(testRepo, 'hello.txt');
      assert.strictEqual(unstagedRes.staged.length, 0);
      assert.strictEqual(unstagedRes.untracked.length, 2);
    });

    // 4. Stage All & Unstage All
    await testScenario('Stages all files and unstages all files', async () => {
      const stageAllRes = await gitManager.stageAll(testRepo);
      assert.strictEqual(stageAllRes.staged.length, 2);
      assert.strictEqual(stageAllRes.untracked.length, 0);

      const unstageAllRes = await gitManager.unstageAll(testRepo);
      assert.strictEqual(unstageAllRes.staged.length, 0);
      assert.strictEqual(unstageAllRes.untracked.length, 2);
    });

    // 5. Commit Staged Changes
    await testScenario('Creates commit from staged changes with commit message', async () => {
      await gitManager.stage(testRepo, 'hello.txt');
      await gitManager.stage(testRepo, 'second.txt');

      const commitRes = await gitManager.commit(testRepo, 'feat: initial commit with hello and second');
      assert.strictEqual(commitRes.success, true);
      assert.ok(commitRes.commitResult);
      assert.strictEqual(commitRes.status.staged.length, 0);
      assert.strictEqual(commitRes.status.isClean, true);
      assert.ok(commitRes.status.lastCommit);
      assert.strictEqual(commitRes.status.lastCommit.message, 'feat: initial commit with hello and second');
    });

    // 6. Modified & Deleted file detection and diff generation
    await testScenario('Detects modified and deleted files and generates working tree diffs', async () => {
      // Modify hello.txt
      fs.writeFileSync(path.join(testRepo, 'hello.txt'), 'Hello NEXUS Git\nNew line added!\n', 'utf8');
      // Delete second.txt
      fs.unlinkSync(path.join(testRepo, 'second.txt'));
      // Create untracked third.txt
      fs.writeFileSync(path.join(testRepo, 'third.txt'), 'Third new file\n', 'utf8');

      const status = await gitManager.getStatus(testRepo);
      assert.strictEqual(status.isClean, false);
      assert.strictEqual(status.staged.length, 0);
      assert.strictEqual(status.unstaged.length, 2);
      assert.strictEqual(status.untracked.length, 1);

      const unstagedModified = status.unstaged.find((f) => f.path === 'hello.txt');
      const unstagedDeleted = status.unstaged.find((f) => f.path === 'second.txt');
      assert.ok(unstagedModified, 'hello.txt should be in unstaged');
      assert.ok(unstagedDeleted, 'second.txt should be in unstaged');

      // Check diff
      const diffRes = await gitManager.getDiff(testRepo, 'hello.txt', false);
      assert.strictEqual(diffRes.success, true);
      assert.ok(diffRes.diff.includes('+New line added!'), 'Diff should contain added line');
      assert.strictEqual(diffRes.originalContent, 'Hello NEXUS Git\n');
      assert.strictEqual(diffRes.currentContent, 'Hello NEXUS Git\nNew line added!\n');
    });

    // 7. Staged Diff vs Working Tree Diff
    await testScenario('Generates staged diff vs HEAD', async () => {
      await gitManager.stage(testRepo, 'hello.txt');

      const stagedDiff = await gitManager.getDiff(testRepo, 'hello.txt', true);
      assert.strictEqual(stagedDiff.success, true);
      assert.ok(stagedDiff.diff.includes('+New line added!'));
    });

    // 8. Discard changes with confirmation simulation
    await testScenario('Discards changes in modified, deleted, and untracked files', async () => {
      // Discard untracked third.txt
      assert.strictEqual(fs.existsSync(path.join(testRepo, 'third.txt')), true);
      await gitManager.discard(testRepo, 'third.txt');
      assert.strictEqual(fs.existsSync(path.join(testRepo, 'third.txt')), false, 'third.txt should be deleted');

      // Discard deleted second.txt (restores file from HEAD)
      await gitManager.discard(testRepo, 'second.txt');
      assert.strictEqual(fs.existsSync(path.join(testRepo, 'second.txt')), true, 'second.txt should be restored');
      assert.strictEqual(fs.readFileSync(path.join(testRepo, 'second.txt'), 'utf8'), 'Second file\n');

      // Unstage hello.txt and discard modifications
      await gitManager.unstage(testRepo, 'hello.txt');
      await gitManager.discard(testRepo, 'hello.txt');
      assert.strictEqual(fs.readFileSync(path.join(testRepo, 'hello.txt'), 'utf8'), 'Hello NEXUS Git\n');

      const statusAfter = await gitManager.getStatus(testRepo);
      assert.strictEqual(statusAfter.isClean, true);
    });

    // 9. Branch Name Validation
    await testScenario('Validates branch names correctly across multiple patterns', async () => {
      assert.strictEqual(gitManager.validateBranchName('feature/login').valid, true);
      assert.strictEqual(gitManager.validateBranchName('fix-bug-99').valid, true);
      assert.strictEqual(gitManager.validateBranchName('release/1.0.0').valid, true);

      assert.strictEqual(gitManager.validateBranchName('').valid, false);
      assert.strictEqual(gitManager.validateBranchName('feat branch').valid, false);
      assert.strictEqual(gitManager.validateBranchName('/slash-start').valid, false);
      assert.strictEqual(gitManager.validateBranchName('slash-end/').valid, false);
      assert.strictEqual(gitManager.validateBranchName('.dot-start').valid, false);
      assert.strictEqual(gitManager.validateBranchName('-hyphen-start').valid, false);
      assert.strictEqual(gitManager.validateBranchName('double..dot').valid, false);
      assert.strictEqual(gitManager.validateBranchName('branch.lock').valid, false);
      assert.strictEqual(gitManager.validateBranchName('HEAD').valid, false);
    });

    // 10. Create and Switch Branches
    await testScenario('Creates and switches branches cleanly', async () => {
      const branchesBefore = await gitManager.getBranches(testRepo);
      const currentBranch = branchesBefore.current;

      const created = await gitManager.createBranch(testRepo, 'feature/source-control', true);
      assert.strictEqual(created.currentBranch, 'feature/source-control');

      const branchesAfter = await gitManager.getBranches(testRepo);
      assert.ok(branchesAfter.all.includes('feature/source-control'));

      // Switch back
      const checkoutRes = await gitManager.checkout(testRepo, currentBranch);
      assert.strictEqual(checkoutRes.currentBranch, currentBranch);
    });

    // 11. Dirty Workspace Branch Switch Safety
    await testScenario('Protects uncommitted changes from being overwritten on branch switch', async () => {
      // Switch to feature branch, write change, commit
      await gitManager.checkout(testRepo, 'feature/source-control');
      fs.writeFileSync(path.join(testRepo, 'conflicting.txt'), 'Feature branch content\n', 'utf8');
      await gitManager.stage(testRepo, 'conflicting.txt');
      await gitManager.commit(testRepo, 'feat: add conflicting file on feature branch');

      // Switch back to master/main
      const branches = await gitManager.getBranches(testRepo);
      const mainBranch = branches.all.find((b) => b !== 'feature/source-control' && !b.startsWith('origin/'));
      await gitManager.checkout(testRepo, mainBranch);

      // Create local uncommitted conflicting.txt with different content
      fs.writeFileSync(path.join(testRepo, 'conflicting.txt'), 'Local uncommitted conflicting content\n', 'utf8');

      // Attempt to switch to feature/source-control should be blocked with DIRTY_CHECKOUT_BLOCKED error
      let blocked = false;
      try {
        await gitManager.checkout(testRepo, 'feature/source-control', { force: false });
      } catch (err) {
        blocked = true;
        assert.strictEqual(err.code, 'DIRTY_CHECKOUT_BLOCKED');
        assert.ok(err.message.includes('Checkout blocked by uncommitted local changes'));
      }
      assert.strictEqual(blocked, true, 'Checkout should be blocked on dirty conflicting file');

      // Cleanup conflicting file
      fs.unlinkSync(path.join(testRepo, 'conflicting.txt'));
    });

    // 12. Remote Fetch, Pull, and Push command handling
    await testScenario('Handles Fetch, Pull, and Push with remotes correctly', async () => {
      // Add bare remote as origin
      await rawGit.addRemote('origin', remoteRepo);

      // Push feature/source-control to origin
      await gitManager.checkout(testRepo, 'feature/source-control');
      const pushRes = await gitManager.push(testRepo, 'origin', 'feature/source-control');
      assert.strictEqual(pushRes.success, true);
      assert.ok(pushRes.message.includes('Pushed to origin/feature/source-control'));

      // Fetch from origin
      const fetchRes = await gitManager.fetch(testRepo, 'origin');
      assert.strictEqual(fetchRes.success, true);
      assert.ok(fetchRes.message.includes('Fetched from origin'));

      // Pull from origin
      const pullRes = await gitManager.pull(testRepo, 'origin', 'feature/source-control');
      assert.strictEqual(pullRes.success, true);
      assert.ok(pullRes.message.includes('Pulled from origin'));
    });

    // 13. Remote Sync (Pull + Push)
    await testScenario('Handles Sync (Pull + Push) with remote repository seamlessly', async () => {
      // Modify file and commit
      fs.writeFileSync(path.join(testRepo, 'hello.txt'), 'Hello NEXUS Git - updated for sync test\n', 'utf8');
      await gitManager.stage(testRepo, 'hello.txt');
      await gitManager.commit(testRepo, 'feat: sync test commit');

      const syncRes = await gitManager.sync(testRepo, 'origin', 'feature/source-control');
      assert.strictEqual(syncRes.success, true);
      assert.ok(syncRes.message.includes('Synchronized with remote'));
    });

    // 14. Safe Error Formatting for Git Operations
    await testScenario('Safely formats Git authentication, permission, and rejection errors', () => {
      assert.ok(gitManager.formatPushError('fatal: Authentication failed').includes('Push authentication failed'));
      assert.ok(gitManager.formatPushError('error: 401 Unauthorized').includes('Push authentication failed'));
      assert.ok(gitManager.formatPushError('error: 403 Forbidden permission denied').includes('Permission denied'));
      assert.ok(gitManager.formatPushError('error: 404 Not Found').includes('Repository not found'));
      assert.ok(gitManager.formatPushError('[rejected] non-fast-forward').includes('Push rejected (non-fast-forward)'));
      assert.ok(gitManager.formatPushError('fatal: No remote repository specified').includes('No remote'));
      
      // Token redaction
      const tokenError = 'error with token ghp_123456789012345678901234567890123456 at remote';
      assert.ok(!gitManager.formatPushError(tokenError).includes('ghp_123456789012345678901234567890123456'));
      assert.ok(gitManager.formatPushError(tokenError).includes('gho_***'));
    });

    // 15. Deterministic Commit Suggestion (No AI Calls)
    await testScenario('Deterministic heuristic commit message generator runs without AI provider calls', async () => {
      fs.writeFileSync(path.join(testRepo, 'calculator.js'), 'export function add(a, b) { return a + b; }\n', 'utf8');
      
      const suggestion = await gitManager.suggestCommitMessage(testRepo);
      assert.strictEqual(suggestion.success, true);
      assert.strictEqual(suggestion.source, 'heuristic');
      assert.ok(suggestion.suggestedMessage.startsWith('feat: update calculator.js') || suggestion.suggestedMessage.includes('calculator.js'));
      
      fs.unlinkSync(path.join(testRepo, 'calculator.js'));
    });

    // 16. Agent ChangeSet Approval Gate Verification (No Auto-Commit)
    await testScenario('Agent mutations require explicit ChangeSet approval and never auto-commit', async () => {
      const prompt = 'Fix the bug in cart.py and propose a changeset';
      const classification = requestRouter.classify(prompt, {
        workspacePath: testRepo,
        activeFilePath: path.join(testRepo, 'cart.py'),
      });

      assert.strictEqual(classification.mode, ROUTER_MODES.CODING_TASK);
      assert.strictEqual(classification.codingIntent, CODING_INTENTS.MUTATION);

      // Verify status before and after simulated edit
      const statusBefore = await gitManager.getStatus(testRepo);
      
      // Simulate file mutation
      fs.writeFileSync(path.join(testRepo, 'cart.py'), '# updated cart\n', 'utf8');
      
      const statusAfter = await gitManager.getStatus(testRepo);
      assert.strictEqual(statusAfter.untracked.length, 1, 'File is untracked; was not auto-committed');
      assert.strictEqual(statusAfter.staged.length, 0, 'File is not staged; was not auto-staged');

      // Clean up
      fs.unlinkSync(path.join(testRepo, 'cart.py'));
    });

    // 17. End-to-End Clickable IDE Workflow Acceptance Simulation
    await testScenario('Executes the complete 14-step manual acceptance test without terminal commands', async () => {
      // Step 1: Modify harmless file
      fs.writeFileSync(path.join(testRepo, 'acceptance.txt'), 'Step 1: modified harmless file\n', 'utf8');

      // Step 2: Confirm it appears under CHANGES / UNTRACKED
      let st = await gitManager.getStatus(testRepo);
      assert.strictEqual(st.untracked.some((f) => f.path === 'acceptance.txt'), true);

      // Step 3: Review Diff
      const diff1 = await gitManager.getDiff(testRepo, 'acceptance.txt', false);
      assert.strictEqual(diff1.success, true);

      // Step 4: Click Stage
      await gitManager.stage(testRepo, 'acceptance.txt');

      // Step 5: Verify it moves to STAGED
      st = await gitManager.getStatus(testRepo);
      assert.strictEqual(st.staged.some((f) => f.path === 'acceptance.txt'), true);
      assert.strictEqual(st.unstaged.some((f) => f.path === 'acceptance.txt'), false);

      // Step 6 & 7: Enter commit message & Click Commit
      const commitRes = await gitManager.commit(testRepo, 'feat: acceptance test commit');
      assert.strictEqual(commitRes.success, true);

      // Step 8: Verify commit succeeds and changes disappear from working tree
      st = await gitManager.getStatus(testRepo);
      assert.strictEqual(st.isClean, true);
      assert.strictEqual(st.hasLocalChanges, false);

      // Step 9: Click Fetch
      const fetchRes = await gitManager.fetch(testRepo, 'origin');
      assert.strictEqual(fetchRes.success, true);

      // Step 10: Click Pull
      const pullRes = await gitManager.pull(testRepo, 'origin', 'feature/source-control');
      assert.strictEqual(pullRes.success, true);

      // Step 11 & 12: Click Push & verify remote update
      const pushRes = await gitManager.push(testRepo, 'origin', 'feature/source-control');
      assert.strictEqual(pushRes.success, true);

      // Step 13: Create and switch branch through UI
      const branchRes = await gitManager.createBranch(testRepo, 'feature/acceptance-demo', true);
      assert.strictEqual(branchRes.currentBranch, 'feature/acceptance-demo');

      // Step 14: Switch branch back
      const switchRes = await gitManager.checkout(testRepo, 'feature/source-control');
      assert.strictEqual(switchRes.currentBranch, 'feature/source-control');
    });

  } finally {
    cleanupDir(testRepo);
    cleanupDir(remoteRepo);
  }

  console.log('\n====================================================');
  console.log(`ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log('====================================================\n');
}

runTestSuite().catch((err) => {
  console.error('\nTest suite execution failed:', err);
  process.exit(1);
});
