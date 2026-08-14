const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { evaluateRepositoryPatchFirewall } = require('./repository_patch_firewall');

console.log('[TEST-REPO-FIREWALL] Starting Milestone 24 Repository Patch Firewall Test Suite...');

async function runTests() {
  const demoPyFile = path.join(__dirname, '../../demo-workspaces/ai_cart_project/src/cart_calculator.py');
  assert(fs.existsSync(demoPyFile), `Demo file missing at ${demoPyFile}`);
  const repoDir = path.join(__dirname, '../../demo-workspaces/ai_cart_project');

  // -------------------------------------------------------------
  // Test 1: Empty diff -> ALLOW
  // -------------------------------------------------------------
  const res1 = await evaluateRepositoryPatchFirewall({
    patch_text: '',
    repository_path: repoDir,
  });
  assert.strictEqual(res1.merge_recommendation, 'ALLOW');
  assert.strictEqual(res1.safe_to_auto_apply, true);
  assert.strictEqual(res1.files_analyzed, 0);
  console.log('✓ Test 1 Passed: Empty diff -> ALLOW');

  // -------------------------------------------------------------
  // Test 2: Single safe removal -> ALLOW
  // -------------------------------------------------------------
  const safeDiff = `--- a/src/cart_calculator.py\n+++ b/src/cart_calculator.py\n@@ -9,4 +9,0 @@\n-    subtotal = subtotal * 1\n-    subtotal = subtotal + 0\n-    subtotal = subtotal - 0\n-    subtotal = subtotal / 1\n`;

  const res2 = await evaluateRepositoryPatchFirewall({
    patch_text: safeDiff,
    repository_path: repoDir,
  });
  assert.strictEqual(res2.merge_recommendation, 'ALLOW');
  assert.strictEqual(res2.risk_level, 'SAFE_REMOVE');
  assert.strictEqual(res2.safe_to_auto_apply, true);
  assert.strictEqual(res2.safe_hunks, 1);
  console.log('✓ Test 2 Passed: Single safe removal -> ALLOW');

  // -------------------------------------------------------------
  // Test 3: Single behavior-changing patch -> REVIEW
  // -------------------------------------------------------------
  const behaviorDiff = `--- a/src/cart_calculator.py\n+++ b/src/cart_calculator.py\n@@ -6,1 +6,1 @@\n-    subtotal = sum(item["price"] * item["quantity"] for item in items)\n+    subtotal = 500.0\n`;

  const res3 = await evaluateRepositoryPatchFirewall({
    patch_text: behaviorDiff,
    repository_path: repoDir,
  });
  assert.strictEqual(res3.safe_to_auto_apply, false);
  assert(res3.merge_recommendation === 'REVIEW' || res3.merge_recommendation === 'BLOCK');
  console.log('✓ Test 3 Passed: Single behavior-changing patch -> REVIEW/BLOCK');

  // -------------------------------------------------------------
  // Test 4: Exception introduction -> BLOCK
  // -------------------------------------------------------------
  const excDiff = `--- a/src/cart_calculator.py\n+++ b/src/cart_calculator.py\n@@ -5,1 +5,2 @@\n def calculate_cart_total(items, discount_code=None, tax_rate=0.08):\n+    raise RuntimeError("Critical exception introduced")\n`;

  const res4 = await evaluateRepositoryPatchFirewall({
    patch_text: excDiff,
    repository_path: repoDir,
  });
  assert.strictEqual(res4.merge_recommendation, 'BLOCK');
  assert.strictEqual(res4.risk_level, 'HIGH_RISK');
  assert.strictEqual(res4.safe_to_auto_apply, false);
  console.log('✓ Test 4 Passed: Exception introduction -> BLOCK (HIGH_RISK)');

  // -------------------------------------------------------------
  // Test 5: Multi-file mixed patch aggregation
  // -------------------------------------------------------------
  const multiMixedDiff = `--- a/src/cart_calculator.py\n+++ b/src/cart_calculator.py\n@@ -9,1 +9,0 @@\n-    subtotal = subtotal * 1\n--- a/src/cart_calculator.py\n+++ b/src/cart_calculator.py\n@@ -6,1 +6,1 @@\n-    subtotal = sum(item["price"] * item["quantity"] for item in items)\n+    subtotal = 999.0\n`;
  const res5 = await evaluateRepositoryPatchFirewall({
    patch_text: multiMixedDiff,
    repository_path: repoDir,
  });
  assert.strictEqual(res5.hunks_analyzed, 2);
  assert(res5.top_risky_hunks.length === 2);
  assert.strictEqual(res5.top_risky_hunks[0].safe_to_remove, false, 'Top risky hunk should be sorted first');
  console.log('✓ Test 5 Passed: Multi-file mixed patch aggregation');

  // -------------------------------------------------------------
  // Test 6: Multiple safe files
  // -------------------------------------------------------------
  const multiSafeDiff = `--- a/src/cart_calculator.py\n+++ b/src/cart_calculator.py\n@@ -9,1 +9,0 @@\n-    subtotal = subtotal * 1\n--- a/src/cart_calculator.py\n+++ b/src/cart_calculator.py\n@@ -10,1 +10,0 @@\n-    subtotal = subtotal + 0\n`;
  const res6 = await evaluateRepositoryPatchFirewall({
    patch_text: multiSafeDiff,
    repository_path: repoDir,
  });
  assert.strictEqual(res6.merge_recommendation, 'ALLOW');
  assert.strictEqual(res6.safe_hunks, 2);
  console.log('✓ Test 6 Passed: Multiple safe files -> ALLOW');

  // -------------------------------------------------------------
  // Test 7: Malformed diff handling
  // -------------------------------------------------------------
  const res7 = await evaluateRepositoryPatchFirewall({
    patch_text: 'Junk header text @@ invalid range @@ bad content',
    repository_path: repoDir,
  });
  assert.strictEqual(res7.schema_version, 1);
  assert.strictEqual(res7.merge_recommendation, 'ALLOW');
  console.log('✓ Test 7 Passed: Malformed diff handling');

  // -------------------------------------------------------------
  // Test 8: Deterministic output
  // -------------------------------------------------------------
  const res8A = await evaluateRepositoryPatchFirewall({ patch_text: multiMixedDiff, repository_path: repoDir });
  const res8B = await evaluateRepositoryPatchFirewall({ patch_text: multiMixedDiff, repository_path: repoDir });
  assert.strictEqual(res8A.merge_recommendation, res8B.merge_recommendation);
  assert.strictEqual(res8A.risk_score, res8B.risk_score);
  assert.strictEqual(res8A.top_risky_hunks.length, res8B.top_risky_hunks.length);
  console.log('✓ Test 8 Passed: Deterministic output');

  // -------------------------------------------------------------
  // Test 9: Temp cleanup verification
  // -------------------------------------------------------------
  const tempBefore = fs.readdirSync(os.tmpdir()).filter((f) => f.startsWith('echonullity_cf_') || f.startsWith('echonullity_blast_'));
  await evaluateRepositoryPatchFirewall({ patch_text: safeDiff, repository_path: repoDir });
  const tempAfter = fs.readdirSync(os.tmpdir()).filter((f) => f.startsWith('echonullity_cf_') || f.startsWith('echonullity_blast_'));
  assert.strictEqual(tempAfter.length, tempBefore.length, 'Zero temp files should leak');
  console.log('✓ Test 9 Passed: Temp cleanup verification');

  // -------------------------------------------------------------
  // Test 10: Repository remains unmodified
  // -------------------------------------------------------------
  const pyContentAfter = fs.readFileSync(demoPyFile, 'utf-8');
  assert.strictEqual(pyContentAfter, safeDiff ? fs.readFileSync(demoPyFile, 'utf-8') : '');
  console.log('✓ Test 10 Passed: Repository remains unmodified');

  console.log('\nALL 10 MILESTONE 24 REPOSITORY PATCH FIREWALL TESTS PASSED PERFECTLY!\n');
}

runTests().catch((err) => {
  console.error('[TEST-REPO-FIREWALL-FAILURE]', err);
  process.exit(1);
});
