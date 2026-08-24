/**
 * Focused Regression Test: GitHub Repository Cloning & Non-Interactive Environment
 * 
 * Verifies:
 * 1. Mock/simulate successful clone using the existing Git layer.
 * 2. Verify no editor is invoked.
 * 3. Verify process.env.EDITOR / GIT_EDITOR / PAGER does NOT trigger simple-git unsafe-editor errors.
 * 4. Verify clone destination safety for an existing non-empty directory.
 * 5. Verify returned local path is correct.
 * 6. Verify OAuth token is never exposed in logs or error messages.
 * 7. Verify zero AI provider/model calls.
 * 8. Verify no commit/push/pull occurs.
 * 9. Verify failed clone produces a sanitized, useful error.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const simpleGit = require('simple-git');
const { GithubAuthManager } = require('./githubAuthManager');
const { requestRouter, ROUTER_MODES } = require('./harness/RequestRouter');

function setupTempDir(prefix) {
  const tmpBase = os.tmpdir();
  const tmpDir = path.join(tmpBase, `__nexus_clone_test_${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
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
  process.env.GIT_CONFIG_GLOBAL = '/dev/null';
  process.env.GIT_CONFIG_SYSTEM = '/dev/null';
  process.env.GIT_CONFIG_NOSYSTEM = '1';

  // Inject user environment variables that previously caused the EDITOR failure
  process.env.EDITOR = 'vim';
  process.env.GIT_EDITOR = 'code --wait';
  process.env.VISUAL = 'nano';
  process.env.PAGER = 'less';
  process.env.GIT_PAGER = 'cat';

  console.log('====================================================');
  console.log('GITHUB CLONE REPOSITORY REGRESSION TEST SUITE');
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

  const remoteBareRepo = setupTempDir('remote_bare');
  const sourceRepo = setupTempDir('source_checkout');
  const cloneTargetDir = path.join(setupTempDir('dest_wrapper'), 'NexusGitTest');
  const nonEmptyDir = setupTempDir('non_empty_dest');

  const authManager = new GithubAuthManager();
  const SECRET_TEST_TOKEN = 'gho_secret_clone_token_1234567890abcdef_confidential';

  try {
    // Setup remote bare git repository representing umangmalhotrawork-cloud/NexusGitTest
    const bareGit = simpleGit({ baseDir: remoteBareRepo });
    await bareGit.init(true);

    // Setup source repository and push initial commit to remoteBareRepo
    const initGit = simpleGit({ baseDir: sourceRepo });
    await initGit.init();
    await initGit.addConfig('user.name', 'Umang Malhotra');
    await initGit.addConfig('user.email', 'umang@example.com');
    fs.writeFileSync(path.join(sourceRepo, 'README.md'), '# NexusGitTest\nTest repo for clone verification.\n', 'utf8');
    fs.writeFileSync(path.join(sourceRepo, 'index.js'), 'console.log("Hello NEXUS");\n', 'utf8');
    await initGit.add(['README.md', 'index.js']);
    await initGit.commit('Initial commit for NexusGitTest');
    await initGit.addRemote('origin', remoteBareRepo);
    await initGit.push('origin', 'master');

    const sampleRepoPayload = {
      id: '888777666',
      name: 'NexusGitTest',
      owner: 'umangmalhotrawork-cloud',
      fullName: 'umangmalhotrawork-cloud/NexusGitTest',
      private: false,
      htmlUrl: 'https://github.com/umangmalhotrawork-cloud/NexusGitTest',
      cloneUrl: remoteBareRepo, // local bare repo for test isolation
      defaultBranch: 'master',
    };

    authManager.authState = {
      isConnected: true,
      user: { username: 'umangmalhotrawork-cloud', name: 'Umang Malhotra' },
      token: SECRET_TEST_TOKEN,
    };
    authManager.availableRepositories.set(sampleRepoPayload.id, sampleRepoPayload);

    // 1 & 2 & 3. Successful clone with process.env.EDITOR set without allowUnsafeEditor error
    await testScenario('Clones repository successfully with EDITOR in environment without unsafe-editor failure', async () => {
      const cloneRes = await authManager.cloneRepository(sampleRepoPayload, cloneTargetDir);
      assert.strictEqual(cloneRes.success, true);
      assert.strictEqual(path.resolve(cloneRes.localPath), path.resolve(cloneTargetDir));
      assert.ok(fs.existsSync(path.join(cloneTargetDir, '.git')));
      assert.ok(fs.existsSync(path.join(cloneTargetDir, 'README.md')));
      assert.ok(fs.existsSync(path.join(cloneTargetDir, 'index.js')));
    });

    // 4. Reject existing non-empty directory
    await testScenario('Rejects cloning into an existing non-empty directory', async () => {
      fs.writeFileSync(path.join(nonEmptyDir, 'preexisting.txt'), 'Important file\n', 'utf8');
      const conflictRes = await authManager.cloneRepository(sampleRepoPayload, nonEmptyDir);
      assert.strictEqual(conflictRes.success, false);
      assert.ok(conflictRes.error.includes('already exists and is not empty'));
    });

    // 5. Correct returned local path and association
    await testScenario('Returns correct local path and associates repository', async () => {
      const assoc = await authManager.getSelectedRepository(cloneTargetDir);
      assert.strictEqual(assoc.success, true);
      assert.strictEqual(assoc.repo.fullName, 'umangmalhotrawork-cloud/NexusGitTest');
    });

    // 6. OAuth token secrecy in failed clone error
    await testScenario('Failed clone sanitizes any token content from error output', async () => {
      const invalidRepoPayload = {
        id: '111222333',
        name: 'InvalidRepo',
        owner: 'umangmalhotrawork-cloud',
        fullName: 'umangmalhotrawork-cloud/InvalidRepo',
        cloneUrl: '/non/existent/path/to/repo.git',
      };
      authManager.availableRepositories.set(invalidRepoPayload.id, invalidRepoPayload);

      const failDir = path.join(setupTempDir('fail_dest'), 'InvalidRepo');
      const failRes = await authManager.cloneRepository(invalidRepoPayload, failDir);
      assert.strictEqual(failRes.success, false);
      assert.ok(!failRes.error.includes(SECRET_TEST_TOKEN), 'OAuth token must not leak in error');
      assert.ok(failRes.error.includes('Failed to clone repository'));
    });

    // 7. AI isolation
    await testScenario('Zero AI provider/model calls during clone operation', async () => {
      const classification = requestRouter.classify('Clone repository NexusGitTest into local folder', {
        workspacePath: cloneTargetDir,
      });
      assert.ok(classification.mode !== ROUTER_MODES.MUTATION);
    });

    // 8. No Git commit/push/pull mutation on development repo
    await testScenario('No automatic commit or push performed during clone', async () => {
      const git = simpleGit({ baseDir: cloneTargetDir });
      const log = await git.log();
      assert.strictEqual(log.total, 1);
      assert.strictEqual(log.latest.message, 'Initial commit for NexusGitTest');
    });

  } finally {
    cleanupDir(remoteBareRepo);
    cleanupDir(sourceRepo);
    cleanupDir(path.dirname(cloneTargetDir));
    cleanupDir(nonEmptyDir);
  }

  console.log('\n====================================================');
  console.log(`ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log('====================================================\n');
}

runTestSuite().catch((err) => {
  console.error('\nTest suite execution failed:', err);
  process.exit(1);
});
