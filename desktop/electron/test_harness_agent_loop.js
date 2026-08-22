/**
 * NEXUS CODEX HARNESS - ITERATIVE AGENT LOOP TEST SUITE (MILESTONE 2)
 * 
 * Verifies:
 * 1. Final response without tools
 * 2. Single tool call execution (read_file)
 * 3. Multiple sequential tool calls (read_file -> search_workspace -> apply_patch -> run_tests)
 * 4. Tool results fed back to model context
 * 5. Tool execution failure handling
 * 6. Malformed tool call handling
 * 7. Maximum iteration safety limit
 * 8. Turn cancellation handling
 * 9. read_file security & bounds
 * 10. search_workspace integration
 * 11. run_tests integration
 * 12. run_command safety & approval boundary
 * 13. apply_patch Patch Firewall and Transactional Applier enforcement
 * 14. Secret filter redaction across tool results
 * 15. Persisted tool history round-trip across restart
 * 16. Monotonic event ordering across entire loop
 * 17. Concurrent thread isolation
 * 18. Multi-provider response normalization
 * 19. Simulated workflow: "Find the redundant operations in cart_calculator.py"
 * 20. Simulated workflow: "Remove the redundant operations in cart_calculator.py"
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const {
  harnessRuntime,
  HarnessRuntime,
  toolRegistry,
  modelAdapter,
  ITEM_TYPES,
  ITEM_STATUS,
  TURN_STATUS,
  EVENT_TYPES,
} = require('./harness');

function assert(condition, message) {
  if (!condition) {
    console.error(`[ASSERTION FAILED] ${message}`);
    throw new Error(`Assertion failed: ${message}`);
  }
}

async function runAgentLoopTests() {
  console.log('====================================================');
  console.log('[TEST] Starting NEXUS Codex Harness Agent Loop Suite (Milestone 2)...');
  console.log('====================================================\n');

  // Setup isolated temporary storage & workspace directories
  const testStorageDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-agent-loop-storage-'));
  const testWorkspaceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-agent-loop-workspace-'));
  process.env.ECHO_CONTINUUM_DIR = testStorageDir;

  // Create sample workspace files for tests
  const cartFilePath = path.join(testWorkspaceDir, 'cart_calculator.py');
  const cartInitialContent = `# Cart Calculator Engine\ndef compute_subtotal(items):\n    subtotal = 0\n    for item in items:\n        subtotal += item.price * item.quantity\n    subtotal = subtotal * 1 # Redundant operation\n    return subtotal\n`;
  fs.writeFileSync(cartFilePath, cartInitialContent, 'utf-8');

  const testFilePath = path.join(testWorkspaceDir, 'test_cart.py');
  const testContent = `def test_cart_subtotal():\n    assert True\n`;
  fs.writeFileSync(testFilePath, testContent, 'utf-8');

  try {
    const runtime = HarnessRuntime.createIsolated();

    // ----------------------------------------------------
    // TEST 1: Final Response Without Tools (Conversational Turn)
    // ----------------------------------------------------
    console.log('[TEST 1] Testing Final Response Without Tools (Conversational Turn)...');
    const thread1 = runtime.createThread({ metadata: { workspacePath: testWorkspaceDir } });

    const res1 = await runtime.runTurn({
      threadId: thread1.threadId,
      userInput: 'Hello, what tools do you have?',
      workspacePath: testWorkspaceDir,
      intent: 'GENERAL_CHAT',
      modelHandler: async (messages, tools) => {
        assert(tools.length === 0, 'General chat turn must have 0 tools');
        return 'Hello! I am NEXUS pair programmer ready to inspect and modify code.';
      },
    });

    assert(res1.success, 'Turn must succeed');
    assert(res1.status === TURN_STATUS.COMPLETED, 'Turn status must be COMPLETED');
    assert(res1.finalResponse.includes('NEXUS pair programmer'), 'Response text must match');

    const turn1 = runtime.getTurn(res1.turnId);
    assert(turn1.items.length === 2, `Expected 2 items (USER_MESSAGE + AGENT_MESSAGE), got ${turn1.items.length}`);
    assert(turn1.items[0].type === ITEM_TYPES.USER_MESSAGE, 'First item must be USER_MESSAGE');
    assert(turn1.items[1].type === ITEM_TYPES.AGENT_MESSAGE, 'Second item must be AGENT_MESSAGE');
    console.log('[TEST 1 PASSED] Conversational turn completed cleanly.');

    // ----------------------------------------------------
    // TEST 2: Single Tool Call Execution (read_file)
    // ----------------------------------------------------
    console.log('[TEST 2] Testing Single Tool Call Execution (read_file)...');
    let turn2ModelCalls = 0;

    const res2 = await runtime.runTurn({
      threadId: thread1.threadId,
      userInput: 'Read cart_calculator.py',
      workspacePath: testWorkspaceDir,
      modelHandler: async (messages, tools) => {
        turn2ModelCalls++;
        if (turn2ModelCalls === 1) {
          // Model calls read_file tool
          return {
            content: 'Let me inspect the file.',
            tool_calls: [
              {
                callId: 'call_read_1',
                toolName: 'read_file',
                arguments: { path: 'cart_calculator.py' },
              },
            ],
          };
        }
        // Second call: Model receives tool result and provides final response
        const toolMsg = messages.find((m) => m.role === 'tool');
        assert(toolMsg !== undefined, 'Model context must receive tool message');
        assert(toolMsg.content?.content?.includes('compute_subtotal'), 'Tool message content must contain file content');
        return 'I have read cart_calculator.py. It contains compute_subtotal with a redundant multiplication by 1.';
      },
    });

    assert(res2.success, 'Turn 2 must succeed');
    assert(res2.status === TURN_STATUS.COMPLETED, 'Turn status must be COMPLETED');
    assert(turn2ModelCalls === 2, `Model should have been called 2 times, got ${turn2ModelCalls}`);

    const turn2 = runtime.getTurn(res2.turnId);
    // Expected items: USER_MESSAGE, TOOL_CALL, TOOL_RESULT, AGENT_MESSAGE
    assert(turn2.items.length === 4, `Expected 4 items, got ${turn2.items.length}`);
    assert(turn2.items[0].type === ITEM_TYPES.USER_MESSAGE, 'Item 0 must be USER_MESSAGE');
    assert(turn2.items[1].type === ITEM_TYPES.TOOL_CALL, 'Item 1 must be TOOL_CALL');
    assert(turn2.items[1].payload.toolName === 'read_file', 'Tool name must be read_file');
    assert(turn2.items[2].type === ITEM_TYPES.TOOL_RESULT, 'Item 2 must be TOOL_RESULT');
    assert(turn2.items[2].payload.success === true, 'Tool result must be success');
    assert(turn2.items[3].type === ITEM_TYPES.AGENT_MESSAGE, 'Item 3 must be AGENT_MESSAGE');
    console.log('[TEST 2 PASSED] Single tool call executed and observed cleanly.');

    // ----------------------------------------------------
    // TEST 3 & 4: Multiple Sequential Tool Calls (read_file -> search_workspace -> apply_patch -> run_tests)
    // ----------------------------------------------------
    console.log('[TEST 3 & 4] Testing Multiple Sequential Tool Calls & Context Feedback...');
    let turn3ModelCalls = 0;

    const res3 = await runtime.runTurn({
      threadId: thread1.threadId,
      userInput: 'Refactor cart calculator and run tests',
      workspacePath: testWorkspaceDir,
      approvalMode: 'auto',
      modelHandler: async (messages, tools) => {
        turn3ModelCalls++;
        if (turn3ModelCalls === 1) {
          return {
            tool_calls: [
              { callId: 'c1', toolName: 'read_file', arguments: { path: 'cart_calculator.py' } },
            ],
          };
        } else if (turn3ModelCalls === 2) {
          return {
            tool_calls: [
              { callId: 'c2', toolName: 'search_workspace', arguments: { query: 'redundant' } },
            ],
          };
        } else if (turn3ModelCalls === 3) {
          return {
            tool_calls: [
              {
                callId: 'c3',
                toolName: 'apply_patch',
                arguments: {
                  edits: [
                    {
                      filePath: 'cart_calculator.py',
                      original: '    subtotal = subtotal * 1 # Redundant operation',
                      replacement: '    # Redundant operation removed cleanly',
                    },
                  ],
                },
              },
            ],
          };
        } else if (turn3ModelCalls === 4) {
          return {
            tool_calls: [
              { callId: 'c4', toolName: 'run_tests', arguments: { scope: 'test_cart.py' } },
            ],
          };
        }

        return 'Refactoring complete and verified with test suite.';
      },
    });

    assert(res3.success, 'Turn 3 must succeed');
    assert(turn3ModelCalls === 5, `Expected 5 model iterations, got ${turn3ModelCalls}`);

    const turn3 = runtime.getTurn(res3.turnId);
    // Expected items: USER_MESSAGE (1) + (TOOL_CALL + TOOL_RESULT) * 4 (8) + CHANGE_SET (1) + FILE_CHANGE (1) + AGENT_MESSAGE (1) = 12 items
    assert(turn3.items.length === 12, `Expected 12 items in turn 3, got ${turn3.items.length}`);
    assert(turn3.items.some((i) => i.type === ITEM_TYPES.CHANGE_SET), 'Turn 3 must contain CHANGE_SET item');
    assert(turn3.items.some((i) => i.type === ITEM_TYPES.FILE_CHANGE), 'Turn 3 must contain FILE_CHANGE item');
    const toolCallItems = turn3.items.filter((i) => i.type === ITEM_TYPES.TOOL_CALL);
    const toolResultItems = turn3.items.filter((i) => i.type === ITEM_TYPES.TOOL_RESULT);
    assert(toolCallItems.length === 4, `Expected 4 TOOL_CALL items, got ${toolCallItems.length}`);
    assert(toolResultItems.length === 4, `Expected 4 TOOL_RESULT items, got ${toolResultItems.length}`);

    // Verify file content was mutated on disk via transactionalPatchApplier
    const updatedCart = fs.readFileSync(cartFilePath, 'utf-8');
    assert(updatedCart.includes('# Redundant operation removed cleanly'), 'Patch must be applied on disk');
    console.log('[TEST 3 & 4 PASSED] 4-step sequential tool execution pipeline verified.');

    // ----------------------------------------------------
    // TEST 5: Tool Execution Failure Handling
    // ----------------------------------------------------
    console.log('[TEST 5] Testing Tool Execution Failure Handling (Non-existent file)...');
    let turn5ModelCalls = 0;

    const res5 = await runtime.runTurn({
      threadId: thread1.threadId,
      userInput: 'Read missing.py',
      workspacePath: testWorkspaceDir,
      modelHandler: async (messages) => {
        turn5ModelCalls++;
        if (turn5ModelCalls === 1) {
          return {
            tool_calls: [
              { callId: 'call_missing', toolName: 'read_file', arguments: { path: 'does_not_exist.py' } },
            ],
          };
        }
        const lastToolResult = messages.find((m) => m.role === 'tool');
        assert(lastToolResult.content?.error?.includes('File not found'), 'Model received tool error');
        return 'I could not find does_not_exist.py in the workspace.';
      },
    });

    assert(res5.success, 'Turn should succeed gracefully despite tool error');
    const turn5 = runtime.getTurn(res5.turnId);
    const failedToolResult = turn5.items.find((i) => i.type === ITEM_TYPES.TOOL_RESULT);
    assert(failedToolResult.payload.success === false, 'Tool result status must be failed');
    assert(failedToolResult.status === ITEM_STATUS.FAILED, 'Item status must be FAILED');
    console.log('[TEST 5 PASSED] Tool failure captured and handled cleanly.');

    // ----------------------------------------------------
    // TEST 6: Malformed Tool Call Handling
    // ----------------------------------------------------
    console.log('[TEST 6] Testing Malformed Tool Call Handling (Unknown Tool)...');
    let turn6ModelCalls = 0;

    const res6 = await runtime.runTurn({
      threadId: thread1.threadId,
      userInput: 'Run unknown tool',
      workspacePath: testWorkspaceDir,
      modelHandler: async (messages) => {
        turn6ModelCalls++;
        if (turn6ModelCalls === 1) {
          return {
            tool_calls: [
              { callId: 'call_unknown', toolName: 'non_existent_tool', arguments: { a: 1 } },
            ],
          };
        }
        return 'Handled unknown tool error cleanly.';
      },
    });

    assert(res6.success, 'Turn must complete gracefully');
    const turn6 = runtime.getTurn(res6.turnId);
    const unknownToolResult = turn6.items.find((i) => i.type === ITEM_TYPES.TOOL_RESULT);
    assert(unknownToolResult.payload.error.includes('not registered'), 'Error must report tool not registered');
    console.log('[TEST 6 PASSED] Unknown tool call safely handled without unhandled exception.');

    // ----------------------------------------------------
    // TEST 7: Maximum Iteration Safety Limit
    // ----------------------------------------------------
    console.log('[TEST 7] Testing Maximum Iteration Safety Limit...');
    const res7 = await runtime.runTurn({
      threadId: thread1.threadId,
      userInput: 'Infinite loop test',
      workspacePath: testWorkspaceDir,
      maxIterations: 3,
      modelHandler: async () => {
        // Keeps requesting read_file forever
        return {
          tool_calls: [
            { callId: `c_${Date.now()}`, toolName: 'read_file', arguments: { path: 'cart_calculator.py' } },
          ],
        };
      },
    });

    assert(res7.success === false, 'Turn must fail when exceeding maxIterations');
    assert(res7.status === TURN_STATUS.FAILED, 'Turn status must be FAILED');
    assert(res7.error.includes('Maximum iteration limit of 3 reached'), 'Error message must reflect iteration cap');

    const turn7 = runtime.getTurn(res7.turnId);
    const errorItem7 = turn7.items.find((i) => i.type === ITEM_TYPES.ERROR);
    assert(errorItem7 !== undefined, 'Turn must contain ERROR item');
    console.log('[TEST 7 PASSED] Maximum iteration safety limit strictly enforced.');

    // ----------------------------------------------------
    // TEST 8: Cancellation Mid-Loop
    // ----------------------------------------------------
    console.log('[TEST 8] Testing Turn Cancellation Mid-Loop...');
    let toolExecutedAfterCancel = false;

    // Start turn
    const turn8 = runtime.startTurn(thread1.threadId, 'Cancel test');
    // Cancel the turn before running AgentLoop
    runtime.cancelTurn(turn8.turnId);

    const res8 = await runtime.runTurn({
      threadId: thread1.threadId,
      turnId: turn8.turnId,
      userInput: 'Cancel test',
      workspacePath: testWorkspaceDir,
      modelHandler: async () => {
        toolExecutedAfterCancel = true;
        return 'Should not reach here';
      },
    });

    assert(res8.status === TURN_STATUS.CANCELLED, 'Turn status must be CANCELLED');
    assert(!toolExecutedAfterCancel, 'Model/Tool should not execute after cancellation');
    console.log('[TEST 8 PASSED] Turn cancellation stopped execution immediately.');

    // ----------------------------------------------------
    // TEST 9: read_file Security & Path Traversal Blocking
    // ----------------------------------------------------
    console.log('[TEST 9] Testing read_file Security & Path Traversal Defense...');
    const readTraversalRes = await runtime.executeTool('read_file', { path: '../../etc/passwd' }, {
      workspacePath: testWorkspaceDir,
    });
    assert(readTraversalRes.success === false, 'Path traversal read must be rejected');
    assert(readTraversalRes.error.includes('Security Violation'), 'Error must report Security Violation');
    console.log('[TEST 9 PASSED] read_file path traversal attack blocked.');

    // ----------------------------------------------------
    // TEST 10: search_workspace Match Structure & Scope
    // ----------------------------------------------------
    console.log('[TEST 10] Testing search_workspace Tool...');
    const searchRes = await runtime.executeTool('search_workspace', { query: 'compute_subtotal' }, {
      workspacePath: testWorkspaceDir,
    });
    assert(searchRes.success === true, 'Search must succeed');
    assert(searchRes.result.matches.length > 0, 'Search should find compute_subtotal');
    assert(searchRes.result.matches[0].file === 'cart_calculator.py', 'Match file must be cart_calculator.py');
    console.log('[TEST 10 PASSED] search_workspace returned structured line/column matches.');

    // ----------------------------------------------------
    // TEST 11: run_tests Tool Execution
    // ----------------------------------------------------
    console.log('[TEST 11] Testing run_tests Tool...');
    const testExecRes = await runtime.executeTool('run_tests', { scope: 'test_cart.py' }, {
      workspacePath: testWorkspaceDir,
    });
    assert(testExecRes.type === 'tool_result', 'Result type must be tool_result');
    assert(testExecRes.result !== null, 'Test result should be present');
    console.log('[TEST 11 PASSED] run_tests executed via TestExecutor.');

    // ----------------------------------------------------
    // TEST 12: run_command Policy & Approval Boundary
    // ----------------------------------------------------
    console.log('[TEST 12] Testing run_command Policy and Approval Boundary...');
    // High-risk command (rm -rf) must be blocked by policy
    const dangerousCmdRes = await runtime.executeTool('run_command', { command: 'rm -rf /' }, {
      workspacePath: testWorkspaceDir,
      approvalMode: 'strict',
    });
    assert(dangerousCmdRes.success === false, 'Dangerous command must be rejected');
    assert(dangerousCmdRes.requiresApproval === true, 'dangerous command must require approval');
    assert(dangerousCmdRes.policyDecision.riskLevel === 'CRITICAL', 'Risk level must be CRITICAL');

    // Safe command (echo hello)
    const safeCmdRes = await runtime.executeTool('run_command', { command: 'echo "hello nexus"' }, {
      workspacePath: testWorkspaceDir,
      approvalMode: 'auto',
    });
    assert(safeCmdRes.success === true, 'Safe command must execute');
    assert(safeCmdRes.result.stdout.includes('hello nexus'), 'Output must contain stdout');
    console.log('[TEST 12 PASSED] run_command safety and approval boundary verified.');

    // ----------------------------------------------------
    // TEST 13: apply_patch Transactional Safety & Firewall Enforcement
    // ----------------------------------------------------
    console.log('[TEST 13] Testing apply_patch Transactional Enforcement...');
    // Attempt patch with mismatched original substring
    const badPatchRes = await runtime.executeTool('apply_patch', {
      edits: [
        {
          filePath: 'cart_calculator.py',
          original: 'non_existent_code_snippet_xyz',
          replacement: 'new_code',
        },
      ],
    }, {
      workspacePath: testWorkspaceDir,
      approvalMode: 'auto',
    });
    assert(badPatchRes.success === false, 'Invalid patch original substring must fail');
    assert(badPatchRes.result.rolledBack === true, 'Failed transaction must roll back');
    console.log('[TEST 13 PASSED] apply_patch transactional rollback verified.');

    // ----------------------------------------------------
    // TEST 14: Secret Filter Redaction in Tool Results
    // ----------------------------------------------------
    console.log('[TEST 14] Testing Secret Filter Redaction in Tool Output...');
    const secretFile = path.join(testWorkspaceDir, 'secrets.env');
    fs.writeFileSync(secretFile, 'GEMINI_API_KEY="AIzaSySECRETKEY12345"\nDATABASE_URL="postgres://admin:superSecretPassword@localhost/db"\n', 'utf-8');

    const readSecretRes = await runtime.executeTool('read_file', { path: 'secrets.env' }, {
      workspacePath: testWorkspaceDir,
    });
    assert(readSecretRes.success === true, 'read_file secrets.env must succeed');
    assert(!readSecretRes.result.content.includes('AIzaSySECRETKEY12345'), 'API key must be redacted');
    assert(!readSecretRes.result.content.includes('superSecretPassword'), 'Password must be redacted');
    assert(readSecretRes.result.content.includes('[REDACTED_SECRET:'), 'Redaction placeholder must be present');
    console.log('[TEST 14 PASSED] Secret filter redacted API keys and passwords in tool results.');

    // ----------------------------------------------------
    // TEST 15: Persisted Tool History Across Restart
    // ----------------------------------------------------
    console.log('[TEST 15] Testing Persisted Tool History Across Restart...');
    const saveRes = runtime.saveThread(thread1.threadId, testWorkspaceDir);
    assert(saveRes.success, 'Thread with tool calls must save cleanly');

    const freshRuntime = HarnessRuntime.createIsolated();
    const loadRes = freshRuntime.loadThread(thread1.threadId, testWorkspaceDir);
    assert(loadRes.success, 'Thread must load cleanly in fresh runtime');
    assert(loadRes.thread.turns.length >= 3, `Expected at least 3 turns, got ${loadRes.thread.turns.length}`);

    // Verify Turn 2 has its tool call and tool result items intact
    const restoredTurn2 = loadRes.thread.turns.find((t) => t.turnId === res2.turnId);
    assert(restoredTurn2 !== undefined, 'Turn 2 must exist in restored thread');
    assert(restoredTurn2.items.length === 4, `Restored Turn 2 must have 4 items, got ${restoredTurn2.items.length}`);
    assert(restoredTurn2.items.some((i) => i.type === ITEM_TYPES.TOOL_CALL), 'TOOL_CALL item restored');
    assert(restoredTurn2.items.some((i) => i.type === ITEM_TYPES.TOOL_RESULT), 'TOOL_RESULT item restored');
    console.log('[TEST 15 PASSED] Complete tool execution items restored across restart.');

    // ----------------------------------------------------
    // TEST 16: Monotonic Event Ordering Across Agent Loop
    // ----------------------------------------------------
    console.log('[TEST 16] Testing Monotonic Event Stream...');
    const events = runtime.getEvents({ threadId: thread1.threadId });
    assert(events.length > 20, `Expected many events emitted, got ${events.length}`);

    for (let i = 0; i < events.length; i++) {
      assert(typeof events[i].sequenceNumber === 'number', 'Sequence number must be numeric');
      if (i > 0) {
        assert(events[i].sequenceNumber > events[i - 1].sequenceNumber, 'Sequence numbers must be strictly increasing');
      }
    }
    console.log(`[TEST 16 PASSED] ${events.length} events verified in strict monotonic order.`);

    // ----------------------------------------------------
    // TEST 17: Concurrent Thread Isolation in Iterative Loop
    // ----------------------------------------------------
    console.log('[TEST 17] Testing Concurrent Thread Isolation...');
    const threadA = runtime.createThread({ metadata: { workspacePath: testWorkspaceDir } });
    const threadB = runtime.createThread({ metadata: { workspacePath: testWorkspaceDir } });

    const [loopA, loopB] = await Promise.all([
      runtime.runTurn({
        threadId: threadA.threadId,
        userInput: 'Thread A task',
        workspacePath: testWorkspaceDir,
        modelHandler: async () => ({
          tool_calls: [{ callId: 'ca', toolName: 'read_file', arguments: { path: 'cart_calculator.py' } }],
        }),
      }),
      runtime.runTurn({
        threadId: threadB.threadId,
        userInput: 'Thread B task',
        workspacePath: testWorkspaceDir,
        modelHandler: async () => 'Thread B completed directly.',
      }),
    ]);

    const turnA = runtime.getTurn(loopA.turnId);
    const turnB = runtime.getTurn(loopB.turnId);
    assert(turnA.threadId === threadA.threadId, 'Turn A belongs to Thread A');
    assert(turnB.threadId === threadB.threadId, 'Turn B belongs to Thread B');
    assert(turnA.items.some((i) => i.type === ITEM_TYPES.TOOL_CALL), 'Turn A has tool call');
    assert(!turnB.items.some((i) => i.type === ITEM_TYPES.TOOL_CALL), 'Turn B has zero tool calls');
    console.log('[TEST 17 PASSED] Concurrent threads and agent loops strictly isolated.');

    // ----------------------------------------------------
    // TEST 18: Multi-Provider Response Normalization
    // ----------------------------------------------------
    console.log('[TEST 18] Testing Multi-Provider Response Normalization...');
    // 1. OpenAI format
    const openAiNormalized = modelAdapter.normalizeResponse({
      content: 'Thinking...',
      tool_calls: [
        { id: 'call_oa', function: { name: 'read_file', arguments: JSON.stringify({ path: 'a.py' }) } },
      ],
    });
    assert(openAiNormalized.toolCalls.length === 1, 'OpenAI tool call parsed');
    assert(openAiNormalized.toolCalls[0].toolName === 'read_file', 'Tool name read_file');
    assert(openAiNormalized.toolCalls[0].arguments.path === 'a.py', 'Arguments path a.py');

    // 2. Markdown JSON block format
    const markdownNormalized = modelAdapter.normalizeResponse('I will inspect the file.\n```json\n{\n  "tool_calls": [\n    {\n      "callId": "c_md",\n      "toolName": "read_file",\n      "arguments": { "path": "b.py" }\n    }\n  ]\n}\n```');
    assert(markdownNormalized.toolCalls.length === 1, 'Markdown JSON tool call parsed');
    assert(markdownNormalized.toolCalls[0].toolName === 'read_file', 'Tool name read_file');

    // 3. Direct conversational text
    const textNormalized = modelAdapter.normalizeResponse('All tasks completed successfully.');
    assert(textNormalized.toolCalls.length === 0, 'No tool calls');
    assert(textNormalized.content === 'All tasks completed successfully.', 'Content preserved');
    console.log('[TEST 18 PASSED] Provider response formats normalized cleanly.');

    // ----------------------------------------------------
    // TEST 19: Simulated Workflow "Find the redundant operations in cart_calculator.py"
    // ----------------------------------------------------
    console.log('[TEST 19] Testing Simulated Workflow: "Find the redundant operations in cart_calculator.py"...');
    let sim19Calls = 0;
    const simThread19 = runtime.createThread({ metadata: { workspacePath: testWorkspaceDir } });

    const simRes19 = await runtime.runTurn({
      threadId: simThread19.threadId,
      userInput: 'Find the redundant operations in cart_calculator.py',
      workspacePath: testWorkspaceDir,
      modelHandler: async (messages) => {
        sim19Calls++;
        if (sim19Calls === 1) {
          return {
            tool_calls: [
              { callId: 'call_sim19', toolName: 'read_file', arguments: { path: 'cart_calculator.py' } },
            ],
          };
        }
        return 'Found 1 redundant operation: line 7 performs `subtotal = subtotal * 1` which is a no-op.';
      },
    });

    assert(simRes19.success === true, 'Workflow 19 must succeed');
    assert(sim19Calls === 2, 'Must have 2 iterations');
    assert(simRes19.finalResponse.includes('Found 1 redundant operation'), 'Summary must report finding');
    console.log('[TEST 19 PASSED] Read -> Analyze -> Final response workflow completed.');

    // ----------------------------------------------------
    // TEST 20: Simulated Workflow "Remove the redundant operations in cart_calculator.py"
    // ----------------------------------------------------
    console.log('[TEST 20] Testing Simulated Workflow: "Remove the redundant operations in cart_calculator.py"...');
    let sim20Calls = 0;
    const simThread20 = runtime.createThread({ metadata: { workspacePath: testWorkspaceDir } });

    const simRes20 = await runtime.runTurn({
      threadId: simThread20.threadId,
      userInput: 'Remove the redundant operations in cart_calculator.py',
      workspacePath: testWorkspaceDir,
      approvalMode: 'auto',
      modelHandler: async (messages) => {
        sim20Calls++;
        if (sim20Calls === 1) {
          // Model reads file
          return {
            tool_calls: [{ callId: 'c20_1', toolName: 'read_file', arguments: { path: 'cart_calculator.py' } }],
          };
        } else if (sim20Calls === 2) {
          // Model applies patch
          return {
            tool_calls: [
              {
                callId: 'c20_2',
                toolName: 'apply_patch',
                arguments: {
                  edits: [
                    {
                      filePath: 'cart_calculator.py',
                      original: '    subtotal = subtotal * 1',
                      replacement: '    # Identity multiplication removed',
                    },
                  ],
                },
              },
            ],
          };
        } else if (sim20Calls === 3) {
          // Model runs tests
          return {
            tool_calls: [{ callId: 'c20_3', toolName: 'run_tests', arguments: { scope: 'test_cart.py' } }],
          };
        }
        // Final response
        return 'Redundant operation removed and verified against test suite.';
      },
    });

    assert(simRes20.success === true, 'Workflow 20 must succeed');
    assert(sim20Calls === 4, 'Must execute 4 iterations (Read -> Patch -> Test -> Final Response)');
    assert(simRes20.finalResponse.includes('Redundant operation removed'), 'Final message confirmed');

    console.log('[TEST 20 PASSED] Read -> Patch -> Test -> Final response workflow completed.');

    console.log('\n====================================================');
    console.log('[SUCCESS] ALL 20 AGENT LOOP TESTS (MILESTONE 2) PASSED CLEANLY.');
    console.log('====================================================\n');
  } finally {
    try {
      fs.rmSync(testStorageDir, { recursive: true, force: true });
      fs.rmSync(testWorkspaceDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

if (require.main === module) {
  runAgentLoopTests().catch((err) => {
    console.error('[TEST SUITE CRASHED]', err);
    process.exit(1);
  });
}

module.exports = { runAgentLoopTests };
