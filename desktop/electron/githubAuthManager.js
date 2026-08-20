const fs = require('fs');
const path = require('path');
const http = require('http');
const crypto = require('crypto');
const simpleGit = require('simple-git');

let appModule = null;
let safeStorageModule = null;
let shellModule = null;

try {
  const electron = require('electron');
  appModule = electron.app;
  safeStorageModule = electron.safeStorage;
  shellModule = electron.shell;
} catch (e) {}

const { loadEnvConfig } = require('./envLoader');

const GITHUB_OAUTH_SCOPES = 'repo user read:org';

class GithubAuthManager {
  constructor() {
    this.authState = {
      isConnected: false,
      user: null,
      token: null,
    };
    this.workspaceAssociations = {};
    this.availableRepositories = new Map();
    this.activeAuthServer = null;
    this.loadVault();
  }

  getClientId() {
    if (process.env.GITHUB_CLIENT_ID === undefined) {
      loadEnvConfig();
    }
    return process.env.GITHUB_CLIENT_ID ? process.env.GITHUB_CLIENT_ID.trim() : '';
  }

  getClientSecret() {
    if (process.env.GITHUB_CLIENT_SECRET === undefined) {
      loadEnvConfig();
    }
    return process.env.GITHUB_CLIENT_SECRET ? process.env.GITHUB_CLIENT_SECRET.trim() : '';
  }

  hasSecureStorage() {
    try {
      return Boolean(
        safeStorageModule &&
        typeof safeStorageModule.isEncryptionAvailable === 'function' &&
        safeStorageModule.isEncryptionAvailable()
      );
    } catch (e) {
      return false;
    }
  }

  /**
   * Safe diagnostic method reporting whether OAuth Client ID is configured.
   * NEVER returns or logs the Client ID, secret, state, PKCE verifiers, or access tokens.
   */
  getOAuthConfigStatus() {
    const clientId = this.getClientId();
    return {
      isConfigured: !!clientId && !!this.getClientSecret(),
      hasClientSecret: !!this.getClientSecret(),
      hasSecureStorage: this.hasSecureStorage(),
    };
  }

  getVaultFilePath() {
    if (appModule && typeof appModule.getPath === 'function') {
      try {
        const userData = appModule.getPath('userData');
        if (userData) {
          return path.join(userData, 'nexus_github_vault.json');
        }
      } catch (e) {}
    }
    return path.join(process.cwd(), '.echo-nullity-recovery', 'nexus_github_vault.json');
  }

  loadVault() {
    const vaultPath = this.getVaultFilePath();
    try {
      if (!fs.existsSync(vaultPath)) return;
      const raw = fs.readFileSync(vaultPath, 'utf8');
      if (!raw || !raw.trim()) return;
      const vault = JSON.parse(raw);

      let token = null;
      if (vault.enc && this.hasSecureStorage()) {
        try {
          token = safeStorageModule.decryptString(Buffer.from(vault.enc, 'hex'));
        } catch (e) {}
      }

      if (token && vault.user && typeof vault.user === 'object') {
        this.authState = {
          isConnected: true,
          user: {
            username: vault.user.username,
            name: vault.user.name || vault.user.username,
            avatarUrl: vault.user.avatarUrl || null,
            htmlUrl: vault.user.htmlUrl || `https://github.com/${vault.user.username}`,
          },
          token: token || null,
        };
      }

      if (vault.workspaceAssociations && typeof vault.workspaceAssociations === 'object') {
        this.workspaceAssociations = vault.workspaceAssociations;
      }
    } catch (err) {
      console.warn('[GITHUB-AUTH] Vault load warning:', err.message);
    }
  }

  saveVault(user, token) {
    const vaultPath = this.getVaultFilePath();
    try {
      const dir = path.dirname(vaultPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }

      let vault = {
        user: user ? {
          username: user.username,
          name: user.name,
          avatarUrl: user.avatarUrl,
          htmlUrl: user.htmlUrl,
        } : null,
        workspaceAssociations: this.workspaceAssociations,
        updatedAt: Date.now(),
      };

      if (token) {
        if (!this.hasSecureStorage()) {
          throw new Error('Secure credential storage is unavailable.');
        }
        vault.enc = safeStorageModule.encryptString(token).toString('hex');
      }

      fs.writeFileSync(vaultPath, JSON.stringify(vault, null, 2), 'utf8');
    } catch (err) {
      console.error('[GITHUB-AUTH] Vault save error:', err.message);
    }
  }

