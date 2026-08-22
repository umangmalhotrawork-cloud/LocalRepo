/**
 * MILESTONE 28 TEST SUITE: GIT VISUAL HISTORY GRAPH & INTERACTIVE LOG INSPECTION
 * 
 * Validates:
 * 1. Commit retrieval
 * 2. Parent relationships
 * 3. Branch refs
 * 4. Merge commits
 * 5. Tag refs
 * 6. Normalized graph (lanes & edges)
 * 7. Current branch indicator
 * 8. Commit selection
 * 9. Commit metadata (getCommitDetails)
 * 10. Commit file list & stats
 * 11. Commit diff
 * 12. File history (getFileHistory)
 * 13. Branch history filtering
 * 14. Non-Git workspace handling
 * 15. Missing commit error handling
 * 16. Bounded history (maxCount & pagination)
 * 17. Refresh after commit
 * 18. Refresh after branch switch
 * 19. Merge-parent diff comparison
 * 20. IPC bridge readiness
 * 21. UI state synchronization
 */

const fs = require('fs');
const path = require('path');
const assert = require('assert');

// Set Git environment isolation
process.env.GIT_CONFIG_GLOBAL = '/dev/null';
process.env.GIT_CONFIG_NOSYSTEM = '1';
process.env.GIT_AUTHOR_NAME = 'Nexus Engineer';
process.env.GIT_AUTHOR_EMAIL = 'engineer@nexus-ide.internal';
process.env.GIT_COMMITTER_NAME = 'Nexus Engineer';
process.env.GIT_COMMITTER_EMAIL = 'engineer@nexus-ide.internal';

const simpleGit = require('simple-git');
const gitManager = require('./gitManager');

const TEST_DIR = path.resolve(__dirname, 'tmp_git_history_test_repo');

async function setupTestRepo() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_DIR, { recursive: true });
  fs.mkdirSync(path.join(TEST_DIR, 'src'), { recursive: true });

  const git = simpleGit({ baseDir: TEST_DIR });
  await git.init();
  await git.addConfig('user.name', 'Nexus Engineer');
  await git.addConfig('user.email', 'engineer@nexus-ide.internal');

  // Initial commit A
  fs.writeFileSync(path.join(TEST_DIR, 'README.md'), '# Nexus Project\nInitial release.\n', 'utf8');
  fs.writeFileSync(path.join(TEST_DIR, 'src', 'auth.ts'), 'export function login() { return true; }\n', 'utf8');
  await git.add(['.']);
  await git.commit('feat: initial commit A');
  await git.branch(['-M', 'main']);
  await git.addTag('v0.1.0');

  // Commit B on main
  fs.writeFileSync(path.join(TEST_DIR, 'src', 'auth.ts'), 'export function login(user: string) { return Boolean(user); }\n', 'utf8');
  await git.add(['src/auth.ts']);
  await git.commit('feat: update login signature B');

  // Create branch feature and make commit C
  await git.checkoutLocalBranch('feature');
  fs.writeFileSync(path.join(TEST_DIR, 'src', 'session.ts'), 'export function getSession() { return "sess_123"; }\n', 'utf8');
  await git.add(['src/session.ts']);
  await git.commit('feat: add session manager C');
  await git.addTag('v0.2.0-beta');

  // Checkout main and make commit E
  await git.checkout('main');
  fs.writeFileSync(path.join(TEST_DIR, 'src', 'config.ts'), 'export const PORT = 3000;\n', 'utf8');
  await git.add(['src/config.ts']);
  await git.commit('chore: add config file E');

  // Merge feature into main (Merge commit D)
  await git.merge(['feature', '-m', 'merge: merge feature into main D']);
}

function cleanupTestRepo() {
  if (fs.existsSync(TEST_DIR)) {
    fs.rmSync(TEST_DIR, { recursive: true, force: true });
  }
}

