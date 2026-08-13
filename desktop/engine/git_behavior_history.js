#!/usr/bin/env node
/**
 * Echo Nullity — Phase 3B: Temporal / Git Behavioral Regression Localization Engine
 * Safely analyzes Git revisions using isolated temporary worktrees without touching the active working tree.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const child_process = require('child_process');
const { compareBehavioralFingerprints } = require('./behavior_compare');
const { generateJSBehavioralFingerprint } = require('./js_behavior_fingerprint');

const SCHEMA_VERSION = 1;
const DEFAULT_MAX_COMMITS = 25;

const SAFE_GIT_ENV = { ...process.env, GIT_CONFIG_GLOBAL: '/dev/null', GIT_CONFIG_NOSYSTEM: '1' };

/**
 * Safely captures working tree state (HEAD hash, branch name, uncommitted changes status).
 */
function captureWorkingTreeStatus(repoPath) {
  try {
    const headHash = child_process.execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoPath, encoding: 'utf-8', env: SAFE_GIT_ENV }).trim();
    let branchName = 'HEAD';
    try {
      branchName = child_process.execFileSync('git', ['symbolic-ref', '--short', 'HEAD'], { cwd: repoPath, encoding: 'utf-8', env: SAFE_GIT_ENV }).trim();
    } catch (e) {}
    const porcelainStatus = child_process.execFileSync('git', ['status', '--porcelain'], { cwd: repoPath, encoding: 'utf-8', env: SAFE_GIT_ENV }).trim();

    return {
      headHash,
      branchName,
      isClean: porcelainStatus.length === 0,
      porcelainStatus,
    };
  } catch (err) {
    return { error: `Failed to capture git status: ${err.message}` };
  }
}

/**
 * Extracts structured Git commit log from repository.
 */
function getCommitHistory(repoPath, maxCommits = DEFAULT_MAX_COMMITS, targetFile = null) {
  const gitArgs = ['log', `-n${maxCommits}`, '--format=%H|%h|%an|%aI|%s'];
  if (targetFile) {
    gitArgs.push('--', targetFile);
  }

  try {
    const rawLog = child_process.execFileSync('git', gitArgs, { cwd: repoPath, encoding: 'utf-8', env: SAFE_GIT_ENV }).trim();
    if (!rawLog) return [];

    const commits = rawLog.split('\n').map((line) => {
      const parts = line.split('|');
      return {
        hash: parts[0] || '',
        short_hash: parts[1] || '',
        author: parts[2] || '',
        timestamp: parts[3] || '',
        message: parts.slice(4).join('|') || '',
      };
    });

    // Reverse so oldest (baseline) commit is first, newest commit is last
    commits.reverse();
    return commits;
  } catch (err) {
    return [];
  }
}

/**
 * Safely materializes a commit revision into an isolated temporary worktree path.
 */