  clearVault() {
    const vaultPath = this.getVaultFilePath();
    try {
      if (fs.existsSync(vaultPath)) {
        fs.unlinkSync(vaultPath);
      }
    } catch (err) {
      console.warn('[GITHUB-AUTH] Vault clear warning:', err.message);
    }
  }

  async getStatus() {
    if (!this.authState.token) {
      this.loadVault();
    }
    return {
      isConnected: this.authState.isConnected,
      user: this.authState.user,
      config: this.getOAuthConfigStatus(),
    };
  }

  generatePkcePair() {
    const codeVerifier = crypto.randomBytes(32).toString('base64url');
    const codeChallenge = crypto
      .createHash('sha256')
      .update(codeVerifier)
      .digest('base64url');
    return { codeVerifier, codeChallenge };
  }

  /** Initiates the real GitHub OAuth authorization via loopback HTTP server. */
  async connect() {
    // Production OAuth requires the client secret registered with the GitHub OAuth App.
    const clientId = this.getClientId();
    const clientSecret = this.getClientSecret();
    if (!clientId || !clientSecret) {
      return {
        success: false,
        isConnected: false,
        configured: false,
        error: 'GitHub OAuth is not configured. Add GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET to the project-root .env file, then restart NEXUS.',
      };
    }

    if (!this.hasSecureStorage()) {
      return {
        success: false,
        isConnected: false,
        error: 'Secure credential storage is unavailable. GitHub cannot be connected on this system.',
      };
    }

    if (this.activeAuthServer) {
      try { this.activeAuthServer.close(); } catch (e) {}
      this.activeAuthServer = null;
    }

    return new Promise((resolve) => {
      const state = crypto.randomBytes(32).toString('hex');
      const { codeVerifier, codeChallenge } = this.generatePkcePair();
      let isResolved = false;
      let redirectUri = '';

      const server = http.createServer(async (req, res) => {
        try {
          const reqUrl = new URL(req.url, `http://127.0.0.1`);
          const normalizedPath = reqUrl.pathname.replace(/\/$/, '') || '/';
          if (normalizedPath !== '/callback' && normalizedPath !== '/') {
            res.writeHead(404, { 'Content-Type': 'text/plain' });
            res.end('Not Found');
            return;
          }

          const code = reqUrl.searchParams.get('code');
          const returnedState = reqUrl.searchParams.get('state');
          const errorParam = reqUrl.searchParams.get('error');
          const errorDescription = reqUrl.searchParams.get('error_description');

          if (errorParam) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(this.renderHtmlResponse(false, `Authorization denied: ${errorDescription || errorParam}`));
            this.cleanupServer(server);
            if (!isResolved) {
              isResolved = true;
              resolve({ success: false, isConnected: false, error: `GitHub authorization denied: ${errorDescription || errorParam}` });
            }
            return;
          }

          if (!returnedState || returnedState !== state) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(this.renderHtmlResponse(false, 'Invalid OAuth state parameter. Security verification failed.'));
            this.cleanupServer(server);
            if (!isResolved) {
              isResolved = true;
              resolve({ success: false, isConnected: false, error: 'Invalid OAuth state parameter.' });
            }
            return;
          }

          if (!code) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(this.renderHtmlResponse(false, 'Missing authorization code from GitHub callback.'));
            this.cleanupServer(server);
            if (!isResolved) {
              isResolved = true;
              resolve({ success: false, isConnected: false, error: 'Missing authorization code.' });
            }
            return;
          }

          // Exchange authorization code for GitHub Access Token with PKCE code_verifier
          const tokenBody = {
            client_id: clientId,
            client_secret: clientSecret,
            code,
            redirect_uri: redirectUri,
            state,
            code_verifier: codeVerifier,
          };

          const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json',
              'User-Agent': 'NEXUS-Workbench-App',
            },
            body: JSON.stringify(tokenBody),
          });

