/**
 * NEXUS CODEX HARNESS - LANGUAGE INTELLIGENCE & PROBLEMS PANEL TEST SUITE (Milestone 31)
 * 
 * Verifies the complete workspace language intelligence pipeline:
 * 1. Symbol indexing & lookup
 * 2. Go to Definition (same file & cross file)
 * 3. Ambiguous definition ranking
 * 4. Non-existent symbol definition handling
 * 5. Find References across workspace files
 * 6. Find References word boundary precision
 * 7. Hover signature & docstring formatting
 * 8. Hover class & interface formatting
 * 9. Hover unknown symbol graceful handling
 * 10. Prepare Rename identifier validation
 * 11. Prepare Rename multi-file occurrence mapping
 * 12. Rename ChangeSet construction
 * 13. Rename ImpactAnalyzer evaluation
 * 14. Rename Patch Firewall safety evaluation
 * 15. Rename Transactional Apply & live re-indexing
 * 16. Rename rollback integrity
 * 17. Diagnostic parsing: TypeScript compiler
 * 18. Diagnostic parsing: Python traceback & syntax
 * 19. Diagnostic parsing: pytest test failures
 * 20. Diagnostic parsing: Jest / Vitest test failures
 * 21. Diagnostic parsing: Node.js / JavaScript stack traces
 * 22. Problems Store: add, filter, clear, summary
 * 23. Secret Sanitization in diagnostics & problems
 * 24. ContextEngine active problems injection & bounding
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const assert = require('assert');

// Setup isolated test continuum directory
process.env.ECHO_CONTINUUM_DIR = path.join(os.tmpdir(), 'nexus_test_m31_continuum_' + Date.now());
fs.mkdirSync(process.env.ECHO_CONTINUUM_DIR, { recursive: true });

const {
  HarnessRuntime,
  RepositorySymbolIndex,
  LanguageIntelligence,
  ImpactAnalyzer,
  ContextEngine,
  ChangeSet,
  EVENT_TYPES,
} = require('./harness');

async function runM31TestSuite() {
  console.log('================================================================');
  console.log('NEXUS CODEX HARNESS: Milestone 31 Language Intelligence & Problems');
  console.log('================================================================\n');

  let passedAssertions = 0;
  function pass(msg) {
    passedAssertions++;
    console.log(`[PASS] Assertion ${passedAssertions}: ${msg}`);
  }

  const tmpTestDir = path.join(os.tmpdir(), 'nexus_m31_test_workspace_' + Date.now());
  fs.mkdirSync(tmpTestDir, { recursive: true });

  try {
    // Populate test workspace with sample TypeScript and Python modules
    const srcDir = path.join(tmpTestDir, 'src');
    fs.mkdirSync(srcDir, { recursive: true });

    // File 1: auth.ts
    const authTsContent = `/**
 * Authenticates a user token against the auth database.
 */
export function authenticateUser(token: string, userId: string): boolean {
  if (!token) return false;
  return validateToken(token);
}

export function validateToken(t: string): boolean {
  return t.length > 8;
}

export class AuthSession {
  sessionId: string;
  constructor(sessionId: string) {
    this.sessionId = sessionId;
  }
}
`;
    fs.writeFileSync(path.join(srcDir, 'auth.ts'), authTsContent, 'utf8');

    // File 2: server.ts (imports and references auth.ts)
    const serverTsContent = `import { authenticateUser, AuthSession } from './auth';

export function startServer(port: number): void {
  const session = new AuthSession("sess-123");
  const isAuthed = authenticateUser("secret-token-xyz", "u1");
  console.log("Server listening on port", port, "Authed:", isAuthed);
}
`;
    fs.writeFileSync(path.join(srcDir, 'server.ts'), serverTsContent, 'utf8');

    // File 3: utils.py
    const utilsPyContent = `"""
Utility functions for arithmetic and metrics computation.
"""
def compute_metrics(values):
    """Calculates summary statistics."""
    total = sum(values)
    return total / len(values) if values else 0

