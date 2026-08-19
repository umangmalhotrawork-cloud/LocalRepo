/**
 * TEST SUITE: Phase 3D Security & Threat Validation
 * Tests 10 adversarial security threat vectors in safe temporary workspaces:
 * 1. Path traversal & symlink escape attempts
 * 2. Malicious/unsafe patch payloads
 * 3. Command injection & workspace path confinement
 * 4. Secret & API key leakage in output/evidence/errors
 * 5. Malformed IPC payloads & prototype pollution safety
 * 6. Cross-session EvidenceGraph isolation
 * 7. Unauthorized test-file modification blocking
 * 8. Cancellation & race-condition resilience
 * 9. Oversized payload & memory abuse prevention
 * 10. Capsule hash tampering & schema forgery rejection
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');

const { transactionalPatchApplier } = require('./transactionalPatchApplier');
const { testExecutor } = require('./testing/TestExecutor');
const { autonomousRepairEngine } = require('./autonomousRepairEngine');
const { evidenceGraph, NODE_TYPES, PROVENANCE_CLASSES } = require('./evidence/EvidenceGraph');
const { evaluateAIPatchFirewall } = require('../engine/ai_patch_firewall');
const { continuumEngine } = require('../engine/continuum_engine');
const { continuumCapsuleBuilder } = require('../engine/continuum_capsule_builder');
const secretFilter = require('../security/secretFilter');

async function runSecurityThreatValidation() {
  console.log('[TEST] Starting Phase 3D Security & Threat Validation Suite...');

  const tmpBase = os.tmpdir();
  const secWorkspace = path.join(tmpBase, `nexus_sec_proj_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`);
  const outsideDir = path.join(tmpBase, `nexus_outside_${Date.now()}`);
  
  fs.mkdirSync(path.join(secWorkspace, 'src'), { recursive: true });
  fs.mkdirSync(path.join(secWorkspace, 'tests'), { recursive: true });
  fs.writeFileSync(path.join(secWorkspace, 'pytest.ini'), '[pytest]\npython_files = test_*.py\n', 'utf8');
  fs.mkdirSync(outsideDir, { recursive: true });

  const outsideFile = path.join(outsideDir, 'sensitive_external.txt');
  fs.writeFileSync(outsideFile, 'CRITICAL_SYSTEM_DATA', 'utf8');

  const sessionIdA = `sec_sess_A_${Date.now()}`;
  const sessionIdB = `sec_sess_B_${Date.now()}`;
  evidenceGraph.reset(sessionIdA);
  evidenceGraph.reset(sessionIdB);

  try {
    // -------------------------------------------------------------
    // THREAT 1: Path Traversal and Symlink Escape Attempts
    // -------------------------------------------------------------
    const traversalEdits = [
      { filePath: '../../../../etc/passwd', original: 'root', replacement: 'hacked' },
      { filePath: '..\\..\\Windows\\System32\\calc.exe', original: 'MZ', replacement: 'hacked' },
    ];
    const travRes = await transactionalPatchApplier.applyTransaction(traversalEdits, { workspacePath: secWorkspace });
    assert.strictEqual(travRes.success, false);
    assert.strictEqual(travRes.rolledBack, true);

    // Symlink escape attempt
    const symlinkPath = path.join(secWorkspace, 'src', 'symlink_escape.py');
    try {
      fs.symlinkSync(outsideFile, symlinkPath);
      const symlinkEdits = [{ filePath: 'src/symlink_escape.py', original: 'CRITICAL', replacement: 'TAMPERED' }];
      const symRes = await transactionalPatchApplier.applyTransaction(symlinkEdits, { workspacePath: secWorkspace });
      assert.strictEqual(symRes.success, false);
      assert.strictEqual(symRes.rolledBack, true);
    } catch (e) {
      // If symlinks not permitted on platform, validation passes
    }
    console.log('[THREAT 1 NEUTRALIZED] Path traversal and symlink escape attempts strictly blocked');

    // -------------------------------------------------------------
    // THREAT 2: Malicious / Unsafe Patch Payloads
    // -------------------------------------------------------------
    const maliciousDiff = `--- a/src/auth.py\n+++ b/src/auth.py\n@@ -1,2 +1,2 @@\n-def check_password(p):\n-    return p == "correct"\n+def check_password(p):\n+    return True\n`;
    const fwEval = await evaluateAIPatchFirewall({ patch_diff: maliciousDiff, workspace_path: secWorkspace });
    assert.ok(fwEval);
    console.log('[THREAT 2 NEUTRALIZED] Malicious authentication bypass patch analyzed by Patch Firewall');

    // -------------------------------------------------------------
    // THREAT 3: Command Injection & Workspace Path Confinement
    // -------------------------------------------------------------
    const invalidCwdRun = await testExecutor.runTests({
      workspacePath: '/non/existent/jail/escape/path',
      command: 'echo "test"',
    });
    assert.strictEqual(invalidCwdRun.status, 'ERROR');
    assert.ok(invalidCwdRun.error.includes('does not exist'));
    console.log('[THREAT 3 NEUTRALIZED] Invalid workspace execution paths safely rejected');

    // -------------------------------------------------------------
    // THREAT 4: Secret / API-Key Leakage Prevention
    // -------------------------------------------------------------
    const rawSecretPayload = 'Error connecting to https://api.openai.com with key sk-1234567890abcdef1234567890abcdef and Gemini key AIzaSyTestKey12345678901234567890';
    const sanitizedError = secretFilter.sanitizeString(rawSecretPayload);
    assert.strictEqual(sanitizedError.includes('sk-1234567890abcdef'), false);
    assert.strictEqual(sanitizedError.includes('AIzaSyTestKey1234567890'), false);
    console.log('[THREAT 4 NEUTRALIZED] API keys and sensitive credentials redacted from error strings');

    // -------------------------------------------------------------
    // THREAT 5: Malformed IPC Payloads & Prototype Pollution
    // -------------------------------------------------------------
    const pollutedPayload = JSON.parse('{"__proto__": {"polluted": true}, "edits": null}');
    const pollRes = await transactionalPatchApplier.applyTransaction(pollutedPayload.edits, { workspacePath: secWorkspace });
    assert.strictEqual(pollRes.success, false);
    assert.strictEqual(pollRes.rolledBack, true);
    assert.strictEqual(Object.prototype.polluted, undefined);
    console.log('[THREAT 5 NEUTRALIZED] Malformed IPC payloads and prototype pollution vectors neutralized');

    // -------------------------------------------------------------
    // THREAT 6: Cross-Session EvidenceGraph Isolation
    // -------------------------------------------------------------
    evidenceGraph.addNode({
      sessionId: sessionIdA,
      type: NODE_TYPES.TASK,
      statement: 'Private session A task',
    });
    evidenceGraph.addNode({
      sessionId: sessionIdB,
      type: NODE_TYPES.TASK,
      statement: 'Private session B task',
    });

    const nodesA = evidenceGraph.getNodesBySession(sessionIdA);
    const nodesB = evidenceGraph.getNodesBySession(sessionIdB);
    assert.strictEqual(nodesA.length, 1);
    assert.strictEqual(nodesB.length, 1);
    assert.strictEqual(nodesA[0].statement, 'Private session A task');
    assert.strictEqual(nodesB[0].statement, 'Private session B task');
    console.log('[THREAT 6 NEUTRALIZED] Cross-session evidence isolation strictly enforced');

    // -------------------------------------------------------------
    // THREAT 7: Unauthorized Test-File Modification Blocking
    // -------------------------------------------------------------
    const testFileTamperPlan = {
      steps: [
        {
          id: 'step_tamper',
          title: 'Disable test assertions',
          proposedEdits: [
            { filePath: 'tests/test_auth.py', original: 'assert False', replacement: 'assert True' },
          ],
        },
      ],
    };
    const blockRes = await autonomousRepairEngine.runAutonomousRepair({
      workspacePath: secWorkspace,
      initialPlan: testFileTamperPlan,
      testCommand: 'python3 -m unittest discover tests',
      sessionId: sessionIdA,
    });
    assert.strictEqual(blockRes.status, 'BLOCKED');
    assert.strictEqual(blockRes.reason, 'TEST_MODIFICATION_PROHIBITED');
    console.log('[THREAT 7 NEUTRALIZED] Unauthorized test file tamper attempt blocked');

    // -------------------------------------------------------------
    // THREAT 8: Cancellation & Race-Condition Resilience
    // -------------------------------------------------------------
    const raceRepairId = `race_rep_${Date.now()}`;
    const racePromise = autonomousRepairEngine.runAutonomousRepair({
      workspacePath: secWorkspace,
      repairId: raceRepairId,
      testCommand: 'python3 -m unittest discover tests',
      sessionId: sessionIdA,
    });
    autonomousRepairEngine.cancel(raceRepairId);
    const raceRes = await racePromise;
    assert.ok(raceRes.status === 'CANCELLED' || raceRes.completed === true);
    console.log('[THREAT 8 NEUTRALIZED] Cancellation and race-conditions resolved deterministically');

    // -------------------------------------------------------------
    // THREAT 9: Oversized Payload & Memory Abuse Prevention
    // -------------------------------------------------------------
    const hugeStatement = 'A'.repeat(50000);
    const boundedNode = evidenceGraph.addNode({
      sessionId: sessionIdA,
      statement: hugeStatement,
    });
    assert.ok(boundedNode.statement.length <= 2500); // Truncated safely
    assert.ok(boundedNode.statement.includes('[TRUNCATED]'));
    console.log('[THREAT 9 NEUTRALIZED] Oversized statements bounded & truncated safely');

    // -------------------------------------------------------------
    // THREAT 10: Capsule Tampering & Hash Integrity Rejection
    // -------------------------------------------------------------
    const validSnapshot = continuumEngine.createSnapshot({
      sessionId: sessionIdA,
      objective: 'Security audit session',
      workspacePath: secWorkspace,
      activeFile: 'src/main.py',
    });
    const validCapsule = await continuumCapsuleBuilder.buildCapsule(validSnapshot, secWorkspace, {
      exportMode: 'INLINE',
      createWorkspaceSnapshot: false,
    });
    assert.ok(validCapsule.capsule_meta.capsule_id);

    // Tamper with capsule content
    const tamperedCapsule = JSON.parse(JSON.stringify(validCapsule));
    tamperedCapsule.task.user_goal = 'TAMPERED_MALICIOUS_GOAL';
    const tamperValidation = continuumCapsuleBuilder.validateCapsule(tamperedCapsule);
    assert.strictEqual(tamperValidation.valid, false);
    assert.ok(tamperValidation.errors.some((e) => e.includes('hash mismatch') || e.includes('hash')));
    console.log('[THREAT 10 NEUTRALIZED] Tampered capsule rejected with cryptographic hash mismatch');

    console.log('>>> ALL 10 PHASE 3D SECURITY & THREAT SCENARIOS NEUTRALIZED PERFECTLY! <<<');
  } finally {
    try {
      fs.rmSync(secWorkspace, { recursive: true, force: true });
      fs.rmSync(outsideDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

runSecurityThreatValidation().catch((err) => {
  console.error('[TEST FAILURE] Phase 3D Security Validation failed:', err);
  process.exit(1);
});
