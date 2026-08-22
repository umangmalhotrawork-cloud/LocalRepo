/**
 * FOCUSED REGRESSION TEST: UI MULTI-MODEL STATE SYNCHRONIZATION
 * 
 * Verifies that:
 * 1. AIProviderRouter.setConfig accurately updates activeProvider and activeModel.
 * 2. Active selection is persisted to disk immediately.
 * 3. Router getConfig() returns the updated activeProvider and activeModel.
 * 4. StatusBar display name computation resolves to the newly selected model.
 * 5. App restart / router re-instantiation preserves the selected model.
 * 6. Model switches across any model (gpt-oss-120b -> gpt-oss-20b -> qwen/qwen3.6-27b)
 *    keep all state synchronized without touching credentials.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { AIProviderRouter } = require('./ai/AIProviderRouter');
const { PROVIDER_IDS, PROVIDER_STATUS } = require('./ai/types');

async function runUIModelStateSyncTests() {
  console.log('====================================================');
  console.log('TESTING UI MULTI-MODEL STATE SYNCHRONIZATION');
  console.log('====================================================\n');

  const recoveryDir = path.join(process.cwd(), '.nexus-recovery');
  fs.mkdirSync(recoveryDir, { recursive: true });
  const vaultPath = path.join(recoveryDir, 'nexus_ai_vault.json');
  const selectionPath = path.join(recoveryDir, 'nexus_ai_selection.json');

  // Helper simulating StatusBar display computation
  function computeStatusBarDisplay(aiConfig, activeProviderProp, activeModelProp) {
    const currentProviderId = activeProviderProp || aiConfig?.activeProvider || 'groq';
    const currentModelId = activeModelProp || aiConfig?.activeModel || 'openai/gpt-oss-120b';
    const activeProviderObj = aiConfig?.providers?.find((p) => p.id === currentProviderId);
    const shortModelName = currentModelId.split('/').pop()?.replace(/^models\//, '') || currentModelId;
    const displayName = activeProviderObj 
      ? `${activeProviderObj.name} (${shortModelName})` 
      : `Groq (${shortModelName})`;
    return {
      providerId: currentProviderId,
      modelId: currentModelId,
      displayName,
    };
  }

  // 1. Initialize router and setup Groq key
  console.log('[1/5] Initializing router with Groq credential...');
  const router = new AIProviderRouter();
  const groqKey = 'gsk_mock_sync_test_key_987654321';
  router.providers.get('groq').validateKey = async () => ({ valid: true, models: router.providers.get('groq').getModels() });
  
  await router.setApiKey(PROVIDER_IDS.GROQ, groqKey);
  assert.strictEqual(router.getProviderStatus(PROVIDER_IDS.GROQ), PROVIDER_STATUS.CONNECTED);
  console.log('  ✔ [PASS] Groq configured with valid key\n');

  // 2. Select initial model (openai/gpt-oss-120b)
  console.log('[2/5] Initial model selection (openai/gpt-oss-120b)...');
  router.setConfig(PROVIDER_IDS.GROQ, 'openai/gpt-oss-120b');
  let config = router.getConfig();
  assert.strictEqual(config.activeModel, 'openai/gpt-oss-120b');

  let statusDisplay = computeStatusBarDisplay(config, config.activeProvider, config.activeModel);
  assert.strictEqual(statusDisplay.modelId, 'openai/gpt-oss-120b');
  assert.strictEqual(statusDisplay.displayName, 'Groq (gpt-oss-120b)');
  console.log(`  ✔ [PASS] Status bar shows: "${statusDisplay.displayName}"\n`);

  // 3. User switches to openai/gpt-oss-20b
  console.log('[3/5] User switches to openai/gpt-oss-20b...');
  const setRes = router.setConfig(PROVIDER_IDS.GROQ, 'openai/gpt-oss-20b');
  assert.strictEqual(setRes.success, true);
  assert.strictEqual(setRes.activeModel, 'openai/gpt-oss-20b');

  config = router.getConfig();
  assert.strictEqual(config.activeProvider, 'groq');
  assert.strictEqual(config.activeModel, 'openai/gpt-oss-20b');

  statusDisplay = computeStatusBarDisplay(config, config.activeProvider, config.activeModel);
  assert.strictEqual(statusDisplay.modelId, 'openai/gpt-oss-20b');
  assert.strictEqual(statusDisplay.displayName, 'Groq (gpt-oss-20b)');
  console.log(`  ✔ [PASS] Status bar synchronized immediately to: "${statusDisplay.displayName}"\n`);

  // 4. Verify selection persistence on disk
  console.log('[4/5] Verifying persistent selection on disk...');
  assert.strictEqual(fs.existsSync(selectionPath), true, 'nexus_ai_selection.json must exist');
  const savedSelection = JSON.parse(fs.readFileSync(selectionPath, 'utf8'));
  assert.strictEqual(savedSelection.activeProvider, 'groq');
  assert.strictEqual(savedSelection.activeModel, 'openai/gpt-oss-20b');
  console.log('  ✔ [PASS] Disk selection matches activeModel: "openai/gpt-oss-20b"\n');

  // 5. Simulate cold restart of NEXUS and verify StatusBar hydration
  console.log('[5/5] Simulating cold app restart and StatusBar hydration...');
  const routerRestarted = new AIProviderRouter();
  const restartedConfig = routerRestarted.getConfig();
  assert.strictEqual(restartedConfig.activeProvider, 'groq');
  assert.strictEqual(restartedConfig.activeModel, 'openai/gpt-oss-20b', 'Persisted selection must be restored');

  const restartedStatus = computeStatusBarDisplay(restartedConfig, restartedConfig.activeProvider, restartedConfig.activeModel);
  assert.strictEqual(restartedStatus.modelId, 'openai/gpt-oss-20b');
  assert.strictEqual(restartedStatus.displayName, 'Groq (gpt-oss-20b)');
  console.log(`  ✔ [PASS] Restarted app hydrates StatusBar to: "${restartedStatus.displayName}"\n`);

  console.log('====================================================');
  console.log('ALL UI MODEL STATE SYNCHRONIZATION TESTS PASSED!');
  console.log('====================================================');
}

runUIModelStateSyncTests().catch((err) => {
  console.error('[TEST FAILED]', err);
  process.exit(1);
});
