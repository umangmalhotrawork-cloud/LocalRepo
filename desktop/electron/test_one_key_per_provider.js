/**
 * COMPREHENSIVE ARCHITECTURAL TEST: ONE KEY PER PROVIDER
 * 
 * Verifies:
 * 1. ONE API key belongs to ONE provider.
 * 2. Provider key is reusable across ALL models for that provider/account.
 * 3. Credential scope is providerId -> credential (NOT providerId + modelId -> credential).
 * 4. Secure vault structure contains provider-level encrypted keys.
 * 5. Dynamic model discovery updates provider's available models.
 * 6. Switching models within a provider never requests a new API key.
 * 7. All requests across different models resolve to the exact same provider credential.
 * 8. Restart restores provider credential and preserves model selection metadata.
 * 9. Architecture holds for all providers: Groq, Gemini, OpenAI, Claude, DeepSeek, Grok.
 * 10. Model unavailability validation prevents routing to unlisted models.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');

const { AIProviderRouter } = require('./ai/AIProviderRouter');
const { PROVIDER_IDS, PROVIDER_STATUS } = require('./ai/types');

async function runOneKeyPerProviderTests() {
  console.log('====================================================');
  console.log('TESTING ONE KEY PER PROVIDER ARCHITECTURE');
  console.log('====================================================\n');

  const recoveryDir = path.join(process.cwd(), '.nexus-recovery');
  fs.mkdirSync(recoveryDir, { recursive: true });
  const vaultPath = path.join(recoveryDir, 'nexus_ai_vault.json');
  const selectionPath = path.join(recoveryDir, 'nexus_ai_selection.json');

  // Clean test state
  try { if (fs.existsSync(vaultPath)) fs.unlinkSync(vaultPath); } catch (e) {}
  try { if (fs.existsSync(selectionPath)) fs.unlinkSync(selectionPath); } catch (e) {}

  const router = new AIProviderRouter();

  // ----------------------------------------------------
  // TEST SCENARIO: GROQ ONE-KEY REUSABILITY ACROSS MODELS
  // ----------------------------------------------------
  console.log('[SCENARIO 1] Testing Groq single-key multi-model lifecycle...');

  const testGroqKey = 'gsk_mock_valid_groq_master_key_123456789';
  const mockGroqModels = [
    { id: 'openai/gpt-oss-120b', name: 'OpenAI GPT-OSS 120B' },
    { id: 'openai/gpt-oss-20b', name: 'OpenAI GPT-OSS 20B' },
    { id: 'groq/compound', name: 'Groq Compound' },
    { id: 'groq/compound-mini', name: 'Groq Compound Mini' },
    { id: 'qwen/qwen3.6-27b', name: 'Qwen 3.6 27B' },
    { id: 'allam-2-7b', name: 'ALLaM 2 7B' },
  ];

  // Mock Groq dynamic discovery
  const groqProvider = router.providers.get(PROVIDER_IDS.GROQ);
  groqProvider.getAvailableModels = async (key, configuredModel) => {
    assert.strictEqual(key, testGroqKey, 'Dynamic discovery must use provider key');
    groqProvider.dynamicModels = mockGroqModels;
    groqProvider.lastDiscoveryAt = Date.now();
    return {
      authenticated: true,
      reachable: true,
      models: mockGroqModels,
      configuredModel: configuredModel || mockGroqModels[0].id,
      configuredModelAvailable: true,
      totalModels: mockGroqModels.length,
      lastDiscoveryAt: groqProvider.lastDiscoveryAt,
    };
  };

  // 1. Enter ONE Groq API Key
  console.log('  [Step 1] Entering one Groq API key...');
  const setRes = await router.setApiKey(PROVIDER_IDS.GROQ, testGroqKey);
  assert.strictEqual(setRes.success, true, 'setApiKey must succeed');
  assert.strictEqual(setRes.configured, true, 'Provider must be configured');
  assert.strictEqual(setRes.status, PROVIDER_STATUS.CONNECTED, 'Status must be CONNECTED');
  assert.ok(setRes.models.length >= 6, 'Dynamic discovery must return all discovered models');
  console.log('    ✔ [PASS] 1 Groq key configured and dynamic models discovered');

  // 2. Verify vault contains provider-level key only
  console.log('  [Step 2] Verifying secure vault structure...');
  const vaultRaw = JSON.parse(fs.readFileSync(vaultPath, 'utf8'));
  assert.ok(vaultRaw.groq, 'Vault must contain "groq" entry');
  assert.strictEqual(Object.keys(vaultRaw).length, 1, 'Vault must contain exactly 1 entry for groq');
  assert.strictEqual(vaultRaw['groq:openai/gpt-oss-120b'], undefined, 'Must NOT store keys per-model');
  console.log('    ✔ [PASS] Vault stores key at provider scope { groq: <encrypted key> }');

  // 3. Select Model A (openai/gpt-oss-120b) and execute request
  console.log('  [Step 3] Selecting Model A (openai/gpt-oss-120b) and resolving execution...');
  router.setConfig(PROVIDER_IDS.GROQ, 'openai/gpt-oss-120b');
  const resA = router.resolveProviderAndModel(PROVIDER_IDS.GROQ, 'openai/gpt-oss-120b');
  assert.ok(resA, 'Resolution must succeed');
  assert.strictEqual(resA.provider.getId(), 'groq');
  assert.strictEqual(resA.modelId, 'openai/gpt-oss-120b');
  assert.strictEqual(resA.apiKey, testGroqKey, 'Must use stored Groq key');
  console.log('    ✔ [PASS] Model A resolved with stored Groq key');

  // 4. Switch to Model B (groq/compound) - NO new key requested
  console.log('  [Step 4] Switching to Model B (groq/compound) without new key...');
  router.setConfig(PROVIDER_IDS.GROQ, 'groq/compound');
  const cfgB = router.getConfig();
  const groqCfgB = cfgB.providers.find((p) => p.id === 'groq');
  assert.strictEqual(groqCfgB.isConfigured, true, 'Groq must remain connected without prompting for key');
  assert.strictEqual(cfgB.activeModel, 'groq/compound', 'Active model must update');
  
  const resB = router.resolveProviderAndModel(PROVIDER_IDS.GROQ, 'groq/compound');
  assert.ok(resB, 'Resolution must succeed');
  assert.strictEqual(resB.modelId, 'groq/compound');
  assert.strictEqual(resB.apiKey, testGroqKey, 'Must reuse the SAME Groq key');
  console.log('    ✔ [PASS] Model B executed using SAME stored Groq key');

  // 5. Switch to Model C (qwen/qwen3.6-27b) - NO new key requested
  console.log('  [Step 5] Switching to Model C (qwen/qwen3.6-27b) without new key...');
  router.setConfig(PROVIDER_IDS.GROQ, 'qwen/qwen3.6-27b');
  const cfgC = router.getConfig();
  assert.strictEqual(cfgC.activeModel, 'qwen/qwen3.6-27b');

  const resC = router.resolveProviderAndModel(PROVIDER_IDS.GROQ, 'qwen/qwen3.6-27b');
  assert.ok(resC, 'Resolution must succeed');
  assert.strictEqual(resC.modelId, 'qwen/qwen3.6-27b');
  assert.strictEqual(resC.apiKey, testGroqKey, 'Must reuse the SAME Groq key');
  console.log('    ✔ [PASS] Model C executed using SAME stored Groq key');

  // 6. Switch to Model D (openai/gpt-oss-20b)
  console.log('  [Step 6] Switching to Model D (openai/gpt-oss-20b)...');
  router.setConfig(PROVIDER_IDS.GROQ, 'openai/gpt-oss-20b');
  const resD = router.resolveProviderAndModel(PROVIDER_IDS.GROQ, 'openai/gpt-oss-20b');
  assert.strictEqual(resD.modelId, 'openai/gpt-oss-20b');
  assert.strictEqual(resD.apiKey, testGroqKey, 'Must reuse the SAME Groq key');
  console.log('    ✔ [PASS] Model D executed using SAME stored Groq key');

  // 7. Restart NEXUS (re-instantiate router)
  console.log('  [Step 7] Simulating NEXUS app restart...');
  const routerRestarted = new AIProviderRouter();
  assert.strictEqual(routerRestarted.getProviderStatus(PROVIDER_IDS.GROQ), PROVIDER_STATUS.CONNECTED, 'Groq key must persist');
  assert.strictEqual(routerRestarted.apiKeys.get(PROVIDER_IDS.GROQ), testGroqKey, 'Groq key must match');
  assert.strictEqual(routerRestarted.activeProviderId, PROVIDER_IDS.GROQ, 'Active provider must persist');
  assert.strictEqual(routerRestarted.activeModelId, 'openai/gpt-oss-20b', 'Active model selection must persist');
  console.log('    ✔ [PASS] App restart preserved Groq key and independent model selection\n');

  // ----------------------------------------------------
  // TEST SCENARIO 2: ALL PROVIDERS ONE-KEY ARCHITECTURE
  // ----------------------------------------------------
  console.log('[SCENARIO 2] Testing ONE-key architecture across all providers...');

  const allProviders = [
    { id: PROVIDER_IDS.GEMINI, key: 'AIzaSy_mock_gemini_key_123', modelA: 'gemini-1.5-flash', modelB: 'gemini-2.0-flash' },
    { id: PROVIDER_IDS.OPENAI, key: 'sk-proj-mock_openai_key_123', modelA: 'gpt-4o', modelB: 'gpt-4o-mini' },
    { id: PROVIDER_IDS.CLAUDE, key: 'sk-ant-mock_claude_key_123', modelA: 'claude-3-5-sonnet-20241022', modelB: 'claude-3-5-haiku-20241022' },
    { id: PROVIDER_IDS.DEEPSEEK, key: 'sk-mock_deepseek_key_123', modelA: 'deepseek-chat', modelB: 'deepseek-reasoner' },
    { id: PROVIDER_IDS.GROK, key: 'xai-mock_grok_key_123', modelA: 'grok-beta', modelB: 'grok-2-latest' },
  ];

  for (const prov of allProviders) {
    const p = routerRestarted.providers.get(prov.id);
    p.validateKey = async (k) => ({ valid: true, models: p.getModels() });

    console.log(`  Testing provider "${prov.id}"...`);
    const pSetRes = await routerRestarted.setApiKey(prov.id, prov.key);
    assert.strictEqual(pSetRes.success, true);
    assert.strictEqual(routerRestarted.getProviderStatus(prov.id), PROVIDER_STATUS.CONNECTED);

    // Select Model A
    routerRestarted.setConfig(prov.id, prov.modelA);
    const resA = routerRestarted.resolveProviderAndModel(prov.id, prov.modelA);
    assert.strictEqual(resA.apiKey, prov.key);
    assert.strictEqual(resA.modelId, prov.modelA);

    // Switch to Model B - same key, no prompt
    routerRestarted.setConfig(prov.id, prov.modelB);
    const resB = routerRestarted.resolveProviderAndModel(prov.id, prov.modelB);
    assert.strictEqual(resB.apiKey, prov.key);
    assert.strictEqual(resB.modelId, prov.modelB);

    console.log(`    ✔ [PASS] Provider "${prov.id}" supports 1 key across models "${prov.modelA}" and "${prov.modelB}"`);
  }

  // ----------------------------------------------------
  // TEST SCENARIO 3: MODEL UNAVAILABILITY HANDLING
  // ----------------------------------------------------
  console.log('\n[SCENARIO 3] Testing model unavailability validation...');
  try {
    await groqProvider.validateModelAvailability(testGroqKey, 'non-existent-fantasy-model-999b');
    assert.fail('Must throw for unavailable model');
  } catch (err) {
    assert.ok(err.message.includes('unavailable for this API key'), 'Error message must explain model unavailability');
    console.log('  ✔ [PASS] Model unavailability throws structured error prompting model selection');
  }

  console.log('\n====================================================');
  console.log('ALL ONE-KEY-PER-PROVIDER ARCHITECTURAL TESTS PASSED!');
  console.log('====================================================');
}

runOneKeyPerProviderTests().catch((err) => {
  console.error('[TEST FAILED]', err);
  process.exit(1);
});
