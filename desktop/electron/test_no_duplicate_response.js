/**
 * NEXUS DUPLICATE RESPONSE REGRESSION TEST
 * 
 * Verifies that:
 * 1. A conversational user request produces exactly ONE assistant response item.
 * 2. A multi-step coding request produces exactly ONE assistant response item with steps.
 * 3. Events streamed during execution reconcile into a single unified assistant message.
 * 4. No duplicate cards, turns, or responses are emitted or stored.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const {
  HarnessRuntime,
  ITEM_TYPES,
  TURN_STATUS,
  ROUTER_MODES,
  CODING_INTENTS,
} = require('./harness');

async function runNoDuplicateResponseTest() {
  console.log('================================================================');
  console.log('NEXUS: SINGLE ASSISTANT RESPONSE / NO DUPLICATE CARD REGRESSION TEST');
  console.log('================================================================\n');

  const testStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-no-dup-storage-'));
  const testWorkspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-no-dup-workspace-'));
  process.env.ECHO_CONTINUUM_DIR = testStorageDir;

  try {
    const runtime = HarnessRuntime.createIsolated();

    // Track all emitted events to ensure no duplicate completed items
    const emittedEvents = [];
    runtime.subscribe((event) => {
      emittedEvents.push(event);
    });

    // ----------------------------------------------------
    // TEST 1: Conversational Request produces exactly 1 assistant response
    // ----------------------------------------------------
    console.log('[TEST 1] Conversational Turn: Verifying single assistant response...');
    const thread1 = runtime.createThread({
      userInput: 'Hello NEXUS',
      metadata: { workspacePath: testWorkspaceDir, workspaceName: 'nexus-app' },
    });

    const turn1Result = await runtime.runTurn({
      threadId: thread1.threadId,
      userInput: 'What is our primary design pattern?',
      workspacePath: testWorkspaceDir,
      intent: CODING_INTENTS.READ_ONLY,
      modelHandler: async () => 'We use the micro-kernel architecture with event-driven modules.',
    });

    assert.strictEqual(turn1Result.success, true, 'Turn 1 must succeed');
    assert.strictEqual(turn1Result.status, TURN_STATUS.COMPLETED, 'Turn 1 must complete');

    const turn1Items = runtime.itemStore.getItemsByTurn(turn1Result.turnId);
    const agentMsgItems1 = turn1Items.filter((i) => i.type === ITEM_TYPES.AGENT_MESSAGE);

    assert.strictEqual(agentMsgItems1.length, 1, `Turn 1 must have exactly 1 AGENT_MESSAGE item (found ${agentMsgItems1.length})`);
    assert.strictEqual(
      agentMsgItems1[0].payload?.text,
      'We use the micro-kernel architecture with event-driven modules.',
      'Message content matches model output'
    );
    console.log('  ✔ [PASS] Conversational request created exactly 1 AGENT_MESSAGE item.');

    // ----------------------------------------------------
    // TEST 2: Coding Request with Tools produces exactly 1 assistant response
    // ----------------------------------------------------
    console.log('\n[TEST 2] Coding Request with Tools: Verifying single unified response...');
    const thread2 = runtime.createThread({
      userInput: 'Refactor math helper',
      metadata: { workspacePath: testWorkspaceDir, workspaceName: 'nexus-app' },
    });

    // Register test tool
    runtime.toolRegistry.register({
      name: 'read_file',
      description: 'Read file contents',
      parameters: { type: 'object', properties: { path: { type: 'string' } } },
      execute: async () => ({ content: 'function add(a, b) { return a + b; }' }),
    });

    let toolCallExecuted = false;
    const turn2Result = await runtime.runTurn({
      threadId: thread2.threadId,
      userInput: 'Refactor math helper in src/math.js',
      workspacePath: testWorkspaceDir,
      intent: CODING_INTENTS.MUTATION,
      modelHandler: async (messages, options) => {
        if (!toolCallExecuted) {
          toolCallExecuted = true;
          return {
            content: 'I will inspect src/math.js first.',
            toolCalls: [{ id: 'call_read_1', name: 'read_file', arguments: { path: 'src/math.js' } }],
          };
        }
        return {
          content: 'Inspected src/math.js. Refactored function successfully.',
          toolCalls: [],
        };
      },
    });

    assert.strictEqual(turn2Result.success, true, 'Turn 2 must succeed');
    assert.strictEqual(turn2Result.status, TURN_STATUS.COMPLETED, 'Turn 2 must complete');

    const turn2Items = runtime.itemStore.getItemsByTurn(turn2Result.turnId);
    const agentMsgItems2 = turn2Items.filter((i) => i.type === ITEM_TYPES.AGENT_MESSAGE);
    const toolCallItems2 = turn2Items.filter((i) => i.type === ITEM_TYPES.TOOL_CALL);

    assert.strictEqual(agentMsgItems2.length, 1, `Turn 2 must have exactly 1 final AGENT_MESSAGE item (found ${agentMsgItems2.length})`);
    assert.strictEqual(toolCallItems2.length, 1, `Turn 2 must have exactly 1 TOOL_CALL item (found ${toolCallItems2.length})`);
    console.log('  ✔ [PASS] Coding request with tools created exactly 1 final AGENT_MESSAGE item.');

    // ----------------------------------------------------
    // TEST 3: Event stream verification (no duplicate completed events)
    // ----------------------------------------------------
    console.log('\n[TEST 3] Verifying event stream emits no duplicate ITEM_COMPLETED for agent messages...');
    const completedAgentEvents = emittedEvents.filter(
      (e) => e.type === 'ITEM_COMPLETED' && e.payload?.item?.type === ITEM_TYPES.AGENT_MESSAGE
    );
    // There are 2 turns total, so exactly 2 ITEM_COMPLETED for AGENT_MESSAGE should be emitted
    assert.strictEqual(
      completedAgentEvents.length,
      2,
      `Expected exactly 2 ITEM_COMPLETED agent message events across 2 turns (found ${completedAgentEvents.length})`
    );
    console.log('  ✔ [PASS] Zero duplicate ITEM_COMPLETED events emitted across event bus.');

    // ----------------------------------------------------
    // TEST 4: Frontend message reconciliation simulation
    // ----------------------------------------------------
    console.log('\n[TEST 4] Simulating AgentPanel message state reconciliation...');
    let messagesState = [];

    // Simulate user message
    messagesState.push({ id: 'user_1', role: 'user', content: 'What is our pattern?' });

    // Simulate onEvent ITEM_STARTED
    const streamingEvent = {
      type: 'ITEM_STARTED',
      turnId: turn1Result.turnId,
      payload: { item: { itemId: agentMsgItems1[0].itemId, type: 'AGENT_MESSAGE', payload: { text: 'We use' } } },
    };

    // Apply onEvent logic
    const am = streamingEvent.payload.item.payload;
    const matchIdx1 = messagesState.findIndex((m) => m.id === streamingEvent.payload.item.itemId || m.turnId === streamingEvent.turnId);
    const msgObj1 = {
      id: streamingEvent.payload.item.itemId,
      role: 'agent',
      content: am.text,
      turnId: streamingEvent.turnId,
      status: 'STREAMING',
    };
    if (matchIdx1 >= 0) {
      messagesState[matchIdx1] = { ...messagesState[matchIdx1], ...msgObj1 };
    } else {
      messagesState.push(msgObj1);
    }
    assert.strictEqual(messagesState.length, 2, 'Must have 1 user + 1 agent message during streaming');

    // Simulate onEvent ITEM_COMPLETED
    const completedEvent = {
      type: 'ITEM_COMPLETED',
      turnId: turn1Result.turnId,
      payload: { item: { itemId: agentMsgItems1[0].itemId, type: 'AGENT_MESSAGE', payload: { text: 'We use the micro-kernel architecture with event-driven modules.' } } },
    };
    const matchIdx2 = messagesState.findIndex((m) => m.id === completedEvent.payload.item.itemId || m.turnId === completedEvent.turnId);
    const msgObj2 = {
      id: completedEvent.payload.item.itemId,
      role: 'agent',
      content: completedEvent.payload.item.payload.text,
      turnId: completedEvent.turnId,
      status: 'VERIFIED',
    };
    if (matchIdx2 >= 0) {
      messagesState[matchIdx2] = { ...messagesState[matchIdx2], ...msgObj2 };
    } else {
      messagesState.push(msgObj2);
    }
    assert.strictEqual(messagesState.length, 2, 'Must still have exactly 2 messages after ITEM_COMPLETED');

    // Simulate handleRunAgent completion
    const finalHarnessRes = {
      success: true,
      turnId: turn1Result.turnId,
      finalResponse: 'We use the micro-kernel architecture with event-driven modules.',
      steps: [],
    };

    const existingIdx = messagesState.findIndex(
      (m) => (finalHarnessRes.turnId && m.turnId === finalHarnessRes.turnId) || m.id === 'agent_generated_local_id'
    );
    assert.ok(existingIdx >= 0, 'Must find existing message from turn stream');

    const agentMsgFinal = {
      id: messagesState[existingIdx].id,
      role: 'agent',
      content: finalHarnessRes.finalResponse,
      status: 'VERIFIED',
      turnId: finalHarnessRes.turnId,
      steps: undefined,
    };
    messagesState[existingIdx] = agentMsgFinal;

    assert.strictEqual(messagesState.length, 2, 'Total messages in state must remain 2 (1 user + 1 agent)');
    assert.strictEqual(messagesState.filter((m) => m.role === 'agent').length, 1, 'Exactly 1 agent response in state');
    console.log('  ✔ [PASS] Message state reconciliation yields exactly 1 assistant card.');

    console.log('\n================================================================');
    console.log('✔ NO DUPLICATE ASSISTANT RESPONSE REGRESSION TEST PASSED CLEANLY!');
    console.log('================================================================\n');
  } finally {
    try {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
      fs.rmSync(testWorkspaceDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

runNoDuplicateResponseTest().catch((err) => {
  console.error('\n[FATAL NO DUPLICATE RESPONSE TEST FAILURE]', err);
  process.exit(1);
});
