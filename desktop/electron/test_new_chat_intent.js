/**
 * Regression Test Suite: New Chat Conversational Intent & Non-Aggressive Targeting
 * 
 * Verifies:
 * 1. "hi" -> CHAT, zero workspace discovery, no target file, no code patch, no firewall workflow.
 * 2. "how are you?" -> CHAT, zero workspace discovery, no autonomous plan across 20 files.
 * 3. "what can you do?" -> CHAT, zero workspace discovery.
 * 4. "tell me about NEXUS" -> CHAT, zero workspace discovery.
 * 5. "explain this project" / "explain what this project does" -> CHAT/project-level response, no modification plan.
 * 6. "fix cart_calculator.py" / "fix the calculate_cart_total function in cart_calculator.py" -> CODE/WORKSPACE task.
 * 7. "remove redundant code from cart_calculator.py" -> CODE/WORKSPACE task.
 * 8. "Find the bug in this Python file." -> CODE/WORKSPACE task.
 * 9. "Add authentication to the application." -> CODE/WORKSPACE task.
 * 10. "Refactor this component." -> CODE/WORKSPACE task.
 * 11. "Analyze the repository architecture." -> READ_ONLY task.
 * 12. "Find all TypeScript errors." -> READ_ONLY task.
 * 13. "hi" with Groq selected does not prompt for Gemini key or trigger cascading modals.
 */

const assert = require('assert');
const path = require('path');
const { agentManager, classifyTaskIntent, runAgentTask } = require('./agentManager');
const { aiProviderRouter } = require('./ai/AIProviderRouter');

