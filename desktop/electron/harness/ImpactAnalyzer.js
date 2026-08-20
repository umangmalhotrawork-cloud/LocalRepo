/**
 * NEXUS CODEX HARNESS - CROSS-FILE BLAST-RADIUS & SEMANTIC REFACTORING ANALYZER (Milestone 20)
 * 
 * Leverages RepositorySymbolIndex and ASTDiffEngine to perform advisory,
 * repository-wide impact analysis and refactoring planning.
 * 
 * Advisory / Analysis-only:
 * - Does not directly write files or mutate workspace disk.
 * - Does not bypass ChangeSet or Patch Firewall.
 * - Bounded traversal (maxDepth, maxNodes, maxFiles).
 * - Distinguishes DIRECT, STRUCTURAL, and HEURISTIC confidence.
 */

const path = require('path');
const {
  SYMBOL_KIND,
  RELATIONSHIP_TYPE,
  IMPACT_CONFIDENCE,
  IMPACT_CATEGORY,
  EVENT_TYPES,
} = require('./types');
const { repositorySymbolIndex } = require('./RepositorySymbolIndex');
const { astDiffEngine } = require('./ASTDiffEngine');
const secretFilter = require('../../security/secretFilter');

let evidenceGraphInstance = null;
try {
  const { evidenceGraph } = require('../evidence/EvidenceGraph');
  evidenceGraphInstance = evidenceGraph;
} catch (e) {}

class ImpactAnalyzer {
  constructor(options = {}) {
    this.symbolIndex = options.symbolIndex || repositorySymbolIndex;
    this.astDiffEngine = options.astDiffEngine || astDiffEngine;
    this.eventBus = options.eventBus || null;
    this.evidenceGraph = options.evidenceGraph || evidenceGraphInstance;

    this.defaultMaxDepth = options.maxDepth || 5;
    this.defaultMaxNodes = options.maxNodes || 100;
    this.defaultMaxFiles = options.maxFiles || 50;
  }

  setEventBus(eventBus) {
    this.eventBus = eventBus;
  }

  setSymbolIndex(symbolIndex) {
    this.symbolIndex = symbolIndex;
  }

