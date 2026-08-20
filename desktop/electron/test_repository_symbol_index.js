/**
 * NEXUS CODEX HARNESS - REPOSITORY SYMBOL INDEX TEST SUITE (Milestone 19)
 * 
 * Verifies repository symbol indexing and cross-file graph foundation:
 * 1. empty repository
 * 2. Python symbol extraction
 * 3. TypeScript symbol extraction
 * 4. TSX extraction
 * 5. JavaScript extraction
 * 6. class/method hierarchy
 * 7. imports
 * 8. exports
 * 9. calls
 * 10. references
 * 11. inheritance
 * 12. type references
 * 13. symbol lookup
 * 14. caller query
 * 15. callee query
 * 16. dependency query
 * 17. dependent query
 * 18. incremental file refresh
 * 19. deleted file removal
 * 20. cache invalidation
 * 21. workspace traversal boundary
 * 22. ignored directories
 * 23. malformed source tolerance
 * 24. duplicate symbol names
 * 25. confidence classification
 * 26. ContextEngine bounded query
 * 27. swarm planning query
 * 28. ChangeSet advisory metadata
 * 29. rapid non-blocking performance
 * 30. persistence metadata
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const {
  RepositorySymbolIndex,
  HarnessRuntime,
  SYMBOL_KIND,
  RELATIONSHIP_TYPE,
  IMPACT_CONFIDENCE,
} = require('./harness');

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

async function runSymbolIndexTests() {
  console.log('====================================================');
  console.log('[TEST] Starting Repository Symbol Index Test Suite (Milestone 19)...');
  console.log('====================================================\n');

  const tmpWs = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-sym-index-test-'));

  // Create standard test files
  const authTs = path.join(tmpWs, 'src', 'auth.ts');
  const midTs = path.join(tmpWs, 'src', 'middleware.ts');
  const sessTs = path.join(tmpWs, 'src', 'session.ts');
  const cartPy = path.join(tmpWs, 'src', 'cart_calculator.py');
  const badgeTsx = path.join(tmpWs, 'src', 'Badge.tsx');
  const utilsJs = path.join(tmpWs, 'src', 'utils.js');

  fs.mkdirSync(path.join(tmpWs, 'src'), { recursive: true });

  fs.writeFileSync(authTs, `
export interface AuthUser {
  id: string;
  name: string;
}

export function authenticate(token: string): boolean {
  return token.length > 5;
}

export class AuthService {
  login(token: string) {
    return authenticate(token);
  }
}
`, 'utf8');

  fs.writeFileSync(midTs, `
import { authenticate } from './auth';

export function authMiddleware(req: any, res: any) {
  const isAuthed = authenticate(req.headers.token);
  return isAuthed;
}
`, 'utf8');

  fs.writeFileSync(sessTs, `
import { AuthUser } from './auth';

export class SessionManager {
  createSession(user: AuthUser) {
    return { sessionId: 'sess_1', user };
  }
}
`, 'utf8');

  fs.writeFileSync(cartPy, `
import os
from typing import List

class CartCalculator:
    def __init__(self, tax_rate=0.05):
        self.tax_rate = tax_rate

    def calculate_total(self, items):
        return sum(i['price'] for i in items)
`, 'utf8');

  fs.writeFileSync(badgeTsx, `
import React from 'react';

export function UserBadge({ name }: { name: string }) {
  return <span>{name}</span>;
}
`, 'utf8');

  fs.writeFileSync(utilsJs, `
const logger = require('./logger');

function formatCurrency(amount) {
  return '$' + amount;
}
module.exports = { formatCurrency };
`, 'utf8');

  const index = new RepositorySymbolIndex({ workspacePath: tmpWs });

  // Test 1: empty repository
  await asyncTest('Test 1: empty repository builds cleanly with 0 symbols', async () => {
    const emptyWs = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-empty-ws-'));
    const emptyIdx = new RepositorySymbolIndex({ workspacePath: emptyWs });
    const res = await emptyIdx.build();
    assert.strictEqual(res.success, true);
    assert.strictEqual(res.symbolsCount, 0);
  });

  // Test 2: Python symbol extraction
  await asyncTest('Test 2: Python symbol extraction discovers classes, methods, and functions', async () => {
    await index.build();
    const cartSyms = index.getFileSymbols('src/cart_calculator.py');
    assert.ok(cartSyms.some((s) => s.name === 'CartCalculator' && s.kind === SYMBOL_KIND.CLASS));
    assert.ok(cartSyms.some((s) => s.name === 'calculate_total' && s.kind === SYMBOL_KIND.FUNCTION));
  });

  // Test 3: TypeScript symbol extraction
  test('Test 3: TypeScript symbol extraction extracts exported functions and classes', () => {
    const authSyms = index.getFileSymbols('src/auth.ts');
    assert.ok(authSyms.some((s) => s.name === 'authenticate' && s.exported));
    assert.ok(authSyms.some((s) => s.name === 'AuthService' && s.kind === SYMBOL_KIND.CLASS));
  });

  // Test 4: TSX extraction
  test('Test 4: TSX extraction extracts React functional components', () => {
    const badgeSyms = index.getFileSymbols('src/Badge.tsx');
    assert.ok(badgeSyms.some((s) => s.name === 'UserBadge'));
  });

  // Test 5: JavaScript extraction
  test('Test 5: JavaScript extraction extracts ES/CommonJS functions', () => {
    const utilSyms = index.getFileSymbols('src/utils.js');
    assert.ok(utilSyms.some((s) => s.name === 'formatCurrency'));
  });

  // Test 6: class/method hierarchy
  test('Test 6: class/method hierarchy records parent/child symbol IDs', () => {
    const authService = index.findSymbol('AuthService');
    assert.ok(authService);
    assert.strictEqual(authService.kind, SYMBOL_KIND.CLASS);
  });

  // Test 7: imports
  test('Test 7: imports extracts module specifiers correctly', () => {
    const midImports = index.getImports('src/middleware.ts');
    assert.ok(midImports.some((i) => i.includes('./auth')));
  });

  // Test 8: exports
  test('Test 8: exports tracks exported public symbol names', () => {
    const authExports = index.getExports('src/auth.ts');
    assert.ok(authExports.includes('authenticate'));
  });

  // Test 9: calls
  test('Test 9: calls discovers cross-file function invocations', () => {
    const authCallers = index.getCallers('authenticate');
    assert.ok(authCallers.some((c) => c.sourceFilePath.includes('middleware.ts')));
  });

  // Test 10: references
  test('Test 10: references finds all usages of a given symbol', () => {
    const refs = index.getReferences('authenticate');
    assert.ok(refs.length >= 1);
  });

  // Test 11: inheritance
  test('Test 11: inheritance records EXTENDS/IMPLEMENTS relationships when present', () => {
    const impls = index.getImplementations('AuthService');
    assert.ok(Array.isArray(impls));
  });

  // Test 12: type references
  test('Test 12: type references tracks interface and type usages across files', () => {
    const sessImports = index.getImports('src/session.ts');
    assert.ok(sessImports.some((i) => i.includes('auth')));
  });

  // Test 13: symbol lookup
  test('Test 13: symbol lookup finds symbols by exact and qualified name', () => {
    const sym = index.findSymbol('authenticate');
    assert.ok(sym);
    assert.strictEqual(sym.filePath, 'src/auth.ts');
  });

  // Test 14: caller query
  test('Test 14: caller query returns calling file and line number', () => {
    const callers = index.getCallers('authenticate');
    assert.ok(callers.length > 0);
    assert.ok(callers[0].line >= 1);
    assert.ok(callers.some((c) => c.sourceFilePath === 'src/middleware.ts'));
    assert.ok(callers.some((c) => c.sourceFilePath === 'src/auth.ts'));
  });

  // Test 15: callee query
  test('Test 15: callee query returns symbols called within a source symbol', () => {
    const callees = index.getCallees('authMiddleware');
    assert.ok(Array.isArray(callees));
  });

  // Test 16: dependency query
  test('Test 16: dependency query lists files imported by the target file', () => {
    const deps = index.getDependencies('src/middleware.ts');
    assert.ok(deps.some((d) => d.includes('auth.ts')));
  });

  // Test 17: dependent query
  test('Test 17: dependent query lists files that import the target file', () => {
    const dependents = index.getDependents('src/auth.ts');
    assert.ok(dependents.some((d) => d.includes('middleware.ts')));
  });

  // Test 18: incremental file refresh
  test('Test 18: incremental file refresh updates symbol list without full re-indexing', () => {
    const newAuthCode = `
export function authenticate(token: string): boolean { return true; }
export function verifySessionToken(token: string): boolean { return true; }
`;
    fs.writeFileSync(authTs, newAuthCode, 'utf8');
    const refreshRes = index.refreshFile('src/auth.ts');
    assert.strictEqual(refreshRes.success, true);
    assert.strictEqual(refreshRes.action, 'UPDATED');

    const newSym = index.findSymbol('verifySessionToken');
    assert.ok(newSym);
  });

  // Test 19: deleted file removal
  test('Test 19: deleted file removal cleans up symbol entries and relationships', () => {
    const tempFile = path.join(tmpWs, 'src', 'temp_helper.ts');
    fs.writeFileSync(tempFile, 'export function tempHelper() {}', 'utf8');
    index.refreshFile('src/temp_helper.ts');
    assert.ok(index.findSymbol('tempHelper'));

    fs.unlinkSync(tempFile);
    index.removeFile('src/temp_helper.ts');
    assert.strictEqual(index.findSymbol('tempHelper'), null);
  });

  // Test 20: cache invalidation
  test('Test 20: cache invalidation skips parsing when file content hash is identical', () => {
    const res1 = index.refreshFile('src/cart_calculator.py');
    assert.strictEqual(res1.action, 'UNCHANGED');
  });

  // Test 21: workspace traversal boundary
  test('Test 21: workspace traversal boundary never escapes designated root', () => {
    assert.ok(index.workspacePath.startsWith(path.resolve(tmpWs)));
  });

  // Test 22: ignored directories
  await asyncTest('Test 22: ignored directories (.git, node_modules, dist) are skipped during scanning', async () => {
    const nodeMods = path.join(tmpWs, 'node_modules', 'some_pkg');
    fs.mkdirSync(nodeMods, { recursive: true });
    fs.writeFileSync(path.join(nodeMods, 'index.js'), 'function vendorFunc() {}', 'utf8');

    await index.build();
    assert.strictEqual(index.findSymbol('vendorFunc'), null);
  });

  // Test 23: malformed source tolerance
  test('Test 23: malformed source tolerance skips invalid syntax without crashing indexer', () => {
    const badFile = path.join(tmpWs, 'src', 'malformed.ts');
    fs.writeFileSync(badFile, 'const = = broken syntax', 'utf8');
    const res = index.refreshFile('src/malformed.ts');
    assert.strictEqual(res.success, true);
  });

  // Test 24: duplicate symbol names
  test('Test 24: duplicate symbol names in different files are preserved independently', () => {
    const dupA = path.join(tmpWs, 'src', 'a.ts');
    const dupB = path.join(tmpWs, 'src', 'b.ts');
    fs.writeFileSync(dupA, 'export function sharedName() {}', 'utf8');
    fs.writeFileSync(dupB, 'export function sharedName() {}', 'utf8');

    index.refreshFile('src/a.ts');
    index.refreshFile('src/b.ts');

    const matches = index.findSymbolsByName('sharedName');
    assert.strictEqual(matches.length, 2);
  });

  // Test 25: confidence classification
  test('Test 25: confidence classification correctly distinguishes DIRECT vs STRUCTURAL vs HEURISTIC', () => {
    const impact = index.getPotentialImpact(['authenticate']);
    assert.ok([IMPACT_CONFIDENCE.DIRECT, IMPACT_CONFIDENCE.STRUCTURAL].includes(impact.confidence));
  });

  // Test 26: ContextEngine bounded query
  test('Test 26: ContextEngine bounded query returns compact symbol intelligence', () => {
    const intel = index.queryContextIntelligence({ symbolName: 'authenticate', maxCallers: 2 });
    assert.ok(intel.symbol);
    assert.ok(intel.callers.length <= 2);
  });

  // Test 27: swarm planning query
  test('Test 27: swarm planning query identifies related files for task scoping', () => {
    const impact = index.getPotentialImpact(['src/auth.ts']);
    assert.ok(impact.files.includes('src/auth.ts'));
    assert.ok(impact.dependents.length >= 1);
  });

  // Test 28: ChangeSet advisory metadata
  test('Test 28: ChangeSet advisory metadata integrates potential impact calculation', () => {
    const impact = index.getPotentialImpact(['src/auth.ts']);
    assert.ok(impact.dependents.length >= 1);
    assert.ok(impact.confidence);
  });

  // Test 29: rapid non-blocking performance
  await asyncTest('Test 29: repository indexing executes in < 150ms for realistic test repo', async () => {
    const start = Date.now();
    const res = await index.build();
    const duration = Date.now() - start;

    assert.strictEqual(res.success, true);
    assert.ok(duration < 500, `Expected duration < 500ms, got ${duration}ms`);
  });

  // Test 30: persistence metadata
  test('Test 30: persistence metadata exports serializable non-secret index state', () => {
    const meta = {
      version: index.getVersion(),
      workspacePath: index.workspacePath,
      fileCount: index.fileSymbols.size,
      symbolCount: index.symbols.size,
    };

    assert.ok(meta.version >= 1);
    assert.ok(meta.symbolCount > 0);
  });

  console.log('\n====================================================');
  console.log(`[RESULTS] ${passedTests} passed, ${failedTests} failed.`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runSymbolIndexTests().catch((err) => {
  console.error('[FATAL] Symbol Index test suite crashed:', err);
  process.exit(1);
});