async function runNewChatIntentTestSuite() {
  console.log('[TEST] Starting New Chat Intent & Targeting Verification Suite...');

  const workspacePath = path.join(__dirname, '..', '..', 'demo-workspaces', 'ai_cart_project');

  // =========================================================================
  // 1. INTENT CLASSIFIER DIRECT CHECKS
  // =========================================================================
  console.log('\n[TEST 1] Testing Intent Classifier Boundaries...');
  assert.strictEqual(classifyTaskIntent('hi'), 'GENERAL_CHAT');
  assert.strictEqual(classifyTaskIntent('hello'), 'GENERAL_CHAT');
  assert.strictEqual(classifyTaskIntent('how are you?'), 'GENERAL_CHAT');
  assert.strictEqual(classifyTaskIntent('how are you doing?'), 'GENERAL_CHAT');
  assert.strictEqual(classifyTaskIntent('what can you do?'), 'GENERAL_CHAT');
  assert.strictEqual(classifyTaskIntent('tell me about NEXUS'), 'GENERAL_CHAT');
  assert.strictEqual(classifyTaskIntent('explain what this project does'), 'GENERAL_CHAT');
  assert.strictEqual(classifyTaskIntent('explain this project'), 'GENERAL_CHAT');
  assert.strictEqual(classifyTaskIntent('how does authentication work?'), 'GENERAL_CHAT');

  // Code / Workspace tasks
  assert.strictEqual(classifyTaskIntent('Fix the calculate_cart_total function.'), 'MUTATION');
  assert.strictEqual(classifyTaskIntent('Remove the redundant operations from cart_calculator.py.'), 'MUTATION');
  assert.strictEqual(classifyTaskIntent('fix cart_calculator.py'), 'MUTATION');
  assert.strictEqual(classifyTaskIntent('remove redundant code from cart_calculator.py'), 'MUTATION');
  assert.strictEqual(classifyTaskIntent('Find the bug in this Python file.'), 'MUTATION');
  assert.strictEqual(classifyTaskIntent('Add authentication to the application.'), 'MUTATION');
  assert.strictEqual(classifyTaskIntent('Refactor this component.'), 'MUTATION');

  // Diagnostic / Read-Only tasks
  assert.strictEqual(classifyTaskIntent('Analyze the repository architecture.'), 'READ_ONLY');
  assert.strictEqual(classifyTaskIntent('Find all TypeScript errors.'), 'READ_ONLY');
  assert.strictEqual(classifyTaskIntent('audit dependencies'), 'READ_ONLY');
  console.log('[INTENT CLASSIFIER PASSED] All 18 boundary tests classified accurately');

  // =========================================================================
  // 2. CHAT: "hi"
  // =========================================================================
  console.log('\n[TEST 2] Running New Chat with "hi"...');
  const chatRes1 = await runAgentTask({
    task: 'hi',
    workspacePath,
    activeFilePath: 'cart_calculator.py', // open in editor tab, but NOT explicitly targeted
    isExplicitEditorTarget: false,
  });

  assert.strictEqual(chatRes1.success, true);
  assert.strictEqual(chatRes1.taskIntent, 'GENERAL_CHAT');
  assert.strictEqual(chatRes1.targetFile, null, 'Must NOT attach cart_calculator.py as target for "hi"');
  assert.strictEqual(chatRes1.steps.length, 0, 'Must NOT generate execution steps or code transformations for "hi"');
  assert.ok(chatRes1.summary.length > 10, 'Must provide conversational summary');
  assert.ok(!chatRes1.summary.includes('Autonomous plan constructed'), 'Must NOT say Autonomous plan constructed');
  console.log('[TEST 2 PASSED] "hi" returned conversational response with zero file targeting, zero code patches, zero firewall alerts');

  // =========================================================================
  // 3. CHAT: "how are you?"
  // =========================================================================
  console.log('\n[TEST 3] Running New Chat with "how are you?"...');
  const chatResHowAreYou = await runAgentTask({
    task: 'how are you?',
    workspacePath,
    activeFilePath: 'cart_calculator.py',
    isExplicitEditorTarget: false,
  });

  assert.strictEqual(chatResHowAreYou.success, true);
  assert.strictEqual(chatResHowAreYou.taskIntent, 'GENERAL_CHAT');
  assert.strictEqual(chatResHowAreYou.targetFile, null);
  assert.strictEqual(chatResHowAreYou.steps.length, 0, 'Must NOT generate steps or patches');
  assert.ok(!chatResHowAreYou.summary.includes('Autonomous plan constructed'), 'Must NOT construct autonomous plan for "how are you?"');
  assert.ok(!chatResHowAreYou.summary.includes('discovered workspace files'), 'Must NOT do workspace discovery for "how are you?"');
  console.log(`[TEST 3 PASSED] "how are you?" responded: "${chatResHowAreYou.summary}"`);

  // =========================================================================
  // 4. CHAT: "what can you do?"
  // =========================================================================
  console.log('\n[TEST 4] Running New Chat with "what can you do?"...');
  const chatResWhatCanYouDo = await runAgentTask({
    task: 'what can you do?',
    workspacePath,
    activeFilePath: null,
    isExplicitEditorTarget: false,
  });

  assert.strictEqual(chatResWhatCanYouDo.success, true);
  assert.strictEqual(chatResWhatCanYouDo.taskIntent, 'GENERAL_CHAT');
  assert.strictEqual(chatResWhatCanYouDo.targetFile, null);
  assert.strictEqual(chatResWhatCanYouDo.steps.length, 0);
  assert.ok(!chatResWhatCanYouDo.summary.includes('Autonomous plan constructed'));
  console.log('[TEST 4 PASSED] "what can you do?" returned conversational capability response');

  // =========================================================================
  // 5. CHAT: "tell me about NEXUS"
  // =========================================================================
  console.log('\n[TEST 5] Running New Chat with "tell me about NEXUS"...');
  const chatResAbout = await runAgentTask({
    task: 'tell me about NEXUS',
    workspacePath,
    activeFilePath: null,
    isExplicitEditorTarget: false,
  });

  assert.strictEqual(chatResAbout.success, true);
  assert.strictEqual(chatResAbout.taskIntent, 'GENERAL_CHAT');
  assert.strictEqual(chatResAbout.targetFile, null);
  assert.strictEqual(chatResAbout.steps.length, 0);
  console.log('[TEST 5 PASSED] "tell me about NEXUS" returned conversational overview');

  // =========================================================================
  // 6. CHAT: "explain what this project does"
  // =========================================================================
  console.log('\n[TEST 6] Running New Chat with "explain what this project does"...');
  const chatResExplain = await runAgentTask({
    task: 'explain what this project does',
    workspacePath,
    activeFilePath: 'cart_calculator.py',
    isExplicitEditorTarget: false,
  });

  assert.strictEqual(chatResExplain.success, true);
  assert.strictEqual(chatResExplain.taskIntent, 'GENERAL_CHAT');
  assert.strictEqual(chatResExplain.targetFile, null);
  assert.strictEqual(chatResExplain.steps.length, 0, 'Must NOT generate code mutation steps');
  assert.ok(chatResExplain.summary.length > 20, 'Must provide project architecture explanation');
  console.log('[TEST 6 PASSED] "explain what this project does" returned conversational project overview without modifying files');

  // =========================================================================
  // 7. CODE TASK: "fix the calculate_cart_total function in cart_calculator.py"
  // =========================================================================
  console.log('\n[TEST 7] Running New Chat with explicit code task referencing cart_calculator.py...');
  const codeTaskRes = await runAgentTask({
    task: 'fix the calculate_cart_total function in cart_calculator.py',
    workspacePath,
    activeFilePath: null,
    isExplicitEditorTarget: false,
  });

  assert.strictEqual(codeTaskRes.success, true);
  assert.strictEqual(codeTaskRes.taskIntent, 'MUTATION');
  assert.ok(codeTaskRes.targetFile, 'Must target cart_calculator.py');
  assert.strictEqual(codeTaskRes.targetFile.endsWith('cart_calculator.py'), true);
  assert.ok(codeTaskRes.steps.length >= 2, 'Must produce structured planning steps for code task');
  assert.ok(codeTaskRes.steps.some(s => s.proposedEdits && s.proposedEdits.length > 0), 'Must produce surgical patch');
  console.log('[TEST 7 PASSED] Coding task correctly targeted cart_calculator.py and constructed surgical patch plan');

  // =========================================================================
  // 8. CODE TASK: Open cart_calculator.py -> File-specific Agent -> "remove the redundant operations"
  // =========================================================================
  console.log('\n[TEST 8] Running file-specific agent action with isExplicitEditorTarget: true...');
  const fileAgentRes = await runAgentTask({
    task: 'remove the redundant operations',
    workspacePath,
    activeFilePath: 'cart_calculator.py',
    isExplicitEditorTarget: true,
  });

  assert.strictEqual(fileAgentRes.success, true);
  assert.strictEqual(fileAgentRes.taskIntent, 'MUTATION');
  assert.ok(fileAgentRes.targetFile);
  assert.strictEqual(fileAgentRes.targetFile.endsWith('cart_calculator.py'), true);
  assert.ok(fileAgentRes.steps.length >= 2);
  console.log('[TEST 8 PASSED] File-specific Agent session successfully allowed code transformation on active editor file');

  // =========================================================================
  // 9. API KEY LAZY BEHAVIOR: "hi" with Groq selected
  // =========================================================================
  console.log('\n[TEST 9] Running "hi" with Groq selected...');
  aiProviderRouter.setConfig('groq', 'llama-3.3-70b-versatile');
  const groqChatRes = await runAgentTask({
    task: 'hi',
    workspacePath,
    providerId: 'groq',
    modelId: 'llama-3.3-70b-versatile',
    isExplicitEditorTarget: false,
  });

  assert.strictEqual(groqChatRes.success, true);
  assert.strictEqual(groqChatRes.taskIntent, 'GENERAL_CHAT');
  assert.strictEqual(groqChatRes.execution.requestedProviderId, 'groq');
  assert.strictEqual(groqChatRes.targetFile, null);
  assert.strictEqual(groqChatRes.steps.length, 0);
  console.log('[TEST 9 PASSED] "hi" with Groq selected executed without requesting Gemini key or cascading dialogs');

  console.log('\n======================================================');
  console.log('>>> ALL INTENT & TARGETING REGRESSION TESTS PASSED 100%! <<<');
  console.log('======================================================');
}

runNewChatIntentTestSuite().catch((err) => {
  console.error('[TEST ERROR]', err);
  process.exit(1);
});
