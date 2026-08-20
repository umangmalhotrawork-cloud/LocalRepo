/**
 * NEXUS CODEX HARNESS - SUBAGENTS & CHILD THREAD TEST SUITE (Milestone 8)
 * Verifies true child-thread subagents:
 * 1. child thread creation
 * 2. child lineage (parentThreadId, rootThreadId, depth)
 * 3. root thread preservation
 * 4. child role resolution (AIRoleRouter)
 * 5. child context handoff (scoped HandoffState)
 * 6. child turn execution
 * 7. child result propagation
 * 8. parent SUBAGENT_RESULT item
 * 9. child persistence
 * 10. restart/reconstruction
 * 11. max depth enforcement
 * 12. max children enforcement
 * 13. concurrent read-only children
 * 14. mutation conflict detection
 * 15. mutation serialization
 * 16. child approval flow
 * 17. child cancellation
 * 18. parent cancellation propagates
 * 19. sibling isolation
 * 20. EvidenceGraph lineage
 * 21. event ordering
 * 22. structured child result
 * 23. malformed delegation rejection
 * 24. provider failure handling
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const {
  HarnessRuntime,
  SubagentManager,
  ITEM_TYPES,
  ITEM_STATUS,
  TURN_STATUS,
  THREAD_STATUS,
  EVENT_TYPES,
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
console.log('[TEST] Starting NEXUS Codex Harness Subagent Suite (Milestone 8)...');
console.log('====================================================\n');

// Isolated test storage directory
const testStorageDir = path.join(os.tmpdir(), `nexus_subagent_storage_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
const testWorkspaceDir = path.join(os.tmpdir(), `nexus_subagent_ws_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
process.env.ECHO_CONTINUUM_DIR = testStorageDir;
fs.mkdirSync(testStorageDir, { recursive: true });
fs.mkdirSync(testWorkspaceDir, { recursive: true });

const fileAuth = path.join(testWorkspaceDir, 'auth.ts');
const fileSession = path.join(testWorkspaceDir, 'session.ts');
fs.writeFileSync(fileAuth, 'export function verifyToken(token: string) { return Boolean(token); }\n');
fs.writeFileSync(fileSession, 'export function getSession(id: string) { return { id, active: true }; }\n');

(async () => {
  // Test 1: Child Thread Creation
  test('Test 1: Child Thread Creation under Parent Thread', () => {
    const runtime = HarnessRuntime.createIsolated();
    const parent = runtime.createThread({ metadata: { title: 'Parent Task' } });

    const child = runtime.createSubagent({
      parentThreadId: parent.threadId,
      role: 'researcher',
      metadata: { title: 'Inspect Auth Architecture' },
    });

    assert.ok(child.threadId.startsWith('thread_'));
    assert.strictEqual(child.parentThreadId, parent.threadId);
    assert.strictEqual(child.role, 'researcher');
    assert.strictEqual(child.createdBy, 'subagent_manager');
    assert.strictEqual(child.status, THREAD_STATUS.ACTIVE);
  });

  // Test 2: Child Lineage (depth & rootThreadId)
  test('Test 2: Child Lineage (parentThreadId, rootThreadId, depth)', () => {
    const runtime = HarnessRuntime.createIsolated();
    const root = runtime.createThread({ metadata: { title: 'Root Thread' } });
    const child = runtime.createSubagent({ parentThreadId: root.threadId, role: 'researcher' });
    const grandChild = runtime.createSubagent({ parentThreadId: child.threadId, role: 'tester' });

    assert.strictEqual(root.depth, 0);
    assert.strictEqual(root.rootThreadId, root.threadId);

    assert.strictEqual(child.depth, 1);
    assert.strictEqual(child.parentThreadId, root.threadId);
    assert.strictEqual(child.rootThreadId, root.threadId);

    assert.strictEqual(grandChild.depth, 2);
    assert.strictEqual(grandChild.parentThreadId, child.threadId);
    assert.strictEqual(grandChild.rootThreadId, root.threadId);
  });

  // Test 3: Root Thread Preservation
  test('Test 3: Root Thread Preservation and Retrieval', () => {
    const runtime = HarnessRuntime.createIsolated();
    const root = runtime.createThread({ metadata: { title: 'Root Thread' } });
    const child = runtime.createSubagent({ parentThreadId: root.threadId, role: 'coder' });
    const grandChild = runtime.createSubagent({ parentThreadId: child.threadId, role: 'reviewer' });

    const foundRoot = runtime.threadManager.getRootThread(grandChild.threadId);
    assert.strictEqual(foundRoot.threadId, root.threadId);
    assert.strictEqual(foundRoot.depth, 0);
    assert.strictEqual(foundRoot.parentThreadId, null);
  });

  // Test 4: Child Role Resolution via AIRoleRouter
  test('Test 4: Child Role Resolution via AIRoleRouter', () => {
    const runtime = HarnessRuntime.createIsolated();
    const parent = runtime.createThread();

    const plannerChild = runtime.createSubagent({ parentThreadId: parent.threadId, role: 'planner' });
    const reviewerChild = runtime.createSubagent({ parentThreadId: parent.threadId, role: 'reviewer' });
    const debuggerChild = runtime.createSubagent({ parentThreadId: parent.threadId, role: 'debugger' });

    assert.strictEqual(plannerChild.role, 'planner');
    assert.strictEqual(plannerChild.metadata.roleDefinition.roleId, 'planner');
    assert.ok(plannerChild.metadata.providerId);
    assert.ok(plannerChild.metadata.modelId);

    assert.strictEqual(reviewerChild.role, 'reviewer');
    assert.strictEqual(debuggerChild.role, 'debugger');
  });

  // Test 5: Child Context Handoff (Scoped HandoffState)
  await asyncTest('Test 5: Child Context Isolation & Scoped HandoffState', async () => {
    const runtime = HarnessRuntime.createIsolated();
    const parent = runtime.createThread({ metadata: { title: 'Parent Big Task' } });

    let receivedSystemPrompt = '';
    const result = await runtime.runSubagent({
      parentThreadId: parent.threadId,
      role: 'researcher',
      taskGoal: 'Audit auth.ts for vulnerabilities',
      activeFilePath: 'auth.ts',
      constraints: ['Do not modify files', 'Read only inspection'],
      relevantDecisions: ['Decision: Zero mutation'],
      modelHandler: async (messages) => {
        receivedSystemPrompt = messages[0]?.content || '';
        return 'Audited auth.ts: No critical vulnerabilities found.';
      },
    });

    assert.strictEqual(result.success, true);
    assert.ok(receivedSystemPrompt.includes('## ACTIVE HANDOFF'));
    assert.ok(receivedSystemPrompt.includes('Task Goal: Audit auth.ts for vulnerabilities'));
    assert.ok(receivedSystemPrompt.includes('[CONSTRAINT] Do not modify files'));
    assert.ok(receivedSystemPrompt.includes('[DECISION] Decision: Zero mutation'));
  });

  // Test 6: Child Turn Execution with Independent AgentLoop
  await asyncTest('Test 6: Child Turn Execution with Isolated Tool Loop', async () => {
    const runtime = HarnessRuntime.createIsolated();
    const parent = runtime.createThread();

    let toolCallExecuted = false;
    const result = await runtime.runSubagent({
      parentThreadId: parent.threadId,
      role: 'researcher',
      taskGoal: 'Read auth.ts',
      workspacePath: testWorkspaceDir,
      modelHandler: async (messages) => {
        const lastMsg = messages[messages.length - 1];
        if (lastMsg.role === 'tool') {
          toolCallExecuted = true;
          return 'auth.ts exports verifyToken function.';
        }
        return {
          tool_calls: [
            { callId: 'c_read', toolName: 'read_file', arguments: { filePath: 'auth.ts' } },
          ],
        };
      },
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(toolCallExecuted, true);
    assert.strictEqual(result.status, TURN_STATUS.COMPLETED);
    assert.ok(result.summary.includes('exports verifyToken function'));
  });

  // Test 7: Child Result Propagation
  await asyncTest('Test 7: Structured Child Result Propagation to Caller', async () => {
    const runtime = HarnessRuntime.createIsolated();
    const parent = runtime.createThread();

    const result = await runtime.runSubagent({
      parentThreadId: parent.threadId,
      role: 'tester',
      taskGoal: 'Analyze test suite coverage',
      modelHandler: async () => 'Found 2 test suites with 95% branch coverage.',
    });

    assert.strictEqual(result.role, 'tester');
    assert.strictEqual(result.status, TURN_STATUS.COMPLETED);
    assert.strictEqual(result.success, true);
    assert.strictEqual(result.summary, 'Found 2 test suites with 95% branch coverage.');
    assert.ok(Array.isArray(result.findings));
    assert.ok(Array.isArray(result.changedFiles));
  });

  // Test 8: Parent SUBAGENT_DELEGATION and SUBAGENT_RESULT Items
  await asyncTest('Test 8: Parent Turn Records SUBAGENT_DELEGATION and SUBAGENT_RESULT Items', async () => {
    const runtime = HarnessRuntime.createIsolated();
    const parentThread = runtime.createThread();
    const parentTurn = runtime.startTurn(parentThread.threadId, 'Coordinate security review');

    const result = await runtime.runSubagent({
      parentThreadId: parentThread.threadId,
      parentTurnId: parentTurn.turnId,
      role: 'reviewer',
      taskGoal: 'Security review of session.ts',
      modelHandler: async () => 'Review passed cleanly: RS256 token verification recommended.',
    });

    const parentItems = runtime.itemStore.getItemsByTurn(parentTurn.turnId);
    const delegationItem = parentItems.find((i) => i.type === ITEM_TYPES.SUBAGENT_DELEGATION);
    const resultItem = parentItems.find((i) => i.type === ITEM_TYPES.SUBAGENT_RESULT);

    assert.ok(delegationItem !== undefined, 'Parent turn must contain SUBAGENT_DELEGATION item');
    assert.strictEqual(delegationItem.status, ITEM_STATUS.COMPLETED);
    assert.strictEqual(delegationItem.payload.role, 'reviewer');

    assert.ok(resultItem !== undefined, 'Parent turn must contain SUBAGENT_RESULT item');
    assert.strictEqual(resultItem.payload.role, 'reviewer');
    assert.strictEqual(resultItem.payload.status, TURN_STATUS.COMPLETED);
    assert.ok(resultItem.payload.summary.includes('RS256 token verification'));
  });

  // Test 9: Child Persistence via Continuum
  test('Test 9: Child Thread and Lineage Persistence via Continuum', () => {
    const runtime = HarnessRuntime.createIsolated();
    const root = runtime.createThread({ metadata: { title: 'Persistence Root' } });
    const child = runtime.createSubagent({ parentThreadId: root.threadId, role: 'researcher' });

    const saveRoot = runtime.saveThread(root.threadId, testWorkspaceDir);
    const saveChild = runtime.saveThread(child.threadId, testWorkspaceDir);

    assert.strictEqual(saveRoot.success, true);
    assert.strictEqual(saveChild.success, true);
  });

  // Test 10: Restart and Full Tree Reconstruction
  test('Test 10: Full Hierarchy Tree Reconstruction across Restart', () => {
    const runtime = HarnessRuntime.createIsolated();
    const root = runtime.createThread({ metadata: { title: 'Tree Root' } });
    const child1 = runtime.createSubagent({ parentThreadId: root.threadId, role: 'researcher' });
    const child2 = runtime.createSubagent({ parentThreadId: root.threadId, role: 'tester' });

    runtime.saveThread(root.threadId, testWorkspaceDir);
    runtime.saveThread(child1.threadId, testWorkspaceDir);
    runtime.saveThread(child2.threadId, testWorkspaceDir);

    // Simulate restart with fresh runtime
    const restartedRuntime = HarnessRuntime.createIsolated();
    restartedRuntime.loadThread(root.threadId, testWorkspaceDir);
    restartedRuntime.loadThread(child1.threadId, testWorkspaceDir);
    restartedRuntime.loadThread(child2.threadId, testWorkspaceDir);

    const restoredRoot = restartedRuntime.threadManager.getThread(root.threadId);
    const restoredChildren = restartedRuntime.threadManager.listChildThreads(root.threadId);

    assert.strictEqual(restoredRoot.threadId, root.threadId);
    assert.strictEqual(restoredChildren.length, 2);
    assert.ok(restoredChildren.some((c) => c.role === 'researcher'));
    assert.ok(restoredChildren.some((c) => c.role === 'tester'));
  });

  // Test 11: Max Depth Enforcement
  test('Test 11: Max Subagent Depth Enforcement', () => {
    const runtime = HarnessRuntime.createIsolated({
      subagentLimits: { maxChildDepth: 2 },
    });
    const root = runtime.createThread(); // depth 0
    const child1 = runtime.createSubagent({ parentThreadId: root.threadId, role: 'researcher' }); // depth 1
    const child2 = runtime.createSubagent({ parentThreadId: child1.threadId, role: 'tester' }); // depth 2

    // Attempt depth 3 when limit is 2 -> must throw
    assert.throws(() => {
      runtime.createSubagent({ parentThreadId: child2.threadId, role: 'reviewer' });
    }, /Max subagent depth exceeded/);
  });

  // Test 12: Max Children Per Thread & Turn Enforcement
  test('Test 12: Max Children Count Enforcement', () => {
    const runtime = HarnessRuntime.createIsolated({
      subagentLimits: { maxChildrenPerThread: 2, maxTotalChildrenPerTurn: 2 },
    });
    const parent = runtime.createThread();
    const turn = runtime.startTurn(parent.threadId, 'Batch delegation');

    runtime.createSubagent({ parentThreadId: parent.threadId, parentTurnId: turn.turnId, role: 'r1' });
    runtime.createSubagent({ parentThreadId: parent.threadId, parentTurnId: turn.turnId, role: 'r2' });

    // 3rd child must exceed limit
    assert.throws(() => {
      runtime.createSubagent({ parentThreadId: parent.threadId, parentTurnId: turn.turnId, role: 'r3' });
    }, /Max children/);
  });

  // Test 13: Concurrent Read-Only Subagents
  await asyncTest('Test 13: Bounded Concurrent Read-Only Subagents', async () => {
    const runtime = HarnessRuntime.createIsolated();
    const parent = runtime.createThread();

    const tasks = [
      { role: 'researcher', taskGoal: 'Inspect auth.ts', modelHandler: async () => 'Findings 1' },
      { role: 'tester', taskGoal: 'Inspect test coverage', modelHandler: async () => 'Findings 2' },
      { role: 'reviewer', taskGoal: 'Inspect security posture', modelHandler: async () => 'Findings 3' },
    ];

    const results = await runtime.runSubagentsConcurrent(
      tasks.map((t) => ({ ...t, parentThreadId: parent.threadId })),
      { maxConcurrent: 3 }
    );

    assert.strictEqual(results.length, 3);
    assert.strictEqual(results[0].summary, 'Findings 1');
    assert.strictEqual(results[1].summary, 'Findings 2');
    assert.strictEqual(results[2].summary, 'Findings 3');
  });

  // Test 14: Mutation Conflict Detection
  await asyncTest('Test 14: Mutation Conflict Detection across Concurrent Subagents', async () => {
    const runtime = HarnessRuntime.createIsolated();
    const parent = runtime.createThread();

    const conflictingTasks = [
      { role: 'coder', taskGoal: 'Modify auth.ts', codingIntent: 'MUTATION', activeFilePath: 'auth.ts' },
      { role: 'coder', taskGoal: 'Refactor auth.ts', codingIntent: 'MUTATION', activeFilePath: 'auth.ts' },
    ];

    await assert.rejects(async () => {
      await runtime.runSubagentsConcurrent(
        conflictingTasks.map((t) => ({ ...t, parentThreadId: parent.threadId })),
        { conflictPolicy: 'reject' }
      );
    }, /Concurrent mutation conflict/);
  });

  // Test 15: Mutation Serialization
  await asyncTest('Test 15: Mutation Serialization when Files Overlap', async () => {
    const runtime = HarnessRuntime.createIsolated();
    const parent = runtime.createThread();

    const executionOrder = [];
    const tasks = [
      {
        role: 'coder',
        taskGoal: 'Task A',
        codingIntent: 'MUTATION',
        activeFilePath: 'auth.ts',
        modelHandler: async () => {
          executionOrder.push('Task A');
          return 'Done A';
        },
      },
      {
        role: 'coder',
        taskGoal: 'Task B',
        codingIntent: 'MUTATION',
        activeFilePath: 'auth.ts',
        modelHandler: async () => {
          executionOrder.push('Task B');
          return 'Done B';
        },
      },
    ];

    const results = await runtime.runSubagentsConcurrent(
      tasks.map((t) => ({ ...t, parentThreadId: parent.threadId })),
      { maxConcurrent: 1, conflictPolicy: 'serialize' }
    );

    assert.strictEqual(results.length, 2);
    assert.deepStrictEqual(executionOrder, ['Task A', 'Task B']);
  });

  // Test 16: Child Approval Flow (Preserving Safety Boundary)
  await asyncTest('Test 16: Child Approval Flow and WAITING_FOR_APPROVAL', async () => {
    const runtime = HarnessRuntime.createIsolated();
    const parent = runtime.createThread();

    let childTurnRunning = false;
    const subPromise = runtime.runSubagent({
      parentThreadId: parent.threadId,
      role: 'coder',
      taskGoal: 'Run sensitive command',
      approvalMode: 'strict',
      modelHandler: async (messages) => {
        childTurnRunning = true;
        if (messages.some((m) => m.role === 'tool')) {
          return 'Sensitive command executed with approval.';
        }
        return {
          tool_calls: [
            { callId: 'c_cmd', toolName: 'run_command', arguments: { command: 'deploy --prod' } },
          ],
        };
      },
    });

    // Allow loop to hit approval check
    await new Promise((r) => setTimeout(r, 50));
    const children = runtime.listSubagents(parent.threadId);
    assert.ok(children.length > 0);
    const child = children[0];

    // Approve the child's tool action
    runtime.agentLoop.approveAction(child.turns[0]?.turnId, 'c_cmd', { approved: true, approvedBy: 'user' });

    const result = await subPromise;
    assert.strictEqual(result.success, true);
    assert.ok(result.summary.includes('executed with approval'));
  });

  // Test 17: Child Cancellation without Cancelling Parent
  await asyncTest('Test 17: Child Cancellation does not Cancel Parent', async () => {
    const runtime = HarnessRuntime.createIsolated();
    const parent = runtime.createThread();
    const parentTurn = runtime.startTurn(parent.threadId, 'Parent orchestration');

    const subPromise = runtime.runSubagent({
      parentThreadId: parent.threadId,
      parentTurnId: parentTurn.turnId,
      role: 'researcher',
      taskGoal: 'Long research task',
      modelHandler: async () => {
        await new Promise((r) => setTimeout(r, 200));
        return 'Finished';
      },
    });

    await new Promise((r) => setTimeout(r, 30));
    const children = runtime.listSubagents(parent.threadId);
    const child = children[0];

    // Explicit child cancellation
    const cancelRes = runtime.cancelSubagent(child.threadId, 'User requested subagent cancel');
    assert.strictEqual(cancelRes.status, TURN_STATUS.CANCELLED);

    const result = await subPromise;
    assert.strictEqual(result.status, TURN_STATUS.CANCELLED);

    // Parent must still be ACTIVE
    const refreshedParent = runtime.threadManager.getThread(parent.threadId);
    assert.strictEqual(refreshedParent.status, THREAD_STATUS.ACTIVE);
  });

  // Test 18: Parent Cancellation Propagates to Active Children
  await asyncTest('Test 18: Parent Turn Cancellation Propagates to Children', async () => {
    const runtime = HarnessRuntime.createIsolated();
    const parent = runtime.createThread();
    const parentTurn = runtime.startTurn(parent.threadId, 'Parent task');

    const subPromise = runtime.runSubagent({
      parentThreadId: parent.threadId,
      parentTurnId: parentTurn.turnId,
      role: 'researcher',
      taskGoal: 'Long research',
      modelHandler: async () => {
        await new Promise((r) => setTimeout(r, 200));
        return 'Done';
      },
    });

    await new Promise((r) => setTimeout(r, 30));
    // Cancel parent turn
    runtime.cancelTurn(parentTurn.turnId, 'Parent directive cancelled');

    const result = await subPromise;
    assert.strictEqual(result.status, TURN_STATUS.CANCELLED);
  });

  // Test 19: Sibling Isolation
  await asyncTest('Test 19: Sibling Subagent Isolation', async () => {
    const runtime = HarnessRuntime.createIsolated();
    const parent = runtime.createThread();

    const subA = runtime.createSubagent({ parentThreadId: parent.threadId, role: 'researcher' });
    const subB = runtime.createSubagent({ parentThreadId: parent.threadId, role: 'tester' });

    assert.notStrictEqual(subA.threadId, subB.threadId);
    assert.strictEqual(subA.role, 'researcher');
    assert.strictEqual(subB.role, 'tester');
  });

  // Test 20: EvidenceGraph Lineage
  await asyncTest('Test 20: EvidenceGraph Subagent Lineage Recording', async () => {
    const runtime = HarnessRuntime.createIsolated();
    const parent = runtime.createThread();

    await runtime.runSubagent({
      parentThreadId: parent.threadId,
      role: 'researcher',
      taskGoal: 'Record evidence audit',
      modelHandler: async () => 'Evidence audit findings.',
    });

    const nodes = evidenceGraph.getNodesBySession(parent.threadId);
    const subagentTaskNode = nodes.find((n) => n.statement.includes('Subagent created [researcher]'));
    const subagentResultNode = nodes.find((n) => n.statement.includes('Subagent result [researcher]'));

    assert.ok(subagentTaskNode !== undefined, 'EvidenceGraph must record subagent task creation');
    assert.ok(subagentResultNode !== undefined, 'EvidenceGraph must record subagent observation result');
  });


  // Test 21: Event Ordering on EventBus
  await asyncTest('Test 21: Subagent Event Emission Ordering', async () => {
    const runtime = HarnessRuntime.createIsolated();
    const emittedEvents = [];

    runtime.subscribe((evt) => {
      if (evt.type.startsWith('SUBAGENT_')) {
        emittedEvents.push(evt.type);
      }
    });

    const parent = runtime.createThread();
    await runtime.runSubagent({
      parentThreadId: parent.threadId,
      role: 'reviewer',
      taskGoal: 'Review event lifecycle',
      modelHandler: async () => 'Reviewed cleanly',
    });

    assert.ok(emittedEvents.includes(EVENT_TYPES.SUBAGENT_CREATED));
    assert.ok(emittedEvents.includes(EVENT_TYPES.SUBAGENT_STARTED));
    assert.ok(emittedEvents.includes(EVENT_TYPES.SUBAGENT_COMPLETED));
    assert.ok(emittedEvents.includes(EVENT_TYPES.SUBAGENT_RESULT));

    const idxCreated = emittedEvents.indexOf(EVENT_TYPES.SUBAGENT_CREATED);
    const idxStarted = emittedEvents.indexOf(EVENT_TYPES.SUBAGENT_STARTED);
    const idxCompleted = emittedEvents.indexOf(EVENT_TYPES.SUBAGENT_COMPLETED);
    const idxResult = emittedEvents.indexOf(EVENT_TYPES.SUBAGENT_RESULT);

    assert.ok(idxCreated < idxStarted);
    assert.ok(idxStarted < idxCompleted);
    assert.ok(idxCompleted <= idxResult);
  });

  // Test 22: Structured Child Result Contents
  await asyncTest('Test 22: Complete Structured Child Result Integrity', async () => {
    const runtime = HarnessRuntime.createIsolated();
    const parent = runtime.createThread();

    const result = await runtime.runSubagent({
      parentThreadId: parent.threadId,
      role: 'debugger',
      taskGoal: 'Diagnose flaky unit test',
      modelHandler: async () => 'Root cause: Unhandled promise rejection in timeout handler.',
    });

    assert.strictEqual(typeof result.childThreadId, 'string');
    assert.strictEqual(result.parentThreadId, parent.threadId);
    assert.strictEqual(result.role, 'debugger');
    assert.strictEqual(result.status, TURN_STATUS.COMPLETED);
    assert.strictEqual(result.success, true);
    assert.ok(result.summary.includes('Unhandled promise rejection'));
    assert.ok(Array.isArray(result.findings));
    assert.ok(Array.isArray(result.changedFiles));
    assert.strictEqual(result.error, null);
  });

  // Test 23: Malformed Delegation Rejection
  test('Test 23: Rejection of Malformed Subagent Creation Payloads', () => {
    const runtime = HarnessRuntime.createIsolated();

    // Missing parentThreadId
    assert.throws(() => {
      runtime.createSubagent({ role: 'researcher' });
    }, /Cannot create child thread without parentThreadId/);

    // Non-existent parent
    assert.throws(() => {
      runtime.createSubagent({ parentThreadId: 'non_existent_thread_xyz', role: 'researcher' });
    }, /Parent Thread.*not found/);
  });

  // Test 24: Provider Failure Handling in Child Thread
  await asyncTest('Test 24: Upstream Provider Failure in Child Handled Gracefully', async () => {
    const runtime = HarnessRuntime.createIsolated();
    const parent = runtime.createThread();

    const result = await runtime.runSubagent({
      parentThreadId: parent.threadId,
      role: 'researcher',
      taskGoal: 'Simulate network outage',
      modelHandler: async () => {
        throw new Error('Upstream LLM rate limit 429');
      },
    });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.status, TURN_STATUS.FAILED);
    assert.ok(result.error.includes('rate limit 429'));
    assert.ok(result.summary.includes('Subagent execution error'));
  });

  // Test 25: Phase 18 End-to-End Read-Only Scenario (Router -> Parent -> 3 Children -> Handoff)
  await asyncTest('Test 25: Phase 18 End-to-End Read-Only Delegation Scenario', async () => {
    const runtime = HarnessRuntime.createIsolated();
    const userPrompt = 'Investigate auth.ts architecture and prepare a safe refactoring plan without modifying code.';

    // 1. Authoritative RequestRouter classification
    const classification = runtime.classifyRequest(userPrompt);
    assert.strictEqual(classification.mode, 'CODING_TASK');
    assert.strictEqual(classification.codingIntent, 'READ_ONLY');


    // 2. Parent Thread & Turn initiation
    const parentThread = runtime.createThread({ metadata: { workspacePath: testWorkspaceDir, title: 'Auth Audit' } });
    const parentTurn = runtime.startTurn(parentThread.threadId, userPrompt);

    // 3. Parent delegates concurrently to Researcher, Tester, and Reviewer
    const delegationConfigs = [
      {
        role: 'researcher',
        taskGoal: 'Inspect authentication architecture and identify risks',
        modelHandler: async () => 'Architecture finding: JWT verify function lacks audience validation.',
      },
      {
        role: 'tester',
        taskGoal: 'Inspect existing authentication tests and identify coverage gaps',
        modelHandler: async () => 'Test coverage finding: No expired token unit tests.',
      },
      {
        role: 'reviewer',
        taskGoal: 'Review the proposed architecture and identify safety concerns',
        modelHandler: async () => 'Safety review finding: RS256 migration recommended.',
      },
    ];

    const childResults = await runtime.runSubagentsConcurrent(
      delegationConfigs.map((c) => ({
        ...c,
        parentThreadId: parentThread.threadId,
        parentTurnId: parentTurn.turnId,
        workspacePath: testWorkspaceDir,
      })),
      { maxConcurrent: 3 }
    );

    assert.strictEqual(childResults.length, 3);
    assert.ok(childResults.every((r) => r.success && r.status === TURN_STATUS.COMPLETED));

    // 4. Parent receives structured results and synthesizes HandoffState
    const aggregatedFindings = childResults.map((r) => `[${r.role}] ${r.summary}`);
    const handoff = runtime.createHandoff({
      threadId: parentThread.threadId,
      sourceTurnId: parentTurn.turnId,
      taskGoal: 'Safe authentication refactoring strategy',
      codingIntent: 'READ_ONLY',
      workspacePath: testWorkspaceDir,
      completedObjectives: ['Architectural audit completed', 'Test gap analysis completed', 'Safety review completed'],
      pendingObjectives: ['Implement audience validation in auth.ts', 'Add unit tests'],
      importantDecisions: aggregatedFindings,
      continuationConstraints: ['Zero breaking changes to token verification interface'],
    });

    parentThread.handoffState = handoff;

    // Verify zero mutations occurred
    const authContent = fs.readFileSync(fileAuth, 'utf8');
    assert.ok(authContent.includes('verifyToken'));
    assert.strictEqual(handoff.pendingObjectives.length, 2);
    assert.strictEqual(handoff.importantDecisions.length, 3);
  });

  // Test 26: Phase 19 End-to-End Parent Mutation Authority Scenario
  await asyncTest('Test 26: Phase 19 End-to-End Parent Mutation Authority Scenario', async () => {
    const runtime = HarnessRuntime.createIsolated();
    const userPrompt = 'Refactor authentication across auth.ts and session.ts';

    const parentThread = runtime.createThread({ metadata: { workspacePath: testWorkspaceDir } });
    const parentTurn = runtime.startTurn(parentThread.threadId, userPrompt);

    // 1. Delegate research & review child tasks
    const subRes = await runtime.runSubagent({
      parentThreadId: parentThread.threadId,
      parentTurnId: parentTurn.turnId,
      role: 'researcher',
      taskGoal: 'Analyze auth.ts and session.ts interfaces',
      workspacePath: testWorkspaceDir,
      modelHandler: async () => 'Found export interfaces: verifyToken and getSession.',
    });
    assert.strictEqual(subRes.success, true);

    // 2. Parent (as the authoritative mutation orchestrator) creates Multi-File ChangeSet
    const changeSet = runtime.createChangeSet({
      threadId: parentThread.threadId,
      turnId: parentTurn.turnId,
      workspacePath: testWorkspaceDir,
    });

    changeSet.addFile({
      filePath: 'auth.ts',
      original: 'export function verifyToken(token: string) { return Boolean(token); }',
      replacement: 'export function verifyToken(token: string) { return Boolean(token && token.length > 5); }',
    });

    changeSet.addFile({
      filePath: 'session.ts',
      original: 'export function getSession(id: string) { return { id, active: true }; }',
      replacement: 'export function getSession(id: string) { return { id, active: Boolean(id) }; }',
    });

    // 3. Safety Evaluation & Transactional Apply
    await changeSet.evaluateSafety();
    changeSet.approve({ approvedBy: 'user', reason: 'Approved multi-file auth refactoring' });
    const applyResult = await changeSet.apply();


    assert.strictEqual(applyResult.success, true);
    assert.strictEqual(changeSet.status, 'APPLIED');

    // Verify disk was updated atomically
    const newAuth = fs.readFileSync(fileAuth, 'utf8');
    const newSession = fs.readFileSync(fileSession, 'utf8');
    assert.ok(newAuth.includes('token.length > 5'));
    assert.ok(newSession.includes('Boolean(id)'));
  });

  // Summary
  console.log('\n====================================================');
  console.log(`[RESULTS] ${passedTests} passed, ${failedTests} failed.`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
})();

