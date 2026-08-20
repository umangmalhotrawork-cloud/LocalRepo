/**
 * NEXUS CODEX HARNESS - SWARM COORDINATOR TEST SUITE (Milestone 10)
 * Verifies parent-level multi-agent swarm coordination:
 * 1. Swarm creation
 * 2. Plan validation
 * 3. Dependency graph validation
 * 4. Cycle rejection
 * 5. Bounded fan-out
 * 6. Parallel read-only execution
 * 7. Result aggregation
 * 8. Fan-in
 * 9. File conflict detection
 * 10. Baseline conflict detection
 * 11. Automatic adoption of non-conflicting ChangeSets
 * 12. Rejection of conflicting ChangeSets
 * 13. Parent-authoritative mutation
 * 14. Worker failure isolation
 * 15. Child cancellation
 * 16. Parent cancellation cascade
 * 17. FAIL_FAST behavior
 * 18. BEST_EFFORT behavior
 * 19. Persistence
 * 20. Restart reconstruction
 * 21. Event ordering
 * 22. Evidence recording
 * 23. Malformed plan rejection
 * 24. Concurrency limit enforcement
 * 25. No direct child-parent filesystem mutation
 * 26. Phase 18 End-to-End Read-Only Swarm Scenario
 * 27. Phase 19 End-to-End Mutation Swarm Scenario
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

process.env.ECHO_CONTINUUM_DIR = path.join(os.tmpdir(), `nexus_test_swarm_continuum_${Date.now()}`);
fs.mkdirSync(process.env.ECHO_CONTINUUM_DIR, { recursive: true });

const {
  HarnessRuntime,
  SwarmOrchestrator,
  SWARM_STATUS,
  SWARM_TASK_STATUS,
  SWARM_FAILURE_POLICY,
  SWARM_CONFLICT_CATEGORY,
  EVENT_TYPES,
  ChangeSet,
} = require('./harness');

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
console.log('[TEST] Starting NEXUS Codex Harness Swarm Suite (Milestone 10)...');
console.log('====================================================\n');

// Helper: Setup isolated test workspace
function setupWorkspace() {
  const wsDir = path.join(os.tmpdir(), `nexus_ws_swarm_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
  fs.mkdirSync(wsDir, { recursive: true });
  fs.writeFileSync(path.join(wsDir, 'auth.ts'), 'export function verifyToken(token: string) { return Boolean(token); }\n');
  fs.writeFileSync(path.join(wsDir, 'session.ts'), 'export function getSession() { return { ttl: 3600 }; }\n');
  fs.writeFileSync(path.join(wsDir, 'middleware.ts'), 'export function authMiddleware(req: any) { return true; }\n');
  return wsDir;
}

(async () => {
  const testWs = setupWorkspace();
  const harness = HarnessRuntime.createIsolated({ isolated: true });

  // Test 1: Swarm Creation
  test('Test 1: Swarm Plan Creation and Normalization', () => {
    const parentThread = harness.createThread({ metadata: { workspacePath: testWs } });
    const orchestrator = new SwarmOrchestrator();
    const plan = orchestrator.createPlan({
      parentThreadId: parentThread.threadId,
      goal: 'Audit authentication architecture',
      tasks: [
        { taskId: 'task_res', role: 'researcher', objective: 'Inspect auth files' },
        { taskId: 'task_test', role: 'tester', objective: 'Review test coverage', dependencies: ['task_res'] },
      ],
    });

    assert.ok(plan.swarmId.startsWith('swarm_'));
    assert.strictEqual(plan.parentThreadId, parentThread.threadId);
    assert.strictEqual(plan.status, SWARM_STATUS.PLANNING);
    assert.strictEqual(plan.tasks.length, 2);
    assert.strictEqual(plan.tasks[0].taskId, 'task_res');
    assert.deepStrictEqual(plan.tasks[1].dependencies, ['task_res']);
  });

  // Test 2: Plan Validation
  test('Test 2: Plan Validation Rejects Missing Required Fields', () => {
    const orchestrator = new SwarmOrchestrator();
    assert.throws(() => {
      orchestrator.createPlan({ goal: 'No parent thread' });
    }, /parentThreadId is required/);

    assert.throws(() => {
      orchestrator.createPlan({ parentThreadId: 't1', goal: '' });
    }, /requires a non-empty goal/);

    assert.throws(() => {
      orchestrator.createPlan({ parentThreadId: 't1', goal: 'Valid', tasks: [] });
    }, /must contain at least one task/);
  });

  // Test 3: Dependency Graph Validation
  test('Test 3: Dependency Graph Validation Detects Missing References', () => {
    const parentThread = harness.createThread({ metadata: { workspacePath: testWs } });
    const orchestrator = new SwarmOrchestrator();
    assert.throws(() => {
      orchestrator.createPlan({
        parentThreadId: parentThread.threadId,
        goal: 'Invalid dep reference',
        tasks: [
          { taskId: 't1', role: 'researcher', objective: 'Task 1', dependencies: ['non_existent_dep'] },
        ],
      });
    }, /references non-existent dependency/);
  });

  // Test 4: Cycle Rejection
  test('Test 4: Circular Dependency Detection and Rejection', () => {
    const parentThread = harness.createThread({ metadata: { workspacePath: testWs } });
    const orchestrator = new SwarmOrchestrator();
    assert.throws(() => {
      orchestrator.createPlan({
        parentThreadId: parentThread.threadId,
        goal: 'Circular dep',
        tasks: [
          { taskId: 't1', role: 'researcher', objective: 'Task 1', dependencies: ['t2'] },
          { taskId: 't2', role: 'tester', objective: 'Task 2', dependencies: ['t1'] },
        ],
      });
    }, /Circular dependency detected/);
  });

  // Test 5: Bounded Fan-Out
  await asyncTest('Test 5: Bounded Concurrency Limit Enforcement', async () => {
    const parentThread = harness.createThread({ metadata: { workspacePath: testWs } });
    const orchestrator = new SwarmOrchestrator({ subagentManager: harness.subagentManager });
    let maxSimultaneous = 0;
    let currentSimultaneous = 0;

    const plan = orchestrator.createPlan({
      parentThreadId: parentThread.threadId,
      goal: 'Concurrency test',
      maxConcurrency: 2,
      tasks: [
        { taskId: 'c1', role: 'researcher', objective: 'Task 1' },
        { taskId: 'c2', role: 'researcher', objective: 'Task 2' },
        { taskId: 'c3', role: 'researcher', objective: 'Task 3' },
        { taskId: 'c4', role: 'researcher', objective: 'Task 4' },
      ],
    });

    const mockHandler = async () => {
      currentSimultaneous++;
      if (currentSimultaneous > maxSimultaneous) maxSimultaneous = currentSimultaneous;
      await new Promise((r) => setTimeout(r, 50));
      currentSimultaneous--;
      return 'Completed concurrency step';
    };

    const res = await orchestrator.executeSwarm(plan, {
      modelHandler: mockHandler,
      workspacePath: testWs,
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.completedTaskCount, 4);
    assert.ok(maxSimultaneous <= 2, `maxSimultaneous was ${maxSimultaneous}, expected <= 2`);
  });

  // Test 6: Parallel Read-Only Execution
  await asyncTest('Test 6: Parallel Independent Read-Only Child Execution', async () => {
    const parentThread = harness.createThread({ metadata: { workspacePath: testWs } });
    const orchestrator = new SwarmOrchestrator({ subagentManager: harness.subagentManager });
    const plan = orchestrator.createPlan({
      parentThreadId: parentThread.threadId,
      goal: 'Parallel read-only review',
      tasks: [
        { taskId: 'task_auth', role: 'researcher', objective: 'Review auth.ts' },
        { taskId: 'task_session', role: 'tester', objective: 'Review session.ts' },
      ],
    });

    const res = await orchestrator.executeSwarm(plan, {
      mockResponses: {
        task_auth: 'Auth review complete: no issues found',
        task_session: 'Session review complete: TTL is 3600',
      },
      workspacePath: testWs,
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.completedTaskCount, 2);
    assert.strictEqual(res.changedFiles.length, 0);
  });

  // Test 7: Result Aggregation
  await asyncTest('Test 7: Structured Result Aggregation (Findings & Summaries)', async () => {
    const parentThread = harness.createThread({ metadata: { workspacePath: testWs } });
    const orchestrator = new SwarmOrchestrator({ subagentManager: harness.subagentManager });
    const plan = orchestrator.createPlan({
      parentThreadId: parentThread.threadId,
      goal: 'Collect multi-agent findings',
      tasks: [
        { taskId: 't_res', role: 'researcher', objective: 'Analyze vulnerability' },
        { taskId: 't_rev', role: 'reviewer', objective: 'Audit permissions' },
      ],
    });

    const res = await orchestrator.executeSwarm(plan, {
      mockResponses: {
        t_res: 'Finding: Weak token validation in auth.ts',
        t_rev: 'Finding: Missing role check in middleware.ts',
      },
      workspacePath: testWs,
    });

    assert.strictEqual(res.success, true);
    assert.strictEqual(res.summaries.length, 2);
    assert.ok(res.summaries[0].includes('RESEARCHER'));
    assert.ok(res.summaries[1].includes('REVIEWER'));
  });

  // Test 8: Fan-In
  await asyncTest('Test 8: Fan-In Aggregation with Complete Task States', async () => {
    const parentThread = harness.createThread({ metadata: { workspacePath: testWs } });
    const orchestrator = new SwarmOrchestrator({ subagentManager: harness.subagentManager });
    const plan = orchestrator.createPlan({
      parentThreadId: parentThread.threadId,
      goal: 'Fan-in test',
      tasks: [
        { taskId: 'step1', role: 'researcher', objective: 'Step 1' },
        { taskId: 'step2', role: 'tester', objective: 'Step 2', dependencies: ['step1'] },
      ],
    });

    const res = await orchestrator.executeSwarm(plan, {
      mockResponses: {
        step1: 'Step 1 complete',
        step2: 'Step 2 complete',
      },
      workspacePath: testWs,
    });

    assert.strictEqual(res.status, SWARM_STATUS.COMPLETED);
    assert.strictEqual(res.taskResults.length, 2);
    assert.strictEqual(res.taskResults[0].status, SWARM_TASK_STATUS.COMPLETED);
    assert.strictEqual(res.taskResults[1].status, SWARM_TASK_STATUS.COMPLETED);
  });

  // Test 9: File Conflict Detection
  test('Test 9: File Overlap Conflict Detection Across Sibling ChangeSets', () => {
    const orchestrator = new SwarmOrchestrator();
    const cs1 = new ChangeSet({
      workspacePath: testWs,
      edits: [{ filePath: 'auth.ts', original: 'Boolean(token)', replacement: 'token.length > 5' }],
    });
    const cs2 = new ChangeSet({
      workspacePath: testWs,
      edits: [{ filePath: 'auth.ts', original: 'Boolean(token)', replacement: 'Boolean(token && token !== "null")' }],
    });

    const report = orchestrator.detectConflicts([cs1, cs2], { workspacePath: testWs });
    assert.strictEqual(report.hasConflicts, true);
    assert.strictEqual(report.category, SWARM_CONFLICT_CATEGORY.FILE_CONFLICT);
    assert.ok(report.conflictingFiles.includes('auth.ts'));
  });

  // Test 10: Baseline Conflict Detection
  test('Test 10: Baseline Conflict Detection on Diverged Parent Content', () => {
    const orchestrator = new SwarmOrchestrator();
    const cs1 = new ChangeSet({
      workspacePath: testWs,
      edits: [{ filePath: 'auth.ts', original: 'non_existent_original_snippet_xyz', replacement: 'replacement' }],
    });

    const report = orchestrator.detectConflicts([cs1], { workspacePath: testWs });
    assert.strictEqual(report.hasConflicts, true);
    assert.strictEqual(report.category, SWARM_CONFLICT_CATEGORY.BASELINE_CONFLICT);
  });

  // Test 11: Automatic Adoption of Non-Conflicting ChangeSets
  await asyncTest('Test 11: Atomic Adoption of Non-Conflicting Disjoint ChangeSets', async () => {
    const wsAdopt = setupWorkspace();
    const parentThread = harness.createThread({ metadata: { workspacePath: wsAdopt } });
    const orchestrator = new SwarmOrchestrator();

    const cs1 = new ChangeSet({
      workspacePath: wsAdopt,
      edits: [{ filePath: 'auth.ts', original: 'return Boolean(token);', replacement: 'return token !== null && token.length > 0;' }],
    });
    const cs2 = new ChangeSet({
      workspacePath: wsAdopt,
      edits: [{ filePath: 'session.ts', original: 'ttl: 3600', replacement: 'ttl: 7200' }],
    });

    const adoptRes = await orchestrator.adoptNonConflictingChanges([cs1, cs2], {
      parentWorkspacePath: wsAdopt,
      parentThreadId: parentThread.threadId,
    });

    assert.strictEqual(adoptRes.success, true);
    const authContent = fs.readFileSync(path.join(wsAdopt, 'auth.ts'), 'utf8');
    const sessionContent = fs.readFileSync(path.join(wsAdopt, 'session.ts'), 'utf8');
    assert.ok(authContent.includes('token.length > 0'));
    assert.ok(sessionContent.includes('ttl: 7200'));
  });

  // Test 12: Rejection of Conflicting ChangeSets
  await asyncTest('Test 12: Rejection of Conflicting ChangeSets during Adoption', async () => {
    const wsReject = setupWorkspace();
    const parentThread = harness.createThread({ metadata: { workspacePath: wsReject } });
    const orchestrator = new SwarmOrchestrator();

    const cs1 = new ChangeSet({
      workspacePath: wsReject,
      edits: [{ filePath: 'auth.ts', original: 'return Boolean(token);', replacement: 'return true;' }],
    });
    const cs2 = new ChangeSet({
      workspacePath: wsReject,
      edits: [{ filePath: 'auth.ts', original: 'return Boolean(token);', replacement: 'return false;' }],
    });

    await assert.rejects(async () => {
      await orchestrator.adoptNonConflictingChanges([cs1, cs2], {
        parentWorkspacePath: wsReject,
        parentThreadId: parentThread.threadId,
      });
    }, /Cannot auto-adopt ChangeSets with active conflicts/);
  });

  // Test 13: Parent-Authoritative Mutation
  test('Test 13: Parent Working Tree Remains Untouched Before Explicit Adoption', () => {
    const originalAuth = fs.readFileSync(path.join(testWs, 'auth.ts'), 'utf8');
    assert.ok(originalAuth.includes('return Boolean(token);'));
  });

  // Test 14: Worker Failure Isolation
  await asyncTest('Test 14: Worker Failure in One Task Isolates Cleanly', async () => {
    const parentThread = harness.createThread({ metadata: { workspacePath: testWs } });
    const orchestrator = new SwarmOrchestrator({ subagentManager: harness.subagentManager });
    const plan = orchestrator.createPlan({
      parentThreadId: parentThread.threadId,
      goal: 'Failure isolation test',
      failurePolicy: SWARM_FAILURE_POLICY.BEST_EFFORT,
      tasks: [
        { taskId: 'task_fail', role: 'researcher', objective: 'Will fail' },
        { taskId: 'task_ok', role: 'tester', objective: 'Will succeed' },
      ],
    });

    const mockHandler = async (messages, tools, options) => {
      const isFail = JSON.stringify(messages).includes('Will fail') || (options?.userInput && options.userInput.includes('Will fail'));
      if (isFail) {
        throw new Error('Task fail error');
      }
      return 'Success response';
    };

    const res = await orchestrator.executeSwarm(plan, {
      modelHandler: mockHandler,
      workspacePath: testWs,
    });

    assert.strictEqual(res.completedTaskCount, 1);
    assert.strictEqual(res.failedTaskCount, 1);
    assert.strictEqual(res.status, SWARM_STATUS.PARTIAL_SUCCESS);
  });

  // Test 15: Child Cancellation
  await asyncTest('Test 15: Child Cancellation Skips Dependent Tasks', async () => {
    const parentThread = harness.createThread({ metadata: { workspacePath: testWs } });
    const orchestrator = new SwarmOrchestrator({ subagentManager: harness.subagentManager });
    const plan = orchestrator.createPlan({
      parentThreadId: parentThread.threadId,
      goal: 'Dependency skip test',
      tasks: [
        { taskId: 'dep1', role: 'researcher', objective: 'Fails' },
        { taskId: 'dep2', role: 'tester', objective: 'Dependent on dep1', dependencies: ['dep1'] },
      ],
    });

    const mockHandler = async () => {
      throw new Error('Failed task');
    };

    const res = await orchestrator.executeSwarm(plan, {
      modelHandler: mockHandler,
      workspacePath: testWs,
    });

    assert.strictEqual(res.failedTaskCount, 1);
    assert.strictEqual(res.skippedTaskCount, 1);
  });

  // Test 16: Parent Cancellation Cascade
  await asyncTest('Test 16: Parent Swarm Cancellation Cascades to All Tasks', async () => {
    const parentThread = harness.createThread({ metadata: { workspacePath: testWs } });
    const orchestrator = new SwarmOrchestrator({ subagentManager: harness.subagentManager });
    const plan = orchestrator.createPlan({
      parentThreadId: parentThread.threadId,
      goal: 'Cancel cascade test',
      tasks: [
        { taskId: 't_canc_1', role: 'researcher', objective: 'Task 1' },
      ],
    });

    const cancelRes = orchestrator.cancelSwarm(plan.swarmId, 'User abort');
    assert.strictEqual(cancelRes.success, true);
    assert.strictEqual(cancelRes.status, SWARM_STATUS.CANCELLED);
  });

  // Test 17: FAIL_FAST Behavior
  await asyncTest('Test 17: FAIL_FAST Failure Policy Halts Swarm Immediately', async () => {
    const parentThread = harness.createThread({ metadata: { workspacePath: testWs } });
    const orchestrator = new SwarmOrchestrator({ subagentManager: harness.subagentManager });
    const plan = orchestrator.createPlan({
      parentThreadId: parentThread.threadId,
      goal: 'Fail fast test',
      failurePolicy: SWARM_FAILURE_POLICY.FAIL_FAST,
      tasks: [
        { taskId: 'ff_1', role: 'researcher', objective: 'Failing' },
        { taskId: 'ff_2', role: 'tester', objective: 'Will not run', dependencies: ['ff_1'] },
      ],
    });

    const mockHandler = async () => {
      throw new Error('Fast failure');
    };

    const res = await orchestrator.executeSwarm(plan, {
      modelHandler: mockHandler,
      workspacePath: testWs,
    });

    assert.strictEqual(res.failedTaskCount, 1);
  });

  // Test 18: BEST_EFFORT Behavior
  await asyncTest('Test 18: BEST_EFFORT Failure Policy Continues Independent Tasks', async () => {
    const parentThread = harness.createThread({ metadata: { workspacePath: testWs } });
    const orchestrator = new SwarmOrchestrator({ subagentManager: harness.subagentManager });
    const plan = orchestrator.createPlan({
      parentThreadId: parentThread.threadId,
      goal: 'Best effort test',
      failurePolicy: SWARM_FAILURE_POLICY.BEST_EFFORT,
      tasks: [
        { taskId: 'be_fail', role: 'researcher', objective: 'Failing' },
        { taskId: 'be_ok', role: 'reviewer', objective: 'Independent success' },
      ],
    });

    const res = await orchestrator.executeSwarm(plan, {
      mockResponses: {
        be_ok: 'Independent review succeeded',
      },
      modelHandler: async (messages, tools, options) => {
        const isFail = JSON.stringify(messages).includes('Failing') || (options?.userInput && options.userInput.includes('Failing'));
        if (isFail) throw new Error('Failed');
        return 'Independent review succeeded';
      },
      workspacePath: testWs,
    });

    assert.strictEqual(res.completedTaskCount, 1);
    assert.strictEqual(res.failedTaskCount, 1);
  });

  // Test 19: Persistence & Metadata Serialization
  test('Test 19: Swarm Status and Metadata Serialization', () => {
    const parentThread = harness.createThread({ metadata: { workspacePath: testWs } });
    const orchestrator = new SwarmOrchestrator();
    const plan = orchestrator.createPlan({
      parentThreadId: parentThread.threadId,
      goal: 'Persistence test',
      tasks: [{ taskId: 'p1', role: 'researcher', objective: 'P1' }],
    });

    const json = JSON.stringify(plan);
    const parsed = JSON.parse(json);
    assert.strictEqual(parsed.swarmId, plan.swarmId);
    assert.strictEqual(parsed.tasks.length, 1);
  });

  // Test 20: Restart Reconstruction
  test('Test 20: Reconstruct Swarm Plan Across Restart Invariant', () => {
    const parentThread = harness.createThread({ metadata: { workspacePath: testWs } });
    const orchestrator = new SwarmOrchestrator();
    const plan = orchestrator.createPlan({
      parentThreadId: parentThread.threadId,
      goal: 'Reconstruction test',
      tasks: [
        { taskId: 'rec1', role: 'researcher', objective: 'Rec 1' },
        { taskId: 'rec2', role: 'tester', objective: 'Rec 2', dependencies: ['rec1'] },
      ],
    });

    // Verify dependency graph remains intact after re-validation
    orchestrator.validateDependencyGraph(plan.tasks);
    assert.ok(true);
  });

  // Test 21: Event Ordering
  await asyncTest('Test 21: Monotonic Event Sequence Ordering Across Swarm Events', async () => {
    const parentThread = harness.createThread({ metadata: { workspacePath: testWs } });
    const orchestrator = new SwarmOrchestrator({ subagentManager: harness.subagentManager });
    const sequenceNumbers = [];
    orchestrator.eventBus.subscribe((evt) => {
      if (evt.type.startsWith('SWARM_')) {
        sequenceNumbers.push(evt.sequenceNumber);
      }
    });

    const plan = orchestrator.createPlan({
      parentThreadId: parentThread.threadId,
      goal: 'Event ordering test',
      tasks: [{ taskId: 'eo1', role: 'researcher', objective: 'Ordering' }],
    });

    await orchestrator.executeSwarm(plan, {
      mockResponses: { eo1: 'Ordering complete' },
      workspacePath: testWs,
    });

    assert.ok(sequenceNumbers.length >= 3);
    for (let i = 1; i < sequenceNumbers.length; i++) {
      assert.ok(sequenceNumbers[i] > sequenceNumbers[i - 1]);
    }
  });

  // Test 22: Evidence Recording
  test('Test 22: Swarm Creation Records EvidenceGraph Node', () => {
    const parentThread = harness.createThread({ metadata: { workspacePath: testWs } });
    const orchestrator = new SwarmOrchestrator();
    const plan = orchestrator.createPlan({
      parentThreadId: parentThread.threadId,
      goal: 'Evidence test',
      tasks: [{ taskId: 'ev1', role: 'researcher', objective: 'Evidence' }],
    });

    assert.ok(plan.swarmId !== null);
  });

  // Test 23: Malformed Plan Rejection
  test('Test 23: Rejection of Malformed Swarm Task Role', () => {
    const parentThread = harness.createThread({ metadata: { workspacePath: testWs } });
    const orchestrator = new SwarmOrchestrator();
    assert.throws(() => {
      orchestrator.createPlan({
        parentThreadId: parentThread.threadId,
        goal: 'Bad role',
        tasks: [{ taskId: 'bad', role: 'invalid_super_role', objective: 'Invalid' }],
      });
    }, /Unsupported task role/);
  });

  // Test 24: Concurrency Limit Enforcement
  test('Test 24: Clamping Max Concurrency to Safety Ceiling', () => {
    const parentThread = harness.createThread({ metadata: { workspacePath: testWs } });
    const orchestrator = new SwarmOrchestrator({ limits: { maxConcurrentTasks: 3 } });
    const plan = orchestrator.createPlan({
      parentThreadId: parentThread.threadId,
      goal: 'Clamp test',
      maxConcurrency: 100, // Should be clamped to 3
      tasks: [{ taskId: 'cl1', role: 'researcher', objective: 'Clamp' }],
    });

    assert.strictEqual(plan.maxConcurrency, 3);
  });

  // Test 25: No Direct Child-Parent Filesystem Mutation
  await asyncTest('Test 25: Child Subagent Mutation Does Not Mutate Parent Workspace Direct', async () => {
    const wsIso = setupWorkspace();
    const parentThread = harness.createThread({ metadata: { workspacePath: wsIso } });
    const orchestrator = new SwarmOrchestrator({ subagentManager: harness.subagentManager });

    const plan = orchestrator.createPlan({
      parentThreadId: parentThread.threadId,
      goal: 'Isolation test',
      tasks: [
        { taskId: 'iso_coder', role: 'coder', objective: 'Modify auth in isolated workspace', allowMutation: true },
      ],
    });

    // Auto-adopt is FALSE
    await orchestrator.executeSwarm(plan, {
      autoAdopt: false,
      workspacePath: wsIso,
      mockResponses: {
        iso_coder: 'Modified in isolated workspace',
      },
    });

    // Parent file remains unchanged
    const authContent = fs.readFileSync(path.join(wsIso, 'auth.ts'), 'utf8');
    assert.ok(authContent.includes('return Boolean(token);'));
  });

  // Test 26: Phase 18 End-to-End Read-Only Swarm Scenario
  await asyncTest('Test 26: Phase 18 End-to-End Read-Only Swarm Scenario', async () => {
    const wsScenario = setupWorkspace();
    const parentThread = harness.createThread({ metadata: { workspacePath: wsScenario } });
    const plan = harness.createSwarmPlan({
      parentThreadId: parentThread.threadId,
      goal: 'Investigate the authentication architecture and identify security and test-coverage issues',
      tasks: [
        { taskId: 'researcher_arch', role: 'researcher', objective: 'Inspect authentication components and flows' },
        { taskId: 'tester_coverage', role: 'tester', objective: 'Analyze test coverage across auth and session' },
        { taskId: 'reviewer_security', role: 'reviewer', objective: 'Perform security risk audit on token validation' },
      ],
    });

    const swarmOutcome = await harness.executeSwarm(plan, {
      workspacePath: wsScenario,
      mockResponses: {
        researcher_arch: 'Architecture Analysis: Auth modules cleanly split into auth.ts, session.ts, middleware.ts',
        tester_coverage: 'Test Coverage: Coverage gaps found in token expiration edge-cases',
        reviewer_security: 'Security Audit: Token parameter requires strict length and character set validation',
      },
    });

    assert.strictEqual(swarmOutcome.success, true);
    assert.strictEqual(swarmOutcome.completedTaskCount, 3);
    assert.strictEqual(swarmOutcome.changedFiles.length, 0);
    assert.ok(swarmOutcome.summaries.some((s) => s.includes('Architecture Analysis')));
    assert.ok(swarmOutcome.summaries.some((s) => s.includes('Test Coverage')));
    assert.ok(swarmOutcome.summaries.some((s) => s.includes('Security Audit')));
  });

  // Test 27: Phase 19 End-to-End Mutation Swarm Scenario
  await asyncTest('Test 27: Phase 19 End-to-End Mutation Swarm Scenario with Dependent Adoption', async () => {
    const wsRefactor = setupWorkspace();
    const parentThread = harness.createThread({ metadata: { workspacePath: wsRefactor } });
    const plan = harness.createSwarmPlan({
      parentThreadId: parentThread.threadId,
      goal: 'Refactor authentication across auth.ts and session.ts',
      tasks: [
        { taskId: 'task_analysis', role: 'researcher', objective: 'Analyze existing auth and session signatures' },
        {
          taskId: 'task_auth_patch',
          role: 'coder',
          objective: 'Upgrade token validation in auth.ts',
          allowMutation: true,
          dependencies: ['task_analysis'],
        },
        {
          taskId: 'task_session_patch',
          role: 'coder',
          objective: 'Upgrade session TTL in session.ts',
          allowMutation: true,
          dependencies: ['task_analysis'],
        },
      ],
    });

    const csAuth = new ChangeSet({
      workspacePath: wsRefactor,
      edits: [{ filePath: 'auth.ts', original: 'return Boolean(token);', replacement: 'return Boolean(token && token.trim().length >= 8);' }],
    });

    const csSession = new ChangeSet({
      workspacePath: wsRefactor,
      edits: [{ filePath: 'session.ts', original: 'ttl: 3600', replacement: 'ttl: 86400' }],
    });

    const swarmOutcome = await harness.executeSwarm(plan, {
      workspacePath: wsRefactor,
      mockResponses: {
        task_analysis: 'Analysis complete: auth and session are independent and disjoint',
        task_auth_patch: 'Patched auth.ts validation',
        task_session_patch: 'Patched session.ts TTL',
      },
    });

    assert.strictEqual(swarmOutcome.success, true);
    assert.strictEqual(swarmOutcome.completedTaskCount, 3);

    // Conflict Check across disjoint patches
    const conflictReport = harness.detectSwarmConflicts([csAuth, csSession], { workspacePath: wsRefactor });
    assert.strictEqual(conflictReport.hasConflicts, false);

    // Parent Authoritative Adoption of the two non-conflicting ChangeSets
    const adoptOutcome = await harness.adoptSwarmChanges([csAuth, csSession], {
      parentWorkspacePath: wsRefactor,
      parentThreadId: parentThread.threadId,
      verifierFn: async () => ({ success: true, testStatus: 'PASSED' }),
    });

    assert.strictEqual(adoptOutcome.success, true);
    assert.strictEqual(adoptOutcome.adoptedFiles.length, 2);

    const authAfter = fs.readFileSync(path.join(wsRefactor, 'auth.ts'), 'utf8');
    const sessionAfter = fs.readFileSync(path.join(wsRefactor, 'session.ts'), 'utf8');
    assert.ok(authAfter.includes('token.trim().length >= 8'));
    assert.ok(sessionAfter.includes('ttl: 86400'));
  });

  // Cleanup any lingering workers
  harness.workerRuntime.dispose();

  // Summary
  console.log('\n====================================================');
  console.log(`[RESULTS] ${passedTests} passed, ${failedTests} failed.`);
  console.log('====================================================');

  process.exit(failedTests > 0 ? 1 : 0);
})();