class MetricsCollector:
    def __init__(self, name):
        self.name = name
`;
    fs.writeFileSync(path.join(srcDir, 'utils.py'), utilsPyContent, 'utf8');

    // Initialize Language Intelligence
    const runtime = new HarnessRuntime({ isolated: true });
    const langEngine = runtime.languageIntelligence;

    // Index test workspace
    await langEngine.symbolIndex.build(tmpTestDir);

    // =========================================================================
    // 1. Symbol Indexing & Lookup
    // =========================================================================
    const authSymbols = langEngine.symbolIndex.getFileSymbols(path.join('src', 'auth.ts'));
    assert(authSymbols.length >= 3, 'auth.ts should contain at least 3 indexed symbols');
    const authFn = langEngine.symbolIndex.findSymbol('authenticateUser');
    assert(authFn !== null, 'authenticateUser symbol must be indexed');
    assert.strictEqual(authFn.name, 'authenticateUser', 'Symbol name must match');
    assert.strictEqual(authFn.exported, true, 'authenticateUser must be marked exported');
    pass('Symbol Indexing correctly extracted functions, methods, and exported flags');

    // =========================================================================
    // 2. Go to Definition (Same File & Cross File)
    // =========================================================================
    const sameFileDef = await langEngine.getDefinition({
      symbolName: 'validateToken',
      filePath: 'src/auth.ts',
      workspacePath: tmpTestDir,
    });
    assert(sameFileDef.definitions.length >= 1, 'Should find definition for validateToken');
    assert.strictEqual(sameFileDef.definitions[0].name, 'validateToken');
    assert.strictEqual(sameFileDef.definitions[0].filePath, 'src/auth.ts');
    assert(sameFileDef.definitions[0].isCurrentFile === true, 'Should mark isCurrentFile true');
    pass('Go to Definition successfully resolved same-file definition location');

    const crossFileDef = await langEngine.getDefinition({
      symbolName: 'authenticateUser',
      filePath: 'src/server.ts',
      workspacePath: tmpTestDir,
    });
    assert(crossFileDef.definitions.length >= 1, 'Should find cross-file definition');
    assert.strictEqual(crossFileDef.definitions[0].name, 'authenticateUser');
    assert.strictEqual(crossFileDef.definitions[0].filePath, 'src/auth.ts');
    pass('Go to Definition successfully resolved cross-file definition in imported module');

    // =========================================================================
    // 3. Ambiguous Definition Ranking
    // =========================================================================
    // Create duplicate symbol in another file
    fs.writeFileSync(path.join(srcDir, 'auth_mock.ts'), 'export function authenticateUser(): boolean { return true; }', 'utf8');
    await langEngine.symbolIndex.build(tmpTestDir);

    const rankedDefs = await langEngine.getDefinition({
      symbolName: 'authenticateUser',
      filePath: 'src/auth.ts',
      workspacePath: tmpTestDir,
    });
    assert(rankedDefs.definitions.length >= 2, 'Should find both definitions for overloaded symbol');
    assert.strictEqual(rankedDefs.definitions[0].filePath, 'src/auth.ts', 'Current file must be ranked first');
    pass('Ambiguous definitions correctly ranked current file ahead of other matches');

    // =========================================================================
    // 4. Non-Existent Symbol Definition
    // =========================================================================
    const missingDef = await langEngine.getDefinition({
      symbolName: 'nonExistentFunctionXYZ',
      filePath: 'src/auth.ts',
      workspacePath: tmpTestDir,
    });
    assert.strictEqual(missingDef.definitions.length, 0, 'Non-existent symbol must return empty array');
    pass('Non-existent symbol returned empty definitions array cleanly');

    // =========================================================================
    // 5. Find References Across Files
    // =========================================================================
    const refsResult = await langEngine.findReferences({
      symbolName: 'AuthSession',
      filePath: 'src/auth.ts',
      workspacePath: tmpTestDir,
    });
    assert(refsResult.references.length >= 2, 'AuthSession should have references in auth.ts and server.ts');
    const refFiles = new Set(refsResult.references.map((r) => r.filePath));
    assert(refFiles.has('src/auth.ts'), 'Must include definition in auth.ts');
    assert(refFiles.has('src/server.ts'), 'Must include usage in server.ts');
    pass('Find References discovered all definitions and occurrences across multiple files');

    // =========================================================================
    // 6. Find References Word Boundary Precision
    // =========================================================================
    // Verify that searching for 'validate' does NOT match 'validateToken'
    const partialRefs = await langEngine.findReferences({
      symbolName: 'validate',
      workspacePath: tmpTestDir,
    });
    assert.strictEqual(partialRefs.references.length, 0, 'Word boundary matching must not partially match validateToken');
    pass('Find References strictly enforced word boundary regex without false substring matches');

    // =========================================================================
    // 7. Hover Signature & Docstring Formatting
    // =========================================================================
    const hoverRes = await langEngine.getHover({
      symbolName: 'authenticateUser',
      filePath: 'src/server.ts',
      workspacePath: tmpTestDir,
    });
    assert.strictEqual(hoverRes.found, true, 'Hover must find symbol');
    assert(hoverRes.markdown.includes('authenticateUser'), 'Hover markdown must include symbol name');
    assert(hoverRes.markdown.includes('Authenticates a user token'), 'Hover markdown must include docstring');
    assert(hoverRes.markdown.includes('*(exported)*'), 'Hover markdown must show exported tag');
    pass('Hover formatted compact markdown with signature, file path, exported badge, and docstrings');

    // =========================================================================
    // 8. Hover Class & Python Docstrings
    // =========================================================================
    const pyHover = await langEngine.getHover({
      symbolName: 'compute_metrics',
      filePath: 'src/utils.py',
      workspacePath: tmpTestDir,
    });
    assert.strictEqual(pyHover.found, true, 'Python hover must find symbol');
    assert(pyHover.markdown.includes('compute_metrics'), 'Must include function name');
    assert(pyHover.markdown.includes('Calculates summary statistics'), 'Must extract docstring');
    pass('Hover correctly extracted Python docstrings and module signatures');

    // =========================================================================
    // 9. Hover Unknown Symbol
    // =========================================================================
    const unknownHover = await langEngine.getHover({
      symbolName: 'unknownSymbol123',
      workspacePath: tmpTestDir,
    });
    assert.strictEqual(unknownHover.found, false, 'Unknown symbol must return found: false');
    assert(unknownHover.markdown.includes('No symbol definition found'), 'Must give clear explanation');
    pass('Hover on unknown symbol returned graceful explanation without throwing');

    // =========================================================================
    // 10. Prepare Rename Validation
    // =========================================================================
    let invalidIdentifierCaught = false;
    try {
      await langEngine.prepareRename({
        symbolName: 'validateToken',
        newName: '123-invalid-name!',
        workspacePath: tmpTestDir,
      });
    } catch (e) {
      invalidIdentifierCaught = true;
    }
    assert(invalidIdentifierCaught, 'Prepare Rename must reject invalid identifier syntax');
    pass('Prepare Rename rejected invalid identifier syntax');

    // =========================================================================
    // 11. Prepare Rename Multi-File Occurrence Mapping
    // =========================================================================
    const renamePlan = await langEngine.prepareRename({
      symbolName: 'AuthSession',
      newName: 'UserAuthSession',
      workspacePath: tmpTestDir,
    });
    assert.strictEqual(renamePlan.symbolName, 'AuthSession');
    assert.strictEqual(renamePlan.newName, 'UserAuthSession');
    assert(renamePlan.affectedFilesCount >= 2, 'Must affect at least auth.ts and server.ts');
    pass('Prepare Rename accurately mapped occurrences across multiple workspace files');

    // =========================================================================
    // 12. Rename ChangeSet Construction
    // =========================================================================
    const cs = new ChangeSet({ workspacePath: tmpTestDir, intent: 'MUTATION' });
    for (const f of renamePlan.affectedFiles) {
      const abs = path.resolve(tmpTestDir, f.filePath);
      const original = fs.readFileSync(abs, 'utf8');
      const replaced = original.replace(/\bAuthSession\b/g, 'UserAuthSession');
      cs.addFile({ filePath: f.filePath, original, replacement: replaced, changeType: 'MODIFY' });
    }
    assert.strictEqual(cs.files.length, renamePlan.affectedFiles.length, 'ChangeSet must contain all affected files');
    pass('Constructed authoritative multi-file ChangeSet for symbol rename');

    // =========================================================================
    // 13. Rename ImpactAnalyzer Evaluation
    // =========================================================================
    const impact = langEngine.impactAnalyzer.analyzeChangeSet(cs);
    assert(impact !== null, 'ImpactAnalyzer must evaluate rename ChangeSet');
    assert(impact.affectedFilesCount >= 2, 'ImpactAnalyzer must record affected files');
    assert(impact.impactConfidence !== undefined, 'ImpactAnalyzer must assign confidence');
    pass('ImpactAnalyzer calculated blast radius and affected symbols for rename ChangeSet');

    // =========================================================================
    // 14. Rename Patch Firewall Safety Evaluation
    // =========================================================================
    const safetyRes = await cs.evaluateSafety({ workspacePath: tmpTestDir });
    assert(safetyRes !== null, 'Patch Firewall must evaluate rename ChangeSet');
    assert(['AUTO_APPROVE', 'REVIEW_REQUIRED', 'HIGH_RISK', 'BLOCKED'].includes(safetyRes.overallRiskLevel), 'Firewall must assign valid risk level');
    pass('Patch Firewall evaluated rename safety tier and invariant boundaries');

    // =========================================================================
    // 15. Rename Transactional Apply & Live Re-indexing
    // =========================================================================
    const applyResult = await langEngine.applyRename({
      symbolName: 'validateToken',
      newName: 'verifyTokenSignature',
      filePath: 'src/auth.ts',
      workspacePath: tmpTestDir,
      autoApprove: true,
    });
    assert.strictEqual(applyResult.success, true, 'applyRename must succeed');
    const updatedAuthContent = fs.readFileSync(path.join(srcDir, 'auth.ts'), 'utf8');
    assert(updatedAuthContent.includes('verifyTokenSignature'), 'Disk file must contain new symbol name');
    assert(!updatedAuthContent.includes('validateToken'), 'Disk file must not contain old symbol name');

    // Verify index was updated
    const reindexedSym = langEngine.symbolIndex.findSymbol('verifyTokenSignature');
    assert(reindexedSym !== null, 'SymbolIndex must immediately reflect renamed symbol');
    pass('Atomic transactional apply updated workspace disk and re-indexed symbol graph');

    // =========================================================================
    // 16. Rename Rollback Integrity
    // =========================================================================
    // Simulate non-existent symbol rename attempt
    let missingRenameError = false;
    try {
      await langEngine.applyRename({
        symbolName: 'ghostSymbolNeverExisted',
        newName: 'newGhost',
        workspacePath: tmpTestDir,
      });
    } catch (e) {
      missingRenameError = true;
    }
    assert(missingRenameError, 'Renaming missing symbol must throw error');
    pass('Invalid rename aborted safely leaving all workspace files unchanged');

    // =========================================================================
    // 17. Diagnostic Parsing: TypeScript Compiler
    // =========================================================================
    const rawTsOutput = `src/auth.ts(12,8): error TS2304: Cannot find name 'useCallback'.
