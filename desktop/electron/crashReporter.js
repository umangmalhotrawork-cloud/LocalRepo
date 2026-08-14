const fs = require('fs');
const path = require('path');
const os = require('os');
const { logger } = require('./logger');

class CrashReporter {
  constructor() {
    this.crashDir = this.getCrashDir();
    this.ensureDir(this.crashDir);
  }

  getCrashDir() {
    if (this && this.crashDir) {
      return this.crashDir;
    }
    if (process.env.ECHO_CRASH_DIR) {
      return process.env.ECHO_CRASH_DIR;
    }
    let defaultDir = '';
    if (process.platform === 'darwin') {
      defaultDir = path.join(os.homedir(), 'Library', 'Application Support', 'echo-nullity', 'crashes');
    } else if (process.platform === 'win32') {
      defaultDir = path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'echo-nullity', 'crashes');
    } else {
      defaultDir = path.join(os.homedir(), '.config', 'echo-nullity', 'crashes');
    }
    try {
      if (!fs.existsSync(defaultDir)) {
        fs.mkdirSync(defaultDir, { recursive: true });
      }
      const testFile = path.join(defaultDir, '.write-test');
      fs.writeFileSync(testFile, 'ok');
      fs.unlinkSync(testFile);
      return defaultDir;
    } catch (e) {
      const fallback = path.join(process.cwd(), '.echo-nullity-crashes');
      try { fs.mkdirSync(fallback, { recursive: true }); } catch (_) {}
      return fallback;
    }
  }

  ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  recordCrash(error, context = {}) {
    const timestamp = Date.now();
    const crashId = `crash_${timestamp}_${Math.random().toString(36).slice(2, 8)}`;
    const mem = process.memoryUsage();

    const report = {
      id: crashId,
      timestamp,
      isoDate: new Date(timestamp).toISOString(),
      error: {
        name: error?.name || 'Error',
        message: error?.message || String(error),
        stack: error?.stack || '',
      },
      system: {
        platform: os.platform(),
        release: os.release(),
        arch: os.arch(),
        electronVersion: process.versions.electron || 'unknown',
        nodeVersion: process.versions.node || process.version,
        v8Version: process.versions.v8 || 'unknown',
      },
      process: {
        uptimeSeconds: Math.round(process.uptime()),
        memoryRssMb: Math.round((mem.rss / 1024 / 1024) * 100) / 100,
        memoryHeapTotalMb: Math.round((mem.heapTotal / 1024 / 1024) * 100) / 100,
        memoryHeapUsedMb: Math.round((mem.heapUsed / 1024 / 1024) * 100) / 100,
      },
      context: {
        workspacePath: context.workspacePath || null,
        activeTab: context.activeTab || null,
        lastAction: context.lastAction || null,
      },
    };

    let filePath = path.join(this.crashDir, `${crashId}.json`);
    try {
      fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf8');
      logger.error('CRASH_REPORTER', `Crash report written: ${crashId}`, { crashId, error: report.error.message });
    } catch (e) {
      if (e.code === 'EPERM' || e.code === 'EACCES') {
        const fallback = path.join(process.cwd(), '.echo-nullity-crashes');
        try { fs.mkdirSync(fallback, { recursive: true }); } catch (_) {}
        this.crashDir = fallback;
        filePath = path.join(this.crashDir, `${crashId}.json`);
        try {
          fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf8');
        } catch (_) {}
      } else {
        console.error('[CRASH_REPORTER] Failed to save crash report:', e);
      }
    }

    return report;
  }

  listCrashes() {
    if (!fs.existsSync(this.crashDir)) return [];
    try {
      const files = fs.readdirSync(this.crashDir);
      const reports = [];
      for (const f of files) {
        if (f.endsWith('.json')) {
          try {
            const raw = fs.readFileSync(path.join(this.crashDir, f), 'utf8');
            reports.push(JSON.parse(raw));
          } catch (e) {}
        }
      }
      return reports.sort((a, b) => b.timestamp - a.timestamp);
    } catch (e) {
      return [];
    }
  }
}

const crashReporter = new CrashReporter();

module.exports = {
  CrashReporter,
  crashReporter,
};
