const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { execSync } = require('child_process');

const {
  generateJSBehavioralFingerprint,
  discoverFunctions,
  generateInputMatrix,
  normalizeValue,
  computeFingerprintHash,
  compareFingerprints,
} = require('./js_behavior_fingerprint');

console.log('[TEST-JS-FINGERPRINT] Starting JS/TS Behavioral Fingerprint Test Suite...');

// 1. Function Discovery
const code = `
function add(a, b) { return a + b; }
const multiply = (x, y) => x * y;
`;
const discovered = discoverFunctions('test.js', code);
assert.strictEqual(discovered.length, 2, 'Should discover 2 functions');
assert.strictEqual(discovered[0].name, 'add');
assert.strictEqual(discovered[1].name, 'multiply');
console.log('✓ Test 1 Passed: Function discovery (declarations & arrow functions)');

// 2. Input Matrix Generation
const matrix0 = generateInputMatrix(0);
assert.deepStrictEqual(matrix0, [[]]);
const matrix1 = generateInputMatrix(1);
assert.strictEqual(matrix1[0][0], 0);
console.log('✓ Test 2 Passed: Deterministic input matrix generation');

// 3. Output Normalization
assert.deepStrictEqual(normalizeValue(42), { type: 'number', value: 42 });
assert.deepStrictEqual(normalizeValue('hello'), { type: 'string', value: 'hello' });
assert.deepStrictEqual(normalizeValue(true), { type: 'boolean', value: true });
assert.deepStrictEqual(normalizeValue(null), { type: 'null', value: null });
assert.deepStrictEqual(normalizeValue(undefined), { type: 'undefined', value: null });
console.log('✓ Test 3 Passed: Value normalization');

// 4. Successful Execution
const demoJS = path.join(__dirname, '../../demo-workspaces/ai_cart_project/src/behavior_demo.js');
const fpJS = generateJSBehavioralFingerprint(demoJS);
assert.strictEqual(fpJS.functions_count, 4, 'Should discover 4 functions in behavior_demo.js');
const calcFn = fpJS.functions.find((f) => f.name === 'calculateTotal');
assert.ok(calcFn, 'calculateTotal function should exist');
assert.strictEqual(calcFn.success_count, 16, 'calculateTotal should succeed on all 16 candidates');
console.log('✓ Test 4 Passed: JS function isolated execution & fingerprinting');

// 5. TypeScript Transpilation & Execution
const demoTS = path.join(__dirname, '../../demo-workspaces/ai_cart_project/src/behavior_demo.ts');
const fpTS = generateJSBehavioralFingerprint(demoTS);
assert.strictEqual(fpTS.language, 'typescript');
assert.strictEqual(fpTS.functions_count, 4);
console.log('✓ Test 5 Passed: TS transpile & execution');

// 6. Exception Capture
const parseFn = fpJS.functions.find((f) => f.name === 'parseItemCount');
assert.ok(parseFn.exception_count > 0, 'parseItemCount should capture RangeError/TypeError exceptions');
console.log('✓ Test 6 Passed: Exception capture');

// 7. Timeout Handling
const tempTimeoutFile = path.join(os.tmpdir(), `test_timeout_${Date.now()}.js`);
fs.writeFileSync(tempTimeoutFile, 'function hang() { while(true); }', 'utf-8');
try {
  const fpHang = generateJSBehavioralFingerprint(tempTimeoutFile);
  assert.strictEqual(fpHang.functions[0].timeout_count, 1, 'Infinite loop should trigger timeout status');
  console.log('✓ Test 7 Passed: Timeout handling');
} finally {
  if (fs.existsSync(tempTimeoutFile)) fs.unlinkSync(tempTimeoutFile);
}

// 8. Fingerprint Hashing Determinism
const hash1 = computeFingerprintHash(calcFn.observations);
const hash2 = computeFingerprintHash(calcFn.observations);
assert.strictEqual(hash1, hash2, 'Identical observations must yield identical hash');
console.log('✓ Test 8 Passed: Deterministic fingerprint hashing');

// 9. Fingerprint Comparison
const fpA = {
  functions: [
    {
      name: 'calc',
      observations: [{ input: [{ type: 'number', value: 1 }], status: 'success', output: { type: 'number', value: 2 } }],
    },
  ],
};
const fpB = {
  functions: [
    {
      name: 'calc',
      observations: [{ input: [{ type: 'number', value: 1 }], status: 'success', output: { type: 'number', value: 4 } }],
    },
  ],
};
const diff = compareFingerprints(fpA, fpB);
assert.strictEqual(diff.changed, true);
assert.strictEqual(diff.changed_observations, 1);
console.log('✓ Test 9 Passed: Fingerprint diff comparison');

// 10. Malformed JS / TS
const tempMalformed = path.join(os.tmpdir(), `test_malformed_${Date.now()}.js`);
fs.writeFileSync(tempMalformed, 'function broken(', 'utf-8');
try {
  const fpBad = generateJSBehavioralFingerprint(tempMalformed);
  assert.strictEqual(fpBad.functions[0].exception_count, 1, 'Malformed function should capture syntax exception');
  console.log('✓ Test 10 Passed: Malformed syntax handling');
} finally {
  if (fs.existsSync(tempMalformed)) fs.unlinkSync(tempMalformed);
}

// 11. Empty Source
const tempEmpty = path.join(os.tmpdir(), `test_empty_${Date.now()}.js`);
fs.writeFileSync(tempEmpty, '// empty file', 'utf-8');
try {
  const fpEmpty = generateJSBehavioralFingerprint(tempEmpty);
  assert.strictEqual(fpEmpty.functions_count, 0);
  console.log('✓ Test 11 Passed: Empty source handling');
} finally {
  if (fs.existsSync(tempEmpty)) fs.unlinkSync(tempEmpty);
}

// 12. Python Phase 1 Regression Verification
try {
  const pyResult = execSync('python3 desktop/engine/test_behavior_fingerprint.py 2>&1', { encoding: 'utf-8' });
  assert.ok(pyResult.includes('OK'), 'Python test suite must still pass');
  console.log('✓ Test 12 Passed: Python Phase 1 regression verification');
} catch (e) {
  assert.fail(`Python regression failed: ${e.message}`);
}

console.log('\nALL 12 JS/TS BEHAVIORAL FINGERPRINT TESTS PASSED PERFECTLY!');
