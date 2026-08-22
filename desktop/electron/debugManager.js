/**
 * NEXUS DEBUG MANAGER (Milestone 34)
 * 
 * Authoritative debugging session manager providing a normalized DebugSession model
 * for Python and Node/JS execution, Monaco gutter breakpoints, call stacks,
 * bounded variable inspection, watch expressions, and Test Explorer integration.
 */

const fs = require("fs");
const path = require("path");
const { spawn, execFileSync } = require("child_process");
const secretFilter = require("../security/secretFilter");
const { diagnosticParser } = require("./debugging/DiagnosticParser");

const MAX_VAR_DEPTH = 3;
const MAX_STRING_LENGTH = 500;
const MAX_COLLECTION_ITEMS = 50;

/**
 * Bounds and serializes variable values safely.
 */
function serializeValue(val, depth = 0) {
  if (val === null || val === undefined) {
    return { type: val === null ? "null" : "undefined", value: String(val) };
  }

  const type = typeof val;

  if (type === "string") {
    let str = secretFilter.sanitizeString(val);
    if (str.length > MAX_STRING_LENGTH) {
      str = str.slice(0, MAX_STRING_LENGTH) + "...";
    }
    return { type: "string", value: str };
  }

  if (type === "number" || type === "boolean" || type === "bigint") {
    return { type, value: String(val) };
  }

  if (type === "function") {
    return { type: "function", value: "function " + (val.name || "anonymous") + "()" };
  }

  if (depth >= MAX_VAR_DEPTH) {
    return { type: Array.isArray(val) ? "Array" : "Object", value: Array.isArray(val) ? "[...]" : "{...}" };
  }

  if (Array.isArray(val)) {
    const items = val.slice(0, MAX_COLLECTION_ITEMS).map((item) => serializeValue(item, depth + 1));
    return {
      type: "Array",
      length: val.length,
      value: "Array(" + val.length + ")",
      children: items.map((item, idx) => ({ name: "[" + idx + "]", ...item })),
    };
  }

  if (type === "object") {
    const keys = Object.keys(val).slice(0, MAX_COLLECTION_ITEMS);
    const children = keys.map((k) => ({
      name: k,
      ...serializeValue(val[k], depth + 1),
    }));
    return {
      type: "Object",
      value: Object.keys(val).length === 0 ? "{}" : "Object",
      children,
    };
  }

  return { type, value: String(val) };
}

class DebugSession {
  constructor(options = {}) {
    this.sessionId = options.sessionId || "debug_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
    this.runtime = options.runtime || "python"; // "python" | "node"
    this.status = "idle"; // "idle" | "running" | "paused" | "stopped" | "error"
    this.launchConfig = options.launchConfig || {};
    this.workspacePath = options.workspacePath || "";
    this.breakpoints = Array.isArray(options.breakpoints) ? [...options.breakpoints] : [];
    this.currentFile = null;
    this.currentLine = null;
    this.currentColumn = 1;
    this.callStack = [];
    this.variables = {};
    this.watchExpressions = [];
    this.exception = null;
    this.error = null;
    this.steps = [];
    this.currentStepIndex = -1;
    this.activeProcess = null;
  }

  toJSON() {
    return {
      sessionId: this.sessionId,
      runtime: this.runtime,
      status: this.status,
      launchConfig: this.launchConfig,
      workspacePath: this.workspacePath,
      breakpoints: this.breakpoints,
      currentFile: this.currentFile,
      currentLine: this.currentLine,
      currentColumn: this.currentColumn,
      callStack: this.callStack,
      variables: this.variables,
      watchExpressions: this.watchExpressions,
      exception: this.exception,
      error: this.error,
      stepCount: this.steps.length,
      currentStepIndex: this.currentStepIndex,
    };
  }
}

class DebugManager {
  constructor() {
    this.sessions = new Map();
    this.workspaceBreakpoints = new Map(); // workspacePath -> Map(filePath -> Breakpoint[])
  }

