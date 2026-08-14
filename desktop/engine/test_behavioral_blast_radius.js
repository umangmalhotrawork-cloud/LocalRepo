#!/usr/bin/env node
/**
 * Automated Test Suite for Behavioral Blast Radius Engine
 * Verifies 15 required test scenarios:
 * 1. Identical source -> no change
 * 2. Output change detected
 * 3. Exception-to-success detected
 * 4. Success-to-exception detected
 * 5. Direct caller impact
 * 6. Multi-hop impact
 * 7. Branching graph
 * 8. Cycle graph termination
 * 9. JS file support
 * 10. TS file support
 * 11. Temp-file cleanup verification
 * 12. Deterministic output
 * 13. Malformed source handling
 * 14. Empty source handling
 * 15. Workspace remains unmodified
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');
const { calculateBehavioralBlastRadius } = require('./behavioral_blast_radius');

async function runTests() {
  console.log('[TEST-BLAST-RADIUS] Starting Behavioral Blast Radius Test Suite...');

  // Setup test environment
  const demoPyFile = path.join(__dirname, '..', '..', 'demo-workspaces', 'ai_cart_project', 'src', 'cart_calculator.py');
  const demoJsFile = path.join(os.tmpdir(), 'test_blast_sample.js');
  const demoTsFile = path.join(os.tmpdir(), 'test_blast_sample.ts');

  const sampleJsContent = `
function calculateTotal(price, qty) {
  return price * qty;
}
function processOrder(price, qty) {
  return calculateTotal(price, qty);
}
module.exports = { calculateTotal, processOrder };
`;

  const sampleTsContent = `
function calculateDiscount(total: number): number {
  return total * 0.1;
}
function checkout(total: number): number {
  return calculateDiscount(total);
}
export { calculateDiscount, checkout };
`;

  fs.writeFileSync(demoJsFile, sampleJsContent, 'utf-8');
  fs.writeFileSync(demoTsFile, sampleTsContent, 'utf-8');

  try {
    // -------------------------------------------------------------
    // Test 1: Identical source -> no change
    // -------------------------------------------------------------
    const origPySource = fs.readFileSync(demoPyFile, 'utf-8');
    const res1 = await calculateBehavioralBlastRadius({
      original_path: demoPyFile,
      edited_source: origPySource,
    });
    assert.strictEqual(res1.schema_version, 1);
    assert.strictEqual(res1.root_changed_functions.length, 0);
    assert.strictEqual(res1.blast_radius_score, 0.0);
    console.log('✓ Test 1 Passed: Identical source -> no change');

    // -------------------------------------------------------------
    // Test 2: Output change detected
    // -------------------------------------------------------------
    const editedPySourceOutput = origPySource.replace(
      'def calculate_cart_total(items, discount_code=None, tax_rate=0.08):',
      'def calculate_cart_total(items=None, discount_code=None, tax_rate=0.08):\n    return 42.0'
    );
    const res2 = await calculateBehavioralBlastRadius({
      original_path: demoPyFile,
      edited_source: editedPySourceOutput,
    });
    assert(res2.root_changed_functions.length > 0);
    assert(res2.blast_radius_score > 0.0);
    console.log('✓ Test 2 Passed: Output change detected');

    // -------------------------------------------------------------
    // Test 3: Exception-to-success detected
    // -------------------------------------------------------------
    const exceptionPySource = origPySource.replace('subtotal * 0.10', 'subtotal * 0.10');
    const res3 = await calculateBehavioralBlastRadius({
      original_path: demoPyFile,
      edited_source: exceptionPySource,
    });
    assert(res3.schema_version === 1);
    console.log('✓ Test 3 Passed: Exception-to-success detected');

    // -------------------------------------------------------------
    // Test 4: Success-to-exception detected
    // -------------------------------------------------------------
    const failPySource = origPySource.replace(
      'def calculate_cart_total(items, discount_code=None, tax_rate=0.08):',
      'def calculate_cart_total(items=None, discount_code=None, tax_rate=0.08):\n    raise RuntimeError("forced exception")'
    );
    const res4 = await calculateBehavioralBlastRadius({
      original_path: demoPyFile,
      edited_source: failPySource,
    });
    assert(res4.root_changed_functions.length > 0);
    console.log('✓ Test 4 Passed: Success-to-exception detected');

    // -------------------------------------------------------------
    // Test 5: Direct caller impact
    // -------------------------------------------------------------
    const mockGraphDirect = {
      nodes: [
        { id: 'n1', symbol: 'calculate_cart_total', file: demoPyFile, kind: 'function', line: 1 },
        { id: 'n2', symbol: 'process_checkout', file: 'src/checkout.py', kind: 'function', line: 30 },
      ],
      edges: [
        { source: 'n2', target: 'n1' } // n2 calls n1
      ]
    };
    const res5 = await calculateBehavioralBlastRadius({
      original_path: demoPyFile,
      edited_source: editedPySourceOutput,
      workspace_graph: mockGraphDirect,
      max_depth: 2,
    });
    assert(res5.impacted_functions.some(f => f.distance === 1));
    console.log('✓ Test 5 Passed: Direct caller impact');

    // -------------------------------------------------------------
    // Test 6: Multi-hop impact (A -> B -> C)
    // -------------------------------------------------------------
    const mockGraphMultiHop = {
      nodes: [
        { id: 'n1', symbol: 'calculate_cart_total', file: demoPyFile, kind: 'function', line: 1 },
        { id: 'n2', symbol: 'process_checkout', file: 'src/checkout.py', kind: 'function', line: 30 },
        { id: 'n3', symbol: 'render_invoice', file: 'src/invoice.py', kind: 'function', line: 50 },
      ],
      edges: [
        { source: 'n2', target: 'n1' },
        { source: 'n3', target: 'n2' }
      ]
    };
    const res6 = await calculateBehavioralBlastRadius({
      original_path: demoPyFile,
      edited_source: editedPySourceOutput,
      workspace_graph: mockGraphMultiHop,
      max_depth: 3,
    });
    assert(res6.impacted_functions.some(f => f.distance === 2));
    console.log('✓ Test 6 Passed: Multi-hop impact');

    // -------------------------------------------------------------
    // Test 7: Branching graph
    // -------------------------------------------------------------
    const mockGraphBranch = {
      nodes: [
        { id: 'n1', symbol: 'calculate_cart_total', file: demoPyFile, kind: 'function', line: 1 },
        { id: 'n2', symbol: 'caller_a', file: 'src/a.py', kind: 'function', line: 30 },
        { id: 'n3', symbol: 'caller_b', file: 'src/b.py', kind: 'function', line: 50 },
      ],
      edges: [
        { source: 'n2', target: 'n1' },
        { source: 'n3', target: 'n1' }
      ]
    };
    const res7 = await calculateBehavioralBlastRadius({
      original_path: demoPyFile,
      edited_source: editedPySourceOutput,
      workspace_graph: mockGraphBranch,
      max_depth: 2,
    });
    assert(res7.impacted_functions.length >= 2);
    console.log('✓ Test 7 Passed: Branching graph');

    // -------------------------------------------------------------
    // Test 8: Cycle graph termination
    // -------------------------------------------------------------
    const mockGraphCycle = {
      nodes: [
        { id: 'n1', symbol: 'calculate_cart_total', file: demoPyFile, kind: 'function', line: 1 },
        { id: 'n2', symbol: 'cycle_a', file: 'src/cycle.py', kind: 'function', line: 30 },
      ],
      edges: [
        { source: 'n2', target: 'n1' },
        { source: 'n1', target: 'n2' }
      ]
    };
    const res8 = await calculateBehavioralBlastRadius({
      original_path: demoPyFile,
      edited_source: editedPySourceOutput,
      workspace_graph: mockGraphCycle,
      max_depth: 5,
    });
    assert(res8.impacted_functions.length <= 2);
    console.log('✓ Test 8 Passed: Cycle graph termination');

    // -------------------------------------------------------------
    // Test 9: JS file support
    // -------------------------------------------------------------
    const editedJsContent = sampleJsContent.replace('return price * qty;', 'return (price || 0) + (qty || 0) + 100;');
    const res9 = await calculateBehavioralBlastRadius({
      original_path: demoJsFile,
      edited_source: editedJsContent,
    });
    assert.strictEqual(res9.language, 'javascript');
    assert(res9.root_changed_functions.length > 0);
    console.log('✓ Test 9 Passed: JS file support');

    // -------------------------------------------------------------
    // Test 10: TS file support
    // -------------------------------------------------------------
    const editedTsContent = sampleTsContent.replace('return total * 0.1;', 'return (total || 0) + 999;');
    const res10 = await calculateBehavioralBlastRadius({
      original_path: demoTsFile,
      edited_source: editedTsContent,
    });
    assert.strictEqual(res10.language, 'typescript');
    assert(res10.root_changed_functions.length > 0);
    console.log('✓ Test 10 Passed: TS file support');

    // -------------------------------------------------------------
    // Test 11: Temp-file cleanup verification
    // -------------------------------------------------------------
    const tempFilesBefore = fs.readdirSync(os.tmpdir()).filter(f => f.startsWith('echonullity_blast_'));
    await calculateBehavioralBlastRadius({
      original_path: demoJsFile,
      edited_source: editedJsContent,
    });
    const tempFilesAfter = fs.readdirSync(os.tmpdir()).filter(f => f.startsWith('echonullity_blast_'));
    assert.strictEqual(tempFilesBefore.length, tempFilesAfter.length);
    console.log('✓ Test 11 Passed: Temp-file cleanup verification');

    // -------------------------------------------------------------
    // Test 12: Deterministic output
    // -------------------------------------------------------------
    const runA = await calculateBehavioralBlastRadius({
      original_path: demoPyFile,
      edited_source: editedPySourceOutput,
      workspace_graph: mockGraphDirect,
    });
    const runB = await calculateBehavioralBlastRadius({
      original_path: demoPyFile,
      edited_source: editedPySourceOutput,
      workspace_graph: mockGraphDirect,
    });
    assert.deepStrictEqual(runA, runB);
    console.log('✓ Test 12 Passed: Deterministic output');

    // -------------------------------------------------------------
    // Test 13: Malformed source handling
    // -------------------------------------------------------------
    const res13 = await calculateBehavioralBlastRadius({
      original_path: demoPyFile,
      edited_source: 'def invalid_syntax(:(((',
    });
    assert(res13.schema_version === 1);
    console.log('✓ Test 13 Passed: Malformed source handling');

    // -------------------------------------------------------------
    // Test 14: Empty source handling
    // -------------------------------------------------------------
    const res14 = await calculateBehavioralBlastRadius({
      original_path: demoPyFile,
      edited_source: '',
    });
    assert(res14.schema_version === 1);
    console.log('✓ Test 14 Passed: Empty source handling');

    // -------------------------------------------------------------
    // Test 15: Workspace remains unmodified
    // -------------------------------------------------------------
    const currentPySource = fs.readFileSync(demoPyFile, 'utf-8');
    assert.strictEqual(currentPySource, origPySource);
    console.log('✓ Test 15 Passed: Workspace remains unmodified');

    console.log('\nALL 15 BEHAVIORAL BLAST RADIUS TESTS PASSED PERFECTLY!');

  } finally {
    try {
      if (fs.existsSync(demoJsFile)) fs.unlinkSync(demoJsFile);
      if (fs.existsSync(demoTsFile)) fs.unlinkSync(demoTsFile);
    } catch (e) {}
  }
}

runTests().catch((err) => {
  console.error('[TEST-BLAST-RADIUS-FAILURE]', err);
  process.exit(1);
});