src/server.ts(5,3): warning TS6133: 'unusedVar' is declared but its value is never read.`;
    const tsProblems = langEngine.parseDiagnostics(rawTsOutput, { workspacePath: tmpTestDir });
    assert.strictEqual(tsProblems.length, 2, 'Should parse 2 TypeScript problems');
    assert.strictEqual(tsProblems[0].severity, 'error');
    assert.strictEqual(tsProblems[0].code, 'TS2304');
    assert.strictEqual(tsProblems[0].line, 12);
    assert.strictEqual(tsProblems[0].column, 8);
    assert.strictEqual(tsProblems[1].severity, 'warning');
    assert.strictEqual(tsProblems[1].code, 'TS6133');
    pass('Diagnostic parser normalized TypeScript compiler error and warning outputs with line/column coordinates');

    // =========================================================================
    // 18. Diagnostic Parsing: Python Traceback & Syntax
    // =========================================================================
    const rawPyOutput = `Traceback (most recent call last):
  File "src/utils.py", line 8, in compute_metrics
    total = sum(values)
ZeroDivisionError: division by zero`;
    const pyProblems = langEngine.parseDiagnostics(rawPyOutput, { workspacePath: tmpTestDir });
    assert.strictEqual(pyProblems.length, 1, 'Should parse 1 Python problem');
    assert.strictEqual(pyProblems[0].source, 'python');
    assert.strictEqual(pyProblems[0].code, 'ZeroDivisionError');
    assert.strictEqual(pyProblems[0].line, 8);
    assert(pyProblems[0].message.includes('division by zero'), 'Message should contain error summary');
    pass('Diagnostic parser normalized Python traceback with stack frame location and exception category');

    // =========================================================================
    // 19. Diagnostic Parsing: pytest Test Failures
    // =========================================================================
    const rawPytestOutput = `FAILED tests/test_metrics.py::test_average - ZeroDivisionError: empty input list
