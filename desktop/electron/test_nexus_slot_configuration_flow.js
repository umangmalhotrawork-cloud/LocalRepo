/**
 * NEXUS 6-Slot Configuration Flow & Storage Verification Suite
 * STRICT: ZERO live network API requests are made.
 *
 * Tests:
 * 1. Configure NEXUS 1 via setApiKey (validates format, sets CONNECTED, stores in encrypted vault)
 * 2. Configure NEXUS 2 via setApiKey with separate isolated key
 * 3. Configure NEXUS 3-6 with independent credentials
 * 4. Persistence across restarts (new router instance recovers all 6 credentials from vault)
 * 5. Slot isolation (each slot receives ONLY its assigned credential with zero fallback/rotation)
 * 6. Raw-key redaction & security (getConfig, masked keys, secretFilter)
 * 7. Unconfigured vs Configured status transitions
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { AIProviderRouter } = require('./ai/AIProviderRouter');
const { PROVIDER_IDS, PROVIDER_STATUS } = require('./ai/types');
const secretFilter = require('../security/secretFilter');

async function runTests() {
  console.log('====================================================');
  console.log('NEXUS 6-SLOT CONFIGURATION FLOW VERIFICATION');
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

  const k1 = 'AQ.TEST_KEY_PLACEHOLDER_1';
  const k2 = 'AQ.TEST_KEY_PLACEHOLDER_2';
  const k3 = 'AQ.TEST_KEY_PLACEHOLDER_3';
  const k4 = 'AQ.TEST_KEY_PLACEHOLDER_4';
  const k5 = 'AQ.TEST_KEY_PLACEHOLDER_5';
  const k6 = 'GROQ_TEST_KEY_PLACEHOLDER_6';

  const router = new AIProviderRouter();

  // ----------------------------------------------------
  // TEST 1: Configure NEXUS 1
  // ----------------------------------------------------
  await asyncTest('1. Configure NEXUS 1 (format validated, CONNECTED, stored in vault)', async () => {
    const res = await router.setApiKey(PROVIDER_IDS.NEXUS_1, k1);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, PROVIDER_STATUS.CONNECTED);
    assert.strictEqual(res.configured, true);
    assert.ok(res.maskedKey.length > 0);
    assert.ok(!res.maskedKey.includes(k1), 'Masked key must not expose raw secret');

    const status = router.getProviderStatus(PROVIDER_IDS.NEXUS_1);
    assert.strictEqual(status, PROVIDER_STATUS.CONNECTED);
  });

  // ----------------------------------------------------
  // TEST 2: Configure NEXUS 2
  // ----------------------------------------------------
  await asyncTest('2. Configure NEXUS 2 with separate isolated key', async () => {
    const res = await router.setApiKey(PROVIDER_IDS.NEXUS_2, k2);
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.status, PROVIDER_STATUS.CONNECTED);
    assert.strictEqual(res.configured, true);

    const slot2 = router.resolveProviderAndModel(PROVIDER_IDS.NEXUS_2);
    assert.ok(slot2);
    assert.strictEqual(slot2.apiKey, k2);
    assert.notStrictEqual(slot2.apiKey, k1);
  });

  // ----------------------------------------------------
  // TEST 3: Configure NEXUS 3 through 6
  // ----------------------------------------------------
  await asyncTest('3. Configure NEXUS 3 through 6 with individual credentials', async () => {
    await router.setApiKey(PROVIDER_IDS.NEXUS_3, k3);
    await router.setApiKey(PROVIDER_IDS.NEXUS_4, k4);
    await router.setApiKey(PROVIDER_IDS.NEXUS_5, k5);
    await router.setApiKey(PROVIDER_IDS.NEXUS_6, k6);

    const config = router.getConfig();
    for (let i = 1; i <= 6; i++) {
      const slotId = `nexus${i}`;
      const provider = config.providers.find((p) => p.id === slotId);
      assert.ok(provider, `Slot ${slotId} must be in config`);
      assert.strictEqual(provider.isConfigured, true, `Slot ${slotId} must be configured`);
      assert.strictEqual(provider.status, PROVIDER_STATUS.CONNECTED);
    }
  });

  // ----------------------------------------------------
  // TEST 4: Persistence across restart
  // ----------------------------------------------------
  test('4. Persistence across restart (new router instance recovers credentials from vault)', () => {
    const freshRouter = new AIProviderRouter();
    freshRouter.loadKeysFromVault();

    const expectedKeys = {
      nexus1: k1,
      nexus2: k2,
      nexus3: k3,
      nexus4: k4,
      nexus5: k5,
      nexus6: k6,
    };

    for (const [slotId, expectedKey] of Object.entries(expectedKeys)) {
      const resolved = freshRouter.resolveProviderAndModel(slotId);
      assert.ok(resolved, `Slot ${slotId} must be resolved after reload`);
      assert.strictEqual(resolved.apiKey, expectedKey, `Slot ${slotId} must match stored credential`);
      assert.strictEqual(resolved.isFallback, false);
    }
  });

  // ----------------------------------------------------
  // TEST 5: Slot isolation & Zero rotation
  // ----------------------------------------------------
  test('5. Slot isolation: NEXUS 1 never uses NEXUS 2 key, and unconfigured slots return null', () => {
    const testRouter = new AIProviderRouter();
    testRouter.apiKeys.clear();
    testRouter.keyValidationStatus.clear();

    // Set only slot 1
    testRouter.apiKeys.set(PROVIDER_IDS.NEXUS_1, k1);
    testRouter.keyValidationStatus.set(PROVIDER_IDS.NEXUS_1, PROVIDER_STATUS.CONNECTED);

    const res1 = testRouter.resolveProviderAndModel(PROVIDER_IDS.NEXUS_1);
    assert.strictEqual(res1.apiKey, k1);
    assert.strictEqual(res1.isFallback, false);

    // Slot 2 has no key -> MUST return null, NEVER fallback to slot 1
    const res2 = testRouter.resolveProviderAndModel(PROVIDER_IDS.NEXUS_2);
    assert.strictEqual(res2, null, 'Unconfigured slot must return null and never use other slots');
  });

  // ----------------------------------------------------
  // TEST 6: Raw-key redaction & security
  // ----------------------------------------------------
  test('6. Raw-key redaction: getConfig and secretFilter never leak plaintext keys', () => {
    const config = router.getConfig();
    const configJson = JSON.stringify(config);

    const allKeys = [k1, k2, k3, k4, k5, k6];
    for (const key of allKeys) {
      assert.ok(!configJson.includes(key), 'getConfig must NEVER contain plaintext API keys');
      const sanitized = secretFilter.sanitize(`Error with key ${key}`);
      assert.ok(!sanitized.includes(key), 'secretFilter must redact keys');
    }
  });

  // ----------------------------------------------------
  // TEST 7: Remove key transitions status to NOT_CONFIGURED
  // ----------------------------------------------------
  test('7. Removing a key cleanly resets status to NOT_CONFIGURED', () => {
    const dummyRouter = new AIProviderRouter();
    dummyRouter.apiKeys.set('nexus1', 'AI_TEST_KEY_PLACEHOLDER');
    dummyRouter.keyValidationStatus.set('nexus1', PROVIDER_STATUS.CONNECTED);

    dummyRouter.removeApiKey('nexus1');
    assert.strictEqual(dummyRouter.apiKeys.has('nexus1'), false);
    assert.strictEqual(dummyRouter.getProviderStatus('nexus1'), PROVIDER_STATUS.NOT_CONFIGURED);
  });

  console.log('\n====================================================');
  console.log(`ALL TESTS PASSED: ${passed}/${total}`);
  console.log('====================================================\n');
}

runTests().catch((err) => {
  console.error('[TEST-FATAL]', err);
  process.exit(1);
});
