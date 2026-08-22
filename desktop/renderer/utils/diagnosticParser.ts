/**
 * NEXUS CLIENT DIAGNOSTIC PARSER (Milestone 25)
 * Client-side parser for Terminal and Test Explorer diagnostics.
 */

export interface TerminalDiagnostic {
  command?: string;
  cwd?: string;
  exitCode?: number;
  signal?: string;
  errorCategory?: string;
  summary: string;
  friendlyExplanation?: string;
  stdout?: string;
  stderr?: string;
  stackTrace?: string;
  filePath?: string | null;
  line?: number | null;
  column?: number | null;
  language?: string | null;
  timestamp: number;
}

export interface ProblemItem {
  id: string;
  severity: "error" | "warning" | "info";
  source: string;
  code?: string;
  message: string;
  filePath: string;
  absPath?: string;
  line?: number;
  column?: number;
  endLine?: number;
  endColumn?: number;
  relatedInformation?: string;
  timestamp: number;
}

export function terminalDiagnosticToProblem(diag: TerminalDiagnostic): ProblemItem {
  const isWarn = diag.errorCategory?.toLowerCase().includes("warn") || diag.summary?.toLowerCase().includes("warning");
  return {
    id: `term_${diag.filePath || "workspace"}_${diag.line || 0}_${diag.timestamp}`,
    severity: isWarn ? "warning" : "error",
    source: diag.language || "terminal",
    code: diag.errorCategory || undefined,
    message: diag.summary || "Command execution error",
    filePath: diag.filePath || "workspace",
    line: diag.line || undefined,
    column: diag.column || undefined,
    relatedInformation: diag.stackTrace || diag.stderr || undefined,
    timestamp: diag.timestamp || Date.now(),
  };
}

const SYSTEM_ERROR_TRANSLATIONS: Record<string, string> = {
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

export function sanitizeSecrets(text: string): string {
  if (!text || typeof text !== "string") return "";
  return text
    .replace(/(AIza[0-9A-Za-z-_]{35})/g, "AIza*******************************")
    .replace(/(gsk_[0-9A-Za-z]{48,64})/g, "gsk_********************************")
    .replace(/(Bearer\s+)[A-Za-z0-9-_\.]{16,}/gi, "$1[REDACTED_TOKEN]")
    .replace(/(api[_-]?key\s*[:=]\s*["\x27]?)[A-Za-z0-9-_]{16,}(["\x27]?)/gi, "$1[REDACTED_KEY]$2");
}

export function parseDiagnosticFromText(
  rawText: string,
  options: {
    command?: string;
    cwd?: string;
    exitCode?: number;
    signal?: string;
    workspacePath?: string;
  } = {}
): TerminalDiagnostic | null {
  if (!rawText && options.exitCode === 0 && !options.signal) {
    return null;
  }

  const combinedText = sanitizeSecrets(rawText || "");
  let filePath: string | null = null;
  let line: number | null = null;
  let column: number | null = null;
  let language: string | null = null;
  let summary = "";
  let stackTrace = "";
  let errorCategory = "COMMAND_FAILURE";

  // 1. Python Traceback
  const pyTracebackMatch = combinedText.match(/Traceback \(most recent call last\):([\s\S]+)$/);
  if (pyTracebackMatch) {
    language = "python";
    errorCategory = "PYTHON_TRACEBACK";
    const traceBody = pyTracebackMatch[1];
    stackTrace = pyTracebackMatch[0].trim();

    const frameRegex = /File\s+["\x27]([^"\x27]+)["\x27],\s+line\s+(\d+)(?:,\s+in\s+([^\n]+))?/g;
    let match: RegExpExecArray | null;
    let lastFrame: { file: string; line: number; fn?: string } | null = null;
    while ((match = frameRegex.exec(traceBody)) !== null) {
      lastFrame = {
        file: match[1],
        line: parseInt(match[2], 10),
        fn: match[3] || undefined,
      };
    }

    if (lastFrame) {
      filePath = lastFrame.file;
      line = lastFrame.line;
    }

    const errLineMatch = traceBody.match(/\n([A-Za-z0-9_.]+(?:Error|Exception|Interrupt|Exit|Warning))(?::\s*(.*))?$/);
    if (errLineMatch) {
      summary = errLineMatch[2] ? `${errLineMatch[1]}: ${errLineMatch[2].trim()}` : errLineMatch[1];
    } else {
      const lastLine = traceBody.trim().split("\n").pop();
      if (lastLine) summary = lastLine.trim();
    }
  }

  // 2. TypeScript Compiler Error
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

  // 3. pytest failure output
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

      const baseName = (filePath.split("/").pop() || filePath).replace(/[/\\.]/g, "\\$&");
      const lineMatch = combinedText.match(new RegExp(`(?:${filePath.replace(/[/\\.]/g, "\\$&")}|${baseName}):(\\d+):`));
      if (lineMatch) {
        line = parseInt(lineMatch[1], 10);
      }
      stackTrace = combinedText;
    }
  }

  // 4. JavaScript / Node.js Stack Trace
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
      summary = `Error at ${filePath.split("/").pop() || filePath}:${line}`;
      stackTrace = combinedText;
    }
  }

  // 5. npm ERR! output
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

  // 6. Generic Fallback
  if (!summary) {
    if (options.exitCode !== undefined && options.exitCode !== 0) {
      const lastLines = combinedText.trim().split("\n").filter(Boolean).slice(-3).join(" ");
      summary = lastLines || `Process exited with code ${options.exitCode}${options.signal ? ` (${options.signal})` : ""}`;
    } else if (combinedText.trim()) {
      summary = combinedText.trim().split("\n")[0] || "Process reported error output";
    } else {
      return null;
    }
    stackTrace = combinedText;
  }

  let friendlyExplanation = "";
  for (const [sysCode, explanation] of Object.entries(SYSTEM_ERROR_TRANSLATIONS)) {
    if (combinedText.includes(sysCode) || summary.includes(sysCode)) {
      friendlyExplanation = explanation;
      break;
    }
  }

  const boundedSummary = summary.length > 400 ? summary.slice(0, 400) + "..." : summary;
  const boundedStackTrace = stackTrace.length > 2000 ? stackTrace.slice(0, 2000) + "\n... [TRUNCATED]" : stackTrace;

  return {
    command: options.command ? sanitizeSecrets(options.command) : undefined,
    cwd: options.cwd || undefined,
    exitCode: options.exitCode,
    signal: options.signal,
    errorCategory,
    summary: boundedSummary,
    friendlyExplanation: friendlyExplanation || undefined,
    stdout: options.command ? sanitizeSecrets(combinedText.slice(-1000)) : undefined,
    stackTrace: boundedStackTrace,
    filePath: filePath || null,
    line: Number.isInteger(line) ? line : null,
    column: Number.isInteger(column) ? column : null,
    language: language || null,
    timestamp: Date.now(),
  };
}
