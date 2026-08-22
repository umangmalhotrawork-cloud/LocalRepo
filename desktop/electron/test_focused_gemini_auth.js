/**
 * Focused Gemini Authentication Test Suite
 * Verifies live authentication path for NEXUS 1 (Gemini)
 */

const assert = require('assert');
const { AIProviderRouter } = require('./ai/AIProviderRouter');
const { PROVIDER_IDS, PROVIDER_STATUS } = require('./ai/types');
const GeminiProvider = require('./ai/GeminiProvider');

async function runFocusedGeminiAuthTest() {
  console.log('====================================================');
  console.log('FOCUSED GEMINI AUTHENTICATION TEST');
  console.log('====================================================\n');

  let passed = 0;
  let total = 0;

  function test(name, fn) {
    total++;
    try {
      fn();
      console.log(`  ✓ [TEST ${total}] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ [TEST ${total}] ${name}`);
      console.error(`    Error: ${err.message}`);
      throw err;
    }
  }

  async function asyncTest(name, fn) {
    total++;
    try {
      await fn();
      console.log(`  ✓ [TEST ${total}] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ✗ [TEST ${total}] ${name}`);
      console.error(`    Error: ${err.message}`);
      throw err;
    }
  }

  const router = new AIProviderRouter();
  router.initDefaultKeys();

  // Test 1: NEXUS 1 slot credential resolution from vault
  test('1. NEXUS 1 credential resolves from secure vault with valid length & format', () => {
    const key = router.apiKeys.get(PROVIDER_IDS.NEXUS_1);
    assert.ok(key, 'NEXUS 1 key must be present in router');
    assert.ok(key.length >= 30, 'Key must be a full valid credential');
    assert.ok(!key.includes('TestKey'), 'Key must not be a dummy test string');
    assert.strictEqual(router.getProviderStatus(PROVIDER_IDS.NEXUS_1), PROVIDER_STATUS.CONNECTED);
  });

  // Test 2: GeminiProvider defaults to valid models
  test('2. GeminiProvider defaults to valid modern model (gemini-2.5-flash)', () => {
    const provider = router.providers.get(PROVIDER_IDS.NEXUS_1);
    assert.ok(provider instanceof GeminiProvider);
    assert.strictEqual(provider.getDefaultModel(), 'gemini-2.5-flash');
  });

  // Test 3: Live dynamic model discovery via getAvailableModels
  await asyncTest('3. Live dynamic model discovery validates key against Gemini API', async () => {
    const key = router.apiKeys.get(PROVIDER_IDS.NEXUS_1);
    const provider = router.providers.get(PROVIDER_IDS.NEXUS_1);
    const diag = await provider.getAvailableModels(key, 'gemini-2.5-flash');

    assert.strictEqual(diag.authenticated, true, `Authentication must succeed: ${diag.error}`);
    assert.strictEqual(diag.reachable, true, 'Gemini endpoint must be reachable');
    assert.ok(diag.totalModels > 0, 'Must discover dynamic models from Google API');
    assert.strictEqual(diag.configuredModelAvailable, true, 'Configured model gemini-2.5-flash must be available');
  });

  // Test 4: Live controlled plan generation test with exact prompt
  await asyncTest('4. Live Gemini plan generation returns expected structured response', async () => {
    const key = router.apiKeys.get(PROVIDER_IDS.NEXUS_1);
    const provider = router.providers.get(PROVIDER_IDS.NEXUS_1);
    const result = await provider.generateAgentPlan(key, 'gemini-2.5-flash', {
      task: 'Reply with exactly: NEXUS 1 GEMINI TEST',
      intent: 'GENERAL_CHAT',
    });

    assert.ok(result, 'Result must be returned');
    assert.ok(result.summary, 'Result must contain summary');
    assert.ok(result.summary.includes('NEXUS 1 GEMINI TEST'), `Summary must contain expected text, got: ${result.summary}`);
  });

  console.log('\n====================================================');
  console.log(`ALL FOCUSED GEMINI AUTH TESTS PASSED: ${passed}/${total}`);
  console.log('====================================================\n');
}

runFocusedGeminiAuthTest().catch((err) => {
  console.error('[TEST-FATAL]', err);
  process.exit(1);
});
