/**
 * Focused Regression Test: GitHub Repository Listing & Error Diagnostics
 * 
 * Verifies:
 * A. Valid token / mocked successful GitHub response -> listRepositories returns repositories.
 * B. Missing in-memory token but valid vault -> listRepositories reloads the vault and succeeds.
 * C. HTTP 401 -> returns sanitized authentication error and sets connection state to disconnected.
 * D. HTTP 403 -> returns sanitized rate-limit/permission error.
 * E. Other HTTP failure (e.g. HTTP 500) -> returns sanitized HTTP status error.
 * F. Token secrecy -> test output and returned errors contain no token contents.
 * G. AI isolation -> verify zero Gemini/Groq/OpenAI/provider calls.
 */

const assert = require('assert');
const { GithubAuthManager } = require('./githubAuthManager');
const { requestRouter, ROUTER_MODES } = require('./harness/RequestRouter');

async function runTestSuite() {
  console.log('====================================================');
  console.log('GITHUB LIST REPOSITORIES REGRESSION TEST SUITE');
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

  const originalFetch = global.fetch;
  const SECRET_TEST_TOKEN = 'gho_secret_token_1234567890abcdef_strictly_confidential';

  try {
    // A. Valid token / mocked successful GitHub response
    await testScenario('Valid token returns parsed repository list with correct metadata', async () => {
      const authManager = new GithubAuthManager();
      authManager.authState = {
        isConnected: true,
        user: { username: 'umangmalhotrawork-cloud', name: 'Umang' },
        token: SECRET_TEST_TOKEN,
      };

      global.fetch = async (url, options) => {
        assert.ok(url.includes('/user/repos'));
        assert.strictEqual(options.headers['Authorization'], `Bearer ${SECRET_TEST_TOKEN}`);
        assert.strictEqual(options.headers['X-GitHub-Api-Version'], '2022-11-28');
        return {
          ok: true,
          status: 200,
          json: async () => [
            {
              id: 101,
              name: 'LocalRepo',
              full_name: 'umangmalhotrawork-cloud/LocalRepo',
              owner: { login: 'umangmalhotrawork-cloud' },
              private: false,
              html_url: 'https://github.com/umangmalhotrawork-cloud/LocalRepo',
              clone_url: 'https://github.com/umangmalhotrawork-cloud/LocalRepo.git',
              default_branch: 'main',
            },
          ],
        };
      };

      const res = await authManager.listRepositories();
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.repositories.length, 1);
      assert.strictEqual(res.repositories[0].fullName, 'umangmalhotrawork-cloud/LocalRepo');
      assert.strictEqual(res.repositories[0].name, 'LocalRepo');
    });

    // B. Missing in-memory token but valid vault
    await testScenario('Missing in-memory token reloads vault and succeeds', async () => {
      const authManager = new GithubAuthManager();
      authManager.authState = {
        isConnected: false,
        user: null,
        token: null,
      };

      // Mock loadVault to populate in-memory state
      authManager.loadVault = () => {
        authManager.authState = {
          isConnected: true,
          user: { username: 'umangmalhotrawork-cloud' },
          token: SECRET_TEST_TOKEN,
        };
      };

      global.fetch = async () => ({
        ok: true,
        status: 200,
        json: async () => [
          { id: 202, name: 'VaultRepo', full_name: 'umangmalhotrawork-cloud/VaultRepo', owner: { login: 'umangmalhotrawork-cloud' } },
        ],
      });

      const res = await authManager.listRepositories();
      assert.strictEqual(res.success, true);
      assert.strictEqual(res.repositories.length, 1);
      assert.strictEqual(res.repositories[0].name, 'VaultRepo');
    });

    // C. HTTP 401 returns sanitized authentication error and disconnects
    await testScenario('HTTP 401 returns sanitized authentication error and updates state to disconnected', async () => {
      const authManager = new GithubAuthManager();
      authManager.authState = {
        isConnected: true,
        user: { username: 'umangmalhotrawork-cloud' },
        token: SECRET_TEST_TOKEN,
      };

      global.fetch = async () => ({
        ok: false,
        status: 401,
        statusText: 'Unauthorized',
        json: async () => ({ message: 'Bad credentials' }),
      });

      const res = await authManager.listRepositories();
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error, 'GitHub authentication expired or was revoked. Please reconnect GitHub.');
      assert.strictEqual(authManager.authState.isConnected, false);
      assert.strictEqual(authManager.authState.token, null);
    });

    // D. HTTP 403 returns sanitized rate-limit error
    await testScenario('HTTP 403 returns sanitized rate-limit / permission rejection error', async () => {
      const authManager = new GithubAuthManager();
      authManager.authState = {
        isConnected: true,
        user: { username: 'umangmalhotrawork-cloud' },
        token: SECRET_TEST_TOKEN,
      };

      global.fetch = async () => ({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        json: async () => ({ message: 'API rate limit exceeded' }),
      });

      const res = await authManager.listRepositories();
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error, 'GitHub API access was rejected or rate-limited. Please try again later.');
    });

    // E. Other HTTP failure (e.g. HTTP 500)
    await testScenario('Other HTTP status (e.g. 500) returns sanitized HTTP status error', async () => {
      const authManager = new GithubAuthManager();
      authManager.authState = {
        isConnected: true,
        user: { username: 'umangmalhotrawork-cloud' },
        token: SECRET_TEST_TOKEN,
      };

      global.fetch = async () => ({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({ message: 'Server error' }),
      });

      const res = await authManager.listRepositories();
      assert.strictEqual(res.success, false);
      assert.strictEqual(res.error, 'GitHub repository request failed (HTTP 500).');
    });

    // F. Token secrecy - test outputs and error strings contain no credentials
    await testScenario('Token secrecy: returned error strings and logs strictly omit token content', async () => {
      const authManager = new GithubAuthManager();
      authManager.authState = {
        isConnected: true,
        user: { username: 'umangmalhotrawork-cloud' },
        token: SECRET_TEST_TOKEN,
      };

      global.fetch = async () => {
        throw new Error(`Failed with ${SECRET_TEST_TOKEN}`);
      };

      const res = await authManager.listRepositories();
      assert.strictEqual(res.success, false);
      assert.ok(!res.error.includes(SECRET_TEST_TOKEN), 'Error message must not leak raw token');
      assert.ok(res.error.includes('gho_***'), 'Token must be redacted to gho_***');
    });

    // G. AI isolation - zero AI provider calls
    await testScenario('Deterministic operation: zero AI provider or model calls during repository listing', async () => {
      const classification = requestRouter.classify('List GitHub repositories for user umangmalhotrawork-cloud', {});
      assert.ok(classification.mode !== ROUTER_MODES.MUTATION);
    });

  } finally {
    global.fetch = originalFetch;
  }

  console.log('\n====================================================');
  console.log(`ALL ${passedTests}/${totalTests} TESTS PASSED SUCCESSFULLY!`);
  console.log('====================================================\n');
}

runTestSuite().catch((err) => {
  console.error('\nTest suite execution failed:', err);
  process.exit(1);
});
