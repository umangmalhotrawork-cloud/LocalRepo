const fs = require('fs');
const path = require('path');
const os = require('os');

const MAX_LOG_SIZE = 5 * 1024 * 1024; // 5 MB
const MAX_BACKUP_FILES = 5;

class Logger {
  constructor() {
    this.logDir = this.getLogDir();
    this.ensureDir(this.logDir);
    this.mainLogFile = path.join(this.logDir, 'app.log');
  }

  getLogDir() {
    if (process.platform === 'darwin') {
      return path.join(os.homedir(), 'Library', 'Application Support', 'echo-nullity', 'logs');
    } else if (process.platform === 'win32') {
      return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'echo-nullity', 'logs');
    } else {
      return path.join(os.homedir(), '.config', 'echo-nullity', 'logs');
    }
  }

  ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
      fs.mkdirSync(dirPath, { recursive: true });
    }
  }

  rotateLogsIfNeeded() {
    try {
      if (!fs.existsSync(this.mainLogFile)) return;
      const stat = fs.statSync(this.mainLogFile);
      if (stat.size >= MAX_LOG_SIZE) {
        for (let i = MAX_BACKUP_FILES - 1; i >= 1; i--) {
          const oldFile = path.join(this.logDir, `app.${i}.log`);
          const targetFile = path.join(this.logDir, `app.${i + 1}.log`);
          if (fs.existsSync(oldFile)) {
            if (i === MAX_BACKUP_FILES - 1) {
              fs.unlinkSync(oldFile);
            } else {
              fs.renameSync(oldFile, targetFile);
            }
          }
        }
        fs.renameSync(this.mainLogFile, path.join(this.logDir, 'app.1.log'));
      }
    } catch (e) {
      console.error('[LOGGER] Log rotation error:', e);
    }
  }

  write(level, category, message, meta = null) {
    this.rotateLogsIfNeeded();
    const timestamp = new Date().toISOString();
    const entry = {
      timestamp,
      level: level.toUpperCase(),
      category: category || 'GENERAL',
      message,
      meta: meta || undefined,
      pid: process.pid,
    };

    const line = JSON.stringify(entry) + '\n';
    try {
      fs.appendFileSync(this.mainLogFile, line, 'utf8');
    } catch (e) {
      console.error('[LOGGER] Write failed:', e);
    }

    if (level === 'error') {
      console.error(`[${timestamp}] [${category}] ERROR: ${message}`, meta || '');
    } else {
      console.log(`[${timestamp}] [${category}] ${level.toUpperCase()}: ${message}`);
    }
  }

  info(category, message, meta) {
    this.write('info', category, message, meta);
  }

  warn(category, message, meta) {
    this.write('warn', category, message, meta);
  }

  error(category, message, meta) {
    this.write('error', category, message, meta);
  }

  debug(category, message, meta) {
    this.write('debug', category, message, meta);
  }

  getRecentLogs(limit = 100) {
    try {
      if (!fs.existsSync(this.mainLogFile)) return [];
      const content = fs.readFileSync(this.mainLogFile, 'utf8');
      const lines = content.trim().split('\n').filter(Boolean);
      return lines.slice(-limit).map((l) => {
        try {
          return JSON.parse(l);
        } catch (e) {
          return { message: l };
        }
      });
    } catch (e) {
      return [];
    }
  }
}

const logger = new Logger();

module.exports = {
  Logger,
  logger,
  MAX_LOG_SIZE,
  MAX_BACKUP_FILES,
};
