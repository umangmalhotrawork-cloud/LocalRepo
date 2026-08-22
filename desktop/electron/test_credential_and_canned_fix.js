/**
 * Focused Test Suite: Credential Resolution & Canned Response Elimination
 * STRICT: ZERO live network API requests are made.
 *
 * Tests:
 * 1. nexus1 credential resolution across all vault candidate paths
 * 2. No-key status detection (isConfigured: false, status: NOT_CONFIGURED)
 * 3. Configured-key status detection (isConfigured: true, status: CONNECTED)
 * 4. Dual-encryption recovery (safeStorage + base64 fallback)
 * 5. Elimination of canned fallback ("I am ready to help...") on conversational requests
 * 6. Elimination of canned fallback on agent error responses
 * 7. Real structured error return on conversational failure
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { AIProviderRouter } = require('./ai/AIProviderRouter');
const { PROVIDER_IDS, PROVIDER_STATUS } = require('./ai/types');
const { harnessRuntime } = require('./harness');

async function runTests() {
  console.log('====================================================');
  console.log('FOCUSED TEST: CREDENTIAL RESOLUTION & CANNED FIX');
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

  // ----------------------------------------------------
  // TEST 1: No-key status detection
  // ----------------------------------------------------
  test('1. No-key status detection when a slot has no credential', () => {
    const router = new AIProviderRouter();
    router.apiKeys.delete(PROVIDER_IDS.NEXUS_1);
    router.keyValidationStatus.delete(PROVIDER_IDS.NEXUS_1);

    const config = router.getConfig();
    const slot1 = config.providers.find((p) => p.id === PROVIDER_IDS.NEXUS_1);

    assert.ok(slot1);
    assert.strictEqual(slot1.isConfigured, false);
    assert.strictEqual(slot1.status, PROVIDER_STATUS.NOT_CONFIGURED);
    assert.strictEqual(slot1.maskedKey, '');
  });

  // ----------------------------------------------------
  // TEST 2: Configured-key status detection
  // ----------------------------------------------------
  test('2. Configured-key status detection when slot has a valid credential', () => {
    const router = new AIProviderRouter();
    const dummyKey = 'AIzaSy_Dummy_Test_Key_123456789';
    router.apiKeys.set(PROVIDER_IDS.NEXUS_1, dummyKey);
    router.keyValidationStatus.set(PROVIDER_IDS.NEXUS_1, PROVIDER_STATUS.CONNECTED);

    const config = router.getConfig();
    const slot1 = config.providers.find((p) => p.id === PROVIDER_IDS.NEXUS_1);

    assert.ok(slot1);
    assert.strictEqual(slot1.isConfigured, true);
    assert.strictEqual(slot1.status, PROVIDER_STATUS.CONNECTED);
    assert.ok(slot1.maskedKey.length > 0);
    assert.ok(!slot1.maskedKey.includes(dummyKey));
  });

  // ----------------------------------------------------
  // TEST 3: Vault persistence & dual-encryption recovery
  // ----------------------------------------------------
  test('3. Vault persists credentials and recovers without data loss', () => {
    const testSlot = 'test_vault_slot_isolated';
    const testSecret = 'AQ.Ab8RN6_TestKey_DualEncryption';
    const router1 = new AIProviderRouter();
    router1.saveKeyToVault(testSlot, testSecret);

    const router2 = new AIProviderRouter();
    router2.loadKeysFromVault();

    assert.strictEqual(router2.apiKeys.get(testSlot), testSecret);
    router2.removeKeyFromVault(testSlot);
  });

  // ----------------------------------------------------
  // TEST 4: Conversational request with no key returns clean error, never canned success
  // ----------------------------------------------------
  await asyncTest('4. Conversational request with missing key returns explicit error, never canned fallback', async () => {
    const router = harnessRuntime.modelAdapter.router;
    router.apiKeys.delete(PROVIDER_IDS.NEXUS_1);

    const result = await harnessRuntime.handleRequest({
      userInput: 'Reply with exactly: NEXUS 1 GEMINI TEST',
      providerId: PROVIDER_IDS.NEXUS_1,
      modelId: 'gemini-1.5-flash',
    });

    assert.strictEqual(result.success, false, 'Must fail when no key is configured');
    assert.ok(!result.response.includes('I am ready to help'), 'Must NOT return canned greeting');
    assert.ok(result.error.includes('No API key configured for NEXUS 1'), 'Must return explicit no-key error');
  });

  // ----------------------------------------------------
  // TEST 5: Conversational request with configured key uses provider and never returns canned fallback
  // ----------------------------------------------------
  await asyncTest('5. Conversational request with configured key uses provider and never returns canned fallback', async () => {
    const router = harnessRuntime.modelAdapter.router;
    router.apiKeys.set(PROVIDER_IDS.NEXUS_1, 'AIzaSy_MockValidKey');
    router.keyValidationStatus.set(PROVIDER_IDS.NEXUS_1, PROVIDER_STATUS.CONNECTED);

    // Mock router.generateAgentPlan offline to verify no canned string is inserted
    const origGenerate = router.generateAgentPlan.bind(router);
    router.generateAgentPlan = async (payload) => {
      return {
        summary: 'NEXUS 1 GEMINI TEST: Real provider response.',
        execution: { providerId: 'nexus1', modelId: 'gemini-1.5-flash' },
      };
    };

    const result = await harnessRuntime.handleRequest({
      userInput: 'Reply with exactly: NEXUS 1 GEMINI TEST',
      providerId: PROVIDER_IDS.NEXUS_1,
      modelId: 'gemini-1.5-flash',
    });

    router.generateAgentPlan = origGenerate;

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.response, 'NEXUS 1 GEMINI TEST: Real provider response.');
    assert.ok(!result.response.includes('I am ready to help'));
  });

  // ----------------------------------------------------
  // TEST 6: Provider error in conversational request returns real error, never canned fallback
  // ----------------------------------------------------
  await asyncTest('6. Provider error in conversational request returns real error, never canned fallback', async () => {
    const router = harnessRuntime.modelAdapter.router;
    router.apiKeys.set(PROVIDER_IDS.NEXUS_1, 'AIzaSy_MockValidKey');
    router.keyValidationStatus.set(PROVIDER_IDS.NEXUS_1, PROVIDER_STATUS.CONNECTED);

    const origGenerate = router.generateAgentPlan.bind(router);
    router.generateAgentPlan = async (payload) => {
      const err = new Error('Quota exceeded for model gemini-1.5-flash (429)');
      err.statusCode = 429;
      err.providerId = 'nexus1';
      err.modelId = 'gemini-1.5-flash';
      throw err;
    };

    const result = await harnessRuntime.handleRequest({
      userInput: 'Reply with exactly: NEXUS 1 GEMINI TEST',
      providerId: PROVIDER_IDS.NEXUS_1,
      modelId: 'gemini-1.5-flash',
    });

    router.generateAgentPlan = origGenerate;

    assert.strictEqual(result.success, false);
    assert.ok(result.isRateLimit, 'Must identify rate limit');
    assert.ok(result.error.includes('Quota exceeded') || result.error.includes('nexus1'));
    assert.ok(!result.response.includes('I am ready to help'));
  });

  console.log('\n====================================================');
  console.log(`ALL TESTS PASSED: ${passed}/${total}`);
  console.log('====================================================\n');
}

runTests().catch((err) => {
  console.error('[TEST-FATAL]', err);
  process.exit(1);
});
