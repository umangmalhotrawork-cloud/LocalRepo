/**
 * NEXUS CODEX HARNESS - AST-LEVEL SEMANTIC DIFF ENGINE (Milestone 18B)
 * 
 * Provides AST-aware structural analysis and comparison for ChangeSets,
 * 3-way merge conflict hunks, and SurgeryDiff visualization.
 * 
 * Analysis-only module:
 * - Does not directly write files or mutate workspace disk.
 * - Does not bypass ChangeSet or Patch Firewall.
 * - Fallback to TEXT_DIFF_ONLY on malformed syntax or size limits.
 */

const path = require('path');
const secretFilter = require('../../security/secretFilter');

let ts = null;
try {
  ts = require('typescript');
} catch (e) {}

const SUPPORTED_LANGUAGES = Object.freeze({
  PYTHON: 'python',
  TYPESCRIPT: 'typescript',
  TSX: 'tsx',
  JAVASCRIPT: 'javascript',
  JSX: 'jsx',
});

const NODE_CHANGE_TYPES = Object.freeze({
  ADDED: 'ADDED',
  REMOVED: 'REMOVED',
  MODIFIED: 'MODIFIED',
  MOVED: 'MOVED',
  UNCHANGED: 'UNCHANGED',
});

const MAX_PARSE_SIZE_BYTES = 2 * 1024 * 1024; // 2MB limit
const MAX_NODE_COUNT = 15000;

class ASTDiffEngine {
  constructor(options = {}) {
    this.maxSizeBytes = options.maxSizeBytes || MAX_PARSE_SIZE_BYTES;
    this.maxNodeCount = options.maxNodeCount || MAX_NODE_COUNT;
  }

  /**
   * Detects programming language from file path or snippet cues.
   * @param {string} filePath
   * @param {string} [source]
   * @returns {string} Normalized language identifier
   */
  detectLanguage(filePath = '', source = '') {
    const ext = path.extname(filePath || '').toLowerCase();
    if (ext === '.py') return SUPPORTED_LANGUAGES.PYTHON;
    if (ext === '.ts') return SUPPORTED_LANGUAGES.TYPESCRIPT;
    if (ext === '.tsx') return SUPPORTED_LANGUAGES.TSX;
    if (ext === '.js' || ext === '.mjs' || ext === '.cjs') return SUPPORTED_LANGUAGES.JAVASCRIPT;
    if (ext === '.jsx') return SUPPORTED_LANGUAGES.JSX;

    if (source.includes('def ') || source.includes('import ') && source.includes(':')) {
      return SUPPORTED_LANGUAGES.PYTHON;
    }
    if (source.includes('interface ') || source.includes(': string') || source.includes(': number')) {
      return SUPPORTED_LANGUAGES.TYPESCRIPT;
    }
    return SUPPORTED_LANGUAGES.JAVASCRIPT;
  }

  /**
   * Parses source text into a normalized AST representation.
   * @param {string} source
   * @param {string} [language]
   * @param {string} [filePath]
   * @returns {Object} { success: boolean, nodes: Array<Object>, language: string, error?: string }
   */
  parse(source = '', language = '', filePath = '') {
    if (typeof source !== 'string') {
      source = String(source || '');
    }

    if (Buffer.byteLength(source, 'utf8') > this.maxSizeBytes) {
      return {
        success: false,
        fallback: true,
        mode: 'TEXT_DIFF_ONLY',
        error: `Source exceeds maximum AST parse size of ${this.maxSizeBytes} bytes`,
        nodes: [],
        language,
      };
    }

    const detectedLang = language || this.detectLanguage(filePath, source);

    try {
      if (detectedLang === SUPPORTED_LANGUAGES.PYTHON) {
        return this._parsePython(source, filePath);
      }
      return this._parseJSorTS(source, detectedLang, filePath);
    } catch (err) {
      return {
        success: false,
        fallback: true,
        mode: 'TEXT_DIFF_ONLY',
        error: `AST parse error: ${err.message}`,
        nodes: [],
        language: detectedLang,
      };
    }
  }

