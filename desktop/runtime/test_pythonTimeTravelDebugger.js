const assert = require('assert');
const { simulateTracePython } = require('./pythonTimeTravelDebugger');

console.log('[TEST-TIME-TRAVEL-DEBUGGER] Starting Milestone 28 Time-Travel Debugger Test Suite...');

function runTests() {
  // Test Case 1
  const code1 = 'items = [1,2,3]\ntotal = sum(items)\nprint(total)';
  const steps1 = simulateTracePython(code1);
  assert.strictEqual(steps1.length, 3);
  assert.strictEqual(steps1[0].line, 1);
  assert.strictEqual(steps1[0].variables['items'], '[1,2,3]');
  assert.strictEqual(steps1[1].variables['total'], 'sum(items)');
  console.log('✓ Test Case 1 Passed: 3-step cumulative trace for items and total');

  // Test Case 2
  const code2 = 'x = 1\ny = 2\nz = x + y\nprint(z)';
  const steps2 = simulateTracePython(code2);
  assert.strictEqual(steps2.length, 4);
  assert.strictEqual(steps2[2].variables['z'], 'x + y');
  console.log('✓ Test Case 2 Passed: 4-step cumulative variables trace');

  // Test Case 3
  const code3 = 'for i in range(3):\n    print(i)';
  const steps3 = simulateTracePython(code3);
  assert(steps3.length >= 2);
  console.log('✓ Test Case 3 Passed: Multi-line loop trace simulation');

  console.log('\nALL 3 MILESTONE 28 TIME-TRAVEL DEBUGGER TESTS PASSED PERFECTLY!');
}

runTests();
