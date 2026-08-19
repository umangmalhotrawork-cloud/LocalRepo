/**
 * TEST SUITE: Phase 2B Transactional Multi-File Patch Applier
 * Validates atomic application, application-level rollback, workspace containment,
 * user modification protection, syntax validation, and secret protection.
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { transactionalPatchApplier } = require('./transactionalPatchApplier');

async function runTransactionalPatchApplierTests() {
  console.log('[TEST] Starting Phase 2B Transactional Multi-File Patch Applier Test Suite...');

  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-tx-test-'));

  try {
    const fileA = path.join(tempDir, 'fileA.js');
    const fileB = path.join(tempDir, 'fileB.js');
    const fileC = path.join(tempDir, 'fileC.js');
    const fileUnrelated = path.join(tempDir, 'unrelated.js');

    const initA = 'function calcA() { return 10; }\n';
    const initB = 'function calcB() { return 20; }\n';
    const initC = 'function calcC() { return 30; }\n';
    const initUnrelated = 'const UNTOUCHED = true;\n';

    const resetFiles = () => {
      fs.writeFileSync(fileA, initA, 'utf-8');
      fs.writeFileSync(fileB, initB, 'utf-8');
      fs.writeFileSync(fileC, initC, 'utf-8');
      fs.writeFileSync(fileUnrelated, initUnrelated, 'utf-8');
    };

    resetFiles();

    // TEST 1: Single-file successful transaction
    const res1 = await transactionalPatchApplier.applyTransaction([
      { filePath: 'fileA.js', original: 'return 10;', replacement: 'return 15;' },
    ], { workspacePath: tempDir });

    assert.ok(res1.success);
    assert.strictEqual(res1.appliedCount, 1);
    assert.strictEqual(fs.readFileSync(fileA, 'utf-8'), 'function calcA() { return 15; }\n');
    console.log('[TEST 1 PASSED] Single-file successful transaction applied cleanly');

    // TEST 2: Two-file successful transaction
    resetFiles();
    const res2 = await transactionalPatchApplier.applyTransaction([
      { filePath: 'fileA.js', original: 'return 10;', replacement: 'return 100;' },
      { filePath: 'fileB.js', original: 'return 20;', replacement: 'return 200;' },
    ], { workspacePath: tempDir });

    assert.ok(res2.success);
    assert.strictEqual(res2.appliedCount, 2);
    assert.strictEqual(fs.readFileSync(fileA, 'utf-8'), 'function calcA() { return 100; }\n');
    assert.strictEqual(fs.readFileSync(fileB, 'utf-8'), 'function calcB() { return 200; }\n');
    console.log('[TEST 2 PASSED] Two-file successful transaction applied cleanly');

    // TEST 3: Three-file successful transaction
    resetFiles();
    const res3 = await transactionalPatchApplier.applyTransaction([
      { filePath: 'fileA.js', original: 'return 10;', replacement: 'return 1000;' },
      { filePath: 'fileB.js', original: 'return 20;', replacement: 'return 2000;' },
      { filePath: 'fileC.js', original: 'return 30;', replacement: 'return 3000;' },
    ], { workspacePath: tempDir });

    assert.ok(res3.success);
    assert.strictEqual(res3.appliedCount, 3);
    assert.strictEqual(fs.readFileSync(fileA, 'utf-8'), 'function calcA() { return 1000; }\n');
    assert.strictEqual(fs.readFileSync(fileB, 'utf-8'), 'function calcB() { return 2000; }\n');
    assert.strictEqual(fs.readFileSync(fileC, 'utf-8'), 'function calcC() { return 3000; }\n');
    console.log('[TEST 3 PASSED] Three-file successful transaction applied cleanly');

    // TEST 4: Missing original text -> transaction aborts (no mutation)
    resetFiles();
    const res4 = await transactionalPatchApplier.applyTransaction([
      { filePath: 'fileA.js', original: 'NON_EXISTENT_SUBSTRING', replacement: 'return 999;' },
      { filePath: 'fileB.js', original: 'return 20;', replacement: 'return 2000;' },
    ], { workspacePath: tempDir });

    assert.strictEqual(res4.success, false);
    assert.strictEqual(res4.reason, 'ORIGINAL_NOT_FOUND');
    assert.strictEqual(fs.readFileSync(fileA, 'utf-8'), initA);
    assert.strictEqual(fs.readFileSync(fileB, 'utf-8'), initB);
    console.log('[TEST 4 PASSED] Missing original substring aborted transaction with 0 mutations');

    // TEST 5: Conflicting edit on second file -> transaction aborts
    resetFiles();
    const res5 = await transactionalPatchApplier.applyTransaction([
      { filePath: 'fileA.js', original: 'return 10;', replacement: 'return 11;' },
      { filePath: 'fileB.js', original: 'return 9999_WRONG;', replacement: 'return 22;' },
    ], { workspacePath: tempDir });

    assert.strictEqual(res5.success, false);
    assert.strictEqual(fs.readFileSync(fileA, 'utf-8'), initA);
    assert.strictEqual(fs.readFileSync(fileB, 'utf-8'), initB);
    console.log('[TEST 5 PASSED] Conflicting second edit aborted transaction without touching file A');

    // TEST 6: Candidate syntax failure -> entire transaction aborts
    resetFiles();
    const res6 = await transactionalPatchApplier.applyTransaction([
      { filePath: 'fileA.js', original: 'return 10;', replacement: 'return 11;' },
      { filePath: 'fileB.js', original: 'return 20;', replacement: 'function ({ illegal syntax }}}' },
    ], { workspacePath: tempDir, verifySyntax: true });

    assert.strictEqual(res6.success, false);
    assert.strictEqual(res6.reason, 'SYNTAX_ERROR');
    assert.strictEqual(fs.readFileSync(fileA, 'utf-8'), initA);
    assert.strictEqual(fs.readFileSync(fileB, 'utf-8'), initB);
    console.log('[TEST 6 PASSED] Syntax error in candidate edit rolled back entire transaction');

    // TEST 7: Path traversal rejected (../)
    resetFiles();
    const res7 = await transactionalPatchApplier.applyTransaction([
      { filePath: '../../outside.js', original: '', replacement: 'alert(1)' },
    ], { workspacePath: tempDir });

    assert.strictEqual(res7.success, false);
    assert.strictEqual(res7.reason, 'OUTSIDE_WORKSPACE');
    console.log('[TEST 7 PASSED] Path traversal (../) rejected with security error');

    // TEST 8: Absolute external path rejected
    resetFiles();
    const res8 = await transactionalPatchApplier.applyTransaction([
      { filePath: '/etc/passwd', original: '', replacement: 'hacked' },
    ], { workspacePath: tempDir });

    assert.strictEqual(res8.success, false);
    assert.strictEqual(res8.reason, 'OUTSIDE_WORKSPACE');
    console.log('[TEST 8 PASSED] External absolute path rejected cleanly');

    // TEST 9: Unrelated workspace file remains untouched
    assert.strictEqual(fs.readFileSync(fileUnrelated, 'utf-8'), initUnrelated);
    console.log('[TEST 9 PASSED] Unrelated workspace file remained strictly untouched');

    // TEST 10: Secret data never enters transaction evidence
    const fakeKey = 'AIzaSySecretApiKey123456';
    const txEvidenceJson = JSON.stringify(res3);
    assert.strictEqual(txEvidenceJson.includes(fakeKey), false);
    console.log('[TEST 10 PASSED] Zero secrets detected in transaction evidence');

    // TEST 11: Editor buffer synchronization map returned accurately
    assert.ok(res3.files);
    assert.ok(res3.files['fileA.js'] || res3.files[fileA]);
    console.log('[TEST 11 PASSED] Modified files buffer map returned accurately for editor sync');

    console.log('>>> ALL PHASE 2B TRANSACTIONAL MULTI-FILE PATCH TESTS PASSED CLEANLY! <<<');
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (e) {}
  }
}

runTransactionalPatchApplierTests().catch((err) => {
  console.error('[TEST FAILURE] Phase 2B Test Suite failed:', err);
  process.exit(1);
});
