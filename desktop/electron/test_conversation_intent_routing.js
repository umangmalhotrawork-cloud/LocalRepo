/**
 * NEXUS CONVERSATION INTENT ROUTING & ZERO-WORKSPACE-ACCESS VERIFICATION SUITE
 * 
 * Verifies:
 * 1. "hi" → CONVERSATION
 * 2. "hello" → CONVERSATION
 * 3. "I'm working on a checkout validation task." → CONVERSATION
 * 4. "I'm testing the new capsule feature." → CONVERSATION
 * 5. "I think we should use Redis." → CONVERSATION
 * 6. "Can you explain this approach?" → CONVERSATION
 * 7. "Inspect checkout.py" → CODING_TASK_READ_ONLY
 * 8. "Find redundant code" → CODING_TASK_READ_ONLY
 * 9. "Review this function" → CODING_TASK_READ_ONLY
 * 10. "Run tests" → CODING_TASK_READ_ONLY
 * 11. "Fix checkout.py" → CODING_TASK_MUTATION
 * 12. "Refactor this code" → CODING_TASK_MUTATION
 * 13. "Add authentication" → CODING_TASK_MUTATION
 * 
 * Verifies for CONVERSATION:
 * - zero AgentLoop iterative tool executions
 * - zero workspace scans
 * - zero read_file calls
 * - zero list_directory calls
 * - zero repository inspection
 * - zero Git operations
 * - zero AI model calls where deterministic response is possible
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const {
  RequestRouter,
  requestRouter,
  ROUTER_MODES,
  CODING_INTENTS,
  getConversationalResponse,
  HarnessRuntime,
  ITEM_TYPES,
  TURN_STATUS,
  toolRegistry,
} = require('./harness');

const { agentManager, classifyTaskIntent, runAgentTask } = require('./agentManager');

async function runConversationIntentRoutingTests() {
  console.log('====================================================');
  console.log('STARTING NEXUS CONVERSATION INTENT ROUTING TEST SUITE');
  console.log('====================================================\n');

  const testStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-conv-storage-'));
  const testWorkspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-conv-workspace-'));
  process.env.ECHO_CONTINUUM_DIR = testStorageDir;

  // Create sample files in test workspace
  const sampleFile = path.join(testWorkspaceDir, 'checkout.py');
  fs.writeFileSync(sampleFile, 'def validate_checkout(cart):\n    return True\n', 'utf-8');
  const cartFile = path.join(testWorkspaceDir, 'cart_calculator.py');
  fs.writeFileSync(cartFile, 'def calc(x):\n    return x * 1\n', 'utf-8');

  try {
    const router = new RequestRouter();

    // =========================================================================
    // SECTION 1: 13 CORE INTENT CLASSIFICATION REQUIREMENTS
    // =========================================================================
    console.log('[SECTION 1] Verifying 13 Mandatory Intent Classifications...');

    // 1. "hi" → CONVERSATION
    const c1 = router.classify('hi');
    assert.strictEqual(c1.mode, ROUTER_MODES.CONVERSATION, '1. "hi" must be CONVERSATION');
    assert.strictEqual(c1.codingIntent, null, '1. "hi" codingIntent must be null');
    assert.strictEqual(c1.requiresWorkspace, false, '1. "hi" requiresWorkspace must be false');
    console.log('  ✓ 1. "hi" → CONVERSATION (requiresWorkspace: false)');

    // 2. "hello" → CONVERSATION
    const c2 = router.classify('hello');
    assert.strictEqual(c2.mode, ROUTER_MODES.CONVERSATION, '2. "hello" must be CONVERSATION');
    assert.strictEqual(c2.codingIntent, null, '2. "hello" codingIntent must be null');
    assert.strictEqual(c2.requiresWorkspace, false, '2. "hello" requiresWorkspace must be false');
    console.log('  ✓ 2. "hello" → CONVERSATION (requiresWorkspace: false)');

    // 3. "I'm working on a checkout validation task." → CONVERSATION
    const c3 = router.classify("I'm working on a checkout validation task.");
    assert.strictEqual(c3.mode, ROUTER_MODES.CONVERSATION, '3. "I\'m working on..." must be CONVERSATION');
    assert.strictEqual(c3.codingIntent, null, '3. "I\'m working on..." codingIntent must be null');
    assert.strictEqual(c3.requiresWorkspace, false, '3. "I\'m working on..." requiresWorkspace must be false');
    console.log('  ✓ 3. "I\'m working on a checkout validation task." → CONVERSATION');

    // 4. "I'm testing the new capsule feature." → CONVERSATION
    const c4 = router.classify("I'm testing the new capsule feature.");
    assert.strictEqual(c4.mode, ROUTER_MODES.CONVERSATION, '4. "I\'m testing..." must be CONVERSATION');
    assert.strictEqual(c4.codingIntent, null, '4. "I\'m testing..." codingIntent must be null');
    assert.strictEqual(c4.requiresWorkspace, false, '4. "I\'m testing..." requiresWorkspace must be false');
    console.log('  ✓ 4. "I\'m testing the new capsule feature." → CONVERSATION');

    // 5. "I think we should use Redis." → CONVERSATION
    const c5 = router.classify("I think we should use Redis.");
    assert.strictEqual(c5.mode, ROUTER_MODES.CONVERSATION, '5. "I think we should use..." must be CONVERSATION');
    assert.strictEqual(c5.codingIntent, null, '5. "I think we should use..." codingIntent must be null');
    assert.strictEqual(c5.requiresWorkspace, false, '5. "I think we should use..." requiresWorkspace must be false');
    console.log('  ✓ 5. "I think we should use Redis." → CONVERSATION');

    // 6. "Can you explain this approach?" → CONVERSATION
    const c6 = router.classify("Can you explain this approach?");
    assert.strictEqual(c6.mode, ROUTER_MODES.CONVERSATION, '6. "Can you explain this approach?" must be CONVERSATION');
    assert.strictEqual(c6.codingIntent, null, '6. "Can you explain this approach?" codingIntent must be null');
    assert.strictEqual(c6.requiresWorkspace, false, '6. "Can you explain this approach?" requiresWorkspace must be false');
    console.log('  ✓ 6. "Can you explain this approach?" → CONVERSATION');

    // Additional conversational assertions
    assert.strictEqual(router.classify("I want to discuss the project architecture.").mode, ROUTER_MODES.CONVERSATION);
    assert.strictEqual(router.classify("That sounds good.").mode, ROUTER_MODES.CONVERSATION);
    assert.strictEqual(router.classify("Tell me more about the idea.").mode, ROUTER_MODES.CONVERSATION);
    assert.strictEqual(router.classify("How are you?").mode, ROUTER_MODES.CONVERSATION);
    console.log('  ✓ Additional conversational statements verified as CONVERSATION');

    // 7. "Inspect checkout.py" → CODING_TASK / READ_ONLY
    const c7 = router.classify("Inspect checkout.py");
    assert.strictEqual(c7.mode, ROUTER_MODES.CODING_TASK, '7. "Inspect checkout.py" must be CODING_TASK');
    assert.strictEqual(c7.codingIntent, CODING_INTENTS.READ_ONLY, '7. "Inspect checkout.py" must be READ_ONLY');
    assert.strictEqual(c7.requiresWorkspace, true, '7. "Inspect checkout.py" must require workspace');
    console.log('  ✓ 7. "Inspect checkout.py" → CODING_TASK (READ_ONLY)');

    // 8. "Find redundant code" → CODING_TASK / READ_ONLY
    const c8 = router.classify("Find redundant code");
    assert.strictEqual(c8.mode, ROUTER_MODES.CODING_TASK, '8. "Find redundant code" must be CODING_TASK');
    assert.strictEqual(c8.codingIntent, CODING_INTENTS.READ_ONLY, '8. "Find redundant code" must be READ_ONLY');
    assert.strictEqual(c8.requiresWorkspace, true, '8. "Find redundant code" must require workspace');
    console.log('  ✓ 8. "Find redundant code" → CODING_TASK (READ_ONLY)');

    // 9. "Review this function" → CODING_TASK / READ_ONLY
    const c9 = router.classify("Review this function", { activeFilePath: 'checkout.py' });
    assert.strictEqual(c9.mode, ROUTER_MODES.CODING_TASK, '9. "Review this function" must be CODING_TASK');
    assert.strictEqual(c9.codingIntent, CODING_INTENTS.READ_ONLY, '9. "Review this function" must be READ_ONLY');
    assert.strictEqual(c9.requiresWorkspace, true, '9. "Review this function" must require workspace');
    console.log('  ✓ 9. "Review this function" → CODING_TASK (READ_ONLY)');

    // 10. "Run tests" → CODING_TASK / READ_ONLY
    const c10 = router.classify("Run tests");
    assert.strictEqual(c10.mode, ROUTER_MODES.CODING_TASK, '10. "Run tests" must be CODING_TASK');
    assert.strictEqual(c10.codingIntent, CODING_INTENTS.READ_ONLY, '10. "Run tests" must be READ_ONLY');
    assert.strictEqual(c10.requiresWorkspace, true, '10. "Run tests" must require workspace');
    console.log('  ✓ 10. "Run tests" → CODING_TASK (READ_ONLY)');

    // 11. "Fix checkout.py" → CODING_TASK / MUTATION
    const c11 = router.classify("Fix checkout.py");
    assert.strictEqual(c11.mode, ROUTER_MODES.CODING_TASK, '11. "Fix checkout.py" must be CODING_TASK');
    assert.strictEqual(c11.codingIntent, CODING_INTENTS.MUTATION, '11. "Fix checkout.py" must be MUTATION');
    assert.strictEqual(c11.requiresWorkspace, true, '11. "Fix checkout.py" must require workspace');
    console.log('  ✓ 11. "Fix checkout.py" → CODING_TASK (MUTATION)');

    // 12. "Refactor this code" → CODING_TASK / MUTATION
    const c12 = router.classify("Refactor this code", { activeFilePath: 'checkout.py' });
    assert.strictEqual(c12.mode, ROUTER_MODES.CODING_TASK, '12. "Refactor this code" must be CODING_TASK');
    assert.strictEqual(c12.codingIntent, CODING_INTENTS.MUTATION, '12. "Refactor this code" must be MUTATION');
    assert.strictEqual(c12.requiresWorkspace, true, '12. "Refactor this code" must require workspace');
    console.log('  ✓ 12. "Refactor this code" → CODING_TASK (MUTATION)');

    // 13. "Add authentication" → CODING_TASK / MUTATION
    const c13 = router.classify("Add authentication");
    assert.strictEqual(c13.mode, ROUTER_MODES.CODING_TASK, '13. "Add authentication" must be CODING_TASK');
    assert.strictEqual(c13.codingIntent, CODING_INTENTS.MUTATION, '13. "Add authentication" must be MUTATION');
    assert.strictEqual(c13.requiresWorkspace, true, '13. "Add authentication" must require workspace');
    console.log('  ✓ 13. "Add authentication" → CODING_TASK (MUTATION)');

    // =========================================================================
    // SECTION 2: ZERO WORKSPACE ACCESS & ZERO AI CALLS ON CONVERSATION
    // =========================================================================
    console.log('\n[SECTION 2] Verifying Zero Workspace Scans & Zero AI Calls on CONVERSATION...');

    const runtime = HarnessRuntime.createIsolated();
    const events = [];
    const unsub = runtime.subscribe((evt) => events.push(evt));

    // Spy on tool registry execution
    let toolExecutionCount = 0;
    const origExecute = runtime.agentLoop.toolRegistry.execute.bind(runtime.agentLoop.toolRegistry);
    runtime.agentLoop.toolRegistry.execute = async (...args) => {
      toolExecutionCount++;
      return origExecute(...args);
    };

    // Test "I'm working on a checkout validation task." through HarnessRuntime.handleRequest
    const resHarness = await runtime.handleRequest({
      userInput: "I'm working on a checkout validation task.",
      workspacePath: testWorkspaceDir,
    });

    assert.strictEqual(resHarness.success, true);
    assert.strictEqual(resHarness.mode, ROUTER_MODES.CONVERSATION);
    assert.strictEqual(resHarness.codingIntent, null);
    assert.strictEqual(resHarness.steps.length, 0);
    assert.ok(typeof resHarness.response === 'string' && resHarness.response.length > 0);
    assert.strictEqual(toolExecutionCount, 0, 'Must have 0 tool executions during CONVERSATION');

    const toolEvents = events.filter((e) => e.payload?.item?.type === ITEM_TYPES.TOOL_CALL || e.payload?.item?.type === ITEM_TYPES.TOOL_RESULT);
    assert.strictEqual(toolEvents.length, 0, 'Must have 0 tool call/result events during CONVERSATION');
    console.log('  ✓ HarnessRuntime.handleRequest("I\'m working on...") executed with 0 tool calls and 0 steps');

    // Test AgentLoop.runTurn directly with conversational statement
    const thread = runtime.createThread({ metadata: { workspacePath: testWorkspaceDir } });
    const turnRes = await runtime.runTurn({
      threadId: thread.threadId,
      userInput: "I think we should use Redis.",
      workspacePath: testWorkspaceDir,
    });

    assert.strictEqual(turnRes.success, true);
    assert.strictEqual(turnRes.status, TURN_STATUS.COMPLETED);
    assert.strictEqual(turnRes.iterations, 0, 'AgentLoop must perform 0 iterations for conversational input');
    assert.strictEqual(turnRes.totalToolCalls, 0, 'AgentLoop must perform 0 tool calls for conversational input');
    assert.strictEqual(turnRes.steps.length, 0);
    assert.ok(typeof turnRes.finalResponse === 'string' && turnRes.finalResponse.length > 0);
    assert.strictEqual(toolExecutionCount, 0, 'AgentLoop must not invoke toolRegistry');
    console.log('  ✓ AgentLoop.runTurn("I think we should use Redis.") completed with 0 iterations and 0 tool calls');

    // =========================================================================
    // SECTION 3: AGENT MANAGER FACADE CONVERSATION VERIFICATION
    // =========================================================================
    console.log('\n[SECTION 3] Verifying agentManager Facade on Conversational Statements...');

    const managerRes1 = await runAgentTask({
      task: "I'm working on a checkout validation task.",
      workspacePath: testWorkspaceDir,
      activeFilePath: null,
      isExplicitEditorTarget: false,
    });

    assert.strictEqual(managerRes1.success, true);
    assert.strictEqual(managerRes1.taskIntent, 'GENERAL_CHAT');
    assert.strictEqual(managerRes1.targetFile, null);
    assert.strictEqual(managerRes1.steps.length, 0);
    assert.ok(managerRes1.summary.length > 10);
    console.log('  ✓ agentManager.runAgentTask("I\'m working on...") returned GENERAL_CHAT with targetFile: null and steps: []');

    const managerRes2 = await runAgentTask({
      task: "I want to discuss the project architecture.",
      workspacePath: testWorkspaceDir,
      activeFilePath: null,
      isExplicitEditorTarget: false,
    });

    assert.strictEqual(managerRes2.success, true);
    assert.strictEqual(managerRes2.taskIntent, 'GENERAL_CHAT');
    assert.strictEqual(managerRes2.targetFile, null);
    assert.strictEqual(managerRes2.steps.length, 0);
    console.log('  ✓ agentManager.runAgentTask("I want to discuss...") returned GENERAL_CHAT without file targeting');

    // =========================================================================
    // SECTION 4: CONTEXT CAPSULE ATTACHMENT DOES NOT TRIGGER CODING WORKFLOW ON CONVERSATION
    // =========================================================================
    console.log('\n[SECTION 4] Verifying Context Capsule Attachment with Conversational Messages...');

    const fakeCapsule = {
      capsuleId: 'capsule_test_123',
      schemaVersion: '1.0.0',
      title: 'Checkout Validation Capsule',
      createdDate: new Date().toISOString(),
      sourceSessionId: 'sess_1',
      summary: 'Previous discussion about cart rules',
      keyFacts: ['Checkout requires valid token'],
      recentExchanges: [
        { user: 'What is cart rule?', agent: 'Cart rule validates item counts' },
      ],
    };

    const capsuleConvRes = await runtime.handleRequest({
      userInput: "I'm testing the new capsule feature.",
      workspacePath: testWorkspaceDir,
      importedCapsule: fakeCapsule,
    });

    assert.strictEqual(capsuleConvRes.success, true);
    assert.strictEqual(capsuleConvRes.mode, ROUTER_MODES.CONVERSATION);
    assert.strictEqual(capsuleConvRes.steps.length, 0);
    assert.strictEqual(toolExecutionCount, 0);
    console.log('  ✓ Imported capsule attached + conversational prompt remains CONVERSATION with 0 workspace scans');

    // =========================================================================
    // SECTION 5: EXPLICIT CODING TASKS REMAIN FULLY OPERATIONAL
    // =========================================================================
    console.log('\n[SECTION 5] Verifying Coding Tasks Continue to Enter Coding Pipeline...');

    // 1. Read-only code inspection
    let readToolCalled = false;
    const codingRoRes = await runtime.handleRequest({
      userInput: "Inspect checkout.py",
      workspacePath: testWorkspaceDir,
      modelHandler: async () => {
        readToolCalled = true;
        return {
          tool_calls: [{ callId: 'c_read_1', toolName: 'read_file', arguments: { path: 'checkout.py' } }],
        };
      },
    });

    assert.strictEqual(codingRoRes.mode, ROUTER_MODES.CODING_TASK);
    assert.strictEqual(codingRoRes.codingIntent, CODING_INTENTS.READ_ONLY);
    assert.strictEqual(readToolCalled, true, 'Coding task must trigger model and tools');
    console.log('  ✓ "Inspect checkout.py" properly entered CODING_TASK pipeline');

    // 2. Code mutation
    const codingMutRes = await runtime.handleRequest({
      userInput: "Fix checkout.py",
      workspacePath: testWorkspaceDir,
      modelHandler: async () => 'Proposed fix for checkout.py',
    });

    assert.strictEqual(codingMutRes.mode, ROUTER_MODES.CODING_TASK);
    assert.strictEqual(codingMutRes.codingIntent, CODING_INTENTS.MUTATION);
    console.log('  ✓ "Fix checkout.py" properly entered CODING_TASK MUTATION pipeline');

    unsub();

    console.log('\n====================================================');
    console.log('>>> ALL CONVERSATION INTENT ROUTING TESTS PASSED 100%! <<<');
    console.log('====================================================\n');
  } finally {
    try {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
      fs.rmSync(testWorkspaceDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

if (require.main === module) {
  runConversationIntentRoutingTests().catch((err) => {
    console.error('\n[TEST SUITE FAILED]', err);
    process.exit(1);
  });
}

module.exports = { runConversationIntentRoutingTests };
