import { debugPython } from "./pythonTimeTravelDebugger";

export async function runTimeTravelDebuggerTests() {
  console.log("[TEST] Starting Time-Travel Debugger v2 Test Suite...");

  // 1. Arithmetic & Variable Snapshots
  const code1 = `
a = 10
b = 20
c = a + b
`;
  const res1 = await debugPython(code1);
  console.log(`[TEST 1] Arithmetic steps: count=${res1.steps.length}, success=${res1.success}`);
  if (!res1.success || res1.steps.length < 3) {
    throw new Error("Test 1: Arithmetic execution failed");
  }
  const lastStep = res1.steps[res1.steps.length - 1];
  if (lastStep.locals.c !== 30 && lastStep.globals.c !== 30) {
    throw new Error(`Test 1: Expected c=30, got locals=${JSON.stringify(lastStep.locals)}, globals=${JSON.stringify(lastStep.globals)}`);
  }

  // 2. Loops & Variable Mutations
  const code2 = `
total = 0
for i in range(5):
    total += i
`;
  const res2 = await debugPython(code2);
  console.log(`[TEST 2] Loops steps: count=${res2.steps.length}`);
  if (!res2.success || res2.steps.length < 5) {
    throw new Error("Test 2: Loop tracing failed");
  }

  // 3. Function Calls
  const code3 = `
def multiply(x, y):
    res = x * y
    return res

ans = multiply(6, 7)
`;
  const res3 = await debugPython(code3);
  console.log(`[TEST 3] Function calls steps: count=${res3.steps.length}`);
  const funcStep = res3.steps.find((s) => s.functionName === "multiply");
  if (!funcStep) {
    throw new Error("Test 3: Function call name 'multiply' not tracked");
  }

  // 4. Recursion
  const code4 = `
def factorial(n):
    if n <= 1:
        return 1
    return n * factorial(n - 1)

f4 = factorial(4)
`;
  const res4 = await debugPython(code4);
  console.log(`[TEST 4] Recursion steps: count=${res4.steps.length}`);
  if (!res4.success || res4.steps.length < 8) {
    throw new Error("Test 4: Recursion tracing failed");
  }

  // 5. Exception Handling
  const code5 = `
x = 10
y = 0
z = x / y
`;
  const res5 = await debugPython(code5);
  console.log(`[TEST 5] Exception capture: success=${res5.success}, error='${res5.error ? res5.error.slice(0, 40) : ""}'`);
  if (res5.success !== false) {
    throw new Error("Test 5: Expected success=false on zero division");
  }

  // 6. Incremental Stdout Capture
  const code6 = `
print("Hello Step 1")
x = 100
print("Hello Step 2")
`;
  const res6 = await debugPython(code6);
  console.log(`[TEST 6] Stdout capture: steps=${res6.steps.length}`);
  const stdoutSteps = res6.steps.filter((s) => s.stdout && s.stdout.length > 0);
  if (stdoutSteps.length === 0) {
    throw new Error("Test 6: Stdout was not captured");
  }

  // 7. Deterministic Replay (identical runs produce identical steps)
  const replay1 = await debugPython(code1);
  const replay2 = await debugPython(code1);
  if (JSON.stringify(replay1.steps) !== JSON.stringify(replay2.steps)) {
    throw new Error("Test 7: Non-deterministic replay detected");
  }
  console.log("[TEST 7] Deterministic replay verified across runs");

  console.log(">>> ALL 7 TIME-TRAVEL DEBUGGER TESTS PASSED SUCCESSFULLY! <<<");
  return true;
}

runTimeTravelDebuggerTests().catch((err) => {
  console.error("[TEST ERROR]", err);
  process.exit(1);
});
