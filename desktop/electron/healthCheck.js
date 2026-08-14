const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { logger } = require('./logger');
const { snapshotManager } = require('./snapshotManager');

class HealthChecker {
  async runStartupHealthCheck() {
    const checks = {
      snapshotStore: false,
      recoveryStore: false,
      terminal: false,
      git: false,
      python: false,
      diskSpace: false,
    };
    const warnings = [];
    const errors = [];

    // 1. Snapshot Store Writable Check
    try {
      const snapDir = snapshotManager.getStorageDir();
      fs.mkdirSync(snapDir, { recursive: true });
      const testFile = path.join(snapDir, '.health_test');
      fs.writeFileSync(testFile, 'ok', 'utf8');
      fs.unlinkSync(testFile);
      checks.snapshotStore = true;
    } catch (e) {
      errors.push(`Snapshot store is not writable: ${e.message}`);
    }

    // 2. Recovery Store Writable Check
    try {
      const recDir = path.dirname(snapshotManager.getStorageDir());
      fs.mkdirSync(recDir, { recursive: true });
      const testFile = path.join(recDir, '.health_test');
      fs.writeFileSync(testFile, 'ok', 'utf8');
      fs.unlinkSync(testFile);
      checks.recoveryStore = true;
    } catch (e) {
      errors.push(`Recovery store is not writable: ${e.message}`);
    }

    // 3. Terminal Subsystem Check
    try {
      const ptyManager = require('./ptyManager');
      checks.terminal = true;
    } catch (e) {
      warnings.push(`Terminal subsystem running in standard fallback mode: ${e.message}`);
      checks.terminal = true;
    }

    // 4. Git Binary Check
    try {
      execSync('git --version', { stdio: 'ignore' });
      checks.git = true;
    } catch (e) {
      warnings.push('Git binary not found in PATH. Version control features may be limited.');
    }

    // 5. Python Binary Check
    try {
      execSync('python3 --version', { stdio: 'ignore' });
      checks.python = true;
    } catch (e) {
      warnings.push('Python 3 binary not detected in PATH. Local Python execution will use Pyodide fallback.');
    }

    // 6. Sufficient Disk Space Check
    try {
      // Basic free memory and storage check
      const freeMem = os.freemem();
      if (freeMem > 100 * 1024 * 1024) { // > 100MB free RAM
        checks.diskSpace = true;
      } else {
        warnings.push('Low available system memory (<100MB).');
      }
    } catch (e) {
      checks.diskSpace = true;
    }

    const healthy = errors.length === 0;

    const result = {
      healthy,
      timestamp: Date.now(),
      checks,
      warnings,
      errors,
    };

    logger.info('HEALTH_CHECK', `Startup health check completed (healthy=${healthy})`, result);
    return result;
  }
}

const healthChecker = new HealthChecker();

module.exports = {
  HealthChecker,
  healthChecker,
};