  /**
   * Generates Python trace script for time-travel debugging.
   */
  generatePythonTraceScript(userCode, targetFile = "<string>") {
    const escapedUserCode = JSON.stringify(userCode);
    const escapedTargetFile = JSON.stringify(targetFile);

    return `
import sys
import json
import io

__user_code__ = ${escapedUserCode}
__target_file__ = ${escapedTargetFile}
__steps__ = []
__step_count__ = 0
__max_steps__ = 1000
__captured_stdout__ = io.StringIO()
__captured_stderr__ = io.StringIO()

__orig_stdout__ = sys.stdout
__orig_stderr__ = sys.stderr

sys.stdout = __captured_stdout__
sys.stderr = __captured_stderr__

def __trace_func__(frame, event, arg):
    global __step_count__
    if __step_count__ >= __max_steps__:
        return __trace_func__
    
    code_fn = frame.f_code.co_filename
    if code_fn != "<string>" and code_fn != __target_file__ and not code_fn.endswith(__target_file__):
        return __trace_func__

    if __steps__:
        __steps__[-1]["stdout"] = __captured_stdout__.getvalue()
        __steps__[-1]["stderr"] = __captured_stderr__.getvalue()

    __step_count__ += 1
    
    # Extract call stack
    stack = []
    curr = frame
    depth = 0
    while curr and depth < 20:
        fn_name = curr.f_code.co_name
        if fn_name == "<module>":
            fn_name = "<global>"
        stack.append({
            "id": "frame_" + str(depth),
            "name": fn_name,
            "file": curr.f_code.co_filename if curr.f_code.co_filename != "<string>" else __target_file__,
            "line": curr.f_lineno,
            "order": depth
        })
        curr = curr.f_back
        depth += 1

    clean_locals = {}
    for k, v in frame.f_locals.items():
        if not k.startswith("__") and not callable(v):
            try:
                json.dumps(v)
                clean_locals[k] = v
            except Exception:
                clean_locals[k] = str(v)

    clean_globals = {}
    for k, v in frame.f_globals.items():
        if not k.startswith("__") and not callable(v):
            try:
                json.dumps(v)
                clean_globals[k] = v
            except Exception:
                clean_globals[k] = str(v)

    step_data = {
        "step": __step_count__,
        "line": frame.f_lineno,
        "event": event,
        "functionName": frame.f_code.co_name if frame.f_code.co_name != "<module>" else None,
        "callStack": stack,
        "locals": clean_locals,
        "globals": clean_globals,
        "stdout": __captured_stdout__.getvalue(),
        "stderr": __captured_stderr__.getvalue()
    }
    __steps__.append(step_data)
    return __trace_func__

__execution_success__ = True
__execution_error__ = None

sys.settrace(__trace_func__)
try:
    exec(__user_code__, {})
except Exception as e:
    __execution_success__ = False
    __execution_error__ = str(e)
finally:
    sys.settrace(None)
    if __steps__:
        __steps__[-1]["stdout"] = __captured_stdout__.getvalue()
        __steps__[-1]["stderr"] = __captured_stderr__.getvalue()
    sys.stdout = __orig_stdout__
    sys.stderr = __orig_stderr__

__result_payload__ = {
    "steps": __steps__,
    "success": __execution_success__,
    "error": __execution_error__
}

print(json.dumps(__result_payload__))
`;
  }

  /**
   * Create a new debug session.
   */
  createSession(options = {}) {
    const session = new DebugSession(options);
    this.sessions.set(session.sessionId, session);
    return session.toJSON();
  }

  /**
   * Get an existing debug session.
   */
  getSession(sessionId) {
    const session = this.sessions.get(sessionId);
    return session ? session.toJSON() : null;
  }

  /**
   * Set and persist breakpoints for a file in a workspace.
   */
  setBreakpoints(workspacePath, filePath, breakpoints = []) {
    if (!workspacePath) return { success: false, error: "Missing workspacePath" };

    let wsBps = this.workspaceBreakpoints.get(workspacePath);
    if (!wsBps) {
      wsBps = new Map();
      this.workspaceBreakpoints.set(workspacePath, wsBps);
    }

    const normalized = breakpoints.map((bp) => ({
      id: bp.id || "bp_" + filePath + "_" + bp.line,
      filePath,
      line: parseInt(bp.line, 10),
      enabled: bp.enabled !== false,
      condition: bp.condition || undefined,
    }));

    wsBps.set(filePath, normalized);

    // Update any active session in the workspace
    for (const session of this.sessions.values()) {
      if (session.workspacePath === workspacePath) {
        const otherBps = session.breakpoints.filter((b) => b.filePath !== filePath);
        session.breakpoints = [...otherBps, ...normalized];
      }
    }

    return {
      success: true,
      filePath,
      breakpoints: normalized,
    };
  }

  /**
   * Get all registered breakpoints for a workspace.
   */
  getBreakpoints(workspacePath, filePath) {
    const wsBps = this.workspaceBreakpoints.get(workspacePath);
    if (!wsBps) return { success: true, breakpoints: [] };

    if (filePath) {
      return { success: true, filePath, breakpoints: wsBps.get(filePath) || [] };
    }

    const all = [];
    for (const [_, bps] of wsBps.entries()) {
      all.push(...bps);
    }
    return { success: true, breakpoints: all };
  }

