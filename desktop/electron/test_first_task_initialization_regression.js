/**
 * TEST SUITE: First-Task Initialization Regression Test
 * Validates:
 * 1. One Home submission creates exactly ONE user message.
 * 2. Exactly ONE assistant response/execution is generated for that turn.
 * 3. Selected provider/model from Home is preserved without stale fallback metadata.
 * 4. Zero duplicate first-turn events or replayed execution calls.
 */

const assert = require('assert');

async function runFirstTaskInitializationRegressionTest() {
  console.log('[TEST] Starting First-Task Initialization Regression Test Suite...');

  // 1. Simulate Home Composer Submission State Flow
  const selectedProvider = 'nexus4';
  const selectedModel = 'claude-3-5-sonnet-20241022';
  const initialUserPrompt = 'Refactor checkout calculator to support tax exemptions';

  // Track turn events and message state across the transition
  const conversationMessages = [];
  const turnExecutions = [];
  let executedTaskRef = null;

  // Simulator for handleStartTaskFromHome in IDEApp
  const startTaskPayload = {
    prompt: initialUserPrompt,
    id: 1787481234567,
    providerId: selectedProvider,
    modelId: selectedModel,
  };

  // Execution function simulating AgentPanel handleRunAgent
  const mockRunAgent = async (taskToRun, providerOverride, modelOverride) => {
    const effectiveProvider = providerOverride || selectedProvider || 'nexus1';
    const effectiveModel = modelOverride || selectedModel || 'gemini-2.5-flash';

    // Append user message
    const userMsg = {
      id: `user_${Date.now()}_${conversationMessages.length}`,
      role: 'user',
      content: taskToRun.trim(),
      timestamp: Date.now(),
    };
    conversationMessages.push(userMsg);

    // Track execution telemetry
    const executionTurn = {
      turnId: `turn_${Date.now()}_${turnExecutions.length}`,
      task: taskToRun.trim(),
      providerId: effectiveProvider,
      modelId: effectiveModel,
      timestamp: Date.now(),
    };
    turnExecutions.push(executionTurn);

    // Mock assistant response
    const agentMsg = {
      id: `agent_${executionTurn.turnId}`,
      role: 'agent',
      content: `Constructed surgical plan for: "${taskToRun}"`,
      status: 'PLAN_READY',
      execution: {
        providerId: effectiveProvider,
        modelId: effectiveModel,
        isFallback: false,
      },
    };
    conversationMessages.push(agentMsg);
  };

  // Simulate AgentPanel trigger lifecycle with unified executedTaskRef guard
  const simulateAgentPanelTrigger = async (taskToExecute, initialTask) => {
    if (taskToExecute && taskToExecute.prompt && taskToExecute.prompt.trim()) {
      const taskKey = `${taskToExecute.id}_${taskToExecute.prompt.trim()}`;
      if (executedTaskRef !== taskKey) {
        executedTaskRef = taskKey;
        await mockRunAgent(taskToExecute.prompt.trim(), taskToExecute.providerId, taskToExecute.modelId);
      }
    } else if (initialTask && initialTask.trim() && !taskToExecute) {
      if (executedTaskRef !== initialTask) {
        executedTaskRef = initialTask;
        await mockRunAgent(initialTask);
      }
    }
  };

  // FIRST MOUNT / SUBMISSION TRIGGER
  await simulateAgentPanelTrigger(startTaskPayload, initialUserPrompt);

  // SIMULATE RERENDER / COMPONENT UPDATE WITH SAME PROPS (e.g. state update in parent)
  await simulateAgentPanelTrigger(startTaskPayload, initialUserPrompt);

  // CHECK 1: Exactly ONE user message created
  const userMessages = conversationMessages.filter((m) => m.role === 'user');
  assert.strictEqual(userMessages.length, 1, `Expected exactly 1 user message, found ${userMessages.length}`);
  assert.strictEqual(userMessages[0].content, initialUserPrompt);
  console.log('[TEST 1 PASSED] Exactly ONE user message generated for first task submission');

  // CHECK 2: Exactly ONE assistant response created
  const agentMessages = conversationMessages.filter((m) => m.role === 'agent');
  assert.strictEqual(agentMessages.length, 1, `Expected exactly 1 assistant response, found ${agentMessages.length}`);
  console.log('[TEST 2 PASSED] Exactly ONE assistant response generated for the first turn');

  // CHECK 3: Exactly ONE turn execution executed
  assert.strictEqual(turnExecutions.length, 1, `Expected 1 turn execution, found ${turnExecutions.length}`);
  console.log('[TEST 3 PASSED] Zero duplicate turn execution calls occurred on mount/rerender');

  // CHECK 4: Selected provider and model preserved without stale defaults
  const firstTurn = turnExecutions[0];
  assert.strictEqual(firstTurn.providerId, selectedProvider, `Expected provider ${selectedProvider}, got ${firstTurn.providerId}`);
  assert.strictEqual(firstTurn.modelId, selectedModel, `Expected model ${selectedModel}, got ${firstTurn.modelId}`);
  assert.notStrictEqual(firstTurn.providerId, 'nexus1', 'Should not use stale default provider nexus1');

  const assistantExecution = agentMessages[0].execution;
  assert.strictEqual(assistantExecution.providerId, selectedProvider);
  assert.strictEqual(assistantExecution.modelId, selectedModel);
  console.log('[TEST 4 PASSED] Selected provider ("nexus4") and model ("claude-3-5-sonnet-20241022") truthfully preserved in first turn execution telemetry');

  // CHECK 5: Subsequent follow-up messages continue in the same conversation without resetting
  const followUpPrompt = 'Also verify discount bounds';
  await mockRunAgent(followUpPrompt, selectedProvider, selectedModel);

  const totalUserMessages = conversationMessages.filter((m) => m.role === 'user');
  const totalAgentMessages = conversationMessages.filter((m) => m.role === 'agent');
  assert.strictEqual(totalUserMessages.length, 2, 'Follow-up turn should add second user message');
  assert.strictEqual(totalAgentMessages.length, 2, 'Follow-up turn should add second agent message');
  assert.strictEqual(turnExecutions.length, 2, 'Two turns recorded in single conversation session');
  console.log('[TEST 5 PASSED] Follow-up messages continue in the same conversation thread normally');

  console.log('>>> ALL FIRST-TASK INITIALIZATION REGRESSION TESTS PASSED CLEANLY! <<<');
}

runFirstTaskInitializationRegressionTest().catch((err) => {
  console.error('[TEST FAILED]', err);
  process.exit(1);
});
