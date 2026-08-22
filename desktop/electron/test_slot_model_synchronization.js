/**
 * Focused regression checks for NEXUS Gemini slot model synchronization.
 * These tests use fake keys and injected model lists; they make no network calls.
 */

const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { AIProviderRouter } = require('./ai/AIProviderRouter');
const { PROVIDER_IDS } = require('./ai/types');

const testRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-slot-model-sync-'));
const selectionPath = path.join(testRoot, 'nexus_ai_selection.json');

class TestRouter extends AIProviderRouter {
  getVaultCandidatePaths() {
    return [path.join(testRoot, 'nexus_ai_vault.json')];
  }
}

function configure(router, providerId) {
  router.apiKeys.set(providerId, `AIzaSy_test_key_for_${providerId}`);
  router.keyValidationStatus.set(providerId, 'CONNECTED');
}

async function test(name, fn) {
  try {
    await fn();
    console.log(`✓ ${name}`);
  } catch (error) {
    console.error(`✗ ${name}: ${error.message}`);
    throw error;
  }
}

async function run() {
  try {
    await test('stale model correction validates and rewrites all NEXUS slot selections on startup', () => {
    const staleSlots = Object.fromEntries([1, 2, 3, 4, 5, 6].map((slot) => [`nexus${slot}`, 'gemini-1.5-flash']));
    fs.writeFileSync(selectionPath, JSON.stringify({
      activeProvider: PROVIDER_IDS.NEXUS_2,
      activeModel: 'gemini-1.5-flash',
      slotModels: staleSlots,
    }));

    const router = new TestRouter();
    assert.strictEqual(router.activeProviderId, PROVIDER_IDS.NEXUS_2);
    assert.strictEqual(router.activeModelId, 'gemini-2.5-flash');
    for (const slot of [1, 2, 3, 4, 5, 6]) {
      assert.strictEqual(router.getConfig().providers.find((provider) => provider.id === `nexus${slot}`).selectedModelId, 'gemini-2.5-flash');
    }
    assert.ok(!fs.readFileSync(selectionPath, 'utf8').includes('gemini-1.5-flash'));
  });

    await test('NEXUS 1 resolution normalizes a stale request before GeminiProvider receives it', async () => {
    const router = new TestRouter();
    configure(router, PROVIDER_IDS.NEXUS_1);
    const provider = router.providers.get(PROVIDER_IDS.NEXUS_1);
    let receivedModelId = null;
    provider.generateAgentPlan = (_key, modelId) => {
      receivedModelId = modelId;
      return { summary: 'test' };
    };

    const resolved = router.resolveProviderAndModel(PROVIDER_IDS.NEXUS_1, 'gemini-1.5-flash');
    assert.strictEqual(resolved.modelId, 'gemini-2.5-flash');
    assert.strictEqual(resolved.requestedModelId, resolved.modelId);
      const result = await router.generateAgentPlan({ providerId: PROVIDER_IDS.NEXUS_1, modelId: 'gemini-1.5-flash' });
      assert.strictEqual(receivedModelId, 'gemini-2.5-flash');
      assert.strictEqual(result.execution.modelId, receivedModelId);
  });

    await test('NEXUS 2 resolution uses only the model discovered for NEXUS 2', () => {
    const router = new TestRouter();
    configure(router, PROVIDER_IDS.NEXUS_2);
    const provider = router.providers.get(PROVIDER_IDS.NEXUS_2);
    provider.dynamicModels = [{ id: 'gemini-2.5-flash-slot2', name: 'Gemini 2.5 Flash (slot 2)' }];

    const selected = router.setConfig(PROVIDER_IDS.NEXUS_2, 'gemini-1.5-flash');
    const resolved = router.resolveProviderAndModel(PROVIDER_IDS.NEXUS_2);
    assert.strictEqual(selected.activeModel, 'gemini-2.5-flash-slot2');
    assert.strictEqual(resolved.modelId, 'gemini-2.5-flash-slot2');
    assert.strictEqual(resolved.provider.getId(), PROVIDER_IDS.NEXUS_2);
    assert.strictEqual(resolved.isFallback, false);
  });

    await test('corrected valid selection persists after restart', () => {
    const router = new TestRouter();
    router.setConfig(PROVIDER_IDS.NEXUS_1, 'gemini-2.5-pro');

    const restarted = new TestRouter();
    assert.strictEqual(restarted.activeProviderId, PROVIDER_IDS.NEXUS_1);
    assert.strictEqual(restarted.activeModelId, 'gemini-2.5-pro');
    assert.strictEqual(restarted.getConfig().providers.find((provider) => provider.id === PROVIDER_IDS.NEXUS_1).selectedModelId, 'gemini-2.5-pro');
  });
  } finally {
    fs.rmSync(testRoot, { recursive: true, force: true });
  }
}

run().catch(() => { process.exitCode = 1; });
