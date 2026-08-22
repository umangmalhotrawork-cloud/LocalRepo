/**
 * NEXUS CODEX HARNESS - LANGUAGE INTELLIGENCE & PROBLEMS ENGINE (Milestone 31)
 * 
 * Provides Language Server Protocol (LSP) style workspace intelligence:
 * - Go to Definition (F12 / Cmd+Click) via RepositorySymbolIndex
 * - Find References (Shift+F12) across workspace files
 * - Hover signature, kind, and docstring formatting
 * - Rename Symbol (F2) integrated with ChangeSet, ImpactAnalyzer, Patch Firewall, and TransactionalPatchApplier
 * - Normalized Problems Model & Diagnostic Parser for TypeScript, Python, Node, and Test Runners
 */

const fs = require('fs');
const path = require('path');
const {
  SYMBOL_KIND,
  RELATIONSHIP_TYPE,
  IMPACT_CONFIDENCE,
  EVENT_TYPES,
} = require('./types');
const { repositorySymbolIndex, RepositorySymbolIndex } = require('./RepositorySymbolIndex');
const { astDiffEngine } = require('./AstDiffEngine');
const { impactAnalyzer, ImpactAnalyzer } = require('./ImpactAnalyzer');
const { ChangeSet } = require('./ChangeSet');
const { transactionalPatchApplier } = require('../transactionalPatchApplier');
const secretFilter = require('../../security/secretFilter');

// =========================================================================
// NORMALIZED PROBLEMS MODEL
// =========================================================================

/**
 * @typedef {Object} ProblemItem
 * @property {string} id
 * @property {'error'|'warning'|'info'} severity
 * @property {string} source - 'typescript' | 'javascript' | 'python' | 'pytest' | 'jest' | 'terminal' | 'linter'
 * @property {string} [code] - Error code (e.g. 'TS2304', 'E501')
 * @property {string} message - Descriptive error message
 * @property {string} filePath - Target file path
 * @property {string} [absPath] - Absolute target file path
 * @property {number} [line] - 1-based start line
 * @property {number} [column] - 1-based start column
 * @property {number} [endLine] - 1-based end line
 * @property {number} [endColumn] - 1-based end column
 * @property {string} [relatedInformation] - Stack trace snippet or context
 * @property {number} timestamp - Epoch ms
 */

class LanguageIntelligence {
  /**
   * @param {Object} [options]
   * @param {RepositorySymbolIndex} [options.symbolIndex]
   * @param {ImpactAnalyzer} [options.impactAnalyzer]
   * @param {Object} [options.eventBus]
   */
  constructor(options = {}) {
    this.symbolIndex = options.symbolIndex || repositorySymbolIndex;
    this.impactAnalyzer = options.impactAnalyzer || impactAnalyzer;
    this.eventBus = options.eventBus || null;

    // In-memory Problems registry: id -> ProblemItem
    this.problems = new Map();
  }

  setEventBus(eventBus) {
    this.eventBus = eventBus;
    if (this.symbolIndex && typeof this.symbolIndex.setEventBus === 'function') {
      this.symbolIndex.setEventBus(eventBus);
    }
  }

  // =========================================================================
  // 1. GO TO DEFINITION (F12 / Cmd+Click)
  // =========================================================================

  /**
   * Resolves definitions for a symbol at a given position in a file.
   * @param {Object} query
   * @param {string} query.symbolName - Symbol identifier to resolve
   * @param {string} [query.filePath] - Active editor file path
   * @param {number} [query.line] - Cursor line (1-indexed)
   * @param {number} [query.column] - Cursor column (1-indexed)
   * @param {string} [query.workspacePath] - Workspace root directory
   * @returns {Promise<{ definitions: Array<Object>, symbolName: string }>}
   */
  async getDefinition(query = {}) {
    const { symbolName, filePath, line, column, workspacePath } = query;
    if (!symbolName || typeof symbolName !== 'string' || !symbolName.trim()) {
      return { definitions: [], symbolName: '' };
    }

    const cleanSymbol = symbolName.trim();
    const wsPath = workspacePath ? path.resolve(workspacePath) : (this.symbolIndex.workspacePath || process.cwd());

    // Ensure symbol index is built for the workspace if not yet indexed
    if (this.symbolIndex.symbols.size === 0 && fs.existsSync(wsPath)) {
      await this.symbolIndex.build(wsPath);
    }

    const matchingSymbols = this.symbolIndex.findSymbolsByName(cleanSymbol);
    const definitions = [];

    const normFile = filePath ? path.relative(wsPath, path.resolve(wsPath, filePath)).replace(/\\/g, '/') : null;

    for (const sym of matchingSymbols) {
      const relPath = sym.filePath.replace(/\\/g, '/');
      const absPath = path.resolve(wsPath, relPath);

      // Verify file exists on disk
      if (!fs.existsSync(absPath)) continue;

      definitions.push({
        symbolId: sym.symbolId,
        name: sym.name,
        kind: sym.kind,
        filePath: relPath,
        absPath,
        line: sym.startLine || 1,
        column: sym.startColumn || 1,
        startLine: sym.startLine || 1,
        startColumn: sym.startColumn || 1,
        endLine: sym.endLine || sym.startLine || 1,
        endColumn: sym.endColumn || (sym.name ? sym.startColumn + sym.name.length : 1),
        signature: sym.signature || null,
        exported: Boolean(sym.exported),
        isCurrentFile: normFile ? relPath === normFile : false,
      });
    }

    // Rank definitions: current file first, then imported dependencies, then other files
    if (normFile) {
      definitions.sort((a, b) => {
        if (a.isCurrentFile && !b.isCurrentFile) return -1;
        if (!a.isCurrentFile && b.isCurrentFile) return 1;
        if (a.exported && !b.exported) return -1;
        if (!a.exported && b.exported) return 1;
        return a.filePath.localeCompare(b.filePath);
      });
    }

    return {
      definitions,
      symbolName: cleanSymbol,
    };
  }