function materializeCommitWorktree(repoPath, commitHash) {
  const tempDir = path.join(os.tmpdir(), `echonullity_wt_${commitHash.substring(0, 7)}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
  
  try {
    child_process.execFileSync('git', ['worktree', 'add', '--detach', tempDir, commitHash], {
      cwd: repoPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: SAFE_GIT_ENV,
    });
    return tempDir;
  } catch (err) {
    throw new Error(`Failed to create isolated git worktree for ${commitHash}: ${err.message}`);
  }
}

/**
 * Cleans up isolated temporary worktree safely.
 */
function cleanupCommitWorktree(repoPath, tempDir) {
  if (!tempDir || !fs.existsSync(tempDir)) return;
  try {
    child_process.execFileSync('git', ['worktree', 'remove', '--force', tempDir], {
      cwd: repoPath,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: SAFE_GIT_ENV,
    });
  } catch (err) {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
      child_process.execFileSync('git', ['worktree', 'prune'], { cwd: repoPath, stdio: ['pipe', 'pipe', 'pipe'], env: SAFE_GIT_ENV });
    } catch (e) {}
  }
}

/**
 * Fingerprints a single source file using appropriate language engine.
 */
function fingerprintSourceFile(filePath) {
  const isJS = filePath.match(/\.(js|jsx|ts|tsx)$/i);
  if (isJS) {
    return generateJSBehavioralFingerprint(filePath);
  } else if (filePath.endsWith('.py')) {
    const enginePath = path.join(__dirname, 'behavior_fingerprint.py');
    try {
      const output = child_process.execFileSync('python3', [enginePath, filePath], {
        encoding: 'utf-8',
        maxBuffer: 10 * 1024 * 1024,
      });
      return JSON.parse(output);
    } catch (e) {
      return { error: `Python fingerprint failed: ${e.message}`, functions: [] };
    }
  }
  return { error: `Unsupported file extension: ${filePath}`, functions: [] };
}

/**
 * Computes behavioral fingerprint for a target file across an isolated commit worktree.
 */
function generateCommitFileSnapshot(repoPath, commitObj, targetRelPath) {
  let tempDir = null;
  try {
    tempDir = materializeCommitWorktree(repoPath, commitObj.hash);
    const absFilePath = path.join(tempDir, targetRelPath);

    if (!fs.existsSync(absFilePath)) {
      return {
        commit: commitObj,
        exists: false,
        file_path: targetRelPath,
        fingerprint: { schema_version: SCHEMA_VERSION, file_path: targetRelPath, functions: [] },
      };
    }

    const fp = fingerprintSourceFile(absFilePath);
    fp.file_path = targetRelPath; // Normalize path to relative

    return {
      commit: commitObj,
      exists: true,
      file_path: targetRelPath,
      fingerprint: fp,
    };
  } finally {
    if (tempDir) {
      cleanupCommitWorktree(repoPath, tempDir);
    }
  }
}

/**
 * Runs Phase 3B Temporal Behavioral Regression Analysis.
 */
function analyzeTemporalBehaviorHistory(repoPath, targetRelPath, maxCommits = DEFAULT_MAX_COMMITS) {
  const absRepo = path.resolve(repoPath);
  if (!fs.existsSync(absRepo)) {
    return {
      schema_version: SCHEMA_VERSION,
      error: `Repository directory not found: ${repoPath}`,
      timeline: [],
    };
  }

  // 1. Capture initial working tree state
  const initialStatus = captureWorkingTreeStatus(absRepo);
  if (initialStatus.error) {
    return { schema_version: SCHEMA_VERSION, error: initialStatus.error, timeline: [] };
  }

  // 2. Discover commit history
  const commits = getCommitHistory(absRepo, maxCommits, targetRelPath);
  if (commits.length === 0) {
    return {
      schema_version: SCHEMA_VERSION,
      error: `No Git commit history found for '${targetRelPath}' in repository.`,
      timeline: [],
    };
  }

  const timeline = [];
  let firstDivergence = null;

  let prevSnapshot = null;

  // 3. Sequential evaluation from baseline (oldest) to current (newest)
  for (let i = 0; i < commits.length; i++) {
    const commit = commits[i];
    const currSnapshot = generateCommitFileSnapshot(absRepo, commit, targetRelPath);

    if (i === 0) {
      // Baseline commit
      timeline.push({
        commit,
        status: 'baseline',
        severity: 'NO_CHANGE',
        exists: currSnapshot.exists,
        functions_count: currSnapshot.fingerprint.functions_count || 0,
        changes_count: 0,
        differences: [],
      });
      prevSnapshot = currSnapshot;
      continue;
    }

    // Compare previous commit snapshot vs current commit snapshot
    const comp = compareBehavioralFingerprints(prevSnapshot.fingerprint, currSnapshot.fingerprint);

    let commitStatus = 'unchanged';
    let changesCount = 0;
    const differences = [];

    if (!currSnapshot.exists && prevSnapshot.exists) {
      commitStatus = 'file_removed';
      changesCount = 1;
      differences.push({
        type: 'removed_file',
        description: `Target file '${targetRelPath}' was deleted in commit ${commit.short_hash}.`,
      });
    } else if (currSnapshot.exists && !prevSnapshot.exists) {
      commitStatus = 'file_added';
      changesCount = 1;
      differences.push({
        type: 'added_file',
        description: `Target file '${targetRelPath}' was created in commit ${commit.short_hash}.`,
      });
    } else if (comp.summary && (comp.summary.changed_functions_count > 0 || comp.summary.added_functions_count > 0 || comp.summary.removed_functions_count > 0)) {
      commitStatus = 'changed';
      changesCount = comp.summary.changed_functions_count + comp.summary.added_functions_count + comp.summary.removed_functions_count;

      for (const fn of comp.changed_functions || []) {
        for (const diff of fn.differences || []) {
          differences.push({
            function: fn.name,
            ...diff,
          });

          // Track first behavioral divergence
          if (!firstDivergence && (diff.type === 'output_change' || diff.type === 'success_to_exception' || diff.type === 'exception_to_success' || diff.type === 'success_to_timeout')) {
            firstDivergence = {
              commit,
              file: targetRelPath,
              function: fn.name,
              input: diff.input,
              transition_type: diff.type,
              status_before: diff.status_a || 'N/A',
              status_after: diff.status_b || 'N/A',
              output_before: diff.output_a || null,
              output_after: diff.output_b || null,
              exception_before: diff.exception_a || null,
              exception_after: diff.exception_b || null,
              severity: comp.severity,
              description: diff.description,
            };
          }
        }
      }
    }

    timeline.push({
      commit,
      status: commitStatus,
      severity: comp.severity || 'NO_CHANGE',
      exists: currSnapshot.exists,
      functions_count: currSnapshot.fingerprint.functions_count || 0,
      changes_count: changesCount,
      differences,
    });

    prevSnapshot = currSnapshot;
  }

  // 4. Verify post-analysis working tree safety
  const finalStatus = captureWorkingTreeStatus(absRepo);
  if (finalStatus.headHash !== initialStatus.headHash || finalStatus.porcelainStatus !== initialStatus.porcelainStatus) {
    return {
      schema_version: SCHEMA_VERSION,
      error: 'CRITICAL SAFETY FAILURE: Working tree status mutated during temporal analysis.',
      initialStatus,
      finalStatus,
    };
  }

  const totalDivergences = timeline.filter((t) => t.status === 'changed' || t.status === 'file_added' || t.status === 'file_removed').length;

  return {
    schema_version: SCHEMA_VERSION,
    repository: absRepo,
    target_file: targetRelPath,
    commits_analyzed: commits.length,
    total_divergences: totalDivergences,
    first_divergence: firstDivergence,
    timeline,
    working_tree_preserved: true,
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args[0] === '--json') {
    let raw = '';
    process.stdin.on('data', (chunk) => {
      raw += chunk;
    });
    process.stdin.on('end', () => {
      try {
        const payload = JSON.parse(raw);
        const res = analyzeTemporalBehaviorHistory(
          payload.repo_path || payload.workspacePath || process.cwd(),
          payload.target_file || payload.targetFile || 'src/cart_calculator.py',
          payload.max_commits || payload.maxCommits || DEFAULT_MAX_COMMITS
        );
        console.log(JSON.stringify(res, null, 2));
      } catch (e) {
        console.log(JSON.stringify({ schema_version: SCHEMA_VERSION, error: `JSON stdin decode error: ${e.message}` }));
      }
    });
  } else if (args.length >= 2) {
    const repoPath = args[0];
    const targetFile = args[1];
    const maxCommits = args[2] ? parseInt(args[2], 10) : DEFAULT_MAX_COMMITS;
    const res = analyzeTemporalBehaviorHistory(repoPath, targetFile, maxCommits);
    console.log(JSON.stringify(res, null, 2));
  } else {
    console.log(JSON.stringify({ error: 'Usage: node git_behavior_history.js <repoPath> <targetFile> [maxCommits]' }));
  }
}

module.exports = {
  analyzeTemporalBehaviorHistory,
  getCommitHistory,
  captureWorkingTreeStatus,
  materializeCommitWorktree,
  cleanupCommitWorktree,
};
