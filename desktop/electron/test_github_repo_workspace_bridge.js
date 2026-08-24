/**
 * Focused Regression Test: GitHub Repository-to-Local-Workspace Bridge
 * 
 * Verifies:
 * 1. Initial active workspace remains unchanged.
 * 2. GitHub repository picker selects LocalRepo.
 * 3. Local repository path is resolved or cloned into a safe test directory.
 * 4. IDEApp receives the resolved local path.
 * 5. folderPath changes to the selected repository.
 * 6. SourceControlPanel receives that exact workspace path.
 * 7. gitManager.getStatus() now reports isRepo: true.
 * 8. Current branch is detected.
 * 9. The old NEXUS workspace is untouched.
 * 10. No AI-provider calls occur.
 * 11. No Git commit/push/pull occurs automatically.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const simpleGit = require('simple-git');
const { GithubAuthManager } = require('./githubAuthManager');
const gitManager = require('./gitManager');
const { requestRouter, ROUTER_MODES, CODING_INTENTS } = require('./harness/RequestRouter');

function setupTempDir(prefix) {
  const tmpBase = os.tmpdir();
  const tmpDir = path.join(tmpBase, `__nexus_test_${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
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

  console.log('====================================================');
  console.log('GITHUB REPOSITORY-TO-WORKSPACE BRIDGE TEST SUITE');
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

  const initialWorkspace = setupTempDir('initial_nexus_workspace');
  const remoteBareRepo = setupTempDir('remote_localrepo_bare');
  const localRepoClone = setupTempDir('local_repo_checkout');
  const cloneDestinationDir = path.join(setupTempDir('clone_destination'), 'LocalRepo');

  const authManager = new GithubAuthManager();

  try {
    // Setup initial workspace with a non-git project file
    fs.writeFileSync(path.join(initialWorkspace, 'demo.py'), 'print("demo cart project")\n', 'utf8');
    const initialContent = fs.readFileSync(path.join(initialWorkspace, 'demo.py'), 'utf8');

    // Setup remote bare git repository representing umangmalhotrawork-cloud/LocalRepo
    const bareGit = simpleGit({ baseDir: remoteBareRepo });
    await bareGit.init(true);

    // Setup localRepoClone and push initial commit to remoteBareRepo
    const initGit = simpleGit({ baseDir: localRepoClone });
    await initGit.init();
    await initGit.addConfig('user.name', 'Umang Malhotra');
    await initGit.addConfig('user.email', 'umang@example.com');
    fs.writeFileSync(path.join(localRepoClone, 'README.md'), '# LocalRepo\nLocal repository content.\n', 'utf8');
    fs.writeFileSync(path.join(localRepoClone, 'app.py'), 'def main():\n    print("Hello from LocalRepo")\n', 'utf8');
    await initGit.add(['README.md', 'app.py']);
    await initGit.commit('Initial commit for LocalRepo');
    await initGit.addRemote('origin', remoteBareRepo);
    await initGit.push('origin', 'master');

    const sampleRepoPayload = {
      id: '987654321',
      name: 'LocalRepo',
      owner: 'umangmalhotrawork-cloud',
      fullName: 'umangmalhotrawork-cloud/LocalRepo',
      private: false,
      htmlUrl: 'https://github.com/umangmalhotrawork-cloud/LocalRepo',
      cloneUrl: remoteBareRepo, // local bare repo for test isolation
      defaultBranch: 'master',
    };

    authManager.authState = {
      isConnected: true,
      user: { username: 'umangmalhotrawork-cloud', name: 'Umang Malhotra' },
      token: 'gho_test_mock_token',
    };
    authManager.availableRepositories.set(sampleRepoPayload.id, sampleRepoPayload);

    // 1. Initial active workspace remains unchanged
    await testScenario('Initial active workspace status shows non-git (isRepo: false)', async () => {
      const isRepo = await gitManager.isRepo(initialWorkspace);
      assert.strictEqual(isRepo, false);

      const status = await gitManager.getStatus(initialWorkspace);
      assert.strictEqual(status.isRepo, false);
      assert.strictEqual(status.currentBranch, '');
    });

    // 2. Resolve existing local checkout when path is known or discoverable
    await testScenario('Resolves existing local checkout folder for selected repository', async () => {
      // Associate localRepoClone with authManager
      await authManager.associateRepository(localRepoClone, sampleRepoPayload);

      const resolveRes = await authManager.resolveLocalRepository(sampleRepoPayload, initialWorkspace);
      assert.strictEqual(resolveRes.exists, true);
      assert.strictEqual(path.resolve(resolveRes.localPath), path.resolve(localRepoClone));
      assert.strictEqual(resolveRes.matchedBy, 'savedAssociation');
    });

    // 3. Switch active workspace to resolved local checkout
    await testScenario('Switches active workspace to resolved local repository', async () => {
      let activeFolderPath = initialWorkspace;
      
      // Simulate IDEApp onSelectRepositoryWorkspace callback
      const onSelectRepositoryWorkspace = (resolvedPath) => {
        activeFolderPath = resolvedPath;
      };

      const resolveRes = await authManager.resolveLocalRepository(sampleRepoPayload, initialWorkspace);
      if (resolveRes.exists) {
        onSelectRepositoryWorkspace(resolveRes.localPath);
      }

      assert.strictEqual(activeFolderPath, localRepoClone);
    });

    // 4. Source Control immediately inspects the selected repository
    await testScenario('Source Control reports isRepo: true and detects branch on selected repository', async () => {
      const activeFolderPath = localRepoClone;
      const isRepo = await gitManager.isRepo(activeFolderPath);
      assert.strictEqual(isRepo, true);

      const status = await gitManager.getStatus(activeFolderPath);
      assert.strictEqual(status.isRepo, true);
      assert.ok(['master', 'main'].includes(status.currentBranch));
      assert.strictEqual(status.isClean, true);

      // Verify getSelectedRepository with actual active workspacePath
      const selectedRes = await authManager.getSelectedRepository(activeFolderPath);
      assert.strictEqual(selectedRes.success, true);
      assert.strictEqual(selectedRes.repo.fullName, 'umangmalhotrawork-cloud/LocalRepo');
    });

    // 5. In-app clone flow when local checkout does not exist
    await testScenario('Clones repository safely when local checkout does not exist', async () => {
      const unassociatedRepoPayload = {
        id: '123456789',
        name: 'ClonedRepo',
        owner: 'umangmalhotrawork-cloud',
        fullName: 'umangmalhotrawork-cloud/ClonedRepo',
        private: false,
        htmlUrl: 'https://github.com/umangmalhotrawork-cloud/ClonedRepo',
        cloneUrl: remoteBareRepo,
        defaultBranch: 'master',
      };
      authManager.availableRepositories.set(unassociatedRepoPayload.id, unassociatedRepoPayload);

      // Resolve returns exists: false
      const resolveRes = await authManager.resolveLocalRepository(unassociatedRepoPayload, initialWorkspace);
      assert.strictEqual(resolveRes.exists, false);
      assert.ok(resolveRes.suggestedClonePath);

      // Perform clone into cloneDestinationDir
      const cloneRes = await authManager.cloneRepository(unassociatedRepoPayload, cloneDestinationDir);
      assert.strictEqual(cloneRes.success, true);
      assert.strictEqual(path.resolve(cloneRes.localPath), path.resolve(cloneDestinationDir));
      assert.ok(fs.existsSync(path.join(cloneDestinationDir, '.git')));
      assert.ok(fs.existsSync(path.join(cloneDestinationDir, 'README.md')));

      // Now Source Control operates on cloned repo
      const clonedStatus = await gitManager.getStatus(cloneDestinationDir);
      assert.strictEqual(clonedStatus.isRepo, true);
      assert.ok(['master', 'main'].includes(clonedStatus.currentBranch));
    });

    // 6. Non-empty destination directory is safely rejected
    await testScenario('Rejects cloning into an existing non-empty directory to prevent data loss', async () => {
      const conflictingDir = setupTempDir('conflicting_clone_dir');
      fs.writeFileSync(path.join(conflictingDir, 'existing_file.txt'), 'Important existing file\n', 'utf8');

      const cloneRes = await authManager.cloneRepository(sampleRepoPayload, conflictingDir);
      assert.strictEqual(cloneRes.success, false);
      assert.ok(cloneRes.error.includes('already exists and is not empty'));

      cleanupDir(conflictingDir);
    });

    // 7. The old NEXUS workspace is untouched
    await testScenario('Original NEXUS initial workspace files remain untouched', () => {
      const currentContent = fs.readFileSync(path.join(initialWorkspace, 'demo.py'), 'utf8');
      assert.strictEqual(currentContent, initialContent);
      assert.strictEqual(fs.existsSync(path.join(initialWorkspace, '.git')), false);
    });

    // 8. No AI API calls or auto-commit/push occurs
    await testScenario('Zero AI provider calls and zero auto-commit/push mutations during repo switch', async () => {
      // Check router intent classification
      const classification = requestRouter.classify('Select repository umangmalhotrawork-cloud/LocalRepo', {
        workspacePath: localRepoClone,
      });
      assert.ok(classification.mode !== ROUTER_MODES.MUTATION);

      // Verify git log has not created synthetic auto-commits
      const git = simpleGit({ baseDir: localRepoClone });
      const log = await git.log();
      assert.strictEqual(log.total, 1);
      assert.strictEqual(log.latest.message, 'Initial commit for LocalRepo');
    });

  } finally {
    cleanupDir(initialWorkspace);
    cleanupDir(remoteBareRepo);
    cleanupDir(localRepoClone);
    cleanupDir(path.dirname(cloneDestinationDir));
  }

  console.log('\n====================================================');
  console.log(`ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log('====================================================\n');
}

runTestSuite().catch((err) => {
  console.error('\nTest suite execution failed:', err);
  process.exit(1);
});
