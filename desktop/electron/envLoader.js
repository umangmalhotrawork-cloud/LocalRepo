const fs = require('fs');
const path = require('path');

let appModule = null;
try {
  appModule = require('electron').app;
} catch (e) {}

/**
 * Resolves the project root directory containing package.json and .env.
 */
function getProjectRoot() {
  const moduleRoot = path.resolve(__dirname, '..', '..');

  try {
    const electronAppPath = appModule && typeof appModule.getAppPath === 'function'
      ? appModule.getAppPath()
      : '';

    if (electronAppPath && fs.existsSync(path.join(electronAppPath, 'package.json'))) {
      return path.resolve(electronAppPath);
    }
  } catch (e) {}

  return moduleRoot;
}

/**
 * Parses .env file content without external dependencies.
 */
function parseEnvContent(content) {
  const result = {};
  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    let line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    if (line.startsWith('export ')) line = line.substring(7).trim();
    const eqIdx = line.indexOf('=');
    if (eqIdx === -1) continue;
    const key = line.substring(0, eqIdx).trim();
    let val = line.substring(eqIdx + 1).trim();

    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    } else {
      const hashIdx = val.indexOf('#');
      if (hashIdx !== -1) val = val.substring(0, hashIdx).trim();
    }

    if (key) {
      result[key] = val;
    }
  }
  return result;
}

/**
 * Loads the project-root .env file into process.env before any OAuth operations.
 */
function loadEnvConfig({ projectRoot = getProjectRoot(), override = false } = {}) {
  const envPath = path.resolve(projectRoot, '.env');
  const found = fs.existsSync(envPath);
  let loaded = false;

  if (found) {
    try {
      const content = fs.readFileSync(envPath, 'utf8');
      const parsed = parseEnvContent(content);
      for (const [k, v] of Object.entries(parsed)) {
        if (override || !(k in process.env)) {
          process.env[k] = v;
        }
      }
      loaded = true;
    } catch (e) {
      loaded = false;
    }
  }

  return { envPath, found, loaded };
}

function isGitHubClientIdConfigured() {
  return Boolean((process.env.GITHUB_CLIENT_ID || '').trim());
}

module.exports = { getProjectRoot, loadEnvConfig, isGitHubClientIdConfigured };
