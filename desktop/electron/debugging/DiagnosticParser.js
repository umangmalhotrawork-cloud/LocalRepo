/**
 * NEXUS DIAGNOSTIC PARSER (Milestone 25)
 * 
 * Normalizes error outputs, stack traces, compiler diagnostics, and test failures
 * into a structured, bounded diagnostic model.
 * 
 * Guarantees:
 * 1. Strict boundary enforcement: No unbounded memory/context blowups.
 * 2. Source accuracy: If file/line cannot be reliably extracted, sets null rather than guessing.
 * 3. Secret filtering: Sanitizes API keys, tokens, and authorization headers.
 * 4. Human-readable explanations: Translates cryptic system errors (ENOTFOUND, ENOENT, etc.).
 */

const path = require("path");

const MAX_TRACE_CHARS = 2000;
const MAX_SUMMARY_CHARS = 400;

const SYSTEM_ERROR_TRANSLATIONS = {
  ENOTFOUND: "Unable to resolve network address or reach remote host",
  ECONNREFUSED: "Connection refused by target server",
  ECONNRESET: "Connection was unexpectedly reset by remote peer",
  ETIMEDOUT: "Operation or network request timed out",
  ENOENT: "Target file or directory does not exist on disk",
  EACCES: "Permission denied accessing filesystem resource",
  EPERM: "Operation not permitted by operating system",
  ERR_MODULE_NOT_FOUND: "Required module or dependency could not be resolved",
  MODULE_NOT_FOUND: "Cannot find requested module or package",
};

/**
 * Sanitizes API keys and authorization tokens in error strings.
 */
function sanitizeSecrets(text) {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/(AIza[0-9A-Za-z-_]{35})/g, "AIza*******************************")
    .replace(/(gsk_[0-9A-Za-z]{48,64})/g, "gsk_********************************")
    .replace(/(Bearer\s+)[A-Za-z0-9-_\.]{16,}/gi, "$1[REDACTED_TOKEN]")
    .replace(/(api[_-]?key\s*[:=]\s*["\x27]?)[A-Za-z0-9-_]{16,}(["\x27]?)/gi, "$1[REDACTED_KEY]$2");
}

