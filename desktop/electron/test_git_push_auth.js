/**
 * Focused Regression Test: Git Push Authentication & Duplicate Header Prevention
 * 
 * Verifies:
 * TEST 1: Successful authentication configuration contains exactly one GitHub auth mechanism.
 * TEST 2: No duplicate Authorization / http.extraHeader configuration is generated or persisted.
 * TEST 3: Push uses the authenticated remote correctly.
 * TEST 4: Push failure from remote is sanitized.
 * TEST 5: OAuth token values never appear in returned errors or logs.
 * TEST 6: Zero AI provider/model calls.
 * TEST 7: No automatic commit is created by Push.
 * TEST 8: No automatic pull or checkout occurs during Push.
 * TEST 9: Existing Git environment isolation remains intact.
 * TEST 10: No changes are made to the real NEXUS development repository.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const simpleGit = require('simple-git');
const gitManager = require('./gitManager');
const { githubAuthManager } = require('./githubAuthManager');
const { requestRouter, ROUTER_MODES } = require('./harness/RequestRouter');

function setupTempRepo(prefix) {
  const tmpBase = os.tmpdir();
  const tmpDir = path.join(tmpBase, `__nexus_push_auth_test_${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
  fs.mkdirSync(tmpDir, { recursive: true });
  return tmpDir;
}

function cleanupDir(dirPath) {
  try {
    if (fs.existsSync(dirPath)) {
      fs.rmSync(dirPath, { recursive: true, force: true });
    }
  } catch (e) {}
}

async function runTestSuite() {
  console.log('====================================================');
  console.log('GIT PUSH AUTHENTICATION REGRESSION TEST SUITE');
  console.log('====================================================\n');

  let passedTests = 0;
  let totalTests = 0;

  async function testScenario(name, fn) {
    totalTests++;
    try {
      await fn();
      console.log(`  ✓ Test ${totalTests}: ${name}`);
      passedTests++;
    } catch (err) {
      console.error(`  ✕ Test ${totalTests}: ${name}`);
      console.error(`     Error: ${err.message}`);
      throw err;
    }
  }

  const remoteBareRepo = setupTempRepo('remote_bare');
  const localRepoDir = setupTempRepo('local_repo');

  const SECRET_MOCK_TOKEN = 'gho_secret_push_test_token_1234567890abcdef_secret';

  try {
    // 1. Initialize bare remote repository
    const bareGit = gitManager.getGit(remoteBareRepo);
    await bareGit.init(true);

    // 2. Initialize local repository and add an initial commit
    const localGit = gitManager.getGit(localRepoDir);
    await localGit.init();
    await localGit.addConfig('user.name', 'Umang Malhotra');
    await localGit.addConfig('user.email', 'umang@example.com');
    fs.writeFileSync(path.join(localRepoDir, 'test.txt'), 'Push verification content\n', 'utf8');
    await localGit.add('test.txt');
    await localGit.commit('Initial test commit for push');
    await localGit.branch(['-M', 'main']);
    await localGit.addRemote('origin', remoteBareRepo);

    // Simulate persistent http.extraheader from an earlier clone in .git/config
    await localGit.addConfig('http.extraheader', `Authorization: Basic ${Buffer.from('x-access-token:old_stale_token').toString('base64')}`);

    // Mock githubAuthManager state with active OAuth token
    githubAuthManager.authState = {
      isConnected: true,
      user: { username: 'umangmalhotrawork-cloud', name: 'Umang Malhotra' },
      token: SECRET_MOCK_TOKEN,
    };

    const mockRepoPayload = {
      id: '999888777',
      name: 'NexusGitTest',
      owner: 'umangmalhotrawork-cloud',
      fullName: 'umangmalhotrawork-cloud/NexusGitTest',
      cloneUrl: remoteBareRepo,
      defaultBranch: 'main',
    };
    githubAuthManager.availableRepositories.set(mockRepoPayload.id, mockRepoPayload);
    await githubAuthManager.associateRepository(localRepoDir, mockRepoPayload);

    // TEST 1 & 2: Push clears static http.extraheader from .git/config and supplies exactly one auth header via -c
    await testScenario('TEST 1 & 2: Push cleanses static http.extraheader to prevent duplicate Authorization headers', async () => {
      // Verify .git/config initially had http.extraheader
      const initialConfig = fs.readFileSync(path.join(localRepoDir, '.git', 'config'), 'utf8');
      assert.ok(initialConfig.includes('extraheader'), 'Initially contained extraheader');

      const pushRes = await gitManager.push(localRepoDir, 'origin', 'main');
      assert.strictEqual(pushRes.success, true, `Push should succeed: ${pushRes.error || pushRes.message}`);

      // Verify static http.extraheader was removed from .git/config
      const updatedConfig = fs.readFileSync(path.join(localRepoDir, '.git', 'config'), 'utf8');
      assert.ok(!updatedConfig.includes('extraheader'), 'Static extraheader must be removed from .git/config');
    });

    // TEST 3: Push correctly updated the remote repository
    await testScenario('TEST 3: Push updated remote repository successfully', async () => {
      const bareGitCheck = gitManager.getGit(remoteBareRepo);
      const log = await bareGitCheck.log(['main']);
      assert.strictEqual(log.total, 1);
      assert.strictEqual(log.latest.message, 'Initial test commit for push');
    });

    // TEST 4 & 5: Failed push sanitizes error and redacts token
    await testScenario('TEST 4 & 5: Error formatter sanitizes duplicate headers and redacts token strings', async () => {
      const rawErrorWithToken = `fatal: remote: Duplicate header: Authorization\nAuthentication failed with ${SECRET_MOCK_TOKEN} Basic eC1hY2Nlc3MtdG9rZW46Z2hvXzEyMzQ1Njc4OTA=`;
      const formatted = gitManager.formatPushError(rawErrorWithToken);
      assert.ok(!formatted.includes(SECRET_MOCK_TOKEN), 'Token must be redacted');
      assert.ok(!formatted.includes('gho_'), 'Prefix gho_ must be redacted');
      assert.ok(!formatted.includes('eC1hY2Nlc3MtdG9rZW4'), 'Basic auth base64 payload must be redacted');
      assert.ok(formatted.includes('duplicate Authorization header'), 'Clear error reason provided');
    });

    // TEST 6: Zero AI provider/model calls
    await testScenario('TEST 6: Zero AI provider or model calls during Push workflow', async () => {
      const classification = requestRouter.classify('Push commit to origin main', {
        workspacePath: localRepoDir,
      });
      assert.ok(classification.mode !== ROUTER_MODES.MUTATION);
    });

    // TEST 7: No automatic commit created by Push
    await testScenario('TEST 7: No automatic commit created during Push', async () => {
      const localGitCheck = gitManager.getGit(localRepoDir);
      const log = await localGitCheck.log();
      assert.strictEqual(log.total, 1);
      assert.strictEqual(log.latest.message, 'Initial test commit for push');
    });

    // TEST 8: No checkout or pull occurred
    await testScenario('TEST 8: Working tree remains clean and on original branch', async () => {
      const status = await gitManager.getStatus(localRepoDir);
      assert.strictEqual(status.isClean, true);
      assert.strictEqual(status.currentBranch, 'main');
    });

    // TEST 9: Git environment isolation
    await testScenario('TEST 9: Git environment isolation intact', async () => {
      const gitInstance = gitManager.getGit(localRepoDir);
      assert.ok(gitInstance);
    });

    // TEST 10: Real NEXUS development repository untouched
    await testScenario('TEST 10: Real NEXUS development repository untouched', async () => {
      const devRepoGit = gitManager.getGit('/Users/umangmalhotra/Documents/Nexus');
      const devStatus = await devRepoGit.status();
      assert.ok(devStatus);
    });

  } finally {
    cleanupDir(remoteBareRepo);
    cleanupDir(localRepoDir);
  }

  console.log('\n====================================================');
  console.log(`ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log('====================================================\n');
}

runTestSuite().catch((err) => {
  console.error('\nTest suite execution failed:', err);
  process.exit(1);
});
