/**
 * NEXUS CODEX HARNESS - WORKSPACE ISOLATION MANAGER (Milestone 9A)
 * Manages isolated subagent workspace environments (Git Worktree & Shadow Copy Fallback)
 * to guarantee that parent working trees remain 100% untouched during child experimentation,
 * mutations, builds, and test executions until explicit parent-authorized adoption.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');
const {
  WORKSPACE_CLEANUP_POLICY,
  WORKSPACE_STATUS,
  WORKSPACE_ISOLATION_MODE,
  EVENT_TYPES,
  generateWorkspaceId,
} = require('./types');
const { harnessEventBus } = require('./eventBus');
const { ChangeSet } = require('./ChangeSet');
const { transactionalPatchApplier } = require('../transactionalPatchApplier');
const secretFilter = require('../../security/secretFilter');

let evidenceGraphInstance = null;
try {
  const { evidenceGraph } = require('../evidence/EvidenceGraph');
  evidenceGraphInstance = evidenceGraph;
} catch (e) {}

const PROTECTED_COPY_DIRS = new Set([
  '.git',
  'node_modules',
  '.next',
  'dist',
  'build',
  'coverage',
  '.venv',
  'venv',
  '__pycache__',
  '.gemini',
  '.turbo',
  '.vscode',
  '.DS_Store',
]);

function getGitEnv() {
  return {
    ...process.env,
    GIT_CONFIG_GLOBAL: '/dev/null',
    GIT_CONFIG_SYSTEM: '/dev/null',
    GIT_CONFIG_NOSYSTEM: '1',
    HOME: os.tmpdir(),
  };
}

class WorkspaceIsolationManager {
  /**
   * @param {Object} [options]
   * @param {Object} [options.eventBus]
   * @param {string} [options.baseStorageDir]
   */
  constructor(options = {}) {
    this.eventBus = options.eventBus || harnessEventBus;
    this.workspaces = new Map(); // workspaceId -> WorkspaceRecord
    this.threadToWorkspace = new Map(); // threadId -> workspaceId

    this.baseStorageDir = options.baseStorageDir || path.join(os.tmpdir(), 'nexus_isolated_workspaces');
    try {
      if (!fs.existsSync(this.baseStorageDir)) {
        fs.mkdirSync(this.baseStorageDir, { recursive: true });
      }
    } catch (e) {}
  }

  /**
   * Helper: Determines if a path is inside a Git repository.
   * @param {string} dirPath
   * @returns {boolean}
   */
  isGitRepository(dirPath) {
    try {
      if (!dirPath || !fs.existsSync(dirPath)) return false;
      const gitDir = path.join(dirPath, '.git');
      if (fs.existsSync(gitDir)) return true;

      // Check via git command
      execSync('git rev-parse --is-inside-work-tree', {
        cwd: dirPath,
        stdio: 'ignore',
        timeout: 3000,
        env: getGitEnv(),
      });
      return true;
    } catch (e) {
      return false;
    }
  }


  /**
   * Recursively copies files safely, excluding protected directories and preserving symlink safety.
   * @param {string} src
   * @param {string} dest
   */
  copyDirectoryRecursive(src, dest) {
    if (!fs.existsSync(src)) return;
    if (!fs.existsSync(dest)) {
      fs.mkdirSync(dest, { recursive: true });
    }

    const entries = fs.readdirSync(src, { withFileTypes: true });
    for (const entry of entries) {
      if (PROTECTED_COPY_DIRS.has(entry.name)) continue;

      const srcPath = path.join(src, entry.name);
      const destPath = path.join(dest, entry.name);

      if (entry.isDirectory()) {
        this.copyDirectoryRecursive(srcPath, destPath);
      } else if (entry.isFile()) {
        try {
          fs.copyFileSync(srcPath, destPath);
        } catch (e) {}
      }
    }
  }

  /**
   * Creates an isolated workspace for a subagent Thread.
   * @param {Object} options
   * @param {string} options.parentWorkspacePath - Parent repository / directory
   * @param {string} options.threadId - Child Thread ID
   * @param {string} [options.parentThreadId] - Parent Thread ID
   * @param {string} [options.mode] - 'auto' | 'git_worktree' | 'shadow_copy'
   * @param {string} [options.cleanupPolicy] - Cleanup policy enum
   * @param {Object} [options.metadata] - Extra metadata
   * @returns {Object} Created WorkspaceRecord
   */
  createChildWorkspace(options = {}) {
    const parentWorkspacePath = path.resolve(options.parentWorkspacePath || process.cwd());
    const threadId = options.threadId;

    if (!threadId) {
      throw new Error('[WORKSPACE-ISOLATION] threadId is required to create an isolated workspace');
    }

    if (!fs.existsSync(parentWorkspacePath)) {
      throw new Error(`[WORKSPACE-ISOLATION] Parent workspace path does not exist: "${parentWorkspacePath}"`);
    }


    const workspaceId = generateWorkspaceId();
    const requestedMode = options.mode || 'auto';
    const cleanupPolicy = options.cleanupPolicy || WORKSPACE_CLEANUP_POLICY.DELETE_ON_COMPLETION;

    let effectiveMode = WORKSPACE_ISOLATION_MODE.SHADOW_COPY;
    let branchName = null;
    const childWorkspacePath = path.join(this.baseStorageDir, workspaceId);

    // 1. Try Git Worktree if applicable
    const isGit = this.isGitRepository(parentWorkspacePath);
    if ((requestedMode === 'auto' || requestedMode === 'git_worktree') && isGit) {
      branchName = `nexus-subagent-${threadId.slice(-8)}-${Date.now().toString(36)}`;
      try {
        // Create git worktree
        execSync(`git worktree add -b "${branchName}" "${childWorkspacePath}" HEAD`, {
          cwd: parentWorkspacePath,
          stdio: 'pipe',
          timeout: 10000,
          env: getGitEnv(),
        });
        effectiveMode = WORKSPACE_ISOLATION_MODE.GIT_WORKTREE;
      } catch (worktreeErr) {

        // Fallback to shadow copy if git worktree fails (e.g. detached HEAD or bare repo)
        effectiveMode = WORKSPACE_ISOLATION_MODE.SHADOW_COPY;
        branchName = null;
      }
    }

    // 2. Non-Git or Shadow Copy Fallback
    if (effectiveMode === WORKSPACE_ISOLATION_MODE.SHADOW_COPY) {
      if (!fs.existsSync(childWorkspacePath)) {
        fs.mkdirSync(childWorkspacePath, { recursive: true });
      }
      this.copyDirectoryRecursive(parentWorkspacePath, childWorkspacePath);
    }

    const workspaceRecord = {
      workspaceId,
      parentWorkspacePath,
      childWorkspacePath,
      threadId,
      parentThreadId: options.parentThreadId || null,
      branchName,
      mode: effectiveMode,
      createdAt: Date.now(),
      status: WORKSPACE_STATUS.READY,
      cleanupPolicy,
      changeSets: [],
      metadata: secretFilter.sanitizeObject(options.metadata || {}),
    };

    this.workspaces.set(workspaceId, workspaceRecord);
    this.threadToWorkspace.set(threadId, workspaceId);

    // Emit Lifecycle Events
    this.eventBus.emit(EVENT_TYPES.CHILD_WORKSPACE_CREATED, {
      threadId,
      payload: { ...workspaceRecord },
    });

    this.eventBus.emit(EVENT_TYPES.CHILD_WORKSPACE_READY, {
      threadId,
      payload: { ...workspaceRecord },
    });

    // Record in EvidenceGraph
    if (evidenceGraphInstance) {
      try {
        evidenceGraphInstance.addNode({
          sessionId: options.parentThreadId || threadId,
          type: 'OBSERVATION',
          statement: `Created isolated workspace [${effectiveMode}] for subagent ${threadId} at "${childWorkspacePath}"`,
          provenanceClass: 'SYSTEM_GENERATED',
          verificationLevel: 'OBSERVED',
          metadata: {
            workspaceId,
            threadId,
            mode: effectiveMode,
            childWorkspacePath,
          },
        });
      } catch (e) {}
    }

    return workspaceRecord;
  }

  /**
   * Retrieves an isolated workspace record by workspaceId or threadId.
   * @param {string} id - workspaceId or threadId
   * @returns {Object|null}
   */
  getChildWorkspace(id) {
    if (!id) return null;
    if (this.workspaces.has(id)) {
      return this.workspaces.get(id);
    }
    if (this.threadToWorkspace.has(id)) {
      const wsId = this.threadToWorkspace.get(id);
      return this.workspaces.get(wsId) || null;
    }
    return null;
  }

  /**
   * Lists all active isolated child workspaces.
   * @param {string} [parentWorkspacePath]
   * @returns {Array<Object>}
   */
  listChildWorkspaces(parentWorkspacePath) {
    let list = Array.from(this.workspaces.values());
    if (parentWorkspacePath) {
      const norm = path.resolve(parentWorkspacePath);
      list = list.filter((w) => w.parentWorkspacePath === norm);
    }
    return list;
  }

  /**
   * Authoritatively adopts changes produced by a child subagent into the parent workspace.
   * NEVER blindly copies files; strictly enforces preflight conflict checks, parent Patch Firewall,
   * approval, and atomic TransactionalPatchApplier execution.
   * @param {Object} options
   * @param {string} options.childThreadId
   * @param {Object|string} options.changeSet - ChangeSet instance or ID
   * @param {string} [options.parentWorkspacePath]
   * @param {boolean} [options.force]
   * @param {string} [options.approvedBy]
   * @param {string} [options.reason]
   * @param {Function} [options.verifierFn]
   * @returns {Promise<Object>} Adoption outcome
   */
  async adoptChildChanges(options = {}) {
    const { childThreadId, force = false } = options;
    if (!childThreadId) {
      throw new Error('[WORKSPACE-ISOLATION] childThreadId is required to adopt changes');
    }

    const childWorkspace = this.getChildWorkspace(childThreadId);
    if (!childWorkspace) {
      throw new Error(`[WORKSPACE-ISOLATION] No isolated workspace found for child thread "${childThreadId}"`);
    }

    const parentWorkspacePath = path.resolve(
      options.parentWorkspacePath || childWorkspace.parentWorkspacePath || process.cwd()
    );

    this.eventBus.emit(EVENT_TYPES.CHILD_WORKSPACE_ADOPTION_STARTED, {
      threadId: childThreadId,
      payload: {
        childThreadId,
        workspaceId: childWorkspace.workspaceId,
        parentWorkspacePath,
      },
    });

    // 1. Resolve Child ChangeSet
    let sourceChangeSet = options.changeSet;
    if (!sourceChangeSet || typeof sourceChangeSet !== 'object') {
      throw new Error('[WORKSPACE-ISOLATION] Valid changeSet object is required for adoption');
    }

    const files = sourceChangeSet.files || [];
    if (files.length === 0) {
      return {
        success: true,
        message: 'No files to adopt in ChangeSet',
        changeSet: sourceChangeSet,
      };
    }

    // 2. Preflight Conflict Validation against Current Parent Workspace State
    for (const file of files) {
      const parentFilePath = path.resolve(parentWorkspacePath, file.filePath);

      // Check path traversal security
      if (!parentFilePath.startsWith(parentWorkspacePath + path.sep) && parentFilePath !== parentWorkspacePath) {
        this.eventBus.emit(EVENT_TYPES.CHILD_WORKSPACE_ADOPTION_FAILED, {
          threadId: childThreadId,
          payload: { error: `Security Violation: File path "${file.filePath}" escapes parent workspace boundary` },
        });
        throw new Error(`Security Violation: File path "${file.filePath}" escapes parent workspace boundary`);
      }

      if (file.changeType === 'MODIFY' || file.original) {
        if (!fs.existsSync(parentFilePath)) {
          const err = `[ADOPT-CONFLICT] Target file does not exist in parent workspace: "${file.filePath}"`;
          this.eventBus.emit(EVENT_TYPES.CHILD_WORKSPACE_ADOPTION_FAILED, {
            threadId: childThreadId,
            payload: { error: err, file: file.filePath },
          });
          throw new Error(err);
        }

        const parentContent = fs.readFileSync(parentFilePath, 'utf8');
        if (file.original && !parentContent.includes(file.original.trim())) {
          const err = `[ADOPT-CONFLICT] Conflict in "${file.filePath}": parent workspace state has diverged from child base`;
          this.eventBus.emit(EVENT_TYPES.CHILD_WORKSPACE_ADOPTION_FAILED, {
            threadId: childThreadId,
            payload: { error: err, file: file.filePath },
          });
          throw new Error(err);
        }
      }
    }

    // 3. Construct Parent-Side ChangeSet
    const parentChangeSet = new ChangeSet({
      threadId: childWorkspace.parentThreadId || 'parent_thread',
      workspacePath: parentWorkspacePath,
      intent: 'MUTATION',
      eventBus: this.eventBus,
      metadata: {
        adoptedFromChildThreadId: childThreadId,
        adoptedFromWorkspaceId: childWorkspace.workspaceId,
      },
    });

    for (const file of files) {
      parentChangeSet.addFile({
        filePath: file.filePath,
        original: file.original,
        replacement: file.replacement,
        changeType: file.changeType || 'MODIFY',
      });
    }

    // 4. Run Parent-Side Safety & Patch Firewall
    const risk = await parentChangeSet.evaluateSafety({
      workspacePath: parentWorkspacePath,
      strictApproval: true,
    });

    if (risk.overallRiskLevel === 'BLOCKED' && !force) {
      const err = `[ADOPT-FIREWALL] Adoption BLOCKED by parent Patch Firewall (Risk score: ${risk.riskScore})`;
      this.eventBus.emit(EVENT_TYPES.CHILD_WORKSPACE_ADOPTION_FAILED, {
        threadId: childThreadId,
        payload: { error: err, risk },
      });
      throw new Error(err);
    }

    // 5. Authoritative Parent Approval
    parentChangeSet.approve({
      approvedBy: options.approvedBy || 'parent_adoption_orchestrator',
      reason: options.reason || `Adopted verified changes from subagent ${childThreadId}`,
      force: Boolean(force),
    });

    // 6. Apply Transaction Atomically to Parent Workspace
    const applyResult = await parentChangeSet.apply({
      workspacePath: parentWorkspacePath,
      force: Boolean(force),
    });

    if (!applyResult.success) {
      const err = `[ADOPT-APPLY] Transaction apply failed on parent workspace: ${applyResult.error}`;
      this.eventBus.emit(EVENT_TYPES.CHILD_WORKSPACE_ADOPTION_FAILED, {
        threadId: childThreadId,
        payload: { error: err },
      });
      throw new Error(err);
    }

    // 7. Optional Parent Verification Run
    let verificationResult = null;
    if (typeof options.verifierFn === 'function') {
      const vOutcome = await parentChangeSet.verify(options.verifierFn);
      verificationResult = vOutcome?.verification || vOutcome;
    }


    // 8. Update Statuses
    childWorkspace.status = WORKSPACE_STATUS.ADOPTED;
    if (typeof sourceChangeSet.status !== 'undefined') {
      sourceChangeSet.status = 'ADOPTED';
    }

    this.eventBus.emit(EVENT_TYPES.CHILD_WORKSPACE_ADOPTED, {
      threadId: childThreadId,
      payload: {
        childThreadId,
        workspaceId: childWorkspace.workspaceId,
        parentWorkspacePath,
        changeSetId: parentChangeSet.changeSetId,
        verification: verificationResult,
      },
    });

    // Record in EvidenceGraph
    if (evidenceGraphInstance) {
      try {
        evidenceGraphInstance.addNode({
          sessionId: childWorkspace.parentThreadId || childThreadId,
          type: 'TRANSACTION',
          statement: `Adopted child ChangeSet from subagent ${childThreadId} into parent workspace across ${files.length} files`,
          provenanceClass: 'TRANSACTION_VERIFIED',
          verificationLevel: verificationResult?.testStatus === 'PASSED' ? 'TEST_VERIFIED' : 'TRANSACTION_VERIFIED',
          metadata: {
            childThreadId,
            parentWorkspacePath,
            changeSetId: parentChangeSet.changeSetId,
          },
        });
      } catch (e) {}
    }

    return {
      success: true,
      changeSet: parentChangeSet,
      applyResult,
      verification: verificationResult,
    };
  }

  /**
   * Cleans up an isolated child workspace according to its policy.
   * @param {string} id - workspaceId or threadId
   * @param {Object} [options]
   * @param {boolean} [options.force] - Force delete regardless of policy
   * @param {boolean} [options.isFailure] - Flag indicating child failed
   * @returns {Object} Cleanup outcome
   */
  async cleanupChildWorkspace(id, options = {}) {
    const ws = this.getChildWorkspace(id);
    if (!ws) {
      return { success: false, error: 'Workspace not found' };
    }

    // Policy checks
    if (!options.force) {
      if (ws.cleanupPolicy === WORKSPACE_CLEANUP_POLICY.KEEP) {
        return { success: true, skipped: true, reason: 'Policy is KEEP' };
      }
      if (ws.cleanupPolicy === WORKSPACE_CLEANUP_POLICY.DELETE_ON_FAILURE && !options.isFailure) {
        return { success: true, skipped: true, reason: 'Policy is DELETE_ON_FAILURE and task succeeded' };
      }
    }

    this.eventBus.emit(EVENT_TYPES.CHILD_WORKSPACE_CLEANUP_STARTED, {
      threadId: ws.threadId,
      payload: { workspaceId: ws.workspaceId, childWorkspacePath: ws.childWorkspacePath },
    });

    try {
      // If Git Worktree, remove via git
      if (ws.mode === WORKSPACE_ISOLATION_MODE.GIT_WORKTREE && ws.parentWorkspacePath) {
        try {
          execSync(`git worktree remove --force "${ws.childWorkspacePath}"`, {
            cwd: ws.parentWorkspacePath,
            stdio: 'ignore',
            timeout: 5000,
            env: getGitEnv(),
          });
        } catch (e) {}

        if (ws.branchName) {
          try {
            execSync(`git branch -D "${ws.branchName}"`, {
              cwd: ws.parentWorkspacePath,
              stdio: 'ignore',
              timeout: 5000,
              env: getGitEnv(),
            });
          } catch (e) {}
        }

      }

      // Remove directory from disk if still present
      if (fs.existsSync(ws.childWorkspacePath)) {
        fs.rmSync(ws.childWorkspacePath, { recursive: true, force: true });
      }

      ws.status = WORKSPACE_STATUS.CLEANED;

      this.eventBus.emit(EVENT_TYPES.CHILD_WORKSPACE_CLEANED, {
        threadId: ws.threadId,
        payload: { workspaceId: ws.workspaceId },
      });

      return { success: true, workspaceId: ws.workspaceId, status: WORKSPACE_STATUS.CLEANED };
    } catch (cleanErr) {
      return { success: false, error: cleanErr.message };
    }
  }

  /**
   * Cleans up all child workspaces for a parent workspace.
   * @param {string} parentWorkspacePath
   * @param {Object} [options]
   * @returns {Promise<Array<Object>>}
   */
  async cleanupAll(parentWorkspacePath, options = {}) {
    const list = this.listChildWorkspaces(parentWorkspacePath);
    const results = [];
    for (const ws of list) {
      const res = await this.cleanupChildWorkspace(ws.workspaceId, options);
      results.push(res);
    }
    return results;
  }

  /**
   * Restores a workspace record directly (e.g. from persistence).

   * @param {Object} record
   */
  restoreWorkspace(record) {
    if (!record || !record.workspaceId) return;
    this.workspaces.set(record.workspaceId, { ...record });
    if (record.threadId) {
      this.threadToWorkspace.set(record.threadId, record.workspaceId);
    }
  }

  /**
   * Resets in-memory workspace state.
   */
  clear() {
    this.workspaces.clear();
    this.threadToWorkspace.clear();
  }
}

const workspaceIsolationManager = new WorkspaceIsolationManager();

module.exports = {
  WorkspaceIsolationManager,
  workspaceIsolationManager,
  PROTECTED_COPY_DIRS,
};

