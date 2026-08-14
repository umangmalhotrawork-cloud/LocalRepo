const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const PROTECTED_DIRS = new Set([
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
  '.vscode',
  '.turbo',
]);

const MAX_AUTO_CHECKPOINTS = 20;

class SnapshotManager {
  constructor() {
    this.storageBaseDir = this.getStorageDir();
    this.ensureDir(this.storageBaseDir);
  }

  getStorageDir() {
    if (process.platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', 'echo-nullity', 'snapshots');
    } else if (process.platform === 'win32') {
      return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'echo-nullity', 'snapshots');
    } else {
      return path.join(os.homedir(), '.config', 'echo-nullity', 'snapshots');
    }
  }

  getWorkspaceHash(workspacePath) {
    return crypto.createHash('sha256').update(path.resolve(workspacePath)).digest('hex').slice(0, 16);
  }

  getWorkspaceSnapshotDir(workspacePath) {
    const hash = this.getWorkspaceHash(workspacePath);
    const dir = path.join(this.storageBaseDir, hash);
    this.ensureDir(dir);
    return dir;
  }

  ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  atomicWrite(filePath, data) {
    const tmpPath = `${filePath}.tmp.${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tmpPath, filePath);
  }

  scanWorkspaceFiles(dirPath, rootPath, maxDepth = 10, currentDepth = 0) {
    if (currentDepth > maxDepth || !fs.existsSync(dirPath)) return [];
    let files = [];
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        if (PROTECTED_DIRS.has(entry.name)) continue;
        const fullPath = path.join(dirPath, entry.name);
        const relPath = path.relative(rootPath, fullPath);

        if (entry.isDirectory()) {
          files = files.concat(this.scanWorkspaceFiles(fullPath, rootPath, maxDepth, currentDepth + 1));
        } else if (entry.isFile()) {
          try {
            // Ignore large binaries over 5MB
            const stat = fs.statSync(fullPath);
            if (stat.size <= 5 * 1024 * 1024) {
              const content = fs.readFileSync(fullPath, 'utf8');
              const hash = crypto.createHash('sha1').update(content).digest('hex');
              files.push({
                relativePath: relPath,
                hash,
                content,
                size: stat.size,
                mtime: stat.mtimeMs,
              });
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
    return files;
  }

  /**
   * Create a named or automatic snapshot
   */
  async createSnapshot(payload) {
    const {
      workspacePath,
      name = 'Manual Snapshot',
      description = '',
      openTabs = [],
      activeTab = '',
      dirtyTabs = [],
      isAuto = false,
    } = payload;

    if (!workspacePath || !fs.existsSync(workspacePath)) {
      throw new Error(`Workspace path does not exist: ${workspacePath}`);
    }

    const snapshotId = `snap_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const snapshotDir = this.getWorkspaceSnapshotDir(workspacePath);
    const files = this.scanWorkspaceFiles(workspacePath, workspacePath);

    const snapshot = {
      id: snapshotId,
      name,
      description,
      isAuto: Boolean(isAuto),
      timestamp: Date.now(),
      workspacePath: path.resolve(workspacePath),
      totalFiles: files.length,
      files,
      openTabs,
      activeTab,
      dirtyTabs,
    };

    const filePath = path.join(snapshotDir, `${snapshotId}.json`);
    this.atomicWrite(filePath, snapshot);

    if (isAuto) {
      this.pruneAutoCheckpoints(workspacePath);
    }

    return {
      success: true,
      snapshotId,
      snapshot: {
        id: snapshot.id,
        name: snapshot.name,
        description: snapshot.description,
        isAuto: snapshot.isAuto,
        timestamp: snapshot.timestamp,
        totalFiles: snapshot.totalFiles,
      },
    };
  }

  /**
   * Prune auto-checkpoints to keep only the latest MAX_AUTO_CHECKPOINTS
   */
  pruneAutoCheckpoints(workspacePath) {
    try {
      const all = this.listSnapshots(workspacePath);
      const autoSnaps = all.filter((s) => s.isAuto);
      if (autoSnaps.length > MAX_AUTO_CHECKPOINTS) {
        const toDelete = autoSnaps.slice(MAX_AUTO_CHECKPOINTS);
        const snapshotDir = this.getWorkspaceSnapshotDir(workspacePath);
        for (const snap of toDelete) {
          const fp = path.join(snapshotDir, `${snap.id}.json`);
          if (fs.existsSync(fp)) {
            fs.unlinkSync(fp);
          }
        }
      }
    } catch (e) {}
  }

  /**
   * List all snapshots for a workspace sorted by timestamp descending
   */
  listSnapshots(workspacePath) {
    const snapshotDir = this.getWorkspaceSnapshotDir(workspacePath);
    if (!fs.existsSync(snapshotDir)) return [];

    const snapshots = [];
    try {
      const files = fs.readdirSync(snapshotDir);
      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const raw = fs.readFileSync(path.join(snapshotDir, file), 'utf8');
            const data = JSON.parse(raw);
            snapshots.push({
              id: data.id,
              name: data.name,
              description: data.description || '',
              isAuto: Boolean(data.isAuto),
              timestamp: data.timestamp,
              workspacePath: data.workspacePath,
              totalFiles: data.totalFiles || (data.files ? data.files.length : 0),
              openTabsCount: data.openTabs ? data.openTabs.length : 0,
            });
          } catch (e) {}
        }
      }
    } catch (e) {}

    return snapshots.sort((a, b) => b.timestamp - a.timestamp);
  }

  /**
   * Get full snapshot object
   */
  getSnapshot(workspacePath, snapshotId) {
    const snapshotDir = this.getWorkspaceSnapshotDir(workspacePath);
    const filePath = path.join(snapshotDir, `${snapshotId}.json`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Snapshot ${snapshotId} not found`);
    }
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  }

  /**
   * Compare snapshot with current workspace disk state or another snapshot
   */
  compareSnapshots(payload) {
    const { workspacePath, snapshotId1, snapshotId2 } = payload;
    const snap1 = this.getSnapshot(workspacePath, snapshotId1);

    let files2Map = new Map();
    if (snapshotId2) {
      const snap2 = this.getSnapshot(workspacePath, snapshotId2);
      (snap2.files || []).forEach((f) => files2Map.set(f.relativePath, f));
    } else {
      // Compare with current disk state
      const diskFiles = this.scanWorkspaceFiles(workspacePath, workspacePath);
      diskFiles.forEach((f) => files2Map.set(f.relativePath, f));
    }

    const files1Map = new Map();
    (snap1.files || []).forEach((f) => files1Map.set(f.relativePath, f));

    const diffs = [];
    const allRelPaths = new Set([...files1Map.keys(), ...files2Map.keys()]);

    for (const relPath of allRelPaths) {
      const f1 = files1Map.get(relPath);
      const f2 = files2Map.get(relPath);

      if (f1 && !f2) {
        diffs.push({
          relativePath: relPath,
          status: 'deleted',
          oldContent: f1.content,
          newContent: null,
          unifiedDiff: this.generateDiff(f1.content, ''),
        });
      } else if (!f1 && f2) {
        diffs.push({
          relativePath: relPath,
          status: 'added',
          oldContent: null,
          newContent: f2.content,
          unifiedDiff: this.generateDiff('', f2.content),
        });
      } else if (f1 && f2) {
        if (f1.hash !== f2.hash) {
          diffs.push({
            relativePath: relPath,
            status: 'modified',
            oldContent: f1.content,
            newContent: f2.content,
            unifiedDiff: this.generateDiff(f1.content, f2.content),
          });
        } else {
          diffs.push({
            relativePath: relPath,
            status: 'unchanged',
            oldContent: f1.content,
            newContent: f2.content,
          });
        }
      }
    }

    diffs.sort((a, b) => a.relativePath.localeCompare(b.relativePath));

    const summary = {
      added: diffs.filter((d) => d.status === 'added').length,
      modified: diffs.filter((d) => d.status === 'modified').length,
      deleted: diffs.filter((d) => d.status === 'deleted').length,
      unchanged: diffs.filter((d) => d.status === 'unchanged').length,
      total: diffs.length,
    };

    return {
      success: true,
      snapshotId1,
      snapshotId2: snapshotId2 || 'current_disk',
      summary,
      diffs,
    };
  }

  generateDiff(oldText = '', newText = '') {
    const oldLines = oldText.split('\n');
    const newLines = newText.split('\n');
    const diffLines = [];

    const max = Math.max(oldLines.length, newLines.length);
    for (let i = 0; i < max; i++) {
      const ol = oldLines[i];
      const nl = newLines[i];
      if (ol === nl) {
        diffLines.push(` ${ol || ''}`);
      } else {
        if (ol !== undefined) diffLines.push(`-${ol}`);
        if (nl !== undefined) diffLines.push(`+${nl}`);
      }
    }

    return diffLines.join('\n');
  }

  /**
   * Restore a single file from snapshot
   */
  async restoreFile(payload) {
    const { workspacePath, snapshotId, relativePath } = payload;
    const snap = this.getSnapshot(workspacePath, snapshotId);
    const fileEntry = (snap.files || []).find((f) => f.relativePath === relativePath);

    if (!fileEntry) {
      throw new Error(`File ${relativePath} not found in snapshot ${snapshotId}`);
    }

    // Safety check: ensure target is inside workspace
    const targetPath = path.resolve(workspacePath, relativePath);
    if (!targetPath.startsWith(path.resolve(workspacePath))) {
      throw new Error(`Forbidden file path outside workspace: ${relativePath}`);
    }

    // Check protected dirs
    for (const p of PROTECTED_DIRS) {
      if (relativePath.startsWith(p) || relativePath.includes(`/${p}/`)) {
        throw new Error(`Cannot restore protected path: ${relativePath}`);
      }
    }

    this.ensureDir(path.dirname(targetPath));
    fs.writeFileSync(targetPath, fileEntry.content, 'utf8');

    return {
      success: true,
      restoredPath: targetPath,
      relativePath,
    };
  }

  /**
   * Restore entire workspace from snapshot with automatic pre-restore backup
   */
  async restoreWorkspace(payload) {
    const { workspacePath, snapshotId } = payload;
    const snap = this.getSnapshot(workspacePath, snapshotId);

    // 1. Create automatic pre-restore backup
    await this.createSnapshot({
      workspacePath,
      name: `Pre-Rollback Backup (before ${snap.name})`,
      description: `Automatic snapshot before rollback to ${snapshotId}`,
      isAuto: true,
    });

    // 2. Scan current files to delete files created after snapshot
    const currentFiles = this.scanWorkspaceFiles(workspacePath, workspacePath);
    const snapRelPaths = new Set((snap.files || []).map((f) => f.relativePath));

    for (const cur of currentFiles) {
      if (!snapRelPaths.has(cur.relativePath)) {
        // Safe check
        const targetPath = path.resolve(workspacePath, cur.relativePath);
        if (fs.existsSync(targetPath)) {
          try {
            fs.unlinkSync(targetPath);
          } catch (e) {}
        }
      }
    }

    // 3. Write snapshot files
    for (const f of snap.files || []) {
      const targetPath = path.resolve(workspacePath, f.relativePath);
      this.ensureDir(path.dirname(targetPath));
      fs.writeFileSync(targetPath, f.content, 'utf8');
    }

    return {
      success: true,
      restoredFilesCount: (snap.files || []).length,
      snapshot: {
        id: snap.id,
        name: snap.name,
        openTabs: snap.openTabs,
        activeTab: snap.activeTab,
      },
    };
  }

  /**
   * Delete snapshot
   */
  deleteSnapshot(workspacePath, snapshotId) {
    const snapshotDir = this.getWorkspaceSnapshotDir(workspacePath);
    const filePath = path.join(snapshotDir, `${snapshotId}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return { success: true, snapshotId };
    }
    return { success: false, error: 'Snapshot file not found' };
  }
}

const snapshotManager = new SnapshotManager();

module.exports = {
  SnapshotManager,
  snapshotManager,
};
