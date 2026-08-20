const { app } = require('electron');
const path = require('path');
const fs = require('fs');

app.setName('NEXUS');

async function runEndToEndTest() {
  console.log('=== STEP 0: INITIALIZATION ===');
  const { loadEnvConfig } = require('../desktop/electron/envLoader');
  loadEnvConfig();
  const { githubAuthManager } = require('../desktop/electron/githubAuthManager');
  const gitManager = require('../desktop/electron/gitManager');
  const workspacePath = path.resolve(__dirname, '..');

  console.log('Workspace Path:', workspacePath);

  // 1. Verify origin points to umangmalhotrawork-cloud/LocalRepo
  console.log('\n=== STEP 1: VERIFY ORIGIN & ASSOCIATION ===');
  const initialStatus = await gitManager.getStatus(workspacePath);
  console.log('Current Branch:', initialStatus.currentBranch);
  const git = gitManager.getGit(workspacePath);
  const remotes = await git.getRemotes(true);
  console.log('Remotes:', JSON.stringify(remotes, null, 2));

  const originRemote = remotes.find(r => r.name === 'origin');
  console.log('Origin fetch URL:', originRemote?.refs?.fetch);
  console.log('Origin push URL:', originRemote?.refs?.push);

  const selectedRepo = await githubAuthManager.getSelectedRepository(workspacePath);
  console.log('Selected Repository Association:', JSON.stringify(selectedRepo, null, 2));

  // 2. Make one harmless test change
  console.log('\n=== STEP 2: MAKE HARMLESS TEST CHANGE ===');
  const testFilePath = path.join(workspacePath, 'README.md');
  let readmeContent = fs.readFileSync(testFilePath, 'utf8');
  const testMarker = '\n<!-- NEXUS-GITHUB-VERIFIED: ' + new Date().toISOString() + ' -->\n';
  readmeContent = readmeContent.replace(/\n<!-- NEXUS-GITHUB-VERIFIED:.*?-->\n/g, '');
  readmeContent += testMarker;
  fs.writeFileSync(testFilePath, readmeContent, 'utf8');
  console.log('Appended test marker to README.md');

  // 3. Use the existing NEXUS commit/push workflow
  console.log('\n=== STEP 3: EXECUTE NEXUS COMMIT/PUSH WORKFLOW ===');
  const commitMsg = 'test(github): verify NEXUS git integration and remote push to LocalRepo';
  const commitPushResult = await gitManager.commitAndPush(workspacePath, commitMsg);
  console.log('commitAndPush result:', JSON.stringify(commitPushResult, null, 2));

  // 4. Verify commit succeeds locally
  console.log('\n=== STEP 4: VERIFY LOCAL COMMIT ===');
  const updatedStatus = await gitManager.getStatus(workspacePath);
  console.log('Updated Status:', JSON.stringify(updatedStatus, null, 2));
  const latestCommit = updatedStatus.lastCommit;
  console.log('Latest Commit:', latestCommit);

  // 5. Verify push succeeds to LocalRepo
  console.log('\n=== STEP 5: VERIFY PUSH RESULT ===');
  console.log('Push succeeded:', commitPushResult.pushed);
  console.log('Push message:', commitPushResult.message);
  console.log('Push error (if any):', commitPushResult.pushError);

  // 6. Verify commit exists on GitHub via API
  console.log('\n=== STEP 6: VERIFY COMMIT ON GITHUB VIA API ===');
  const token = githubAuthManager.authState?.token;
  const commitHash = latestCommit?.fullHash || commitPushResult.commitResult?.commit;
  console.log('Checking commit hash on GitHub:', commitHash);

  const ghRes = await fetch(`https://api.github.com/repos/umangmalhotrawork-cloud/LocalRepo/commits/${commitHash}`, {
    headers: {
      'Authorization': `Bearer ${token}`,
      'User-Agent': 'NEXUS-Workbench-App',
      'Accept': 'application/vnd.github.v3+json',
    }
  });
  console.log('GitHub API Response Status:', ghRes.status);
  if (ghRes.ok) {
    const ghCommit = await ghRes.json();
    console.log('GitHub Commit Found!');
    console.log('  SHA:', ghCommit.sha);
    console.log('  Commit Message:', ghCommit.commit?.message);
    console.log('  Author:', ghCommit.commit?.author?.name, `<${ghCommit.commit?.author?.email}>`);
    console.log('  HTML URL:', ghCommit.html_url);
  } else {
    const errBody = await ghRes.text();
    console.error('GitHub API error:', errBody);
  }

  // 7. Confirm NEXUS still shows correct repository after restart/reload
  console.log('\n=== STEP 7: RESTART / RELOAD SIMULATION ===');
  const { GithubAuthManager } = require('../desktop/electron/githubAuthManager');
  const freshAuthManager = new GithubAuthManager();
  const reloadedStatus = await freshAuthManager.getStatus();
  console.log('Reloaded Auth Status:', JSON.stringify(reloadedStatus, null, 2));
  const reloadedRepo = await freshAuthManager.getSelectedRepository(workspacePath);
  console.log('Reloaded Selected Repository:', JSON.stringify(reloadedRepo, null, 2));

  console.log('\n=== ALL VERIFICATION STEPS COMPLETED ===');
}

if (app.isReady()) {
  runEndToEndTest().catch(console.error).finally(() => process.exit(0));
} else {
  app.on('ready', () => {
    runEndToEndTest().catch(console.error).finally(() => process.exit(0));
  });
}
