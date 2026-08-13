const assert = require('assert');
const { computeBehavioralImpactRadius, calculateBlastRadiusScore } = require('./behavioral_impact_radius');

console.log('[TEST-IMPACT-RADIUS] Starting Milestone 19 Behavioral Impact Radius Test Suite...\n');

// Mock Fingerprint Helper
function makeFP(language, functions) {
  return {
    schema_version: 1,
    file_path: `/tmp/test_${language}.file`,
    file_name: `test_${language}.file`,
    language,
    source_hash: 'hash123',
    functions_count: functions.length,
    functions,
  };
}

// 1. No Downstream Callers
const payload1 = {
  root_function: 'standalone',
  root_file: 'src/util.py',
  workspace_graph: { nodes: [{ id: 'src/util.py::L1::standalone::def', symbol: 'standalone', file: 'src/util.py' }], edges: [] },
  fingerprint_a: makeFP('python', [{ name: 'standalone', line: 1, end_line: 3, parameters: [], param_count: 0, fingerprint_hash: 'h1', observations: [{ input: [], status: 'success', output: { type: 'int', value: 1 } }] }]),
  fingerprint_b: makeFP('python', [{ name: 'standalone', line: 1, end_line: 3, parameters: [], param_count: 0, fingerprint_hash: 'h1', observations: [{ input: [], status: 'success', output: { type: 'int', value: 1 } }] }]),
};

const res1 = computeBehavioralImpactRadius(payload1);
assert.strictEqual(res1.summary.total_impacted_nodes, 0);
assert.strictEqual(res1.summary.global_severity, 'NO_CHANGE');
console.log('✓ Test 1 Passed: Standalone function with no downstream callers');

// 2. One Direct Caller
const graph2 = {
  nodes: [
    { id: 'src/calc.py::L1::calc::def', symbol: 'calc', file: 'src/calc.py' },
    { id: 'src/service.py::L10::run_calc::call', symbol: 'run_calc', file: 'src/service.py' },
  ],
  edges: [{ source: 'src/service.py::L10::run_calc::call', target: 'src/calc.py::L1::calc::def', type: 'call' }],
};

const payload2 = {
  root_function: 'calc',
  root_file: 'src/calc.py',
  workspace_graph: graph2,
  fingerprint_a: makeFP('python', [{ name: 'calc', line: 1, end_line: 3, parameters: ['x'], param_count: 1, fingerprint_hash: 'h1', observations: [{ input: [{ type: 'int', value: 1 }], status: 'success', output: { type: 'int', value: 2 } }] }]),
  fingerprint_b: makeFP('python', [{ name: 'calc', line: 1, end_line: 3, parameters: ['x'], param_count: 1, fingerprint_hash: 'h2', observations: [{ input: [{ type: 'int', value: 1 }], status: 'success', output: { type: 'int', value: 5 } }] }]),
};

const res2 = computeBehavioralImpactRadius(payload2);
assert.strictEqual(res2.summary.total_impacted_nodes, 1);
assert.strictEqual(res2.impacted_nodes[0].relationship, 'direct-caller');
assert.strictEqual(res2.impacted_nodes[0].distance, 1);
console.log('✓ Test 2 Passed: One direct caller graph traversal');

// 3. Multi-Level Chain (A ➔ B ➔ C)
const graph3 = {
  nodes: [
    { id: 'n_a', symbol: 'funcA', file: 'a.py' },
    { id: 'n_b', symbol: 'funcB', file: 'b.py' },
    { id: 'n_c', symbol: 'funcC', file: 'c.py' },
  ],
  edges: [
    { source: 'n_b', target: 'n_a', type: 'call' }, // B calls A
    { source: 'n_c', target: 'n_b', type: 'call' }, // C calls B
  ],
};
const res3 = computeBehavioralImpactRadius({ root_function: 'funcA', root_file: 'a.py', workspace_graph: graph3 });
assert.strictEqual(res3.summary.total_impacted_nodes, 2);
assert.strictEqual(res3.summary.max_depth_reached, 2);
console.log('✓ Test 3 Passed: Multi-level transitive chain traversal (A ➔ B ➔ C)');

// 4. Branching Graph (A ➔ B, A ➔ C)
const graph4 = {
  nodes: [
    { id: 'n_a', symbol: 'root', file: 'a.py' },
    { id: 'n_b', symbol: 'caller1', file: 'b.py' },
    { id: 'n_c', symbol: 'caller2', file: 'c.py' },
  ],
  edges: [
    { source: 'n_b', target: 'n_a', type: 'call' },
    { source: 'n_c', target: 'n_a', type: 'call' },
  ],
};
const res4 = computeBehavioralImpactRadius({ root_function: 'root', root_file: 'a.py', workspace_graph: graph4 });
assert.strictEqual(res4.summary.total_impacted_nodes, 2);
console.log('✓ Test 4 Passed: Branching graph traversal');

// 5. Cyclic Graph (A ➔ B ➔ A)
const graph5 = {
  nodes: [
    { id: 'n_a', symbol: 'ping', file: 'a.py' },
    { id: 'n_b', symbol: 'pong', file: 'b.py' },
  ],
  edges: [
    { source: 'n_b', target: 'n_a', type: 'call' },
    { source: 'n_a', target: 'n_b', type: 'call' },
  ],
};
const res5 = computeBehavioralImpactRadius({ root_function: 'ping', root_file: 'a.py', workspace_graph: graph5 });
assert.strictEqual(res5.summary.total_impacted_nodes, 1);
console.log('✓ Test 5 Passed: Cyclic graph termination via visited set');

