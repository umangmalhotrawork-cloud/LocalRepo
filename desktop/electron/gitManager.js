const simpleGit = require('simple-git');
const fs = require('fs');
const path = require('path');

class GitManager {
  getGit(workspacePath) {
    if (!workspacePath || typeof workspacePath !== 'string') {
      throw new Error('Invalid workspace path');
    }
    const env = { ...process.env };
    
    // 1. Remove interactive editor variables
    delete env.EDITOR;
    delete env.editor;
    delete env.VISUAL;
    delete env.visual;
    delete env.GIT_EDITOR;
    delete env.git_editor;
    delete env.GIT_SEQUENCE_EDITOR;
    delete env.git_sequence_editor;

    // 2. Remove pager variables
    delete env.PAGER;
    delete env.pager;
    delete env.GIT_PAGER;
    delete env.git_pager;

    // 3. Remove interactive authentication prompt variables
    delete env.GIT_ASKPASS;
    delete env.git_askpass;
    delete env.SSH_ASKPASS;
    delete env.ssh_askpass;

    // 4. Explicitly set non-interactive and isolated flags
    env.GIT_TERMINAL_PROMPT = '0';
    env.GIT_CONFIG_NOSYSTEM = '1';
    env.GIT_CONFIG_GLOBAL = process.env.GIT_CONFIG_GLOBAL || '/dev/null';
    env.GIT_CONFIG_SYSTEM = process.env.GIT_CONFIG_SYSTEM || '/dev/null';

    return simpleGit({
      baseDir: workspacePath,
      maxConcurrentProcesses: 4,
      unsafe: { allowUnsafeConfigPaths: true },
    }).env(env);
  }

  async isRepo(workspacePath) {
    try {
      if (!workspacePath || typeof workspacePath !== 'string') return false;
      if (fs.existsSync(path.join(workspacePath, '.git'))) return true;
      const git = this.getGit(workspacePath);
      return await git.checkIsRepo('root');
    } catch (e) {
      return false;
    }
  }