  // =========================================================================
  // 2. FIND REFERENCES (Shift+F12)
  // =========================================================================

  /**
   * Discovers all references and usages of a symbol across workspace files.
   * @param {Object} query
   * @param {string} query.symbolName
   * @param {string} [query.filePath]
   * @param {string} [query.workspacePath]
   * @param {number} [query.maxResults]
   * @returns {Promise<{ references: Array<Object>, symbolName: string }>}
   */
  async findReferences(query = {}) {
    const { symbolName, filePath, workspacePath, maxResults = 200 } = query;
    if (!symbolName || typeof symbolName !== 'string' || !symbolName.trim()) {
      return { references: [], symbolName: '' };
    }

    const cleanSymbol = symbolName.trim();
    const wsPath = workspacePath ? path.resolve(workspacePath) : (this.symbolIndex.workspacePath || process.cwd());

    if (this.symbolIndex.symbols.size === 0 && fs.existsSync(wsPath)) {
      await this.symbolIndex.build(wsPath);
    }

    const references = [];
    const seen = new Set();

    // 1. Definition references from SymbolIndex
    const defs = this.symbolIndex.findSymbolsByName(cleanSymbol);
    for (const def of defs) {
      const relPath = def.filePath.replace(/\\/g, '/');
      const absPath = path.resolve(wsPath, relPath);
      const key = `${relPath}:${def.startLine}:${def.startColumn}`;
      if (!seen.has(key) && fs.existsSync(absPath)) {
        seen.add(key);
        let surroundingLine = `${def.kind} ${def.name}`;
        try {
          const content = fs.readFileSync(absPath, 'utf8');
          const lines = content.split('\n');
          if (lines[def.startLine - 1]) {
            surroundingLine = lines[def.startLine - 1].trim();
          }
        } catch (_) {}

        references.push({
          symbolId: def.symbolId,
          symbol: cleanSymbol,
          filePath: relPath,
          absPath,
          line: def.startLine,
          column: def.startColumn,
          isDefinition: true,
          kind: def.kind,
          surroundingLine,
          confidence: IMPACT_CONFIDENCE.DIRECT,
        });
      }
    }

    // 2. Call and Usage relationships from SymbolIndex
    const relRefs = this.symbolIndex.getReferences(cleanSymbol);
    for (const r of relRefs) {
      const relPath = r.sourceFilePath ? r.sourceFilePath.replace(/\\/g, '/') : null;
      if (!relPath) continue;
      const absPath = path.resolve(wsPath, relPath);
      const key = `${relPath}:${r.line}:1`;
      if (!seen.has(key) && fs.existsSync(absPath)) {
        seen.add(key);
        let surroundingLine = '';
        try {
          const content = fs.readFileSync(absPath, 'utf8');
          const lines = content.split('\n');
          if (lines[r.line - 1]) {
            surroundingLine = lines[r.line - 1].trim();
          }
        } catch (_) {}

        references.push({
          symbol: cleanSymbol,
          filePath: relPath,
          absPath,
          line: r.line || 1,
          column: 1,
          isDefinition: false,
          kind: 'call',
          surroundingLine,
          confidence: r.confidence || IMPACT_CONFIDENCE.STRUCTURAL,
        });
      }
    }

    // 3. Scan workspace files for text occurrences using regex boundary check
    const filesToIndex = this.symbolIndex.fileSymbols.keys();
    const regex = new RegExp(`\\b${cleanSymbol.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');

    for (const relFile of filesToIndex) {
      if (references.length >= maxResults) break;
      const absPath = path.resolve(wsPath, relFile);
      if (!fs.existsSync(absPath)) continue;

      try {
        const fileContent = fs.readFileSync(absPath, 'utf8');
        const lines = fileContent.split('\n');
        for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
          if (references.length >= maxResults) break;
          const lineStr = lines[lineIdx];
          let match;
          regex.lastIndex = 0;
          while ((match = regex.exec(lineStr)) !== null) {
            const lineNum = lineIdx + 1;
            const colNum = match.index + 1;
            const key = `${relFile}:${lineNum}:${colNum}`;
            if (!seen.has(key)) {
              seen.add(key);
              references.push({
                symbol: cleanSymbol,
                filePath: relFile,
                absPath,
                line: lineNum,
                column: colNum,
                isDefinition: false,
                kind: 'reference',
                surroundingLine: lineStr.trim(),
                confidence: IMPACT_CONFIDENCE.STRUCTURAL,
              });
            }
          }
        }
      } catch (_) {}
    }

    return {
      references: references.slice(0, maxResults),
      symbolName: cleanSymbol,
      totalCount: references.length,
    };
  }

  // =========================================================================
  // 3. HOVER INFORMATION
  // =========================================================================

  /**
   * Returns formatted hover information for a symbol.
   * @param {Object} query
   * @param {string} query.symbolName
   * @param {string} [query.filePath]
   * @param {number} [query.line]
   * @param {string} [query.workspacePath]
   * @returns {Promise<Object>} Hover details and markdown snippet
   */
  async getHover(query = {}) {
    const { symbolName, filePath, workspacePath } = query;
    if (!symbolName || typeof symbolName !== 'string' || !symbolName.trim()) {
      return { found: false, markdown: '' };
    }

    const cleanSymbol = symbolName.trim();
    const wsPath = workspacePath ? path.resolve(workspacePath) : (this.symbolIndex.workspacePath || process.cwd());

    if (this.symbolIndex.symbols.size === 0 && fs.existsSync(wsPath)) {
      await this.symbolIndex.build(wsPath);
    }

    const matchingSymbols = this.symbolIndex.findSymbolsByName(cleanSymbol);
    if (matchingSymbols.length === 0) {
      return {
        found: false,
        symbolName: cleanSymbol,
        markdown: `*No symbol definition found for \`${cleanSymbol}\`*`,
      };
    }