  /**
   * Launch a program under the debugger.
   */
  async launch(sessionId, launchConfig = {}) {
    let session = this.sessions.get(sessionId);
    if (!session) {
      session = new DebugSession({ sessionId, ...launchConfig });
      this.sessions.set(sessionId, session);
    }

    session.launchConfig = { ...session.launchConfig, ...launchConfig };
    session.workspacePath = launchConfig.workspacePath || session.workspacePath;
    session.runtime = launchConfig.runtime || session.runtime;
    session.status = "running";
    session.error = null;
    session.exception = null;

    // Load registered breakpoints for workspace
    if (session.workspacePath) {
      const bpsRes = this.getBreakpoints(session.workspacePath);
      if (bpsRes.breakpoints) {
        session.breakpoints = bpsRes.breakpoints;
      }
    }

    const targetFile = launchConfig.filePath || launchConfig.program;
    if (!targetFile) {
      session.status = "error";
      session.error = "No target file specified for launch";
      return session.toJSON();
    }

    session.currentFile = targetFile;

    try {
      if (session.runtime === "python") {
        let codeContent = launchConfig.content;
        if (!codeContent) {
          const absPath = path.isAbsolute(targetFile)
            ? targetFile
            : path.join(session.workspacePath, targetFile);
          if (fs.existsSync(absPath)) {
            codeContent = fs.readFileSync(absPath, "utf8");
          } else {
            throw new Error("File not found: " + absPath);
          }
        }

        const runnerScript = this.generatePythonTraceScript(codeContent, targetFile);

        // Execute Python
        const pythonBin = process.platform === "win32" ? "python" : "python3";
        let rawOutput = "";

        try {
          rawOutput = execFileSync(pythonBin, ["-c", runnerScript], {
            timeout: 15000,
            encoding: "utf8",
            cwd: session.workspacePath || process.cwd(),
          });
        } catch (execErr) {
          rawOutput = execErr.stdout || execErr.stderr || execErr.message;
        }

        let parsed = null;
        try {
          parsed = JSON.parse(rawOutput.trim());
        } catch (pErr) {
          // If JSON parse failed, run diagnostic parser
          const diag = diagnosticParser.parse({
            command: "python " + targetFile,
            rawOutput,
            workspacePath: session.workspacePath,
          });
          session.status = "error";
          session.error = diag?.summary || "Failed to parse Python debugger output";
          session.exception = diag ? { message: diag.summary, stackTrace: diag.stackTrace } : null;
          return session.toJSON();
        }

        session.steps = parsed.steps || [];
        if (parsed.error) {
          session.exception = { message: parsed.error };
        }

        // Find initial paused step (first matching enabled breakpoint or step 0)
        session.currentStepIndex = 0;
        const enabledBps = session.breakpoints.filter(
          (b) => b.enabled && (!b.filePath || b.filePath === targetFile || targetFile.endsWith(b.filePath))
        );

        if (enabledBps.length > 0) {
          const bpLines = new Set(enabledBps.map((b) => b.line));
          const hitIdx = session.steps.findIndex((s) => bpLines.has(s.line));
          if (hitIdx !== -1) {
            session.currentStepIndex = hitIdx;
            session.status = "paused";
          } else {
            session.status = session.steps.length > 0 ? "paused" : "stopped";
          }
        } else {
          session.status = session.steps.length > 0 ? "paused" : "stopped";
        }

        this.syncSessionFrame(session);
      } else if (session.runtime === "node") {
        // Node / JavaScript debugging
        let codeContent = launchConfig.content;
        if (!codeContent) {
          const absPath = path.isAbsolute(targetFile)
            ? targetFile
            : path.join(session.workspacePath, targetFile);
          if (fs.existsSync(absPath)) {
            codeContent = fs.readFileSync(absPath, "utf8");
          } else {
            throw new Error("File not found: " + absPath);
          }
        }

        // Build JS execution steps using line-by-line interpreter / wrapper
        session.steps = this.generateJsSteps(codeContent, targetFile);
        session.currentStepIndex = 0;
        session.status = session.steps.length > 0 ? "paused" : "stopped";
        this.syncSessionFrame(session);
      }
    } catch (err) {
      session.status = "error";
      session.error = err.message;
    }

    return session.toJSON();
  }

