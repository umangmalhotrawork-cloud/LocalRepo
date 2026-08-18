/**
 * CONTINUUM MANAGER v1.0.0
 * Electron main process manager for persistent Continuum snapshots.
 * Provides safe per-workspace storage isolation, secret redaction, path traversal protection,
 * and safe error handling.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { app } = require('electron');
const { continuumEngine } = require('../engine/continuum_engine');
const secretFilter = require('../security/secretFilter');
const { recoveryStore } = require('./recoveryStore');

class ContinuumManager {
  /**
   * Determines the user data root storage directory.
   * Respects ECHO_CONTINUUM_DIR env variable for isolated unit tests.
   */
  getUserDataPath() {
    if (process.env.ECHO_CONTINUUM_DIR) {
      return process.env.ECHO_CONTINUUM_DIR;
    }
    try {
      if (app && typeof app.getPath === 'function') {
        const appPath = app.getPath('userData');
        if (appPath) return appPath;
      }
    } catch (e) {}

    // Fallback standard location
    const homeDir = os.homedir();
    const defaultDir = path.join(homeDir, 'Library', 'Application Support', 'echo-nullity');
    try {
      if (!fs.existsSync(defaultDir)) {
        fs.mkdirSync(defaultDir, { recursive: true });
      }
      return defaultDir;
    } catch (e) {
      const fallback = path.join(process.cwd(), '.echo-nullity-continuum');
      try { fs.mkdirSync(fallback, { recursive: true }); } catch (_) {}
      return fallback;
    }
  }

  /**
   * Returns the continuum snapshot directory: .echo-nullity/continuum
   */
  getContinuumDir() {
    const dir = path.join(this.getUserDataPath(), 'continuum');
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      return dir;
    } catch (e) {
      const fallback = path.join(process.cwd(), '.echo-nullity-continuum', 'continuum');
      try { fs.mkdirSync(fallback, { recursive: true }); } catch (_) {}
      return fallback;
    }
  }

  /**
   * Derives workspace SHA-256 hash using recoveryStore's existing hashing method.
   */
  getWorkspaceHash(workspacePath) {
    if (!workspacePath) return 'default';
    if (recoveryStore && typeof recoveryStore.getWorkspaceHash === 'function') {
      return recoveryStore.getWorkspaceHash(workspacePath);
    }
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(workspacePath).digest('hex').slice(0, 16);
  }

  /**
   * Sanitizes a snapshot identifier string to prevent path traversal.
   * Strips out directory separators and non-alphanumeric characters.
   */
  sanitizeSnapshotId(id) {
    if (typeof id !== 'string' || !id) return '';
    return id.replace(/[^a-zA-Z0-9_-]/g, '');
  }

  /**
   * Constructs absolute file path for a snapshot within the continuum storage directory.
   */
  getSnapshotFilePath(workspacePath, snapshotId) {
    const hash = this.getWorkspaceHash(workspacePath);
    const safeId = this.sanitizeSnapshotId(snapshotId);
    if (!safeId) return null;
    return path.join(this.getContinuumDir(), `${hash}_${safeId}.json`);
  }

  /**
   * Validates that a target file path resides strictly inside the continuum storage directory.
   * Prevents directory traversal attacks (../, absolute paths).
   */
  isPathWithinContinuumDir(filePath) {
    if (!filePath || typeof filePath !== 'string') return false;
    const continuumDir = path.resolve(this.getContinuumDir());
    const resolvedPath = path.resolve(filePath);
    return resolvedPath.startsWith(continuumDir + path.sep) || resolvedPath === continuumDir;
  }

  /**
   * Saves a Continuum snapshot to local persistent storage.
   */
  saveSnapshot(snapshot, workspacePath) {
    try {
      if (!snapshot || typeof snapshot !== 'object') {
        return { success: false, error: 'Missing or invalid snapshot object' };
      }

      const activeWorkspace = workspacePath || snapshot.project?.workspacePath || process.cwd();
      const validation = continuumEngine.validateSnapshot(snapshot);
      if (!validation.valid) {
        return { success: false, error: `Validation failed: ${validation.errors.join('; ')}` };
      }

      // Ensure snapshot project.workspacePath matches activeWorkspace
      if (snapshot.project && snapshot.project.workspacePath !== activeWorkspace) {
        snapshot.project.workspacePath = activeWorkspace;
        snapshot.project.workspaceHash = this.getWorkspaceHash(activeWorkspace);
      }

      // 1. Secret-sanitize snapshot before persistence
      const sanitizedSnapshot = secretFilter.sanitizeObject(snapshot);

      // 2. Derive filename and path
      const sessionId = sanitizedSnapshot.metadata?.sessionId;
      const safeId = this.sanitizeSnapshotId(sessionId);
      if (!safeId) {
        return { success: false, error: 'Invalid or missing snapshot sessionId' };
      }

      const targetPath = this.getSnapshotFilePath(activeWorkspace, safeId);
      if (!targetPath || !this.isPathWithinContinuumDir(targetPath)) {
        return { success: false, error: 'Path traversal or invalid file path detected' };
      }

      // 3. Serialize safely
      const data = continuumEngine.serializeSnapshot(sanitizedSnapshot);

      // 4. Atomic write via temp file
      const tempPath = `${targetPath}.tmp.${Date.now()}`;
      fs.writeFileSync(tempPath, data, 'utf-8');
      fs.renameSync(tempPath, targetPath);

      return {
        success: true,
        snapshotId: safeId,
        path: targetPath,
        metadata: sanitizedSnapshot.metadata,
      };
    } catch (err) {
      console.error('[CONTINUUM-MANAGER] Error saving snapshot:', err);
      return { success: false, error: err.message };
    }
  }

  /**
   * Loads a specific Continuum snapshot from persistent storage.
   */
  loadSnapshot(snapshotId, workspacePath) {
    try {
      const activeWorkspace = workspacePath || process.cwd();
      const safeId = this.sanitizeSnapshotId(snapshotId);
      if (!safeId) {
        return { success: false, snapshot: null, error: 'Invalid or missing snapshotId' };
      }

      const targetPath = this.getSnapshotFilePath(activeWorkspace, safeId);
      if (!targetPath || !this.isPathWithinContinuumDir(targetPath)) {
        return { success: false, snapshot: null, error: 'Path traversal or invalid snapshot file path' };
      }

      if (!fs.existsSync(targetPath)) {
        return { success: false, snapshot: null, error: `Snapshot '${safeId}' not found for this workspace` };
      }

      const raw = fs.readFileSync(targetPath, 'utf-8');
      const deserializedResult = continuumEngine.deserializeSnapshot(raw);
      if (!deserializedResult.success || !deserializedResult.snapshot) {
        return { success: false, snapshot: null, error: `Corrupted snapshot: ${deserializedResult.errors.join('; ')}` };
      }

      const loadedSnapshot = deserializedResult.snapshot;
      // Verify workspace ownership
      const activeHash = this.getWorkspaceHash(activeWorkspace);
      const loadedHash = this.getWorkspaceHash(loadedSnapshot.project?.workspacePath);
      if (activeHash !== loadedHash) {
        return { success: false, snapshot: null, error: 'Workspace isolation mismatch: Snapshot belongs to another workspace' };
      }

      return {
        success: true,
        snapshot: loadedSnapshot,
      };
    } catch (err) {
      console.error('[CONTINUUM-MANAGER] Error loading snapshot:', err);
      return { success: false, snapshot: null, error: err.message };
    }
  }

  /**
   * Lists all saved Continuum snapshots for the specified workspace, ordered newest first.
   */
  listSnapshots(workspacePath) {
    try {
      const activeWorkspace = workspacePath || process.cwd();
      const targetHash = this.getWorkspaceHash(activeWorkspace);
      const dir = this.getContinuumDir();

      if (!fs.existsSync(dir)) return [];

      const files = fs.readdirSync(dir);
      const summaries = [];

      for (const file of files) {
        if (file.startsWith(`${targetHash}_`) && file.endsWith('.json') && !file.includes('.tmp')) {
          const fullPath = path.join(dir, file);
          try {
            const raw = fs.readFileSync(fullPath, 'utf-8');
            const result = continuumEngine.deserializeSnapshot(raw);
            if (result.success && result.snapshot) {
              const snap = result.snapshot;
              summaries.push({
                snapshotId: snap.metadata.sessionId,
                sessionId: snap.metadata.sessionId,
                parentSessionId: snap.metadata.parentSessionId,
                sequenceNumber: snap.metadata.sequenceNumber,
                createdAt: snap.metadata.createdAt,
                updatedAt: snap.metadata.updatedAt,
                workspaceName: snap.project.workspaceName,
                userGoal: snap.task?.userGoal || '',
                activeTargetNodeId: snap.codeState?.activeTargetNodeId || null,
              });
            }
          } catch (e) {}
        }
      }

      // Sort newest first by updatedAt / createdAt
      summaries.sort((a, b) => b.updatedAt - a.updatedAt);
      return summaries;
    } catch (err) {
      console.error('[CONTINUUM-MANAGER] Error listing snapshots:', err);
      return [];
    }
  }

  /**
   * Deletes a specific Continuum snapshot safely from storage.
   */
  deleteSnapshot(snapshotId, workspacePath) {
    try {
      const activeWorkspace = workspacePath || process.cwd();
      const safeId = this.sanitizeSnapshotId(snapshotId);
      if (!safeId) {
        return { success: false, error: 'Invalid snapshotId' };
      }

      const targetPath = this.getSnapshotFilePath(activeWorkspace, safeId);
      if (!targetPath || !this.isPathWithinContinuumDir(targetPath)) {
        return { success: false, error: 'Path traversal or invalid file path' };
      }

      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
        return { success: true, snapshotId: safeId };
      } else {
        return { success: false, error: 'Snapshot file not found' };
      }
    } catch (err) {
      console.error('[CONTINUUM-MANAGER] Error deleting snapshot:', err);
      return { success: false, error: err.message };
    }
  }
}

const continuumManager = new ContinuumManager();

module.exports = {
  ContinuumManager,
  continuumManager,
};
