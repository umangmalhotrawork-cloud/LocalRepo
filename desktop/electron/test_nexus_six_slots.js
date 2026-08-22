/**
 * NEXUS Six-Slot Gemini Backend Verification Suite
 * Tests 10 specific criteria:
 * 1. Six independent slots (nexus1..nexus6) registered
 * 2. Slot 1 uses Key 1, Slot 6 uses Key 6 (strict key isolation)
 * 3. Zero automatic rotation/fallback across slots
 * 4. Slot switching without re-entering keys
 * 5. Slot persistence across restarts
 * 6. Encrypted vault credential storage
 * 7. Secret filtering & zero raw credential exposure in getConfig
 * 8. Diagnostic status metadata (slot, provider, status, lastRequestAt, lastStatus)
 * 9. Coding agent execution, tool calling, and ChangeSet generation on active slot
 * 10. Test-safe 429 handling with no slot rotation on error
 */

const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { AIProviderRouter } = require('./ai/AIProviderRouter');
const { PROVIDER_IDS, DEFAULT_MODELS, PROVIDER_METADATA } = require('./ai/types');
const { harnessRuntime } = require('./harness');
const secretFilter = require('../security/secretFilter');

async function runTests() {
  console.log('====================================================');
  console.log('RUNNING NEXUS 6-SLOT GEMINI BACKEND VERIFICATION');
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
  // TEST 1: Six independent slots registered with Gemini backend
  // ----------------------------------------------------
  test('1. Six independent slots (nexus1..nexus6) registered with Gemini backend', () => {
    const router = new AIProviderRouter();
    const config = router.getConfig();

    const slotIds = [
      PROVIDER_IDS.NEXUS_1,
      PROVIDER_IDS.NEXUS_2,
      PROVIDER_IDS.NEXUS_3,
      PROVIDER_IDS.NEXUS_4,
      PROVIDER_IDS.NEXUS_5,
      PROVIDER_IDS.NEXUS_6,
    ];

    slotIds.forEach((slotId, index) => {
      const provider = router.providers.get(slotId);
      assert.ok(provider, `Provider for slot ${slotId} must be registered`);
      assert.strictEqual(provider.getName(), `NEXUS ${index + 1}`);
      assert.strictEqual(provider.secondaryName, 'Gemini');
      assert.strictEqual(provider.slotIndex, index + 1);

      const pConfig = config.providers.find((p) => p.id === slotId);
      assert.ok(pConfig, `Slot ${slotId} must appear in getConfig()`);
      assert.strictEqual(pConfig.name, `NEXUS ${index + 1}`);
      assert.strictEqual(pConfig.secondaryName, 'Gemini');
      assert.strictEqual(pConfig.defaultModel, 'gemini-1.5-flash');
    });
  });

  // ----------------------------------------------------
  // TEST 2: Slot 1 uses Key 1, Slot 6 uses Key 6 (strict isolation)
  // ----------------------------------------------------
  test('2. Each slot uses ONLY its own isolated Gemini API key', () => {
    const router = new AIProviderRouter();
    const mockKeys = {
      nexus1: 'AIzaSyKey1_DummyKey_NexusSlot1',
      nexus2: 'AIzaSyKey2_DummyKey_NexusSlot2',
      nexus3: 'AIzaSyKey3_DummyKey_NexusSlot3',
      nexus4: 'AIzaSyKey4_DummyKey_NexusSlot4',
      nexus5: 'AIzaSyKey5_DummyKey_NexusSlot5',
      nexus6: 'AIzaSyKey6_DummyKey_NexusSlot6',
    };

    for (const [slotId, key] of Object.entries(mockKeys)) {
      router.apiKeys.set(slotId, key);
      router.keyValidationStatus.set(slotId, 'CONNECTED');
    }

    for (const [slotId, key] of Object.entries(mockKeys)) {
      const resolved = router.resolveProviderAndModel(slotId, 'gemini-1.5-flash');
      assert.ok(resolved, `Should resolve ${slotId}`);
      assert.strictEqual(resolved.apiKey, key, `${slotId} must receive its own key and not any other slot's key`);
      assert.strictEqual(resolved.isFallback, false);
      assert.strictEqual(resolved.provider.getId(), slotId);
    }
  });

  // ----------------------------------------------------
  // TEST 3: Zero automatic rotation or fallback across slots
  // ----------------------------------------------------
  test('3. Zero automatic fallback or slot rotation when a slot is unconfigured or fails', () => {
    const router = new AIProviderRouter();
    // Only configure slot 2, leave slot 1 unconfigured
    router.apiKeys.clear();
    router.apiKeys.set('nexus2', 'AIzaSyKey2_DummyKey');
    router.keyValidationStatus.set('nexus2', 'CONNECTED');

    // Requesting unconfigured slot 1 must NOT fall back to slot 2
    const resolvedSlot1 = router.resolveProviderAndModel('nexus1', 'gemini-1.5-flash');
    assert.strictEqual(resolvedSlot1, null, 'Unconfigured NEXUS 1 must return null and never auto-fallback to NEXUS 2');

    // Requesting slot 2 must return slot 2
    const resolvedSlot2 = router.resolveProviderAndModel('nexus2', 'gemini-1.5-flash');
    assert.ok(resolvedSlot2);
    assert.strictEqual(resolvedSlot2.provider.getId(), 'nexus2');
    assert.strictEqual(resolvedSlot2.isFallback, false);
  });

  // ----------------------------------------------------
  // TEST 4: Slot switching without re-entering keys
  // ----------------------------------------------------
  test('4. Seamless slot switching without re-entering credentials', () => {
    const router = new AIProviderRouter();
    router.apiKeys.set('nexus1', 'AIzaSyKey1');
    router.apiKeys.set('nexus3', 'AIzaSyKey3');
    router.keyValidationStatus.set('nexus1', 'CONNECTED');
    router.keyValidationStatus.set('nexus3', 'CONNECTED');

    router.setConfig('nexus1', 'gemini-1.5-pro');
    assert.strictEqual(router.activeProviderId, 'nexus1');
    assert.strictEqual(router.activeModelId, 'gemini-1.5-pro');

    // Switch to slot 3
    router.setConfig('nexus3', 'gemini-2.0-flash');
    assert.strictEqual(router.activeProviderId, 'nexus3');
    assert.strictEqual(router.activeModelId, 'gemini-2.0-flash');

    const resolved = router.resolveProviderAndModel();
    assert.strictEqual(resolved.provider.getId(), 'nexus3');
    assert.strictEqual(resolved.apiKey, 'AIzaSyKey3');
    assert.strictEqual(resolved.modelId, 'gemini-2.0-flash');
  });

  // ----------------------------------------------------
  // TEST 5: Slot persistence across restarts
  // ----------------------------------------------------
  test('5. Active slot and model selection persist across restarts', () => {
    const router1 = new AIProviderRouter();
    router1.saveActiveSelection('nexus5', 'gemini-1.5-flash');

    const router2 = new AIProviderRouter();
    assert.strictEqual(router2.activeProviderId, 'nexus5');
    assert.strictEqual(router2.activeModelId, 'gemini-1.5-flash');
  });

  // ----------------------------------------------------
  // TEST 6: Encrypted vault credential storage
  // ----------------------------------------------------
  test('6. Vault persists per-slot credentials securely', () => {
    const router = new AIProviderRouter();
    router.saveKeyToVault('nexus4', 'AIzaSy_Secret_Key_4');

    const vaultPath = router.getVaultFilePath();
    assert.ok(fs.existsSync(vaultPath), 'Vault file must exist');

    const vaultRaw = JSON.parse(fs.readFileSync(vaultPath, 'utf8'));
    assert.ok(vaultRaw.nexus4, 'Vault must contain nexus4 key entry');
    // Ensure raw plaintext key is not stored directly if enc/b64 is used
    assert.ok(vaultRaw.nexus4.enc || vaultRaw.nexus4.b64, 'Vault entry must be encoded/encrypted');
    assert.strictEqual(vaultRaw.nexus4.raw, undefined, 'Plaintext key should not be stored as raw');

    // Clean up
    router.removeKeyFromVault('nexus4');
  });

  // ----------------------------------------------------
  // TEST 7: Zero raw credential exposure in getConfig & secret filtering
  // ----------------------------------------------------
  test('7. getConfig never exposes raw API keys to renderer and filters secrets', () => {
    const router = new AIProviderRouter();
    const rawSecret = 'AIzaSy_Secret_Gemini_Key_9999';
    router.apiKeys.set('nexus1', rawSecret);
    router.keyValidationStatus.set('nexus1', 'CONNECTED');

    const config = router.getConfig();
    const jsonString = JSON.stringify(config);

    assert.ok(!jsonString.includes(rawSecret), 'getConfig JSON must NEVER contain the raw API key');

    const slot1 = config.providers.find((p) => p.id === 'nexus1');
    assert.ok(slot1.maskedKey.includes('••••••••'), 'Masked key must hide majority of the credential');
    assert.ok(!slot1.maskedKey.includes(rawSecret));

    // Also verify secretFilter
    const sanitized = secretFilter.sanitize(`Executing on NEXUS 1 with key ${rawSecret}`);
    assert.ok(!sanitized.includes(rawSecret), 'secretFilter must sanitize raw keys');
  });

  // ----------------------------------------------------
  // TEST 8: Diagnostic status metadata
  // ----------------------------------------------------
  test('8. Slot diagnostics track status, provider, and lastRequest without exposing secrets', () => {
    const router = new AIProviderRouter();
    router.apiKeys.set('nexus1', 'AIzaSyKey1');
    router.keyValidationStatus.set('nexus1', 'CONNECTED');

    router.recordSlotRequest('nexus1', 'SUCCESS', 'gemini-1.5-flash');

    const config = router.getConfig();
    const slot1 = config.providers.find((p) => p.id === 'nexus1');

    assert.ok(slot1.diagnostics, 'Slot must have diagnostics');
    assert.strictEqual(slot1.diagnostics.slotId, 'nexus1');
    assert.strictEqual(slot1.diagnostics.name, 'NEXUS 1');
    assert.strictEqual(slot1.diagnostics.secondaryName, 'Gemini');
    assert.strictEqual(slot1.diagnostics.status, 'SUCCESS');
    assert.strictEqual(slot1.diagnostics.lastModel, 'gemini-1.5-flash');
    assert.ok(typeof slot1.diagnostics.lastRequestAt === 'number');
    assert.strictEqual(slot1.diagnostics.apiKey, undefined);
  });

  // ----------------------------------------------------
  // TEST 9: Coding agent execution & ChangeSet generation on active slot
  // ----------------------------------------------------
  await asyncTest('9. Harness turn execution on NEXUS 1 triggers tool calling and stages ChangeSet', async () => {
    const workspacePath = path.resolve(__dirname, 'test_workspace_six_slots');
    if (!fs.existsSync(workspacePath)) {
      fs.mkdirSync(workspacePath, { recursive: true });
    }

    const testFile = path.join(workspacePath, 'cart_calculator.py');
    fs.writeFileSync(
      testFile,
      'def calculate_total(prices):\n    total = 0\n    total += 0  # Redundant\n    for p in prices:\n        total += p\n    return total\n'
    );

    const router = harnessRuntime.modelAdapter.router;
    router.apiKeys.set('nexus1', 'AIzaSyMockKey');
    router.keyValidationStatus.set('nexus1', 'CONNECTED');
    router.setConfig('nexus1', 'gemini-1.5-flash');

    let iteration = 0;
    const mockHandler = (messages, tools, options) => {
      iteration++;
      if (iteration === 1) {
        return {
          content: 'I analyzed cart_calculator.py and found the redundant arithmetic operation.',
          toolCalls: [
            {
              id: 'call_gemini_patch_1',
              name: 'apply_patch',
              arguments: {
                edits: [
                  {
                    filePath: 'cart_calculator.py',
                    original: 'def calculate_total(prices):\n    total = 0\n    total += 0  # Redundant\n    for p in prices:\n        total += p\n    return total\n',
                    replacement: 'def calculate_total(prices):\n    total = 0\n    for p in prices:\n        total += p\n    return total\n',
                  },
                ],
              },
            },
          ],
        };
      }
      return {
        content: 'Proposed patch applied to ChangeSet and awaiting approval.',
        toolCalls: [],
      };
    };

    const thread = await harnessRuntime.createThread({
      userInput: 'Fix redundant operations in cart_calculator.py',
      workspacePath,
      providerId: 'nexus1',
      modelId: 'gemini-1.5-flash',
    });

    const turn = await harnessRuntime.runTurn({
      threadId: thread.threadId,
      userInput: 'Fix redundant operations in cart_calculator.py',
      workspacePath,
      activeFilePath: testFile,
      approvalMode: 'auto',
      providerId: 'nexus1',
      modelId: 'gemini-1.5-flash',
      modelHandler: mockHandler,
    });

    assert.ok(turn.success, `Turn must succeed: ${turn.error || ''}`);
    assert.strictEqual(turn.providerId, 'nexus1');
    assert.strictEqual(turn.modelId, 'gemini-1.5-flash');
    const items = harnessRuntime.itemStore.getItemsByTurn(turn.turnId);
    assert.ok(
      items.some((i) => i.type === 'TOOL_CALL' || i.type === 'CHANGE_SET' || i.type === 'FILE_CHANGE'),
      'Must stage ChangeSet and record tool calls'
    );

    // Clean up
    fs.rmSync(workspacePath, { recursive: true, force: true });
  });

  // ----------------------------------------------------
  // TEST 10: Test-safe 429 error handling with ZERO slot rotation
  // ----------------------------------------------------
  await asyncTest('10. HTTP 429 rate-limit on NEXUS 1 produces structured error and never consumes NEXUS 2', async () => {
    const router = harnessRuntime.modelAdapter.router;
    router.apiKeys.set('nexus1', 'AIzaSyKey1');
    router.apiKeys.set('nexus2', 'AIzaSyKey2');
    router.keyValidationStatus.set('nexus1', 'CONNECTED');
    router.keyValidationStatus.set('nexus2', 'CONNECTED');
    router.setConfig('nexus1', 'gemini-1.5-flash');

    let nexus2Contacted = false;

    const mock429Handler = (messages, tools, options) => {
      if (options.providerId === 'nexus2') {
        nexus2Contacted = true;
      }
      const err = new Error('Resource has been exhausted (e.g. check quota). Please retry in 6.5s');
      err.statusCode = 429;
      err.providerId = 'nexus1';
      err.modelId = 'gemini-1.5-flash';
      err.retryAfter = '6.5s';
      throw err;
    };

    const thread = await harnessRuntime.createThread({
      userInput: 'Test 429 handling',
      providerId: 'nexus1',
      modelId: 'gemini-1.5-flash',
    });

    const turn = await harnessRuntime.runTurn({
      threadId: thread.threadId,
      userInput: 'Test 429 handling',
      providerId: 'nexus1',
      modelId: 'gemini-1.5-flash',
      modelHandler: mock429Handler,
    });

    assert.strictEqual(turn.success, false, 'Turn must report failure on 429');
    assert.strictEqual(turn.isRateLimit, true, 'isRateLimit must be true');
    assert.strictEqual(turn.rateInfo?.providerId, 'nexus1');
    assert.strictEqual(turn.rateInfo?.modelId, 'gemini-1.5-flash');
    assert.strictEqual(nexus2Contacted, false, 'NEXUS 2 must NEVER be contacted on NEXUS 1 429 error');
  });

  console.log('\n====================================================');
  console.log(`ALL TESTS PASSED: ${passed}/${total}`);
  console.log('====================================================\n');
}

runTests().catch((err) => {
  console.error('[TEST-FATAL]', err);
  process.exit(1);
});
