const assert = require('assert');
const path = require('path');
const { compareBehavioralFingerprints } = require('./behavior_compare');
const { generateJSBehavioralFingerprint } = require('./js_behavior_fingerprint');
const { execSync } = require('child_process');

console.log('[TEST-BEHAVIOR-COMPARE] Starting Phase 3A Cross-Version Behavioral Comparison Test Suite...\n');

// Mock Fingerprint Helpers
function makeFP(language, functions) {
  return {
    schema_version: 1,
    file_path: `/tmp/test_${language}.file`,
    file_name: `test_${language}.file`,
    language,
    source_hash: 'a1b2c3d4e5f67890',
    functions_count: functions.length,
    functions,
  };
}

// 1. Identical Fingerprints
const fpBase = makeFP('python', [
  {
    name: 'calc',
    line: 1,
    end_line: 3,
    parameters: ['x'],
    param_count: 1,
    fingerprint_hash: 'h1',
    observations: [{ input: [{ type: 'int', value: 1 }], status: 'success', output: { type: 'int', value: 2 } }],
  },
]);

const res1 = compareBehavioralFingerprints(fpBase, JSON.parse(JSON.stringify(fpBase)));
assert.strictEqual(res1.compatible, true);
assert.strictEqual(res1.severity, 'NO_CHANGE');
assert.strictEqual(res1.summary.changed_functions_count, 0);
assert.strictEqual(res1.summary.unchanged_functions_count, 1);
console.log('✓ Test 1 Passed: Identical fingerprints yield UNCHANGED (severity NO_CHANGE)');

// 2. Output Change
const fpOutB = makeFP('python', [
  {
    name: 'calc',
    line: 1,
    end_line: 3,
    parameters: ['x'],
    param_count: 1,
    fingerprint_hash: 'h2',
    observations: [{ input: [{ type: 'int', value: 1 }], status: 'success', output: { type: 'int', value: 4 } }],
  },
]);
const res2 = compareBehavioralFingerprints(fpBase, fpOutB);
assert.strictEqual(res2.severity, 'LOW');
assert.strictEqual(res2.summary.changed_functions_count, 1);
assert.strictEqual(res2.changed_functions[0].differences[0].type, 'output_change');
console.log('✓ Test 2 Passed: Output change detection');

// 3. Exception ➔ Success
const fpExcA = makeFP('python', [
  {
    name: 'parse',
    line: 1,
    end_line: 4,
    parameters: ['v'],
    param_count: 1,
    fingerprint_hash: 'h1',
    observations: [{ input: [{ type: 'int', value: -1 }], status: 'exception', exception_type: 'ValueError', message: 'negative' }],
  },
]);
const fpSuccB = makeFP('python', [
  {
    name: 'parse',
    line: 1,
    end_line: 4,
    parameters: ['v'],
    param_count: 1,
    fingerprint_hash: 'h2',
    observations: [{ input: [{ type: 'int', value: -1 }], status: 'success', output: { type: 'int', value: 0 } }],
  },
]);
const res3 = compareBehavioralFingerprints(fpExcA, fpSuccB);
assert.strictEqual(res3.severity, 'HIGH');
assert.strictEqual(res3.changed_functions[0].differences[0].type, 'exception_to_success');
console.log('✓ Test 3 Passed: Exception ➔ Success detection (severity HIGH)');

// 4. Success ➔ Exception
const res4 = compareBehavioralFingerprints(fpSuccB, fpExcA);
assert.strictEqual(res4.severity, 'HIGH');
assert.strictEqual(res4.changed_functions[0].differences[0].type, 'success_to_exception');
console.log('✓ Test 4 Passed: Success ➔ Exception detection (severity HIGH)');

// 5. Timeout Change
const fpTimeoutB = makeFP('python', [
  {
    name: 'calc',
    line: 1,
    end_line: 3,
    parameters: ['x'],
    param_count: 1,
    fingerprint_hash: 'h3',
    observations: [{ input: [{ type: 'int', value: 1 }], status: 'timeout', message: 'Execution timed out' }],
  },
]);
const res5 = compareBehavioralFingerprints(fpBase, fpTimeoutB);
assert.strictEqual(res5.severity, 'HIGH');
assert.strictEqual(res5.changed_functions[0].differences[0].type, 'success_to_timeout');
console.log('✓ Test 5 Passed: Timeout change detection (severity HIGH)');

// 6. Added Function
const fpAddedB = makeFP('python', [
  ...fpBase.functions,
  {
    name: 'new_func',
    line: 5,
    end_line: 8,
    parameters: [],
    param_count: 0,
    fingerprint_hash: 'h_new',
    observations: [],
  },
]);
const res6 = compareBehavioralFingerprints(fpBase, fpAddedB);
assert.strictEqual(res6.summary.added_functions_count, 1);
assert.strictEqual(res6.added_functions[0].type, 'added_function');
console.log('✓ Test 6 Passed: Added function detection');

// 7. Removed Function
const res7 = compareBehavioralFingerprints(fpAddedB, fpBase);
assert.strictEqual(res7.summary.removed_functions_count, 1);
assert.strictEqual(res7.removed_functions[0].type, 'removed_function');
console.log('✓ Test 7 Passed: Removed function detection');

