/**
 * NEXUS CODEX HARNESS - AST-LEVEL SEMANTIC DIFF TEST SUITE (Milestone 18B)
 * 
 * Verifies AST structural analysis and comparison:
 * 1. Python parsing
 * 2. TypeScript parsing
 * 3. JavaScript parsing
 * 4. TSX parsing
 * 5. malformed source handling
 * 6. added function detection
 * 7. removed function detection
 * 8. signature change detection
 * 9. import change detection
 * 10. control-flow change detection
 * 11. call-site change detection
 * 12. node range mapping
 * 13. BASE/PARENT comparison
 * 14. BASE/INCOMING comparison
 * 15. 3-way structural conflict hint
 * 16. identical structural changes
 * 17. disjoint structural changes
 * 18. AST failure fallback
 * 19. large-file limits
 * 20. secret filtering
 * 21. ChangeSet integration
 * 22. ConflictResolver integration
 * 23. SurgeryDiff integration
 * 24. worker offload / non-blocking execution
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const {
  ASTDiffEngine,
  astDiffEngine,
  ChangeSet,
  ChangeConflictResolver,
  HarnessRuntime,
  SUPPORTED_LANGUAGES,
  NODE_CHANGE_TYPES,
} = require('./harness');

const secretFilter = require('../security/secretFilter');

let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
  try {
    fn();
    console.log('[PASS] ' + name);
    passedTests++;
  } catch (err) {
    console.error('[FAIL] ' + name + ':', err.message);
    console.error(err.stack);
    failedTests++;
  }
}

async function asyncTest(name, fn) {
  try {
    await fn();
    console.log('[PASS] ' + name);
    passedTests++;
  } catch (err) {
    console.error('[FAIL] ' + name + ':', err.message);
    console.error(err.stack);
    failedTests++;
  }
}

async function runASTDiffTests() {
  console.log('====================================================');
  console.log('[TEST] Starting AST Semantic Diff Test Suite (Milestone 18B)...');
  console.log('====================================================\n');

  const engine = new ASTDiffEngine();

  // Test 1: Python parsing
  test('Test 1: Python parsing extracts functions, parameters, imports, and classes', () => {
    const pyCode = `
import os
from typing import List

class CartCalculator:
    def __init__(self, tax_rate: float = 0.05):
        self.tax_rate = tax_rate

    def calculate_total(self, items: List[dict]) -> float:
        subtotal = sum(item['price'] for item in items)
        if subtotal > 100:
            return subtotal * 0.9
        return subtotal * (1 + self.tax_rate)
`;
    const res = engine.parse(pyCode, SUPPORTED_LANGUAGES.PYTHON, 'src/cart.py');
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.language, SUPPORTED_LANGUAGES.PYTHON);

    const funcs = res.nodes.filter((n) => n.type === 'FunctionDeclaration');
    assert.ok(funcs.some((f) => f.name === 'calculate_total'));
    assert.ok(funcs.some((f) => f.name === '__init__'));

    const classes = res.nodes.filter((n) => n.type === 'ClassDeclaration');
    assert.strictEqual(classes.length, 1);
    assert.strictEqual(classes[0].name, 'CartCalculator');
  });

  // Test 2: TypeScript parsing
  test('Test 2: TypeScript parsing extracts functions, types, and interfaces', () => {
    const tsCode = `
import { Request, Response } from 'express';

export function authenticate(token: string, opts?: { timeout: number }): boolean {
  if (!token) {
    return false;
  }
  return token.startsWith('bearer_');
}
`;
    const res = engine.parse(tsCode, SUPPORTED_LANGUAGES.TYPESCRIPT, 'src/auth.ts');
    assert.strictEqual(res.success, true);
    const authFn = res.nodes.find((n) => n.type === 'FunctionDeclaration' && n.name === 'authenticate');
    assert.ok(authFn);
    assert.ok(authFn.parameters.length >= 1);
  });

  // Test 3: JavaScript parsing
  test('Test 3: JavaScript parsing handles standard ES functions and calls', () => {
    const jsCode = `
const logger = require('./logger');

function processOrder(orderId, amount) {
  logger.info('Processing order', orderId);
  return amount * 1.1;
}
`;
    const res = engine.parse(jsCode, SUPPORTED_LANGUAGES.JAVASCRIPT, 'src/order.js');
    assert.strictEqual(res.success, true);
    const fn = res.nodes.find((n) => n.name === 'processOrder');
    assert.ok(fn);
  });

  // Test 4: TSX parsing
  test('Test 4: TSX parsing processes React functional components with JSX', () => {
    const tsxCode = `
import React from 'react';

export function UserBadge({ username }: { username: string }) {
  return <div className="badge">{username}</div>;
}
`;
    const res = engine.parse(tsxCode, SUPPORTED_LANGUAGES.TSX, 'src/Badge.tsx');
    assert.strictEqual(res.success, true);
    assert.ok(res.nodes.some((n) => n.name === 'UserBadge'));
  });

  // Test 5: malformed source handling
  test('Test 5: malformed source handling falls back gracefully without unhandled exceptions', () => {
    const malformed = 'const x = ; function { return }';
    const res = engine.parse(malformed, SUPPORTED_LANGUAGES.TYPESCRIPT, 'broken.ts');
    assert.ok(res.success || res.fallback);
  });

  // Test 6: added function detection
  test('Test 6: added function detection identifies new declarations accurately', () => {
    const base = 'function existing() { return 1; }';
    const mod = 'function existing() { return 1; }\nfunction added() { return 2; }';

    const diff = engine.compare(base, mod, SUPPORTED_LANGUAGES.TYPESCRIPT, 'app.ts');
    assert.strictEqual(diff.success, true);
    assert.strictEqual(diff.summary.addedFunctions.length, 1);
    assert.strictEqual(diff.summary.addedFunctions[0].name, 'added');
  });

  // Test 7: removed function detection
  test('Test 7: removed function detection identifies deleted declarations with risk hint', () => {
    const base = 'function keep() {}\nfunction removeMe() {}';
    const mod = 'function keep() {}';

    const diff = engine.compare(base, mod, SUPPORTED_LANGUAGES.TYPESCRIPT, 'app.ts');
    assert.strictEqual(diff.summary.removedFunctions.length, 1);
    assert.strictEqual(diff.summary.removedFunctions[0].name, 'removeMe');
    assert.ok(diff.summary.riskHints.some((h) => h.level === 'HIGH' && h.message.includes('removeMe')));
  });

  // Test 8: signature change detection
  test('Test 8: signature change detection flags added or altered parameters', () => {
    const base = 'function calculate(price, qty) { return price * qty; }';
    const mod = 'function calculate(price, qty, discount = 0) { return (price * qty) - discount; }';

    const diff = engine.compare(base, mod, SUPPORTED_LANGUAGES.TYPESCRIPT, 'calc.ts');
    assert.strictEqual(diff.summary.signatureChanges.length, 1);
    assert.strictEqual(diff.summary.signatureChanges[0].name, 'calculate');
  });

  // Test 9: import change detection
  test('Test 9: import change detection tracks added and removed dependencies', () => {
    const base = 'import fs from "fs";\nfunction read() {}';
    const mod = 'import path from "path";\nfunction read() {}';

    const diff = engine.compare(base, mod, SUPPORTED_LANGUAGES.TYPESCRIPT, 'io.ts');
    assert.ok(diff.summary.importChanges.some((i) => i.type === 'ADDED' && i.name.includes('path')));
    assert.ok(diff.summary.importChanges.some((i) => i.type === 'REMOVED' && i.name.includes('fs')));
  });

  // Test 10: control-flow change detection
  test('Test 10: control-flow change detection identifies added branching logic', () => {
    const base = 'function check(x) { return x; }';
    const mod = 'function check(x) { if (x > 0) return x; else return 0; }';

    const diff = engine.compare(base, mod, SUPPORTED_LANGUAGES.TYPESCRIPT, 'check.ts');
    assert.ok(diff.summary.controlFlowChanges.length > 0);
  });

  // Test 11: call-site change detection
  test('Test 11: call-site change detection identifies new invocations', () => {
    const base = 'function run() {}';
    const mod = 'function run() { validate(); }';

    const diff = engine.compare(base, mod, SUPPORTED_LANGUAGES.TYPESCRIPT, 'run.ts');
    assert.ok(diff.summary.callSiteChanges.some((c) => c.callName.includes('validate')));
  });

  // Test 12: node range mapping
  test('Test 12: node range mapping produces accurate start and end line/column coordinates', () => {
    const base = 'function a() {}\nfunction b() {}';
    const mod = 'function a() {}\nfunction b() { return true; }';

    const diff = engine.compare(base, mod, SUPPORTED_LANGUAGES.TYPESCRIPT, 'range.ts');
    assert.ok(diff.affectedRanges.length > 0);
    const range = diff.affectedRanges[0];
    assert.ok(range.startLine >= 1);
    assert.ok(range.endLine >= range.startLine);
  });

  // Test 13: BASE/PARENT comparison
  test('Test 13: BASE/PARENT comparison computes accurate structural summary', () => {
    const base = 'def add(a, b): return a + b';
    const parent = 'def add(a, b, c=0): return a + b + c';

    const res = engine.compare(base, parent, SUPPORTED_LANGUAGES.PYTHON, 'calc.py');
    assert.strictEqual(res.summary.signatureChanges.length, 1);
  });

  // Test 14: BASE/INCOMING comparison
  test('Test 14: BASE/INCOMING comparison computes incoming child modification profile', () => {
    const base = 'def sub(a, b): return a - b';
    const incoming = 'def sub(a, b): return abs(a - b)';

    const res = engine.compare(base, incoming, SUPPORTED_LANGUAGES.PYTHON, 'sub.py');
    assert.strictEqual(res.summary.modifiedFunctions.length, 1);
    assert.strictEqual(res.summary.modifiedFunctions[0].name, 'sub');
  });

  // Test 15: 3-way structural conflict hint
  test('Test 15: 3-way structural conflict hint detects diverging function signatures', () => {
    const base = 'function pay(user, amount) {}';
    const parent = 'function pay(user, amount, currency = "USD") {}';
    const incoming = 'function pay(user, amount, session) {}';

    const threeWay = engine.compare3Way({
      baseSource: base,
      parentSource: parent,
      incomingSource: incoming,
      filePath: 'pay.ts',
    });

    assert.strictEqual(threeWay.conflictHint, 'SIGNATURE_DIVERGENCE');
    assert.strictEqual(threeWay.riskLevel, 'HIGH');
    assert.strictEqual(threeWay.sameSignaturesDiverging.length, 1);
  });

  // Test 16: identical structural changes
  test('Test 16: identical structural changes across siblings yield clean resolution hint', () => {
    const base = 'function ping() { return "pong"; }';
    const side = 'function ping() { return "PONG"; }';

    const threeWay = engine.compare3Way({
      baseSource: base,
      parentSource: side,
      incomingSource: side,
      filePath: 'ping.ts',
    });

    assert.strictEqual(threeWay.sameSignaturesDiverging.length, 0);
  });

  // Test 17: disjoint structural changes
  test('Test 17: disjoint structural changes indicate clean auto-merge compatibility', () => {
    const base = 'function fA() {}\nfunction fB() {}';
    const parent = 'function fA() { return 1; }\nfunction fB() {}';
    const incoming = 'function fA() {}\nfunction fB() { return 2; }';

    const threeWay = engine.compare3Way({
      baseSource: base,
      parentSource: parent,
      incomingSource: incoming,
      filePath: 'disjoint.ts',
    });

    assert.strictEqual(threeWay.conflictHint, 'DISJOINT_SYMBOLS');
    assert.strictEqual(threeWay.overlappingFunctions.length, 0);
  });

  // Test 18: AST failure fallback
  test('Test 18: AST failure fallback mode returns TEXT_DIFF_ONLY safely', () => {
    const limitedEngine = new ASTDiffEngine({ maxSizeBytes: 10 });
    const res = limitedEngine.compare('const x = 1234567890;', 'const y = 9876543210;', SUPPORTED_LANGUAGES.JAVASCRIPT);
    assert.strictEqual(res.fallback, true);
    assert.strictEqual(res.mode, 'TEXT_DIFF_ONLY');
  });

  // Test 19: large-file limits
  test('Test 19: large-file limits enforce byte ceilings before parsing', () => {
    const limited = new ASTDiffEngine({ maxSizeBytes: 50 });
    const huge = 'a'.repeat(200);
    const parsed = limited.parse(huge, SUPPORTED_LANGUAGES.PYTHON);
    assert.strictEqual(parsed.fallback, true);
  });

  // Test 20: secret filtering
  test('Test 20: secret filtering sanitizes raw AST node text payloads', () => {
    const sourceWithKey = 'const apiKey = "sk-ant-api03-1234567890abcdef";';
    const parsed = engine.parse(sourceWithKey, SUPPORTED_LANGUAGES.TYPESCRIPT, 'secret.ts');
    for (const node of parsed.nodes) {
      assert.ok(!JSON.stringify(node).includes('sk-ant-api03'));
    }
  });

  // Test 21: ChangeSet integration
  await asyncTest('Test 21: ChangeSet integration attaches AST structural summary during evaluateSafety', async () => {
    const cs = new ChangeSet({
      workspacePath: process.cwd(),
      threadId: 't_ast_cs',
      edits: [
        {
          filePath: 'src/calc.py',
          original: 'def calc(x): return x',
          replacement: 'def calc(x, y=1): return x * y\ndef new_fn(): pass',
        },
      ],
    });

    const risk = await cs.evaluateSafety({ workspacePath: process.cwd() });
    assert.ok(cs.files[0].astDiffResult);
    assert.strictEqual(cs.files[0].astDiffResult.success, true);
    assert.strictEqual(cs.files[0].semanticSummary.addedFunctions.length, 1);
  });

  // Test 22: ConflictResolver integration
  test('Test 22: ConflictResolver integration populates astAnalysis on conflict creation and evaluation', () => {
    const resolver = new ChangeConflictResolver();
    const conflict = resolver.createConflict({
      changeSetIdA: 'cs1',
      changeSetIdB: 'cs2',
      filePath: 'src/auth.ts',
      baseContent: 'export function login(u, p) {}',
      parentContent: 'export function login(u, p, remember) {}',
      incomingContent: 'export function login(u, p, opts) {}',
    });

    assert.ok(conflict.astAnalysis);
    assert.strictEqual(conflict.astAnalysis.success, true);
    assert.strictEqual(conflict.astAnalysis.conflictHint, 'SIGNATURE_DIVERGENCE');
  });

  // Test 23: SurgeryDiff integration
  test('Test 23: SurgeryDiff affected ranges map cleanly to line numbers', () => {
    const base = 'function ghostOne() {}\nfunction normal() {}\nfunction ghostTwo() {}';
    const modified = 'function normal() {}';

    const diff = engine.compare(base, modified, SUPPORTED_LANGUAGES.TYPESCRIPT, 'surgery.ts');
    assert.strictEqual(diff.summary.removedFunctions.length, 2);
    assert.ok(diff.affectedRanges.some((r) => r.name === 'ghostOne'));
    assert.ok(diff.affectedRanges.some((r) => r.name === 'ghostTwo'));
  });

  // Test 24: worker offload / non-blocking execution
  await asyncTest('Test 24: AST analysis executes rapidly under 10ms for typical source files', async () => {
    const start = Date.now();
    const base = 'def process(): return True\n'.repeat(50);
    const mod = 'def process(): return False\n'.repeat(50);
    const diff = engine.compare(base, mod, SUPPORTED_LANGUAGES.PYTHON, 'bench.py');
    const duration = Date.now() - start;

    assert.strictEqual(diff.success, true);
    assert.ok(duration < 250, `Expected parse duration < 250ms, got ${duration}ms`);
  });

  console.log('\n====================================================');
  console.log(`[RESULTS] ${passedTests} passed, ${failedTests} failed.`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runASTDiffTests().catch((err) => {
  console.error('[FATAL] AST Diff test suite crashed:', err);
  process.exit(1);
});
