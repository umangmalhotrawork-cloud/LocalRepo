const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const gitManager = require('../electron/gitManager');

async function runGitTests() {
  console.log('[TEST] Starting Git Source Control Test Suite...');

  // Create temporary git repo
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'echo-nullity-git-test-'));
  console.log(`[TEST] Created temporary git test repo: ${tempDir}`);

  try {
    // 1. Initialize repo
    execSync('git init -b main', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.name "Echo Test"', { cwd: tempDir, stdio: 'ignore' });
    execSync('git config user.email "test@echo.nullity"', { cwd: tempDir, stdio: 'ignore' });

    // Initial commit
    const initialFile = path.join(tempDir, 'README.md');
    fs.writeFileSync(initialFile, '# Echo Nullity Repo\nInitial line\n');
    execSync('git add README.md && git commit -m "feat: initial commit"', { cwd: tempDir, stdio: 'ignore' });

    // Test 1: isRepo & getStatus
    const isRepo = await gitManager.isRepo(tempDir);
    console.log(`[TEST 1] isRepo result: ${isRepo}`);
    if (!isRepo) throw new Error('Expected isRepo to be true');

    const status1 = await gitManager.getStatus(tempDir);
    console.log(`[TEST 1] Initial status: branch=${status1.currentBranch}, staged=${status1.staged.length}, unstaged=${status1.unstaged.length}, untracked=${status1.untracked.length}`);
    if (status1.currentBranch !== 'main') throw new Error(`Expected branch 'main', got '${status1.currentBranch}'`);
    if (!status1.lastCommit || status1.lastCommit.message !== 'feat: initial commit') throw new Error('Last commit mismatch');

    // Test 2: Modify existing file and create untracked file
    fs.writeFileSync(initialFile, '# Echo Nullity Repo\nModified line 2\n');
    const newFile = path.join(tempDir, 'new_script.py');
    fs.writeFileSync(newFile, 'print("Hello from test")\n');

    const status2 = await gitManager.getStatus(tempDir);
    console.log(`[TEST 2] Status after edits: unstaged=${status2.unstaged.length}, untracked=${status2.untracked.length}`);
    if (status2.unstaged.length !== 1 || status2.untracked.length !== 1) {
      throw new Error(`Expected 1 unstaged and 1 untracked file, got unstaged=${status2.unstaged.length}, untracked=${status2.untracked.length}`);
    }

    // Test 3: Stage individual file
    await gitManager.stage(tempDir, 'README.md');
    const status3 = await gitManager.getStatus(tempDir);
    console.log(`[TEST 3] Status after staging README.md: staged=${status3.staged.length}, unstaged=${status3.unstaged.length}`);
    if (status3.staged.length !== 1 || status3.unstaged.length !== 0) {
      throw new Error('Expected 1 staged file');
    }

    // Test 4: Unstage file
    await gitManager.unstage(tempDir, 'README.md');
    const status4 = await gitManager.getStatus(tempDir);
    console.log(`[TEST 4] Status after unstaging README.md: staged=${status4.staged.length}, unstaged=${status4.unstaged.length}`);
    if (status4.staged.length !== 0 || status4.unstaged.length !== 1) {
      throw new Error('Expected 0 staged and 1 unstaged file');
    }

    // Test 5: Stage all & Commit
    await gitManager.stageAll(tempDir);
    const status5 = await gitManager.getStatus(tempDir);
    console.log(`[TEST 5] Status after stageAll: staged=${status5.staged.length}`);
    if (status5.staged.length !== 2) throw new Error('Expected 2 staged files');

    const commitRes = await gitManager.commit(tempDir, 'feat: add new script and update readme');
    console.log(`[TEST 5] Commit result success: ${commitRes.success}`);
    if (!commitRes.success) throw new Error('Commit failed');

    const statusAfterCommit = await gitManager.getStatus(tempDir);
    console.log(`[TEST 5] Status after commit: working tree clean=${statusAfterCommit.staged.length === 0 && statusAfterCommit.unstaged.length === 0}`);
    if (statusAfterCommit.staged.length !== 0 || statusAfterCommit.unstaged.length !== 0) throw new Error('Expected clean status');

    // Test 6: Create branch and switch
    await gitManager.createBranch(tempDir, 'feature/test-branch');
    const branches = await gitManager.getBranches(tempDir);
    console.log(`[TEST 6] Branches: ${branches.all.join(', ')}, Current: ${branches.current}`);
    if (!branches.all.includes('feature/test-branch') || branches.current !== 'feature/test-branch') {
      throw new Error('Branch creation failed');
    }

    await gitManager.checkout(tempDir, 'main');
    const branchesAfterCheckout = await gitManager.getBranches(tempDir);
    console.log(`[TEST 6] Checked out back to: ${branchesAfterCheckout.current}`);
    if (branchesAfterCheckout.current !== 'main') throw new Error('Checkout back to main failed');

    // Test 7: Diff calculation
    fs.writeFileSync(initialFile, '# Echo Nullity Repo\nModified for diff test\n');
    const diffRes = await gitManager.getDiff(tempDir, 'README.md', false);
    console.log(`[TEST 7] Diff computed: hasDiff=${!!diffRes.diff && diffRes.diff.includes('+Modified for diff test')}`);
    if (!diffRes.diff || !diffRes.diff.includes('+Modified for diff test')) {
      throw new Error('Diff calculation failed');
    }

    // Test 8: Discard changes
    await gitManager.discard(tempDir, 'README.md');
    const statusAfterDiscard = await gitManager.getStatus(tempDir);
    console.log(`[TEST 8] Status after discard: unstaged=${statusAfterDiscard.unstaged.length}`);
    if (statusAfterDiscard.unstaged.length !== 0) throw new Error('Discard failed');

    console.log('>>> ALL 8 GIT SOURCE CONTROL UNIT TESTS PASSED SUCCESSFULLY! <<<');
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true });
  }
}

runGitTests().catch((err) => {
  console.error('[TEST ERROR]', err);
  process.exit(1);
});
