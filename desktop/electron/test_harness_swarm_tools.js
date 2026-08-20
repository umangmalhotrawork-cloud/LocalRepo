/**
 * NEXUS CODEX HARNESS - SWARM TOOLS TEST SUITE (Milestone 11A)
 * Verifies Swarm as Native Agent Tools:
 * 1. swarm_plan registration
 * 2. schema validation
 * 3. valid plan execution
 * 4. malformed plan rejection
 * 5. swarm_execute registration
 * 6. successful execution
 * 7. unknown swarm rejection
 * 8. swarm_cancel registration
 * 9. cancellation
 * 10. parent ownership boundary
 * 11. ToolRegistry integration
 * 12. ModelAdapter exposure
 * 13. structured result
 * 14. ContextEngine compact result
 * 15. persistence
 * 16. EvidenceGraph references
 * 17. read-only swarm
 * 18. mutation swarm
 * 19. child workspace isolation
 * 20. conflict reporting
 * 21. provider failure
 * 22. malformed arguments
 * 23. tool cancellation
 * 24. worker failure propagation
 * 25. Deterministic Mock-Model E2E Scenario 1 (Independent Investigation)
 * 26. Deterministic Mock-Model E2E Scenario 2 (Multi-Worker Refactor & Adoption)
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

process.env.ECHO_CONTINUUM_DIR = path.join(os.tmpdir(), `nexus_test_swarm_tools_continuum_${Date.now()}`);
fs.mkdirSync(process.env.ECHO_CONTINUUM_DIR, { recursive: true });

const {
  HarnessRuntime,
  ToolRegistry,
  ModelAdapter,
  ContextEngine,
  SwarmOrchestrator,
  SwarmPlanTool,
  SwarmExecuteTool,
  SwarmCancelTool,
  SWARM_STATUS,
  SWARM_TASK_STATUS,
  SWARM_FAILURE_POLICY,
  SWARM_CONFLICT_CATEGORY,
  ITEM_TYPES,
  TURN_STATUS,
  ChangeSet,
} = require('./harness');
const { evidenceGraph } = require('./evidence/EvidenceGraph');

let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  try {
    fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    console.error(err.stack);
    failedTests++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passedTests++;
  } catch (err) {
    console.error(`[FAIL] ${name}:`, err.message);
    console.error(err.stack);
    failedTests++;
  }
}

console.log('====================================================');
console.log('[TEST] Starting NEXUS Codex Harness Swarm Tools Suite (Milestone 11A)...');
console.log('====================================================\n');

// Helper: Setup isolated test workspace
function setupWorkspace() {
  const wsDir = path.join(os.tmpdir(), `nexus_ws_swarm_tools_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  fs.mkdirSync(wsDir, { recursive: true });
  fs.writeFileSync(path.join(wsDir, 'auth.ts'), 'export function verifyToken(token: string) { return Boolean(token); }\n');
  fs.writeFileSync(path.join(wsDir, 'session.ts'), 'export function getSession() { return { ttl: 3600 }; }\n');
  fs.writeFileSync(path.join(wsDir, 'middleware.ts'), 'export function authMiddleware(req: any) { return true; }\n');
  return wsDir;
}

(async () => {
  const testWs = setupWorkspace();
  const harness = HarnessRuntime.createIsolated({ isolated: true });

  // Test 1: swarm_plan registration
  test('Test 1: swarm_plan tool definition and metadata', () => {
    assert.strictEqual(SwarmPlanTool.name, 'swarm_plan');
    assert.strictEqual(SwarmPlanTool.requiresApproval, false);
    assert.ok(typeof SwarmPlanTool.execute === 'function');
    assert.ok(SwarmPlanTool.inputSchema.properties.goal);
    assert.ok(SwarmPlanTool.inputSchema.properties.tasks);
  });

  // Test 2: schema validation
  await asyncTest('Test 2: swarm_plan schema validation on missing required arguments', async () => {
    const res1 = await SwarmPlanTool.execute(null, {});
    assert.strictEqual(res1.success, false);
    assert.ok(res1.error.includes('Arguments must be an object'));

    const res2 = await SwarmPlanTool.execute({}, {});
    assert.strictEqual(res2.success, false);
    assert.ok(res2.error.includes('Argument "goal" must be a non-empty string'));

    const res3 = await SwarmPlanTool.execute({ goal: 'Goal', tasks: [] }, {});
    assert.strictEqual(res3.success, false);
    assert.ok(res3.error.includes('Argument "tasks" must be a non-empty array'));
  });

  // Test 3: valid plan execution
  await asyncTest('Test 3: swarm_plan valid execution creates structured plan', async () => {
    const parentThread = harness.createThread({ metadata: { workspacePath: testWs } });
    const res = await SwarmPlanTool.execute(
      {
        goal: 'Audit system components',
        tasks: [
          { taskId: 'task_audit', role: 'researcher', objective: 'Inspect auth.ts' },
          { taskId: 'task_test', role: 'tester', objective: 'Check test coverage', dependencies: ['task_audit'] },
        ],
        maxConcurrency: 2,
        failurePolicy: 'BEST_EFFORT',
      },
      {
        threadId: parentThread.threadId,
        turnId: 'turn_123',
        workspacePath: testWs,
        swarmOrchestrator: harness.swarmOrchestrator,
      }
    );

    assert.strictEqual(res.success, true);
    assert.ok(res.swarmId.startsWith('swarm_'));
    assert.strictEqual(res.goal, 'Audit system components');
    assert.strictEqual(res.taskCount, 2);
    assert.strictEqual(res.maxConcurrency, 2);
    assert.strictEqual(res.failurePolicy, 'BEST_EFFORT');
    assert.strictEqual(res.tasks[0].taskId, 'task_audit');
    assert.deepStrictEqual(res.tasks[1].dependencies, ['task_audit']);
    assert.ok(res.nextRecommendedAction.includes('swarm_execute'));
  });

  // Test 4: malformed plan rejection
  await asyncTest('Test 4: swarm_plan malformed plan rejection (bad role, cycle)', async () => {
    const parentThread = harness.createThread({ metadata: { workspacePath: testWs } });

    // Unsupported role
    const resRole = await SwarmPlanTool.execute(
      {
        goal: 'Bad role test',
        tasks: [{ taskId: 't1', role: 'quantum_hacker', objective: 'Invalid role' }],
      },
      {
        threadId: parentThread.threadId,
        swarmOrchestrator: harness.swarmOrchestrator,
      }
    );
    assert.strictEqual(resRole.success, false);
    assert.ok(resRole.error.includes('Unsupported task role'));

    // Missing objective
    const resObj = await SwarmPlanTool.execute(
      {
        goal: 'Missing obj',
        tasks: [{ taskId: 't1', role: 'researcher', objective: '' }],
      },
      {
        threadId: parentThread.threadId,
        swarmOrchestrator: harness.swarmOrchestrator,
      }
    );
    assert.strictEqual(resObj.success, false);
    assert.ok(resObj.error.includes('missing a valid "objective"'));

    // Cycle detection
    const resCycle = await SwarmPlanTool.execute(
      {
        goal: 'Cycle test',
        tasks: [
          { taskId: 'a', role: 'researcher', objective: 'A', dependencies: ['b'] },
          { taskId: 'b', role: 'tester', objective: 'B', dependencies: ['a'] },
        ],
      },
      {
        threadId: parentThread.threadId,
        swarmOrchestrator: harness.swarmOrchestrator,
      }
    );
    assert.strictEqual(resCycle.success, false);
    assert.ok(resCycle.error.includes('Circular dependency detected'));
  });

  // Test 5: swarm_execute registration
  test('Test 5: swarm_execute tool definition and metadata', () => {
    assert.strictEqual(SwarmExecuteTool.name, 'swarm_execute');
    assert.strictEqual(SwarmExecuteTool.requiresApproval, false);
    assert.ok(typeof SwarmExecuteTool.execute === 'function');
    assert.ok(SwarmExecuteTool.inputSchema.properties.swarmId);
  });

  // Test 6: successful execution
  await asyncTest('Test 6: swarm_execute successful execution with structured fan-in', async () => {
    const parentThread = harness.createThread({ metadata: { workspacePath: testWs } });
    const planRes = await SwarmPlanTool.execute(
      {
        goal: 'Examine auth',
        tasks: [
          { taskId: 't_inspect', role: 'researcher', objective: 'Inspect auth.ts' },
        ],
      },
      {
        threadId: parentThread.threadId,
        swarmOrchestrator: harness.swarmOrchestrator,
      }
    );

    const execRes = await SwarmExecuteTool.execute(
      { swarmId: planRes.swarmId },
      {
        threadId: parentThread.threadId,
        workspacePath: testWs,
        swarmOrchestrator: harness.swarmOrchestrator,
        mockResponses: {
          t_inspect: 'Inspected auth.ts: exports verifyToken',
        },
      }
    );

    assert.strictEqual(execRes.success, true);
    assert.strictEqual(execRes.swarmId, planRes.swarmId);
    assert.strictEqual(execRes.status, SWARM_STATUS.COMPLETED);
    assert.strictEqual(execRes.completedTaskCount, 1);
    assert.strictEqual(execRes.failedTaskCount, 0);
    assert.ok(execRes.summaries.length > 0);
    assert.ok(execRes.taskResults.length === 1);
  });

  // Test 7: unknown swarm rejection
  await asyncTest('Test 7: swarm_execute rejects unknown swarmId', async () => {
    const res = await SwarmExecuteTool.execute(
      { swarmId: 'swarm_non_existent_999' },
      {
        threadId: 'thread_1',
        swarmOrchestrator: harness.swarmOrchestrator,
      }
    );
    assert.strictEqual(res.success, false);
    assert.ok(res.error.includes('not found'));
  });

  // Test 8: swarm_cancel registration
  test('Test 8: swarm_cancel tool definition and metadata', () => {
    assert.strictEqual(SwarmCancelTool.name, 'swarm_cancel');
    assert.strictEqual(SwarmCancelTool.requiresApproval, false);
    assert.ok(typeof SwarmCancelTool.execute === 'function');
    assert.ok(SwarmCancelTool.inputSchema.properties.swarmId);
  });

  // Test 9: cancellation
  await asyncTest('Test 9: swarm_cancel successfully cancels active swarm', async () => {
    const parentThread = harness.createThread({ metadata: { workspacePath: testWs } });
    const planRes = await SwarmPlanTool.execute(
      {
        goal: 'Cancellation test',
        tasks: [{ taskId: 't_cancel', role: 'researcher', objective: 'To be cancelled' }],
      },
      {
        threadId: parentThread.threadId,
        swarmOrchestrator: harness.swarmOrchestrator,
      }
    );

    const cancelRes = await SwarmCancelTool.execute(
      { swarmId: planRes.swarmId, reason: 'Parent decided to cancel' },
      {
        threadId: parentThread.threadId,
        swarmOrchestrator: harness.swarmOrchestrator,
      }
    );

    assert.strictEqual(cancelRes.success, true);
    assert.strictEqual(cancelRes.swarmId, planRes.swarmId);
    assert.strictEqual(cancelRes.status, 'CANCELLED');
    assert.strictEqual(cancelRes.reason, 'Parent decided to cancel');
  });

  // Test 10: parent ownership boundary
  await asyncTest('Test 10: Parent ownership boundary prevents foreign thread execution / cancellation', async () => {
    const threadA = harness.createThread({ metadata: { workspacePath: testWs } });
    const threadB = harness.createThread({ metadata: { workspacePath: testWs } });

    const planRes = await SwarmPlanTool.execute(
      {
        goal: 'Ownership boundary test',
        tasks: [{ taskId: 't_own', role: 'researcher', objective: 'Ownership check' }],
      },
      {
        threadId: threadA.threadId,
        swarmOrchestrator: harness.swarmOrchestrator,
      }
    );

    // Attempt execute from threadB
    const execForeign = await SwarmExecuteTool.execute(
      { swarmId: planRes.swarmId },
      {
        threadId: threadB.threadId,
        swarmOrchestrator: harness.swarmOrchestrator,
      }
    );
    assert.strictEqual(execForeign.success, false);
    assert.ok(execForeign.error.includes('Permission Denied'));

    // Attempt cancel from threadB
    const cancelForeign = await SwarmCancelTool.execute(
      { swarmId: planRes.swarmId },
      {
        threadId: threadB.threadId,
        swarmOrchestrator: harness.swarmOrchestrator,
      }
    );
    assert.strictEqual(cancelForeign.success, false);
    assert.ok(cancelForeign.error.includes('Permission Denied'));
  });

  // Test 11: ToolRegistry integration
  test('Test 11: ToolRegistry lists swarm_plan, swarm_execute, swarm_cancel', () => {
    const tools = harness.toolRegistry.list();
    const names = tools.map((t) => t.name);
    assert.ok(names.includes('swarm_plan'), 'swarm_plan not in ToolRegistry');
    assert.ok(names.includes('swarm_execute'), 'swarm_execute not in ToolRegistry');
    assert.ok(names.includes('swarm_cancel'), 'swarm_cancel not in ToolRegistry');
  });

  // Test 12: ModelAdapter exposure
  test('Test 12: ModelAdapter formats swarm tools schema for model consumption', () => {
    const adapter = new ModelAdapter();
    const tools = harness.toolRegistry.list();
    const prompt = adapter.formatToolsPrompt(tools);
    assert.ok(prompt.includes('### Tool: `swarm_plan`'));
    assert.ok(prompt.includes('### Tool: `swarm_execute`'));
    assert.ok(prompt.includes('### Tool: `swarm_cancel`'));
    assert.ok(prompt.includes('"failurePolicy"'));
    assert.ok(prompt.includes('"swarmId"'));
  });

  // Test 13: structured result
  await asyncTest('Test 13: swarm_execute returns full compact structured result schema', async () => {
    const parentThread = harness.createThread({ metadata: { workspacePath: testWs } });
    const planRes = await SwarmPlanTool.execute(
      {
        goal: 'Schema verification',
        tasks: [
          { taskId: 't_s1', role: 'researcher', objective: 'Step 1' },
          { taskId: 't_s2', role: 'reviewer', objective: 'Step 2', dependencies: ['t_s1'] },
        ],
      },
      {
        threadId: parentThread.threadId,
        swarmOrchestrator: harness.swarmOrchestrator,
      }
    );

    const execRes = await SwarmExecuteTool.execute(
      { swarmId: planRes.swarmId },
      {
        threadId: parentThread.threadId,
        workspacePath: testWs,
        swarmOrchestrator: harness.swarmOrchestrator,
        mockResponses: {
          t_s1: 'Step 1 observation',
          t_s2: 'Step 2 observation',
        },
      }
    );

    assert.strictEqual(execRes.success, true);
    assert.strictEqual(typeof execRes.swarmId, 'string');
    assert.strictEqual(typeof execRes.status, 'string');
    assert.strictEqual(typeof execRes.taskCount, 'number');
    assert.strictEqual(typeof execRes.completedTaskCount, 'number');
    assert.strictEqual(typeof execRes.failedTaskCount, 'number');
    assert.strictEqual(typeof execRes.durationMs, 'number');
    assert.ok(Array.isArray(execRes.summaries));
    assert.ok(Array.isArray(execRes.findings));
    assert.ok(Array.isArray(execRes.changedFiles));
    assert.ok(Array.isArray(execRes.changeSets));
    assert.ok(typeof execRes.conflicts === 'object');
    assert.ok(Array.isArray(execRes.taskResults));
    assert.ok(typeof execRes.nextRecommendedAction === 'string');
  });

  // Test 14: ContextEngine compact result
  test('Test 14: ContextEngine bounds swarm_execute result to prevent context overflow', () => {
    const contextEngine = new ContextEngine();
    const largeResult = {
      swarmId: 'swarm_123',
      status: 'COMPLETED',
      completedTaskCount: 5,
      failedTaskCount: 0,
      summaries: Array.from({ length: 50 }, (_, i) => `Summary ${i}: ${'x'.repeat(100)}`),
      findings: Array.from({ length: 50 }, (_, i) => `Finding ${i}: ${'y'.repeat(100)}`),
      changedFiles: Array.from({ length: 50 }, (_, i) => `file_${i}.ts`),
      conflicts: { hasConflicts: false },
      nextRecommendedAction: 'Synthesize findings',
    };

    const bounded = contextEngine.boundToolResult(largeResult, 'swarm_execute', 'call_1', 1000);
    assert.strictEqual(bounded.swarmId, 'swarm_123');
    assert.strictEqual(bounded.status, 'COMPLETED');
    assert.ok(bounded.summaries.length <= 5);
    assert.ok(bounded.findings.length <= 10);
    assert.ok(bounded.changedFiles.length <= 10);
  });

  // Test 15: persistence
  test('Test 15: Swarm tool items serialize and persist cleanly', () => {
    const parentThread = harness.createThread({ metadata: { workspacePath: testWs } });
    const turn = harness.startTurn(parentThread.threadId, 'Persist test');
    const toolCall = harness.startItem(turn.turnId, ITEM_TYPES.TOOL_CALL, {
      toolName: 'swarm_plan',
      callId: 'call_sp_1',
      arguments: { goal: 'Goal', tasks: [] },
    });
    harness.completeItem(toolCall.itemId);

    const toolRes = harness.startItem(turn.turnId, ITEM_TYPES.TOOL_RESULT, {
      toolName: 'swarm_plan',
      callId: 'call_sp_1',
      success: true,
      result: { swarmId: 'swarm_persist_1', taskCount: 1 },
    });
    harness.completeItem(toolRes.itemId);
    harness.completeTurn(turn.turnId);

    const saved = harness.saveThread(parentThread.threadId, testWs);
    assert.strictEqual(saved.success, true);

    const loaded = harness.loadThread(parentThread.threadId, testWs);
    assert.strictEqual(loaded.success, true);
    const restoredItems = harness.itemStore.getItemsByTurn(turn.turnId);
    assert.strictEqual(restoredItems.length, 2);
    assert.strictEqual(restoredItems[0].payload.toolName, 'swarm_plan');
  });

  // Test 16: EvidenceGraph references
  await asyncTest('Test 16: EvidenceGraph records nodes during swarm tool executions in AgentLoop', async () => {
    const parentThread = harness.createThread({ metadata: { workspacePath: testWs } });

    // Mock handler invoking swarm_plan then completing
    let step = 0;
    const mockHandler = async () => {
      step++;
      if (step === 1) {
        return {
          role: 'assistant',
          toolCalls: [
            {
              callId: 'c1',
              toolName: 'swarm_plan',
              arguments: {
                goal: 'Audit evidence recording',
                tasks: [{ taskId: 't_ev', role: 'researcher', objective: 'Audit' }],
              },
            },
          ],
        };
      }
      return {
        role: 'assistant',
        content: 'Plan created successfully.',
        toolCalls: [],
      };
    };

    const turnOutcome = await harness.runTurn({
      threadId: parentThread.threadId,
      userInput: 'Run swarm plan for audit',
      workspacePath: testWs,
      modelHandler: mockHandler,
    });

    assert.strictEqual(turnOutcome.success, true);
    const nodes = evidenceGraph.getNodesBySession(parentThread.threadId);
    assert.ok(nodes.some((n) => n.statement && n.statement.includes('Swarm Plan configured')));
  });

  // Test 17: read-only swarm
  await asyncTest('Test 17: Read-only swarm executes with zero workspace modifications', async () => {
    const parentThread = harness.createThread({ metadata: { workspacePath: testWs } });
    const planRes = await SwarmPlanTool.execute(
      {
        goal: 'Read only swarm',
        tasks: [
          { taskId: 'ro_1', role: 'researcher', objective: 'Inspect auth', codingIntent: 'READ_ONLY' },
          { taskId: 'ro_2', role: 'tester', objective: 'Review test cases', codingIntent: 'READ_ONLY' },
        ],
      },
      {
        threadId: parentThread.threadId,
        swarmOrchestrator: harness.swarmOrchestrator,
      }
    );

    const execRes = await SwarmExecuteTool.execute(
      { swarmId: planRes.swarmId },
      {
        threadId: parentThread.threadId,
        workspacePath: testWs,
        swarmOrchestrator: harness.swarmOrchestrator,
        mockResponses: {
          ro_1: 'Auth is clean',
          ro_2: 'Tests are passing',
        },
      }
    );

    assert.strictEqual(execRes.success, true);
    assert.strictEqual(execRes.changedFiles.length, 0);
    assert.strictEqual(execRes.changeSets.length, 0);
  });

  // Test 18: mutation swarm
  await asyncTest('Test 18: Mutation swarm produces structured ChangeSets in isolated workspaces', async () => {
    const wsMut = setupWorkspace();
    const parentThread = harness.createThread({ metadata: { workspacePath: wsMut } });
    const planRes = await SwarmPlanTool.execute(
      {
        goal: 'Mutation swarm test',
        tasks: [
          { taskId: 'mut_coder', role: 'coder', objective: 'Improve auth validation', allowMutation: true },
        ],
      },
      {
        threadId: parentThread.threadId,
        swarmOrchestrator: harness.swarmOrchestrator,
      }
    );

    const execRes = await SwarmExecuteTool.execute(
      { swarmId: planRes.swarmId },
      {
        threadId: parentThread.threadId,
        workspacePath: wsMut,
        swarmOrchestrator: harness.swarmOrchestrator,
        mockResponses: {
          mut_coder: 'Generated isolated changes',
        },
      }
    );

    assert.strictEqual(execRes.success, true);
    assert.strictEqual(execRes.completedTaskCount, 1);
  });

  // Test 19: child workspace isolation
  await asyncTest('Test 19: Child workspace isolation preserves parent workspace across swarm execution', async () => {
    const wsIso = setupWorkspace();
    const parentThread = harness.createThread({ metadata: { workspacePath: wsIso } });
    const initialContent = fs.readFileSync(path.join(wsIso, 'auth.ts'), 'utf8');

    const planRes = await SwarmPlanTool.execute(
      {
        goal: 'Isolation test',
        tasks: [
          { taskId: 'iso_task', role: 'coder', objective: 'Work in isolation', allowMutation: true },
        ],
      },
      {
        threadId: parentThread.threadId,
        swarmOrchestrator: harness.swarmOrchestrator,
      }
    );

    await SwarmExecuteTool.execute(
      { swarmId: planRes.swarmId },
      {
        threadId: parentThread.threadId,
        workspacePath: wsIso,
        swarmOrchestrator: harness.swarmOrchestrator,
        mockResponses: {
          iso_task: 'Done',
        },
      }
    );

    const finalContent = fs.readFileSync(path.join(wsIso, 'auth.ts'), 'utf8');
    assert.strictEqual(initialContent, finalContent, 'Parent workspace was mutated directly by child subagent');
  });

  // Test 20: conflict reporting
  test('Test 20: Swarm conflict detection reports overlapping files across ChangeSets', () => {
    const cs1 = new ChangeSet({
      workspacePath: testWs,
      edits: [{ filePath: 'auth.ts', original: 'Boolean(token)', replacement: 'token.length > 5' }],
    });
    const cs2 = new ChangeSet({
      workspacePath: testWs,
      edits: [{ filePath: 'auth.ts', original: 'Boolean(token)', replacement: 'token !== null' }],
    });

    const report = harness.detectSwarmConflicts([cs1, cs2], { workspacePath: testWs });
    assert.strictEqual(report.hasConflicts, true);
    assert.strictEqual(report.category, SWARM_CONFLICT_CATEGORY.FILE_CONFLICT);
    assert.ok(report.conflictingFiles.includes('auth.ts'));
  });

  // Test 21: provider failure
  await asyncTest('Test 21: Provider failure during task execution is captured cleanly', async () => {
    const parentThread = harness.createThread({ metadata: { workspacePath: testWs } });
    const planRes = await SwarmPlanTool.execute(
      {
        goal: 'Provider error test',
        tasks: [{ taskId: 't_fail', role: 'researcher', objective: 'Simulate API failure' }],
      },
      {
        threadId: parentThread.threadId,
        swarmOrchestrator: harness.swarmOrchestrator,
      }
    );

    const execRes = await SwarmExecuteTool.execute(
      { swarmId: planRes.swarmId },
      {
        threadId: parentThread.threadId,
        workspacePath: testWs,
        swarmOrchestrator: harness.swarmOrchestrator,
        modelHandler: async () => {
          throw new Error('Upstream provider rate limit 429');
        },
      }
    );

    assert.strictEqual(execRes.completedTaskCount, 0);
    assert.strictEqual(execRes.failedTaskCount, 1);
    assert.strictEqual(execRes.status, SWARM_STATUS.FAILED);
    assert.ok(execRes.taskResults[0].error.includes('Upstream provider rate limit'));
  });

  // Test 22: malformed arguments
  await asyncTest('Test 22: Malformed tool arguments return structured errors', async () => {
    const res1 = await SwarmExecuteTool.execute({ swarmId: '' }, {});
    assert.strictEqual(res1.success, false);
    assert.ok(res1.error.includes('Argument "swarmId" must be a non-empty string'));

    const res2 = await SwarmCancelTool.execute({}, {});
    assert.strictEqual(res2.success, false);
    assert.ok(res2.error.includes('Argument "swarmId" must be a non-empty string'));
  });

  // Test 23: tool cancellation
  await asyncTest('Test 23: Swarm cancel tool halts running orchestrator', async () => {
    const parentThread = harness.createThread({ metadata: { workspacePath: testWs } });
    const planRes = await SwarmPlanTool.execute(
      {
        goal: 'Abort test',
        tasks: [{ taskId: 't_abort', role: 'researcher', objective: 'Aborting' }],
      },
      {
        threadId: parentThread.threadId,
        swarmOrchestrator: harness.swarmOrchestrator,
      }
    );

    const cancelRes = await SwarmCancelTool.execute(
      { swarmId: planRes.swarmId, reason: 'Manual operator cancellation' },
      {
        threadId: parentThread.threadId,
        swarmOrchestrator: harness.swarmOrchestrator,
      }
    );

    assert.strictEqual(cancelRes.success, true);
    assert.strictEqual(cancelRes.status, 'CANCELLED');
    const status = harness.getSwarmStatus(planRes.swarmId);
    assert.strictEqual(status.status, SWARM_STATUS.CANCELLED);
  });

  // Test 24: worker failure propagation
  await asyncTest('Test 24: Worker failure propagation under BEST_EFFORT policy', async () => {
    const parentThread = harness.createThread({ metadata: { workspacePath: testWs } });
    const planRes = await SwarmPlanTool.execute(
      {
        goal: 'Worker failure propagation test',
        failurePolicy: 'BEST_EFFORT',
        tasks: [
          { taskId: 'failing_worker', role: 'researcher', objective: 'Crash on purpose' },
          { taskId: 'healthy_worker', role: 'tester', objective: 'Run cleanly' },
        ],
      },
      {
        threadId: parentThread.threadId,
        swarmOrchestrator: harness.swarmOrchestrator,
      }
    );

    const execRes = await SwarmExecuteTool.execute(
      { swarmId: planRes.swarmId },
      {
        threadId: parentThread.threadId,
        workspacePath: testWs,
        swarmOrchestrator: harness.swarmOrchestrator,
        modelHandler: async (messages) => {
          const text = JSON.stringify(messages);
          if (text.includes('Crash on purpose')) {
            throw new Error('Worker segfault simulated');
          }
          return 'Healthy worker result';
        },
      }
    );

    assert.strictEqual(execRes.completedTaskCount, 1);
    assert.strictEqual(execRes.failedTaskCount, 1);
    assert.strictEqual(execRes.status, SWARM_STATUS.PARTIAL_SUCCESS);
    assert.ok(execRes.taskResults.some((t) => t.taskId === 'failing_worker' && t.status === SWARM_TASK_STATUS.FAILED));
    assert.ok(execRes.taskResults.some((t) => t.taskId === 'healthy_worker' && t.status === SWARM_TASK_STATUS.COMPLETED));
  });

  // =========================================================================
  // DETERMINISTIC END-TO-END MOCK-MODEL SCENARIOS
  // =========================================================================

  // Test 25: Deterministic Mock-Model E2E Scenario 1: Independent Investigation
  await asyncTest('Test 25: Deterministic E2E: Independent Investigation Swarm', async () => {
    const wsE2E1 = setupWorkspace();
    const thread = harness.createThread({ metadata: { workspacePath: wsE2E1 } });

    let step = 0;
    let savedSwarmId = null;

    const mockModelHandler = async (messages, tools, options) => {
      step++;
      if (step === 1) {
        // Step 1: Model decides to plan an independent investigation swarm
        return {
          role: 'assistant',
          content: 'I will delegate this investigation to 3 specialized subagents in a swarm.',
          tool_calls: [
            {
              callId: 'call_plan_1',
              toolName: 'swarm_plan',
              arguments: {
                goal: 'Investigate authentication architecture, test coverage, and security independently',
                tasks: [
                  { taskId: 'task_arch', role: 'researcher', objective: 'Inspect authentication architecture in auth.ts and session.ts' },
                  { taskId: 'task_coverage', role: 'tester', objective: 'Analyze test coverage across auth modules' },
                  { taskId: 'task_sec', role: 'reviewer', objective: 'Audit token validation and security boundaries' },
                ],
                maxConcurrency: 3,
                failurePolicy: 'BEST_EFFORT',
              },
            },
          ],
        };
      } else if (step === 2) {
        // Step 2: Model observes swarm_plan result and invokes swarm_execute
        const toolMsg = messages.find((m) => m.role === 'tool' && (m.tool_call_id === 'call_plan_1' || m.name === 'swarm_plan'));
        assert.ok(toolMsg, 'Expected swarm_plan tool result in conversation context');
        savedSwarmId = toolMsg.content?.swarmId || (typeof toolMsg.content === 'string' ? /"swarmId":\s*"([^"]+)"/.exec(toolMsg.content)?.[1] : null);
        assert.ok(savedSwarmId, 'Could not extract swarmId from tool result');

        return {
          role: 'assistant',
          content: `Executing swarm ${savedSwarmId}...`,
          tool_calls: [
            {
              callId: 'call_exec_1',
              toolName: 'swarm_execute',
              arguments: { swarmId: savedSwarmId },
            },
          ],
        };
      } else {
        // Step 3: Model observes swarm_execute results and provides final synthesis
        const toolMsg = messages.find((m) => m.role === 'tool' && (m.tool_call_id === 'call_exec_1' || m.name === 'swarm_execute'));
        assert.ok(toolMsg, 'Expected swarm_execute tool result in conversation context');

        return {
          role: 'assistant',
          content: 'Investigation Complete:\n1. Architecture: Clean separation between auth and session.\n2. Coverage: Adequate baseline coverage.\n3. Security: Token validation should enforce non-empty string constraints.',
          tool_calls: [],
        };
      }
    };

    const turnOutcome = await harness.runTurn({
      threadId: thread.threadId,
      userInput: 'Investigate authentication architecture, test coverage, and security independently.',
      workspacePath: wsE2E1,
      intent: 'READ_ONLY',
      modelHandler: mockModelHandler,
      mockResponses: {
        task_arch: 'Architecture: auth.ts handles token verification, session.ts manages TTL.',
        task_coverage: 'Test Coverage: verifyToken has unit test coverage, getSession is covered.',
        task_sec: 'Security Audit: verifyToken accepts any truthy string; recommend length checks.',
      },
    });

    assert.strictEqual(turnOutcome.success, true);
    assert.strictEqual(turnOutcome.status, TURN_STATUS.COMPLETED);
    assert.ok(turnOutcome.finalResponse.includes('Investigation Complete'));

    // Check items created in this turn
    const turnItems = harness.itemStore.getItemsByTurn(turnOutcome.turnId);
    const toolCallItems = turnItems.filter((i) => i.type === ITEM_TYPES.TOOL_CALL);
    const toolResultItems = turnItems.filter((i) => i.type === ITEM_TYPES.TOOL_RESULT);
    assert.strictEqual(toolCallItems.length, 2);
    assert.strictEqual(toolCallItems[0].payload.toolName, 'swarm_plan');
    assert.strictEqual(toolCallItems[1].payload.toolName, 'swarm_execute');
    assert.strictEqual(toolResultItems.length, 2);
    assert.strictEqual(toolResultItems[0].payload.success, true);
    assert.strictEqual(toolResultItems[1].payload.success, true);
  });

  // Test 26: Deterministic Mock-Model E2E Scenario 2: Multi-Worker Refactor & Parent Adoption
  await asyncTest('Test 26: Deterministic E2E: Multi-Worker Refactor with Parent ChangeSet Adoption', async () => {
    const wsE2E2 = setupWorkspace();
    const thread = harness.createThread({ metadata: { workspacePath: wsE2E2 } });

    let step = 0;
    let savedSwarmId = null;

    const mockModelHandler = async (messages, tools, options) => {
      step++;
      if (step === 1) {
        // Step 1: Model creates swarm plan for refactor
        return {
          role: 'assistant',
          content: 'Creating a swarm plan to refactor auth and session modules.',
          tool_calls: [
            {
              callId: 'call_plan_2',
              toolName: 'swarm_plan',
              arguments: {
                goal: 'Refactor the auth modules and have separate workers test and review the result',
                tasks: [
                  { taskId: 'coder_auth', role: 'coder', objective: 'Upgrade verifyToken in auth.ts', allowMutation: true },
                  { taskId: 'coder_session', role: 'coder', objective: 'Upgrade session TTL in session.ts', allowMutation: true },
                ],
                maxConcurrency: 2,
              },
            },
          ],
        };
      } else if (step === 2) {
        // Step 2: Model executes swarm
        const toolMsg = messages.find((m) => m.role === 'tool' && (m.tool_call_id === 'call_plan_2' || m.name === 'swarm_plan'));
        assert.ok(toolMsg, 'Expected swarm_plan tool result in conversation context');
        savedSwarmId = toolMsg.content?.swarmId || (typeof toolMsg.content === 'string' ? /"swarmId":\s*"([^"]+)"/.exec(toolMsg.content)?.[1] : null);
        assert.ok(savedSwarmId, 'Could not extract swarmId from tool result');

        return {
          role: 'assistant',
          content: `Executing swarm ${savedSwarmId}...`,
          tool_calls: [
            {
              callId: 'call_exec_2',
              toolName: 'swarm_execute',
              arguments: { swarmId: savedSwarmId },
            },
          ],
        };
      } else if (step === 3) {
        // Step 3: Model applies verified patches to parent workspace using apply_patch
        return {
          role: 'assistant',
          content: 'Swarm completed. Now applying transactional patches to parent workspace.',
          tool_calls: [
            {
              callId: 'call_patch_1',
              toolName: 'apply_patch',
              arguments: {
                edits: [
                  {
                    filePath: 'auth.ts',
                    original: 'return Boolean(token);',
                    replacement: 'return Boolean(token && token.trim().length >= 8);',
                  },
                  {
                    filePath: 'session.ts',
                    original: 'ttl: 3600',
                    replacement: 'ttl: 86400',
                  },
                ],
              },
            },
          ],
        };
      } else {
        // Step 4: Final verification and summary
        return {
          role: 'assistant',
          content: 'Refactor successfully applied and verified across auth.ts and session.ts.',
          tool_calls: [],
        };
      }
    };

    const turnOutcome = await harness.runTurn({
      threadId: thread.threadId,
      userInput: 'Refactor the auth modules and have separate workers test and review the result.',
      workspacePath: wsE2E2,
      intent: 'MUTATION',
      approvalMode: 'auto',
      modelHandler: mockModelHandler,
      mockResponses: {
        coder_auth: 'Patched auth validation in isolated workspace',
        coder_session: 'Patched session TTL in isolated workspace',
      },
    });

    assert.strictEqual(turnOutcome.success, true);
    assert.strictEqual(turnOutcome.status, TURN_STATUS.COMPLETED);
    assert.ok(turnOutcome.finalResponse.includes('Refactor successfully applied and verified'));

    // Verify parent files are updated on disk
    const authDisk = fs.readFileSync(path.join(wsE2E2, 'auth.ts'), 'utf8');
    const sessionDisk = fs.readFileSync(path.join(wsE2E2, 'session.ts'), 'utf8');
    assert.ok(authDisk.includes('token.trim().length >= 8'));
    assert.ok(sessionDisk.includes('ttl: 86400'));
  });

  // Summary
  console.log('\n====================================================');
  console.log(`[RESULTS] ${passedTests} passed, ${failedTests} failed.`);
  console.log('====================================================');

  process.exit(failedTests > 0 ? 1 : 0);
})();
