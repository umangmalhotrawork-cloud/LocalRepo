const assert = require('assert');
const { analyzePythonExecution } = require('./pythonExecutionAnalyzer');

console.log('[TEST-EXECUTION-ANALYZER] Starting Milestone 27 AI Execution Explainer Test Suite...');

function runTests() {
  // Test 1: Success case
  const code1 = 'items = [1, 2, 3]\nprint(sum(items))';
  const res1 = analyzePythonExecution(code1, '6\n', '');
  assert.strictEqual(res1.status, 'success');
  assert.strictEqual(res1.variables['items'], '[1, 2, 3]');
  assert(res1.complexity.includes('O(1)'));
  console.log('✓ Test 1 Passed: Success case with variable extraction & O(1) complexity');

  // Test 2: ZeroDivisionError
  const code2 = 'items = [1, 2, 3]\nprint(sum(items)/0)';
  const stderr2 = 'Traceback (most recent call last):\nZeroDivisionError: division by zero';
  const res2 = analyzePythonExecution(code2, '', stderr2);
  assert.strictEqual(res2.status, 'runtime_error');
  assert(res2.rootCause.includes('zero'));
  assert(res2.suggestedFix.includes('denominator'));
  console.log('✓ Test 2 Passed: ZeroDivisionError analysis & suggested fix');

  // Test 3: NameError
  const code3 = 'print(total)';
  const stderr3 = 'NameError: name \'total\' is not defined';
  const res3 = analyzePythonExecution(code3, '', stderr3);
  assert.strictEqual(res3.status, 'runtime_error');
  assert(res3.error.includes('total'));
  assert(res3.suggestedFix.includes('total'));
  console.log('✓ Test 3 Passed: NameError analysis');

  // Test 4: Dangerous operation
  const code4 = 'import os\nos.remove(\'data.txt\')';
  const res4 = analyzePythonExecution(code4, '', '');
  assert(res4.safetyWarnings.some(w => w.includes('os.remove')));
  console.log('✓ Test 4 Passed: Dangerous operation safety warning emission');

  console.log('\nALL 4 MILESTONE 27 EXECUTION ANALYZER TESTS PASSED PERFECTLY!');
}

runTests();
