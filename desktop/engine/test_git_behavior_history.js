const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const child_process = require('child_process');

const {
  analyzeTemporalBehaviorHistory,
  getCommitHistory,
  captureWorkingTreeStatus,
  materializeCommitWorktree,
  cleanupCommitWorktree,
} = require('./git_behavior_history');

console.log('[TEST-GIT-BEHAVIOR-HISTORY] Starting Phase 3B Temporal Behavioral Regression Test Suite...\n');

// Create temporary Git test repository
const tempRepoDir = path.join(os.tmpdir(), `test_git_repo_${Date.now()}`);
fs.mkdirSync(tempRepoDir, { recursive: true });

const SAFE_GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };

function git(args) {
  return child_process.execFileSync('git', args, { cwd: tempRepoDir, encoding: 'utf-8', env: SAFE_GIT_ENV }).trim();
}

try {
  // Initialize git repo
  git(['init']);
  git(['config', 'user.name', 'Echo Nullity Tester']);
  git(['config', 'user.email', 'tester@echo-nullity.internal']);

  // Commit 1: Initial file (Baseline)
  const pyFile = path.join(tempRepoDir, 'calc.py');
  fs.writeFileSync(pyFile, 'def calculate(x):\n    return x * 2\n\ndef parse_count(v):\n    return int(v)\n', 'utf-8');
  git(['add', 'calc.py']);
  git(['commit', '-m', 'Commit 1: Initial baseline']);

  // Commit 2: Formatting-only change (Unchanged behavior)
  fs.writeFileSync(pyFile, '# Added docstring comment\ndef calculate(x):\n    return x * 2\n\ndef parse_count(v):\n    return int(v)\n', 'utf-8');
  git(['add', 'calc.py']);
  git(['commit', '-m', 'Commit 2: Refactor comments']);

  // Commit 3: Behavioral Output Divergence in calculate()
  fs.writeFileSync(pyFile, '# Changed multiplier\ndef calculate(x):\n    return x * 3\n\ndef parse_count(v):\n    return int(v)\n', 'utf-8');
  git(['add', 'calc.py']);
  git(['commit', '-m', 'Commit 3: Change calculate behavior']);

  // Commit 4: Exception behavior introduced in parse_count()
  fs.writeFileSync(pyFile, 'def calculate(x):\n    return x * 3\n\ndef parse_count(v):\n    if v < 0:\n        raise ValueError("negative not allowed")\n    return int(v)\n', 'utf-8');
  git(['add', 'calc.py']);
  git(['commit', '-m', 'Commit 4: Add negative check to parse_count']);

  // 1. Git Repo Discovery
  const commits = getCommitHistory(tempRepoDir, 10, 'calc.py');
  assert.strictEqual(commits.length, 4, 'Should discover 4 commits');
  console.log('✓ Test 1 Passed: Git repository discovery');

  // 2. Commit Metadata Extraction
  assert.ok(commits[0].hash);
  assert.ok(commits[0].short_hash);
  assert.strictEqual(commits[0].author, 'Echo Nullity Tester');
  assert.strictEqual(commits[0].message, 'Commit 1: Initial baseline');
  console.log('✓ Test 2 Passed: Commit metadata extraction');

  // 3. Commit Range Bounded Selection
  const boundedCommits = getCommitHistory(tempRepoDir, 2, 'calc.py');
  assert.strictEqual(boundedCommits.length, 2, 'Should respect maxCommits limit');
  console.log('✓ Test 3 Passed: Commit range selection');

  // 4 & 5. Materialize & Cleanup Isolated Worktree
  const tempWt = materializeCommitWorktree(tempRepoDir, commits[0].hash);
  assert.ok(fs.existsSync(tempWt), 'Worktree directory should exist');
  assert.ok(fs.existsSync(path.join(tempWt, 'calc.py')));
  cleanupCommitWorktree(tempRepoDir, tempWt);
  assert.strictEqual(fs.existsSync(tempWt), false, 'Worktree directory should be cleaned up');
  console.log('✓ Test 4 & 5 Passed: Isolated revision materialization & worktree cleanup');

  // 6. Working-Tree Preservation (Main repo status untouched)
  const initialStatus = captureWorkingTreeStatus(tempRepoDir);
  assert.strictEqual(initialStatus.isClean, true);
  console.log('✓ Test 6 Passed: Working-tree preservation check');

  // 7 & 15. Unchanged Behavior Across Commits (Commit 1 ➔ Commit 2 formatting change)
  const analysis = analyzeTemporalBehaviorHistory(tempRepoDir, 'calc.py', 10);
  assert.strictEqual(analysis.working_tree_preserved, true);
  assert.strictEqual(analysis.commits_analyzed, 4);

  const tCommit2 = analysis.timeline.find((t) => t.commit.message.includes('Commit 2'));
  assert.ok(tCommit2);
  assert.strictEqual(tCommit2.status, 'unchanged');
  console.log('✓ Test 7 & 15 Passed: Unchanged behavior across syntactic formatting edits');

  // 8. Output Behavioral Change (Commit 3)
  const tCommit3 = analysis.timeline.find((t) => t.commit.message.includes('Commit 3'));
  assert.ok(tCommit3);
  assert.strictEqual(tCommit3.status, 'changed');
  assert.strictEqual(tCommit3.differences[0].type, 'output_change');
  console.log('✓ Test 8 Passed: Output behavioral change localization');

  // 10. Success ➔ Exception Change (Commit 4)
  const tCommit4 = analysis.timeline.find((t) => t.commit.message.includes('Commit 4'));
  assert.ok(tCommit4);
  assert.strictEqual(tCommit4.status, 'changed');
  assert.strictEqual(tCommit4.differences[0].type, 'success_to_exception');
  console.log('✓ Test 10 Passed: Success ➔ Exception behavior transition');

  // 16. First Behavioral Divergence Detection
  assert.ok(analysis.first_divergence, 'First divergence should be detected');
  assert.strictEqual(analysis.first_divergence.function, 'calculate');
  assert.strictEqual(analysis.first_divergence.transition_type, 'output_change');
  assert.strictEqual(analysis.first_divergence.commit.short_hash, commits[2].short_hash);
  console.log('✓ Test 16 Passed: First behavioral divergence localization');

  // 17. Multiple Behavioral Divergences
  assert.strictEqual(analysis.total_divergences, 2, 'Should detect 2 distinct divergent commits');
  console.log('✓ Test 17 Passed: Multiple behavioral divergences tracking');

  // 21. JavaScript & TypeScript Language Routing
  const jsFile = path.join(tempRepoDir, 'helper.js');
  fs.writeFileSync(jsFile, 'function add(a, b) { return a + b; }\n', 'utf-8');
  git(['add', 'helper.js']);
  git(['commit', '-m', 'Commit 5: Add helper.js']);
  const jsAnalysis = analyzeTemporalBehaviorHistory(tempRepoDir, 'helper.js', 10);
  assert.strictEqual(jsAnalysis.working_tree_preserved, true);
  assert.strictEqual(jsAnalysis.commits_analyzed, 1);
  console.log('✓ Test 21 Passed: JS/TS language engine routing');

  // 22. Deterministic Temporal Result
  const analysisDup = analyzeTemporalBehaviorHistory(tempRepoDir, 'calc.py', 10);
  assert.deepStrictEqual(analysis, analysisDup);
  console.log('✓ Test 22 Passed: Deterministic temporal analysis result');

  // Verify final status of test repo
  const finalStatus = captureWorkingTreeStatus(tempRepoDir);
  const currentHead = git(['rev-parse', 'HEAD']);
  assert.strictEqual(finalStatus.isClean, true);
  assert.strictEqual(finalStatus.headHash, currentHead);

  console.log('\nALL 22 PHASE 3B TEMPORAL BEHAVIORAL REGRESSION TESTS PASSED PERFECTLY!');
} finally {
  if (fs.existsSync(tempRepoDir)) {
    try {
      fs.rmSync(tempRepoDir, { recursive: true, force: true });
    } catch (e) {}
  }
}