  /**
   * Parses JavaScript / TypeScript / TSX using TypeScript Compiler API.
   * @private
   */
  _parseJSorTS(source, language, filePath) {
    if (!ts) {
      return this._parseFallbackRegex(source, language);
    }

    const scriptKind = language === SUPPORTED_LANGUAGES.TSX
      ? ts.ScriptKind.TSX
      : language === SUPPORTED_LANGUAGES.JSX
      ? ts.ScriptKind.JSX
      : language === SUPPORTED_LANGUAGES.TYPESCRIPT
      ? ts.ScriptKind.TS
      : ts.ScriptKind.JS;

    const sourceFile = ts.createSourceFile(
      filePath || `temp.${language === SUPPORTED_LANGUAGES.TYPESCRIPT ? 'ts' : 'js'}`,
      source,
      ts.ScriptTarget.Latest,
      true,
      scriptKind
    );

    const nodes = [];
    let nodeIdSeq = 0;

    const visit = (node, parentNodeId = null) => {
      if (nodes.length >= this.maxNodeCount) return;

      const { line: startLine, character: startCol } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
      const { line: endLine, character: endCol } = sourceFile.getLineAndCharacterOfPosition(node.getEnd());

      let type = null;
      let name = null;
      let signature = null;
      let parameters = [];

      if (ts.isFunctionDeclaration(node) || ts.isMethodDeclaration(node) || ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
        type = 'FunctionDeclaration';
        name = node.name ? node.name.getText(sourceFile) : 'anonymous';
        parameters = node.parameters ? node.parameters.map((p) => p.getText(sourceFile)) : [];
        signature = `${name}(${parameters.join(', ')})`;
      } else if (ts.isClassDeclaration(node)) {
        type = 'ClassDeclaration';
        name = node.name ? node.name.getText(sourceFile) : 'AnonymousClass';
      } else if (ts.isImportDeclaration(node)) {
        type = 'ImportDeclaration';
        name = node.moduleSpecifier ? node.moduleSpecifier.getText(sourceFile) : '';
      } else if (ts.isIfStatement(node) || ts.isForStatement(node) || ts.isForOfStatement(node) || ts.isWhileStatement(node) || ts.isTryStatement(node) || ts.isSwitchStatement(node)) {
        type = 'ControlFlow';
        name = ts.isIfStatement(node) ? 'if' : ts.isTryStatement(node) ? 'try' : ts.isSwitchStatement(node) ? 'switch' : 'loop';
      } else if (ts.isCallExpression(node)) {
        type = 'CallExpression';
        name = node.expression ? node.expression.getText(sourceFile) : '';
      } else if (ts.isReturnStatement(node)) {
        type = 'ReturnStatement';
      } else if (ts.isVariableDeclaration(node)) {
        type = 'VariableDeclaration';
        name = node.name ? node.name.getText(sourceFile) : '';
      }

      const currentId = `ts_node_${++nodeIdSeq}`;

      if (type) {
        nodes.push({
          nodeId: currentId,
          type,
          name: name ? secretFilter.sanitizeString(name) : undefined,
          signature: signature ? secretFilter.sanitizeString(signature) : undefined,
          parameters: parameters.map((p) => secretFilter.sanitizeString(p)),
          startLine: startLine + 1,
          startColumn: startCol + 1,
          endLine: endLine + 1,
          endColumn: endCol + 1,
          parentNodeId,
          rawText: secretFilter.sanitizeString(node.getText(sourceFile).slice(0, 300)),
        });
      }

      ts.forEachChild(node, (child) => visit(child, type ? currentId : parentNodeId));
    };

    visit(sourceFile);

    return {
      success: true,
      language,
      nodes,
    };
  }