  validateBranchName(name) {
    if (!name || typeof name !== 'string') {
      return { valid: false, error: 'Branch name cannot be empty.' };
    }
    const trimmed = name.trim();
    if (!trimmed) {
      return { valid: false, error: 'Branch name cannot be whitespace only.' };
    }
    if (/\s/.test(trimmed)) {
      return { valid: false, error: 'Branch name cannot contain whitespace spaces.' };
    }
    if (trimmed.startsWith('/') || trimmed.endsWith('/')) {
      return { valid: false, error: 'Branch name cannot start or end with a slash.' };
    }
    if (trimmed.startsWith('.') || trimmed.endsWith('.')) {
      return { valid: false, error: 'Branch name cannot start or end with a period.' };
    }
    if (trimmed.endsWith('.lock')) {
      return { valid: false, error: 'Branch name cannot end with .lock.' };
    }
    if (trimmed.startsWith('-')) {
      return { valid: false, error: 'Branch name cannot start with a hyphen.' };
    }
    if (trimmed.includes('..')) {
      return { valid: false, error: 'Branch name cannot contain consecutive dots "..".' };
    }
    if (/[~^:?*\[\\@{]/.test(trimmed)) {
      return { valid: false, error: 'Branch name contains invalid characters (~, ^, :, ?, *, [, \\, @{).' };
    }
    if (/[\x00-\x1f\x7f]/.test(trimmed)) {
      return { valid: false, error: 'Branch name cannot contain control characters.' };
    }
    if (trimmed.toUpperCase() === 'HEAD') {
      return { valid: false, error: 'Branch name cannot be "HEAD".' };
    }
    return { valid: true };
  }

  async getStatus(workspacePath) {
    try {
      const git = this.getGit(workspacePath);
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        return {
          isRepo: false,
          currentBranch: '',
          isDetached: false,
          tracking: null,
          ahead: 0,
          behind: 0,
          isClean: true,
          hasLocalChanges: false,
          staged: [],
          unstaged: [],
          untracked: [],
          lastCommit: null,
        };
      }

      const status = await git.status();
      const currentBranch = status.current || 'HEAD';
      const isDetached = Boolean(status.detached || status.current === 'HEAD' || (status.current && /^[0-9a-f]{40}$/i.test(status.current)));
      const tracking = status.tracking || null;
      const ahead = typeof status.ahead === 'number' ? status.ahead : 0;
      const behind = typeof status.behind === 'number' ? status.behind : 0;

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

      const isClean = staged.length === 0 && unstaged.length === 0 && untracked.length === 0;
      const hasLocalChanges = !isClean;

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
        isDetached,
        tracking,
        ahead,
        behind,
        isClean,
        hasLocalChanges,
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
        isDetached: false,
        tracking: null,
        ahead: 0,
        behind: 0,
        isClean: true,
        hasLocalChanges: false,
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
    } catch (e) {
      try {
        await git.raw(['rm', '-r', '--cached', '.']);
      } catch (e2) {}
    }
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
    try {
      const git = this.getGit(workspacePath);
      const isRepo = await git.checkIsRepo();
      if (!isRepo) {
        return {
          all: [],
          current: '',
          detached: false,
          branches: [],
        };
      }

      let summary;
      try {
        summary = await git.branch(['-a', '-vv']);
      } catch (e) {
        summary = await git.branchLocal();
      }

      const current = summary.current || 'HEAD';
      const detached = Boolean(summary.detached || current === 'HEAD');

      const branchesList = [];
      const branchEntries = summary.branches || {};
      const allNames = Object.keys(branchEntries);

      for (const name of allNames) {
        const entry = branchEntries[name];
        const isRemote = name.startsWith('remotes/') || name.startsWith('origin/');
        const cleanName = isRemote ? name.replace(/^remotes\/[^/]+\//, '') : name;
        const tracking = entry?.label && entry.label.includes('/') ? entry.label.split(' ')[0] : null;

        let ahead = 0;
        let behind = 0;
        if (entry?.label) {
          const aheadMatch = entry.label.match(/ahead (\d+)/);
          if (aheadMatch) ahead = parseInt(aheadMatch[1], 10);
          const behindMatch = entry.label.match(/behind (\d+)/);
          if (behindMatch) behind = parseInt(behindMatch[1], 10);
        }

        branchesList.push({
          name,
          displayName: cleanName,
          current: entry?.current || name === current,
          isRemote,
          tracking,
          ahead,
          behind,
          commit: entry?.commit || '',
          label: entry?.label || '',
        });
      }

      if (branchesList.length === 0 && Array.isArray(summary.all)) {
        for (const name of summary.all) {
          branchesList.push({
            name,
            displayName: name,
            current: name === current,
            isRemote: name.startsWith('remotes/') || name.startsWith('origin/'),
            tracking: null,
            ahead: 0,
            behind: 0,
            commit: '',
            label: '',
          });
        }
      }

      return {
        all: summary.all || branchesList.map((b) => b.name),
        current,
        detached,
        branches: branchesList,
      };
    } catch (err) {
      console.error('[GIT-MANAGER] getBranches error:', err);
      return {
        all: [],
        current: '',
        detached: false,
        branches: [],
        error: err.message,
      };
    }
  }

  async checkout(workspacePath, branch, options = {}) {
    if (!branch || typeof branch !== 'string') {
      throw new Error('Target branch cannot be empty.');
    }
    const cleanBranch = branch.trim();
    const git = this.getGit(workspacePath);
    const currentStatus = await this.getStatus(workspacePath);

    if (currentStatus.currentBranch === cleanBranch) {
      return currentStatus;
    }

    const force = Boolean(options && options.force);
    if (!force && currentStatus.hasLocalChanges) {
      try {
        await git.checkout(cleanBranch);
      } catch (err) {
        const rawMsg = err.message || String(err);
        if (rawMsg.includes('overwritten by checkout') || rawMsg.includes('local changes') || rawMsg.includes('Please commit your changes or stash them')) {
          const conflictErr = new Error('Checkout blocked by uncommitted local changes. Please commit or stash your changes before switching branches.');
          conflictErr.code = 'DIRTY_CHECKOUT_BLOCKED';
          conflictErr.rawError = rawMsg;
          conflictErr.uncommittedFiles = [...currentStatus.staged, ...currentStatus.unstaged, ...currentStatus.untracked].map((f) => f.path);
          throw conflictErr;
        }
        throw err;
      }
      return this.getStatus(workspacePath);
    }

    if (force) {
      await git.checkout(['-f', cleanBranch]);
    } else {
      await git.checkout(cleanBranch);
    }

    return this.getStatus(workspacePath);
  }

  async createBranch(workspacePath, branch, checkout = true) {
    if (!branch || typeof branch !== 'string') {
      throw new Error('Branch name cannot be empty.');
    }
    const cleanBranch = branch.trim();
    const validation = this.validateBranchName(cleanBranch);
    if (!validation.valid) {
      throw new Error(validation.error || 'Invalid branch name.');
    }

    const git = this.getGit(workspacePath);
    const branches = await this.getBranches(workspacePath);
    const exists = branches.all.some((b) => b === cleanBranch || b.endsWith(`/${cleanBranch}`));
    if (exists) {
      throw new Error(`Branch "${cleanBranch}" already exists.`);
    }

    if (checkout) {
      await git.checkoutLocalBranch(cleanBranch);
    } else {
      await git.branch([cleanBranch]);
    }
    return this.getStatus(workspacePath);
  }

  async getStashes(workspacePath) {
    try {
      const git = this.getGit(workspacePath);
      const isRepo = await git.checkIsRepo();
      if (!isRepo) return [];

      let rawOutput = '';
      try {
        rawOutput = await git.raw(['stash', 'list', '--pretty=format:%gd|%h|%cr|%gs']);
      } catch (e) {
        try {
          rawOutput = await git.raw(['stash', 'list']);
        } catch (e2) {
          return [];
        }
      }

      if (!rawOutput || !rawOutput.trim()) return [];

      const lines = rawOutput.trim().split('\n').filter(Boolean);
      const stashes = lines.map((line, idx) => {
        if (line.includes('|')) {
          const [gd, hash, cr, gs] = line.split('|');
          const id = gd ? gd.trim() : `stash@{${idx}}`;
          const message = gs ? gs.trim() : 'WIP changes';
          let branch = '';
          const branchMatch = message.match(/(?:WIP on|On)\s+([^:]+)/i);
          if (branchMatch) branch = branchMatch[1].trim();

          return {
            id,
            index: idx,
            hash: hash ? hash.trim() : '',
            date: cr ? cr.trim() : '',
            message,
            branch,
          };
        } else {
          const match = line.match(/^(stash@\{(\d+)\}):\s*(.*)$/);
          if (match) {
            const id = match[1];
            const index = parseInt(match[2], 10);
            const msg = match[3] || 'WIP changes';
            let branch = '';
            const branchMatch = msg.match(/(?:WIP on|On)\s+([^:]+)/i);
            if (branchMatch) branch = branchMatch[1].trim();
            return {
              id,
              index,
              hash: '',
              date: '',
              message: msg,
              branch,
            };
          }
          return {
            id: `stash@{${idx}}`,
            index: idx,
            hash: '',
            date: '',
            message: line.trim(),
            branch: '',
          };
        }
      });

      return stashes;
    } catch (err) {
      console.error('[GIT-MANAGER] getStashes error:', err);
      return [];
    }
  }

  async stashSave(workspacePath, options = {}) {
    const git = this.getGit(workspacePath);
    const status = await this.getStatus(workspacePath);
    if (!status.isRepo) {
      throw new Error('Not a git repository.');
    }

    if (status.isClean) {
      return {
        success: true,
        noChanges: true,
        message: 'No local changes to save to stash.',
        status,
        stashes: await this.getStashes(workspacePath),
      };
    }

    const args = ['push'];
    if (options.includeUntracked !== false) {
      args.push('--include-untracked');
    }
    if (options.keepIndex) {
      args.push('--keep-index');
    }
    if (options.message && typeof options.message === 'string' && options.message.trim()) {
      args.push('-m', options.message.trim());
    }

    try {
      await git.stash(args);
    } catch (err) {
      if (err.message && err.message.includes('unknown option')) {
        const fallbackArgs = ['push'];
        if (options.message) fallbackArgs.push('-m', options.message.trim());
        await git.stash(fallbackArgs);
      } else {
        throw err;
      }
    }

    const updatedStatus = await this.getStatus(workspacePath);
    const stashes = await this.getStashes(workspacePath);
    return {
      success: true,
      message: options.message ? `Stashed: "${options.message.trim()}"` : 'Changes stashed successfully.',
      status: updatedStatus,
      stashes,
    };
  }

  async stashApply(workspacePath, stashId = 'stash@{0}') {
    const git = this.getGit(workspacePath);
    try {
      await git.stash(['apply', stashId]);
      const status = await this.getStatus(workspacePath);
      return {
        success: true,
        message: `Applied ${stashId} successfully.`,
        status,
        stashes: await this.getStashes(workspacePath),
      };
    } catch (err) {
      const rawMsg = err.message || String(err);
      if (rawMsg.includes('conflict') || rawMsg.includes('needs merge')) {
        const conflictErr = new Error(`Stash apply on ${stashId} resulted in merge conflicts. Please resolve conflicts or undo.`);
        conflictErr.code = 'STASH_CONFLICT';
        conflictErr.rawError = rawMsg;
        throw conflictErr;
      }
      throw err;
    }
  }

  async stashPop(workspacePath, stashId = 'stash@{0}') {
    const git = this.getGit(workspacePath);
    try {
      await git.stash(['pop', stashId]);
      const status = await this.getStatus(workspacePath);
      return {
        success: true,
        message: `Popped ${stashId} successfully.`,
        status,
        stashes: await this.getStashes(workspacePath),
      };
    } catch (err) {
      const rawMsg = err.message || String(err);
      if (rawMsg.includes('conflict') || rawMsg.includes('needs merge')) {
        const conflictErr = new Error(`Stash pop on ${stashId} resulted in merge conflicts. The stash was kept in the list.`);
        conflictErr.code = 'STASH_CONFLICT';
        conflictErr.rawError = rawMsg;
        throw conflictErr;
      }
      throw err;
    }
  }

  async stashDrop(workspacePath, stashId = 'stash@{0}') {
    const git = this.getGit(workspacePath);
    await git.stash(['drop', stashId]);
    const stashes = await this.getStashes(workspacePath);
    return {
      success: true,
      message: `Dropped ${stashId} successfully.`,
      status: await this.getStatus(workspacePath),
      stashes,
    };
  }

  async stashClear(workspacePath) {
    const git = this.getGit(workspacePath);
    await git.stash(['clear']);
    return {
      success: true,
      message: 'Cleared all stashes.',
      status: await this.getStatus(workspacePath),
      stashes: [],
    };
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

  formatPushError(rawErr) {
    if (!rawErr) return 'Push failed.';
    const lower = String(rawErr).toLowerCase();

    if (lower.includes('duplicate header')) {
      return 'Push failed: remote received duplicate Authorization header.';
    }
    if (
      lower.includes('401') ||
      lower.includes('invalid credentials') ||
      lower.includes('authentication failed') ||
      lower.includes('could not read username')
    ) {
      return 'Push authentication failed. Please reconnect your GitHub account.';
    }
    if (
      lower.includes('404') ||
      lower.includes('repository not found') ||
      lower.includes('could not read from remote')
    ) {
      return 'Repository not found or access denied.';
    }
    if (
      lower.includes('403') ||
      lower.includes('permission to') ||
      lower.includes('permission denied')
    ) {
      return 'Permission denied for repository.';
    }
    if (
      lower.includes('rejected') ||
      lower.includes('non-fast-forward') ||
      lower.includes('fetch first') ||
      lower.includes('behind')
    ) {
      return 'Push rejected (non-fast-forward). Remote contains work that you do not have locally.';
    }
    if (lower.includes('no remote') || lower.includes('does not appear to be a git repository')) {
      return 'No remote repository configured.';
    }

    return String(rawErr)
      .replace(/gh[opusr]_[a-zA-Z0-9_]{16,}/g, 'gho_***')
      .replace(/Basic\s+[a-zA-Z0-9+/=]{16,}/g, 'Basic [REDACTED]');
  }

  async fetch(workspacePath, remote = 'origin') {
    try {
      const git = this.getGit(workspacePath);
      const { githubAuthManager } = require('./githubAuthManager');
      const associatedRes = await githubAuthManager.getSelectedRepository(workspacePath).catch(() => ({ repo: null }));
      const associatedRepo = associatedRes?.repo || null;
      const token = githubAuthManager.authState?.token || null;

      let remotes = await git.getRemotes(true).catch(() => []);
      if (associatedRepo && remotes.length === 0) {
        try {
          await git.addRemote('origin', associatedRepo.cloneUrl || associatedRepo.htmlUrl);
          remotes = await git.getRemotes(true);
        } catch (e) {}
      }

      if (!remotes || remotes.length === 0) {
        return {
          success: false,
          noRemote: true,
          message: 'No remote repository configured',
          status: await this.getStatus(workspacePath),
        };
      }

      let targetRemote = remote;
      if (!remotes.some((r) => r.name === targetRemote)) {
        targetRemote = remotes[0].name;
      }

      let fetchResult;
      if (token) {
        // Unset any static http.extraheader from local repo config to ensure exactly one auth header is sent via -c
        await git.raw(['config', '--unset-all', 'http.extraheader']).catch(() => {});
        const basicAuth = Buffer.from(`x-access-token:${token}`).toString('base64');
        const authConfig = `http.extraheader=Authorization: Basic ${basicAuth}`;
        fetchResult = await git.raw(['-c', authConfig, 'fetch', targetRemote]);
      } else {
        fetchResult = await git.fetch(targetRemote);
      }

      const status = await this.getStatus(workspacePath);
      return {
        success: true,
        result: fetchResult,
        message: `Fetched from ${targetRemote}`,
        status,
      };
    } catch (err) {
      console.error('[GIT-MANAGER] fetch error:', err);
      const formatted = this.formatPushError(err.message || String(err));
      return {
        success: false,
        error: formatted,
        message: `Fetch failed: ${formatted}`,
        status: await this.getStatus(workspacePath),
      };
    }
  }

  async pull(workspacePath, remote = 'origin', branch) {
    try {
      const git = this.getGit(workspacePath);
      const { githubAuthManager } = require('./githubAuthManager');
      const associatedRes = await githubAuthManager.getSelectedRepository(workspacePath).catch(() => ({ repo: null }));
      const associatedRepo = associatedRes?.repo || null;
      const token = githubAuthManager.authState?.token || null;

      let remotes = await git.getRemotes(true).catch(() => []);
      if (associatedRepo && remotes.length === 0) {
        try {
          await git.addRemote('origin', associatedRepo.cloneUrl || associatedRepo.htmlUrl);
          remotes = await git.getRemotes(true);
        } catch (e) {}
      }

      if (!remotes || remotes.length === 0) {
        return {
          success: false,
          noRemote: true,
          message: 'No remote repository configured',
          status: await this.getStatus(workspacePath),
        };
      }

      let targetRemote = remote;
      if (!remotes.some((r) => r.name === targetRemote)) {
        targetRemote = remotes[0].name;
      }

      let targetBranch = branch;
      if (!targetBranch) {
        const st = await git.status();
        targetBranch = st.current || 'main';
      }

      let pullResult;
      if (token) {
        // Unset any static http.extraheader from local repo config to ensure exactly one auth header is sent via -c
        await git.raw(['config', '--unset-all', 'http.extraheader']).catch(() => {});
        const basicAuth = Buffer.from(`x-access-token:${token}`).toString('base64');
        const authConfig = `http.extraheader=Authorization: Basic ${basicAuth}`;
        try {
          pullResult = await git.raw(['-c', authConfig, 'pull', targetRemote, targetBranch]);
        } catch (pullErr) {
          // If pull with branch spec failed, try default pull
          pullResult = await git.raw(['-c', authConfig, 'pull']);
        }
      } else {
        try {
          pullResult = await git.pull(targetRemote, targetBranch);
        } catch (pullErr) {
          pullResult = await git.pull();
        }
      }

      const status = await this.getStatus(workspacePath);
      return {
        success: true,
        result: pullResult,
        message: `Pulled from ${targetRemote}/${targetBranch}`,
        status,
      };
    } catch (err) {
      console.error('[GIT-MANAGER] pull error:', err);
      const formatted = this.formatPushError(err.message || String(err));
      return {
        success: false,
        error: formatted,
        message: `Pull failed: ${formatted}`,
        status: await this.getStatus(workspacePath),
      };
    }
  }

  async push(workspacePath, remote = 'origin', branch) {
    try {
      const git = this.getGit(workspacePath);
      const { githubAuthManager } = require('./githubAuthManager');
      const associatedRes = await githubAuthManager.getSelectedRepository(workspacePath).catch(() => ({ repo: null }));
      const associatedRepo = associatedRes?.repo || null;
      const token = githubAuthManager.authState?.token || null;

      let remotes = await git.getRemotes(true).catch(() => []);
      if (associatedRepo && remotes.length === 0) {
        try {
          await git.addRemote('origin', associatedRepo.cloneUrl || associatedRepo.htmlUrl);
          remotes = await git.getRemotes(true);
        } catch (e) {}
      }

      if (!remotes || remotes.length === 0) {
        return {
          success: false,
          noRemote: true,
          message: 'No remote repository configured',
          status: await this.getStatus(workspacePath),
        };
      }

      let targetRemote = remote;
      if (!remotes.some((r) => r.name === targetRemote)) {
        targetRemote = remotes[0].name;
      }

      let targetBranch = branch;
      if (!targetBranch) {
        const st = await git.status();
        targetBranch = st.current || 'main';
      }

      let pushResult;
      if (token) {
        // Unset any static http.extraheader from local repo config to ensure exactly one auth header is sent via -c
        await git.raw(['config', '--unset-all', 'http.extraheader']).catch(() => {});
        const basicAuth = Buffer.from(`x-access-token:${token}`).toString('base64');
        const authConfig = `http.extraheader=Authorization: Basic ${basicAuth}`;
        try {
          pushResult = await git.raw(['-c', authConfig, 'push', '--set-upstream', targetRemote, targetBranch]);
        } catch (upstreamErr) {
          pushResult = await git.raw(['-c', authConfig, 'push', targetRemote, targetBranch]);
        }
      } else {
        try {
          pushResult = await git.push(targetRemote, targetBranch, ['--set-upstream']);
        } catch (upstreamErr) {
          pushResult = await git.push(targetRemote, targetBranch);
        }
      }

      const status = await this.getStatus(workspacePath);
      return {
        success: true,
        result: pushResult,
        message: `Pushed to ${targetRemote}/${targetBranch}`,
        status,
      };
    } catch (err) {
      console.error('[GIT-MANAGER] push error:', err);
      const formatted = this.formatPushError(err.message || String(err));
      return {
        success: false,
        error: formatted,
        message: `Push failed: ${formatted}`,
        status: await this.getStatus(workspacePath),
      };
    }
  }

  async sync(workspacePath, remote = 'origin', branch) {
    try {
      // 1. Fetch & Pull changes first
      const pullRes = await this.pull(workspacePath, remote, branch);
      if (!pullRes.success && !pullRes.noRemote) {
        return {
          success: false,
          error: pullRes.error || pullRes.message,
          message: `Sync failed during pull: ${pullRes.error || pullRes.message}`,
          status: pullRes.status,
        };
      }

      // 2. Push local commits to remote
      const pushRes = await this.push(workspacePath, remote, branch);
      if (!pushRes.success && !pushRes.noRemote) {
        return {
          success: false,
          error: pushRes.error || pushRes.message,
          message: `Sync failed during push: ${pushRes.error || pushRes.message}`,
          status: pushRes.status,
        };
      }

      const status = await this.getStatus(workspacePath);
      return {
        success: true,
        message: 'Synchronized with remote repository successfully.',
        status,
      };
    } catch (err) {
      console.error('[GIT-MANAGER] sync error:', err);
      const formatted = this.formatPushError(err.message || String(err));
      return {
        success: false,
        error: formatted,
        message: `Sync failed: ${formatted}`,
        status: await this.getStatus(workspacePath),
      };
    }
  }

  async commitAndPush(workspacePath, message) {
    if (!workspacePath || typeof workspacePath !== 'string') {
      throw new Error('Invalid workspace path');
    }
    if (!message || !message.trim()) {
      throw new Error('Commit message cannot be empty');
    }

    const git = this.getGit(workspacePath);
    const initialStatus = await this.getStatus(workspacePath);

    if (!initialStatus.isRepo) {
      return {
        success: false,
        error: 'Not a git repository',
        message: 'Folder is not a Git repository.',
        status: initialStatus,
      };
    }

    // 1. Check for detached HEAD
    if (!initialStatus.currentBranch || initialStatus.currentBranch === 'HEAD') {
      return {
        success: false,
        detachedHead: true,
        committed: false,
        pushed: false,
        message: 'Cannot push from detached HEAD state. Please checkout or create a branch first.',
        status: initialStatus,
      };
    }

    // 2. Check for changes (staged, unstaged, untracked)
    const hasChanges =
      (initialStatus.staged && initialStatus.staged.length > 0) ||
      (initialStatus.unstaged && initialStatus.unstaged.length > 0) ||
      (initialStatus.untracked && initialStatus.untracked.length > 0);

    if (!hasChanges) {
      return {
        success: false,
        noChanges: true,
        committed: false,
        pushed: false,
        message: 'No changes to commit. Working tree clean.',
        status: initialStatus,
      };
    }

    // 3. Stage all working tree & untracked changes
    await git.add('.');

    // 4. Create commit
    let commitResult;
    try {
      commitResult = await git.commit(message.trim());
    } catch (commitErr) {
      return {
        success: false,
        committed: false,
        pushed: false,
        error: commitErr.message,
        message: `Commit failed: ${commitErr.message}`,
        status: await this.getStatus(workspacePath),
      };
    }

    // 5. GitHub Repository Association & Remote Check
    const currentBranch = initialStatus.currentBranch || 'main';
    let targetRemote = 'origin';
    let pushSuccess = false;
    let pushError = null;
    let noRemote = false;
    let remoteMismatch = false;

    const { githubAuthManager } = require('./githubAuthManager');
    const associatedRes = await githubAuthManager.getSelectedRepository(workspacePath).catch(() => ({ repo: null }));
    const associatedRepo = associatedRes?.repo || null;
    const token = githubAuthManager.authState?.token || null;

    let existingRemotes = [];
    try {
      existingRemotes = await git.getRemotes(true);
    } catch (e) {
      existingRemotes = [];
    }

    if (associatedRepo && existingRemotes.length === 0) {
      try {
        await git.addRemote('origin', associatedRepo.cloneUrl || associatedRepo.htmlUrl);
        existingRemotes = await git.getRemotes(true);
      } catch (e) {
        console.warn('[GIT-MANAGER] Failed to add origin for associated repo:', e.message);
      }
    }

    if (!existingRemotes || existingRemotes.length === 0) {
      noRemote = true;
    } else {
      const originRemote = existingRemotes.find((r) => r.name === 'origin') || existingRemotes[0];
      targetRemote = originRemote.name;

      if (associatedRepo && originRemote) {
        const fetchUrl = (originRemote.refs?.fetch || '').toLowerCase();
        const pushUrl = (originRemote.refs?.push || '').toLowerCase();
        const targetFullName = (associatedRepo.fullName || '').toLowerCase();
        const targetCloneUrl = (associatedRepo.cloneUrl || '').toLowerCase();
        const targetHtmlUrl = (associatedRepo.htmlUrl || '').toLowerCase();

        const matches =
          fetchUrl.includes(targetFullName) ||
          pushUrl.includes(targetFullName) ||
          (targetCloneUrl && (fetchUrl.includes(targetCloneUrl) || pushUrl.includes(targetCloneUrl))) ||
          (targetHtmlUrl && (fetchUrl.includes(targetHtmlUrl) || pushUrl.includes(targetHtmlUrl)));

        if (!matches) {
          remoteMismatch = true;
          pushError = `Configured origin remote does not match associated repository "${associatedRepo.fullName}".`;
        }
      }

      if (!remoteMismatch) {
        if (token) {
          // Unset any static http.extraheader from local repo config to ensure exactly one auth header is sent via -c
          await git.raw(['config', '--unset-all', 'http.extraheader']).catch(() => {});
          const basicAuth = Buffer.from(`x-access-token:${token}`).toString('base64');
          const authConfig = `http.extraheader=Authorization: Basic ${basicAuth}`;
          try {
            await git.raw(['-c', authConfig, 'push', '--set-upstream', targetRemote, currentBranch]);
            pushSuccess = true;
          } catch (pErr1) {
            try {
              await git.raw(['-c', authConfig, 'push', targetRemote, currentBranch]);
              pushSuccess = true;
            } catch (pErr2) {
              const rawErr = pErr2.message || pErr1.message || String(pErr2);
              pushError = this.formatPushError(rawErr);
            }
          }
        } else {
          try {
            await git.push(targetRemote, currentBranch, ['--set-upstream']);
            pushSuccess = true;
          } catch (pErr1) {
            try {
              await git.push(targetRemote, currentBranch);
              pushSuccess = true;
            } catch (pErr2) {
              const rawErr = pErr2.message || pErr1.message || String(pErr2);
              pushError = this.formatPushError(rawErr);
            }
          }
        }
      }
    }

    const updatedStatus = await this.getStatus(workspacePath);
    let summaryMsg = 'Committed all changes.';

    if (pushSuccess) {
      summaryMsg = `Committed & pushed to ${targetRemote}/${currentBranch} successfully!`;
    } else if (noRemote) {
      summaryMsg = 'Committed locally (no remote repository configured).';
    } else if (remoteMismatch) {
      summaryMsg = `Committed locally. Remote mismatch notice: ${pushError}`;
    } else if (pushError) {
      summaryMsg = `Committed locally. Push notice: ${pushError}`;
    }

    return {
      success: true,
      committed: true,
      pushed: pushSuccess,
      noRemote,
      remoteMismatch,
      pushError,
      message: summaryMsg,
      commitResult,
      status: updatedStatus,
    };
  }

  async suggestCommitMessage(workspacePath) {
    try {
      const status = await this.getStatus(workspacePath);
      const changedFiles = [
        ...status.staged.map((f) => ({ path: f.path, status: f.status, type: 'staged' })),
        ...status.unstaged.map((f) => ({ path: f.path, status: f.status, type: 'unstaged' })),
        ...status.untracked.map((f) => ({ path: f.path, status: '??', type: 'untracked' })),
      ];

      // De-duplicate by path
      const uniqueFilesMap = new Map();
      changedFiles.forEach((f) => {
        if (!uniqueFilesMap.has(f.path)) {
          uniqueFilesMap.set(f.path, f);
        }
      });
      const files = Array.from(uniqueFilesMap.values());

      if (files.length === 0) {
        return {
          success: true,
          suggestedMessage: 'chore: update workspace',
          isDefault: true,
        };
      }

      // High-precision heuristic generator (deterministic, no AI calls)
      const paths = files.map((f) => f.path);
      const isAllTests = paths.every((p) => p.includes('test') || p.includes('spec') || p.startsWith('tests/'));
      const isAllDocs = paths.every((p) => p.endsWith('.md') || p.includes('docs/') || p.endsWith('.txt'));
      const isAllConfig = paths.every((p) => p.endsWith('.json') || p.endsWith('.toml') || p.endsWith('.yml') || p.endsWith('.yaml') || p.startsWith('.'));
      const isAllStyles = paths.every((p) => p.endsWith('.css') || p.endsWith('.scss') || p.endsWith('.less'));

      let type = 'feat';
      if (isAllTests) {
        type = 'test';
      } else if (isAllDocs) {
        type = 'docs';
      } else if (isAllConfig) {
        type = 'chore';
      } else if (isAllStyles) {
        type = 'style';
      } else if (files.some((f) => f.status === 'D')) {
        type = 'refactor';
      } else if (files.every((f) => f.status === 'M')) {
        type = 'fix';
      }

      // Determine scope
      let scope = '';
      const firstFile = paths[0] || '';
      const pathParts = firstFile.split('/');
      if (pathParts.length > 1) {
        scope = pathParts[0] === 'src' && pathParts.length > 2 ? pathParts[1].replace(/\.[^/.]+$/, '') : pathParts[0];
      } else if (firstFile) {
        scope = firstFile.replace(/\.[^/.]+$/, '');
      }

      // Format description
      let desc = '';
      if (files.length === 1) {
        const basename = path.basename(firstFile);
        desc = `update ${basename}`;
      } else if (files.length <= 3) {
        const names = paths.map((p) => path.basename(p)).join(', ');
        desc = `update ${names}`;
      } else {
        desc = `update ${files.length} files in ${scope || 'workspace'}`;
      }

      const scopeTag = scope && scope !== 'workspace' && scope.length < 15 ? `(${scope})` : '';
      const heuristicMsg = `${type}${scopeTag}: ${desc}`;

      return {
        success: true,
        suggestedMessage: heuristicMsg,
        source: 'heuristic',
      };
    } catch (err) {
      console.error('[GIT-MANAGER] suggestCommitMessage error:', err);
      return {
        success: false,
        suggestedMessage: 'chore: update workspace changes',
        error: err.message || String(err),
      };
    }
  }

  /**
   * Helper: Parse git raw log output with numstats and refs into normalized commit objects.
   */
  parseLogOutput(rawOutput) {
    if (!rawOutput || typeof rawOutput !== 'string') return [];
    const chunks = rawOutput.split('@@@').filter(Boolean);
    const commits = [];

    for (const chunk of chunks) {
      const lines = chunk.trim().split('\n');
      if (lines.length === 0) continue;

      const headerLine = lines[0];
      const parts = headerLine.split('\0');
      if (parts.length < 6) continue;

      const hash = parts[0] ? parts[0].trim() : '';
      const shortHash = parts[1] ? parts[1].trim() : hash.slice(0, 7);
      const author = parts[2] ? parts[2].trim() : '';
      const email = parts[3] ? parts[3].trim() : '';
      const timestamp = parts[4] ? parseInt(parts[4].trim(), 10) * 1000 : Date.now();
      const message = parts[5] ? parts[5].trim() : '';
      const parentsStr = parts[6] ? parts[6].trim() : '';
      const refsStr = parts[7] ? parts[7].trim() : '';

      const parents = parentsStr ? parentsStr.split(' ').map((p) => p.trim()).filter(Boolean) : [];
      const isMerge = parents.length > 1;

      const branchRefs = [];
      const tags = [];
      let isHead = false;

      if (refsStr) {
        const refParts = refsStr.split(',').map((r) => r.trim()).filter(Boolean);
        for (const r of refParts) {
          if (r.startsWith('tag: ')) {
            tags.push(r.slice(5).trim());
          } else if (r.startsWith('HEAD -> ')) {
            isHead = true;
            branchRefs.push(r.slice(8).trim());
          } else if (r === 'HEAD') {
            isHead = true;
          } else {
            branchRefs.push(r);
          }
        }
      }

      // Parse numstat lines
      const filesChanged = [];
      let totalInsertions = 0;
      let totalDeletions = 0;

      for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        const statParts = line.split(/\t+/);
        if (statParts.length >= 3) {
          const ins = statParts[0] === '-' ? 0 : parseInt(statParts[0], 10) || 0;
          const del = statParts[1] === '-' ? 0 : parseInt(statParts[1], 10) || 0;
          const file = statParts.slice(2).join('\t').trim();
          totalInsertions += ins;
          totalDeletions += del;
          filesChanged.push({ file, insertions: ins, deletions: del });
        }
      }

      commits.push({
        hash,
        shortHash,
        message,
        author,
        email,
        timestamp,
        date: new Date(timestamp).toISOString(),
        parents,
        branchRefs,
        tags,
        isMerge,
        isHead,
        filesChanged,
        totalFilesChanged: filesChanged.length,
        insertions: totalInsertions,
        deletions: totalDeletions,
      });
    }

    return commits;
  }

  /**
   * Computes topological lanes and parent/child branch edges for graph visualization.
   */
  computeGraphTopology(commits, currentBranch = '') {
    const activeLanes = [];
    const edges = [];
    const refs = {};

    for (let i = 0; i < commits.length; i++) {
      const commit = commits[i];
      const isCurrentHead = commit.isHead || Boolean(currentBranch && commit.branchRefs.includes(currentBranch)) || (i === 0 && !commits.some((c) => c.isHead));
      commit.isHead = isCurrentHead;

      if (commit.branchRefs.length > 0 || commit.tags.length > 0 || commit.isHead) {
        refs[commit.hash] = {
          branches: commit.branchRefs,
          tags: commit.tags,
          isHead: isCurrentHead,
        };
      }

      let laneIndex = activeLanes.indexOf(commit.hash);
      if (laneIndex === -1) {
        laneIndex = activeLanes.indexOf(null);
        if (laneIndex === -1) {
          laneIndex = activeLanes.length;
          activeLanes.push(commit.hash);
        } else {
          activeLanes[laneIndex] = commit.hash;
        }
      }

      commit.lane = laneIndex;
      activeLanes[laneIndex] = null;

      const parentLanes = [];
      if (commit.parents && commit.parents.length > 0) {
        const primaryParent = commit.parents[0];
        if (activeLanes[laneIndex] === null) {
          activeLanes[laneIndex] = primaryParent;
          parentLanes.push(laneIndex);
          edges.push({ from: commit.hash, to: primaryParent, fromLane: laneIndex, toLane: laneIndex, isMerge: false });
        } else {
          let pLane = activeLanes.indexOf(primaryParent);
          if (pLane === -1) {
            pLane = activeLanes.indexOf(null);
            if (pLane === -1) {
              pLane = activeLanes.length;
              activeLanes.push(primaryParent);
            } else {
              activeLanes[pLane] = primaryParent;
            }
          }
          parentLanes.push(pLane);
          edges.push({ from: commit.hash, to: primaryParent, fromLane: laneIndex, toLane: pLane, isMerge: false });
        }

        for (let p = 1; p < commit.parents.length; p++) {
          const mergeParent = commit.parents[p];
          let mLane = activeLanes.indexOf(mergeParent);
          if (mLane === -1) {
            mLane = activeLanes.indexOf(null);
            if (mLane === -1) {
              mLane = activeLanes.length;
              activeLanes.push(mergeParent);
            } else {
              activeLanes[mLane] = mergeParent;
            }
          }
          parentLanes.push(mLane);
          edges.push({ from: commit.hash, to: mergeParent, fromLane: laneIndex, toLane: mLane, isMerge: true });
        }
      }

      commit.parentLanes = parentLanes;
    }

    return {
      commits,
      edges,
      refs,
    };
  }

  /**
   * Retrieves visual commit history and topological graph for the repository.
   */
  async getCommitHistory(workspacePath, options = {}) {
    const isRepo = await this.isRepo(workspacePath);
    if (!isRepo) {
      return {
        success: false,
        isRepo: false,
        commits: [],
        branches: [],
        edges: [],
        refs: {},
        totalCommits: 0,
        currentBranch: '',
        error: 'Not a git repository',
      };
    }

    const git = this.getGit(workspacePath);
    const status = await this.getStatus(workspacePath);
    const branchesData = await this.getBranches(workspacePath).catch(() => ({ branches: [], all: [] }));

    const maxCount = typeof options.maxCount === 'number' ? Math.min(Math.max(options.maxCount, 1), 500) : 50;
    const args = [
      'log',
      '--format=@@@%H%x00%h%x00%an%x00%ae%x00%at%x00%s%x00%P%x00%D',
      '--numstat',
      '-n', String(maxCount),
    ];

    if (options.skip && typeof options.skip === 'number' && options.skip > 0) {
      args.push(`--skip=${options.skip}`);
    }

    if (options.file && typeof options.file === 'string' && options.file.trim()) {
      args.push('--follow', '--', options.file.trim());
    } else if (options.branch && options.branch !== 'ALL' && typeof options.branch === 'string') {
      args.push(options.branch);
    } else {
      args.push('--all');
    }

    try {
      const rawLog = await git.raw(args);
      const commits = this.parseLogOutput(rawLog);
      const graph = this.computeGraphTopology(commits, status.currentBranch);

      return {
        success: true,
        isRepo: true,
        commits: graph.commits,
        edges: graph.edges,
        refs: graph.refs,
        branches: branchesData.branches || [],
        totalCommits: commits.length,
        currentBranch: status.currentBranch,
        isDetached: status.isDetached,
      };
    } catch (err) {
      const msg = err.message || String(err);
      if (msg.includes('does not have any commits') || msg.includes('unknown revision') || msg.includes('fatal: bad default revision')) {
        return {
          success: true,
          isRepo: true,
          commits: [],
          edges: [],
          refs: {},
          branches: branchesData.branches || [],
          totalCommits: 0,
          currentBranch: status.currentBranch,
        };
      }
      return {
        success: false,
        isRepo: true,
        commits: [],
        edges: [],
        refs: {},
        branches: branchesData.branches || [],
        totalCommits: 0,
        currentBranch: status.currentBranch,
        error: msg,
      };
    }
  }

  /**
   * Retrieves detailed metadata and file breakdown for a specific commit.
   */
  async getCommitDetails(workspacePath, hash) {
    if (!hash || typeof hash !== 'string' || !/^[0-9a-fA-F]{4,40}$/.test(hash.trim())) {
      throw new Error(`Invalid commit hash: "${hash}"`);
    }

    const git = this.getGit(workspacePath);
    try {
      const rawLog = await git.raw([
        'show',
        '--format=@@@%H%x00%h%x00%an%x00%ae%x00%at%x00%s%x00%P%x00%D',
        '--numstat',
        hash.trim(),
      ]);

      const commits = this.parseLogOutput(rawLog);
      if (commits.length === 0) {
        throw new Error(`Commit not found: ${hash}`);
      }

      const commit = commits[0];
      const fullMessage = await git.raw(['log', '-1', '--format=%B', commit.hash]).catch(() => commit.message);
      commit.body = fullMessage.trim();

      return {
        success: true,
        commit,
      };
    } catch (err) {
      console.error(`[GIT-MANAGER] getCommitDetails error for ${hash}:`, err.message);
      throw err;
    }
  }

  /**
   * Retrieves full or file-specific diff for a commit against its parent.
   */
  async getCommitDiff(workspacePath, hash, file = null, parentIndex = 0) {
    if (!hash || typeof hash !== 'string') {
      throw new Error(`Invalid commit hash: "${hash}"`);
    }

    const git = this.getGit(workspacePath);
    try {
      const commitDetails = await this.getCommitDetails(workspacePath, hash);
      const commit = commitDetails.commit;

      let parentHash = null;
      if (commit.parents && commit.parents.length > parentIndex) {
        parentHash = commit.parents[parentIndex];
      }
      if (!parentHash) {
        // Empty tree hash for root commit diff
        parentHash = '4b825dc642cb6eb9a060e54bf8d69288fbee4904';
      }

      const diffArgs = ['diff', parentHash, commit.hash];
      if (file) {
        diffArgs.push('--', file);
      }

      const diff = await git.raw(diffArgs).catch(() => '');

      let originalContent = '';
      let modifiedContent = '';

      if (file) {
        try {
          if (parentHash !== '4b825dc642cb6eb9a060e54bf8d69288fbee4904') {
            originalContent = await git.raw(['show', `${parentHash}:${file}`]);
          }
        } catch (origErr) {
          originalContent = '';
        }

        try {
          modifiedContent = await git.raw(['show', `${commit.hash}:${file}`]);
        } catch (modErr) {
          modifiedContent = '';
        }
      }

      return {
        success: true,
        hash: commit.hash,
        parentHash,
        parentIndex,
        parents: commit.parents,
        file,
        diff,
        originalContent,
        modifiedContent,
      };
    } catch (err) {
      console.error(`[GIT-MANAGER] getCommitDiff error for ${hash}:`, err.message);
      throw err;
    }
  }

  /**
   * Retrieves chronological commit history touching a specific file.
   */
  async getFileHistory(workspacePath, filePath, options = {}) {
    if (!filePath || typeof filePath !== 'string') {
      throw new Error('Invalid file path for file history');
    }
    return this.getCommitHistory(workspacePath, { ...options, file: filePath });
  }

  /**
   * Parses raw unified git diff into a normalized list of discrete GitHunk objects.
   * @param {string} rawDiff - Unified git diff string
   * @param {string} filePath - Target file path
   * @param {string} currentContent - Full current file content
   * @param {string} headContent - Full original HEAD file content
   * @returns {Array<Object>} Normalized hunks
   */
  parseGitHunks(rawDiff, filePath, currentContent = '', headContent = '') {
    if (!rawDiff || typeof rawDiff !== 'string' || !rawDiff.trim()) {
      return [];
    }

    const lines = rawDiff.split('\n');
    const hunks = [];
    let hunkCounter = 0;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];
      // Match @@ -oldStart,oldLen +newStart,newLen @@
      const headerMatch = line.match(/^@@\s+-(\d+)(?:,(\d+))?\s+\+(\d+)(?:,(\d+))?\s+@@/);
      if (!headerMatch) {
        i++;
        continue;
      }

      const headStart = parseInt(headerMatch[1], 10);
      const newStart = parseInt(headerMatch[3], 10);

      let curHeadLine = headStart;
      let curNewLine = newStart;
      i++;

      let curOldLines = [];
      let curNewLines = [];
      let groupStartHeadLine = curHeadLine;
      let groupStartNewLine = curNewLine;

      const flushGroup = () => {
        if (curOldLines.length === 0 && curNewLines.length === 0) return;

        let changeType = 'MODIFIED';
        let startLine = groupStartNewLine;
        let endLine = groupStartNewLine + curNewLines.length - 1;

        if (curOldLines.length === 0 && curNewLines.length > 0) {
          changeType = 'ADDED';
          startLine = groupStartNewLine;
          endLine = groupStartNewLine + curNewLines.length - 1;
        } else if (curOldLines.length > 0 && curNewLines.length === 0) {
          changeType = 'DELETED';
          startLine = groupStartNewLine > 0 ? groupStartNewLine : 1;
          endLine = startLine;
        } else {
          changeType = 'MODIFIED';
          startLine = groupStartNewLine;
          endLine = groupStartNewLine + curNewLines.length - 1;
        }

        hunks.push({
          hunkId: `${filePath}:hunk_${hunkCounter++}`,
          startLine: Math.max(1, startLine),
          endLine: Math.max(1, endLine),
          headStartLine: groupStartHeadLine,
          headLineCount: curOldLines.length,
          changeType,
          oldLines: [...curOldLines],
          newLines: [...curNewLines],
        });

        curOldLines = [];
        curNewLines = [];
      };

      while (i < lines.length && !lines[i].startsWith('@@')) {
        const hunkLine = lines[i];
        if (hunkLine.startsWith('+')) {
          if (curOldLines.length === 0 && curNewLines.length === 0) {
            groupStartHeadLine = curHeadLine;
            groupStartNewLine = curNewLine;
          }
          curNewLines.push(hunkLine.substring(1));
          curNewLine++;
        } else if (hunkLine.startsWith('-')) {
          if (curOldLines.length === 0 && curNewLines.length === 0) {
            groupStartHeadLine = curHeadLine;
            groupStartNewLine = curNewLine;
          }
          curOldLines.push(hunkLine.substring(1));
          curHeadLine++;
        } else if (hunkLine.startsWith(' ')) {
          flushGroup();
          curHeadLine++;
          curNewLine++;
        } else if (hunkLine.startsWith('\\')) {
          // Ignore "\ No newline at end of file"
        }
        i++;
      }

      flushGroup();
    }

    return hunks;
  }

