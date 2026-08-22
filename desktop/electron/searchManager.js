const fs = require('fs');
const path = require('path');
const { ChangeSet } = require('./harness/ChangeSet');
const { transactionalPatchApplier } = require('./transactionalPatchApplier');
let secretFilter = null;
try {
  secretFilter = require('../security/secretFilter');
} catch (e) {
  try {
    secretFilter = require('./security/secretFilter');
  } catch (e2) {}
}

const IGNORE_DIRS = new Set([
  'node_modules',
  '.git',
  '.next',
  'dist',
  'build',
  'coverage',
  '.gemini',
  '__pycache__',
  '.turbo',
  '.vscode',
  '.idea',
]);

const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svg',
  '.pdf', '.zip', '.tar', '.gz', '.tgz', '.wasm', '.pyc',
  '.exe', '.dll', '.dylib', '.so', '.bin', '.dat', '.db', '.sqlite',
  '.mp3', '.mp4', '.mov', '.avi', '.woff', '.woff2', '.ttf', '.eot',
]);

function matchGlob(filePath, globPattern) {
  if (!globPattern || !filePath) return false;
  let pattern = typeof globPattern === 'string' ? globPattern.trim() : '';
  if (!pattern) return false;

  const normPath = filePath.replace(/\\/g, '/');
  pattern = pattern.replace(/\\/g, '/');

  // Handle negation
  const isNegated = pattern.startsWith('!');
  if (isNegated) pattern = pattern.slice(1);

  // Convert glob to regex
  let regexStr = pattern
    .replace(/\./g, '\\.')
    .replace(/\*\*/g, '§§')
    .replace(/\*/g, '[^/]*')
    .replace(/§§/g, '.*')
    .replace(/\?/g, '.');

  if (!regexStr.startsWith('.*') && !regexStr.startsWith('/')) {
    regexStr = '(^|/)' + regexStr;
  }
  regexStr = '^' + regexStr + '$';

  try {
    const reg = new RegExp(regexStr, 'i');
    const matches = reg.test(normPath) || reg.test(path.basename(normPath));
    return isNegated ? !matches : matches;
  } catch (e) {
    return false;
  }
}

function matchesAnyGlob(filePath, globList) {
  if (!globList || globList.length === 0) return true;
  const list = Array.isArray(globList) ? globList : String(globList).split(',').map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return true;
  return list.some((g) => matchGlob(filePath, g));
}

function isExcludedByGlobs(filePath, excludeList) {
  if (!excludeList || excludeList.length === 0) return false;
  const list = Array.isArray(excludeList) ? excludeList : String(excludeList).split(',').map((s) => s.trim()).filter(Boolean);
  if (list.length === 0) return false;
  return list.some((g) => matchGlob(filePath, g));
}

class SearchManager {
  constructor() {
    this.activeSearches = new Map();
  }

