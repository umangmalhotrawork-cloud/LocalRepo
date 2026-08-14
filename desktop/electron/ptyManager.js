const pty = require('node-pty');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { logger } = require('./logger');

class PtyManager {
  constructor() {
    this.terminals = new Map();
    this.nextId = 1;
    this.ensureSpawnHelperPermissions();
  }

  /**
   * Ensures that node-pty's spawn-helper binary has execute permissions (0755)
   * on macOS and Linux. Fixes the root cause of "posix_spawnp failed".
   */
  ensureSpawnHelperPermissions() {
    if (process.platform === 'win32') return;

    try {
      const ptyLibDir = path.dirname(require.resolve('node-pty'));
      const candidateDirs = [
        path.join(ptyLibDir, '..', 'prebuilds', `${process.platform}-${process.arch}`),
        path.join(ptyLibDir, '..', 'build', 'Release'),
        path.join(ptyLibDir, '..', 'build', 'Debug'),
        path.join(ptyLibDir, '..', 'prebuilds', 'darwin-arm64'),
        path.join(ptyLibDir, '..', 'prebuilds', 'darwin-x64'),
        path.join(ptyLibDir, '..', 'prebuilds', 'linux-x64'),
        path.join(ptyLibDir, '..', 'prebuilds', 'linux-arm64'),
      ];

      for (const dir of candidateDirs) {
        const helperPath = path.join(dir, 'spawn-helper');
        if (fs.existsSync(helperPath)) {
          try {
            const stat = fs.statSync(helperPath);
            if ((stat.mode & 0o111) !== 0o111) {
              fs.chmodSync(helperPath, 0o755);
              logger.info('TERMINAL', `Applied 0755 executable permissions to spawn-helper: ${helperPath}`);
            }
          } catch (err) {
            logger.warn('TERMINAL', `Failed to chmod spawn-helper at ${helperPath}: ${err.message}`);
          }
        }
      }
    } catch (e) {
      logger.warn('TERMINAL', `Error checking spawn-helper permissions: ${e.message}`);
    }
  }

