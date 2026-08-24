/**
 * NEXUS CONVERSATION RESPONSE ROUTING TEST SUITE
 * Verifies that conversational messages receive natural, contextual responses
 * instead of generic canned workspace placeholders, while ensuring 0 workspace scans,
 * 0 tools execution, and valid Context Capsule exchange preservation.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { RequestRouter, ROUTER_MODES, CODING_INTENTS, isGreeting, getConversationalResponse } = require('./harness/RequestRouter');
const { HarnessRuntime } = require('./harness/HarnessRuntime');
const { ITEM_TYPES, TURN_STATUS } = require('./harness/types');
const { ContextCapsuleManager } = require('./capsule/ContextCapsuleManager');
const { validateCapsule } = require('./capsule/CapsuleSchema');

async function runConversationResponseRoutingTests() {
  console.log('================================================================');
  console.log('STARTING CONVERSATION RESPONSE ROUTING TEST SUITE');
  console.log('================================================================\n');

  const router = new RequestRouter();
  const testWorkspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-conv-test-'));
  const testCapsuleDir = path.join(testWorkspaceDir, 'context-capsules');
  fs.mkdirSync(testCapsuleDir, { recursive: true });

  const runtime = HarnessRuntime.createIsolated();
  const capsuleManager = new ContextCapsuleManager({
    storageDir: testCapsuleDir,
    threadManager: runtime.threadManager,
    turnManager: runtime.turnManager,
    itemStore: runtime.itemStore,
  });

  const GENERIC_WORKSPACE_FALLBACK = "I am ready to help with your workspace. Ask me any question about the architecture or describe a coding task to get started.";

  // ----------------------------------------------------
  // TEST 1 & 2: Greetings use deterministic greeting
  // ----------------------------------------------------
  console.log('[TEST 1 & 2] Testing "hi" and "hello" deterministic greetings...');
  const resHi = await runtime.handleRequest({
    userInput: 'hi',
    workspacePath: testWorkspaceDir,
  });
  assert.strictEqual(resHi.success, true);
  assert.strictEqual(resHi.mode, ROUTER_MODES.CONVERSATION);
  assert.ok(resHi.response.toLowerCase().includes('hello') || resHi.response.toLowerCase().includes('hi'));
  assert.notStrictEqual(resHi.response, GENERIC_WORKSPACE_FALLBACK);
  assert.strictEqual(resHi.steps.length, 0);

  const resHello = await runtime.handleRequest({
    userInput: 'hello',
    workspacePath: testWorkspaceDir,
  });
  assert.strictEqual(resHello.success, true);
  assert.strictEqual(resHello.mode, ROUTER_MODES.CONVERSATION);
  assert.ok(resHello.response.toLowerCase().includes('hello') || resHello.response.toLowerCase().includes('help'));
  console.log('  ✓ [TEST 1 & 2 PASSED] "hi" and "hello" returned deterministic greetings.');

  // ----------------------------------------------------
  // TEST 3: "my name is umang" addresses the actual message
  // ----------------------------------------------------
  console.log('\n[TEST 3] Testing "my name is umang" personalized conversation...');
  const resUmang = await runtime.handleRequest({
    userInput: 'my name is umang',
    workspacePath: testWorkspaceDir,
  });
  assert.strictEqual(resUmang.success, true);
  assert.strictEqual(resUmang.mode, ROUTER_MODES.CONVERSATION);
  assert.ok(resUmang.response.toLowerCase().includes('umang'), `Response must address Umang by name. Got: "${resUmang.response}"`);
  assert.notStrictEqual(resUmang.response, GENERIC_WORKSPACE_FALLBACK);
  console.log(`  ✓ [TEST 3 PASSED] "my name is umang" responded: "${resUmang.response}"`);

  // ----------------------------------------------------
  // TEST 4: "i work in bennett university" addresses the actual message
  // ----------------------------------------------------
  console.log('\n[TEST 4] Testing "i work in bennett university" contextual conversation...');
  const resBennett = await runtime.handleRequest({
    userInput: 'i work in bennett university',
    workspacePath: testWorkspaceDir,
  });
  assert.strictEqual(resBennett.success, true);
  assert.strictEqual(resBennett.mode, ROUTER_MODES.CONVERSATION);
  assert.ok(
    resBennett.response.toLowerCase().includes('bennett') || resBennett.response.toLowerCase().includes('university'),
    `Response must acknowledge Bennett University. Got: "${resBennett.response}"`
  );
  assert.notStrictEqual(resBennett.response, GENERIC_WORKSPACE_FALLBACK);
  console.log(`  ✓ [TEST 4 PASSED] "i work in bennett university" responded: "${resBennett.response}"`);

  // ----------------------------------------------------
  // TEST 5: "i am testing Context Capsule" acknowledges test
  // ----------------------------------------------------
  console.log('\n[TEST 5] Testing "i am testing Context Capsule"...');
  const resTesting = await runtime.handleRequest({
    userInput: 'i am testing Context Capsule',
    workspacePath: testWorkspaceDir,
  });
  assert.strictEqual(resTesting.success, true);
  assert.strictEqual(resTesting.mode, ROUTER_MODES.CONVERSATION);
  assert.ok(
    resTesting.response.toLowerCase().includes('capsule') || resTesting.response.toLowerCase().includes('test'),
    `Response must acknowledge Context Capsule testing. Got: "${resTesting.response}"`
  );
  console.log(`  ✓ [TEST 5 PASSED] "i am testing Context Capsule" responded: "${resTesting.response}"`);

  // ----------------------------------------------------
  // TEST 6: Generic workspace fallback is NEVER returned for ordinary conversation
  // ----------------------------------------------------
  console.log('\n[TEST 6] Verifying generic workspace fallback is not returned for ordinary conversation...');
  const testPhrases = [
    'my name is Sarah',
    'i study at Stanford',
    'I want to discuss the project architecture',
    'I think we should use Redis for caching',
    'Can you explain this approach?',
    'What do you think about the capsule idea?',
  ];
  for (const phrase of testPhrases) {
    const outcome = await runtime.handleRequest({
      userInput: phrase,
      workspacePath: testWorkspaceDir,
    });
    assert.strictEqual(outcome.mode, ROUTER_MODES.CONVERSATION, `"${phrase}" must be CONVERSATION`);
    assert.notStrictEqual(outcome.response, GENERIC_WORKSPACE_FALLBACK, `"${phrase}" returned generic fallback!`);
  }
  console.log('  ✓ [TEST 6 PASSED] All 6 conversational phrases received natural contextual responses.');

  // ----------------------------------------------------
  // TEST 7–10: Zero workspace scan, zero read_file, zero list_directory, zero git operations
  // ----------------------------------------------------
  console.log('\n[TEST 7–10] Auditing zero workspace tools, zero read_file, zero git operations...');
  const recordedEvents = [];
  const unsub = runtime.subscribe((evt) => recordedEvents.push(evt));

  const convAuditTurn = await runtime.handleRequest({
    userInput: 'Tell me more about the idea',
    workspacePath: testWorkspaceDir,
  });
  unsub();

  assert.strictEqual(convAuditTurn.success, true);
  assert.strictEqual(convAuditTurn.mode, ROUTER_MODES.CONVERSATION);
  assert.strictEqual(convAuditTurn.steps.length, 0, 'Must have 0 steps');

  // Verify zero TOOL_CALL or FILE_CHANGE items created
  const toolCalls = recordedEvents.filter((e) => e.type === 'item_started' && e.payload?.type === ITEM_TYPES.TOOL_CALL);
  const fileChanges = recordedEvents.filter((e) => e.type === 'item_started' && e.payload?.type === ITEM_TYPES.FILE_CHANGE);
  assert.strictEqual(toolCalls.length, 0, 'Zero tool calls allowed during conversation');
  assert.strictEqual(fileChanges.length, 0, 'Zero file changes allowed during conversation');
  console.log('  ✓ [TEST 7–10 PASSED] Verified zero tool calls, zero file reads, zero git mutations.');

  // ----------------------------------------------------
  // TEST 11: Explicit coding requests still enter CODING_TASK routing
  // ----------------------------------------------------
  console.log('\n[TEST 11] Verifying explicit coding requests still enter CODING_TASK routing...');
  const codingReadOnly = router.classify('Inspect cart_calculator.py');
  assert.strictEqual(codingReadOnly.mode, ROUTER_MODES.CODING_TASK);
  assert.strictEqual(codingReadOnly.codingIntent, CODING_INTENTS.READ_ONLY);

  const codingMutation = router.classify('Fix the bug in cart_calculator.py');
  assert.strictEqual(codingMutation.mode, ROUTER_MODES.CODING_TASK);
  assert.strictEqual(codingMutation.codingIntent, CODING_INTENTS.MUTATION);

  const codingAddAuth = router.classify('Add authentication to user route');
  assert.strictEqual(codingAddAuth.mode, ROUTER_MODES.CODING_TASK);
  assert.strictEqual(codingAddAuth.codingIntent, CODING_INTENTS.MUTATION);
  console.log('  ✓ [TEST 11 PASSED] Coding requests properly preserve CODING_TASK routing.');

  // ----------------------------------------------------
  // TEST 12: Context Capsule captures actual assistant responses
  // ----------------------------------------------------
  console.log('\n[TEST 12] Verifying Context Capsule captures actual assistant responses (no generic placeholders)...');
  const thread = runtime.createThread({ userInput: 'my name is umang', metadata: { workspacePath: testWorkspaceDir } });

  await runtime.handleRequest({
    threadId: thread.threadId,
    userInput: 'my name is umang',
    workspacePath: testWorkspaceDir,
  });

  await runtime.handleRequest({
    threadId: thread.threadId,
    userInput: 'i work in bennett university',
    workspacePath: testWorkspaceDir,
  });

  const capsule = capsuleManager.createCapsule(thread.threadId);
  const val = validateCapsule(capsule);
  assert.strictEqual(val.valid, true);

  const exchanges = capsule.conversation_context.last_exchanges;
  assert.strictEqual(exchanges.length, 2, 'Must have 2 exchanges');

  assert.strictEqual(exchanges[0].user, 'my name is umang');
  assert.ok(exchanges[0].assistant.toLowerCase().includes('umang'), 'Capsule exchange 1 must contain actual assistant response');
  assert.notStrictEqual(exchanges[0].assistant, GENERIC_WORKSPACE_FALLBACK);

  assert.strictEqual(exchanges[1].user, 'i work in bennett university');
  assert.ok(exchanges[1].assistant.toLowerCase().includes('bennett'), 'Capsule exchange 2 must contain actual assistant response');
  assert.notStrictEqual(exchanges[1].assistant, GENERIC_WORKSPACE_FALLBACK);
  console.log('  ✓ [TEST 12 PASSED] Context Capsule successfully preserved actual natural exchanges.');

  // ----------------------------------------------------
  // TEST 13: ModelHandler custom injection for conversational turns
  // ----------------------------------------------------
  console.log('\n[TEST 13] Verifying ModelHandler custom injection for non-greeting conversational turns...');
  const mockOutcome = await runtime.handleRequest({
    userInput: 'What do you think of this idea?',
    workspacePath: testWorkspaceDir,
    modelHandler: async (messages, tools) => {
      assert.strictEqual(tools.length, 0, 'Must have 0 tools');
      return 'I think it is a brilliant architecture for modular scaling.';
    },
  });
  assert.strictEqual(mockOutcome.success, true);
  assert.strictEqual(mockOutcome.response, 'I think it is a brilliant architecture for modular scaling.');
  console.log('  ✓ [TEST 13 PASSED] ModelHandler correctly invoked with 0 tools for conversational questions.');

  // Cleanup temporary directory
  try {
    fs.rmSync(testWorkspaceDir, { recursive: true, force: true });
  } catch (_) {}

  console.log('\n================================================================');
  console.log('>>> ALL CONVERSATION RESPONSE ROUTING TESTS PASSED (13/13)! <<<');
  console.log('================================================================\n');
}

runConversationResponseRoutingTests().catch((err) => {
  console.error('\n❌ CONVERSATION RESPONSE ROUTING TEST SUITE FAILED:', err);
  process.exit(1);
});