  escapeRegex(string) {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  buildSearchRegex(query, isRegex, isCaseSensitive, isWholeWord) {
    let pattern = isRegex ? query : this.escapeRegex(query);
    if (isWholeWord) {
      pattern = `\\b${pattern}\\b`;
    }
    const flags = isCaseSensitive ? 'g' : 'gi';
    return new RegExp(pattern, flags);
  }

  async runSearch(payload = {}) {
    const {
      workspacePath,
      query = '',
      isRegex = false,
      isCaseSensitive = false,
      isWholeWord = false,
      includeHidden = false,
      includeGlobs = [],
      excludeGlobs = [],
      maxResults = 5000,
    } = payload;

    const startTime = Date.now();
    const searchId = `search_${startTime}_${Math.random().toString(36).substring(2, 8)}`;

    if (!workspacePath || !query) {
      return {
        success: true,
        searchId,
        query,
        isRegex,
        caseSensitive: isCaseSensitive,
        wholeWord: isWholeWord,
        includeGlobs,
        excludeGlobs,
        results: [],
        matches: [],
        totalFiles: 0,
        affectedFiles: 0,
        totalMatches: 0,
        durationMs: 0,
      };
    }

    let regex;
    try {
      regex = this.buildSearchRegex(query, isRegex, isCaseSensitive, isWholeWord);
    } catch (err) {
      return {
        success: false,
        searchId,
        error: `Invalid Regular Expression: ${err.message}`,
        results: [],
        matches: [],
        totalFiles: 0,
        affectedFiles: 0,
        totalMatches: 0,
        durationMs: 0,
      };
    }

    const results = [];
    const matchedFilesSet = new Set();

    const scanDirectory = (dir) => {
      if (results.length >= maxResults) return;

      let entries;
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch (e) {
        return;
      }

      for (const entry of entries) {
        if (results.length >= maxResults) break;

        const name = entry.name;
        if (!includeHidden && name.startsWith('.') && name !== '.' && name !== '..') {
          continue;
        }

        const fullPath = path.join(dir, name);
        const relPath = path.relative(workspacePath, fullPath);

        if (entry.isDirectory()) {
          if (!IGNORE_DIRS.has(name) && !isExcludedByGlobs(relPath, excludeGlobs)) {
            scanDirectory(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(name).toLowerCase();
          if (BINARY_EXTENSIONS.has(ext)) continue;

          // Check include/exclude globs
          if (!matchesAnyGlob(relPath, includeGlobs)) continue;
          if (isExcludedByGlobs(relPath, excludeGlobs)) continue;

          try {
            const stat = fs.statSync(fullPath);
            if (stat.size > 5 * 1024 * 1024) continue; // Skip files > 5MB

            let content = fs.readFileSync(fullPath, 'utf8');
            if (secretFilter && typeof secretFilter.sanitizeString === 'function') {
              // Note: We search in raw file but ensure safe logging
            }

            const lines = content.split(/\r?\n/);

            for (let i = 0; i < lines.length; i++) {
              if (results.length >= maxResults) break;

              const lineText = lines[i];
              regex.lastIndex = 0;
              let match;

              while ((match = regex.exec(lineText)) !== null) {
                if (results.length >= maxResults) break;
                const matchStart = match.index;
                const matchEnd = match.index + match[0].length;
                const matchId = `${relPath}:${i + 1}:${matchStart + 1}:${matchStart}`;

                results.push({
                  matchId,
                  file: relPath,
                  filePath: relPath,
                  fullPath,
                  line: i + 1,
                  column: matchStart + 1,
                  text: lineText,
                  lineText,
                  matchText: match[0],
                  matchStart,
                  matchEnd,
                });

                matchedFilesSet.add(relPath);

                if (!regex.global || match[0].length === 0) {
                  break;
                }
              }
            }
          } catch (fileErr) {
            // Ignore unreadable files
          }
        }
      }
    };

    scanDirectory(workspacePath);

    return {
      success: true,
      searchId,
      query,
      isRegex,
      caseSensitive: isCaseSensitive,
      wholeWord: isWholeWord,
      includeGlobs,
      excludeGlobs,
      results,
      matches: results,
      totalFiles: matchedFilesSet.size,
      affectedFiles: matchedFilesSet.size,
      totalMatches: results.length,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Generates a multi-file replacement preview model without mutating any files on disk.
   */
  async generateReplacementPreview(payload = {}) {
    const {
      workspacePath,
      query = '',
      replaceText = '',
      isRegex = false,
      isCaseSensitive = false,
      isWholeWord = false,
      includeHidden = false,
      includeGlobs = [],
      excludeGlobs = [],
      selectedMatchIds = null, // null means all selected
    } = payload;

    const startTime = Date.now();
    const searchRes = await this.runSearch({
      workspacePath,
      query,
      isRegex,
      isCaseSensitive,
      isWholeWord,
      includeHidden,
      includeGlobs,
      excludeGlobs,
      maxResults: 20000,
    });

    if (!searchRes.success || searchRes.results.length === 0) {
      return {
        success: true,
        previewId: `preview_${startTime}_empty`,
        searchId: searchRes.searchId,
        query,
        replaceText,
        files: [],
        totalReplacements: 0,
        totalFiles: 0,
        durationMs: Date.now() - startTime,
      };
    }

    const regex = this.buildSearchRegex(query, isRegex, isCaseSensitive, isWholeWord);
    const fileGroups = new Map();

    for (const match of searchRes.results) {
      if (!fileGroups.has(match.filePath)) {
        fileGroups.set(match.filePath, []);
      }
      fileGroups.get(match.filePath).push(match);
    }

    const previewFiles = [];
    let totalSelectedReplacements = 0;
    const selectedSet = selectedMatchIds ? new Set(selectedMatchIds) : null;

    for (const [relPath, matches] of fileGroups.entries()) {
      const fullPath = path.isAbsolute(relPath) ? relPath : path.join(workspacePath, relPath);
      let originalContent = '';
      try {
        originalContent = fs.readFileSync(fullPath, 'utf8');
      } catch (err) {
        continue;
      }

      const lines = originalContent.split(/\r?\n/);
      const fileMatches = [];
      const selectedMatchesInFile = [];

      // Group matches by line
      const lineMatchMap = new Map();
      for (const m of matches) {
        const isSelected = selectedSet === null ? true : selectedSet.has(m.matchId);
        const matchItem = {
          matchId: m.matchId,
          line: m.line,
          column: m.column,
          lineText: m.lineText,
          matchText: m.matchText,
          matchStart: m.matchStart,
          matchEnd: m.matchEnd,
          replacement: replaceText,
          selected: isSelected,
        };

        fileMatches.push(matchItem);
        if (isSelected) {
          selectedMatchesInFile.push(m.matchId);
          totalSelectedReplacements++;
        }

        if (!lineMatchMap.has(m.line)) {
          lineMatchMap.set(m.line, []);
        }
        lineMatchMap.get(m.line).push(matchItem);
      }

      // Reconstruct proposed content line by line using only selected matches
      const proposedLines = lines.map((originalLine, lineIdx) => {
        const lineNum = lineIdx + 1;
        const lineMatches = lineMatchMap.get(lineNum);
        if (!lineMatches || lineMatches.length === 0) {
          return originalLine;
        }

        // Sort matches descending by matchStart so replacing doesn't shift earlier offsets
        const sortedMatches = [...lineMatches].sort((a, b) => b.matchStart - a.matchStart);
        let updatedLine = originalLine;

        for (const m of sortedMatches) {
          if (!m.selected) continue;
          const before = updatedLine.slice(0, m.matchStart);
          const after = updatedLine.slice(m.matchEnd);
          updatedLine = before + replaceText + after;
        }

        return updatedLine;
      });

      const proposedContent = proposedLines.join('\n');
      const isFileSelected = selectedMatchesInFile.length > 0;

      previewFiles.push({
        filePath: relPath,
        fullPath,
        originalContent,
        proposedContent,
        matches: fileMatches,
        selectedMatches: selectedMatchesInFile,
        selected: isFileSelected,
        changeType: proposedContent === originalContent ? 'UNCHANGED' : 'MODIFY',
      });
    }

    return {
      success: true,
      previewId: `preview_${startTime}_${Math.random().toString(36).substring(2, 8)}`,
      searchId: searchRes.searchId,
      query,
      replaceText,
      files: previewFiles,
      totalReplacements: totalSelectedReplacements,
      totalFiles: previewFiles.filter((f) => f.selected).length,
      durationMs: Date.now() - startTime,
    };
  }

  /**
   * Converts a replacement preview into a safety-evaluated ChangeSet instance.
   */
  async generateChangeSetFromPreview(payload = {}) {
    const {
      workspacePath,
      preview,
      threadId,
      turnId,
    } = payload;

    if (!preview || !Array.isArray(preview.files)) {
      throw new Error('Invalid preview model: files array is required');
    }

    const changeSet = new ChangeSet({
      workspacePath: workspacePath || process.cwd(),
      threadId: threadId || `search_replace_${Date.now()}`,
      turnId: turnId || null,
      intent: 'GLOBAL_SEARCH_REPLACE',
      metadata: {
        query: preview.query,
        replaceText: preview.replaceText,
        totalReplacements: preview.totalReplacements,
      },
    });

    for (const file of preview.files) {
      if (file.selected !== false && file.proposedContent !== file.originalContent) {
        changeSet.addFile({
          filePath: file.filePath,
          original: file.originalContent,
          replacement: file.proposedContent,
          changeType: 'MUTATION',
          metadata: {
            selectedMatches: file.selectedMatches || [],
          },
        });
      }
    }

    // Run multi-file safety analysis across ASTDiffEngine, ImpactAnalyzer, and Patch Firewall
    const risk = await changeSet.evaluateSafety({ workspacePath });

    return {
      success: true,
      changeSetId: changeSet.changeSetId,
      changeSet,
      risk,
      filesCount: changeSet.files.length,
    };
  }

  /**
   * Applies the proposed replacements atomically via TransactionalPatchApplier.
   * If any file write or validation fails, ALL file modifications are rolled back.
   */
  async applyReplacementChangeSet(payload = {}) {
    const {
      workspacePath = process.cwd(),
      files = [],
      changeSet = null,
      force = false,
    } = payload;

    const edits = [];

    if (changeSet && Array.isArray(changeSet.files)) {
      for (const f of changeSet.files) {
        edits.push({
          filePath: f.filePath,
          original: f.original,
          replacement: f.replacement,
        });
      }
    } else if (Array.isArray(files)) {
      for (const f of files) {
        if (f.selected !== false && f.proposedContent !== f.originalContent) {
          edits.push({
            filePath: f.filePath,
            original: f.originalContent,
            replacement: f.proposedContent,
          });
        }
      }
    }

    if (edits.length === 0) {
      return {
        success: true,
        message: 'No edits to apply.',
        modifiedFiles: [],
      };
    }

    const txResult = await transactionalPatchApplier.applyTransaction(edits, {
      workspacePath,
      force,
      enforceFirewall: true,
      verifySyntax: true,
    });

    return txResult;
  }

  async replaceSingle(payload = {}) {
    const {
      workspacePath,
      file,
      line,
      column,
      matchText,
      replaceText = '',
    } = payload;

    const fullPath = path.isAbsolute(file) ? file : path.join(workspacePath, file);
    if (!fs.existsSync(fullPath)) {
      throw new Error(`File not found: ${file}`);
    }

    const originalContent = fs.readFileSync(fullPath, 'utf8');
    const lines = originalContent.split(/\r?\n/);

    if (line < 1 || line > lines.length) {
      throw new Error(`Invalid line number: ${line}`);
    }

    const targetLine = lines[line - 1];
    const colIdx = column - 1;

    const before = targetLine.slice(0, colIdx);
    const matchSlice = targetLine.slice(colIdx, colIdx + matchText.length);
    const after = targetLine.slice(colIdx + matchText.length);

    if (matchSlice !== matchText) {
      lines[line - 1] = targetLine.replace(matchText, replaceText);
    } else {
      lines[line - 1] = before + replaceText + after;
    }

    const proposedContent = lines.join('\n');

    // Route through transactionalPatchApplier for atomic safety & rollback protection
    const txResult = await transactionalPatchApplier.applyTransaction([
      {
        filePath: file,
        original: originalContent,
        replacement: proposedContent,
      },
    ], {
      workspacePath,
      force: true,
    });

    if (!txResult.success) {
      throw new Error(txResult.error || 'Failed to replace match');
    }

    return {
      success: true,
      file,
      line,
      newContent: proposedContent,
    };
  }

  async replaceAll(payload = {}) {
    const {
      workspacePath,
      query = '',
      replaceText = '',
      isRegex = false,
      isCaseSensitive = false,
      isWholeWord = false,
      fileFilter = null,
    } = payload;

    const preview = await this.generateReplacementPreview({
      workspacePath,
      query,
      replaceText,
      isRegex,
      isCaseSensitive,
      isWholeWord,
    });

    if (!preview.success || preview.files.length === 0) {
      return { success: true, filesChanged: 0, replacementsCount: 0 };
    }

    const filesToApply = fileFilter
      ? preview.files.filter((f) => f.filePath === fileFilter)
      : preview.files;

    const txResult = await this.applyReplacementChangeSet({
      workspacePath,
      files: filesToApply,
      force: true,
    });

    if (!txResult.success) {
      throw new Error(txResult.error || 'Replace all transaction failed');
    }

    return {
      success: true,
      filesChanged: txResult.modifiedFiles ? txResult.modifiedFiles.length : filesToApply.length,
      replacementsCount: preview.totalReplacements,
    };
  }

  cancelSearch(id) {
    if (this.activeSearches.has(id)) {
      this.activeSearches.delete(id);
    }
  }
}

const searchManager = new SearchManager();
module.exports = searchManager;

