/**
 * NEXUS CODEX HARNESS - REPOSITORY SYMBOL INDEX & CROSS-FILE GRAPH (Milestone 19)
 * 
 * Provides a fast, incremental in-memory symbol and relationship graph across a repository.
 * Analysis-only / Advisory infrastructure:
 * - Does not execute source code.
 * - Does not require a compiler or build pipeline.
 * - Incremental file-level caching.
 * - Bounded traversal and safe workspace boundaries.
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const {
  SYMBOL_KIND,
  RELATIONSHIP_TYPE,
  IMPACT_CONFIDENCE,
  EVENT_TYPES,
  generateSymbolId,
} = require('./types');
const { astDiffEngine } = require('./ASTDiffEngine');
const secretFilter = require('../../security/secretFilter');

let ts = null;
try {
  ts = require('typescript');
} catch (e) {}

const IGNORED_DIRECTORIES = new Set([
  '.git',
  'node_modules',
  '.next',
  'dist',
  'build',
  'coverage',
  '.venv',
  'venv',
  '__pycache__',
  '.turbo',
  '.nexus',
  '.nexus-recovery',
  '.idea',
  '.vscode',
  '.gemini',
]);

const SUPPORTED_EXTENSIONS = new Set([
  '.py',
  '.ts',
  '.tsx',
  '.js',
  '.jsx',
  '.mjs',
  '.cjs',
]);

class RepositorySymbolIndex {
  constructor(options = {}) {
    this.workspacePath = options.workspacePath ? path.resolve(options.workspacePath) : null;
    this.eventBus = options.eventBus || null;

    this.version = 1;
    this.symbols = new Map(); // symbolId -> Symbol
    this.symbolsByName = new Map(); // name -> Set<symbolId>
    this.fileSymbols = new Map(); // filePath -> Set<symbolId>
    this.fileHashes = new Map(); // filePath -> sha1 hash
    this.fileMetadata = new Map(); // filePath -> { language, lastIndexed }

    // Relationship graph
    this.relationships = []; // Array<Relationship>
    this.fileImports = new Map(); // filePath -> Set<importPathOrModule>
    this.fileExports = new Map(); // filePath -> Set<symbolName>

    this.maxScanFiles = options.maxScanFiles || 5000;
  }

  setEventBus(eventBus) {
    this.eventBus = eventBus;
  }

  getVersion() {
    return this.version;
  }

  clear() {
    this.symbols.clear();
    this.symbolsByName.clear();
    this.fileSymbols.clear();
    this.fileHashes.clear();
    this.fileMetadata.clear();
    this.relationships = [];
    this.fileImports.clear();
    this.fileExports.clear();
    this.version++;
  }

  /**
   * Scans and builds the complete symbol index for a workspace directory.
   * @param {string} [workspacePath]
   * @param {Object} [options]
   * @returns {Promise<Object>} Build result summary
   */
  async build(workspacePath = this.workspacePath, options = {}) {
    const wsPath = workspacePath ? path.resolve(workspacePath) : this.workspacePath;
    if (!wsPath || !fs.existsSync(wsPath)) {
      return {
        success: false,
        filesScanned: 0,
        filesIndexed: 0,
        symbolsCount: 0,
        relationshipsCount: 0,
        error: `Workspace path does not exist: ${wsPath}`,
      };
    }

    this.workspacePath = wsPath;
    this.clear();

    const startTime = Date.now();
    if (this.eventBus) {
      this.eventBus.emit(EVENT_TYPES.REPOSITORY_INDEX_STARTED, {
        workspacePath: this.workspacePath,
        timestamp: startTime,
      });
    }

    try {
      const files = this._collectWorkspaceFiles(this.workspacePath);
      let indexedCount = 0;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        this._indexSingleFile(file);
        indexedCount++;

        if (this.eventBus && (i % 25 === 0 || i === files.length - 1)) {
          this.eventBus.emit(EVENT_TYPES.REPOSITORY_INDEX_PROGRESS, {
            workspacePath: this.workspacePath,
            current: i + 1,
            total: files.length,
            filePath: file,
          });
        }
      }

      this._resolveCrossFileRelationships();
      this.version++;

      const durationMs = Date.now() - startTime;
      const summary = {
        success: true,
        workspacePath: this.workspacePath,
        filesScanned: files.length,
        filesIndexed: indexedCount,
        symbolsCount: this.symbols.size,
        relationshipsCount: this.relationships.length,
        durationMs,
      };

      if (this.eventBus) {
        this.eventBus.emit(EVENT_TYPES.REPOSITORY_INDEX_COMPLETED, summary);
      }

      return summary;
    } catch (err) {
      if (this.eventBus) {
        this.eventBus.emit(EVENT_TYPES.REPOSITORY_INDEX_FAILED, {
          workspacePath: this.workspacePath,
          error: err.message,
        });
      }
      return {
        success: false,
        filesScanned: 0,
        filesIndexed: 0,
        symbolsCount: 0,
        relationshipsCount: 0,
        error: err.message,
      };
    }
  }

  /**
   * Refreshes or re-indexes a single file incrementally.
   * @param {string} filePath - Absolute or relative file path
   * @param {string} [fileContent] - Optional direct content override
   * @returns {Object} Refresh outcome
   */
  refreshFile(filePath, fileContent = null) {
    if (!filePath) return { success: false, error: 'Missing filePath' };

    const relPath = this._normalizeRelativePath(filePath);
    const absPath = path.isAbsolute(filePath) ? filePath : path.resolve(this.workspacePath || process.cwd(), filePath);

    if (fileContent === null && !fs.existsSync(absPath)) {
      this.removeFile(relPath);
      return { success: true, action: 'REMOVED' };
    }

    const content = fileContent !== null ? fileContent : fs.readFileSync(absPath, 'utf8');
    const hash = crypto.createHash('sha1').update(content, 'utf8').digest('hex');

    // Check hash cache
    if (this.fileHashes.get(relPath) === hash) {
      return { success: true, action: 'UNCHANGED' };
    }

    // Remove existing symbols and relationships for this file
    this._removeFileSymbolsAndRelationships(relPath);

    // Index new content
    this._indexFileContent(relPath, content);
    this.fileHashes.set(relPath, hash);
    this._resolveCrossFileRelationships();
    this.version++;

    if (this.eventBus) {
      this.eventBus.emit(EVENT_TYPES.REPOSITORY_INDEX_UPDATED, {
        filePath: relPath,
        symbolsCount: (this.fileSymbols.get(relPath) || new Set()).size,
        version: this.version,
      });
    }

    return {
      success: true,
      action: 'UPDATED',
      filePath: relPath,
      symbolsCount: (this.fileSymbols.get(relPath) || new Set()).size,
    };
  }

  /**
   * Removes a file from the index.
   * @param {string} filePath
   */
  removeFile(filePath) {
    const relPath = this._normalizeRelativePath(filePath);
    this._removeFileSymbolsAndRelationships(relPath);
    this.fileHashes.delete(relPath);
    this.fileMetadata.delete(relPath);
    this.fileImports.delete(relPath);
    this.fileExports.delete(relPath);
    this._resolveCrossFileRelationships();
    this.version++;

    if (this.eventBus) {
      this.eventBus.emit(EVENT_TYPES.REPOSITORY_INDEX_UPDATED, {
        filePath: relPath,
        action: 'DELETED',
        version: this.version,
      });
    }
  }

  // =========================================================================
  // QUERY API
  // =========================================================================

  getSymbol(symbolId) {
    return this.symbols.get(symbolId) || null;
  }

  findSymbol(name) {
    const ids = this.symbolsByName.get(name);
    if (!ids || ids.size === 0) return null;
    const firstId = ids.values().next().value;
    return this.symbols.get(firstId) || null;
  }

  findSymbolsByName(name) {
    const ids = this.symbolsByName.get(name);
    if (!ids) return [];
    const results = [];
    for (const id of ids) {
      const sym = this.symbols.get(id);
      if (sym) results.push(sym);
    }
    return results;
  }

  getFileSymbols(filePath) {
    const relPath = this._normalizeRelativePath(filePath);
    const ids = this.fileSymbols.get(relPath);
    if (!ids) return [];
    const results = [];
    for (const id of ids) {
      const sym = this.symbols.get(id);
      if (sym) results.push(sym);
    }
    return results;
  }

  getReferences(symbolIdOrName) {
    const targetSymbol = this.getSymbol(symbolIdOrName) || this.findSymbol(symbolIdOrName);
    const targetName = targetSymbol ? targetSymbol.name : symbolIdOrName;

    return this.relationships.filter(
      (r) => (r.targetSymbolId === symbolIdOrName || r.targetName === targetName) &&
             (r.type === RELATIONSHIP_TYPE.REFERENCES || r.type === RELATIONSHIP_TYPE.CALLS || r.type === RELATIONSHIP_TYPE.TYPE_REFERENCES)
    );
  }

  getCallers(symbolIdOrName) {
    const targetSymbol = this.getSymbol(symbolIdOrName) || this.findSymbol(symbolIdOrName);
    const targetName = targetSymbol ? targetSymbol.name : symbolIdOrName;

    return this.relationships.filter(
      (r) => (r.targetSymbolId === symbolIdOrName || r.targetName === targetName) &&
             r.type === RELATIONSHIP_TYPE.CALLS
    );
  }

  getCallees(symbolIdOrName) {
    const targetSymbol = this.getSymbol(symbolIdOrName) || this.findSymbol(symbolIdOrName);
    if (!targetSymbol) return [];

    return this.relationships.filter(
      (r) => r.sourceSymbolId === targetSymbol.symbolId && r.type === RELATIONSHIP_TYPE.CALLS
    );
  }

  getImports(filePath) {
    const relPath = this._normalizeRelativePath(filePath);
    const imports = this.fileImports.get(relPath);
    return imports ? Array.from(imports) : [];
  }

  getImportedBy(filePath) {
    const relPath = this._normalizeRelativePath(filePath);
    const baseName = path.basename(relPath, path.extname(relPath));
    const importedBy = new Set();

    for (const [f, imports] of this.fileImports.entries()) {
      if (f === relPath) continue;
      for (const imp of imports) {
        if (imp.includes(baseName) || imp.endsWith(relPath) || imp.includes(`./${baseName}`)) {
          importedBy.add(f);
        }
      }
    }
    return Array.from(importedBy);
  }

  getExports(filePath) {
    const relPath = this._normalizeRelativePath(filePath);
    const exports = this.fileExports.get(relPath);
    return exports ? Array.from(exports) : [];
  }

  getImplementations(symbolIdOrName) {
    const targetSymbol = this.getSymbol(symbolIdOrName) || this.findSymbol(symbolIdOrName);
    const targetName = targetSymbol ? targetSymbol.name : symbolIdOrName;

    return this.relationships.filter(
      (r) => (r.targetSymbolId === symbolIdOrName || r.targetName === targetName) &&
             (r.type === RELATIONSHIP_TYPE.IMPLEMENTS || r.type === RELATIONSHIP_TYPE.EXTENDS)
    );
  }

  getDependencies(filePath) {
    const relPath = this._normalizeRelativePath(filePath);
    const directImports = this.getImports(relPath);
    const resolvedDeps = new Set();

    for (const imp of directImports) {
      for (const knownFile of this.fileSymbols.keys()) {
        const base = path.basename(knownFile, path.extname(knownFile));
        if (imp.includes(base)) {
          resolvedDeps.add(knownFile);
        }
      }
    }
    return Array.from(resolvedDeps);
  }

  getDependents(filePath) {
    return this.getImportedBy(filePath);
  }

  /**
   * Lightweight potential impact query across targets.
   * @param {Array<string>} targets - Symbol names or file paths
   * @returns {Object} Potential impact summary
   */
  getPotentialImpact(targets = []) {
    const affectedSymbols = new Set();
    const affectedFiles = new Set();
    const callers = [];
    const callees = [];
    const dependents = new Set();
    const dependencies = new Set();

    for (const target of targets) {
      if (typeof target !== 'string') continue;

      if (target.includes('.') || target.includes('/')) {
        // File target
        const rel = this._normalizeRelativePath(target);
        affectedFiles.add(rel);
        for (const dep of this.getDependents(rel)) dependents.add(dep);
        for (const dep of this.getDependencies(rel)) dependencies.add(dep);
      } else {
        // Symbol target
        const syms = this.findSymbolsByName(target);
        for (const s of syms) {
          affectedSymbols.add(s);
          affectedFiles.add(s.filePath);
          for (const c of this.getCallers(s.symbolId)) callers.push(c);
          for (const c of this.getCallees(s.symbolId)) callees.push(c);
        }
      }
    }

    const confidence = callers.length > 0
      ? IMPACT_CONFIDENCE.DIRECT
      : affectedFiles.size > 0
      ? IMPACT_CONFIDENCE.STRUCTURAL
      : IMPACT_CONFIDENCE.HEURISTIC;

    return {
      symbols: Array.from(affectedSymbols),
      files: Array.from(affectedFiles),
      callers,
      callees,
      dependents: Array.from(dependents),
      dependencies: Array.from(dependencies),
      confidence,
    };
  }

  /**
   * Compact repository intelligence query for ContextEngine.
   * @param {Object} query - { symbolName, filePath, maxCallers, maxDependents }
   * @returns {Object} Compact intelligence snippet
   */
  queryContextIntelligence(query = {}) {
    const { symbolName, filePath, maxCallers = 5, maxDependents = 5 } = query;
    const sym = symbolName ? this.findSymbol(symbolName) : null;
    const callers = symbolName ? this.getCallers(symbolName).slice(0, maxCallers) : [];
    const dependents = filePath ? this.getDependents(filePath).slice(0, maxDependents) : [];
    const imports = filePath ? this.getImports(filePath).slice(0, 10) : [];

    return {
      symbol: sym
        ? {
            name: sym.name,
            kind: sym.kind,
            signature: sym.signature,
            filePath: sym.filePath,
            startLine: sym.startLine,
          }
        : null,
      callers: callers.map((c) => ({
        sourceFilePath: c.sourceFilePath,
        line: c.line,
        confidence: c.confidence,
      })),
      dependents,
      imports,
    };
  }

  // =========================================================================
  // INTERNAL PARSING & GRAPH CONSTRUCTION
  // =========================================================================

  _collectWorkspaceFiles(dir) {
    const files = [];
    const walk = (currDir) => {
      if (files.length >= this.maxScanFiles) return;
      const entries = fs.readdirSync(currDir, { withFileTypes: true });

      for (const entry of entries) {
        if (files.length >= this.maxScanFiles) break;
        const name = entry.name;
        if (IGNORED_DIRECTORIES.has(name) || name.startsWith('.')) continue;

        const fullPath = path.join(currDir, name);
        if (entry.isDirectory()) {
          walk(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(name).toLowerCase();
          if (SUPPORTED_EXTENSIONS.has(ext)) {
            files.push(fullPath);
          }
        }
      }
    };

    walk(dir);
    return files;
  }

  _indexSingleFile(absFilePath) {
    const relPath = this._normalizeRelativePath(absFilePath);
    try {
      const content = fs.readFileSync(absFilePath, 'utf8');
      const hash = crypto.createHash('sha1').update(content, 'utf8').digest('hex');
      this.fileHashes.set(relPath, hash);
      this._indexFileContent(relPath, content);
    } catch (e) {
      // Ignore unreadable or transient files
    }
  }

  _indexFileContent(relPath, content) {
    const lang = astDiffEngine.detectLanguage(relPath, content);
    this.fileMetadata.set(relPath, { language: lang, lastIndexed: Date.now() });

    const parseRes = astDiffEngine.parse(content, lang, relPath);
    if (!parseRes.success || !Array.isArray(parseRes.nodes)) {
      return;
    }

    const fileSymIds = new Set();
    const imports = new Set();
    const exports = new Set();

    for (const node of parseRes.nodes) {
      if (node.type === 'ImportDeclaration') {
        imports.add(node.name || node.rawText);
        continue;
      }

      let kind = SYMBOL_KIND.VARIABLE;
      if (node.type === 'FunctionDeclaration') kind = SYMBOL_KIND.FUNCTION;
      else if (node.type === 'ClassDeclaration') kind = SYMBOL_KIND.CLASS;
      else if (node.type === 'ReturnStatement' || node.type === 'ControlFlow') continue;

      if (!node.name) continue;

      const symbolId = generateSymbolId();
      const isExported = Boolean(
        node.rawText?.includes('export ') ||
        (lang === 'python' && !node.name.startsWith('_'))
      );

      if (isExported) {
        exports.add(node.name);
      }

      const sym = {
        symbolId,
        name: node.name,
        qualifiedName: `${relPath}:${node.name}`,
        kind,
        language: lang,
        filePath: relPath,
        startLine: node.startLine || 1,
        startColumn: node.startColumn || 1,
        endLine: node.endLine || 1,
        endColumn: node.endColumn || 1,
        parentSymbolId: node.parentNodeId || null,
        exported: isExported,
        signature: node.signature || null,
        metadata: {
          parameters: node.parameters || [],
        },
      };

      this.symbols.set(symbolId, sym);
      fileSymIds.add(symbolId);

      if (!this.symbolsByName.has(node.name)) {
        this.symbolsByName.set(node.name, new Set());
      }
      this.symbolsByName.get(node.name).add(symbolId);

      // Local DEFINES relationship
      this.relationships.push({
        sourceSymbolId: null,
        targetSymbolId: symbolId,
        targetName: node.name,
        type: RELATIONSHIP_TYPE.DEFINES,
        sourceFilePath: relPath,
        targetFilePath: relPath,
        line: node.startLine || 1,
        confidence: IMPACT_CONFIDENCE.DIRECT,
      });

      // Call extraction
      if (node.type === 'CallExpression') {
        this.relationships.push({
          sourceSymbolId: null,
          targetSymbolId: null,
          targetName: node.name,
          type: RELATIONSHIP_TYPE.CALLS,
          sourceFilePath: relPath,
          targetFilePath: null,
          line: node.startLine || 1,
          confidence: IMPACT_CONFIDENCE.HEURISTIC,
        });
      }
    }

    this.fileSymbols.set(relPath, fileSymIds);
    this.fileImports.set(relPath, imports);
    this.fileExports.set(relPath, exports);
  }

  _resolveCrossFileRelationships() {
    for (const rel of this.relationships) {
      if (rel.type === RELATIONSHIP_TYPE.CALLS && !rel.targetSymbolId) {
        const matchingSyms = this.findSymbolsByName(rel.targetName);
        if (matchingSyms.length > 0) {
          // If a matching exported symbol exists in an imported dependency, bind it directly
          const preferred = matchingSyms.find((s) => s.filePath !== rel.sourceFilePath) || matchingSyms[0];
          rel.targetSymbolId = preferred.symbolId;
          rel.targetFilePath = preferred.filePath;
          rel.confidence = preferred.filePath === rel.sourceFilePath
            ? IMPACT_CONFIDENCE.DIRECT
            : IMPACT_CONFIDENCE.STRUCTURAL;
        }
      }
    }
  }

  _removeFileSymbolsAndRelationships(relPath) {
    const symIds = this.fileSymbols.get(relPath);
    if (symIds) {
      for (const id of symIds) {
        const sym = this.symbols.get(id);
        if (sym) {
          const byName = this.symbolsByName.get(sym.name);
          if (byName) {
            byName.delete(id);
            if (byName.size === 0) this.symbolsByName.delete(sym.name);
          }
        }
        this.symbols.delete(id);
      }
      this.fileSymbols.delete(relPath);
    }

    this.relationships = this.relationships.filter(
      (r) => r.sourceFilePath !== relPath
    );
  }

  _normalizeRelativePath(p) {
    if (!p) return '';
    if (this.workspacePath && path.isAbsolute(p)) {
      return path.relative(this.workspacePath, p).replace(/\\/g, '/');
    }
    return p.replace(/\\/g, '/');
  }
}

const repositorySymbolIndex = new RepositorySymbolIndex();

module.exports = {
  RepositorySymbolIndex,
  repositorySymbolIndex,
  IGNORED_DIRECTORIES,
  SUPPORTED_EXTENSIONS,
};
