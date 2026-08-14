const pty = require('node-pty');
const os = require('os');
const path = require('path');

class PtyManager {
  constructor() {
    this.terminals = new Map();
    this.nextId = 1;
  }

  getDefaultShell() {
    if (process.platform === 'win32') {
      return 'powershell.exe';
    }
    return process.env.SHELL || '/bin/zsh';
  }

  createTerminal(options = {}, webContents) {
    const id = `term-${this.nextId++}`;
    const shell = options.shell || this.getDefaultShell();
    const cwd = options.cwd || process.cwd() || os.homedir();
    const cols = options.cols || 80;
    const rows = options.rows || 24;

    try {
      const ptyProcess = pty.spawn(shell, [], {
        name: 'xterm-256color',
        cols,
        rows,
        cwd,
        env: process.env,
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
      console.error('[PTY-MANAGER] Failed to spawn PTY:', err);
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