    // Preferred symbol: in active file if matching, or first
    const normFile = filePath ? path.relative(wsPath, path.resolve(wsPath, filePath)).replace(/\\/g, '/') : null;
    const sym = (normFile ? matchingSymbols.find((s) => s.filePath.replace(/\\/g, '/') === normFile) : null) || matchingSymbols[0];

    let docstring = '';
    const absPath = path.resolve(wsPath, sym.filePath);
    if (fs.existsSync(absPath)) {
      try {
        const content = fs.readFileSync(absPath, 'utf8');
        const lines = content.split('\n');
        const startIdx = Math.max(0, sym.startLine - 1);

        // Check comments above definition
        const commentLines = [];
        for (let i = startIdx - 1; i >= Math.max(0, startIdx - 6); i--) {
          const l = lines[i]?.trim();
          if (l && (l.startsWith('//') || l.startsWith('*') || l.startsWith('/*') || l.startsWith('#'))) {
            commentLines.unshift(l.replace(/^\/\/\s?|^\/\*\s?|\*\/$|^\*\s?|^#\s?/, ''));
          } else {
            break;
          }
        }
        if (commentLines.length > 0) {
          docstring = commentLines.join(' ');
        }

        // Check lines immediately following definition (e.g. Python docstrings """...""")
        if (!docstring) {
          for (let i = startIdx + 1; i < Math.min(lines.length, startIdx + 5); i++) {
            const l = lines[i]?.trim();
            if (l && (l.startsWith('"""') || l.startsWith("'''") || l.startsWith('//') || l.startsWith('*'))) {
              docstring = l.replace(/^"""|^'''|"""$|'''$|^\/\/\s?|^\*\s?/, '').trim();
              break;
            }
          }
        }
      } catch (_) {}
    }

    const signatureStr = sym.signature || (sym.kind === SYMBOL_KIND.FUNCTION ? `(): any` : '');
    const exportTag = sym.exported ? ' *(exported)*' : '';
    const kindName = sym.kind ? sym.kind.toLowerCase() : 'symbol';

    const markdownLines = [
      `\`\`\`typescript\n(${kindName}) ${sym.name}${signatureStr}\n\`\`\``,
      `*Defined in \`${sym.filePath}:${sym.startLine}\`${exportTag}`,
    ];

    if (docstring) {
      markdownLines.push(`\n${secretFilter.sanitizeString(docstring)}`);
    }

    return {
      found: true,
      symbolName: sym.name,
      kind: sym.kind,
      signature: sym.signature,
      filePath: sym.filePath,
      line: sym.startLine,
      exported: sym.exported,
      docstring,
      markdown: markdownLines.join('\n'),
    };
  }

  // =========================================================================
  // 4. RENAME SYMBOL (F2) WITH CHANGESET & IMPACT ANALYSIS
  // =========================================================================

  /**
   * Prepares a rename plan across workspace files without mutating disk.
   * @param {Object} query
   * @param {string} query.symbolName - Current symbol name
   * @param {string} query.newName - New target name
   * @param {string} [query.filePath] - Triggering file path
   * @param {string} [query.workspacePath]
   * @returns {Promise<Object>} Rename plan and affected files
   */
  async prepareRename(query = {}) {
    const { symbolName, newName, filePath, workspacePath } = query;
    if (!symbolName || !newName || typeof symbolName !== 'string' || typeof newName !== 'string') {
      throw new Error('[LANGUAGE-INTELLIGENCE] Both symbolName and newName are required for rename');
    }

    const cleanOld = symbolName.trim();
    const cleanNew = newName.trim();

    if (cleanOld === cleanNew) {
      throw new Error('[LANGUAGE-INTELLIGENCE] New symbol name must differ from original name');
    }

    // Validate identifier syntax
    if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(cleanNew)) {
      throw new Error(`[LANGUAGE-INTELLIGENCE] Invalid identifier name: "${cleanNew}"`);
    }

    const wsPath = workspacePath ? path.resolve(workspacePath) : (this.symbolIndex.workspacePath || process.cwd());
    const refResult = await this.findReferences({ symbolName: cleanOld, filePath, workspacePath: wsPath });

    if (refResult.references.length === 0) {
      throw new Error(`[LANGUAGE-INTELLIGENCE] Symbol "${cleanOld}" not found in workspace index`);
    }

    // Group occurrences by file
    const fileMap = new Map(); // relFile -> Array<{ line, column, text }>
    for (const ref of refResult.references) {
      if (!fileMap.has(ref.filePath)) {
        fileMap.set(ref.filePath, []);
      }
      fileMap.get(ref.filePath).push({
        line: ref.line,
        column: ref.column,
        text: ref.surroundingLine,
      });
    }

    const affectedFiles = [];
    for (const [relFile, occurrences] of fileMap.entries()) {
      affectedFiles.push({
        filePath: relFile,
        count: occurrences.length,
        occurrences,
      });
    }

    return {
      symbolName: cleanOld,
      newName: cleanNew,
      totalReferences: refResult.references.length,
      affectedFilesCount: affectedFiles.length,
      affectedFiles,
    };
  }

  /**
   * Applies a symbol rename atomically using ChangeSet, ImpactAnalyzer, and TransactionalPatchApplier.
   * @param {Object} options
   * @param {string} options.symbolName
   * @param {string} options.newName
   * @param {string} [options.filePath]
   * @param {string} [options.workspacePath]
   * @param {boolean} [options.autoApprove=false]
   * @returns {Promise<Object>} Execution result
   */
  async applyRename(options = {}) {
    const { symbolName, newName, filePath, workspacePath, autoApprove = false } = options;
    const wsPath = workspacePath ? path.resolve(workspacePath) : (this.symbolIndex.workspacePath || process.cwd());

    const plan = await this.prepareRename({ symbolName, newName, filePath, workspacePath: wsPath });
    const cleanOld = plan.symbolName;
    const cleanNew = plan.newName;

    const regex = new RegExp(`\\b${cleanOld.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'g');

    // Construct authoritative ChangeSet
    const changeSet = new ChangeSet({
      workspacePath: wsPath,
      intent: 'MUTATION',
      metadata: {
        operation: 'RENAME_SYMBOL',
        oldSymbol: cleanOld,
        newSymbol: cleanNew,
      },
    });

    const changedFiles = [];
    for (const fileInfo of plan.affectedFiles) {
      const absPath = path.resolve(wsPath, fileInfo.filePath);
      if (!fs.existsSync(absPath)) continue;

      const originalContent = fs.readFileSync(absPath, 'utf8');
      const replacedContent = originalContent.replace(regex, cleanNew);

      if (originalContent !== replacedContent) {
        changeSet.addFile({
          filePath: fileInfo.filePath,
          original: originalContent,
          replacement: replacedContent,
          changeType: 'MODIFY',
        });
        changedFiles.push(fileInfo.filePath);
      }
    }

    if (changedFiles.length === 0) {
      return { success: false, error: 'No content modifications generated for rename' };
    }

    // Run Impact Analysis
    const impact = this.impactAnalyzer.analyzeChangeSet(changeSet);

    // Run Patch Firewall & Safety evaluation
    const safetyResult = await changeSet.evaluateSafety({ workspacePath: wsPath });
    const requiresApproval = changeSet.approvalRequired || safetyResult?.approvalRequired || safetyResult?.overallRiskLevel !== 'AUTO_APPROVE';

    if (requiresApproval && !autoApprove) {
      return {
        success: false,
        status: 'WAITING_FOR_APPROVAL',
        requiresApproval: true,
        impact,
        safety: safetyResult,
        changeSet: changeSet.toJSON(),
      };
    }

    // Atomic Transactional Apply
    const applyResult = await changeSet.apply({
      workspacePath: wsPath,
      force: autoApprove,
    });

    if (!applyResult.success) {
      return {
        success: false,
        error: applyResult.error || 'Transactional apply failed for rename',
        rollback: applyResult.rollbackOutcome || null,
      };
    }

    // Re-index updated files in SymbolIndex
    for (const f of changedFiles) {
      const abs = path.resolve(wsPath, f);
      if (fs.existsSync(abs)) {
        this.symbolIndex._indexSingleFile(abs);
      }
    }
    this.symbolIndex._resolveCrossFileRelationships();

    // Emit event
    if (this.eventBus) {
      this.eventBus.emit(EVENT_TYPES.CHANGE_SET_APPLIED, {
        payload: {
          operation: 'RENAME_SYMBOL',
          oldSymbol: cleanOld,
          newSymbol: cleanNew,
          changedFiles,
        },
      });
    }

    return {
      success: true,
      appliedFilesCount: changedFiles.length,
      appliedFiles: changedFiles,
      changeSetId: changeSet.changeSetId,
      impact,
      safety: safetyResult,
    };
  }

  // =========================================================================
  // 5. DOCUMENT OUTLINE & BREADCRUMBS (Milestone 32)
  // =========================================================================

  /**
   * Generates a structured hierarchical Document Outline for a file.
   * @param {Object} query
   * @param {string} query.filePath - Target file path
   * @param {string} [query.workspacePath]
   * @returns {Promise<{ filePath: string, symbols: Array<Object>, totalCount: number }>}
   */
  async getDocumentOutline(query = {}) {
    const { filePath, workspacePath } = query;
    if (!filePath || typeof filePath !== 'string') {
      return { filePath: '', symbols: [], totalCount: 0 };
    }

    const wsPath = workspacePath ? path.resolve(workspacePath) : (this.symbolIndex.workspacePath || process.cwd());
    const relFile = path.isAbsolute(filePath) ? path.relative(wsPath, filePath).replace(/\\/g, '/') : filePath.replace(/\\/g, '/');

    // Ensure index is ready
    if (this.symbolIndex.symbols.size === 0 && fs.existsSync(wsPath)) {
      await this.symbolIndex.build(wsPath);
    } else {
      const absPath = path.resolve(wsPath, relFile);
      if (fs.existsSync(absPath)) {
        await this.symbolIndex.indexFile(absPath);
      }
    }

    const fileSymbols = this.symbolIndex.getFileSymbols(relFile);
    if (!fileSymbols || fileSymbols.length === 0) {
      return { filePath: relFile, symbols: [], totalCount: 0 };
    }

    // Sort by startLine ascending
    const sorted = [...fileSymbols].sort((a, b) => (a.startLine || 0) - (b.startLine || 0));

    // Build hierarchy: container symbols (CLASS, INTERFACE, TYPE) contain child FUNCTION/METHOD/VARIABLE
    const rootNodes = [];
    const classContainers = [];

    for (const sym of sorted) {
      const node = {
        id: sym.symbolId,
        name: sym.name,
        kind: sym.kind,
        line: sym.startLine || 1,
        column: sym.startColumn || 1,
        endLine: sym.endLine || sym.startLine || 1,
        endColumn: sym.endColumn || 1,
        signature: sym.signature || null,
        exported: Boolean(sym.exported),
        children: [],
      };

      if (sym.kind === SYMBOL_KIND.CLASS || sym.kind === SYMBOL_KIND.INTERFACE) {
        rootNodes.push(node);
        classContainers.push(node);
      } else {
        // Check if enclosed in any classContainer
        const parentClass = classContainers.find(
          (c) => sym.startLine >= c.line && (sym.endLine || sym.startLine) <= (c.endLine > c.line ? c.endLine : 999999)
        );
        if (parentClass) {
          parentClass.children.push(node);
        } else {
          rootNodes.push(node);
        }
      }
    }

    return {
      filePath: relFile,
      symbols: rootNodes,
      totalCount: sorted.length,
    };
  }

  /**
   * Resolves the nearest enclosing symbol and hierarchical breadcrumbs for a position in a file.
   * @param {Object} query
   * @param {string} query.filePath
   * @param {number} [query.line=1]
   * @param {number} [query.column=1]
   * @param {string} [query.workspacePath]
   * @returns {Promise<Object>}
   */
  async getSymbolAtPosition(query = {}) {
    const { filePath, line = 1, column = 1, workspacePath } = query;
    if (!filePath) {
      return { symbol: null, breadcrumbs: [], enclosingHierarchy: [] };
    }

    const outline = await this.getDocumentOutline({ filePath, workspacePath });
    const wsPath = workspacePath ? path.resolve(workspacePath) : (this.symbolIndex.workspacePath || process.cwd());
    const relFile = outline.filePath;

    const flatSymbols = this.symbolIndex.getFileSymbols(relFile);
    const enclosing = flatSymbols.filter((s) => {
      const sLine = s.startLine || 1;
      const eLine = s.endLine && s.endLine >= sLine ? s.endLine : sLine;
      return line >= sLine && line <= (eLine > sLine ? eLine : sLine + 25);
    });

    // Sort by smallest line span (most specific enclosing symbol)
    enclosing.sort((a, b) => {
      const spanA = (a.endLine || a.startLine) - a.startLine;
      const spanB = (b.endLine || b.startLine) - b.startLine;
      return spanA - spanB;
    });

    const activeSym = enclosing[0] || (flatSymbols.length > 0 ? [...flatSymbols].sort((a, b) => Math.abs(a.startLine - line) - Math.abs(b.startLine - line))[0] : null);

    // Build breadcrumb segments
    const parts = relFile.split('/').filter(Boolean);
    const breadcrumbs = [];

    // Root workspace segment
    const wsName = path.basename(wsPath) || 'workspace';
    breadcrumbs.push({ label: wsName, kind: 'workspace', filePath: '' });

    // Folder and file segments
    let accumulatedPath = '';
    for (let i = 0; i < parts.length; i++) {
      const isFile = i === parts.length - 1;
      accumulatedPath = accumulatedPath ? `${accumulatedPath}/${parts[i]}` : parts[i];
      breadcrumbs.push({
        label: parts[i],
        kind: isFile ? 'file' : 'folder',
        filePath: accumulatedPath,
      });
    }

    const hierarchy = [];
    if (activeSym) {
      // If activeSym has parent or enclosing class
      const parentClass = flatSymbols.find((s) => s.kind === SYMBOL_KIND.CLASS && s.startLine <= activeSym.startLine && (s.endLine || 999999) >= (activeSym.endLine || activeSym.startLine) && s.name !== activeSym.name);
      if (parentClass) {
        hierarchy.push(parentClass.name);
        breadcrumbs.push({
          label: parentClass.name,
          kind: 'class',
          filePath: relFile,
          line: parentClass.startLine,
          column: parentClass.startColumn,
        });
      }

      hierarchy.push(activeSym.name);
      breadcrumbs.push({
        label: activeSym.name,
        kind: activeSym.kind ? activeSym.kind.toLowerCase() : 'symbol',
        filePath: relFile,
        line: activeSym.startLine,
        column: activeSym.startColumn,
      });
    }

    return {
      filePath: relFile,
      line,
      column,
      symbol: activeSym
        ? {
            id: activeSym.symbolId,
            name: activeSym.name,
            kind: activeSym.kind,
            line: activeSym.startLine,
            column: activeSym.startColumn,
            signature: activeSym.signature,
          }
        : null,
      breadcrumbs,
      enclosingHierarchy: hierarchy,
    };
  }

  /**
   * Generates breadcrumbs for an active editor path and cursor line.
   * @param {Object} query
   * @returns {Promise<Array<Object>>}
   */
  async getBreadcrumbs(query = {}) {
    const res = await this.getSymbolAtPosition(query);
    return res.breadcrumbs || [];
  }

  // =========================================================================
  // 6. PROBLEMS MODEL & DIAGNOSTIC PARSER
  // =========================================================================

  /**
   * Parses raw compiler/runtime text into normalized ProblemItem records.
   * @param {string} rawText
   * @param {Object} [options]
   * @param {string} [options.source]
   * @param {string} [options.workspacePath]
   * @param {string} [options.defaultFilePath]
   * @returns {Array<ProblemItem>}
   */
  parseDiagnostics(rawText = '', options = {}) {
    if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
      return [];
    }

    const sanitized = secretFilter.sanitizeString(rawText);
    const problems = [];
    const wsPath = options.workspacePath || (this.symbolIndex.workspacePath || process.cwd());
    const defaultFile = options.defaultFilePath || 'unknown_file';

    // 1. TypeScript / JavaScript Compiler Output (e.g. "src/auth.ts:42:15 - error TS2304:" or "src/auth.ts(12,8): error TS2304:")
    const tsRegex = /([^\s:(]+)[:(](\d+)[,:](\d+)\)?(?::\s*|\s*-\s*|\s+)(error|warning|info)\s+(TS\d+):\s*([^\n]+)/gi;
    let tsMatch;
    while ((tsMatch = tsRegex.exec(sanitized)) !== null) {
      const rawFile = tsMatch[1].trim();
      const relFile = path.isAbsolute(rawFile) ? path.relative(wsPath, rawFile).replace(/\\/g, '/') : rawFile.replace(/\\/g, '/');
      const severity = tsMatch[4].toLowerCase() === 'warning' ? 'warning' : 'error';
      const code = tsMatch[5];
      const message = tsMatch[6].trim();
      const line = parseInt(tsMatch[2], 10);
      const column = parseInt(tsMatch[3], 10);

      problems.push({
        id: `ts_${relFile}_${line}_${column}_${code}`,
        severity,
        source: 'typescript',
        code,
        message,
        filePath: relFile,
        absPath: path.resolve(wsPath, relFile),
        line,
        column,
        endLine: line,
        endColumn: column + 1,
        relatedInformation: sanitized.slice(tsMatch.index, tsMatch.index + 200),
        timestamp: Date.now(),
      });
    }

    // 2. Python Traceback & Syntax Errors
    if (sanitized.includes('Traceback (most recent call last):') || sanitized.includes('SyntaxError') || sanitized.includes('IndentationError')) {
      const frameRegex = /File\s+["\x27]([^"\x27]+)["\x27],\s+line\s+(\d+)(?:,\s+in\s+([^\n]+))?/g;
      let frameMatch;
      let lastFrame = null;
      while ((frameMatch = frameRegex.exec(sanitized)) !== null) {
        lastFrame = {
          file: frameMatch[1],
          line: parseInt(frameMatch[2], 10),
          func: frameMatch[3] || null,
        };
      }

      const errLineMatch = sanitized.match(/\n([A-Za-z0-9_.]+(?:Error|Exception|Interrupt|Exit|Warning))(?::\s*(.*))?$/m);
      const errType = errLineMatch ? errLineMatch[1] : 'PythonError';
      const errMsg = errLineMatch && errLineMatch[2] ? errLineMatch[2].trim() : errType;
      const targetFile = lastFrame ? lastFrame.file : defaultFile;
      const relFile = path.isAbsolute(targetFile) ? path.relative(wsPath, targetFile).replace(/\\/g, '/') : targetFile.replace(/\\/g, '/');

      problems.push({
        id: `py_${relFile}_${lastFrame?.line || 1}_${errType}`,
        severity: errType.toLowerCase().includes('warning') ? 'warning' : 'error',
        source: 'python',
        code: errType,
        message: `${errType}: ${errMsg}`,
        filePath: relFile,
        absPath: path.resolve(wsPath, relFile),
        line: lastFrame?.line || null,
        column: 1,
        relatedInformation: sanitized.slice(0, 1000),
        timestamp: Date.now(),
      });
    }

    // 3. pytest Failures
    const pytestRegex = /FAILED\s+([^:]+)::(\w+)(?:\s+-\s+([A-Za-z0-9_]+Error|AssertionError):\s*(.*))?/gi;
    let pyMatch;
    while ((pyMatch = pytestRegex.exec(sanitized)) !== null) {
      const rawFile = pyMatch[1].trim();
      const testName = pyMatch[2].trim();
      const errType = pyMatch[3] || 'AssertionError';
      const errDetails = pyMatch[4] ? pyMatch[4].trim() : 'Test assertion failed';
      const relFile = path.isAbsolute(rawFile) ? path.relative(wsPath, rawFile).replace(/\\/g, '/') : rawFile.replace(/\\/g, '/');

      // Attempt to extract line number
      const lineMatch = sanitized.match(new RegExp(`${rawFile.replace(/[/\\.]/g, '\\$&')}:(\\d+):`));
      const line = lineMatch ? parseInt(lineMatch[1], 10) : null;

      problems.push({
        id: `pytest_${relFile}_${testName}`,
        severity: 'error',
        source: 'pytest',
        code: errType,
        message: `FAILED ${testName}: ${errDetails}`,
        filePath: relFile,
        absPath: path.resolve(wsPath, relFile),
        line,
        column: 1,
        relatedInformation: sanitized.slice(pyMatch.index, pyMatch.index + 300),
        timestamp: Date.now(),
      });
    }

    // 4. Jest / Vitest / Mocha Test Failures (e.g. "FAIL src/auth.test.ts > suite > test name")
    const jestRegex = /(?:FAIL|✕)\s+([^\s\n]+)(?:\s+[>›]\s+([^\n]+))?/gi;
    let jestMatch;
    while ((jestMatch = jestRegex.exec(sanitized)) !== null) {
      const rawFile = jestMatch[1].trim();
      const testDesc = jestMatch[2] ? jestMatch[2].trim() : 'Test suite failed';
      const relFile = path.isAbsolute(rawFile) ? path.relative(wsPath, rawFile).replace(/\\/g, '/') : rawFile.replace(/\\/g, '/');

      // Attempt to find line from stack trace
      const stackLineMatch = sanitized.match(/at\s+(?:[^\n]+\()?([^\n:()]+):(\d+):(\d+)\)?/);
      const line = stackLineMatch ? parseInt(stackLineMatch[2], 10) : null;
      const column = stackLineMatch ? parseInt(stackLineMatch[3], 10) : null;

      problems.push({
        id: `jest_${relFile}_${line || 0}_${testDesc.slice(0, 30)}`,
        severity: 'error',
        source: 'jest',
        code: 'TEST_FAILURE',
        message: `Test Failed: ${testDesc}`,
        filePath: relFile,
        absPath: path.resolve(wsPath, relFile),
        line,
        column,
        relatedInformation: sanitized.slice(jestMatch.index, jestMatch.index + 300),
        timestamp: Date.now(),
      });
    }

    // 5. JavaScript / Node.js Generic Stack Traces
    if (problems.length === 0 && sanitized.includes('Error:')) {
      const jsErrMatch = sanitized.match(/([A-Za-z0-9_.]*Error):\s*([^\n]+)/);
      const jsFrameMatch = sanitized.match(/\bat\s+(?:(?:async\s+)?([A-Za-z0-9_$.<>]+)\s+\()?(?:file:\/\/)?([^:()\n]+):(\d+):(\d+)\)?/);

      if (jsErrMatch) {
        const errType = jsErrMatch[1];
        const errMsg = jsErrMatch[2].trim();
        let relFile = defaultFile;
        let line = null;
        let column = null;

        if (jsFrameMatch) {
          const rawFile = jsFrameMatch[2].trim();
          relFile = path.isAbsolute(rawFile) ? path.relative(wsPath, rawFile).replace(/\\/g, '/') : rawFile.replace(/\\/g, '/');
          line = parseInt(jsFrameMatch[3], 10);
          column = parseInt(jsFrameMatch[4], 10);
        }

        problems.push({
          id: `node_${relFile}_${line || 0}_${errType}`,
          severity: 'error',
          source: 'javascript',
          code: errType,
          message: `${errType}: ${errMsg}`,
          filePath: relFile,
          absPath: path.resolve(wsPath, relFile),
          line,
          column,
          relatedInformation: sanitized.slice(0, 500),
          timestamp: Date.now(),
        });
      }
    }

    return problems;
  }

  /**
   * Adds or replaces problems in the active problem store.
   * @param {Array<ProblemItem>} problemList
   * @param {string} [source] - Optional source namespace override
   */
  addProblems(problemList = [], source = null) {
    if (!Array.isArray(problemList)) return;

    for (const prob of problemList) {
      if (!prob || !prob.message) continue;
      const id = prob.id || `prob_${prob.filePath}_${prob.line || 0}_${Date.now().toString(36)}`;
      this.problems.set(id, {
        id,
        severity: prob.severity || 'error',
        source: source || prob.source || 'compiler',
        code: prob.code || null,
        message: secretFilter.sanitizeString(prob.message),
        filePath: prob.filePath || 'unknown_file',
        absPath: prob.absPath || null,
        line: typeof prob.line === 'number' ? prob.line : null,
        column: typeof prob.column === 'number' ? prob.column : null,
        endLine: typeof prob.endLine === 'number' ? prob.endLine : prob.line,
        endColumn: typeof prob.endColumn === 'number' ? prob.endColumn : null,
        relatedInformation: prob.relatedInformation ? secretFilter.sanitizeString(prob.relatedInformation) : null,
        timestamp: prob.timestamp || Date.now(),
      });
    }
  }

  /**
   * Clears problems matching an optional filter.
   * @param {Object} [filter] - { filePath, source }
   */
  clearProblems(filter = {}) {
    if (!filter || Object.keys(filter).length === 0) {
      this.problems.clear();
      return;
    }

    const { filePath, source } = filter;
    for (const [id, prob] of this.problems.entries()) {
      if (filePath && prob.filePath !== filePath) continue;
      if (source && prob.source !== source) continue;
      this.problems.delete(id);
    }
  }

  /**
   * Retrieves active problems matching an optional filter.
   * @param {Object} [filter] - { filePath, severity, source }
   * @returns {Array<ProblemItem>}
   */
  getProblems(filter = {}) {
    const list = Array.from(this.problems.values());
    if (!filter || Object.keys(filter).length === 0) {
      return list;
    }

    const { filePath, severity, source } = filter;
    return list.filter((p) => {
      if (filePath && p.filePath !== filePath) return false;
      if (severity && p.severity !== severity) return false;
      if (source && p.source !== source) return false;
      return true;
    });
  }

  /**
   * Retrieves summary counts for the Problems tab.
   * @returns {{ totalCount: number, errorCount: number, warningCount: number, infoCount: number, filesCount: number }}
   */
  getProblemsSummary() {
    const all = Array.from(this.problems.values());
    const errorCount = all.filter((p) => p.severity === 'error').length;
    const warningCount = all.filter((p) => p.severity === 'warning').length;
    const infoCount = all.filter((p) => p.severity === 'info').length;
    const files = new Set(all.map((p) => p.filePath));

    return {
      totalCount: all.length,
      errorCount,
      warningCount,
      infoCount,
      filesCount: files.size,
    };
  }
}

const languageIntelligence = new LanguageIntelligence();

module.exports = {
  LanguageIntelligence,
  languageIntelligence,
};
