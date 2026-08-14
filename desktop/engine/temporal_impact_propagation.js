#!/usr/bin/env node
/**
 * Echo Nullity — Milestone 20: Temporal Impact Propagation Engine
 * Traces how behavioral changes in a target function propagate through the call graph over Git history.
 * Safely analyzes revisions in isolated temporary worktrees without touching the active working tree.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const child_process = require('child_process');
const { compareBehavioralFingerprints } = require('./behavior_compare');
const { generateJSBehavioralFingerprint } = require('./js_behavior_fingerprint');
const { computeBehavioralImpactRadius } = require('./behavioral_impact_radius');

const SCHEMA_VERSION = 1;
const DEFAULT_MAX_COMMITS = 20;
const DEFAULT_MAX_DEPTH = 3;

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
  if (targetFile && fs.existsSync(path.join(repoPath, targetFile))) {
    gitArgs.push('--', targetFile);
  }

  try {
    const rawLog = child_process.execFileSync('git', gitArgs, { cwd: repoPath, encoding: 'utf-8', env: SAFE_GIT_ENV }).trim();
    if (!rawLog) return [];

    const commits = rawLog.split('\n').filter(Boolean).map((line) => {
      const parts = line.split('|');
      return {
        hash: parts[0] || '',
        short_hash: parts[1] || '',
        author: parts[2] || '',
        timestamp: parts[3] || '',
        message: parts.slice(4).join('|') || '',
      };
    });

    // Reverse so oldest commit is first (C_0), newest commit is last (C_N)
    commits.reverse();
    return commits;
  } catch (err) {
    return [];
  }
}

/**
 * Materializes a commit revision into an isolated temporary worktree path.
 */