// 8. Unchanged Function + Changed Function
const fpMultiA = makeFP('python', [
  fpBase.functions[0],
  {
    name: 'helper',
    line: 10,
    end_line: 12,
    parameters: ['y'],
    param_count: 1,
    fingerprint_hash: 'hh',
    observations: [{ input: [{ type: 'int', value: 5 }], status: 'success', output: { type: 'int', value: 5 } }],
  },
]);
const fpMultiB = makeFP('python', [
  fpOutB.functions[0], // calc changed
  {
    name: 'helper',
    line: 10,
    end_line: 12,
    parameters: ['y'],
    param_count: 1,
    fingerprint_hash: 'hh',
    observations: [{ input: [{ type: 'int', value: 5 }], status: 'success', output: { type: 'int', value: 5 } }],
  }, // helper unchanged
]);
const res8 = compareBehavioralFingerprints(fpMultiA, fpMultiB);
assert.strictEqual(res8.summary.changed_functions_count, 1);
assert.strictEqual(res8.summary.unchanged_functions_count, 1);
console.log('✓ Test 8 Passed: Mixed unchanged and changed function handling');

// 9. Coverage Reduction
const fpCovA = makeFP('python', [
  {
    name: 'cov',
    line: 1,
    end_line: 2,
    parameters: ['x'],
    param_count: 1,
    fingerprint_hash: 'ha',
    observations: [
      { input: [{ type: 'int', value: 1 }], status: 'success', output: { type: 'int', value: 1 } },
      { input: [{ type: 'int', value: 2 }], status: 'success', output: { type: 'int', value: 2 } },
    ],
  },
]);
const fpCovB = makeFP('python', [
  {
    name: 'cov',
    line: 1,
    end_line: 2,
    parameters: ['x'],
    param_count: 1,
    fingerprint_hash: 'hb',
    observations: [{ input: [{ type: 'int', value: 1 }], status: 'success', output: { type: 'int', value: 1 } }],
  },
]);
const res9 = compareBehavioralFingerprints(fpCovA, fpCovB);
assert.strictEqual(res9.changed_functions[0].coverage_change.type, 'coverage_reduction');
console.log('✓ Test 9 Passed: Coverage reduction detection');

// 10. Coverage Expansion
const res10 = compareBehavioralFingerprints(fpCovB, fpCovA);
assert.strictEqual(res10.changed_functions[0].coverage_change.type, 'coverage_expansion');
console.log('✓ Test 10 Passed: Coverage expansion detection');

// 11. Multiple Changed Functions
const fpMultiChangedB = makeFP('python', [
  fpOutB.functions[0],
  {
    name: 'helper',
    line: 10,
    end_line: 12,
    parameters: ['y'],
    param_count: 1,
    fingerprint_hash: 'hh2',
    observations: [{ input: [{ type: 'int', value: 5 }], status: 'success', output: { type: 'int', value: 99 } }],
  },
]);
const res11 = compareBehavioralFingerprints(fpMultiA, fpMultiChangedB);
assert.strictEqual(res11.summary.changed_functions_count, 2);
console.log('✓ Test 11 Passed: Multiple changed functions detection');

// 12. Malformed Fingerprint Input
const res12 = compareBehavioralFingerprints(null, undefined);
assert.strictEqual(res12.compatible, false);
assert.ok(res12.error);
console.log('✓ Test 12 Passed: Malformed fingerprint input handling');

// 13. Language Mismatch
const fpPy = makeFP('python', []);
const fpJS = makeFP('javascript', []);
const res13 = compareBehavioralFingerprints(fpPy, fpJS);
assert.strictEqual(res13.compatible, false);
assert.ok(res13.reason.includes('Cross-language'));
console.log('✓ Test 13 Passed: Language mismatch handling');

// 14. Deterministic Comparison Result
const rA = compareBehavioralFingerprints(fpMultiA, fpMultiB);
const rB = compareBehavioralFingerprints(fpMultiA, fpMultiB);
assert.deepStrictEqual(rA, rB);
console.log('✓ Test 14 Passed: Deterministic comparison output');

// 15. Original Fingerprints Immutable
const fpOriginalStr = JSON.stringify(fpMultiA);
compareBehavioralFingerprints(fpMultiA, fpMultiB);
assert.strictEqual(JSON.stringify(fpMultiA), fpOriginalStr);
console.log('✓ Test 15 Passed: Original fingerprints remain immutable');

// 16. Python Real Fingerprint Comparison Engine
const demoPy = path.join(__dirname, '../../demo-workspaces/ai_cart_project/src/behavior_demo.py');
const pyFpRaw = execSync(`python3 desktop/engine/behavior_fingerprint.py "${demoPy}"`, { encoding: 'utf-8' });
const pyFp = JSON.parse(pyFpRaw);
const res16 = compareBehavioralFingerprints(pyFp, pyFp);
assert.strictEqual(res16.severity, 'NO_CHANGE');
console.log('✓ Test 16 Passed: Real Python fingerprint comparison');

// 17. JavaScript Real Fingerprint Comparison Engine
const demoJS = path.join(__dirname, '../../demo-workspaces/ai_cart_project/src/behavior_demo.js');
const jsFp = generateJSBehavioralFingerprint(demoJS);
const res17 = compareBehavioralFingerprints(jsFp, jsFp);
assert.strictEqual(res17.severity, 'NO_CHANGE');
console.log('✓ Test 17 Passed: Real JavaScript fingerprint comparison');

// 18. TypeScript Real Fingerprint Comparison Engine
const demoTS = path.join(__dirname, '../../demo-workspaces/ai_cart_project/src/behavior_demo.ts');
const tsFp = generateJSBehavioralFingerprint(demoTS);
const res18 = compareBehavioralFingerprints(tsFp, tsFp);
assert.strictEqual(res18.severity, 'NO_CHANGE');
console.log('✓ Test 18 Passed: Real TypeScript fingerprint comparison');

console.log('\nALL 18 PHASE 3A CROSS-VERSION BEHAVIORAL COMPARISON TESTS PASSED PERFECTLY!');
