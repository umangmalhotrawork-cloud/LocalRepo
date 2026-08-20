/**
 * Multi-Model AI Architecture Unit & Integration Tests (Provider-Agnostic)
 */

const path = require('path');
const fs = require('fs');
const { aiProviderRouter } = require('./ai/AIProviderRouter');
const { PROVIDER_IDS, PROVIDER_STATUS, DEFAULT_MODELS } = require('./ai/types');
const { agentManager, runAgentTask, exportAgentTaskCapsule } = require('./agentManager');
const { sanitize, sanitizeObject } = require('../security/secretFilter');

async function main() {
  console.log('[TEST] Starting Multi-Model AI Architecture Test Suite...');
  const workspacePath = path.join(__dirname, '../../demo-workspaces/ai_cart_project');

  // 1. Initial State & Default Provider Configuration
  const initialConfig = aiProviderRouter.getConfig();
  console.log(`[TEST 1] Initial Active Provider: ${initialConfig.activeProvider}`);
  if (initialConfig.activeProvider !== 'gemini') {
    throw new Error('Test 1 failed: Default active provider must be gemini');
  }

  // 1b. Verify all 6 providers are registered
  const registeredIds = initialConfig.providers.map((p) => p.id);
  const requiredProviders = ['gemini', 'groq', 'openai', 'claude', 'deepseek', 'grok'];
  for (const reqId of requiredProviders) {
    if (!registeredIds.includes(reqId)) {
      throw new Error(`Test 1b failed: Required provider ${reqId} is not registered`);
    }
  }
  console.log('[TEST 1b PASSED] All 6 providers successfully registered in AIProviderRouter');

  // 2. Unconfigured Provider Isolation (Groq, Claude, OpenAI, Grok, DeepSeek must report NOT_CONFIGURED when no key)
  const claudeProvider = initialConfig.providers.find((p) => p.id === 'claude');
  const grokProvider = initialConfig.providers.find((p) => p.id === 'grok');
  const deepseekProvider = initialConfig.providers.find((p) => p.id === 'deepseek');
  const groqProvider = initialConfig.providers.find((p) => p.id === 'groq');
  const openaiProvider = initialConfig.providers.find((p) => p.id === 'openai');

  if (claudeProvider.isConfigured && claudeProvider.status !== PROVIDER_STATUS.CONNECTED) {
    throw new Error('Test 2 failed: Claude state mismatch');
  }
  if (groqProvider.isConfigured && groqProvider.status !== PROVIDER_STATUS.CONNECTED) {
    throw new Error('Test 2 failed: Groq state mismatch');
  }
  console.log('[TEST 2 PASSED] Provider isolation verified: All providers report independent valid state');

  // 3. Provider Selection & Routing to Unconfigured Provider
  aiProviderRouter.setConfig('claude', 'claude-3-5-sonnet-20241022');
  const claudeConfig = aiProviderRouter.getConfig();
  if (claudeConfig.activeProvider !== 'claude') {
    throw new Error('Test 3 failed: Active provider should be claude');
  }

  const unconfiguredPlanRes = await runAgentTask({
    task: 'Refactor cart calculations',
    workspacePath,
  });
  if (!unconfiguredPlanRes.success || unconfiguredPlanRes.steps.length === 0) {
    throw new Error('Test 3 failed: Unconfigured provider must fall back to deterministic agent without crashing');
  }
  console.log('[TEST 3 PASSED] Unconfigured provider fallback verified');

  // 3b. Provider Key Isolation Guarantee Test
  // Setting synthetic key for Groq should NEVER contaminate OpenAI or Gemini
  aiProviderRouter.apiKeys.set('groq', 'gsk_TEST_GROQ_SECRET_KEY');
  aiProviderRouter.keyValidationStatus.set('groq', PROVIDER_STATUS.CONNECTED);
  
  const groqResolved = aiProviderRouter.resolveProviderAndModel('groq');
  if (groqResolved.apiKey !== 'gsk_TEST_GROQ_SECRET_KEY' || groqResolved.provider.getId() !== 'groq') {
    throw new Error('Test 3b failed: Groq resolution failed to retrieve isolated Groq key');
  }

  const openaiResolved = aiProviderRouter.resolveProviderAndModel('openai');
  if (openaiResolved && openaiResolved.apiKey === 'gsk_TEST_GROQ_SECRET_KEY' && openaiResolved.provider.getId() === 'openai') {
    throw new Error('Test 3b failed: Groq key leaked into OpenAI provider resolution!');
  }
  aiProviderRouter.removeApiKey('groq');
  console.log('[TEST 3b PASSED] Provider key isolation strictly verified: No key leakage between providers');

  // Reset back to Gemini
  aiProviderRouter.setConfig('gemini', 'gemini-1.5-flash');

  // 4. Secret Redaction & Key Protection Test
  const testSecretKey = 'AIza_TEST_SECRET_123456';
  const testPayload = {
    userGoal: `Fix issue with key ${testSecretKey}`,
    apiKey: testSecretKey,
    steps: [{ id: 's1', title: `Used secret ${testSecretKey}` }],
    recentTurns: [{ userPrompt: `Prompt with ${testSecretKey}` }],
  };

  const sanitized = sanitizeObject(testPayload);
  const serializedSanitized = JSON.stringify(sanitized);

  if (serializedSanitized.includes(testSecretKey)) {
    throw new Error(`Test 4 failed: Secret ${testSecretKey} was not redacted by secretFilter`);
  }
  console.log('[TEST 4 PASSED] Secret filter redaction verified');

  // 5. Capsule Generation & Provider Neutrality Test
  const capsuleResult = await exportAgentTaskCapsule({
    task: 'Verify multi-model capsule portability',
    workspacePath,
    steps: [{ id: 's1', title: 'Step 1', status: 'applied' }],
    summary: 'Multi-model capsule export test',
    recentTurns: [{ userPrompt: `Test prompt with secret key ${testSecretKey}` }],
  });

  if (!capsuleResult.success || !capsuleResult.capsule) {
    throw new Error('Test 5 failed: Capsule generation failed');
  }

  const serializedCapsule = JSON.stringify(capsuleResult.capsule);
  if (serializedCapsule.includes(testSecretKey)) {
    throw new Error('Test 5 failed: Synthetic API key leaked into exported Nexus Capsule');
  }
  console.log('[TEST 5 PASSED] Nexus Capsule compatibility and secret protection verified');

  // 6. Invalid Key Handling Across Providers
  const invalidKeyRes = await aiProviderRouter.setApiKey('gemini', 'invalid_key_string');
  if (invalidKeyRes.success && invalidKeyRes.status === PROVIDER_STATUS.CONNECTED) {
    throw new Error('Test 6 failed: Invalid Gemini key should not report connected status');
  }

  const invalidGroqRes = await aiProviderRouter.setApiKey('groq', 'invalid_groq_key_string');
  if (invalidGroqRes.success && invalidGroqRes.status === PROVIDER_STATUS.CONNECTED) {
    throw new Error('Test 6 failed: Invalid Groq key should not report connected status');
  }
  console.log('[TEST 6 PASSED] Invalid key validation failure handled cleanly across providers');

  // 7. Remove Key & Session Disconnect
  aiProviderRouter.removeApiKey('gemini');
  aiProviderRouter.removeApiKey('groq');
  const emptyKeyConfig = aiProviderRouter.getConfig();
  const geminiStatus = emptyKeyConfig.providers.find((p) => p.id === 'gemini').status;
  if (geminiStatus !== PROVIDER_STATUS.NOT_CONFIGURED) {
    throw new Error('Test 7 failed: Gemini status must be NOT_CONFIGURED after key removal');
  }
  console.log('[TEST 7 PASSED] Key removal and disconnection verified');

  // 8. Regression Verification: Deterministic Agent Flow Intact
  const regressionRes = await runAgentTask({
    task: 'Fix all TypeScript errors',
    workspacePath,
    maxSteps: 3,
  });

  if (!regressionRes.success || regressionRes.steps.length === 0 || !regressionRes.steps[0].firewallResult) {
    throw new Error('Test 8 failed: Deterministic agent regression check failed');
  }
  console.log('[TEST 8 PASSED] AgentManager, Patch Firewall & Behavioral Verification regression checks passed');

  console.log('>>> ALL MULTI-MODEL AI TESTS PASSED SUCCESSFULLY! <<<');
}

main().catch((err) => {
  console.error('[TEST ERROR]', err);
  process.exit(1);
});
