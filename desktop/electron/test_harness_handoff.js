/**
 * NEXUS CODEX HARNESS - DURABLE HANDOFF TEST SUITE (Milestone 7)
 * Tests durable HandoffState creation, validation, directives, ContextEngine integration,
 * compactness, Continuum/Capsule integration, restart/resume continuity, and error handling.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const {
  HarnessRuntime,
  HandoffState,
  HANDOFF_STATUS,
  ITEM_TYPES,
  TURN_STATUS,
  ContextEngine,
} = require('./harness');
const { continuumCapsuleBuilder } = require('../engine/continuum_capsule_builder');

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
console.log('[TEST] Starting NEXUS Codex Harness Handoff Suite (Milestone 7)...');
console.log('====================================================\n');

// Set isolated test directory for ContinuumManager
const testContinuumDir = path.join(os.tmpdir(), `nexus_handoff_cont_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
process.env.ECHO_CONTINUUM_DIR = testContinuumDir;
fs.mkdirSync(testContinuumDir, { recursive: true });

(async () => {
  // Test 14: Handoff Creation
  test('Test 14: HandoffState Creation with Complete Fields', () => {
    const handoff = new HandoffState({
      threadId: 'thread_201',
      sourceTurnId: 'turn_201',
      taskGoal: 'Refactor authentication subsystem to use JWT and secure cookies',
      codingIntent: 'MUTATION',
      workspacePath: process.cwd(),
      activeFilePath: 'src/auth/jwt.ts',
      completedObjectives: ['Created JWT signing utility', 'Added token expiration test'],
      pendingObjectives: ['Implement refresh token rotation', 'Add CSRF protection middleware'],
      changedFiles: ['src/auth/jwt.ts', 'src/auth/types.ts'],
      unresolvedIssues: ['Need Redis configuration for token revocation list'],
      verificationState: { testStatus: 'PASSED', failingTests: [], verified: true },
      safetyState: { overallRiskLevel: 'AUTO_APPROVE', riskScore: 5 },
      importantDecisions: ['Use RS256 asymmetric signing algorithm instead of HS256'],
      nextRecommendedAction: 'Implement refresh token rotation',
      continuationConstraints: ['Do not touch legacy session store table in database'],
    });

    assert.ok(handoff.handoffId.startsWith('handoff_'));
    assert.strictEqual(handoff.threadId, 'thread_201');
    assert.strictEqual(handoff.sourceTurnId, 'turn_201');
    assert.strictEqual(handoff.status, HANDOFF_STATUS.ACTIVE);
    assert.strictEqual(handoff.completedObjectives.length, 2);
    assert.strictEqual(handoff.pendingObjectives.length, 2);
    assert.strictEqual(handoff.importantDecisions.length, 1);
    assert.strictEqual(handoff.continuationConstraints.length, 1);

    const directive = handoff.toDirective();
    assert.strictEqual(directive.goal, 'Refactor authentication subsystem to use JWT and secure cookies');
    assert.strictEqual(directive.nextAction, 'Implement refresh token rotation');
    assert.strictEqual(directive.pending.length, 2);
  });

  // Test 15: Required Field Validation
  test('Test 15: Required Field Validation & Error Reporting', () => {
    // Missing threadId
    assert.throws(() => {
      new HandoffState({ sourceTurnId: 'turn_1', taskGoal: 'Goal' });
    }, /Missing required field "threadId"/);

    // Missing sourceTurnId
    assert.throws(() => {
      new HandoffState({ threadId: 'thread_1', taskGoal: 'Goal' });
    }, /Missing required field "sourceTurnId"/);

    // Missing taskGoal
    assert.throws(() => {
      new HandoffState({ threadId: 'thread_1', sourceTurnId: 'turn_1' });
    }, /Missing required field "taskGoal"/);
  });

  // Test 16: Handoff Persistence via HarnessPersistenceAdapter
  test('Test 16: Handoff Persistence via HarnessPersistenceAdapter', () => {
    const runtime = HarnessRuntime.createIsolated();
    const thread = runtime.createThread({
      metadata: { title: 'Persistence Test Thread' },
    });

    const handoff = runtime.createHandoff({
      threadId: thread.threadId,
      sourceTurnId: 'turn_p1',
      taskGoal: 'Build distributed cache client',
      completedObjectives: ['Setup connection pool'],
      pendingObjectives: ['Add retry with exponential backoff'],
      importantDecisions: ['Use ring hash algorithm'],
      verificationState: { testStatus: 'PASSED' },
    });

    thread.metadata.handoffState = handoff.toJSON();
    thread.handoffState = handoff;

    const saveResult = runtime.saveThread(thread.threadId, process.cwd());
    assert.strictEqual(saveResult.success, true);

    const loadResult = runtime.loadThread(thread.threadId, process.cwd());
    assert.strictEqual(loadResult.success, true);
    assert.ok(loadResult.thread.metadata.handoffState);
    assert.strictEqual(loadResult.thread.metadata.handoffState.taskGoal, 'Build distributed cache client');
  });

  // Test 17: Handoff Restoration & Capsule Adapter Bridge
  test('Test 17: Handoff Restoration and Continuum Capsule Bridge', () => {
    const mockCapsule = {
      capsule_schema_version: '1.0.0',
      capsule_meta: {
        capsule_id: 'caps_test_bridge_101',
        source_session_id: 'thread_bridge_101',
        export_mode: 'INLINE',
        capsule_hash: 'computed_hash',
      },
      task: {
        user_goal: 'Implement OAuth2 PKCE Flow',
        work_items: [
          { id: 'wi-1', description: 'Generate code verifier & challenge', status: 'IMPLEMENTED' },
          { id: 'wi-2', description: 'Exchange authorization code for tokens', status: 'PLANNED' },
        ],
      },
      verification: {
        last_test_status: 'PASSED',
        failing_tests: [],
      },
      decisions: [
        { decision: 'Use SHA-256 code challenge method (S256)', userApproved: true },
      ],
      handoff_context: {
        immediate_next_action: 'Exchange authorization code for tokens',
        unresolved_questions: ['Check token endpoint CORS headers'],
        do_not_touch: ['src/legacy/auth.js'],
      },
    };

    const handoff = HandoffState.fromCapsule(mockCapsule);
    assert.strictEqual(handoff.threadId, 'thread_bridge_101');
    assert.strictEqual(handoff.taskGoal, 'Implement OAuth2 PKCE Flow');
    assert.strictEqual(handoff.completedObjectives.length, 1);
    assert.strictEqual(handoff.completedObjectives[0], 'Generate code verifier & challenge');
    assert.strictEqual(handoff.pendingObjectives.length, 1);
    assert.strictEqual(handoff.pendingObjectives[0], 'Exchange authorization code for tokens');
    assert.strictEqual(handoff.continuationConstraints.length, 1);
    assert.strictEqual(handoff.continuationConstraints[0], 'src/legacy/auth.js');
  });

  // Test 18: ContextEngine Inclusion (Formatted ## ACTIVE HANDOFF Block)
  test('Test 18: ContextEngine Formatted ## ACTIVE HANDOFF Section', () => {
    const engine = new ContextEngine();
    const handoff = new HandoffState({
      threadId: 'thread_ctx_18',
      sourceTurnId: 'turn_ctx_18',
      taskGoal: 'Optimize database query performance',
      codingIntent: 'MUTATION',
      completedObjectives: ['Added composite index on (user_id, created_at)'],
      pendingObjectives: ['Rewrite N+1 query in order loader'],
      continuationConstraints: ['Do not alter primary key structure'],
      importantDecisions: ['Use batch cursor loader pattern'],
      verificationState: { testStatus: 'PASSED' },
      nextRecommendedAction: 'Rewrite N+1 query in order loader',
    });

    const context = engine.buildContext({
      handoffState: handoff,
      workspacePath: process.cwd(),
      intent: 'MUTATION',
    });

    assert.ok(context.systemPrompt.includes('## ACTIVE HANDOFF'));
    assert.ok(context.systemPrompt.includes('Task Goal: Optimize database query performance'));
    assert.ok(context.systemPrompt.includes('[COMPLETED] Added composite index on (user_id, created_at)'));
    assert.ok(context.systemPrompt.includes('[PENDING] Rewrite N+1 query in order loader'));
    assert.ok(context.systemPrompt.includes('[CONSTRAINT] Do not alter primary key structure'));
    assert.ok(context.systemPrompt.includes('[DECISION] Use batch cursor loader pattern'));
    assert.ok(context.systemPrompt.includes('Immediate Next Action: Rewrite N+1 query in order loader'));
  });

  // Test 19: Compactness (No Historical Dialogue Inflation)
  test('Test 19: Compactness Invariant (Zero Raw Dialogue Bloat)', () => {
    const handoff = new HandoffState({
      threadId: 'thread_compact_19',
      sourceTurnId: 'turn_compact_19',
      taskGoal: 'Migrate legacy logging to structured JSON logger',
      completedObjectives: ['Phase 1: Logger interface defined', 'Phase 2: stdout transport configured'],
      pendingObjectives: ['Phase 3: Replace console.log across 20 modules'],
      nextRecommendedAction: 'Replace console.log in auth module',
    });

    const prompt = handoff.toContextPrompt();
    // Compact representation must be concise (< 1500 chars)
    assert.ok(prompt.length < 1500);
    assert.ok(!prompt.includes('raw_transcript'));
    assert.ok(!prompt.includes('tool_call_trace'));
  });

  // Test 20: Pending Objective Preservation
  test('Test 20: Pending Objective Preservation Across Turns', () => {
    const handoff = new HandoffState({
      threadId: 'thread_20',
      sourceTurnId: 'turn_20',
      taskGoal: 'Implement 3 endpoints',
      pendingObjectives: ['GET /api/v1/users', 'POST /api/v1/users', 'DELETE /api/v1/users/:id'],
    });

    const directive = handoff.toDirective();
    assert.deepStrictEqual(directive.pending, [
      'GET /api/v1/users',
      'POST /api/v1/users',
      'DELETE /api/v1/users/:id',
    ]);
  });

  // Test 21: Verification Preservation
  test('Test 21: Verification State Preservation Across Handoff', () => {
    const handoff = new HandoffState({
      threadId: 'thread_21',
      sourceTurnId: 'turn_21',
      taskGoal: 'Fix flaky test',
      verificationState: {
        testStatus: 'FAILED',
        failingTests: ['test_concurrent_payment_race_condition'],
        verified: false,
      },
    });

    const prompt = handoff.toContextPrompt();
    assert.ok(prompt.includes('Verification State: FAILED (Failing: test_concurrent_payment_race_condition)'));
  });

  // Test 22: Important Decision Preservation Across Compaction
  test('Test 22: Important Decision Preservation in Handoff Context', () => {
    const handoff = new HandoffState({
      threadId: 'thread_22',
      sourceTurnId: 'turn_22',
      taskGoal: 'Architecture refactor',
      importantDecisions: [
        'Architecture Decision: Separate read-models from write-models (CQRS)',
        'Database Decision: Use PostgreSQL advisory locks for distributed mutex',
      ],
    });

    const prompt = handoff.toContextPrompt();
    assert.ok(prompt.includes('[DECISION] Architecture Decision: Separate read-models from write-models (CQRS)'));
    assert.ok(prompt.includes('[DECISION] Database Decision: Use PostgreSQL advisory locks for distributed mutex'));
  });

  // Test 23: Restart / Resume Continuity (Turn-to-Turn Handoff)
  await asyncTest('Test 23: Resuming Turn with HandoffState Continuation', async () => {
    const runtime = HarnessRuntime.createIsolated();
    const thread = runtime.createThread();

    // Turn 1 completes half the objective and generates a HandoffState
    const handoff = runtime.createHandoff({
      threadId: thread.threadId,
      sourceTurnId: 'turn_1',
      taskGoal: 'Implement user registration and verification',
      completedObjectives: ['User model and password hashing completed'],
      pendingObjectives: ['Email verification token generation and sender'],
      nextRecommendedAction: 'Implement email token generator',
    });

    // Turn 2 consumes the handoff state
    let capturedContextPrompt = null;
    const turnOutcome = await runtime.runTurn({
      threadId: thread.threadId,
      userInput: 'Continue remaining work',
      handoffState: handoff,
      modelHandler: async (messages) => {
        capturedContextPrompt = messages[0]?.content || '';
        return {
          content: 'Implemented email token generation and verified with unit tests.',
        };
      },
    });

    assert.strictEqual(turnOutcome.success, true);
    assert.strictEqual(turnOutcome.status, TURN_STATUS.COMPLETED);
    assert.ok(capturedContextPrompt.includes('## ACTIVE HANDOFF'));
    assert.ok(capturedContextPrompt.includes('[COMPLETED] User model and password hashing completed'));
    assert.ok(capturedContextPrompt.includes('[PENDING] Email verification token generation and sender'));
  });

  // Test 24: Invalid / Malformed Handoff Rejection
  test('Test 24: Safe Rejection of Malformed Handoff Payloads', () => {
    assert.throws(() => {
      HandoffState.fromJSON(null);
    }, /non-null object/);

    assert.throws(() => {
      HandoffState.fromJSON('invalid_string_payload');
    }, /non-null object/);

    assert.throws(() => {
      HandoffState.fromJSON({ threadId: '', sourceTurnId: '', taskGoal: '' });
    }, /Missing required field/);
  });

  // Summary
  console.log('\n====================================================');
  console.log(`[RESULTS] ${passedTests} passed, ${failedTests} failed.`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
})();