class DiagnosticParser {
  /**
   * Normalizes raw terminal/process/test error output into a structured diagnostic.
   * @param {Object} input
   * @param {string} [input.command]
   * @param {string} [input.cwd]
   * @param {number} [input.exitCode]
   * @param {string} [input.signal]
   * @param {string} [input.stdout]
   * @param {string} [input.stderr]
   * @param {string} [input.rawOutput]
   * @param {string} [input.workspacePath]
   * @returns {Object|null} Normalized diagnostic model or null if no error found
   */
  parse(input = {}) {
    if (!input || typeof input !== "object") return null;

    const {
      command = "",
      cwd = "",
      exitCode,
      signal,
      stdout = "",
      stderr = "",
      rawOutput: customRaw,
      workspacePath = "",
    } = input;

    const combinedText = sanitizeSecrets(customRaw || `${stdout}\n${stderr}`.trim());
    if (!combinedText && exitCode === 0 && !signal) {
      return null;
    }

    let filePath = null;
    let line = null;
    let column = null;
    let language = null;
    let summary = "";
    let stackTrace = "";
    let errorCategory = "COMMAND_FAILURE";

    // 1. Check for Python Traceback
    const pyTracebackMatch = combinedText.match(/Traceback \(most recent call last\):([\s\S]+)$/);
    if (pyTracebackMatch) {
      language = "python";
      errorCategory = "PYTHON_TRACEBACK";
      const traceBody = pyTracebackMatch[1];
      stackTrace = pyTracebackMatch[0].trim();

      // Find all file frames: File "...", line X, in ...
      const frameRegex = /File\s+["\x27]([^"\x27]+)["\x27],\s+line\s+(\d+)(?:,\s+in\s+([^\n]+))?/g;
      let match;
      let lastFrame = null;
      while ((match = frameRegex.exec(traceBody)) !== null) {
        lastFrame = {
          file: match[1],
          line: parseInt(match[2], 10),
          fn: match[3] || null,
        };
      }

      if (lastFrame) {
        filePath = lastFrame.file;
        line = lastFrame.line;
      }

      // Extract exception message: NameError: name "x" is not defined
      const errLineMatch = traceBody.match(/\n([A-Za-z0-9_.]+(?:Error|Exception|Interrupt|Exit|Warning))(?::\s*(.*))?$/);
      if (errLineMatch) {
        summary = errLineMatch[2] ? `${errLineMatch[1]}: ${errLineMatch[2].trim()}` : errLineMatch[1];
      } else {
        const lastLine = traceBody.trim().split("\n").pop();
        if (lastLine) summary = lastLine.trim();
      }
    }

    // 2. Check for TypeScript Compiler Error (e.g. src/app.ts:42:15 - error TS2322: ...)
    if (!summary) {
      const tsMatch = combinedText.match(/([^\s:(]+)[:(](\d+)[,:](\d+)\)?\s*-\s*error\s+(TS\d+):\s*([^\n]+)/);
      if (tsMatch) {
        language = "typescript";
        errorCategory = "TYPESCRIPT_ERROR";
        filePath = tsMatch[1].trim();
        line = parseInt(tsMatch[2], 10);
        column = parseInt(tsMatch[3], 10);
        summary = `TypeScript Error ${tsMatch[4]}: ${tsMatch[5].trim()}`;
        stackTrace = combinedText;
      }
    }

    // 3. Check for pytest failure output
    if (!summary) {
      const pytestFailMatch = combinedText.match(/FAILED\s+([^:]+)::(\w+)(?:\s+-\s+([A-Za-z0-9_]+Error|AssertionError):\s*(.*))?/);
      if (pytestFailMatch) {
        language = "python";
        errorCategory = "PYTEST_FAILURE";
        filePath = pytestFailMatch[1].trim();
        const testName = pytestFailMatch[2].trim();
        const errType = pytestFailMatch[3] || "AssertionError";
        const errDetails = pytestFailMatch[4] ? pytestFailMatch[4].trim() : "Test assertion failed";
        summary = `pytest failure in ${testName} (${errType}: ${errDetails})`;

        // Attempt to find exact failure line: e.g. tests/test_calc.py:42: in test_add
        const baseName = path.basename(filePath).replace(/[/\\.]/g, "\\$&");
        const lineMatch = combinedText.match(new RegExp(`(?:${filePath.replace(/[/\\.]/g, "\\$&")}|${baseName}):(\\d+):`));
        if (lineMatch) {
          line = parseInt(lineMatch[1], 10);
        }
        stackTrace = combinedText;
      }
    }

    // 4. Check for Node.js / JavaScript Stack Trace
    if (!summary) {
      const jsErrMatch = combinedText.match(/([A-Za-z0-9_.]*Error):\s*([^\n]+)/);
      const jsFrameMatch = combinedText.match(/\bat\s+(?:(?:async\s+)?([A-Za-z0-9_$.<>]+)\s+\()?(?:file:\/\/)?([^:()\n]+):(\d+):(\d+)\)?/);

      if (jsErrMatch && jsFrameMatch) {
        language = "javascript";
        errorCategory = "JAVASCRIPT_ERROR";
        summary = `${jsErrMatch[1]}: ${jsErrMatch[2].trim()}`;
        filePath = jsFrameMatch[2].trim();
        line = parseInt(jsFrameMatch[3], 10);
        column = parseInt(jsFrameMatch[4], 10);
        stackTrace = combinedText;
      } else if (jsFrameMatch) {
        language = "javascript";
        errorCategory = "JAVASCRIPT_ERROR";
        filePath = jsFrameMatch[2].trim();
        line = parseInt(jsFrameMatch[3], 10);
        column = parseInt(jsFrameMatch[4], 10);
        summary = `Error at ${path.basename(filePath)}:${line}`;
        stackTrace = combinedText;
      }
    }

    // 5. Check for npm ERR! output
    if (!summary) {
      const npmMatch = combinedText.match(/npm ERR!\s+(?:code\s+([A-Za-z0-9_]+)|([^\n]+))/);
      if (npmMatch) {
        errorCategory = "NPM_ERROR";
        const code = npmMatch[1];
        const msg = npmMatch[2] || (code ? `Exit code ${code}` : "Command execution failed");
        summary = `npm error: ${msg.trim()}`;
        stackTrace = combinedText;
      }
    }

    // 6. Generic Fallback for Non-zero Exit or Unparsed Errors
    if (!summary) {
      if (exitCode !== undefined && exitCode !== 0) {
        const lastLines = combinedText.trim().split("\n").filter(Boolean).slice(-3).join(" ");
        summary = lastLines || `Process exited with code ${exitCode}${signal ? ` (${signal})` : ""}`;
      } else if (stderr.trim()) {
        summary = stderr.trim().split("\n")[0] || "Process reported error output";
      } else if (customRaw && customRaw.trim()) {
        summary = customRaw.trim().split("\n")[0] || "Reported diagnostic output";
      } else {
        return null;
      }
      stackTrace = combinedText;
    }

    // Human-friendly explanation enrichment
    let friendlyExplanation = "";
    for (const [sysCode, explanation] of Object.entries(SYSTEM_ERROR_TRANSLATIONS)) {
      if (combinedText.includes(sysCode) || summary.includes(sysCode)) {
        friendlyExplanation = explanation;
        break;
      }
    }

    // Resolve relative file paths against workspace / cwd if needed
    let resolvedFilePath = filePath;
    if (resolvedFilePath && !path.isAbsolute(resolvedFilePath)) {
      const baseDir = cwd || workspacePath;
      if (baseDir) {
        resolvedFilePath = path.resolve(baseDir, resolvedFilePath);
      }
    }

    // Truncate bounded fields
    const boundedSummary = summary.length > MAX_SUMMARY_CHARS
      ? summary.slice(0, MAX_SUMMARY_CHARS) + "..."
      : summary;

    const boundedStackTrace = stackTrace.length > MAX_TRACE_CHARS
      ? stackTrace.slice(0, MAX_TRACE_CHARS) + "\n... [TRUNCATED]"
      : stackTrace;

    return {
      command: command ? sanitizeSecrets(command) : undefined,
      cwd: cwd || undefined,
      exitCode: exitCode !== undefined ? exitCode : undefined,
      signal: signal || undefined,
      errorCategory,
      summary: boundedSummary,
      friendlyExplanation: friendlyExplanation || undefined,
      stdout: stdout ? sanitizeSecrets(stdout.slice(-1000)) : undefined,
      stderr: stderr ? sanitizeSecrets(stderr.slice(-1000)) : undefined,
      stackTrace: boundedStackTrace,
      filePath: resolvedFilePath || null,
      line: Number.isInteger(line) ? line : null,
      column: Number.isInteger(column) ? column : null,
      language: language || null,
      timestamp: Date.now(),
    };
  }
}

const diagnosticParser = new DiagnosticParser();

module.exports = {
  DiagnosticParser,
  diagnosticParser,
  sanitizeSecrets,
};
