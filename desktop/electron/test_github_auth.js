/**
 * Verifies production GitHub OAuth guardrails without creating credentials,
 * users, repositories, or network-based OAuth sessions.
 */
const assert = require('assert');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { GithubAuthManager } = require('./githubAuthManager');
const { getProjectRoot, loadEnvConfig } = require('./envLoader');

async function runGithubAuthTestSuite() {
  console.log('[TEST SUITE] Starting NEXUS GitHub production guardrail verification...');
  const manager = new GithubAuthManager();
  await manager.disconnect();

  const envLoad = loadEnvConfig();
  assert.strictEqual(envLoad.envPath, path.join(getProjectRoot(), '.env'));
  assert.strictEqual(typeof envLoad.found, 'boolean');
  assert.strictEqual(typeof envLoad.loaded, 'boolean');
  console.log('✓ TEST 1 PASSED: OAuth environment resolves only from the absolute project-root .env path.');

  const { codeVerifier, codeChallenge } = manager.generatePkcePair();
  const expectedChallenge = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
  assert.strictEqual(codeChallenge, expectedChallenge);
  console.log('✓ TEST 2 PASSED: PKCE S256 challenge generation verified.');

  const priorClientId = process.env.GITHUB_CLIENT_ID;
  const priorClientSecret = process.env.GITHUB_CLIENT_SECRET;
  process.env.GITHUB_CLIENT_ID = '';
  process.env.GITHUB_CLIENT_SECRET = '';

  const missingConfig = await manager.connect();
  assert.strictEqual(missingConfig.success, false);
  assert.strictEqual(missingConfig.configured, false);
  assert.ok(missingConfig.error.includes('GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET'));

  const configStatus = manager.getOAuthConfigStatus();
  assert.strictEqual(configStatus.clientId, undefined);
  assert.strictEqual(configStatus.clientSecret, undefined);
  assert.strictEqual(configStatus.token, undefined);
  console.log('✓ TEST 3 PASSED: Missing configuration is handled without exposing credential values.');

  const repositories = await manager.listRepositories();
  assert.strictEqual(repositories.success, false);
  assert.deepStrictEqual(repositories.repositories, []);
  console.log('✓ TEST 4 PASSED: Unauthenticated repository loading returns no synthetic repositories.');

  const invalidAssociation = await manager.associateRepository('', null);
  assert.strictEqual(invalidAssociation.success, false);
  console.log('✓ TEST 5 PASSED: Repository association rejects invalid data.');

  const mainSource = fs.readFileSync(path.join(__dirname, 'main.js'), 'utf8');
  assert.ok(mainSource.indexOf('loadEnvConfig();') < mainSource.indexOf("require('./githubAuthManager')"));
  assert.strictEqual(manager.connect.length, 0);
  console.log('✓ TEST 6 PASSED: Environment load precedes auth initialization and OAuth accepts no renderer payload.');

  if (priorClientId === undefined) delete process.env.GITHUB_CLIENT_ID;
  else process.env.GITHUB_CLIENT_ID = priorClientId;
  if (priorClientSecret === undefined) delete process.env.GITHUB_CLIENT_SECRET;
  else process.env.GITHUB_CLIENT_SECRET = priorClientSecret;

  console.log('ALL GITHUB PRODUCTION GUARDRAIL TESTS PASSED.');
}

runGithubAuthTestSuite().catch((err) => {
  console.error('GitHub auth test failed:', err);
  process.exit(1);
});
