import { execFile } from "child_process";

export type DebugStep = {
  step: number;
  line: number;
  locals: Record<string, any>;
  globals: Record<string, any>;
  stdout: string;
  stderr: string;
  event: 'line' | 'call' | 'return' | 'exception';
  functionName?: string;
};

let pyodideInstance: any = null;
let pyodideLoadingPromise: Promise<any> | null = null;

async function getPyodide(): Promise<any> {
  if (pyodideInstance) return pyodideInstance;
  if (pyodideLoadingPromise) return pyodideLoadingPromise;

  pyodideLoadingPromise = (async () => {
    if (typeof window !== "undefined") {
      if (!(window as any).loadPyodide) {
        await new Promise<void>((resolve, reject) => {
          const script = document.createElement("script");
          script.src = "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/pyodide.js";
          script.onload = () => resolve();
          script.onerror = (e) => reject(new Error("Failed to load Pyodide CDN script"));
          document.head.appendChild(script);
        });
      }
      const loadPyodideFn = (window as any).loadPyodide;
      const pyodide = await loadPyodideFn({
        indexURL: "https://cdn.jsdelivr.net/pyodide/v0.27.7/full/",
      });
      pyodideInstance = pyodide;
      return pyodide;
    }
    throw new Error("Pyodide can only be loaded in a browser environment");
  })();

  return pyodideLoadingPromise;
}

export function generatePythonDebuggerScript(userCode: string): string {
  const escapedUserCode = JSON.stringify(userCode);
  return `
import sys, io, json, traceback

__user_code_str__ = ${escapedUserCode}
__debug_steps__ = []
__stdout_capture__ = io.StringIO()
__stderr_capture__ = io.StringIO()

__orig_stdout__ = sys.stdout
__orig_stderr__ = sys.stderr

def __safe_serialize__(val):
    if val is None or isinstance(val, (int, float, bool, str)):
        return val
    elif isinstance(val, (list, tuple)):
        return [__safe_serialize__(x) for x in val[:100]]
    elif isinstance(val, dict):
        return {str(k): __safe_serialize__(v) for k, v in list(val.items())[:100]}
    elif isinstance(val, set):
        return [__safe_serialize__(x) for x in list(val)[:100]]
    else:
        try:
            return repr(val)
        except Exception:
            return str(type(val))

__step_counter__ = 0

def __trace_handler__(frame, event, arg):
    global __step_counter__
    # Ignore internal framework execution frames
    if frame.f_code.co_filename not in ('<string>', '<user_code>'):
        return __trace_handler__

    __step_counter__ += 1
    lineno = frame.f_lineno
    func_name = frame.f_code.co_name

    locals_map = {}
    for k, v in frame.f_locals.items():
        if not k.startswith('__') and k not in ['sys', 'io', 'json', 'traceback']:
            locals_map[k] = __safe_serialize__(v)

    globals_map = {}
    for k, v in frame.f_globals.items():
        if not k.startswith('__') and k not in ['sys', 'io', 'json', 'traceback']:
            globals_map[k] = __safe_serialize__(v)

    current_stdout = __stdout_capture__.getvalue()
    current_stderr = __stderr_capture__.getvalue()

    step_info = {
        'step': __step_counter__,
        'line': lineno,
        'locals': locals_map,
        'globals': globals_map,
        'stdout': current_stdout,
        'stderr': current_stderr,
        'event': event if event in ['line', 'call', 'return', 'exception'] else 'line',
        'functionName': func_name if func_name != '<module>' else None
    }
    __debug_steps__.append(step_info)
    return __trace_handler__

__execution_error__ = None

try:
    sys.stdout = __stdout_capture__
    sys.stderr = __stderr_capture__
    __compiled_code__ = compile(__user_code_str__, '<string>', 'exec')
    sys.settrace(__trace_handler__)
    exec(__compiled_code__, {})
except Exception as e:
    __execution_error__ = traceback.format_exc()
    __stderr_capture__.write(str(e))
finally:
    sys.settrace(None)
    sys.stdout = __orig_stdout__
    sys.stderr = __orig_stderr__

__result_payload__ = {
    'steps': __debug_steps__,
    'success': __execution_error__ is None,
    'error': __execution_error__
}

print(json.dumps(__result_payload__))
`;
}

export async function debugPython(code: string): Promise<{
  steps: DebugStep[];
  success: boolean;
  error?: string;
}> {
  if (!code || !code.trim()) {
    return {
      steps: [],
      success: true,
    };
  }

  // 1. Browser environment using Pyodide WebAssembly
  if (typeof window !== "undefined") {
    try {
      const pyodide = await getPyodide();
      const pythonScript = generatePythonDebuggerScript(code);

      let capturedOutput = "";
      pyodide.setStdout({
        batched: (text: string) => {
          capturedOutput += text;
        },
      });

      await pyodide.runPythonAsync(pythonScript);
      const parsed = JSON.parse(capturedOutput.trim());
      return {
        steps: parsed.steps || [],
        success: !!parsed.success,
        error: parsed.error,
      };
    } catch (err: any) {
      return {
        steps: [],
        success: false,
        error: err.message || String(err),
      };
    }
  }

  // 2. Node / Testing environment fallback via Python3 CLI
  return new Promise((resolve) => {
    const pythonScript = generatePythonDebuggerScript(code);
    execFile("python3", ["-c", pythonScript], { maxBuffer: 10 * 1024 * 1024 }, (err, stdout, stderr) => {
      if (err && !stdout) {
        return resolve({
          steps: [],
          success: false,
          error: stderr || err.message,
        });
      }

      try {
        const parsed = JSON.parse(stdout.trim());
        resolve({
          steps: parsed.steps || [],
          success: parsed.success,
          error: parsed.error,
        });
      } catch (parseErr: any) {
        resolve({
          steps: [],
          success: false,
          error: `JSON Parse error: ${parseErr.message} (output: ${stdout})`,
        });
      }
    });
  });
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    debugPython,
    generatePythonDebuggerScript,
  };
}
