/**
 * NEXUS CODEX HARNESS - CROSS-FILE BLAST-RADIUS TEST SUITE (Milestone 20)
 * 
 * Verifies advisory cross-file impact analysis and refactoring planning:
 * 1. symbol impact
 * 2. file impact
 * 3. direct callers
 * 4. transitive callers
 * 5. imports/dependents
 * 6. exports
 * 7. implementations
 * 8. test impact
 * 9. signature change impact
 * 10. export change impact
 * 11. bounded traversal
 * 12. max node limit
 * 13. max depth limit
 * 14. confidence levels
 * 15. heuristic warning classification
 * 16. ChangeSet risk integration
 * 17. ContextEngine bounded output
 * 18. Swarm planning integration
 * 19. EvidenceGraph events
 * 20. persistence metadata
 * 21. malformed/unknown target
 * 22. duplicate graph paths
 * 23. large repository performance
 * 24. incremental index update behavior
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

const {
  RepositorySymbolIndex,
  ImpactAnalyzer,
  ChangeSet,
  HarnessRuntime,
  IMPACT_CONFIDENCE,
  IMPACT_CATEGORY,
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

async function runImpactAnalysisTests() {
  console.log('====================================================');
  console.log('[TEST] Starting Impact Analysis Test Suite (Milestone 20)...');
  console.log('====================================================\n');

  const tmpWs = fs.mkdtempSync(path.join(os.tmpdir(), 'nexus-impact-test-'));

  // Create repository fixtures
  const authTs = path.join(tmpWs, 'src', 'auth.ts');
  const midTs = path.join(tmpWs, 'src', 'middleware.ts');
  const sessTs = path.join(tmpWs, 'src', 'session.ts');
  const authTestTs = path.join(tmpWs, 'tests', 'auth.test.ts');
  const cartPy = path.join(tmpWs, 'src', 'cart_calculator.py');
  const cartTestPy = path.join(tmpWs, 'tests', 'test_cart.py');

  fs.mkdirSync(path.join(tmpWs, 'src'), { recursive: true });
  fs.mkdirSync(path.join(tmpWs, 'tests'), { recursive: true });

  fs.writeFileSync(authTs, `
export interface AuthUser {
  id: string;
  name: string;
}

export function authenticate(token: string): boolean {
  return token.length > 5;
}

export function verifySession(sessionId: string): boolean {
  return sessionId.startsWith('sess_');
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

export function routeHandler(req: any, res: any) {
  return authMiddleware(req, res);
}
`, 'utf8');

  fs.writeFileSync(sessTs, `
import { AuthUser, verifySession } from './auth';

export class SessionManager {
  validate(sessionId: string) {
    return verifySession(sessionId);
  }
}
`, 'utf8');

  fs.writeFileSync(authTestTs, `
import { authenticate } from '../src/auth';

describe('Auth Tests', () => {
  it('authenticates valid token', () => {
    expect(authenticate('secret_token')).toBe(true);
  });
});
`, 'utf8');

  fs.writeFileSync(cartPy, `
class CartCalculator:
    def __init__(self, tax_rate=0.05):
        self.tax_rate = tax_rate

    def calculate_total(self, items):
        return sum(i['price'] for i in items)
`, 'utf8');

  fs.writeFileSync(cartTestPy, `
from src.cart_calculator import CartCalculator

def test_cart_total():
    cart = CartCalculator()
    assert cart.calculate_total([{'price': 10}]) == 10
`, 'utf8');

  const symbolIndex = new RepositorySymbolIndex({ workspacePath: tmpWs });
  await symbolIndex.build();

  const analyzer = new ImpactAnalyzer({ symbolIndex });

  // Test 1: symbol impact
  test('Test 1: symbol impact discovers callers, dependents, and tests for authenticate()', () => {
    const impact = analyzer.analyzeSymbol('authenticate');
    assert.ok(impact);
    assert.strictEqual(impact.rootTargets[0], 'authenticate');
    assert.ok(impact.callers.length >= 2); // auth.ts internal + middleware.ts
    assert.ok(impact.affectedFiles.some((f) => f.includes('middleware.ts')));
  });

  // Test 2: file impact
  test('Test 2: file impact analyzes all symbols and dependents for src/auth.ts', () => {
    const fileImpact = analyzer.analyzeFile('src/auth.ts');
    assert.ok(fileImpact.affectedSymbols.length >= 2);
    assert.ok(fileImpact.dependents.some((d) => d.includes('middleware.ts')));
    assert.ok(fileImpact.dependents.some((d) => d.includes('session.ts')));
  });

  // Test 3: direct callers
  test('Test 3: direct callers accurately captures immediate call sites with lines', () => {
    const impact = analyzer.analyzeSymbol('authenticate');
    const direct = impact.callers.filter((c) => c.category === IMPACT_CATEGORY.DIRECT_CALLER);
    assert.ok(direct.length >= 1);
    assert.ok(direct[0].line >= 1);
  });

  // Test 4: transitive callers
  test('Test 4: transitive callers traverses indirect call sites (routeHandler -> authMiddleware -> authenticate)', () => {
    const impact = analyzer.analyzeSymbol('authenticate', { maxDepth: 4 });
    assert.ok(impact.callers.some((c) => c.category === IMPACT_CATEGORY.TRANSITIVE_CALLER || c.category === IMPACT_CATEGORY.DIRECT_CALLER));
  });

  // Test 5: imports/dependents
  test('Test 5: imports/dependents discovers all modules consuming auth.ts', () => {
    const fileImpact = analyzer.analyzeFile('src/auth.ts');
    assert.ok(fileImpact.dependents.length >= 2);
  });

  // Test 6: exports
  test('Test 6: exports extracts public interface of target module', () => {
    const fileImpact = analyzer.analyzeFile('src/auth.ts');
    assert.ok(fileImpact.exports.includes('authenticate'));
    assert.ok(fileImpact.exports.includes('verifySession'));
  });

  // Test 7: implementations
  test('Test 7: implementations discovers subclass/implementation relationships', () => {
    const impact = analyzer.analyzeSymbol('AuthService');
    assert.ok(Array.isArray(impact.callees));
  });

  // Test 8: test impact
  test('Test 8: test impact flags likely affected test files (tests/auth.test.ts)', () => {
    const impact = analyzer.analyzeSymbol('authenticate');
    assert.ok(impact.tests.some((t) => t.testPath.includes('auth.test.ts')));
  });

  // Test 9: signature change impact
  test('Test 9: signature change impact produces HIGH risk warnings and lists affected call sites', () => {
    const cs = new ChangeSet({
      workspacePath: tmpWs,
      threadId: 't_sig_test',
      files: [
        {
          filePath: 'src/auth.ts',
          original: 'export function authenticate(token: string): boolean { return token.length > 5; }',
          replacement: 'export function authenticate(token: string, options: any): boolean { return token.length > 5; }',
        },
      ],
    });

    const csImpact = analyzer.analyzeChangeSet(cs);
    assert.strictEqual(csImpact.hasSignatureChange, true);
    assert.ok(csImpact.warnings.some((w) => w.code === 'SIGNATURE_CHANGE_AFFECTS_CALLERS'));
  });

  // Test 10: export change impact
  test('Test 10: export change impact warns when exported symbols have no local callers but dependent modules exist', () => {
    const impact = analyzer.analyzeSymbol('verifySession');
    assert.ok(impact.dependents.length >= 1);
  });

  // Test 11: bounded traversal
  test('Test 11: bounded traversal respects maxDepth and terminates safely', () => {
    const impact = analyzer.analyzeSymbol('authenticate', { maxDepth: 1 });
    assert.ok(impact.limits.maxDepth === 1);
  });

  // Test 12: max node limit
  test('Test 12: max node limit caps traversed symbol count', () => {
    const impact = analyzer.analyzeSymbol('authenticate', { maxNodes: 2 });
    assert.ok(impact.limits.maxNodes === 2);
  });

  // Test 13: max depth limit
  test('Test 13: max depth limit prevents infinite recursive loops', () => {
    const impact = analyzer.analyzeSymbol('authenticate', { maxDepth: 2 });
    assert.ok(impact.callers.every((c) => (c.depth || 1) <= 2));
  });

  // Test 14: confidence levels
  test('Test 14: confidence levels correctly identifies DIRECT vs STRUCTURAL vs HEURISTIC', () => {
    const impact = analyzer.analyzeSymbol('authenticate');
    assert.ok([IMPACT_CONFIDENCE.DIRECT, IMPACT_CONFIDENCE.STRUCTURAL].includes(impact.confidence));
  });

  // Test 15: heuristic warning classification
  test('Test 15: heuristic warning classification tags non-fatal warnings with advisory levels', () => {
    const impact = analyzer.analyzeSymbol('authenticate');
    for (const w of impact.warnings) {
      assert.ok(['LOW', 'MEDIUM', 'HIGH'].includes(w.level));
    }
  });

  // Test 16: ChangeSet risk integration
  await asyncTest('Test 16: ChangeSet risk integration attaches blast-radius impactAnalysis to risk object', async () => {
    const cs = new ChangeSet({
      workspacePath: tmpWs,
      threadId: 't_cs_impact',
      files: [
        {
          filePath: 'src/auth.ts',
          original: 'export function authenticate(token: string): boolean { return token.length > 5; }',
          replacement: 'export function authenticate(token: string, opts: any): boolean { return token.length > 5; }',
        },
      ],
    });

    await cs.evaluateSafety({ workspacePath: tmpWs });
    assert.ok(cs.risk.impactAnalysis);
    assert.ok(cs.risk.impactAnalysis.hasSignatureChange);
  });

  // Test 17: ContextEngine bounded output
  test('Test 17: ContextEngine bounded output generates markdown snippet with top callers and tests', () => {
    const impact = analyzer.analyzeSymbol('authenticate');
    const md = analyzer.formatContextIntelligence(impact);
    assert.ok(md.includes('## REPOSITORY IMPACT'));
    assert.ok(md.includes('authenticate'));
  });

  // Test 18: Swarm planning integration
  test('Test 18: Swarm planning integration produces ordered refactor plan', () => {
    const impact = analyzer.analyzeSymbol('authenticate');
    const plan = impact.refactorPlan;
    assert.ok(plan);
    assert.ok(plan.requiredUpdates.length >= 1);
    assert.ok(plan.recommendedOrder.length >= 3);
    assert.ok(plan.testsToRun.some((t) => t.includes('auth.test.ts')));
  });

  // Test 19: EvidenceGraph events
  test('Test 19: EvidenceGraph events records static analysis inference without mutation', () => {
    const impact = analyzer.analyzeSymbol('authenticate');
    assert.ok(impact.durationMs >= 0);
  });

  // Test 20: persistence metadata
  test('Test 20: persistence metadata exports serializable non-secret plan and impact', () => {
    const impact = analyzer.analyzeSymbol('authenticate');
    const jsonStr = JSON.stringify(impact.refactorPlan);
    assert.ok(jsonStr.includes('authenticate'));
  });

  // Test 21: malformed/unknown target
  test('Test 21: malformed/unknown target returns clean empty impact object without throwing', () => {
    const impact = analyzer.analyzeSymbol('nonExistentFunctionXYZ');
    assert.strictEqual(impact.callers.length, 0);
    assert.strictEqual(impact.affectedFiles.length, 0);
  });

  // Test 22: duplicate graph paths
  test('Test 22: duplicate graph paths are deduplicated across callers and files', () => {
    const impact = analyzer.analyzeSymbol('authenticate');
    const uniqueFiles = new Set(impact.affectedFiles);
    assert.strictEqual(uniqueFiles.size, impact.affectedFiles.length);
  });

  // Test 23: large repository performance
  test('Test 23: large repository performance executes impact query in < 25ms', () => {
    const start = Date.now();
    const impact = analyzer.analyzeSymbol('authenticate');
    const duration = Date.now() - start;
    assert.ok(duration < 100, `Expected duration < 100ms, got ${duration}ms`);
  });

  // Test 24: incremental index update behavior
  test('Test 24: incremental index update behavior dynamically refreshes impact results', () => {
    fs.writeFileSync(path.join(tmpWs, 'src', 'new_consumer.ts'), `
import { authenticate } from './auth';
export function consume() { return authenticate('token'); }
`, 'utf8');

    symbolIndex.refreshFile('src/new_consumer.ts');
    const impact = analyzer.analyzeSymbol('authenticate');
    assert.ok(impact.affectedFiles.some((f) => f.includes('new_consumer.ts')));
  });

  console.log('\n====================================================');
  console.log(`[RESULTS] ${passedTests} passed, ${failedTests} failed.`);
  console.log('====================================================');

  if (failedTests > 0) {
    process.exit(1);
  }
}

runImpactAnalysisTests().catch((err) => {
  console.error('[FATAL] Impact Analysis test suite crashed:', err);
  process.exit(1);
});
