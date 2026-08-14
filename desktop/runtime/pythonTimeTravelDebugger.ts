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
      pyodideInstance = await (window as any).loadPyodide();
      return pyodideInstance;
    }
    throw new Error("Pyodide is only supported in browser environment.");
  })();

  return pyodideLoadingPromise;
}

export function generatePythonDebuggerScript(userCode: string): string {
  const escapedUserCode = JSON.stringify(userCode);
  return `
import sys
import json
import io

__user_code__ = ${escapedUserCode}
__steps__ = []
__step_count__ = 0
__max_steps__ = 500
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
    
    if frame.f_code.co_filename != "<string>":
        return __trace_func__

    if __steps__:
        __steps__[-1]['stdout'] = __captured_stdout__.getvalue()
        __steps__[-1]['stderr'] = __captured_stderr__.getvalue()

    __step_count__ += 1
    
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
        'step': __step_count__,
        'line': frame.f_lineno,
        'event': event,
        'functionName': frame.f_code.co_name if frame.f_code.co_name != '<module>' else None,
        'locals': clean_locals,
        'globals': clean_globals,
        'stdout': __captured_stdout__.getvalue(),
        'stderr': __captured_stderr__.getvalue()
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
        __steps__[-1]['stdout'] = __captured_stdout__.getvalue()
        __steps__[-1]['stderr'] = __captured_stderr__.getvalue()
    sys.stdout = __orig_stdout__
    sys.stderr = __orig_stderr__

__result_payload__ = {
    'steps': __steps__,
    'success': __execution_success__,
    'error': __execution_error__
}

print(json.dumps(__result_payload__))
`;
}

function getExecFile(): any {
  try {
    const req = eval('require');
    return req('child_process').execFile;
  } catch (e) {
    return null;
  }
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
    const execFileFn = getExecFile();
    if (!execFileFn) {
      return resolve({
        steps: [],
        success: false,
        error: "Node child_process execution not available",
      });
    }

    const pythonScript = generatePythonDebuggerScript(code);
    execFileFn("python3", ["-c", pythonScript], { maxBuffer: 10 * 1024 * 1024 }, (err: any, stdout: string, stderr: string) => {
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

export default debugPython;

if (typeof module !== 'undefined' && module.exports) {
  module.exports = debugPython;
  (module.exports as any).debugPython = debugPython;
  (module.exports as any).default = debugPython;
}
