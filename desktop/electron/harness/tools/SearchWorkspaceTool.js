/**
 * NEXUS CODEX HARNESS TOOL - SEARCH WORKSPACE
 * Performs indexed and regular expression searches across workspace files using SearchManager.
 */

const path = require('path');
const searchManager = require('../../searchManager');
const secretFilter = require('../../../security/secretFilter');

const MAX_SEARCH_RESULTS_RETURNED = 50;

const SearchWorkspaceTool = {
  name: 'search_workspace',
  description: 'Searches for text or regex patterns across files in the active workspace.',
  inputSchema: {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Text string or regex pattern to search for',
      },
      isRegex: {
        type: 'boolean',
        description: 'Whether query should be treated as a regular expression',
      },
      isCaseSensitive: {
        type: 'boolean',
        description: 'Whether search should be case-sensitive',
      },
      path: {
        type: 'string',
        description: 'Optional subfolder path within workspace to limit the search scope',
      },
      includeGlobs: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional glob patterns to include (e.g. ["*.ts", "src/**"])',
      },
      excludeGlobs: {
        type: 'array',
        items: { type: 'string' },
        description: 'Optional glob patterns to exclude (e.g. ["*.test.js", "dist/**"])',
      },
    },
    required: ['query'],
  },
  requiresApproval: false,

  async execute(args = {}, context = {}) {
    const query = args.query || '';
    if (!query || typeof query !== 'string' || !query.trim()) {
      return {
        success: false,
        error: 'Argument "query" must be a non-empty string',
      };
    }

    const workspaceRoot = path.resolve(context.workspacePath || process.cwd());
    let targetDir = workspaceRoot;

    if (args.path && typeof args.path === 'string' && args.path.trim()) {
      const candidateDir = path.resolve(workspaceRoot, args.path.trim());
      if (!candidateDir.startsWith(workspaceRoot + path.sep) && candidateDir !== workspaceRoot) {
        return {
          success: false,
          error: `Security Violation: Search path "${args.path}" escapes workspace boundary`,
        };
      }
      targetDir = candidateDir;
    }

    try {
      const searchRes = await searchManager.runSearch({
        workspacePath: targetDir,
        query: query.trim(),
        isRegex: Boolean(args.isRegex),
        isCaseSensitive: Boolean(args.isCaseSensitive),
        includeGlobs: args.includeGlobs || [],
        excludeGlobs: args.excludeGlobs || [],
        maxResults: 200,
      });

      if (!searchRes || !searchRes.success) {
        return {
          success: false,
          error: searchRes?.error || 'Workspace search failed',
        };
      }

      const rawResults = Array.isArray(searchRes.results) ? searchRes.results : [];
      const matches = rawResults.slice(0, MAX_SEARCH_RESULTS_RETURNED).map((m) => ({
        file: m.file || path.relative(workspaceRoot, m.fullPath),
        line: m.line,
        column: m.column,
        snippet: secretFilter.sanitizeString(m.text || ''),
      }));

      return {
        success: true,
        query: secretFilter.sanitizeString(query),
        totalMatches: searchRes.totalMatches || matches.length,
        totalFiles: searchRes.totalFiles || 0,
        matches,
        truncated: rawResults.length > MAX_SEARCH_RESULTS_RETURNED,
      };
    } catch (err) {
      return {
        success: false,
        error: `Search execution error: ${err.message}`,
      };
    }
  },
};

module.exports = SearchWorkspaceTool;