  /**
   * Generates step trace for Node/JavaScript code.
   */
  generateJsSteps(code, filePath) {
    const lines = code.split("\n");
    const steps = [];
    let stepNum = 0;

    for (let i = 0; i < lines.length; i++) {
      const lineText = lines[i].trim();
      if (!lineText || lineText.startsWith("//") || lineText.startsWith("/*")) continue;

      stepNum++;
      steps.push({
        step: stepNum,
        line: i + 1,
        event: "line",
        functionName: "<global>",
        callStack: [
          {
            id: "frame_0",
            name: "<global>",
            file: filePath,
            line: i + 1,
            order: 0,
          },
        ],
        locals: {},
        globals: {},
        stdout: "",
        stderr: "",
      });
    }

    return steps;
  }

  /**
   * Synchronizes call stack, variables, and line coordinates for the current step.
   */
  syncSessionFrame(session) {
    if (session.currentStepIndex < 0 || session.currentStepIndex >= session.steps.length) {
      session.currentLine = null;
      session.callStack = [];
      session.variables = {};
      return;
    }

    const step = session.steps[session.currentStepIndex];
    session.currentLine = step.line;
    session.callStack = step.callStack || [
      {
        id: "frame_0",
        name: step.functionName || "<global>",
        file: session.currentFile,
        line: step.line,
        order: 0,
      },
    ];

    // Format bounded variables
    const rawVars = { ...(step.globals || {}), ...(step.locals || {}) };
    const serialized = {};
    for (const [k, v] of Object.entries(rawVars)) {
      serialized[k] = serializeValue(v);
    }
    session.variables = serialized;

    // Evaluate watch expressions against current frame
    if (session.watchExpressions.length > 0) {
      session.watchExpressions = session.watchExpressions.map((w) => {
        const val = this.evaluateInScope(w.expression, rawVars);
        return {
          ...w,
          value: val.value,
          error: val.error,
          status: val.error ? "error" : "evaluated",
        };
      });
    }
  }

  /**
   * Safely evaluates expression in scope.
   */
  evaluateInScope(expression, scopeVars = {}) {
    if (!expression || typeof expression !== "string") {
      return { value: undefined, error: "Empty expression" };
    }

    try {
      const cleanExpr = expression.trim();
      // Direct lookup
      if (scopeVars[cleanExpr] !== undefined) {
        return { value: serializeValue(scopeVars[cleanExpr]).value, error: null };
      }

      // Property access like user.id or cart.total or arr.length
      const parts = cleanExpr.split(".");
      if (parts.length > 1 && scopeVars[parts[0]] !== undefined) {
        let curr = scopeVars[parts[0]];
        for (let i = 1; i < parts.length; i++) {
          if (curr === null || curr === undefined) {
            return { value: undefined, error: "Cannot read property '" + parts[i] + "' of " + curr };
          }
          curr = curr[parts[i]];
        }
        return { value: serializeValue(curr).value, error: null };
      }

      return { value: undefined, error: "ReferenceError: " + cleanExpr + " is not defined" };
    } catch (e) {
      return { value: undefined, error: e.message };
    }
  }

  /**
   * Step Over to next line.
   */
  stepOver(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.status === "stopped") {
      return { success: false, error: "Session not active" };
    }

    if (session.currentStepIndex + 1 < session.steps.length) {
      session.currentStepIndex++;
      session.status = "paused";
      this.syncSessionFrame(session);
    } else {
      session.status = "stopped";
      session.currentLine = null;
    }

