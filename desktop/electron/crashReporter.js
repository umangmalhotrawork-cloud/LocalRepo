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
    if (process.platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', 'echo-nullity', 'crashes');
    } else if (process.platform === 'win32') {
      return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'echo-nullity', 'crashes');
    } else {
      return path.join(os.homedir(), '.config', 'echo-nullity', 'crashes');
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

    const filePath = path.join(this.crashDir, `${crashId}.json`);
    try {
      fs.writeFileSync(filePath, JSON.stringify(report, null, 2), 'utf8');
      logger.error('CRASH_REPORTER', `Crash report written: ${crashId}`, { crashId, error: report.error.message });
    } catch (e) {
      console.error('[CRASH_REPORTER] Failed to save crash report:', e);
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
