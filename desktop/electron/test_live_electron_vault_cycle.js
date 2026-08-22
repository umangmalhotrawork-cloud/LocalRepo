/**
 * Live Electron Vault Cycle Verification Test
 * Tests the complete lifecycle:
 * 1. setApiKey("nexus1", key)
 * 2. Multi-path vault persistence & verification on disk
 * 3. Cold reboot simulation (brand-new AIProviderRouter instance)
 * 4. loadKeysFromVault() resolution
 * 5. getConfig() reports Configured / Connected (no "No Key")
 * 6. resolveProviderAndModel("nexus1") succeeds with isFallback: false
 * 7. Conversational request successfully resolves slot credentials
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { AIProviderRouter } = require('./ai/AIProviderRouter');
const { PROVIDER_IDS, PROVIDER_STATUS } = require('./ai/types');
const { harnessRuntime } = require('./harness');
const secretFilter = require('../security/secretFilter');

async function runLiveVaultCycleTest() {
  console.log('====================================================');
  console.log('RUNNING LIVE ELECTRON VAULT CYCLE VERIFICATION');
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

  // STEP 1: Set NEXUS 1 key via setApiKey
  await asyncTest('1. setApiKey("nexus1", ...) stores key and validates state', async () => {
    const liveRouter = new AIProviderRouter();
    const result = await liveRouter.setApiKey(PROVIDER_IDS.NEXUS_1, k1);

    assert.strictEqual(result.success, true);
    assert.strictEqual(result.status, PROVIDER_STATUS.CONNECTED);
    assert.strictEqual(result.configured, true);
    assert.ok(result.maskedKey.length > 0);
  });

  // STEP 2: Verify physical vault file on disk
  test('2. Verify physical vault file on disk and inspect candidate paths', () => {
    const liveRouter = new AIProviderRouter();
    const candidates = liveRouter.getVaultCandidatePaths();
    console.log('    Candidate vault paths:');
    candidates.forEach((c) => console.log(`      - ${c}`));

    let foundVault = false;
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) {
          const content = JSON.parse(fs.readFileSync(p, 'utf8'));
          if (content && content.nexus1) {
            foundVault = true;
            console.log(`    ✓ Verified vault file exists and readable at: ${p}`);
          }
        }
      } catch (e) {
        // Restricted OS path in sandbox
      }
    }
    assert.ok(foundVault, 'At least one candidate vault file must exist on disk');
  });

  // STEP 3: Cold Reboot Simulation
  test('3. Cold reboot simulation: New AIProviderRouter hydrates nexus1 without re-entering key', () => {
    const rebootedRouter = new AIProviderRouter();
    rebootedRouter.loadKeysFromVault();

    const config = rebootedRouter.getConfig();
    const slot1 = config.providers.find((p) => p.id === PROVIDER_IDS.NEXUS_1);

    assert.ok(slot1, 'Slot 1 must exist in config');
    assert.strictEqual(slot1.isConfigured, true, 'NEXUS 1 must be isConfigured: true');
    assert.strictEqual(slot1.status, PROVIDER_STATUS.CONNECTED, 'NEXUS 1 must be status: CONNECTED (not No Key)');
    assert.ok(slot1.maskedKey.length > 0, 'NEXUS 1 must have maskedKey');

    const resolved = rebootedRouter.resolveProviderAndModel(PROVIDER_IDS.NEXUS_1);
    assert.ok(resolved, 'Must resolve provider and model');
    assert.strictEqual(resolved.apiKey, k1, 'Must match exact stored credential');
    assert.strictEqual(resolved.isFallback, false);
    assert.strictEqual(resolved.provider.getId(), 'nexus1');
  });

  // STEP 4: Request execution resolution
  await asyncTest('4. Request execution path resolves NEXUS 1 without "No API key configured"', async () => {
    const router = harnessRuntime.modelAdapter.router;
    router.loadKeysFromVault();

    // Mock offline plan generation to confirm no credential error is thrown
    const origGenerate = router.generateAgentPlan.bind(router);
    router.generateAgentPlan = async (payload) => {
      return {
        summary: 'NEXUS 1 response generated successfully.',
        execution: { providerId: 'nexus1', modelId: 'gemini-1.5-flash' },
      };
    };

    const outcome = await harnessRuntime.handleRequest({
      userInput: 'Reply with exactly: NEXUS 1 GEMINI TEST',
      providerId: 'nexus1',
      modelId: 'gemini-1.5-flash',
    });

    router.generateAgentPlan = origGenerate;

    assert.strictEqual(outcome.success, true);
    assert.ok(!outcome.error, `Must have no error: ${outcome.error}`);
    assert.strictEqual(outcome.response, 'NEXUS 1 response generated successfully.');
    assert.strictEqual(outcome.execution?.providerId, 'nexus1');
  });

  console.log('\n====================================================');
  console.log(`ALL LIVE VAULT CYCLE TESTS PASSED: ${passed}/${total}`);
  console.log('====================================================\n');
}

runLiveVaultCycleTest().catch((err) => {
  console.error('[LIVE-TEST-FATAL]', err);
  process.exit(1);
});