  /**
   * Analyzes the blast-radius and impact of modifying a specific symbol.
   * @param {string} symbolIdOrName
   * @param {Object} [options]
   * @returns {Object} Structured impact analysis result
   */
  analyzeSymbol(symbolIdOrName, options = {}) {
    const maxDepth = options.maxDepth || this.defaultMaxDepth;
    const maxNodes = options.maxNodes || this.defaultMaxNodes;
    const maxFiles = options.maxFiles || this.defaultMaxFiles;

    const startTime = Date.now();
    this._emit(EVENT_TYPES.IMPACT_ANALYSIS_STARTED, { target: symbolIdOrName, type: 'SYMBOL' });

    const rootSym = this.symbolIndex.getSymbol(symbolIdOrName) || this.symbolIndex.findSymbol(symbolIdOrName);
    const targetName = rootSym ? rootSym.name : symbolIdOrName;
    const rootFilePath = rootSym ? rootSym.filePath : null;

    const affectedSymbols = new Map(); // symbolId/name -> { symbol, category, confidence, depth }
    const affectedFiles = new Set();
    const callers = [];
    const callees = [];
    const dependents = new Set();
    const dependencies = new Set();
    const tests = [];
    const warnings = [];

    if (rootFilePath) {
      affectedFiles.add(rootFilePath);
    }

    // 1. Direct callers & callees
    const directCallers = this.symbolIndex.getCallers(symbolIdOrName);
    for (const c of directCallers) {
      callers.push({
        ...c,
        category: IMPACT_CATEGORY.DIRECT_CALLER,
        confidence: c.confidence || IMPACT_CONFIDENCE.DIRECT,
        depth: 1,
      });
      if (c.sourceFilePath) affectedFiles.add(c.sourceFilePath);
    }

    if (rootSym) {
      const directCallees = this.symbolIndex.getCallees(rootSym.symbolId);
      for (const c of directCallees) {
        callees.push({
          ...c,
          category: 'DIRECT_CALLEE',
          confidence: c.confidence || IMPACT_CONFIDENCE.DIRECT,
        });
      }
    }

    // 2. Transitive graph traversal for indirect callers
    const visited = new Set();
    const queue = directCallers.map((c) => ({
      name: c.targetName || targetName,
      file: c.sourceFilePath,
      depth: 1,
    }));

    while (queue.length > 0 && affectedSymbols.size < maxNodes && affectedFiles.size < maxFiles) {
      const curr = queue.shift();
      const key = `${curr.file}:${curr.name}:${curr.depth}`;
      if (visited.has(key) || curr.depth >= maxDepth) continue;
      visited.add(key);

      // Find callers of current caller file symbols
      const fileSyms = this.symbolIndex.getFileSymbols(curr.file);
      for (const fsym of fileSyms) {
        if (affectedSymbols.size >= maxNodes) break;

        const nextCallers = this.symbolIndex.getCallers(fsym.symbolId);
        for (const nc of nextCallers) {
          if (!callers.some((ex) => ex.sourceFilePath === nc.sourceFilePath && ex.line === nc.line)) {
            callers.push({
              ...nc,
              category: IMPACT_CATEGORY.TRANSITIVE_CALLER,
              confidence: IMPACT_CONFIDENCE.STRUCTURAL,
              depth: curr.depth + 1,
            });
            if (nc.sourceFilePath) affectedFiles.add(nc.sourceFilePath);

            queue.push({
              name: nc.targetName || fsym.name,
              file: nc.sourceFilePath,
              depth: curr.depth + 1,
            });
          }
        }
      }
    }

    // 3. Module level dependents & dependencies
    if (rootFilePath) {
      for (const dep of this.symbolIndex.getDependents(rootFilePath)) {
        dependents.add(dep);
        affectedFiles.add(dep);
      }
      for (const dep of this.symbolIndex.getDependencies(rootFilePath)) {
        dependencies.add(dep);
      }
    }

    // 4. Test discovery
    for (const f of affectedFiles) {
      if (this._isTestFile(f)) {
        tests.push({
          filePath: rootFilePath,
          testPath: f,
          confidence: IMPACT_CONFIDENCE.DIRECT,
          reason: 'TEST_DIRECTLY_TOUCHED',
        });
      }
    }

    for (const dep of dependents) {
      if (this._isTestFile(dep)) {
        if (!tests.some((t) => t.testPath === dep)) {
          tests.push({
            filePath: rootFilePath,
            testPath: dep,
            confidence: IMPACT_CONFIDENCE.STRUCTURAL,
            reason: 'TEST_IMPORTS_TARGET',
          });
        }
      }
    }

    // Heuristic test matching (e.g. auth.ts -> tests/auth.test.ts or test_auth.py)
    if (rootFilePath) {
      const baseName = path.basename(rootFilePath, path.extname(rootFilePath));
      for (const knownFile of this.symbolIndex.fileSymbols.keys()) {
        if (this._isTestFile(knownFile) && knownFile.toLowerCase().includes(baseName.toLowerCase())) {
          if (!tests.some((t) => t.testPath === knownFile)) {
            tests.push({
              filePath: rootFilePath,
              testPath: knownFile,
              confidence: IMPACT_CONFIDENCE.HEURISTIC,
              reason: 'HEURISTIC_FILENAME_MATCH',
            });
          }
        }
      }
    }

    // 5. Warnings and advisory checks
    if (rootSym && rootSym.exported && callers.length === 0 && dependents.size > 0) {
      warnings.push({
        code: 'EXPORT_POTENTIAL_EXTERNAL_USE',
        level: 'LOW',
        message: `Exported symbol "${targetName}" has no detected internal callers, but module is imported by ${dependents.size} files`,
      });
    }

    if (callers.length > 10) {
      warnings.push({
        code: 'HIGH_FANOUT_SYMBOL',
        level: 'MEDIUM',
        message: `Symbol "${targetName}" is referenced across ${callers.length} call sites; changes require wide test verification`,
      });
    }

    const confidence = callers.length > 0
      ? IMPACT_CONFIDENCE.DIRECT
      : affectedFiles.size > 0
      ? IMPACT_CONFIDENCE.STRUCTURAL
      : IMPACT_CONFIDENCE.HEURISTIC;

    const result = {
      rootTargets: [targetName],
      rootSymbol: rootSym,
      affectedSymbols: Array.from(affectedSymbols.values()),
      affectedFiles: Array.from(affectedFiles),
      callers,
      callees,
      dependents: Array.from(dependents),
      dependencies: Array.from(dependencies),
      tests,
      exports: rootFilePath ? this.symbolIndex.getExports(rootFilePath) : [],
      confidence,
      warnings,
      limits: { maxDepth, maxNodes, maxFiles },
      durationMs: Date.now() - startTime,
    };

    result.refactorPlan = this.generateRefactorPlan(result, { target: targetName });

    this._emit(EVENT_TYPES.IMPACT_ANALYSIS_COMPLETED, result);
    this._recordEvidence('SYMBOL_IMPACT', result);

    return result;
  }

