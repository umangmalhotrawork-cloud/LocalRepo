/**
 * NEXUS CODEX HARNESS TOOL - READ FILE
 * Reads a workspace file safely with strict path traversal protection, size bounding,
 * and zero mutations.
 */

const fs = require('fs');
const path = require('path');
const secretFilter = require('../../../security/secretFilter');

const MAX_FILE_READ_BYTES = 200 * 1024; // 200 KB max read bound per tool invocation

const ReadFileTool = {
  name: 'read_file',
  description: 'Reads the text content of a file located within the active workspace.',
  inputSchema: {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Relative path to the file within the workspace (e.g. "src/cart.py")',
      },
    },
    required: ['path'],
  },
  requiresApproval: false,

  async execute(args = {}, context = {}) {
    const targetRelPath = args.path || args.filePath || '';
    if (!targetRelPath || typeof targetRelPath !== 'string' || !targetRelPath.trim()) {
      return {
        success: false,
        error: 'Argument "path" must be a non-empty string',
      };
    }

    const workspaceRoot = path.resolve(context.workspacePath || process.cwd());
    const resolvedPath = path.isAbsolute(targetRelPath)
      ? path.resolve(targetRelPath)
      : path.resolve(workspaceRoot, targetRelPath);

    // Path traversal defense
    if (!resolvedPath.startsWith(workspaceRoot + path.sep) && resolvedPath !== workspaceRoot) {
      return {
        success: false,
        error: `Security Violation: Path "${targetRelPath}" escapes workspace boundary`,
      };
    }

    if (!fs.existsSync(resolvedPath)) {
      return {
        success: false,
        error: `File not found: "${targetRelPath}"`,
      };
    }

    let stat;
    try {
      stat = fs.statSync(resolvedPath);
      if (stat.isDirectory()) {
        return {
          success: false,
          error: `Path is a directory, not a readable file: "${targetRelPath}"`,
        };
      }
    } catch (e) {
      return {
        success: false,
        error: `Failed to stat file: ${e.message}`,
      };
    }

    try {
      const rawContent = fs.readFileSync(resolvedPath, 'utf-8');
      const sanitized = secretFilter.sanitizeString(rawContent);

      let content = sanitized;
      let truncated = false;

      if (Buffer.byteLength(content, 'utf-8') > MAX_FILE_READ_BYTES) {
        content = content.slice(0, MAX_FILE_READ_BYTES) + '\n... [TRUNCATED DUE TO SIZE LIMIT] ...';
        truncated = true;
      }

      const lines = content.split(/\r?\n/);
      const relPath = path.relative(workspaceRoot, resolvedPath);

      return {
        success: true,
        path: relPath,
        relPath,
        size: stat.size,
        linesCount: lines.length,
        truncated,
        content,
      };
    } catch (readErr) {
      return {
        success: false,
        error: `Failed to read file: ${readErr.message}`,
      };
    }
  },
};

module.exports = ReadFileTool;
