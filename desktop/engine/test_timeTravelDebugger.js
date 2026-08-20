/**
 * Echo Nullity — Time-Travel Debugger v2 Test Suite
 * Validates Python step-by-step execution, variable tracking, exception capture,
 * stdout/stderr isolation, and deterministic replay.
 */

const { execFileSync } = require("child_process");
const assert = require("assert");

console.log("[TEST] Starting Time-Travel Debugger v2 Test Suite...");

function generatePythonDebuggerScript(userCode) {
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
        __steps__[-1]["stdout"] = __captured_stdout__.getvalue()
        __steps__[-1]["stderr"] = __captured_stderr__.getvalue()

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
        "step": __step_count__,
        "line": frame.f_lineno,
        "event": event,
        "functionName": frame.f_code.co_name if frame.f_code.co_name != "<module>" else None,
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

function debugPython(code) {
  try {
    const pythonScript = generatePythonDebuggerScript(code);
    const out = execFileSync("python3", ["-c", pythonScript], { encoding: "utf8", timeout: 10000 });
    const parsed = JSON.parse(out.trim());
    return {
      steps: parsed.steps || [],
      success: !!parsed.success,
      error: parsed.error,
    };
  } catch (err) {
    return {
      steps: [],
      success: false,
      error: err.message,
    };
  }
}

async function runTests() {
  // 1. Arithmetic & Variable Snapshots
  const code1 = `
a = 10
b = 20
c = a + b
`;
  const res1 = debugPython(code1);
  assert(res1.success && res1.steps.length >= 3, "Test 1: Arithmetic execution failed");
  const lastStep = res1.steps[res1.steps.length - 1];
  assert(lastStep.locals.c === 30 || lastStep.globals.c === 30, "Test 1: Expected c=30");
  console.log("[PASS] Test 1: Arithmetic & Variable Snapshots");

  // 2. Loops & Variable Mutations
  const code2 = `
total = 0
for i in range(5):
    total += i
`;
  const res2 = debugPython(code2);
  assert(res2.success && res2.steps.length >= 5, "Test 2: Loop tracing failed");
  console.log("[PASS] Test 2: Loops & Variable Mutations");

  // 3. Function Calls
  const code3 = `
def multiply(x, y):
    res = x * y
    return res

ans = multiply(6, 7)
`;
  const res3 = debugPython(code3);
  assert(res3.success, "Test 3: Function call failed");
  const funcStep = res3.steps.find((s) => s.functionName === "multiply");
  assert(funcStep, "Test 3: Function call name multiply not tracked");
  console.log("[PASS] Test 3: Function Calls");

  // 4. Recursion
  const code4 = `
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

f4 = factorial(4)
`;
  const res4 = debugPython(code4);
  assert(res4.success && res4.steps.length >= 8, "Test 4: Recursion tracing failed");
  console.log("[PASS] Test 4: Recursion");

  // 5. Exception Handling
  const code5 = `
x = 10
y = 0
z = x / y
`;
  const res5 = debugPython(code5);
  assert(res5.success === false, "Test 5: Expected success=false on zero division");
  console.log("[PASS] Test 5: Exception Handling");

  // 6. Incremental Stdout Capture
  const code6 = `
print("Hello Step 1")
x = 100
print("Hello Step 2")
`;
  const res6 = debugPython(code6);
  const stdoutSteps = res6.steps.filter((s) => s.stdout && s.stdout.length > 0);
  assert(stdoutSteps.length > 0, "Test 6: Stdout was not captured");
  console.log("[PASS] Test 6: Incremental Stdout Capture");

  // 7. Deterministic Replay
  const replay1 = debugPython(code1);
  const replay2 = debugPython(code1);
  assert.strictEqual(JSON.stringify(replay1.steps), JSON.stringify(replay2.steps), "Test 7: Non-deterministic replay detected");
  console.log("[PASS] Test 7: Deterministic Replay");

  console.log(">>> ALL 7 TIME-TRAVEL DEBUGGER TESTS PASSED! <<<");
}

runTests().catch((err) => {
  console.error("[TEST ERROR]", err);
  process.exit(1);
});
