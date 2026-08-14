const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { app } = require('electron');

class RecoveryStore {
  constructor() {
    this.heartbeatTimer = null;
    this.lastSavedHashes = new Map();
  }

  getUserDataPath() {
    if (process.env.ECHO_RECOVERY_DIR) {
      return process.env.ECHO_RECOVERY_DIR;
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
      const testFile = path.join(defaultDir, '.write-test');
      fs.writeFileSync(testFile, 'ok');
      fs.unlinkSync(testFile);
      return defaultDir;
    } catch (e) {
      const fallback = path.join(process.cwd(), '.echo-nullity-recovery');
      try { fs.mkdirSync(fallback, { recursive: true }); } catch (_) {}
      return fallback;
    }
  }

  getRecoveryDir() {
    const dir = path.join(this.getUserDataPath(), 'recovery');
    try {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      return dir;
    } catch (e) {
      const fallback = path.join(process.cwd(), '.echo-nullity-recovery');
      try { fs.mkdirSync(fallback, { recursive: true }); } catch (_) {}
      return fallback;
    }
  }

  getSessionStatePath() {
    return path.join(this.getUserDataPath(), 'session-state.json');
  }

  getWorkspaceHash(workspacePath) {
    if (!workspacePath) return 'default';
    return crypto.createHash('sha256').update(workspacePath).digest('hex').slice(0, 16);
  }

  getSnapshotFilePath(workspacePath) {
    const hash = this.getWorkspaceHash(workspacePath);
    return path.join(this.getRecoveryDir(), `${hash}.json`);
  }

  computeContentHash(snapshot) {
    if (!snapshot || !Array.isArray(snapshot.openTabs)) return '';
    const contentPayload = snapshot.openTabs
      .filter((t) => t && typeof t.path === 'string')
      .map((t) => `${t.path}:${typeof t.content === 'string' ? t.content : ''}:${!!t.isDirty}`)
      .join('|');
    return crypto.createHash('md5').update(contentPayload).digest('hex');
  }

  saveSnapshot(workspacePath, snapshot) {
    if (!workspacePath || !snapshot) return { success: false, error: 'Missing arguments' };

    const rawTabs = Array.isArray(snapshot.openTabs) ? snapshot.openTabs : [];
    const hasDirty = rawTabs.some((t) => t && typeof t.path === 'string' && t.isDirty);
    if (!hasDirty) {
      this.clearSnapshot(workspacePath);
      return { success: true, cleared: true };
    }

    const currentHash = this.computeContentHash(snapshot);
    const lastHash = this.lastSavedHashes.get(workspacePath);
    if (lastHash && lastHash === currentHash) {
      return { success: true, skipped: true };
    }

    const targetPath = this.getSnapshotFilePath(workspacePath);
    const tempPath = `${targetPath}.tmp.${Date.now()}`;

    try {
      const fullSnapshot = {
        workspacePath: String(workspacePath),
        savedAt: Date.now(),
        appVersion: '1.0.0',
        openTabs: rawTabs
          .filter((t) => t && typeof t.path === 'string')
          .map((t) => ({
            path: String(t.path),
            content: typeof t.content === 'string' ? t.content : '',
            isDirty: !!t.isDirty,
          })),
        activeTabPath: typeof snapshot.activeTabPath === 'string' ? snapshot.activeTabPath : null,
      };

      const data = JSON.stringify(fullSnapshot, null, 2);
      fs.writeFileSync(tempPath, data, 'utf-8');
      fs.renameSync(tempPath, targetPath);

      this.lastSavedHashes.set(workspacePath, currentHash);
      return { success: true, path: targetPath, savedAt: fullSnapshot.savedAt };
    } catch (err) {
      try {
        if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
      } catch (e) {}
      console.error('[RECOVERY-STORE] Error writing snapshot:', err);
      return { success: false, error: err.message };
    }
  }