async function runAllTests() {
  console.log('==================================================');
  console.log('MILESTONE 28: GIT VISUAL HISTORY TEST SUITE (21 SCENARIOS)');
  console.log('==================================================\n');

  await setupTestRepo();

  try {
    // 1. Commit retrieval
    console.log('  Testing Scenario 1: Commit retrieval...');
    const h1 = await gitManager.getCommitHistory(TEST_DIR);
    assert.strictEqual(h1.success, true);
    assert.strictEqual(h1.isRepo, true);
    assert(h1.commits.length >= 4, `Expected at least 4 commits, got ${h1.commits.length}`);
    const latest = h1.commits[0];
    assert(latest.hash && latest.hash.length === 40, 'Commit must have 40-char full hash');
    assert(latest.shortHash && latest.shortHash.length === 7, 'Commit must have shortHash');
    assert(latest.message, 'Commit must have message');
    assert.strictEqual(latest.author, 'Nexus Engineer');
    assert.strictEqual(latest.email, 'engineer@nexus-ide.internal');
    assert(latest.timestamp > 0, 'Commit must have timestamp');
    console.log('  ✓ Scenario 1 passed\n');

    // 2. Parent relationships
    console.log('  Testing Scenario 2: Parent relationships...');
    const mergeCommit = h1.commits.find((c) => c.isMerge);
    assert(mergeCommit, 'Merge commit D must exist');
    assert.strictEqual(mergeCommit.parents.length, 2, 'Merge commit must have exactly 2 parents');
    assert(h1.commits.some((c) => c.hash === mergeCommit.parents[0]), 'Parent 1 must exist in commits');
    assert(h1.commits.some((c) => c.hash === mergeCommit.parents[1]), 'Parent 2 must exist in commits');
    console.log('  ✓ Scenario 2 passed\n');

    // 3. Branch refs
    console.log('  Testing Scenario 3: Branch refs...');
    const mainHeadCommit = h1.commits.find((c) => c.branchRefs.includes('main') || (h1.refs[c.hash] && h1.refs[c.hash].branches.includes('main')));
    assert(mainHeadCommit, 'main branch ref must be attached to a commit');
    const featureCommit = h1.commits.find((c) => c.branchRefs.includes('feature') || (h1.refs[c.hash] && h1.refs[c.hash].branches.includes('feature')));
    assert(featureCommit, 'feature branch ref must be attached to commit C');
    console.log('  ✓ Scenario 3 passed\n');

    // 4. Merge commits
    console.log('  Testing Scenario 4: Merge commit identification...');
    assert.strictEqual(mergeCommit.isMerge, true);
    const regularCommit = h1.commits.find((c) => !c.isMerge);
    assert.strictEqual(regularCommit.isMerge, false);
    console.log('  ✓ Scenario 4 passed\n');

    // 5. Tag refs
    console.log('  Testing Scenario 5: Tag refs extraction...');
    const taggedCommitV1 = h1.commits.find((c) => c.tags.includes('v0.1.0'));
    assert(taggedCommitV1, 'Tag v0.1.0 must be parsed on initial commit');
    const taggedCommitV2 = h1.commits.find((c) => c.tags.includes('v0.2.0-beta'));
    assert(taggedCommitV2, 'Tag v0.2.0-beta must be parsed on feature commit');
    console.log('  ✓ Scenario 5 passed\n');

    // 6. Normalized graph (lanes and edges)
    console.log('  Testing Scenario 6: Normalized graph topology...');
    assert(Array.isArray(h1.edges), 'Graph must produce edges array');
    assert(h1.edges.length >= 3, 'Must have topological edges connecting commits');
    assert(h1.commits.every((c) => typeof c.lane === 'number' && c.lane >= 0), 'Every commit must have a lane number');
    assert(h1.edges.some((e) => e.isMerge), 'Merge edge must be demarcated with isMerge: true');
    console.log('  ✓ Scenario 6 passed\n');

    // 7. Current branch indicator
    console.log('  Testing Scenario 7: Current branch indicator...');
    assert.strictEqual(h1.currentBranch, 'main');
    const headCommit = h1.commits.find((c) => c.isHead);
    assert(headCommit, 'A commit must be demarcated as HEAD');
    console.log('  ✓ Scenario 7 passed\n');

    // 8. Commit selection
    console.log('  Testing Scenario 8: Commit selection...');
    const selectedHash = taggedCommitV1.hash;
    const found = h1.commits.find((c) => c.hash === selectedHash);
    assert.strictEqual(found.hash, selectedHash);
    console.log('  ✓ Scenario 8 passed\n');

    // 9. Commit metadata (getCommitDetails)
    console.log('  Testing Scenario 9: Commit details metadata retrieval...');
    const details = await gitManager.getCommitDetails(TEST_DIR, taggedCommitV1.hash);
    assert.strictEqual(details.success, true);
    assert.strictEqual(details.commit.hash, taggedCommitV1.hash);
    assert.strictEqual(details.commit.shortHash, taggedCommitV1.shortHash);
    assert.strictEqual(details.commit.author, 'Nexus Engineer');
    assert(details.commit.body.includes('feat: initial commit A'));
    console.log('  ✓ Scenario 9 passed\n');

    // 10. Commit file list & stats
    console.log('  Testing Scenario 10: Commit file list and numstats...');
    assert(Array.isArray(details.commit.filesChanged), 'filesChanged must be array');
    assert.strictEqual(details.commit.filesChanged.length, 2, 'Initial commit had 2 files');
    assert(details.commit.filesChanged.some((f) => f.file === 'README.md'));
    assert(details.commit.filesChanged.some((f) => f.file === 'src/auth.ts'));
    assert(details.commit.insertions > 0, 'Insertions must be positive');
    console.log('  ✓ Scenario 10 passed\n');

    // 11. Commit diff
    console.log('  Testing Scenario 11: Commit diff calculation...');
    const diffRes = await gitManager.getCommitDiff(TEST_DIR, taggedCommitV1.hash, 'src/auth.ts');
    assert.strictEqual(diffRes.success, true);
    assert(diffRes.diff.includes('+export function login()'), 'Diff must contain added login function');
    assert(diffRes.modifiedContent.includes('export function login()'), 'Modified content must contain login');
    console.log('  ✓ Scenario 11 passed\n');

    // 12. File history (getFileHistory)
    console.log('  Testing Scenario 12: File history tracking...');
    const authHistory = await gitManager.getFileHistory(TEST_DIR, 'src/auth.ts');
    assert.strictEqual(authHistory.success, true);
    assert(authHistory.commits.length >= 2, `Expected at least 2 commits modifying src/auth.ts, got ${authHistory.commits.length}`);
    assert(authHistory.commits.some((c) => c.message.includes('initial commit A')));
    assert(authHistory.commits.some((c) => c.message.includes('update login signature B')));
    console.log('  ✓ Scenario 12 passed\n');

    // 13. Branch history filtering
    console.log('  Testing Scenario 13: Branch history filtering...');
    const featureHistory = await gitManager.getCommitHistory(TEST_DIR, { branch: 'feature' });
    assert.strictEqual(featureHistory.success, true);
    assert(featureHistory.commits.some((c) => c.message.includes('add session manager C')));
    console.log('  ✓ Scenario 13 passed\n');

    // 14. Non-Git workspace handling
    console.log('  Testing Scenario 14: Non-Git workspace error handling...');
    const nonGitDir = path.resolve(__dirname, 'tmp_non_git_dir_xyz');
    if (!fs.existsSync(nonGitDir)) fs.mkdirSync(nonGitDir, { recursive: true });
    try {
      const nonGitRes = await gitManager.getCommitHistory(nonGitDir);
      assert.strictEqual(nonGitRes.success, false);
      assert.strictEqual(nonGitRes.isRepo, false);
      assert.strictEqual(nonGitRes.commits.length, 0);
      assert(nonGitRes.error.includes('Not a git repository'));
    } finally {
      if (fs.existsSync(nonGitDir)) fs.rmSync(nonGitDir, { recursive: true, force: true });
    }
    console.log('  ✓ Scenario 14 passed\n');

    // 15. Missing commit error handling
    console.log('  Testing Scenario 15: Missing commit error handling...');
    await assert.rejects(
      async () => {
        await gitManager.getCommitDetails(TEST_DIR, 'deadbeef1234567890abcdefdeadbeef12345678');
      },
      (err) => {
        assert(err.message);
        return true;
      }
    );
    console.log('  ✓ Scenario 15 passed\n');

    // 16. Bounded history (maxCount & pagination)
    console.log('  Testing Scenario 16: Bounded history pagination...');
    const bounded = await gitManager.getCommitHistory(TEST_DIR, { maxCount: 2 });
    assert.strictEqual(bounded.commits.length, 2, 'History must be bounded to maxCount: 2');
    const skipped = await gitManager.getCommitHistory(TEST_DIR, { maxCount: 2, skip: 1 });
    assert.strictEqual(skipped.commits.length, 2);
    assert.notStrictEqual(bounded.commits[0].hash, skipped.commits[0].hash, 'Skipped history must start from offset');
    console.log('  ✓ Scenario 16 passed\n');

    // 17. Refresh after commit
    console.log('  Testing Scenario 17: Refresh after new commit...');
    const git = simpleGit({ baseDir: TEST_DIR });
    fs.writeFileSync(path.join(TEST_DIR, 'src', 'auth.ts'), 'export function login() { return "v3"; }\n', 'utf8');
    await git.add(['src/auth.ts']);
    await git.commit('feat: updated login for refresh test F');

    const refreshed = await gitManager.getCommitHistory(TEST_DIR);
    assert(refreshed.commits.length >= h1.commits.length + 1, 'History count must increase after commit');
    assert(refreshed.commits.some((c) => c.message.includes('refresh test F')), 'New commit must be present in refreshed commit history');
    console.log('  ✓ Scenario 17 passed\n');

    // 18. Refresh after branch switch
    console.log('  Testing Scenario 18: Refresh after branch switch...');
    await git.checkout('feature');
    const featureSwitched = await gitManager.getCommitHistory(TEST_DIR);
    assert.strictEqual(featureSwitched.currentBranch, 'feature');
    assert(featureSwitched.commits.some((c) => c.branchRefs.includes('feature')));
    await git.checkout('main');
    console.log('  ✓ Scenario 18 passed\n');

    // 19. Merge-parent diff comparison
    console.log('  Testing Scenario 19: Merge-parent diff selection...');
    const mergeDiffP1 = await gitManager.getCommitDiff(TEST_DIR, mergeCommit.hash, null, 0);
    assert.strictEqual(mergeDiffP1.success, true);
    assert.strictEqual(mergeDiffP1.parentIndex, 0);
    assert.strictEqual(mergeDiffP1.parentHash, mergeCommit.parents[0]);

    const mergeDiffP2 = await gitManager.getCommitDiff(TEST_DIR, mergeCommit.hash, null, 1);
    assert.strictEqual(mergeDiffP2.success, true);
    assert.strictEqual(mergeDiffP2.parentIndex, 1);
    assert.strictEqual(mergeDiffP2.parentHash, mergeCommit.parents[1]);
    console.log('  ✓ Scenario 19 passed\n');

    // 20. IPC bridge readiness
    console.log('  Testing Scenario 20: IPC bridge readiness...');
    assert(typeof gitManager.getCommitHistory === 'function', 'gitManager.getCommitHistory must be function');
    assert(typeof gitManager.getCommitDetails === 'function', 'gitManager.getCommitDetails must be function');
    assert(typeof gitManager.getCommitDiff === 'function', 'gitManager.getCommitDiff must be function');
    assert(typeof gitManager.getFileHistory === 'function', 'gitManager.getFileHistory must be function');
    console.log('  ✓ Scenario 20 passed\n');

    // 21. UI state synchronization
    console.log('  Testing Scenario 21: UI state synchronization...');
    const historyRes = await gitManager.getCommitHistory(TEST_DIR);
    assert(historyRes.commits && historyRes.edges && historyRes.refs && Array.isArray(historyRes.branches));
    for (const c of historyRes.commits) {
      assert(typeof c.lane === 'number');
      assert(Array.isArray(c.parents));
      assert(Array.isArray(c.branchRefs));
      assert(Array.isArray(c.tags));
      assert(typeof c.isMerge === 'boolean');
    }
    console.log('  ✓ Scenario 21 passed\n');

    console.log('==================================================');
    console.log('ALL 21/21 MILESTONE 28 SCENARIOS PASSED WITH ZERO ERRORS!');
    console.log('==================================================');
  } finally {
    cleanupTestRepo();
  }
}

runAllTests().catch((err) => {
  console.error('\n❌ TEST SUITE FAILED:', err);
  cleanupTestRepo();
  process.exit(1);
});
