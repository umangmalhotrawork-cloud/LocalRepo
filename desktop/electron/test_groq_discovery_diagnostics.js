/**
 * Test Groq Model Discovery, Availability Validation, and Diagnostics
 */

const assert = require('assert');
const { aiProviderRouter } = require('./ai/AIProviderRouter');
const GroqProvider = require('./ai/GroqProvider');
const { PROVIDER_IDS } = require('./ai/types');

async function runGroqDiscoveryTests() {
  console.log('==================================================');
  console.log('TESTING GROQ MODEL DISCOVERY & DIAGNOSTICS');
  console.log('==================================================\n');

  const groq = aiProviderRouter.providers.get('groq');
  assert.ok(groq, 'GroqProvider must exist in router');

  // Test 1: getAvailableModels without key
  console.log('[1/7] Testing getAvailableModels with missing key...');
  const noKeyDiag = await groq.getAvailableModels('');
  assert.strictEqual(noKeyDiag.authenticated, false, 'Missing key must not be authenticated');
  assert.strictEqual(noKeyDiag.reachable, false, 'Missing key must report unreachable');
  assert.ok(noKeyDiag.error.includes('missing or not configured'), 'Error must mention missing key');
  console.log('  ✔ [PASS] Missing key handled cleanly\n');

  // Test 2: Mocking Groq /models discovery response
  console.log('[2/7] Testing normalization of /models response...');
  const mockModelsResponse = {
    object: 'list',
    data: [
      { id: 'llama-3.1-8b-instant', object: 'model', created: 1720000000, owned_by: 'Meta', active: true, context_window: 131072 },
      { id: 'llama-3.3-70b-versatile', object: 'model', created: 1730000000, owned_by: 'Meta', active: true, context_window: 131072 },
      { id: 'whisper-large-v3', object: 'model', created: 1710000000, owned_by: 'OpenAI', active: true, context_window: 448 },
      { id: 'deepseek-r1-distill-llama-70b', object: 'model', created: 1735000000, owned_by: 'DeepSeek', active: true, context_window: 131072 }
    ]
  };

  const origRequest = groq.request;
  groq.request = async function(endpoint, method, apiKey, body, headers, timeoutMs) {
    if (endpoint === '/models' || endpoint.endsWith('/models')) {
      return { statusCode: 200, data: mockModelsResponse };
    }
    return origRequest.call(this, endpoint, method, apiKey, body, headers, timeoutMs);
  };

  const diag = await groq.getAvailableModels('gsk_test_mock_valid_key', 'llama-3.1-8b-instant');
  assert.strictEqual(diag.authenticated, true, 'Mock valid key must report authenticated: true');
  assert.strictEqual(diag.reachable, true, 'Must report reachable: true');
  assert.strictEqual(diag.configuredModelAvailable, true, 'llama-3.1-8b-instant must be available');
  assert.strictEqual(diag.models.length, 3, 'Whisper large non-chat model must be filtered out');

  // Verify sanitized schema
  for (const m of diag.models) {
    assert.ok(typeof m.id === 'string', 'Model id must be string');
    assert.ok(typeof m.active === 'boolean', 'Model active must be boolean');
    assert.ok(typeof m.contextWindow === 'number', 'Model contextWindow must be number');
    assert.ok(typeof m.ownedBy === 'string', 'Model ownedBy must be string');
    assert.ok(!m.apiKey && !m.key, 'Model schema must NEVER contain API keys or secrets');
  }
  console.log('  ✔ [PASS] /models sanitized and normalized correctly\n');

  // Test 3: Unavailable Model Validation
  console.log('[3/7] Testing unavailable model rejection (no silent provider switch)...');
  let rejected = false;
  try {
    await groq.validateModelAvailability('gsk_test_mock_valid_key', 'llama-non-existent-999b');
  } catch (err) {
    rejected = true;
    assert.ok(err.message.includes('unavailable for this API key') || err.message.includes('unavailable for this Groq account/project'), 'Must report explicit model unavailable error');
    assert.ok(err.message.includes('llama-3.1-8b-instant'), 'Must list available models in error message');
  }
  assert.ok(rejected, 'Must reject unavailable model before sending chat/code action request');
  console.log('  ✔ [PASS] Unavailable model rejected with clear error\n');

  // Test 4: Available Model Validation
  console.log('[4/7] Testing available model validation...');
  const validAvail = await groq.validateModelAvailability('gsk_test_mock_valid_key', 'llama-3.1-8b-instant');
  assert.strictEqual(validAvail, true, 'Available model must pass validation');
  console.log('  ✔ [PASS] Available model passed validation\n');

  // Test 5: Authentication failure handling (401)
  console.log('[5/7] Testing 401 Authentication Failure in discovery...');
  groq.request = async function(endpoint) {
    if (endpoint === '/models' || endpoint.endsWith('/models')) {
      const err = new Error('Invalid API Key provided');
      err.statusCode = 401;
      throw err;
    }
    return origRequest.apply(this, arguments);
  };

  const authFailDiag = await groq.getAvailableModels('gsk_bad_key');
  assert.strictEqual(authFailDiag.authenticated, false, '401 must report authenticated: false');
  assert.ok(authFailDiag.error.includes('Authentication/permission failed'), 'Must report clear auth failure');
  console.log('  ✔ [PASS] 401 error handled with clear message\n');

  // Test 6: Router Diagnostics Method
  console.log('[6/7] Testing aiProviderRouter.getProviderDiagnostics...');
  aiProviderRouter.apiKeys.set('groq', 'gsk_router_test_key');
  groq.request = async function(endpoint) {
    if (endpoint === '/models' || endpoint.endsWith('/models')) {
      return { statusCode: 200, data: mockModelsResponse };
    }
    return origRequest.apply(this, arguments);
  };

  const routerDiag = await aiProviderRouter.getProviderDiagnostics('groq');
  assert.strictEqual(routerDiag.authenticated, true);
  assert.strictEqual(routerDiag.reachable, true);
  assert.ok(Array.isArray(routerDiag.models));
  console.log('  ✔ [PASS] Router diagnostics returned sanitized report\n');

  // Test 7: Restore original request method & verify other providers
  groq.request = origRequest;
  console.log('[7/7] Verifying other providers (Gemini, OpenAI, Claude, DeepSeek, Grok) untouched...');
  assert.strictEqual(aiProviderRouter.providers.get('gemini').getId(), 'gemini');
  assert.strictEqual(aiProviderRouter.providers.get('openai').getId(), 'openai');
  assert.strictEqual(aiProviderRouter.providers.get('claude').getId(), 'claude');
  assert.strictEqual(aiProviderRouter.providers.get('deepseek').getId(), 'deepseek');
  assert.strictEqual(aiProviderRouter.providers.get('grok').getId(), 'grok');
  console.log('  ✔ [PASS] Other provider adapters completely untouched\n');

  console.log('==================================================');
  console.log('ALL GROQ DISCOVERY & DIAGNOSTICS TESTS PASSED (7/7)');
  console.log('==================================================');
}

runGroqDiscoveryTests().catch((err) => {
  console.error('Test failed with exception:', err);
  process.exit(1);
});