function materializeCommitWorktree(repoPath, commitHash) {
  const tempDir = path.join(os.tmpdir(), `echonullity_prop_${commitHash.substring(0, 7)}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
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
 * Fingerprints a single source file in target worktree directory.
 */
function fingerprintSourceFile(filePath) {
  if (!filePath || !fs.existsSync(filePath)) return null;

  const isJS = filePath.match(/\.(js|jsx|ts|tsx)$/i);
  if (isJS) {
    return generateJSBehavioralFingerprint(filePath);
  } else if (filePath.endsWith('.py')) {
    const enginePath = path.join(__dirname, 'behavior_fingerprint.py');
    try {
      const out = child_process.execFileSync('python3', [enginePath, filePath], { encoding: 'utf-8', timeout: 15000 });
      return JSON.parse(out);
    } catch (e) {
      return null;
    }
  }
  return null;
}

/**
 * Calculates Temporal Impact Propagation across Git revisions.
 */
function calculatePropagationTimeline(payload) {
  if (!payload || typeof payload !== 'object') {
    return { schema_version: SCHEMA_VERSION, error: 'Invalid or missing payload supplied to Propagation Timeline Engine.' };
  }

  const repoPath = payload.repositoryPath || payload.repository_path || process.cwd();
  const targetFile = payload.targetFile || payload.target_file || '';
  const targetFunction = payload.targetFunction || payload.target_function || '';
  const maxCommits = payload.maxCommits || payload.max_commits || DEFAULT_MAX_COMMITS;
  const maxDepth = payload.maxDepth || payload.max_depth || DEFAULT_MAX_DEPTH;
  const workspaceGraph = payload.workspaceGraph || payload.workspace_graph || { nodes: [], edges: [] };

  // 1. Verify Git working tree initial status
  const initialStatus = captureWorkingTreeStatus(repoPath);
  if (initialStatus.error) {
    return { schema_version: SCHEMA_VERSION, error: initialStatus.error };
  }

  const commits = getCommitHistory(repoPath, maxCommits, targetFile.length > 0 ? targetFile : null);
  if (commits.length === 0) {
    return {
      schema_version: SCHEMA_VERSION,
      repository: path.basename(repoPath),
      target_file: targetFile,
      target_function: targetFunction,
      commits_analyzed: 0,
      working_tree_preserved: true,
      root_change: null,
      propagation_events: [],
      unaffected_predicted_callers: [],
      timeline_summary: { total_nodes_in_graph: 0, observed_propagation_count: 0, unaffected_callers_count: 0 },
    };
  }

  // 2. Discover downstream callers from call graph via BFS
  const impactRadiusResult = computeBehavioralImpactRadius({
    root_function: targetFunction,
    root_file: targetFile,
    workspace_graph: workspaceGraph,
    max_depth: maxDepth,
  });

  const predictedCallers = (impactRadiusResult.impacted_nodes || []).map((n) => ({
    symbol: n.symbol,
    file: n.file,
    line: n.line,
    distance: n.distance,
    relationship: n.relationship,
  }));

  // Map of file paths that need fingerprinting per commit
  const filesToFingerprint = new Set();
  if (targetFile) filesToFingerprint.add(targetFile);
  for (const caller of predictedCallers) {
    if (caller.file) filesToFingerprint.add(caller.file);
  }

  // Array storing per-commit fingerprint objects
  const commitFingerprints = [];

  try {
    // 3. Materialize each commit sequentially and compute fingerprints
    for (let i = 0; i < commits.length; i++) {
      const commit = commits[i];
      let tempWorktree = null;

      try {
        tempWorktree = materializeCommitWorktree(repoPath, commit.hash);
        const fileFps = {};

        for (const relFile of filesToFingerprint) {
          const absFile = path.join(tempWorktree, relFile);
          if (fs.existsSync(absFile)) {
            const fp = fingerprintSourceFile(absFile);
            if (fp && !fp.error) {
              fileFps[relFile] = fp;
            }
          }
        }

        commitFingerprints.push({
          commitIndex: i,
          commit,
          fileFingerprints: fileFps,
        });
      } finally {
        if (tempWorktree) {
          cleanupCommitWorktree(repoPath, tempWorktree);
        }
      }
    }

    // 4. Chronological Change-Point Detection
    let rootChangeCommit = null;
    let rootChangeIndex = -1;

    // Detect first commit where root function behavior changed
    for (let i = 1; i < commitFingerprints.length; i++) {
      const prevFps = commitFingerprints[i - 1].fileFingerprints;
      const currFps = commitFingerprints[i].fileFingerprints;

      const fpPrev = prevFps[targetFile];
      const fpCurr = currFps[targetFile];

      if (fpPrev && fpCurr) {
        const comp = compareBehavioralFingerprints(fpPrev, fpCurr);
        const fnDiff = (comp.changed_functions || []).find((f) => f.name.toLowerCase() === targetFunction.toLowerCase());
        if (fnDiff && fnDiff.differences_count > 0) {
          rootChangeCommit = commitFingerprints[i].commit;
          rootChangeIndex = i;
          break;
        }
      }
    }

    // If root function change was not localized between adjacent commits, fall back to baseline vs newest diff
    if (!rootChangeCommit && commitFingerprints.length > 0) {
      rootChangeCommit = commitFingerprints[0].commit;
      rootChangeIndex = 0;
    }

    // 5. Downstream Propagation Detection per Caller
    const propagationEvents = [];
    const unaffectedPredictedCallers = [];

    for (const caller of predictedCallers) {
      let firstChangedCommitForCaller = null;
      let firstChangedIndexForCaller = -1;
      let callerDiffSeverity = 'LOW';
      let callerDiffs = [];

      for (let i = Math.max(1, rootChangeIndex); i < commitFingerprints.length; i++) {
        const prevFps = commitFingerprints[i - 1].fileFingerprints;
        const currFps = commitFingerprints[i].fileFingerprints;

        const fpPrev = prevFps[caller.file];
        const fpCurr = currFps[caller.file];

        if (fpPrev && fpCurr) {
          const comp = compareBehavioralFingerprints(fpPrev, fpCurr);
          const fnDiff = (comp.changed_functions || []).find((f) => f.name.toLowerCase() === caller.symbol.toLowerCase());
          if (fnDiff && fnDiff.differences_count > 0) {
            firstChangedCommitForCaller = commitFingerprints[i].commit;
            firstChangedIndexForCaller = i;
            callerDiffSeverity = comp.severity || 'MEDIUM';
            callerDiffs = fnDiff.differences;
            break;
          }
        }
      }

      if (firstChangedCommitForCaller) {
        const delayCommits = Math.max(0, firstChangedIndexForCaller - rootChangeIndex);
        propagationEvents.push({
          function: caller.symbol,
          file: caller.file,
          line: caller.line,
          distance: caller.distance,
          relationship: caller.relationship,
          first_changed_commit: firstChangedCommitForCaller,
          delay_commits: delayCommits,
          classification: 'OBSERVED_CHANGE',
          severity: callerDiffSeverity,
          description: `Direct/indirect caller '${caller.symbol}' first exhibited behavioral change at commit ${firstChangedCommitForCaller.short_hash} (${delayCommits} commit(s) after root change).`,
          differences: callerDiffs,
        });
      } else {
        unaffectedPredictedCallers.push(caller.symbol);
      }
    }

    // Sort propagation events by hop distance then delay_commits
    propagationEvents.sort((a, b) => a.distance - b.distance || a.delay_commits - b.delay_commits);

    // 6. Verify Git working tree final status
    const finalStatus = captureWorkingTreeStatus(repoPath);
    const workingTreePreserved = initialStatus.headHash === finalStatus.headHash && finalStatus.isClean === initialStatus.isClean;

    return {
      schema_version: SCHEMA_VERSION,
      repository: path.basename(repoPath),
      target_file: targetFile,
      target_function: targetFunction,
      commits_analyzed: commits.length,
      working_tree_preserved: workingTreePreserved,
      root_change: rootChangeCommit,
      propagation_events: propagationEvents,
      unaffected_predicted_callers: Array.from(new Set(unaffectedPredictedCallers)),
      timeline_summary: {
        total_nodes_in_graph: predictedCallers.length + 1,
        observed_propagation_count: propagationEvents.length,
        unaffected_callers_count: unaffectedPredictedCallers.length,
        max_propagation_delay_commits: propagationEvents.reduce((max, e) => Math.max(max, e.delay_commits), 0),
      },
    };
  } finally {
    // Extra safety verify
    const safetyCheck = captureWorkingTreeStatus(repoPath);
    if (!safetyCheck.isClean && initialStatus.isClean) {
      console.error('[TEMPORAL-PROPAGATION-WARN] Working tree dirty after run:', safetyCheck.porcelainStatus);
    }
  }
}

if (require.main === module) {
  let raw = '';
  process.stdin.on('data', (chunk) => {
    raw += chunk;
  });
  process.stdin.on('end', () => {
    try {
      const payload = JSON.parse(raw);
      const res = calculatePropagationTimeline(payload);
      console.log(JSON.stringify(res, null, 2));
    } catch (e) {
      console.log(JSON.stringify({ schema_version: SCHEMA_VERSION, error: `JSON stdin decode error: ${e.message}` }));
    }
  });
}

module.exports = { calculatePropagationTimeline, captureWorkingTreeStatus, getCommitHistory };