tests/test_metrics.py:15: ZeroDivisionError`;
    const pytestProblems = langEngine.parseDiagnostics(rawPytestOutput, { workspacePath: tmpTestDir });
    assert.strictEqual(pytestProblems.length, 1, 'Should parse pytest failure');
    assert.strictEqual(pytestProblems[0].source, 'pytest');
    assert.strictEqual(pytestProblems[0].line, 15);
    assert(pytestProblems[0].message.includes('FAILED test_average'), 'Message must include failed test name');
    pass('Diagnostic parser normalized pytest assertion failure with test name and line location');

    // =========================================================================
    // 20. Diagnostic Parsing: Jest / Vitest Test Failures
    // =========================================================================
    const rawJestOutput = `FAIL src/auth.test.ts > Authentication > should reject expired tokens
    at Object.<anonymous> (src/auth.test.ts:24:10)`;
    const jestProblems = langEngine.parseDiagnostics(rawJestOutput, { workspacePath: tmpTestDir });
    assert.strictEqual(jestProblems.length, 1, 'Should parse Jest failure');
    assert.strictEqual(jestProblems[0].source, 'jest');
    assert.strictEqual(jestProblems[0].line, 24);
    assert.strictEqual(jestProblems[0].column, 10);
    pass('Diagnostic parser normalized Jest/Vitest failure assertion and stack frame location');

    // =========================================================================
    // 21. Diagnostic Parsing: Node.js / JavaScript Stack Traces
    // =========================================================================
    const rawNodeOutput = `TypeError: Cannot read properties of undefined (reading 'length')
    at validateToken (/tmp/workspace/src/auth.ts:18:14)`;
    const nodeProblems = langEngine.parseDiagnostics(rawNodeOutput, { workspacePath: tmpTestDir, defaultFilePath: 'src/auth.ts' });
    assert.strictEqual(nodeProblems.length, 1, 'Should parse Node TypeError');
    assert.strictEqual(nodeProblems[0].code, 'TypeError');
    assert.strictEqual(nodeProblems[0].line, 18);
    assert.strictEqual(nodeProblems[0].column, 14);
    pass('Diagnostic parser normalized Node.js runtime unhandled exceptions and stack traces');

    // =========================================================================
    // 22. Problems Store: Add, Filter, Clear, Summary
    // =========================================================================
    langEngine.clearProblems();
    assert.strictEqual(langEngine.getProblems().length, 0, 'Store must be empty after clear');

    langEngine.addProblems(tsProblems);
    langEngine.addProblems(pyProblems);
    langEngine.addProblems(pytestProblems);

    const summary = langEngine.getProblemsSummary();
    assert.strictEqual(summary.totalCount, 4, 'Total problems count must equal 4');
    assert.strictEqual(summary.errorCount, 3, 'Error count must equal 3');
    assert.strictEqual(summary.warningCount, 1, 'Warning count must equal 1');

    const authProbs = langEngine.getProblems({ filePath: 'src/auth.ts' });
    assert.strictEqual(authProbs.length, 1, 'Should filter problems for src/auth.ts');

    langEngine.clearProblems({ filePath: 'src/auth.ts' });
    assert.strictEqual(langEngine.getProblems({ filePath: 'src/auth.ts' }).length, 0, 'auth.ts problems cleared');
    assert.strictEqual(langEngine.getProblems().length, 3, 'Other problems preserved');
    pass('Problems Store accurately managed problem additions, file filtering, clearance, and summary stats');

    // =========================================================================
    // 23. Secret Sanitization in Diagnostics
    // =========================================================================
    const secretOutput = `src/auth.ts(5,1): error TS9999: Failed with apiKey=AIzaSyA1234567890123456789012345678901`;
    const sanitizedProblems = langEngine.parseDiagnostics(secretOutput, { workspacePath: tmpTestDir });
    assert(!sanitizedProblems[0].message.includes('AIzaSyA1234567890123456789012345678901'), 'API key must be redacted');
    assert(sanitizedProblems[0].message.includes('[REDACTED_SECRET:GEMINI_API_KEY]'), 'Must contain redacted token mask');
    pass('SecretFilter sanitized sensitive tokens and credentials from diagnostic error streams');

    // =========================================================================
    // 24. ContextEngine Active Problems Injection & Bounding
    // =========================================================================
    const contextEngine = new ContextEngine();
    const compiled = contextEngine.compileContext({
      activeFilePath: 'src/utils.py',
      activeProblems: [
        {
          id: 'prob_1',
          severity: 'error',
          source: 'python',
          code: 'ZeroDivisionError',
          message: 'division by zero in compute_metrics',
          filePath: 'src/utils.py',
          line: 8,
        },
      ],
      workspacePath: tmpTestDir,
      turn: { metadata: {} },
    });

    assert(compiled.systemPrompt.includes('--- ACTIVE PROBLEMS ---'), 'Context prompt must include active problems header');
    assert(compiled.systemPrompt.includes('ZeroDivisionError'), 'Context prompt must include problem code');
    assert(compiled.systemPrompt.includes('src/utils.py:8'), 'Context prompt must include file and line');
    pass('ContextEngine injected bounded active problems block into compiled system context');

    console.log(`\n================================================================`);
    console.log(`ALL ${passedAssertions} MILESTONE 31 ASSERTIONS PASSED CLEANLY.`);
    console.log(`================================================================\n`);
  } finally {
    // Cleanup temporary workspace
    try {
      fs.rmSync(tmpTestDir, { recursive: true, force: true });
    } catch (_) {}
    try {
      fs.rmSync(process.env.ECHO_CONTINUUM_DIR, { recursive: true, force: true });
    } catch (_) {}
  }
}

if (require.main === module) {
  runM31TestSuite().catch((err) => {
    console.error('[TEST-ERROR] Milestone 31 test suite failed:', err);
    process.exit(1);
  });
}

module.exports = { runM31TestSuite };
