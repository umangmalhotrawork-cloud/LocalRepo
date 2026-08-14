const simpleGit = require('simple-git');
const fs = require('fs');
const path = require('path');

class GitManager {
  getGit(workspacePath) {
    if (!workspacePath || typeof workspacePath !== 'string') {
      throw new Error('Invalid workspace path');
    }
    return simpleGit({ baseDir: workspacePath, maxConcurrentProcesses: 4 });
  }

  async isRepo(workspacePath) {
    try {
      const git = this.getGit(workspacePath);
      return await git.checkIsRepo();
    } catch (e) {
      return false;
    }
  }

  async getStatus(workspacePath) {
    try {
      const git = this.getGit(workspacePath);
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        return {
          isRepo: false,
          currentBranch: '',
          staged: [],
          unstaged: [],
          untracked: [],
          lastCommit: null,
        };
      }

      const status = await git.status();
      const currentBranch = status.current || 'HEAD';

      const staged = [];
      const unstaged = [];
      const untracked = [];

      // Categorize staged vs unstaged vs untracked
      status.files.forEach((file) => {
        const filePath = file.path;
        const indexStatus = file.index;
        const workingDirStatus = file.working_dir;

        // Untracked
        if (workingDirStatus === '?' || file.index === '?') {
          untracked.push({ path: filePath, status: '??', fullStatus: file });
          return;
        }

        // Staged files (index has changes: 'M', 'A', 'D', 'R')
        if (indexStatus && indexStatus !== ' ' && indexStatus !== '?') {
          staged.push({ path: filePath, status: indexStatus, fullStatus: file });
        }

        // Unstaged files (working tree has changes: 'M', 'D')
        if (workingDirStatus && workingDirStatus !== ' ' && workingDirStatus !== '?') {
          unstaged.push({ path: filePath, status: workingDirStatus, fullStatus: file });
        }
      });

      // Get last commit summary
      let lastCommit = null;
      try {
        const log = await git.log({ maxCount: 1 });
        if (log && log.latest) {
          lastCommit = {
            hash: log.latest.hash.slice(0, 7),
            fullHash: log.latest.hash,
            message: log.latest.message,
            author: log.latest.author_name,
            date: log.latest.date,
          };
        }
      } catch (logErr) {
        // Empty repo without commits
      }

      return {
        isRepo: true,
        currentBranch,
        staged,
        unstaged,
        untracked,
        lastCommit,
      };
    } catch (err) {
      console.error('[GIT-MANAGER] getStatus error:', err);
      return {
        isRepo: false,
        error: err.message,
        currentBranch: '',
        staged: [],
        unstaged: [],
        untracked: [],
        lastCommit: null,
      };
    }
  }

  async getDiff(workspacePath, file, staged = false) {
    try {
      const git = this.getGit(workspacePath);
      let diff = '';
      let originalContent = '';
      let currentContent = '';

      if (staged) {
        diff = await git.diff(['--cached', '--', file]);
        try {
          originalContent = await git.show(['HEAD:' + file]);
        } catch (e) {}
        try {
          originalContent = originalContent || '';
        } catch (e) {}
      } else {
        diff = await git.diff(['--', file]);
        try {
          originalContent = await git.show([':' + file]);
        } catch (e) {
          try {
            originalContent = await git.show(['HEAD:' + file]);
          } catch (e2) {}
        }
      }

      const fullPath = path.isAbsolute(file) ? file : path.join(workspacePath, file);
      if (fs.existsSync(fullPath)) {
        try {
          currentContent = fs.readFileSync(fullPath, 'utf8');
        } catch (e) {}
      }

      return {
        success: true,
        diff,
        originalContent,
        currentContent,
      };
    } catch (err) {
      console.error('[GIT-MANAGER] getDiff error:', err);
      return {
        success: false,
        error: err.message,
        diff: '',
        originalContent: '',
        currentContent: '',
      };
    }
  }

  async stage(workspacePath, file) {
    const git = this.getGit(workspacePath);
    await git.add(file);
    return this.getStatus(workspacePath);
  }

  async unstage(workspacePath, file) {
    const git = this.getGit(workspacePath);
    try {
      await git.reset(['HEAD', '--', file]);
    } catch (e) {
      // If no commits yet
      await git.raw(['rm', '--cached', file]);
    }
    return this.getStatus(workspacePath);
  }

  async stageAll(workspacePath) {
    const git = this.getGit(workspacePath);
    await git.add('.');
    return this.getStatus(workspacePath);
  }

  async unstageAll(workspacePath) {
    const git = this.getGit(workspacePath);
    try {
      await git.reset(['HEAD']);
    } catch (e) {}
    return this.getStatus(workspacePath);
  }

  async commit(workspacePath, message) {
    const git = this.getGit(workspacePath);
    const result = await git.commit(message);
    const status = await this.getStatus(workspacePath);
    return {
      success: true,
      commitResult: result,
      status,
    };
  }

  async getBranches(workspacePath) {
    const git = this.getGit(workspacePath);
    const branchSummary = await git.branchLocal();
    return {
      all: branchSummary.all,
      current: branchSummary.current,
    };
  }

  async checkout(workspacePath, branch) {
    const git = this.getGit(workspacePath);
    await git.checkout(branch);
    return this.getStatus(workspacePath);
  }

  async createBranch(workspacePath, branch) {
    const git = this.getGit(workspacePath);
    await git.checkoutLocalBranch(branch);
    return this.getStatus(workspacePath);
  }

  async discard(workspacePath, file) {
    const git = this.getGit(workspacePath);
    const fullPath = path.isAbsolute(file) ? file : path.join(workspacePath, file);

    try {
      // Check if untracked
      const status = await git.status();
      const isUntracked = status.not_added.includes(file);

      if (isUntracked && fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
      } else {
        await git.checkout(['--', file]);
      }
    } catch (err) {
      console.error('[GIT-MANAGER] discard error:', err);
      throw err;
    }

    return this.getStatus(workspacePath);
  }
}

const gitManager = new GitManager();
module.exports = gitManager;