  /**
   * Analyzes impact for an entire file.
   * @param {string} filePath
   * @param {Object} [options]
   * @returns {Object}
   */
  analyzeFile(filePath, options = {}) {
    const relPath = this.symbolIndex._normalizeRelativePath(filePath);
    const fileSyms = this.symbolIndex.getFileSymbols(relPath);

    const directDependents = this.symbolIndex.getDependents(relPath);
    const dependencies = this.symbolIndex.getDependencies(relPath);
    const exports = this.symbolIndex.getExports(relPath);

    const callers = [];
    for (const sym of fileSyms) {
      const symCallers = this.symbolIndex.getCallers(sym.symbolId);
      for (const c of symCallers) {
        callers.push({
          ...c,
          targetSymbol: sym.name,
          category: IMPACT_CATEGORY.DIRECT_CALLER,
        });
      }
    }

    const affectedFiles = new Set([relPath, ...directDependents]);
    const tests = [];

    for (const dep of directDependents) {
      if (this._isTestFile(dep)) {
        tests.push({
          filePath: relPath,
          testPath: dep,
          confidence: IMPACT_CONFIDENCE.STRUCTURAL,
          reason: 'TEST_DEPENDS_ON_FILE',
        });
      }
    }

    const result = {
      rootTargets: [relPath],
      affectedSymbols: fileSyms,
      affectedFiles: Array.from(affectedFiles),
      callers,
      dependents: directDependents,
      dependencies,
      tests,
      exports,
      confidence: callers.length > 0 ? IMPACT_CONFIDENCE.DIRECT : IMPACT_CONFIDENCE.STRUCTURAL,
      warnings: [],
      limits: { maxDepth: 1, maxFiles: 50 },
    };

    result.refactorPlan = this.generateRefactorPlan(result, { target: relPath });
    return result;
  }