  /**
   * Python structural parser.
   * Extracts function declarations, class declarations, imports, control-flow, calls, and returns.
   * @private
   */
  _parsePython(source, filePath) {
    const lines = source.split('\n');
    const nodes = [];
    let nodeIdSeq = 0;

    for (let i = 0; i < lines.length; i++) {
      if (nodes.length >= this.maxNodeCount) break;

      const lineNum = i + 1;
      const rawLine = lines[i];
      const trimmed = rawLine.trim();

      if (!trimmed || trimmed.startsWith('#')) continue;

      // 1. Function definition: def function_name(args):
      const funcMatch = rawLine.match(/^(\s*)def\s+([a-zA-Z0-9_]+)\s*\((.*?)\)\s*(?:->\s*([^:]+))?:/);
      if (funcMatch) {
        const indent = funcMatch[1].length;
        const name = funcMatch[2];
        const rawParams = funcMatch[3];
        const params = rawParams ? rawParams.split(',').map((p) => p.trim()).filter(Boolean) : [];
        const signature = `def ${name}(${params.join(', ')})`;

        // Find function end based on indentation
        let endLine = lineNum;
        for (let j = i + 1; j < lines.length; j++) {
          const nextTrim = lines[j].trim();
          if (!nextTrim || nextTrim.startsWith('#')) continue;
          const nextIndent = lines[j].search(/\S/);
          if (nextIndent !== -1 && nextIndent <= indent) {
            break;
          }
          endLine = j + 1;
        }

        nodes.push({
          nodeId: `py_node_${++nodeIdSeq}`,
          type: 'FunctionDeclaration',
          name,
          signature,
          parameters: params,
          startLine: lineNum,
          startColumn: indent + 1,
          endLine,
          endColumn: (lines[endLine - 1] || '').length + 1,
          rawText: lines.slice(i, Math.min(i + 15, endLine)).join('\n'),
        });
        continue;
      }

      // 2. Class definition: class ClassName(Base):
      const classMatch = rawLine.match(/^(\s*)class\s+([a-zA-Z0-9_]+)(?:\((.*?)\))?:/);
      if (classMatch) {
        const indent = classMatch[1].length;
        const name = classMatch[2];
        nodes.push({
          nodeId: `py_node_${++nodeIdSeq}`,
          type: 'ClassDeclaration',
          name,
          startLine: lineNum,
          startColumn: indent + 1,
          endLine: lineNum,
          endColumn: rawLine.length + 1,
          rawText: trimmed,
        });
        continue;
      }

      // 3. Import statements
      if (trimmed.startsWith('import ') || trimmed.startsWith('from ')) {
        nodes.push({
          nodeId: `py_node_${++nodeIdSeq}`,
          type: 'ImportDeclaration',
          name: trimmed,
          startLine: lineNum,
          startColumn: rawLine.search(/\S/) + 1,
          endLine: lineNum,
          endColumn: rawLine.length + 1,
          rawText: trimmed,
        });
        continue;
      }

      // 4. Control flow
      if (trimmed.startsWith('if ') || trimmed.startsWith('elif ') || trimmed.startsWith('else:') ||
          trimmed.startsWith('for ') || trimmed.startsWith('while ') ||
          trimmed.startsWith('try:') || trimmed.startsWith('except') || trimmed.startsWith('finally:')) {
        const flowName = trimmed.split(' ')[0].replace(':', '');
        nodes.push({
          nodeId: `py_node_${++nodeIdSeq}`,
          type: 'ControlFlow',
          name: flowName,
          startLine: lineNum,
          startColumn: rawLine.search(/\S/) + 1,
          endLine: lineNum,
          endColumn: rawLine.length + 1,
          rawText: trimmed,
        });
        continue;
      }

      // 5. Return statements
      if (trimmed.startsWith('return ') || trimmed === 'return') {
        nodes.push({
          nodeId: `py_node_${++nodeIdSeq}`,
          type: 'ReturnStatement',
          startLine: lineNum,
          startColumn: rawLine.search(/\S/) + 1,
          endLine: lineNum,
          endColumn: rawLine.length + 1,
          rawText: trimmed,
        });
        continue;
      }

      // 6. Call Expressions
      const callMatch = trimmed.match(/([a-zA-Z0-9_]+)\s*\(/);
      if (callMatch && !['def', 'class', 'if', 'elif', 'while', 'for', 'return'].includes(callMatch[1])) {
        nodes.push({
          nodeId: `py_node_${++nodeIdSeq}`,
          type: 'CallExpression',
          name: callMatch[1],
          startLine: lineNum,
          startColumn: rawLine.indexOf(callMatch[1]) + 1,
          endLine: lineNum,
          endColumn: rawLine.length + 1,
          rawText: trimmed,
        });
      }
    }

    return {
      success: true,
      language: SUPPORTED_LANGUAGES.PYTHON,
      nodes,
    };
  }

  /**
   * Fallback regex parser for environments where full compiler is unavailable.
   * @private
   */
  _parseFallbackRegex(source, language) {
    const lines = source.split('\n');
    const nodes = [];
    let seq = 0;

    for (let i = 0; i < lines.length; i++) {
      const lineNum = i + 1;
      const trimmed = lines[i].trim();
      const fnMatch = trimmed.match(/(?:function\s+([a-zA-Z0-9_]+)|const\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?\()/);
      if (fnMatch) {
        const name = fnMatch[1] || fnMatch[2];
        nodes.push({
          nodeId: `fallback_node_${++seq}`,
          type: 'FunctionDeclaration',
          name,
          startLine: lineNum,
          startColumn: 1,
          endLine: lineNum,
          endColumn: trimmed.length,
        });
      }
    }

    return {
      success: true,
      language,
      nodes,
    };
  }

  /**
   * Compares Base AST against Modified AST to compute structural differences.
   * @param {string} baseSource
   * @param {string} modifiedSource
   * @param {string} [language]
   * @param {string} [filePath]
   * @returns {Object} Structural diff result
   */
  compare(baseSource = '', modifiedSource = '', language = '', filePath = '') {
    const baseParse = this.parse(baseSource, language, filePath);
    const modParse = this.parse(modifiedSource, language, filePath);

    if (!baseParse.success || !modParse.success) {
      return {
        success: false,
        fallback: true,
        mode: 'TEXT_DIFF_ONLY',
        error: baseParse.error || modParse.error || 'AST parsing failed',
        summary: this.summarizeChanges({ changes: [] }),
      };
    }

    const baseNodes = baseParse.nodes;
    const modNodes = modParse.nodes;

    const baseFuncs = new Map();
    const modFuncs = new Map();
    const baseClasses = new Map();
    const modClasses = new Map();
    const baseImports = new Set();
    const modImports = new Set();

    for (const n of baseNodes) {
      if (n.type === 'FunctionDeclaration' && n.name) baseFuncs.set(n.name, n);
      if (n.type === 'ClassDeclaration' && n.name) baseClasses.set(n.name, n);
      if (n.type === 'ImportDeclaration') baseImports.add(n.name || n.rawText);
    }

    for (const n of modNodes) {
      if (n.type === 'FunctionDeclaration' && n.name) modFuncs.set(n.name, n);
      if (n.type === 'ClassDeclaration' && n.name) modClasses.set(n.name, n);
      if (n.type === 'ImportDeclaration') modImports.add(n.name || n.rawText);
    }

    const changes = [];
    const addedFunctions = [];
    const removedFunctions = [];
    const modifiedFunctions = [];
    const signatureChanges = [];
    const importChanges = [];
    const controlFlowChanges = [];
    const callSiteChanges = [];
    const riskHints = [];

    // 1. Function additions, removals, and modifications
    for (const [name, modFn] of modFuncs.entries()) {
      if (!baseFuncs.has(name)) {
        addedFunctions.push({ name, signature: modFn.signature, line: modFn.startLine });
        changes.push({
          type: NODE_CHANGE_TYPES.ADDED,
          category: 'FUNCTION',
          name,
          node: modFn,
        });
      } else {
        const baseFn = baseFuncs.get(name);
        const sigChanged = (baseFn.signature || '') !== (modFn.signature || '') ||
          JSON.stringify(baseFn.parameters || []) !== JSON.stringify(modFn.parameters || []);
        const bodyChanged = (baseFn.rawText || '') !== (modFn.rawText || '');

        if (sigChanged) {
          signatureChanges.push({
            name,
            baseSignature: baseFn.signature,
            modifiedSignature: modFn.signature,
            baseParameters: baseFn.parameters,
            modifiedParameters: modFn.parameters,
          });
          riskHints.push({
            level: 'MEDIUM',
            message: `Function signature changed for "${name}": (${(baseFn.parameters || []).join(', ')}) -> (${(modFn.parameters || []).join(', ')})`,
          });
        }

        if (bodyChanged || sigChanged) {
          modifiedFunctions.push({
            name,
            signatureChanged: sigChanged,
            line: modFn.startLine,
            changes: sigChanged ? ['SIGNATURE_CHANGED', 'BODY_MODIFIED'] : ['BODY_MODIFIED'],
          });
          changes.push({
            type: NODE_CHANGE_TYPES.MODIFIED,
            category: 'FUNCTION',
            name,
            signatureChanged: sigChanged,
            baseNode: baseFn,
            modifiedNode: modFn,
          });
        }
      }
    }

    for (const [name, baseFn] of baseFuncs.entries()) {
      if (!modFuncs.has(name)) {
        removedFunctions.push({ name, line: baseFn.startLine });
        changes.push({
          type: NODE_CHANGE_TYPES.REMOVED,
          category: 'FUNCTION',
          name,
          node: baseFn,
        });
        riskHints.push({
          level: 'HIGH',
          message: `Function "${name}" was removed; check for existing callers`,
        });
      }
    }

    // 2. Import changes
    for (const imp of modImports) {
      if (!baseImports.has(imp)) {
        importChanges.push({ name: imp, type: 'ADDED' });
        changes.push({ type: NODE_CHANGE_TYPES.ADDED, category: 'IMPORT', name: imp });
      }
    }
    for (const imp of baseImports) {
      if (!modImports.has(imp)) {
        importChanges.push({ name: imp, type: 'REMOVED' });
        changes.push({ type: NODE_CHANGE_TYPES.REMOVED, category: 'IMPORT', name: imp });
      }
    }

    // 3. Control Flow Changes
    const baseFlowCount = baseNodes.filter((n) => n.type === 'ControlFlow').length;
    const modFlowCount = modNodes.filter((n) => n.type === 'ControlFlow').length;
    if (baseFlowCount !== modFlowCount) {
      controlFlowChanges.push({
        type: modFlowCount > baseFlowCount ? 'BRANCH_ADDED' : 'BRANCH_REMOVED',
        baseCount: baseFlowCount,
        modifiedCount: modFlowCount,
      });
      riskHints.push({
        level: 'LOW',
        message: `Control-flow branches modified (was ${baseFlowCount}, now ${modFlowCount})`,
      });
    }

    // 4. Call Site Changes
    const baseCalls = new Set(baseNodes.filter((n) => n.type === 'CallExpression').map((n) => n.name));
    const modCalls = new Set(modNodes.filter((n) => n.type === 'CallExpression').map((n) => n.name));
    for (const c of modCalls) {
      if (!baseCalls.has(c)) {
        callSiteChanges.push({ callName: c, type: 'ADDED' });
      }
    }

    const summary = {
      changedNodes: changes.length,
      addedFunctions,
      removedFunctions,
      modifiedFunctions,
      signatureChanges,
      importChanges,
      controlFlowChanges,
      callSiteChanges,
      riskHints,
    };

    return {
      success: true,
      language: baseParse.language,
      changes,
      summary,
      affectedRanges: this.getAffectedRanges({ changes }),
    };
  }

  /**
   * Extracts affected line/column ranges from AST diff changes.
   * @param {Object} diffResult
   * @returns {Array<Object>}
   */
  getAffectedRanges(diffResult = {}) {
    const ranges = [];
    const changes = diffResult.changes || [];

    for (const ch of changes) {
      const node = ch.modifiedNode || ch.node || ch.baseNode;
      if (node && node.startLine && node.endLine) {
        ranges.push({
          category: ch.category,
          changeType: ch.type,
          name: ch.name,
          startLine: node.startLine,
          startColumn: node.startColumn || 1,
          endLine: node.endLine,
          endColumn: node.endColumn || 1,
          description: `${ch.category || 'NODE'} ${ch.type}: ${ch.name || ''}`,
        });
      }
    }

    return ranges;
  }

  /**
   * Summarizes structural diff changes.
   * @param {Object} astDiff
   * @returns {Object}
   */
  summarizeChanges(astDiff = {}) {
    const summary = astDiff.summary || {};
    return {
      totalChanges: summary.changedNodes || 0,
      addedFunctionsCount: summary.addedFunctions?.length || 0,
      removedFunctionsCount: summary.removedFunctions?.length || 0,
      modifiedFunctionsCount: summary.modifiedFunctions?.length || 0,
      signatureChangesCount: summary.signatureChanges?.length || 0,
      importChangesCount: summary.importChanges?.length || 0,
      riskHints: summary.riskHints || [],
    };
  }

  /**
   * Evaluates 3-way structural conflict between BASE, PARENT, and INCOMING versions.
   * @param {Object} params - { baseSource, parentSource, incomingSource, language, filePath }
   * @returns {Object} 3-way structural conflict evaluation
   */
  compare3Way({ baseSource = '', parentSource = '', incomingSource = '', language = '', filePath = '' }) {
    const baseToParent = this.compare(baseSource, parentSource, language, filePath);
    const baseToIncoming = this.compare(baseSource, incomingSource, language, filePath);

    if (!baseToParent.success || !baseToIncoming.success) {
      return {
        success: false,
        fallback: true,
        mode: 'TEXT_DIFF_ONLY',
        conflictHint: 'TEXT_ONLY',
        reason: 'AST 3-way comparison fallback to line merge',
      };
    }

    const parentChangedFuncs = new Set((baseToParent.summary?.modifiedFunctions || []).map((f) => f.name));
    const incomingChangedFuncs = new Set((baseToIncoming.summary?.modifiedFunctions || []).map((f) => f.name));

    const parentAddedFuncs = new Set((baseToParent.summary?.addedFunctions || []).map((f) => f.name));
    const incomingAddedFuncs = new Set((baseToIncoming.summary?.addedFunctions || []).map((f) => f.name));

    const overlappingFunctions = [];
    for (const f of parentChangedFuncs) {
      if (incomingChangedFuncs.has(f)) {
        overlappingFunctions.push(f);
      }
    }

    const sameSignaturesDiverging = [];
    const parentSigs = new Map((baseToParent.summary?.signatureChanges || []).map((s) => [s.name, s]));
    const incomingSigs = new Map((baseToIncoming.summary?.signatureChanges || []).map((s) => [s.name, s]));

    for (const [name, pSig] of parentSigs.entries()) {
      if (incomingSigs.has(name)) {
        const iSig = incomingSigs.get(name);
        if (pSig.modifiedSignature !== iSig.modifiedSignature) {
          sameSignaturesDiverging.push({
            name,
            parentSignature: pSig.modifiedSignature,
            incomingSignature: iSig.modifiedSignature,
          });
        }
      }
    }

    let conflictHint = 'DISJOINT_SYMBOLS';
    let riskLevel = 'LOW';
    let recommendation = 'AUTO_MERGE_CANDIDATE';

    if (sameSignaturesDiverging.length > 0) {
      conflictHint = 'SIGNATURE_DIVERGENCE';
      riskLevel = 'HIGH';
      recommendation = 'MANUAL_REVIEW_REQUIRED';
    } else if (overlappingFunctions.length > 0) {
      conflictHint = 'SAME_SYMBOL_MODIFIED';
      riskLevel = 'MEDIUM';
      recommendation = 'INSPECT_OVERLAPPING_SYMBOLS';
    }

    return {
      success: true,
      conflictHint,
      riskLevel,
      recommendation,
      overlappingFunctions,
      sameSignaturesDiverging,
      parentSummary: baseToParent.summary,
      incomingSummary: baseToIncoming.summary,
    };
  }
}

const astDiffEngine = new ASTDiffEngine();

module.exports = {
  ASTDiffEngine,
  astDiffEngine,
  SUPPORTED_LANGUAGES,
  NODE_CHANGE_TYPES,
};
