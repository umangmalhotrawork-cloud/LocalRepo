const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

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
      maxResults = 5000,
    } = payload;

    const startTime = Date.now();

    if (!workspacePath || !query) {
      return {
        success: true,
        results: [],
        totalFiles: 0,
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
        error: `Invalid Regular Expression: ${err.message}`,
        results: [],
        totalFiles: 0,
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

        if (entry.isDirectory()) {
          if (!IGNORE_DIRS.has(name)) {
            scanDirectory(fullPath);
          }
        } else if (entry.isFile()) {
          const ext = path.extname(name).toLowerCase();
          if (BINARY_EXTENSIONS.has(ext)) continue;

          try {
            const stat = fs.statSync(fullPath);
            if (stat.size > 5 * 1024 * 1024) continue; // Skip files > 5MB

            const content = fs.readFileSync(fullPath, 'utf8');
            const lines = content.split(/\r?\n/);
            const relPath = path.relative(workspacePath, fullPath);

            for (let i = 0; i < lines.length; i++) {
              if (results.length >= maxResults) break;

              const lineText = lines[i];
              regex.lastIndex = 0;
              let match;

              while ((match = regex.exec(lineText)) !== null) {
                const matchStart = match.index;
                const matchEnd = match.index + match[0].length;

                results.push({
                  file: relPath,
                  fullPath,
                  line: i + 1,
                  column: matchStart + 1,
                  text: lineText,
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
      results,
      totalFiles: matchedFilesSet.size,
      totalMatches: results.length,
      durationMs: Date.now() - startTime,
    };
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

    const content = fs.readFileSync(fullPath, 'utf8');
    const lines = content.split(/\r?\n/);

    if (line < 1 || line > lines.length) {
      throw new Error(`Invalid line number: ${line}`);
    }

    const targetLine = lines[line - 1];
    const colIdx = column - 1;

    const before = targetLine.slice(0, colIdx);
    const matchSlice = targetLine.slice(colIdx, colIdx + matchText.length);
    const after = targetLine.slice(colIdx + matchText.length);

    if (matchSlice !== matchText) {
      // Fallback substring replace on line
      lines[line - 1] = targetLine.replace(matchText, replaceText);
    } else {
      lines[line - 1] = before + replaceText + after;
    }

    const newContent = lines.join('\n');
    fs.writeFileSync(fullPath, newContent, 'utf8');

    return {
      success: true,
      file,
      line,
      newContent,
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

    const regex = this.buildSearchRegex(query, isRegex, isCaseSensitive, isWholeWord);
    let filesChanged = 0;
    let replacementsCount = 0;

    const searchRes = await this.runSearch({
      workspacePath,
      query,
      isRegex,
      isCaseSensitive,
      isWholeWord,
      maxResults: 20000,
    });

    if (!searchRes.success || searchRes.results.length === 0) {
      return { success: true, filesChanged: 0, replacementsCount: 0 };
    }

    // Group matches by file
    const fileMap = new Map();
    for (const res of searchRes.results) {
      if (fileFilter && res.file !== fileFilter) continue;
      if (!fileMap.has(res.fullPath)) {
        fileMap.set(res.fullPath, []);
      }
      fileMap.get(res.fullPath).push(res);
    }

    for (const [fullPath, matches] of fileMap.entries()) {
      try {
        const content = fs.readFileSync(fullPath, 'utf8');
        let countInFile = 0;
        const newContent = content.replace(regex, () => {
          countInFile++;
          return replaceText;
        });

        if (countInFile > 0) {
          fs.writeFileSync(fullPath, newContent, 'utf8');
          filesChanged++;
          replacementsCount += countInFile;
        }
      } catch (err) {
        console.error(`[SEARCH-MANAGER] replaceAll failed for ${fullPath}:`, err);
      }
    }

    return {
      success: true,
      filesChanged,
      replacementsCount,
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