  /**
   * Evaluates downstream blast radius for a ChangeSet.
   * @param {Object} changeSet
   * @param {Object} [options]
   * @returns {Object} ChangeSet impact summary
   */
  analyzeChangeSet(changeSet, options = {}) {
    if (!changeSet || !Array.isArray(changeSet.files)) {
      return {
        affectedSymbolsCount: 0,
        affectedFilesCount: 0,
        directCallerCount: 0,
        transitiveCallerCount: 0,
        testCount: 0,
        impactConfidence: IMPACT_CONFIDENCE.HEURISTIC,
        warnings: [],
      };
    }

    const allAffectedFiles = new Set();
    const allCallers = [];
    const allTests = new Set();
    const warnings = [];
    let hasSignatureChange = false;

    for (const file of changeSet.files) {
      allAffectedFiles.add(file.filePath);

      // Perform AST diff if original & replacement exist
      if (file.original && file.replacement) {
        const astDiff = this.astDiffEngine.compare(file.original, file.replacement, '', file.filePath);

        // Check for signature changes
        if (astDiff.summary?.signatureChanges?.length > 0) {
          hasSignatureChange = true;
          for (const sig of astDiff.summary.signatureChanges) {
            const symImpact = this.analyzeSymbol(sig.name, { maxDepth: 2 });
            for (const c of symImpact.callers) allCallers.push(c);
            for (const t of symImpact.tests) allTests.add(t.testPath);
            for (const f of symImpact.affectedFiles) allAffectedFiles.add(f);

            warnings.push({
              code: 'SIGNATURE_CHANGE_AFFECTS_CALLERS',
              level: 'HIGH',
              message: `Signature change in "${sig.name}" impacts ${symImpact.callers.length} downstream call sites`,
            });
          }
        }

        // Check for removed functions
        if (astDiff.summary?.removedFunctions?.length > 0) {
          for (const rf of astDiff.summary.removedFunctions) {
            const callers = this.symbolIndex.getCallers(rf.name);
            if (callers.length > 0) {
              warnings.push({
                code: 'DELETED_FUNCTION_HAS_ACTIVE_CALLERS',
                level: 'HIGH',
                message: `Function "${rf.name}" was removed but has ${callers.length} active callers in repository`,
              });
            }
          }
        }
      }

      // Check file dependents
      const fileImpact = this.analyzeFile(file.filePath);
      for (const dep of fileImpact.dependents) allAffectedFiles.add(dep);
      for (const t of fileImpact.tests) allTests.add(t.testPath);
    }

    return {
      affectedSymbolsCount: allCallers.length,
      affectedFilesCount: allAffectedFiles.size,
      directCallerCount: allCallers.filter((c) => c.category === IMPACT_CATEGORY.DIRECT_CALLER).length,
      transitiveCallerCount: allCallers.filter((c) => c.category === IMPACT_CATEGORY.TRANSITIVE_CALLER).length,
      testCount: allTests.size,
      tests: Array.from(allTests),
      impactConfidence: allCallers.length > 0 ? IMPACT_CONFIDENCE.DIRECT : IMPACT_CONFIDENCE.STRUCTURAL,
      hasSignatureChange,
      warnings,
    };
  }

  /**
   * Generates a structured advisory refactoring plan.
   * @param {Object} impactResult
   * @param {Object} [options]
   * @returns {Object} Advisory plan
   */
  generateRefactorPlan(impactResult, options = {}) {
    const target = options.target || impactResult.rootTargets?.[0] || 'Target';
    const callers = impactResult.callers || [];
    const dependents = impactResult.dependents || [];
    const tests = impactResult.tests || [];

    const requiredUpdates = [];
    const recommendedOrder = [];

    // Step 1: Root target modification
    requiredUpdates.push(`Update definition and signature in ${impactResult.rootTargets?.[0] || target}`);
    recommendedOrder.push(`1. Edit definition of ${target}`);

    // Step 2: Direct caller updates
    if (callers.length > 0) {
      const callerFiles = Array.from(new Set(callers.map((c) => c.sourceFilePath)));
      requiredUpdates.push(`Update ${callers.length} call site(s) across: ${callerFiles.join(', ')}`);
      recommendedOrder.push(`2. Refactor direct callers in ${callerFiles.slice(0, 3).join(', ')}${callerFiles.length > 3 ? ` (+${callerFiles.length - 3} more)` : ''}`);
    }

    // Step 3: Dependent module verification
    if (dependents.length > 0) {
      requiredUpdates.push(`Verify export consumers in ${dependents.slice(0, 4).join(', ')}`);
      recommendedOrder.push(`3. Verify importing modules and type signatures`);
    }

    // Step 4: Targeted test execution
    if (tests.length > 0) {
      const testFiles = tests.map((t) => t.testPath);
      requiredUpdates.push(`Run targeted test suites: ${testFiles.join(', ')}`);
      recommendedOrder.push(`4. Run targeted tests (${testFiles.slice(0, 3).join(', ')})`);
    } else {
      recommendedOrder.push(`4. Run broader project test suite`);
    }

    recommendedOrder.push(`5. Execute Patch Firewall safety check and create ChangeSet`);

    return {
      goal: `Refactor ${target}`,
      rootTargets: impactResult.rootTargets || [target],
      requiredUpdates,
      likelyAffectedFiles: impactResult.affectedFiles || [],
      testsToRun: tests.map((t) => t.testPath),
      riskLevel: callers.length > 5 || impactResult.warnings?.length > 0 ? 'HIGH' : 'MEDIUM',
      warnings: impactResult.warnings || [],
      recommendedOrder,
    };
  }