  /**
   * Retrieves Git gutter hunk model for a specific file in the active repository.
   * @param {string} workspacePath - Root workspace directory
   * @param {string} filePath - Relative or absolute path to the file
   * @returns {Promise<Object>} { isRepo, filePath, status, hunks, headContent, currentContent }
   */
  async getFileHunks(workspacePath, filePath) {
    if (!workspacePath || typeof workspacePath !== 'string') {
      return { isRepo: false, filePath, status: 'CLEAN', hunks: [] };
    }
    if (!filePath || typeof filePath !== 'string') {
      return { isRepo: false, filePath: '', status: 'CLEAN', hunks: [] };
    }

    const normWorkspace = path.resolve(workspacePath);
    const absPath = path.isAbsolute(filePath) ? path.resolve(filePath) : path.resolve(normWorkspace, filePath);
    const relPath = path.relative(normWorkspace, absPath).replace(/\\/g, '/');

    const isRepo = await this.isRepo(workspacePath);
    if (!isRepo) {
      return { isRepo: false, filePath: relPath, status: 'CLEAN', hunks: [] };
    }

    let currentContent = '';
    if (fs.existsSync(absPath)) {
      try {
        currentContent = fs.readFileSync(absPath, 'utf8');
      } catch (e) {}
    }

    const git = this.getGit(workspacePath);
    let headContent = '';
    try {
      headContent = await git.show(['HEAD:' + relPath]);
    } catch (e) {
      headContent = '';
    }

    // Check git status for the file
    const statusObj = await this.getStatus(workspacePath);
    const isUntracked = Array.isArray(statusObj.untracked) && statusObj.untracked.some((f) => (typeof f === 'string' ? f === relPath : f.path === relPath));
    const isStaged = Array.isArray(statusObj.staged) && statusObj.staged.some((f) => (typeof f === 'string' ? f === relPath : f.path === relPath));
    const isUnstaged = Array.isArray(statusObj.unstaged) && statusObj.unstaged.some((f) => (typeof f === 'string' ? f === relPath : f.path === relPath));

    if (!isUntracked && !isStaged && !isUnstaged) {
      return {
        isRepo: true,
        filePath: relPath,
        status: 'CLEAN',
        hunks: [],
        headContent,
        currentContent,
      };
    }

    if (isUntracked) {
      const currentLines = currentContent.split('\n');
      const hunks = [
        {
          hunkId: `${relPath}:hunk_0`,
          startLine: 1,
          endLine: Math.max(1, currentLines.length),
          headStartLine: 0,
          headLineCount: 0,
          changeType: 'ADDED',
          oldLines: [],
          newLines: currentLines,
        },
      ];
      return {
        isRepo: true,
        filePath: relPath,
        status: 'UNTRACKED',
        hunks,
        headContent: '',
        currentContent,
      };
    }

    // File is modified or staged: get unified diff against HEAD
    let rawDiff = '';
    try {
      rawDiff = await git.diff(['HEAD', '--', relPath]);
    } catch (e) {
      try {
        rawDiff = await git.diff(['--', relPath]);
      } catch (e2) {
        rawDiff = '';
      }
    }

    const hunks = this.parseGitHunks(rawDiff, relPath, currentContent, headContent);
    const fileStatus = isStaged && isUnstaged ? 'PARTIALLY_STAGED' : isStaged ? 'STAGED' : 'MODIFIED';

    return {
      isRepo: true,
      filePath: relPath,
      status: fileStatus,
      hunks,
      headContent,
      currentContent,
    };
  }

