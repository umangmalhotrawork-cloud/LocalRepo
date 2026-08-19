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

  async push(workspacePath, remote = 'origin', branch) {
    try {
      const git = this.getGit(workspacePath);
      const remotes = await git.getRemotes();
      if (!remotes || remotes.length === 0) {
        return {
          success: false,
          noRemote: true,
          message: 'No remote repository configured',
          status: await this.getStatus(workspacePath),
        };
      }

      let targetBranch = branch;
      if (!targetBranch) {
        const st = await git.status();
        targetBranch = st.current || 'main';
      }

      let pushResult;
      try {
        pushResult = await git.push(remote, targetBranch, ['--set-upstream']);
      } catch (upstreamErr) {
        pushResult = await git.push();
      }

      const status = await this.getStatus(workspacePath);
      return {
        success: true,
        result: pushResult,
        message: `Pushed to ${remote}/${targetBranch}`,
        status,
      };
    } catch (err) {
      console.error('[GIT-MANAGER] push error:', err);
      return {
        success: false,
        error: err.message || String(err),
        message: `Push failed: ${err.message || String(err)}`,
        status: await this.getStatus(workspacePath),
      };
    }
  }

  async commitAndPush(workspacePath, message) {
    if (!message || !message.trim()) {
      throw new Error('Commit message cannot be empty');
    }

    const git = this.getGit(workspacePath);
    // 1. Stage all working tree & untracked changes
    await git.add('.');

    // 2. Create commit
    const commitResult = await git.commit(message.trim());

    // 3. Attempt push if remotes exist
    let pushSuccess = false;
    let pushError = null;
    let noRemote = false;

    try {
      const remotes = await git.getRemotes();
      if (!remotes || remotes.length === 0) {
        noRemote = true;
      } else {
        const st = await git.status();
        const currentBranch = st.current || 'main';
        try {
          await git.push('origin', currentBranch, ['--set-upstream']);
          pushSuccess = true;
        } catch (pErr1) {
          await git.push();
          pushSuccess = true;
        }
      }
    } catch (pushErr) {
      pushError = pushErr.message || String(pushErr);
      console.warn('[GIT-MANAGER] push warning during commitAndPush:', pushError);
    }

    const status = await this.getStatus(workspacePath);
    let summaryMsg = 'Committed all changes.';
    if (pushSuccess) {
      summaryMsg = 'Committed & pushed to remote successfully!';
    } else if (noRemote) {
      summaryMsg = 'Committed locally (no remote repository configured).';
    } else if (pushError) {
      summaryMsg = `Committed locally. Push notice: ${pushError}`;
    }

    return {
      success: true,
      committed: true,
      pushed: pushSuccess,
      noRemote,
      pushError,
      message: summaryMsg,
      commitResult,
      status,
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

      // Try AI-powered suggestion if available
      try {
        let aiRouter = null;
        try {
          const routerMod = require('./ai/AIProviderRouter');
          aiRouter = routerMod.aiRouter;
        } catch (e) {}

        if (aiRouter && aiRouter.getActiveProvider && aiRouter.getActiveProvider().isConfigured) {
          const fileSummaryText = files.slice(0, 10).map((f) => `- [${f.status}] ${f.path}`).join('\n');
          let diffSnippet = '';
          try {
            const git = this.getGit(workspacePath);
            diffSnippet = (await git.diff(['--stat'])).slice(0, 500);
          } catch (dErr) {}

          const prompt = `Generate a single concise, conventional git commit message (under 60 chars) summarizing these changes. Do NOT include markdown blocks or extra explanation. Just the message, e.g. "feat(cart): update tax calculation" or "fix(auth): resolve token expiration".\nFiles:\n${fileSummaryText}\n${diffSnippet ? `Diff stat:\n${diffSnippet}` : ''}`;
          const aiRes = await aiRouter.execute({
            task: prompt,
            model: 'fast',
            systemPrompt: 'You are an expert software engineer generating conventional commit messages.',
          });

          if (aiRes && aiRes.response) {
            let cleanMsg = aiRes.response.trim().replace(/^["'`]|["'`]$/g, '').split('\n')[0].trim();
            if (cleanMsg.length > 5 && cleanMsg.length < 90) {
              return {
                success: true,
                suggestedMessage: cleanMsg,
                source: 'ai',
              };
            }
          }
        }
      } catch (aiErr) {
        console.warn('[GIT-MANAGER] AI commit suggestion fallback to heuristic:', aiErr.message);
      }

      // High-precision heuristic generator
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
}

const gitManager = new GitManager();
module.exports = gitManager;