  /**
   * Formats compact markdown section for ContextEngine.
   * @param {Object} impactResult
   * @returns {string}
   */
  formatContextIntelligence(impactResult = {}) {
    const lines = [];
    lines.push('## REPOSITORY IMPACT (Advisory)');
    lines.push(`- **Root Target**: ${impactResult.rootTargets?.join(', ') || 'N/A'}`);
    lines.push(`- **Confidence**: ${impactResult.confidence || 'STRUCTURAL'}`);

    if (impactResult.callers && impactResult.callers.length > 0) {
      lines.push(`- **Direct Call Sites (${impactResult.callers.length})**:`);
      for (const c of impactResult.callers.slice(0, 5)) {
        lines.push(`  - \`${c.sourceFilePath}:${c.line || 1}\` (${c.category})`);
      }
      if (impactResult.callers.length > 5) {
        lines.push(`  - *(+${impactResult.callers.length - 5} more call sites)*`);
      }
    }

    if (impactResult.dependents && impactResult.dependents.length > 0) {
      lines.push(`- **Dependent Files**: ${impactResult.dependents.slice(0, 5).join(', ')}`);
    }

    if (impactResult.tests && impactResult.tests.length > 0) {
      lines.push(`- **Likely Affected Tests**: ${impactResult.tests.map((t) => t.testPath).slice(0, 4).join(', ')}`);
    }

    if (impactResult.warnings && impactResult.warnings.length > 0) {
      lines.push('- **Advisory Warnings**:');
      for (const w of impactResult.warnings) {
        lines.push(`  - [${w.level}] ${w.message}`);
      }
    }

    return lines.join('\n');
  }

  _isTestFile(filePath = '') {
    const lower = filePath.toLowerCase();
    return (
      lower.includes('.test.') ||
      lower.includes('.spec.') ||
      lower.startsWith('tests/') ||
      lower.startsWith('test/') ||
      lower.includes('/tests/') ||
      lower.includes('/test/') ||
      lower.startsWith('test_') ||
      lower.endsWith('_test.py')
    );
  }

  _emit(eventType, payload) {
    if (this.eventBus) {
      try {
        this.eventBus.emit(eventType, secretFilter.sanitizeObject(payload));
      } catch (e) {}
    }
  }

  _recordEvidence(statement, metadata) {
    if (this.evidenceGraph) {
      try {
        this.evidenceGraph.addNode({
          sessionId: 'harness_impact_analyzer',
          type: 'INFERENCE',
          statement: `Impact analysis for ${metadata.rootTargets?.join(', ')}: ${metadata.affectedFiles?.length || 0} files affected`,
          provenanceClass: 'STATIC_ANALYSIS',
          verificationLevel: 'UNVERIFIED',
          metadata: secretFilter.sanitizeObject(metadata),
        });
      } catch (e) {}
    }
  }
}

const impactAnalyzer = new ImpactAnalyzer();

module.exports = {
  ImpactAnalyzer,
  impactAnalyzer,
};