  /**
   * Atomically reverts a single discrete Git hunk back to its HEAD state.
   * @param {string} workspacePath
   * @param {Object} payload
   * @param {string} payload.filePath
   * @param {string} payload.hunkId
   * @param {Object} payload.hunk
   * @param {string} [payload.expectedCurrentHash]
   * @returns {Promise<Object>} Revert result metadata
   */
  async revertHunk(workspacePath, payload = {}) {
    const { filePath, hunkId, hunk, expectedCurrentHash } = payload;
    if (!workspacePath || !filePath || !hunk) {
      return { success: false, error: 'INVALID_ARGUMENTS', message: 'Missing workspace, file, or hunk payload' };
    }

    const { transactionalPatchApplier } = require('./transactionalPatchApplier');
    const absPath = transactionalPatchApplier.resolveAndValidatePath(filePath, workspacePath);

    if (!fs.existsSync(absPath)) {
      return { success: false, error: 'FILE_NOT_FOUND', message: `Target file "${filePath}" does not exist.` };
    }

    const currentContent = fs.readFileSync(absPath, 'utf8');

    // Stale baseline detection via hash
    if (expectedCurrentHash) {
      const crypto = require('crypto');
      const curHash = crypto.createHash('sha1').update(currentContent, 'utf8').digest('hex');
      if (curHash !== expectedCurrentHash) {
        return {
          success: false,
          error: 'STALE_HUNK',
          message: 'The file has been modified since the diff was calculated. Please refresh before reverting.',
        };
      }
    }

    const lines = currentContent.split('\n');
    const startIdx = hunk.startLine - 1; // 0-indexed
    const endIdx = hunk.endLine; // exclusive slice end

    // Verify hunk target lines match hunk.newLines
    if (hunk.changeType === 'ADDED' || hunk.changeType === 'MODIFIED') {
      const currentHunkLines = lines.slice(startIdx, endIdx);
      if (currentHunkLines.join('\n') !== hunk.newLines.join('\n')) {
        return {
          success: false,
          error: 'STALE_HUNK',
          message: 'Current file content does not match the target hunk lines. Hunk is stale.',
        };
      }
    }

    // Compute candidate reverted lines
    let newLines = [];
    if (hunk.changeType === 'ADDED') {
      lines.splice(startIdx, hunk.newLines.length);
      newLines = lines;
    } else if (hunk.changeType === 'MODIFIED') {
      lines.splice(startIdx, hunk.newLines.length, ...hunk.oldLines);
      newLines = lines;
    } else if (hunk.changeType === 'DELETED') {
      lines.splice(startIdx, 0, ...hunk.oldLines);
      newLines = lines;
    }

    const candidateContent = newLines.join('\n');

    // Apply atomically via TransactionalPatchApplier
    const txRes = await transactionalPatchApplier.applyTransaction(
      [{ filePath, original: currentContent, replacement: candidateContent }],
      { workspacePath, enforceFirewall: true }
    );

    if (!txRes.success) {
      return {
        success: false,
        error: txRes.error || 'TRANSACTION_FAILED',
        message: txRes.reason || 'Failed to atomically apply hunk revert.',
        rolledBack: txRes.rolledBack,
      };
    }

    return {
      success: true,
      filePath,
      revertedHunkId: hunkId || hunk.hunkId,
      newContent: candidateContent,
      transactionId: txRes.transactionId,
    };
  }
}

const gitManager = new GitManager();
gitManager.GitManager = GitManager;
gitManager.gitManager = gitManager;
module.exports = gitManager;