  loadSnapshot(workspacePath) {
    const targetPath = this.getSnapshotFilePath(workspacePath);
    try {
      if (!fs.existsSync(targetPath)) return null;
      const data = fs.readFileSync(targetPath, 'utf-8');
      if (!data || !data.trim()) return null;
      let parsed = null;
      try {
        parsed = JSON.parse(data);
      } catch (e) {
        console.warn('[RECOVERY-STORE] Corrupted recovery snapshot file ignored:', targetPath);
        return null;
      }
      if (!parsed || typeof parsed !== 'object') return null;
      return {
        workspacePath: typeof parsed.workspacePath === 'string' ? parsed.workspacePath : workspacePath,
        savedAt: typeof parsed.savedAt === 'number' ? parsed.savedAt : Date.now(),
        appVersion: typeof parsed.appVersion === 'string' ? parsed.appVersion : '1.0.0',
        openTabs: Array.isArray(parsed.openTabs)
          ? parsed.openTabs
              .filter((t) => t && typeof t.path === 'string')
              .map((t) => ({
                path: String(t.path),
                content: typeof t.content === 'string' ? t.content : '',
                isDirty: !!t.isDirty,
              }))
          : [],
        activeTabPath: typeof parsed.activeTabPath === 'string' ? parsed.activeTabPath : null,
      };
    } catch (err) {
      console.error('[RECOVERY-STORE] Error reading snapshot:', err);
      return null;
    }
  }

  clearSnapshot(workspacePath) {
    const targetPath = this.getSnapshotFilePath(workspacePath);
    try {
      if (fs.existsSync(targetPath)) {
        fs.unlinkSync(targetPath);
      }
      this.lastSavedHashes.delete(workspacePath);
      return { success: true };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }

  listSnapshots() {
    const dir = this.getRecoveryDir();
    const list = [];
    try {
      const files = fs.readdirSync(dir);
      for (const f of files) {
        if (f.endsWith('.json') && !f.includes('.tmp')) {
          try {
            const raw = fs.readFileSync(path.join(dir, f), 'utf-8');
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object' && parsed.workspacePath) {
              list.push(parsed);
            }
          } catch (e) {}
        }
      }
    } catch (e) {}
    return list;
  }

  // Session State Heartbeat & Crash Detection
  startHeartbeat() {
    this.updateHeartbeat(false);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    this.heartbeatTimer = setInterval(() => {
      this.updateHeartbeat(false);
    }, 30000);
  }

  updateHeartbeat(cleanShutdown = false) {
    const sessionPath = this.getSessionStatePath();
    try {
      const state = {
        lastHeartbeat: Date.now(),
        cleanShutdown: !!cleanShutdown,
        pid: process.pid,
      };
      fs.writeFileSync(sessionPath, JSON.stringify(state, null, 2), 'utf-8');
    } catch (e) {}
  }

  checkCrashState() {
    const sessionPath = this.getSessionStatePath();
    try {
      if (!fs.existsSync(sessionPath)) return { wasCrash: false };
      const raw = fs.readFileSync(sessionPath, 'utf-8');
      if (!raw) return { wasCrash: false };
      let data = null;
      try {
        data = JSON.parse(raw);
      } catch (e) {
        return { wasCrash: false };
      }
      if (!data || typeof data !== 'object') return { wasCrash: false };

      // If cleanShutdown is true, normal exit
      if (data.cleanShutdown) return { wasCrash: false, lastHeartbeat: data.lastHeartbeat };

      // If last heartbeat is less than 5 minutes old and didn't shut down cleanly -> crash
      const ageMs = Date.now() - (data.lastHeartbeat || 0);
      const wasCrash = ageMs < 5 * 60 * 1000;
      return { wasCrash, lastHeartbeat: data.lastHeartbeat, ageMs };
    } catch (e) {
      return { wasCrash: false };
    }
  }
}

const recoveryStore = new RecoveryStore();

module.exports = {
  RecoveryStore,
  recoveryStore,
};