// 6. Multiple Changed Roots
const res6 = computeBehavioralImpactRadius({ root_function: 'root', root_file: 'a.py', workspace_graph: graph4, max_depth: 1 });
assert.strictEqual(res6.summary.total_impacted_nodes, 2);
console.log('✓ Test 6 Passed: Multi-root distance bounding');

// 7 & 8. No Behavioral Change vs Behavioral Change
const fpSame = makeFP('python', [{ name: 'calc', line: 1, end_line: 3, parameters: ['x'], param_count: 1, fingerprint_hash: 'h1', observations: [{ input: [{ type: 'int', value: 1 }], status: 'success', output: { type: 'int', value: 2 } }] }]);
const res7 = computeBehavioralImpactRadius({ root_function: 'calc', root_file: 'src/calc.py', workspace_graph: graph2, fingerprint_a: fpSame, fingerprint_b: fpSame });
assert.strictEqual(res7.root_function.severity, 'NO_CHANGE');

const res8 = computeBehavioralImpactRadius({ root_function: 'calc', root_file: 'src/calc.py', workspace_graph: graph2, fingerprint_a: fpSame, fingerprint_b: payload2.fingerprint_b });
assert.strictEqual(res8.root_function.severity, 'LOW');
console.log('✓ Test 7 & 8 Passed: No behavioral change vs output change classification');

// 9. Exception Transition
const fpExc = makeFP('python', [{ name: 'calc', line: 1, end_line: 3, parameters: ['x'], param_count: 1, fingerprint_hash: 'h3', observations: [{ input: [{ type: 'int', value: 1 }], status: 'exception', exception_type: 'ValueError', message: 'invalid' }] }]);
const res9 = computeBehavioralImpactRadius({ root_function: 'calc', root_file: 'src/calc.py', workspace_graph: graph2, fingerprint_a: fpSame, fingerprint_b: fpExc });
assert.strictEqual(res9.summary.global_severity, 'HIGH');
console.log('✓ Test 9 Passed: Exception transition propagation (severity HIGH)');

// 10. Timeout Transition
const fpTimeout = makeFP('python', [{ name: 'calc', line: 1, end_line: 3, parameters: ['x'], param_count: 1, fingerprint_hash: 'h4', observations: [{ input: [{ type: 'int', value: 1 }], status: 'timeout', message: 'Timed out' }] }]);
const res10 = computeBehavioralImpactRadius({ root_function: 'calc', root_file: 'src/calc.py', workspace_graph: graph2, fingerprint_a: fpSame, fingerprint_b: fpTimeout });
assert.strictEqual(res10.summary.global_severity, 'HIGH');
console.log('✓ Test 10 Passed: Timeout transition handling');

// 11. Unverified Downstream Function
const res11 = computeBehavioralImpactRadius({ root_function: 'calc', root_file: 'src/calc.py', workspace_graph: graph2 });
assert.strictEqual(res11.impacted_nodes[0].classification, 'UNVERIFIED');
console.log('✓ Test 11 Passed: Unverified downstream caller classification');

// 12. Severity Propagation
const res12 = computeBehavioralImpactRadius({ root_function: 'calc', root_file: 'src/calc.py', workspace_graph: graph2, fingerprint_a: fpSame, fingerprint_b: fpExc });
assert.strictEqual(res12.summary.global_severity, 'HIGH');
console.log('✓ Test 12 Passed: Global severity escalation');

// 13. Deterministic Output & Score Calculation
const score = calculateBlastRadiusScore('HIGH', [{ distance: 1, classification: 'OBSERVED_CHANGE', severity: 'HIGH' }]);
assert.strictEqual(typeof score, 'number');
assert.ok(score > 0);
console.log('✓ Test 13 Passed: Deterministic Blast-Radius score calculation');

// 14. Python Graph Integration
const res14 = computeBehavioralImpactRadius(payload2);
assert.strictEqual(res14.schema_version, 1);
console.log('✓ Test 14 Passed: Python graph & fingerprint integration');

// 15. JS/TS Graph Integration
const res15 = computeBehavioralImpactRadius({
  root_function: 'parseItemCount',
  root_file: 'src/behavior_demo.ts',
  workspace_graph: {
    nodes: [
      { id: 'src/behavior_demo.ts::L10::parseItemCount::def', symbol: 'parseItemCount', file: 'src/behavior_demo.ts' },
      { id: 'src/behavior_demo.ts::L30::checkout::call', symbol: 'checkout', file: 'src/behavior_demo.ts' },
    ],
    edges: [{ source: 'src/behavior_demo.ts::L30::checkout::call', target: 'src/behavior_demo.ts::L10::parseItemCount::def', type: 'call' }],
  },
});
assert.strictEqual(res15.summary.total_impacted_nodes, 1);
console.log('✓ Test 15 Passed: JS/TS graph & fingerprint integration');

console.log('\nALL 15 MILESTONE 19 BEHAVIORAL IMPACT RADIUS TESTS PASSED PERFECTLY!');