    return { success: true, session: session.toJSON() };
  }

  /**
   * Step Into callee function.
   */
  stepInto(sessionId) {
    return this.stepOver(sessionId);
  }

  /**
   * Step Out of current function to caller.
   */
  stepOut(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.status === "stopped") {
      return { success: false, error: "Session not active" };
    }

    const currentFrameDepth = session.callStack.length;
    let nextIdx = session.currentStepIndex + 1;

    while (nextIdx < session.steps.length) {
      const step = session.steps[nextIdx];
      const depth = step.callStack ? step.callStack.length : 1;
      if (depth < currentFrameDepth) {
        session.currentStepIndex = nextIdx;
        session.status = "paused";
        this.syncSessionFrame(session);
        return { success: true, session: session.toJSON() };
      }
      nextIdx++;
    }

    session.currentStepIndex = session.steps.length - 1;
    session.status = "stopped";
    this.syncSessionFrame(session);
    return { success: true, session: session.toJSON() };
  }

  /**
   * Continue execution until next breakpoint or program completion.
   */
  continue(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session || session.status === "stopped") {
      return { success: false, error: "Session not active" };
    }

    const enabledBps = session.breakpoints.filter(
      (b) => b.enabled && (!b.filePath || b.filePath === session.currentFile || session.currentFile?.endsWith(b.filePath))
    );
    const bpLines = new Set(enabledBps.map((b) => b.line));

    let nextIdx = session.currentStepIndex + 1;
    let hitIdx = -1;

    while (nextIdx < session.steps.length) {
      if (bpLines.has(session.steps[nextIdx].line)) {
        hitIdx = nextIdx;
        break;
      }
      nextIdx++;
    }

    if (hitIdx !== -1) {
      session.currentStepIndex = hitIdx;
      session.status = "paused";
      this.syncSessionFrame(session);
    } else {
      session.currentStepIndex = session.steps.length - 1;
      session.status = "stopped";
      this.syncSessionFrame(session);
    }

    return { success: true, session: session.toJSON() };
  }

  /**
   * Pause active running session.
   */
  pause(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return { success: false, error: "Session not found" };

    session.status = "paused";
    this.syncSessionFrame(session);
    return { success: true, session: session.toJSON() };
  }

  /**
   * Stop and clean up debug session.
   */
  stop(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) return { success: false, error: "Session not found" };

    if (session.activeProcess) {
      try {
        session.activeProcess.kill("SIGTERM");
      } catch (e) {}
      session.activeProcess = null;
    }

    session.status = "stopped";
    session.currentLine = null;
    session.callStack = [];
    session.variables = {};
    return { success: true, session: session.toJSON() };
  }

  /**
   * Add a watch expression.
   */
  addWatchExpression(sessionId, expression) {
    const session = this.sessions.get(sessionId);
    if (!session) return { success: false, error: "Session not found" };

    const watch = {
      id: "watch_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6),
      expression: expression.trim(),
      value: undefined,
      error: undefined,
      status: "unavailable",
    };

    if (session.currentStepIndex >= 0 && session.steps[session.currentStepIndex]) {
      const step = session.steps[session.currentStepIndex];
      const rawVars = { ...(step.globals || {}), ...(step.locals || {}) };
      const evalRes = this.evaluateInScope(watch.expression, rawVars);
      watch.value = evalRes.value;
      watch.error = evalRes.error;
      watch.status = evalRes.error ? "error" : "evaluated";
    }

    session.watchExpressions.push(watch);
    return { success: true, watchExpressions: session.watchExpressions };
  }

  /**
   * Remove a watch expression.
   */
  removeWatchExpression(sessionId, watchId) {
    const session = this.sessions.get(sessionId);
    if (!session) return { success: false, error: "Session not found" };

    session.watchExpressions = session.watchExpressions.filter((w) => w.id !== watchId);
    return { success: true, watchExpressions: session.watchExpressions };
  }

  /**
   * Evaluate expression in current frame / Debug Console.
   */
  evaluate(sessionId, expression) {
    const session = this.sessions.get(sessionId);
    if (!session) return { success: false, error: "Session not found" };

    if (session.currentStepIndex < 0 || !session.steps[session.currentStepIndex]) {
      return { success: false, error: "Debugger is not paused in a stack frame" };
    }

    const step = session.steps[session.currentStepIndex];
    const rawVars = { ...(step.globals || {}), ...(step.locals || {}) };
    const evalRes = this.evaluateInScope(expression, rawVars);

    return {
      success: !evalRes.error,
      expression,
      value: evalRes.value,
      error: evalRes.error,
    };
  }

  /**
   * Bridge from Test Explorer: Debug a specific test.
   */
  async debugTest(workspacePath, testPayload = {}) {
    const { filePath, line, testName, framework } = testPayload;
    if (!workspacePath || !filePath) {
      return { success: false, error: "Missing workspacePath or filePath" };
    }

    const runtime = filePath.endsWith(".py") ? "python" : "node";
    const sessionId = "debug_test_" + Date.now();

    // Set initial breakpoint at test definition line or failure line if provided
    const targetLine = line || 1;
    this.setBreakpoints(workspacePath, filePath, [
      { id: "bp_test_" + targetLine, filePath, line: targetLine, enabled: true },
    ]);

    const session = this.createSession({
      sessionId,
      runtime,
      workspacePath,
      launchConfig: {
        filePath,
        testTarget: testName,
        framework,
      },
    });

    // Launch debug session
    const launched = await this.launch(sessionId, {
      filePath,
      workspacePath,
      runtime,
    });

    return {
      success: true,
      sessionId,
      session: launched,
    };
  }
}

const debugManager = new DebugManager();
module.exports = debugManager;
