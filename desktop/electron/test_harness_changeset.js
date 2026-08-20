/**
 * NEXUS CODEX HARNESS - CHANGE SET TEST SUITE (Milestone 7)
 * Tests multi-file atomic ChangeSets, aggregated firewall safety evaluations,
 * single-dialog approval transitions, atomic apply, rollback on failure,
 * verification, persistence, event ordering, and secret filtering.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const {
  HarnessRuntime,
  ChangeSet,
  CHANGESET_STATUS,
  ITEM_TYPES,
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
console.log('[TEST] Starting NEXUS Codex Harness ChangeSet Suite (Milestone 7)...');
console.log('====================================================\n');

// Setup temporary test workspace
const tmpDir = path.join(os.tmpdir(), `nexus_cs_test_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`);
fs.mkdirSync(tmpDir, { recursive: true });

const fileA = path.join(tmpDir, 'auth.ts');
const fileB = path.join(tmpDir, 'middleware.ts');
const fileC = path.join(tmpDir, 'session.ts');

fs.writeFileSync(fileA, 'export function login(user: string) {\n  return "logged_in_" + user;\n}\n');
fs.writeFileSync(fileB, 'export function authMiddleware(req: any) {\n  return req.headers.token ? true : false;\n}\n');
fs.writeFileSync(fileC, 'export function getSession(id: string) {\n  return { id, active: true };\n}\n');

(async () => {
  // Test 1: Single-file ChangeSet
  test('Test 1: Single-file ChangeSet Creation and Structure', () => {
    const cs = new ChangeSet({
      threadId: 'thread_101',
      turnId: 'turn_101',
      intent: 'MUTATION',
    });

    assert.ok(cs.changeSetId.startsWith('cs_'));
    assert.strictEqual(cs.threadId, 'thread_101');
    assert.strictEqual(cs.turnId, 'turn_101');
    assert.strictEqual(cs.status, CHANGESET_STATUS.PROPOSED);
    assert.strictEqual(cs.files.length, 0);

    cs.addFile({
      filePath: 'auth.ts',
      original: 'return "logged_in_" + user;',
      replacement: 'return "authenticated_" + user;',
    });

    assert.strictEqual(cs.files.length, 1);
    assert.strictEqual(cs.files[0].filePath, 'auth.ts');
    assert.strictEqual(cs.files[0].changeType, 'MODIFY');
    assert.strictEqual(cs.files[0].applyStatus, 'PENDING');
  });

  // Test 2: Multi-file ChangeSet
  test('Test 2: Multi-file ChangeSet with Grouped Files', () => {
    const cs = new ChangeSet({
      threadId: 'thread_102',
      turnId: 'turn_102',
      intent: 'REFACTOR',
      files: [
        { filePath: 'auth.ts', original: 'return "logged_in_" + user;', replacement: 'return "token_" + user;' },
        { filePath: 'middleware.ts', original: 'return req.headers.token ? true : false;', replacement: 'return Boolean(req.headers.token);' },
        { filePath: 'session.ts', original: 'active: true', replacement: 'active: true, v: 2' },
      ],
    });

    assert.strictEqual(cs.files.length, 3);
    assert.strictEqual(cs.risk.filesAffected, 3);
    assert.strictEqual(cs.files[0].filePath, 'auth.ts');
    assert.strictEqual(cs.files[1].filePath, 'middleware.ts');
    assert.strictEqual(cs.files[2].filePath, 'session.ts');
  });

  // Test 3: Grouped Edits Addition and Deduplication
  test('Test 3: Grouped Edits Normalization and Replacement', () => {
    const cs = new ChangeSet({ threadId: 'thread_103' });
    cs.addFile({ filePath: 'auth.ts', original: 'orig1', replacement: 'repl1' });
    cs.addFile({ filePath: 'session.ts', original: 'orig2', replacement: 'repl2' });
    // Overwriting auth.ts edit in same ChangeSet
    cs.addFile({ filePath: 'auth.ts', original: 'orig1_updated', replacement: 'repl1_updated' });

    assert.strictEqual(cs.files.length, 2);
    const authEntry = cs.files.find((f) => f.filePath === 'auth.ts');
    assert.strictEqual(authEntry.original, 'orig1_updated');
    assert.strictEqual(authEntry.replacement, 'repl1_updated');
  });

  // Test 4: Aggregated Firewall Result
  await asyncTest('Test 4: Aggregated Multi-File Firewall Evaluation', async () => {
    const cs = new ChangeSet({
      threadId: 'thread_104',
      files: [
        { filePath: 'auth.ts', original: 'return "logged_in_" + user;', replacement: 'return "auth_" + user;' },
        { filePath: 'middleware.ts', original: 'return req.headers.token ? true : false;', replacement: 'return Boolean(req.headers.token);' },
      ],
    });

    const risk = await cs.evaluateSafety({ workspacePath: tmpDir });
    assert.ok(risk.overallRiskLevel);
    assert.strictEqual(typeof risk.riskScore, 'number');
    assert.strictEqual(risk.filesAffected, 2);
    assert.strictEqual(typeof risk.safeToAutoApply, 'boolean');
    assert.strictEqual(typeof risk.approvalRequired, 'boolean');
    assert.ok(Array.isArray(risk.blockedFiles));
    assert.ok(cs.files[0].firewallResult !== null);
  });

  // Test 5: Semantic Intent Drift Aggregation
  await asyncTest('Test 5: Semantic Intent Drift Aggregation within ChangeSet', async () => {
    const cs = new ChangeSet({
      threadId: 'thread_105',
      files: [
        {
          filePath: 'calculator.py',
          original: 'def calc(tax, discount):\n  subtotal = price - discount\n  return subtotal + tax',
          // Altering business rule order
          replacement: 'def calc(tax, discount):\n  subtotal = price + tax\n  return subtotal - discount',
        },
      ],
    });

    const risk = await cs.evaluateSafety({ workspacePath: tmpDir });
    assert.ok(cs.files[0].intentDriftResult);
    assert.ok(['HIGH', 'MEDIUM', 'LOW', 'NONE'].includes(cs.files[0].intentDriftResult.drift_level));
  });

  // Test 6: Approval-Required State
  await asyncTest('Test 6: Approval-Required State Transition', async () => {
    const cs = new ChangeSet({
      threadId: 'thread_106',
      files: [
        { filePath: 'auth.ts', original: 'a', replacement: 'b' },
      ],
    });

    await cs.evaluateSafety({ workspacePath: tmpDir, strictApproval: true });
    assert.strictEqual(cs.status, CHANGESET_STATUS.APPROVAL_REQUIRED);
    assert.strictEqual(cs.approvalState.required, true);
    assert.strictEqual(cs.approvalState.status, 'PENDING');
  });

  // Test 7: Approval Transition (Single Unified Approval)
  test('Test 7: Single Aggregated User Approval Decision', () => {
    const cs = new ChangeSet({
      threadId: 'thread_107',
      status: CHANGESET_STATUS.APPROVAL_REQUIRED,
      approvalState: { required: true, status: 'PENDING' },
    });

    const approvalDecision = cs.approve({
      approvedBy: 'lead_developer',
      reason: 'Verified multi-file refactoring plan',
    });

    assert.strictEqual(cs.status, CHANGESET_STATUS.APPROVED);
    assert.strictEqual(cs.approvalState.status, 'APPROVED');
    assert.strictEqual(cs.approvalState.approvedBy, 'lead_developer');
    assert.strictEqual(approvalDecision.status, 'APPROVED');
  });

  // Test 8: Atomic Apply via TransactionalPatchApplier
  await asyncTest('Test 8: Atomic Apply across Multiple Files', async () => {
    const cs = new ChangeSet({
      threadId: 'thread_108',
      files: [
        {
          filePath: 'auth.ts',
          original: 'return "logged_in_" + user;',
          replacement: 'return "authenticated_user_" + user;',
        },
        {
          filePath: 'session.ts',
          original: 'active: true',
          replacement: 'active: true, authenticated: true',
        },
      ],
    });

    cs.approve({ approvedBy: 'user' });
    const result = await cs.apply({ workspacePath: tmpDir });

    assert.strictEqual(result.success, true);
    assert.strictEqual(cs.status, CHANGESET_STATUS.APPLIED);
    assert.strictEqual(cs.files[0].applyStatus, 'APPLIED');
    assert.strictEqual(cs.files[1].applyStatus, 'APPLIED');

    // Verify disk content
    const authContent = fs.readFileSync(fileA, 'utf-8');
    const sessionContent = fs.readFileSync(fileC, 'utf-8');
    assert.ok(authContent.includes('authenticated_user_'));
    assert.ok(sessionContent.includes('authenticated: true'));
  });

  // Test 9: Rollback on Single-File Conflict / Failure
  await asyncTest('Test 9: Rollback on Single File Conflict in Multi-file ChangeSet', async () => {
    const origAuthContent = fs.readFileSync(fileA, 'utf-8');
    const origMiddlewareContent = fs.readFileSync(fileB, 'utf-8');

    const cs = new ChangeSet({
      threadId: 'thread_109',
      files: [
        {
          filePath: 'auth.ts',
          original: 'authenticated_user_',
          replacement: 'v3_user_',
        },
        {
          filePath: 'middleware.ts',
          // Substring that does not exist in middleware.ts to force conflict
          original: 'NON_EXISTENT_SUBSTRING_XYZ_12345',
          replacement: 'new_middleware_content',
        },
      ],
    });

    cs.approve({ approvedBy: 'user' });
    const result = await cs.apply({ workspacePath: tmpDir });

    assert.strictEqual(result.success, false);
    assert.strictEqual(result.rolledBack, true);
    assert.strictEqual(cs.status, CHANGESET_STATUS.ROLLED_BACK);
    assert.strictEqual(cs.files[0].applyStatus, 'ROLLED_BACK');
    assert.strictEqual(cs.files[1].applyStatus, 'ROLLED_BACK');

    // Verify that NO files were modified (clean all-or-nothing rollback)
    assert.strictEqual(fs.readFileSync(fileA, 'utf-8'), origAuthContent);
    assert.strictEqual(fs.readFileSync(fileB, 'utf-8'), origMiddlewareContent);
  });

  // Test 10: Verification (Pass / Fail)
  await asyncTest('Test 10: ChangeSet Automated Verification', async () => {
    const cs = new ChangeSet({
      threadId: 'thread_110',
      status: CHANGESET_STATUS.APPLIED,
    });

    // Verification Success
    const verifySuccess = await cs.verify(async () => ({ success: true, passed: 5, failed: 0 }));
    assert.strictEqual(verifySuccess.success, true);
    assert.strictEqual(cs.status, CHANGESET_STATUS.VERIFIED);
    assert.strictEqual(cs.verification.testsPassed, 5);

    // Verification Failure
    const verifyFail = await cs.verify(async () => ({ success: false, passed: 4, failed: 1 }));
    assert.strictEqual(verifyFail.success, false);
    assert.strictEqual(cs.status, CHANGESET_STATUS.FAILED);
    assert.strictEqual(cs.verification.testsFailed, 1);
  });

  // Test 11: ChangeSet Persistence & Deserialization
  test('Test 11: ChangeSet Serialization and Deserialization', () => {
    const cs = new ChangeSet({
      changeSetId: 'cs_persist_test',
      threadId: 'thread_111',
      turnId: 'turn_111',
      status: CHANGESET_STATUS.VERIFIED,
      files: [
        { filePath: 'auth.ts', original: 'a', replacement: 'b', applyStatus: 'APPLIED' },
      ],
      risk: { overallRiskLevel: 'SAFE_REMOVE', riskScore: 5 },
      verification: { status: 'PASSED', verified: true, testsPassed: 10, testsFailed: 0 },
    });

    const serialized = cs.toJSON();
    assert.strictEqual(serialized.changeSetId, 'cs_persist_test');
    assert.strictEqual(serialized.status, CHANGESET_STATUS.VERIFIED);

    const restored = ChangeSet.fromJSON(serialized);
    assert.strictEqual(restored.changeSetId, 'cs_persist_test');
    assert.strictEqual(restored.status, CHANGESET_STATUS.VERIFIED);
    assert.strictEqual(restored.files.length, 1);
    assert.strictEqual(restored.files[0].filePath, 'auth.ts');
    assert.strictEqual(restored.verification.testsPassed, 10);
  });

  // Test 12: ChangeSet Event Ordering on EventBus
  await asyncTest('Test 12: ChangeSet Lifecycle Event Ordering', async () => {
    const runtime = HarnessRuntime.createIsolated();
    const emittedEvents = [];

    runtime.subscribe((evt) => {
      if (evt.type.startsWith('CHANGE_SET_')) {
        emittedEvents.push(evt.type);
      }
    });

    const cs = runtime.createChangeSet({
      threadId: 'thread_112',
      turnId: 'turn_112',
      files: [
        { filePath: 'auth.ts', original: 'orig', replacement: 'repl' },
      ],
    });

    await cs.evaluateSafety({ workspacePath: tmpDir, strictApproval: true });
    cs.approve({ approvedBy: 'user' });
    await cs.apply({ workspacePath: tmpDir, applier: { applyTransaction: async () => ({ success: true, transactionId: 'tx_123', appliedCount: 1, modifiedFiles: [] }) } });
    await cs.verify(async () => ({ success: true }));

    assert.ok(emittedEvents.includes(EVENT_TYPES.CHANGE_SET_EVALUATING));
    assert.ok(emittedEvents.includes(EVENT_TYPES.CHANGE_SET_APPROVAL_REQUIRED));
    assert.ok(emittedEvents.includes(EVENT_TYPES.CHANGE_SET_APPROVED));
    assert.ok(emittedEvents.includes(EVENT_TYPES.CHANGE_SET_APPLIED));
    assert.ok(emittedEvents.includes(EVENT_TYPES.CHANGE_SET_VERIFIED));

    // Verify ordering
    const idxEval = emittedEvents.indexOf(EVENT_TYPES.CHANGE_SET_EVALUATING);
    const idxAppReq = emittedEvents.indexOf(EVENT_TYPES.CHANGE_SET_APPROVAL_REQUIRED);
    const idxApp = emittedEvents.indexOf(EVENT_TYPES.CHANGE_SET_APPROVED);
    const idxApplied = emittedEvents.indexOf(EVENT_TYPES.CHANGE_SET_APPLIED);
    const idxVer = emittedEvents.indexOf(EVENT_TYPES.CHANGE_SET_VERIFIED);

    assert.ok(idxEval < idxAppReq);
    assert.ok(idxAppReq < idxApp);
    assert.ok(idxApp < idxApplied);
    assert.ok(idxApplied < idxVer);
  });

  // Test 13: Secret Filtering
  test('Test 13: Secret Filtering on ChangeSet Fields', () => {
    const secretApiKey = 'sk-proj-abc1234567890abcdef1234567890';
    const cs = new ChangeSet({
      threadId: 'thread_113',
      metadata: { apiKey: secretApiKey },
      files: [
        {
          filePath: 'config.ts',
          original: 'const key = "old";',
          replacement: `const key = "${secretApiKey}";`,
        },
      ],
    });

    const json = cs.toJSON();
    const str = JSON.stringify(json);
    assert.ok(!str.includes(secretApiKey));
  });

  // Summary
  console.log('\n====================================================');
  console.log(`[RESULTS] ${passedTests} passed, ${failedTests} failed.`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
})();