          const tokenData = await tokenRes.json();
          if (!tokenData || !tokenData.access_token) {
            const errDetail = tokenData.error_description || tokenData.error || 'Token exchange failed';
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(this.renderHtmlResponse(false, `Token Exchange Error: ${errDetail}`));
            this.cleanupServer(server);
            if (!isResolved) {
              isResolved = true;
              resolve({ success: false, isConnected: false, error: `Token exchange failed: ${errDetail}` });
            }
            return;
          }

          const accessToken = tokenData.access_token;

          // Fetch authenticated user's REAL GitHub profile
          const userRes = await fetch('https://api.github.com/user', {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'User-Agent': 'NEXUS-Workbench-App',
              'Accept': 'application/vnd.github.v3+json',
            },
          });

          if (!userRes.ok) {
            res.writeHead(400, { 'Content-Type': 'text/html' });
            res.end(this.renderHtmlResponse(false, 'Failed to fetch user profile from GitHub API.'));
            this.cleanupServer(server);
            if (!isResolved) {
              isResolved = true;
              resolve({ success: false, isConnected: false, error: 'Failed to fetch GitHub profile.' });
            }
            return;
          }

          const userData = await userRes.json();
          const user = {
            username: userData.login,
            name: userData.name || userData.login,
            avatarUrl: userData.avatar_url,
            htmlUrl: userData.html_url || `https://github.com/${userData.login}`,
          };

          this.authState = {
            isConnected: true,
            user,
            token: accessToken,
          };
          this.saveVault(user, accessToken);

          res.writeHead(200, { 'Content-Type': 'text/html' });
          res.end(this.renderHtmlResponse(true, `Successfully connected as @${userData.login}`));
          this.cleanupServer(server);

          if (!isResolved) {
            isResolved = true;
            resolve({ success: true, isConnected: true, user });
          }
        } catch (err) {
          console.error('[GITHUB-AUTH] OAuth callback error:', err.message);
          res.writeHead(500, { 'Content-Type': 'text/html' });
          res.end(this.renderHtmlResponse(false, `Authentication Error: ${err.message}`));
          this.cleanupServer(server);
          if (!isResolved) {
            isResolved = true;
            resolve({ success: false, isConnected: false, error: err.message });
          }
        }
      });

      // Listen on ephemeral local port
      server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        redirectUri = `http://127.0.0.1:${port}/callback`;
        const authUrl = `https://github.com/login/oauth/authorize?client_id=${encodeURIComponent(clientId)}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(GITHUB_OAUTH_SCOPES)}&state=${encodeURIComponent(state)}&code_challenge=${encodeURIComponent(codeChallenge)}&code_challenge_method=S256`;

        this.activeAuthServer = server;

        // Open the user's default external browser to GitHub authorization.
        if (shellModule && typeof shellModule.openExternal === 'function') {
          shellModule.openExternal(authUrl).catch((err) => {
            this.cleanupServer(server);
            if (!isResolved) {
              isResolved = true;
              resolve({ success: false, isConnected: false, error: `Failed to open GitHub authorization page: ${err.message}` });
            }
          });
        } else {
          this.cleanupServer(server);
          if (!isResolved) {
            isResolved = true;
            resolve({ success: false, isConnected: false, error: 'Electron shell is unavailable to open GitHub authorization.' });
          }
        }
      });

      // 5-Minute Authorization Timeout
      const timeoutTimer = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          this.cleanupServer(server);
          resolve({ success: false, isConnected: false, error: 'Timeout waiting for GitHub authorization.' });
        }
      }, 300000);

      server.on('close', () => {
        clearTimeout(timeoutTimer);
      });
    });
  }

  cleanupServer(server) {
    try {
      if (server) server.close();
    } catch (e) {}
    if (this.activeAuthServer === server) {
      this.activeAuthServer = null;
    }
  }

  renderHtmlResponse(success, message) {
    const title = success ? 'NEXUS - GitHub Connected' : 'NEXUS - Connection Failed';
    const accentColor = success ? '#22d3ee' : '#f43f5e';
    const bgBadge = success ? 'rgba(34, 211, 238, 0.15)' : 'rgba(244, 63, 94, 0.15)';

    return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <style>
    body { background-color: #09090e; color: #e4e4e7; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, monospace; display: flex; items-center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background-color: #111118; border: 1px solid #232334; padding: 40px; border-radius: 20px; text-align: center; max-width: 420px; box-shadow: 0 20px 40px rgba(0,0,0,0.6); }
    .badge { display: inline-block; padding: 6px 14px; background: ${bgBadge}; color: ${accentColor}; border: 1px solid ${accentColor}; border-radius: 20px; font-size: 12px; font-weight: bold; margin-bottom: 16px; font-family: monospace; }
    h1 { font-size: 20px; font-weight: bold; margin: 0 0 10px 0; color: #ffffff; }
    p { font-size: 13px; color: #a1a1aa; line-height: 1.5; margin: 0 0 20px 0; }
    .sub { font-size: 11px; color: #71717a; }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">${success ? '✓ AUTHORIZATION SUCCESSFUL' : '✕ AUTHORIZATION FAILED'}</div>
    <h1>${success ? 'Return to NEXUS' : 'Authentication Error'}</h1>
    <p>${message}</p>
    <div class="sub">You may now close this browser window.</div>
  </div>
  <script>setTimeout(function() { window.close(); }, 4000);</script>
</body>
</html>`;
  }

  async disconnect() {
    this.clearVault();
    this.authState = {
      isConnected: false,
      user: null,
      token: null,
    };
    this.workspaceAssociations = {};
    return {
      success: true,
      isConnected: false,
      user: null,
    };
  }

  async listRepositories() {
    if (!this.authState.isConnected) {
      return {
        success: false,
        error: 'Not authenticated with GitHub',
        repositories: [],
      };
    }

    if (this.authState.token && typeof fetch !== 'undefined') {
      try {
        const res = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
          headers: {
            'Authorization': `Bearer ${this.authState.token}`,
            'User-Agent': 'NEXUS-Workbench-App',
            'Accept': 'application/vnd.github.v3+json',
          },
        });
        if (res.ok) {
          const repos = await res.json();
          if (Array.isArray(repos)) {
            const mapped = repos.map((r) => ({
              id: String(r.id),
              name: r.name,
              owner: r.owner?.login || this.authState.user?.username || 'user',
              fullName: r.full_name || `${r.owner?.login || 'user'}/${r.name}`,
              private: !!r.private,
              htmlUrl: r.html_url,
              cloneUrl: r.clone_url || `${r.html_url}.git`,
              defaultBranch: r.default_branch || 'main',
            }));
            this.availableRepositories = new Map(mapped.map((repo) => [repo.id, repo]));
            return {
              success: true,
              repositories: mapped,
            };
          }
        }
      } catch (e) {
        console.warn('[GITHUB-AUTH] Error fetching repositories from GitHub API:', e.message);
      }
    }

    return {
      success: false,
      error: 'Unable to load repositories from GitHub. Please reconnect and try again.',
      repositories: [],
    };
  }

  async getSelectedRepository(workspacePath) {
    if (!workspacePath || typeof workspacePath !== 'string') {
      return { success: false, repo: null };
    }
    const record = this.workspaceAssociations[workspacePath];
    return {
      success: true,
      repo: record ? record.repo : null,
      remoteName: record ? record.remoteName : null,
    };
  }

  async associateRepository(workspacePath, repo) {
    if (!workspacePath || typeof workspacePath !== 'string' || !repo) {
      return { success: false, error: 'Invalid workspace path or repository payload' };
    }

    if (!this.authState.isConnected || !this.authState.token) {
      return { success: false, error: 'Not authenticated with GitHub' };
    }

    const authorizedRepo = this.availableRepositories.get(String(repo.id));
    if (!authorizedRepo || authorizedRepo.fullName !== repo.fullName) {
      return { success: false, error: 'Select a repository from the current GitHub repository list before associating it.' };
    }

    repo = authorizedRepo;

    let remoteName = 'origin';
    let remoteStatus = 'Associated repository with workspace';

    try {
      const git = simpleGit({ baseDir: workspacePath, maxConcurrentProcesses: 4 });
      const isRepo = await git.checkIsRepo().catch(() => false);
      if (!isRepo) {
        await git.init().catch((e) => console.warn('[GITHUB-AUTH] Git init notice:', e.message));
      }

      let existingRemotes = [];
      try {
        existingRemotes = await git.getRemotes(true);
      } catch (e) {
        existingRemotes = [];
      }

      const targetFullName = (repo.fullName || `${repo.owner}/${repo.name}`).toLowerCase();
      const targetCloneUrl = (repo.cloneUrl || '').toLowerCase();
      const targetHtmlUrl = (repo.htmlUrl || '').toLowerCase();

      let matchingRemote = null;

      for (const r of existingRemotes) {
        const fetchUrl = (r.refs?.fetch || '').toLowerCase();
        const pushUrl = (r.refs?.push || '').toLowerCase();

        if (
          fetchUrl.includes(targetFullName) ||
          pushUrl.includes(targetFullName) ||
          (targetCloneUrl && (fetchUrl.includes(targetCloneUrl) || pushUrl.includes(targetCloneUrl))) ||
          (targetHtmlUrl && (fetchUrl.includes(targetHtmlUrl) || pushUrl.includes(targetHtmlUrl)))
        ) {
          matchingRemote = r;
          break;
        }
      }

      if (matchingRemote) {
        remoteName = matchingRemote.name;
        remoteStatus = `Recognized existing remote "${remoteName}"`;
      } else {
        const originExists = existingRemotes.some((r) => r.name === 'origin');
        if (originExists) {
          await git.remote(['set-url', 'origin', repo.cloneUrl || repo.htmlUrl]).catch((e) => console.warn('[GITHUB-AUTH] Set URL notice:', e.message));
          remoteStatus = 'Updated existing origin remote URL';
        } else {
          await git.addRemote('origin', repo.cloneUrl || repo.htmlUrl).catch((e) => console.warn('[GITHUB-AUTH] Add remote notice:', e.message));
          remoteStatus = 'Added origin remote';
        }
      }

      const verifiedRemotes = await git.getRemotes(true);
      const verifiedRemote = verifiedRemotes.find((remote) => remote.name === remoteName);
      const verifiedFetchUrl = (verifiedRemote?.refs?.fetch || '').toLowerCase();
      const verifiedPushUrl = (verifiedRemote?.refs?.push || '').toLowerCase();
      const isVerified = Boolean(
        verifiedRemote && (
          verifiedFetchUrl.includes(targetFullName) ||
          verifiedPushUrl.includes(targetFullName) ||
          (targetCloneUrl && (verifiedFetchUrl.includes(targetCloneUrl) || verifiedPushUrl.includes(targetCloneUrl))) ||
          (targetHtmlUrl && (verifiedFetchUrl.includes(targetHtmlUrl) || verifiedPushUrl.includes(targetHtmlUrl)))
        )
      );

      if (!isVerified) {
        return { success: false, error: 'Unable to verify the workspace origin against the selected GitHub repository.' };
      }
    } catch (gitErr) {
      console.warn('[GITHUB-AUTH] Git association error:', gitErr.message);
      return { success: false, error: `Unable to configure the workspace origin: ${gitErr.message}` };
    }

    this.workspaceAssociations[workspacePath] = {
      repo: {
        id: String(repo.id),
        name: repo.name,
        owner: repo.owner,
        fullName: repo.fullName || `${repo.owner}/${repo.name}`,
        private: !!repo.private,
        htmlUrl: repo.htmlUrl,
        cloneUrl: repo.cloneUrl,
        defaultBranch: repo.defaultBranch || 'main',
      },
      remoteName,
      associatedAt: Date.now(),
    };

    this.saveVault(this.authState.user, this.authState.token);

    return {
      success: true,
      repo: this.workspaceAssociations[workspacePath].repo,
      remoteName,
      remoteStatus,
    };
  }
}

const githubAuthManager = new GithubAuthManager();
module.exports = { githubAuthManager, GithubAuthManager };
