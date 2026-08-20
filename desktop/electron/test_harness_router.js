/**
 * NEXUS CODEX HARNESS - AUTHORITATIVE REQUEST ROUTER TEST SUITE (MILESTONE 4)
 * 
 * Verifies:
 * 1–18. Pure Classification Matrix across greetings, conceptual queries, filenames,
 *       diagnostics, mutations, test runs, active file context, and negative directives.
 * 19. Conversation must not invoke workspace scan.
 * 20. Conversation must not invoke AgentLoop / ToolRegistry.
 * 21. Coding request invokes HarnessRuntime.
 * 22. Mutation request exposes mutation-capable tools (apply_patch).
 * 23. Read-only request strictly disallows mutation tools.
 * 24. End-to-End Flow A: Conversational greeting ("hi").
 * 25. End-to-End Flow B: Read-only coding analysis ("Find the redundant operations in cart_calculator.py").
 * 26. End-to-End Flow C: Code mutation ("Remove the redundant operations in cart_calculator.py").
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  requestRouter,
  RequestRouter,
  ROUTER_MODES,
  CODING_INTENTS,
  HarnessRuntime,
  ITEM_TYPES,
  TURN_STATUS,
} = require('./harness');

function assert(condition, message) {
  if (!condition) {
    console.error(`[ASSERTION FAILED] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runRouterTests() {
  console.log('====================================================');
  console.log('[TEST] Starting NEXUS Codex Harness Request Router Test Suite (Milestone 4)...');
  console.log('====================================================\n');

  const testStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-router-storage-'));
  const testWorkspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-router-workspace-'));
  process.env.ECHO_CONTINUUM_DIR = testStorageDir;

  const sampleFile = path.join(testWorkspaceDir, 'cart_calculator.py');
  fs.writeFileSync(sampleFile, 'def calc(x):\n    return x * 1 # Redundant\n', 'utf-8');

  try {
    const router = new RequestRouter();

    // ----------------------------------------------------
    // TEST 1: "hi" -> CONVERSATION
    // ----------------------------------------------------
    console.log('[TEST 1] Testing "hi"...');
    const r1 = router.classify('hi');
    assert(r1.mode === ROUTER_MODES.CONVERSATION, 'Must be CONVERSATION');
    assert(r1.codingIntent === null, 'Coding intent must be null');
    assert(r1.requiresWorkspace === false, 'Requires workspace must be false');
    console.log('[TEST 1 PASSED] "hi" -> CONVERSATION');

    // ----------------------------------------------------
    // TEST 2: "hello" -> CONVERSATION
    // ----------------------------------------------------
    console.log('[TEST 2] Testing "hello"...');
    const r2 = router.classify('hello');
    assert(r2.mode === ROUTER_MODES.CONVERSATION, 'Must be CONVERSATION');
    console.log('[TEST 2 PASSED] "hello" -> CONVERSATION');

    // ----------------------------------------------------
    // TEST 3: "how are you?" -> CONVERSATION
    // ----------------------------------------------------
    console.log('[TEST 3] Testing "how are you?"...');
    const r3 = router.classify('how are you?');
    assert(r3.mode === ROUTER_MODES.CONVERSATION, 'Must be CONVERSATION');
    console.log('[TEST 3 PASSED] "how are you?" -> CONVERSATION');

    // ----------------------------------------------------
    // TEST 4: "what is recursion?" -> CONVERSATION
    // ----------------------------------------------------
    console.log('[TEST 4] Testing "what is recursion?"...');
    const r4 = router.classify('what is recursion?');
    assert(r4.mode === ROUTER_MODES.CONVERSATION, 'Must be CONVERSATION');
    assert(r4.requiresWorkspace === false, 'Must not require workspace');
    console.log('[TEST 4 PASSED] "what is recursion?" -> CONVERSATION');

    // ----------------------------------------------------
    // TEST 5: "explain recursion in Python" -> CONVERSATION
    // ----------------------------------------------------
    console.log('[TEST 5] Testing "explain recursion in Python"...');
    const r5 = router.classify('explain recursion in Python');
    assert(r5.mode === ROUTER_MODES.CONVERSATION, 'Must be CONVERSATION');
    console.log('[TEST 5 PASSED] "explain recursion in Python" -> CONVERSATION');

    // ----------------------------------------------------
    // TEST 6: "explain this function in src/cart.py" -> CODING_TASK / READ_ONLY
    // ----------------------------------------------------
    console.log('[TEST 6] Testing "explain this function in src/cart.py"...');
    const r6 = router.classify('explain this function in src/cart.py');
    assert(r6.mode === ROUTER_MODES.CODING_TASK, 'Must be CODING_TASK');
    assert(r6.codingIntent === CODING_INTENTS.READ_ONLY, 'Must be READ_ONLY');
    assert(r6.requiresWorkspace === true, 'Must require workspace');
    console.log('[TEST 6 PASSED] "explain this function in src/cart.py" -> CODING_TASK / READ_ONLY');

    // ----------------------------------------------------
    // TEST 7: "inspect cart_calculator.py" -> CODING_TASK / READ_ONLY
    // ----------------------------------------------------
    console.log('[TEST 7] Testing "inspect cart_calculator.py"...');
    const r7 = router.classify('inspect cart_calculator.py');
    assert(r7.mode === ROUTER_MODES.CODING_TASK, 'Must be CODING_TASK');
    assert(r7.codingIntent === CODING_INTENTS.READ_ONLY, 'Must be READ_ONLY');
    console.log('[TEST 7 PASSED] "inspect cart_calculator.py" -> CODING_TASK / READ_ONLY');

    // ----------------------------------------------------
    // TEST 8: "find redundant code in cart_calculator.py" -> CODING_TASK / READ_ONLY
    // ----------------------------------------------------
    console.log('[TEST 8] Testing "find redundant code in cart_calculator.py"...');
    const r8 = router.classify('find redundant code in cart_calculator.py');
    assert(r8.mode === ROUTER_MODES.CODING_TASK, 'Must be CODING_TASK');
    assert(r8.codingIntent === CODING_INTENTS.READ_ONLY, 'Must be READ_ONLY');
    console.log('[TEST 8 PASSED] "find redundant code in cart_calculator.py" -> CODING_TASK / READ_ONLY');

    // ----------------------------------------------------
    // TEST 9: "run the tests" -> CODING_TASK / READ_ONLY
    // ----------------------------------------------------
    console.log('[TEST 9] Testing "run the tests"...');
    const r9 = router.classify('run the tests');
    assert(r9.mode === ROUTER_MODES.CODING_TASK, 'Must be CODING_TASK');
    assert(r9.codingIntent === CODING_INTENTS.READ_ONLY, 'Must be READ_ONLY');
    console.log('[TEST 9 PASSED] "run the tests" -> CODING_TASK / READ_ONLY');

    // ----------------------------------------------------
    // TEST 10: "fix the bug in cart_calculator.py" -> CODING_TASK / MUTATION
    // ----------------------------------------------------
    console.log('[TEST 10] Testing "fix the bug in cart_calculator.py"...');
    const r10 = router.classify('fix the bug in cart_calculator.py');
    assert(r10.mode === ROUTER_MODES.CODING_TASK, 'Must be CODING_TASK');
    assert(r10.codingIntent === CODING_INTENTS.MUTATION, 'Must be MUTATION');
    console.log('[TEST 10 PASSED] "fix the bug in cart_calculator.py" -> CODING_TASK / MUTATION');

    // ----------------------------------------------------
    // TEST 11: "remove the redundant operations" -> CODING_TASK / MUTATION
    // ----------------------------------------------------
    console.log('[TEST 11] Testing "remove the redundant operations"...');
    const r11 = router.classify('remove the redundant operations');
    assert(r11.mode === ROUTER_MODES.CODING_TASK, 'Must be CODING_TASK');
    assert(r11.codingIntent === CODING_INTENTS.MUTATION, 'Must be MUTATION');
    console.log('[TEST 11 PASSED] "remove the redundant operations" -> CODING_TASK / MUTATION');

    // ----------------------------------------------------
    // TEST 12: "refactor this function" with active file context -> CODING_TASK / MUTATION
    // ----------------------------------------------------
    console.log('[TEST 12] Testing "refactor this function" with active file context...');
    const r12 = router.classify('refactor this function', { activeFilePath: 'src/calculator.ts' });
    assert(r12.mode === ROUTER_MODES.CODING_TASK, 'Must be CODING_TASK');
    assert(r12.codingIntent === CODING_INTENTS.MUTATION, 'Must be MUTATION');
    console.log('[TEST 12 PASSED] "refactor this function" with active file context -> CODING_TASK / MUTATION');

    // ----------------------------------------------------
    // TEST 13: "do not modify anything, analyze this file" -> READ_ONLY
    // ----------------------------------------------------
    console.log('[TEST 13] Testing negative mutation directive ("do not modify anything, fix problems by analyzing")...');
    const r13 = router.classify('do not modify anything, fix problems by analyzing cart_calculator.py');
    assert(r13.mode === ROUTER_MODES.CODING_TASK, 'Must be CODING_TASK');
    assert(r13.codingIntent === CODING_INTENTS.READ_ONLY, 'Negative directive forces READ_ONLY');
    console.log('[TEST 13 PASSED] Negative directive forced READ_ONLY despite "fix" verb.');

    // ----------------------------------------------------
    // TEST 14: "what is the architecture of NEXUS?" -> CONVERSATION
    // ----------------------------------------------------
    console.log('[TEST 14] Testing "what is the architecture of NEXUS?"...');
    const r14 = router.classify('what is the architecture of NEXUS?');
    assert(r14.mode === ROUTER_MODES.CONVERSATION, 'Must be CONVERSATION');
    console.log('[TEST 14 PASSED] "what is the architecture of NEXUS?" -> CONVERSATION');

    // ----------------------------------------------------
    // TEST 15: "inspect the architecture of this repository" -> CODING_TASK / READ_ONLY
    // ----------------------------------------------------
    console.log('[TEST 15] Testing "inspect the architecture of this repository"...');
    const r15 = router.classify('inspect the architecture of this repository');
    assert(r15.mode === ROUTER_MODES.CODING_TASK, 'Must be CODING_TASK');
    assert(r15.codingIntent === CODING_INTENTS.READ_ONLY, 'Must be READ_ONLY');
    console.log('[TEST 15 PASSED] "inspect the architecture of this repository" -> CODING_TASK / READ_ONLY');

    // ----------------------------------------------------
    // TEST 16: Filename Mentioned -> Strong Coding Signal
    // ----------------------------------------------------
    console.log('[TEST 16] Testing arbitrary filename mentioned...');
    const r16 = router.classify('Check orders.py');
    assert(r16.mode === ROUTER_MODES.CODING_TASK, 'Filename is strong coding signal');
    console.log('[TEST 16 PASSED] orders.py triggered CODING_TASK.');

    // ----------------------------------------------------
    // TEST 17: Workspace Path Mentioned -> Strong Coding Signal
    // ----------------------------------------------------
    console.log('[TEST 17] Testing path reference...');
    const r17 = router.classify('Look at src/components/button.tsx');
    assert(r17.mode === ROUTER_MODES.CODING_TASK, 'Path is strong coding signal');
    console.log('[TEST 17 PASSED] src/components/button.tsx triggered CODING_TASK.');

    // ----------------------------------------------------
    // TEST 18: Ambiguous Message -> Conservative CONVERSATION
    // ----------------------------------------------------
    console.log('[TEST 18] Testing ambiguous prompt...');
    const r18 = router.classify('maybe something');
    assert(r18.mode === ROUTER_MODES.CONVERSATION, 'Ambiguous message resolves conservatively to CONVERSATION');
    assert(r18.confidence <= 0.65, 'Confidence reflects conservative fallback');
    console.log('[TEST 18 PASSED] Ambiguous message safely resolved to CONVERSATION.');

    // ----------------------------------------------------
    // TEST 19 & 20: Conversation Path Bypasses Workspace Scan & AgentLoop
    // ----------------------------------------------------
    console.log('[TEST 19 & 20] Verifying Conversation Path bypasses workspace tools & AgentLoop...');
    const runtime = HarnessRuntime.createIsolated();
    const convEvents = [];
    const unsub = runtime.subscribe((evt) => convEvents.push(evt));

    const convResult = await runtime.handleRequest({
      userInput: 'Hello, how can you help me with Python?',
      workspacePath: testWorkspaceDir,
    });

    unsub();
    assert(convResult.mode === ROUTER_MODES.CONVERSATION, 'Mode must be CONVERSATION');
    assert(convResult.success === true, 'Result must be success');
    // Ensure no TOOL_CALL or TOOL_RESULT items were created
    const toolCallEvt = convEvents.find((e) => e.payload?.item?.type === ITEM_TYPES.TOOL_CALL);
    assert(toolCallEvt === undefined, 'No TOOL_CALL event allowed during CONVERSATION');
    console.log('[TEST 19 & 20 PASSED] Conversation path bypassed workspace tools and AgentLoop.');

    // ----------------------------------------------------
    // TEST 21: Coding Request Invokes HarnessRuntime
    // ----------------------------------------------------
    console.log('[TEST 21] Testing Coding Request invocation in HarnessRuntime...');
    const codingRes = await runtime.handleRequest({
      userInput: 'Inspect cart_calculator.py',
      workspacePath: testWorkspaceDir,
      modelHandler: async () => 'Found redundant calculation in cart_calculator.py.',
    });
    assert(codingRes.mode === ROUTER_MODES.CODING_TASK, 'Mode must be CODING_TASK');
    assert(codingRes.codingIntent === CODING_INTENTS.READ_ONLY, 'Intent must be READ_ONLY');
    assert(codingRes.status === TURN_STATUS.COMPLETED, 'Turn must complete');
    console.log('[TEST 21 PASSED] Coding request executed via HarnessRuntime.');

    // ----------------------------------------------------
    // TEST 22 & 23: Tool Permissions by Coding Intent (READ_ONLY vs MUTATION)
    // ----------------------------------------------------
    console.log('[TEST 22 & 23] Testing READ_ONLY vs MUTATION Tool Permissions...');
    const thread = runtime.createThread({ metadata: { workspacePath: testWorkspaceDir } });

    // READ_ONLY Turn: Attempting apply_patch must be blocked
    const roOutcome = await runtime.runTurn({
      threadId: thread.threadId,
      userInput: 'Inspect and do not modify',
      workspacePath: testWorkspaceDir,
      intent: CODING_INTENTS.READ_ONLY,
      modelHandler: async (messages) => {
        const hasTool = messages.some((m) => m.role === 'tool');
        if (!hasTool) {
          return {
            tool_calls: [
              {
                callId: 'c_patch_blocked',
                toolName: 'apply_patch',
                arguments: {
                  edits: [
                    { filePath: 'cart_calculator.py', original: 'x * 1', replacement: 'x' },
                  ],
                },
              },
            ],
          };
        }
        const toolMsg = messages.find((m) => m.role === 'tool');
        assert(toolMsg.content?.error?.includes('disallowed in READ_ONLY'), 'Error must report disallowed tool');
        return 'I could not modify files because this is a read-only task.';
      },
    });
    assert(roOutcome.success === true, 'Turn completes safely after blocking disallowed mutation tool');
    console.log('[TEST 22 & 23 PASSED] READ_ONLY strictly blocked apply_patch tool execution.');

    // ----------------------------------------------------
    // TEST 24: END-TO-END INTEGRATION FLOW A ("hi")
    // ----------------------------------------------------
    console.log('[TEST 24] Testing Integration Flow A ("hi")...');
    const flowA = await runtime.handleRequest({
      userInput: 'hi',
      workspacePath: testWorkspaceDir,
    });
    assert(flowA.mode === ROUTER_MODES.CONVERSATION, 'Flow A: Mode CONVERSATION');
    assert(typeof flowA.response === 'string' && flowA.response.length > 0, 'Flow A: Valid response');
    console.log(`[TEST 24 PASSED] Flow A completed: "${flowA.response.slice(0, 40)}..."`);

    // ----------------------------------------------------
    // TEST 25: END-TO-END INTEGRATION FLOW B ("Find the redundant operations in cart_calculator.py")
    // ----------------------------------------------------
    console.log('[TEST 25] Testing Integration Flow B ("Find redundant operations")...');
    let flowBCalls = 0;
    const flowB = await runtime.handleRequest({
      userInput: 'Find the redundant operations in cart_calculator.py',
      workspacePath: testWorkspaceDir,
      modelHandler: async () => {
        flowBCalls++;
        if (flowBCalls === 1) {
          return {
            tool_calls: [
              { callId: 'c_b_read', toolName: 'read_file', arguments: { path: 'cart_calculator.py' } },
            ],
          };
        }
        return 'Found redundant identity multiplication x * 1 on line 2.';
      },
    });
    assert(flowB.mode === ROUTER_MODES.CODING_TASK, 'Flow B: Mode CODING_TASK');
    assert(flowB.codingIntent === CODING_INTENTS.READ_ONLY, 'Flow B: Intent READ_ONLY');
    assert(flowB.finalResponse.includes('redundant identity multiplication'), 'Flow B: Summary verified');
    console.log('[TEST 25 PASSED] Flow B completed cleanly as READ_ONLY task.');

    // ----------------------------------------------------
    // TEST 26: END-TO-END INTEGRATION FLOW C ("Remove the redundant operations in cart_calculator.py")
    // ----------------------------------------------------
    console.log('[TEST 26] Testing Integration Flow C ("Remove redundant operations")...');
    let flowCCalls = 0;
    const flowC = await runtime.handleRequest({
      userInput: 'Remove the redundant operations in cart_calculator.py',
      workspacePath: testWorkspaceDir,
      approvalMode: 'auto',
      modelHandler: async () => {
        flowCCalls++;
        if (flowCCalls === 1) {
          return {
            tool_calls: [
              { callId: 'c_c_read', toolName: 'read_file', arguments: { path: 'cart_calculator.py' } },
            ],
          };
        }
        if (flowCCalls === 2) {
          return {
            tool_calls: [
              {
                callId: 'c_c_patch',
                toolName: 'apply_patch',
                arguments: {
                  edits: [
                    {
                      filePath: 'cart_calculator.py',
                      original: '    return x * 1 # Redundant',
                      replacement: '    return x # Cleaned and simplified',
                    },
                  ],
                },
              },
            ],
          };
        }
        return 'Successfully removed the redundant multiplication in cart_calculator.py.';
      },
    });
    assert(flowC.mode === ROUTER_MODES.CODING_TASK, 'Flow C: Mode CODING_TASK');
    assert(flowC.codingIntent === CODING_INTENTS.MUTATION, 'Flow C: Intent MUTATION');
    assert(flowC.success === true, 'Flow C: Turn succeeded');

    const diskContent = fs.readFileSync(sampleFile, 'utf-8');
    assert(diskContent.includes('# Cleaned and simplified'), 'Flow C: File patched on disk');
    console.log('[TEST 26 PASSED] Flow C completed cleanly as MUTATION task with verified patch.');

    console.log('\n====================================================');
    console.log('[SUCCESS] ALL 26 REQUEST ROUTER TESTS (MILESTONE 4) PASSED CLEANLY.');
    console.log('====================================================\n');
  } finally {
    try {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
      fs.rmSync(testWorkspaceDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

if (require.main === module) {
  runRouterTests().catch((err) => {
    console.error('[TEST SUITE CRASHED]', err);
    process.exit(1);
  });
}

module.exports = { runRouterTests };
