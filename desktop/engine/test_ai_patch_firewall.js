const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { evaluateAIPatchFirewall, parseUnifiedDiff } = require('./ai_patch_firewall');

console.log('[TEST-PATCH-FIREWALL] Starting Milestone 23 AI Patch Safety Firewall Test Suite...');

async function runTests() {
  const demoPyFile = path.join(__dirname, '../../demo-workspaces/ai_cart_project/src/cart_calculator.py');
  assert(fs.existsSync(demoPyFile), `Demo python file missing at ${demoPyFile}`);
  const origPySource = fs.readFileSync(demoPyFile, 'utf-8');

  // -------------------------------------------------------------
  // Test 1: Safe removal patch (cart_calculator.py lines 9-12)
  // -------------------------------------------------------------
  const sampleSafeDiff = `--- a/src/cart_calculator.py\n+++ b/src/cart_calculator.py\n@@ -9,4 +9,0 @@\n-    subtotal = subtotal * 1\n-    subtotal = subtotal + 0\n-    subtotal = subtotal - 0\n-    subtotal = subtotal / 1\n`;

  const res1 = await evaluateAIPatchFirewall({
    patch_text: sampleSafeDiff,
    file_path: demoPyFile,
  });
  assert.strictEqual(res1.risk_level, 'SAFE_REMOVE', 'Lines 9-12 removal should be classified as SAFE_REMOVE');
  assert.strictEqual(res1.safe_to_auto_apply, true, 'SAFE_REMOVE should have safe_to_auto_apply = true');
  assert.strictEqual(res1.risk_score, 0, 'Risk score should be 0 for SAFE_REMOVE');
  assert(res1.confidence >= 0.99, 'Confidence should be >= 0.99');
  console.log('✓ Test 1 Passed: Safe removal patch (lines 9-12 SAFE_REMOVE, confidence >= 0.99)');

  // -------------------------------------------------------------
  // Test 2: Behavior-changing patch
  // -------------------------------------------------------------
  const editedPySource2 = origPySource.replace(
    'subtotal = sum(item["price"] * item["quantity"] for item in items)',
    'subtotal = 100.0'
  );
  const res2 = await evaluateAIPatchFirewall({
    file_path: demoPyFile,
    edited_source: editedPySource2,
  });
  assert.notStrictEqual(res2.risk_level, 'SAFE_REMOVE', 'Behavior change should not be SAFE_REMOVE');
  assert.strictEqual(res2.safe_to_auto_apply, false, 'Behavior change should have safe_to_auto_apply = false');
  assert(res2.risk_score > 0, 'Risk score should be > 0');
  console.log('✓ Test 2 Passed: Behavior-changing patch detected');

  // -------------------------------------------------------------
  // Test 3: Multi-file patch parsing & evaluation
  // -------------------------------------------------------------
  const multiFileDiff = `--- a/src/cart_calculator.py\n+++ b/src/cart_calculator.py\n@@ -9,1 +9,0 @@\n-    subtotal = subtotal * 1\n--- a/src/cart_calculator.py\n+++ b/src/cart_calculator.py\n@@ -10,1 +10,0 @@\n-    subtotal = subtotal + 0\n`;
  const parsed3 = parseUnifiedDiff(multiFileDiff);
  assert(parsed3.length > 0, 'Should parse multi-file diff');
  const res3 = await evaluateAIPatchFirewall({
    patch_text: multiFileDiff,
    file_path: demoPyFile,
  });
  assert(res3.summary.changed_hunks >= 2, 'Should process multiple hunks');
  console.log('✓ Test 3 Passed: Multi-file patch parsing & evaluation');

  // -------------------------------------------------------------
  // Test 4: Exception introduction patch
  // -------------------------------------------------------------
  const editedPySource4 = origPySource.replace(
    'def calculate_cart_total(items, discount_code=None, tax_rate=0.08):',
    'def calculate_cart_total(items=None, discount_code=None, tax_rate=0.08):\n    raise RuntimeError("Forced exception")'
  );
  const res4 = await evaluateAIPatchFirewall({
    file_path: demoPyFile,
    edited_source: editedPySource4,
  });
  assert.strictEqual(res4.risk_level, 'HIGH_RISK', 'Exception introduction should be classified as HIGH_RISK');
  assert.strictEqual(res4.safe_to_auto_apply, false);
  console.log('✓ Test 4 Passed: Exception introduction patch detected (HIGH_RISK)');

  // -------------------------------------------------------------
  // Test 5: Exception removal patch
  // -------------------------------------------------------------
  const tempExcPy = path.join(os.tmpdir(), `test_firewall_exc_${Date.now()}.py`);
  const excPySource = `def check(x):\n    if x < 0:\n        raise ValueError("negative")\n    return x\n`;
  const noExcPySource = `def check(x):\n    return x\n`;
  fs.writeFileSync(tempExcPy, excPySource, 'utf-8');

  try {
    const res5 = await evaluateAIPatchFirewall({
      file_path: tempExcPy,
      edited_source: noExcPySource,
    });
    assert.strictEqual(res5.safe_to_auto_apply, false, 'Exception removal should require review');
    console.log('✓ Test 5 Passed: Exception removal patch detected');
  } finally {
    if (fs.existsSync(tempExcPy)) fs.unlinkSync(tempExcPy);
  }

  // -------------------------------------------------------------
  // Test 6: Blast radius propagation integration
  // -------------------------------------------------------------
  const mockGraph = {
    nodes: [
      { id: 'n1', symbol: 'calculate_cart_total', file: demoPyFile, kind: 'function', line: 1 },
      { id: 'n2', symbol: 'process_checkout', file: 'src/checkout.py', kind: 'function', line: 30 },
    ],
    edges: [{ source: 'n2', target: 'n1' }]
  };
  const res6 = await evaluateAIPatchFirewall({
    file_path: demoPyFile,
    edited_source: editedPySource2,
    workspace_graph: mockGraph,
  });
  assert(res6.summary.impacted_functions >= 1, 'Blast radius propagation should populate impacted_functions');
  console.log('✓ Test 6 Passed: Blast radius propagation integration');

  // -------------------------------------------------------------
  // Test 7: Empty diff handling
  // -------------------------------------------------------------
  const res7 = await evaluateAIPatchFirewall({
    patch_text: '',
  });
  assert.strictEqual(res7.risk_level, 'AUTO_APPROVE');
  assert.strictEqual(res7.safe_to_auto_apply, true);
  console.log('✓ Test 7 Passed: Empty diff handling (AUTO_APPROVE)');

  // -------------------------------------------------------------
  // Test 8: Malformed diff handling
  // -------------------------------------------------------------
  const res8 = await evaluateAIPatchFirewall({
    patch_text: 'malformed junk text @@ -1,1 +1,1 @@ @@ invalid header',
  });
  assert(res8.schema_version === 1, 'Malformed diff should return schema-compliant result');
  console.log('✓ Test 8 Passed: Malformed diff handling');

  // -------------------------------------------------------------
  // Test 9: JS patch support
  // -------------------------------------------------------------
  const tempJsFile = path.join(os.tmpdir(), `test_firewall_${Date.now()}.js`);
  const origJsSource = `function calc(a, b) {\n  return a * b;\n}\nmodule.exports = { calc };\n`;
  const editedJsSource = `function calc(a, b) {\n  return a * b + 100;\n}\nmodule.exports = { calc };\n`;
  fs.writeFileSync(tempJsFile, origJsSource, 'utf-8');

  try {
    const res9 = await evaluateAIPatchFirewall({
      file_path: tempJsFile,
      edited_source: editedJsSource,
    });
    assert.strictEqual(res9.safe_to_auto_apply, false, 'JS behavioral change should require review');
    console.log('✓ Test 9 Passed: JS patch support');
  } finally {
    if (fs.existsSync(tempJsFile)) fs.unlinkSync(tempJsFile);
  }

  // -------------------------------------------------------------
  // Test 10: Python patch support
  // -------------------------------------------------------------
  const res10 = await evaluateAIPatchFirewall({
    file_path: demoPyFile,
    candidate_line: '9',
  });
  assert.strictEqual(res10.risk_level, 'SAFE_REMOVE');
  console.log('✓ Test 10 Passed: Python patch support');

  // -------------------------------------------------------------
  // Test 11: Temp-file cleanup verification
  // -------------------------------------------------------------
  const tempBefore = fs.readdirSync(os.tmpdir()).filter((f) => f.startsWith('echonullity_cf_') || f.startsWith('echonullity_blast_'));
  await evaluateAIPatchFirewall({
    file_path: demoPyFile,
    candidate_line: '9-12',
  });
  const tempAfter = fs.readdirSync(os.tmpdir()).filter((f) => f.startsWith('echonullity_cf_') || f.startsWith('echonullity_blast_'));
  assert.strictEqual(tempAfter.length, tempBefore.length, 'Zero temporary files should remain leaked after evaluation');
  console.log('✓ Test 11 Passed: Temp-file cleanup verification');

  // -------------------------------------------------------------
  // Test 12: Deterministic output
  // -------------------------------------------------------------
  const res12A = await evaluateAIPatchFirewall({
    file_path: demoPyFile,
    candidate_line: '9-12',
  });
  const res12B = await evaluateAIPatchFirewall({
    file_path: demoPyFile,
    candidate_line: '9-12',
  });
  assert.strictEqual(res12A.risk_score, res12B.risk_score);
  assert.strictEqual(res12A.risk_level, res12B.risk_level);
  assert.strictEqual(res12A.safe_to_auto_apply, res12B.safe_to_auto_apply);
  console.log('✓ Test 12 Passed: Deterministic output');

  console.log('\nALL 12 MILESTONE 23 AI PATCH SAFETY FIREWALL TESTS PASSED PERFECTLY!\n');
}

runTests().catch((err) => {
  console.error('[TEST-PATCH-FIREWALL-FAILURE]', err);
  process.exit(1);
});