  /**
   * Validates if a file exists and is executable
   */
  isExecutable(filePath) {
    if (!filePath || typeof filePath !== 'string' || !filePath.trim()) return false;
    try {
      if (!fs.existsSync(filePath)) return false;
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) return false;
      if (process.platform !== 'win32') {
        fs.accessSync(filePath, fs.constants.X_OK);
      }
      return true;
    } catch (e) {
      return false;
    }
  }

  /**
   * Resolves the best available shell for the current platform
   */
  getDefaultShell() {
    if (process.platform === 'win32') {
      const candidates = [
        process.env.COMSPEC,
        'C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe',
        'C:\\Windows\\System32\\cmd.exe',
        'powershell.exe',
        'cmd.exe',
      ];
      for (const sh of candidates) {
        if (sh && (sh.endsWith('.exe') || this.isExecutable(sh))) {
          return sh;
        }
      }
      return 'powershell.exe';
    }

    if (process.platform === 'darwin') {
      const envShell = process.env.SHELL;
      if (envShell && this.isExecutable(envShell)) {
        return envShell;
      }

      const darwinCandidates = [
        '/bin/zsh',
        '/bin/bash',
        '/bin/sh',
        '/usr/bin/zsh',
        '/usr/bin/bash',
        '/usr/bin/sh',
        '/opt/homebrew/bin/zsh',
        '/usr/local/bin/zsh',
        '/opt/homebrew/bin/bash',
        '/usr/local/bin/bash',
      ];

      for (const candidate of darwinCandidates) {
        if (this.isExecutable(candidate)) {
          return candidate;
        }
      }

      return '/bin/zsh';
    }

    // Linux & other Unix
    const envShell = process.env.SHELL;
    if (envShell && this.isExecutable(envShell)) {
      return envShell;
    }

    const linuxCandidates = [
      '/bin/bash',
      '/bin/sh',
      '/usr/bin/bash',
      '/usr/bin/sh',
      '/bin/zsh',
      '/usr/bin/zsh',
    ];

    for (const candidate of linuxCandidates) {
      if (this.isExecutable(candidate)) {
        return candidate;
      }
    }

    return '/bin/sh';
  }

  /**
   * Validates and resolves the working directory
   */
  resolveCwd(requestedCwd) {
    if (requestedCwd && typeof requestedCwd === 'string') {
      try {
        const resolved = path.resolve(requestedCwd);
        if (fs.existsSync(resolved) && fs.statSync(resolved).isDirectory()) {
          return resolved;
        }
      } catch (e) {}
    }

    try {
      const current = process.cwd();
      if (fs.existsSync(current) && fs.statSync(current).isDirectory()) {
        return current;
      }
    } catch (e) {}

    try {
      const home = os.homedir();
      if (fs.existsSync(home) && fs.statSync(home).isDirectory()) {
        return home;
      }
    } catch (e) {}

    return process.platform === 'win32' ? 'C:\\' : '/tmp';
  }

  /**
   * Augments environment for the spawned shell session
   */
  prepareEnvironment(customEnv = {}) {
    const env = { ...process.env, ...customEnv };

    if (process.platform === 'darwin') {
      const standardPaths = [
        '/usr/local/bin',
        '/usr/bin',
        '/bin',
        '/usr/sbin',
        '/sbin',
        '/opt/homebrew/bin',
        '/opt/homebrew/sbin',
      ];
      const existingPath = env.PATH || '';
      const missingPaths = standardPaths.filter((p) => !existingPath.includes(p));
      if (missingPaths.length > 0) {
        env.PATH = `${existingPath}:${missingPaths.join(':')}`;
      }
    }

    env.TERM = env.TERM || 'xterm-256color';
    env.COLORTERM = env.COLORTERM || 'truecolor';
    env.TERM_PROGRAM = 'EchoNullity';

    return env;
  }

  createTerminal(options = {}, webContents) {
    this.ensureSpawnHelperPermissions();

    const id = `term-${this.nextId++}`;
    let shell = options.shell;
    if (!shell || !this.isExecutable(shell)) {
      shell = this.getDefaultShell();
    }

    const cwd = this.resolveCwd(options.cwd);
    const cols = typeof options.cols === 'number' && options.cols > 0 ? options.cols : 80;
    const rows = typeof options.rows === 'number' && options.rows > 0 ? options.rows : 24;
    const env = this.prepareEnvironment(options.env);

    logger.info('TERMINAL', 'Spawning terminal PTY session', {
      id,
      resolvedShell: shell,
      requestedShell: options.shell || null,
      resolvedCwd: cwd,
      envShell: process.env.SHELL || null,
      platform: process.platform,
      arch: process.arch,
      cols,
      rows,
    });

    try {
      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env,
      });

      const termInfo = {
        id,
        pid: ptyProcess.pid,
        shell,
        cwd,
        ptyProcess,
        status: 'running',
      };

      this.terminals.set(id, termInfo);

      ptyProcess.onData((data) => {
        if (webContents && !webContents.isDestroyed()) {
          webContents.send('terminal:data', { id, data });
        }
      });

      ptyProcess.onExit(({ exitCode, signal }) => {
        termInfo.status = exitCode === 0 ? 'exited' : 'error';
        if (webContents && !webContents.isDestroyed()) {
          webContents.send('terminal:exit', { id, exitCode, signal });
        }
      });

      return {
        id,
        pid: ptyProcess.pid,
        shell,
        cwd,
        status: 'running',
      };
    } catch (err) {
      logger.error('TERMINAL', `Failed to spawn PTY terminal session (${shell}): ${err.message}`, {
        id,
        shell,
        cwd,
        errorCode: err.code,
        syscall: err.syscall,
        stack: err.stack,
        platform: process.platform,
        arch: process.arch,
      });

      // User-friendly error wrapping
      if (err.message && err.message.includes('posix_spawnp failed')) {
        throw new Error(
          `Terminal initialization failed: Unable to spawn shell executable "${shell}". ` +
          `Please check that the shell binary exists and has execute permissions.`
        );
      }
      throw err;
    }
  }

  write(id, data) {
    const term = this.terminals.get(id);
    if (term && term.ptyProcess) {
      term.ptyProcess.write(data);
    }
  }

  resize(id, cols, rows) {
    const term = this.terminals.get(id);
    if (term && term.ptyProcess) {
      try {
        term.ptyProcess.resize(cols, rows);
      } catch (e) {}
    }
  }

  kill(id) {
    const term = this.terminals.get(id);
    if (term && term.ptyProcess) {
      try {
        term.ptyProcess.kill();
      } catch (e) {}
      this.terminals.delete(id);
    }
  }

  restart(id, webContents) {
    const term = this.terminals.get(id);
    if (term) {
      const cwd = term.cwd;
      const shell = term.shell;
      this.kill(id);
      return this.createTerminal({ cwd, shell }, webContents);
    }
    return this.createTerminal({}, webContents);
  }

  list() {
    const list = [];
    for (const [id, term] of this.terminals.entries()) {
      list.push({
        id,
        pid: term.pid,
        shell: term.shell,
        cwd: term.cwd,
        status: term.status,
      });
    }
    return list;
  }

  cleanupAll() {
    for (const [id, term] of this.terminals.entries()) {
      try {
        if (term.ptyProcess) term.ptyProcess.kill();
      } catch (e) {}
    }
    this.terminals.clear();
  }
}

const ptyManager = new PtyManager();
module.exports = ptyManager;
