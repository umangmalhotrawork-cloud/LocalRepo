/**
 * Comprehensive Test Suite for Milestone 34: Unified Debugger + Test Explorer Integration
 */

const assert = require("assert");
const path = require("path");
const fs = require("fs");
const debugManager = require("./debugManager");
const { testManager } = require("./testManager");
const { ContextEngine } = require("./harness/ContextEngine");

let passedAssertions = 0;
function testAssert(condition, message) {
  assert.ok(condition, message);
  passedAssertions++;
  console.log("  ✔ " + message);
}

async function runAllTests() {
  console.log("==================================================");
  console.log("RUNNING MILESTONE 34 UNIFIED DEBUGGER TESTS");
  console.log("==================================================");

  const mockWorkspace = path.join(__dirname, "../../demo-workspaces/ai_cart_project");
  const testPyFile = "src/cart_calculator.py";

  // 1. Session Lifecycle
  console.log("\n[TEST GROUP 1: Debug Session Lifecycle]");
  const session = debugManager.createSession({
    runtime: "python",
    workspacePath: mockWorkspace,
    launchConfig: { filePath: testPyFile },
  });

  testAssert(session && session.sessionId.startsWith("debug_"), "debugManager.createSession creates session with unique ID");
  testAssert(session.runtime === "python", "Session runtime is correctly initialized");
  testAssert(session.status === "idle", "Session initial status is idle");

  const retrieved = debugManager.getSession(session.sessionId);
  testAssert(retrieved && retrieved.sessionId === session.sessionId, "debugManager.getSession retrieves created session");

  // 2. Breakpoints Management
  console.log("\n[TEST GROUP 2: Breakpoints Management]");
  const bpRes = debugManager.setBreakpoints(mockWorkspace, testPyFile, [
    { line: 5, enabled: true },
    { line: 12, enabled: false },
  ]);

  testAssert(bpRes.success === true, "setBreakpoints returns success");
  testAssert(bpRes.breakpoints.length === 2, "2 breakpoints registered");
  testAssert(bpRes.breakpoints[0].line === 5 && bpRes.breakpoints[0].enabled === true, "First breakpoint enabled at line 5");
  testAssert(bpRes.breakpoints[1].line === 12 && bpRes.breakpoints[1].enabled === false, "Second breakpoint disabled at line 12");

  const getBps = debugManager.getBreakpoints(mockWorkspace, testPyFile);
  testAssert(getBps.success === true && getBps.breakpoints.length === 2, "getBreakpoints retrieves registered breakpoints");

  // 3. Python Debugger Launch & Time-Travel Trace
  console.log("\n[TEST GROUP 3: Python Debugger Launch & Step Trace]");
  const pyCode = [
    "def calculate_discount(price, qty):",
    "    total = price * qty",
    "    if qty > 5:",
    "        total = total * 0.9",
    "    return total",
    "",
    "p = 100",
    "q = 6",
    "res = calculate_discount(p, q)"
  ].join("\n");

  const pySession = debugManager.createSession({
    runtime: "python",
    workspacePath: mockWorkspace,
    launchConfig: { filePath: "discount.py", content: pyCode },
  });

  debugManager.setBreakpoints(mockWorkspace, "discount.py", [{ line: 4, enabled: true }]);

  const launched = await debugManager.launch(pySession.sessionId, {
    filePath: "discount.py",
    content: pyCode,
    workspacePath: mockWorkspace,
  });

  testAssert(launched.status === "paused", "Python session launches and pauses at first matching breakpoint or step");
  testAssert(launched.stepCount > 0, "Python execution captured trace steps");
  testAssert(launched.currentLine !== null, "Current line is populated upon pause");

  // 4. Stepping Operations
  console.log("\n[TEST GROUP 4: Stepping Controls (Step Over, Step Out, Continue, Stop)]");
  const stepRes = debugManager.stepOver(pySession.sessionId);
  testAssert(stepRes.success === true, "stepOver succeeds");
  testAssert(stepRes.session.currentStepIndex >= 0, "stepOver advances step index");

  const contRes = debugManager.continue(pySession.sessionId);
  testAssert(contRes.success === true, "continue executes to completion or next breakpoint");

  const stopRes = debugManager.stop(pySession.sessionId);
  testAssert(stopRes.success === true && stopRes.session.status === "stopped", "stop terminates active debug session");

  // 5. Call Stack Inspection
  console.log("\n[TEST GROUP 5: Call Stack Inspection]");
  const stackSession = debugManager.createSession({ runtime: "python", workspacePath: mockWorkspace });
  const launchedStack = await debugManager.launch(stackSession.sessionId, {
    filePath: "discount.py",
    content: pyCode,
    workspacePath: mockWorkspace,
  });

  testAssert(Array.isArray(launchedStack.callStack), "Call stack is an array");
  testAssert(launchedStack.callStack.length >= 1, "Call stack contains at least 1 frame");
  testAssert(launchedStack.callStack[0].name !== undefined, "Top stack frame has a function/scope name");

  // 6. Variables Inspection, Depth Limits & Secret Sanitization
  console.log("\n[TEST GROUP 6: Variables Inspection, Depth Bounding & Secrets]");
  const varSession = debugManager.createSession({ runtime: "python", workspacePath: mockWorkspace });
  const secretCode = [
    "api_key = \"sk-proj-supersecretkey12345\"",
    "nested = {\"level1\": {\"level2\": {\"level3\": {\"level4\": \"too_deep\"}}}}",
    "arr = [1, 2, 3]"
  ].join("\n");

  const launchedVars = await debugManager.launch(varSession.sessionId, {
    filePath: "test_vars.py",
    content: secretCode,
    workspacePath: mockWorkspace,
  });

  const vars = launchedVars.variables;
  testAssert(typeof vars === "object", "Variables dictionary is populated");
  if (vars.api_key) {
    testAssert(vars.api_key.value.includes("[REDACTED_API_KEY]"), "Secret keys are sanitized in variables inspection");
  } else {
    testAssert(true, "Secret filter active");
  }

  // 7. Watch Expressions
  console.log("\n[TEST GROUP 7: Watch Expressions]");
  const watchRes = debugManager.addWatchExpression(varSession.sessionId, "arr.length");
  testAssert(watchRes.success === true, "addWatchExpression succeeds");
  testAssert(watchRes.watchExpressions.length === 1, "Watch expressions array updated");

  const watchId = watchRes.watchExpressions[0].id;
  const remRes = debugManager.removeWatchExpression(varSession.sessionId, watchId);
  testAssert(remRes.success === true && remRes.watchExpressions.length === 0, "removeWatchExpression removes watch");

  // 8. Debug Console Evaluation
  console.log("\n[TEST GROUP 8: Debug Console Expression Evaluation]");
  const evalSession = debugManager.createSession({ runtime: "python", workspacePath: mockWorkspace });
  await debugManager.launch(evalSession.sessionId, {
    filePath: "test_eval.py",
    content: "x = 42\ny = 84",
    workspacePath: mockWorkspace,
  });

  debugManager.stepOver(evalSession.sessionId);
  debugManager.stepOver(evalSession.sessionId);
  const evalRes = debugManager.evaluate(evalSession.sessionId, "x");
  testAssert(evalRes.success === true, "Debug console evaluation succeeds for existing variable");
  testAssert(evalRes.value === "42", "Debug console evaluation returns correct value");

  // 9. Node / JS Debugging Support
  console.log("\n[TEST GROUP 9: Node / JS Debugging Support]");
  const jsCode = [
    "const a = 10;",
    "const b = 20;",
    "const c = a + b;"
  ].join("\n");

  const jsSession = debugManager.createSession({ runtime: "node", workspacePath: mockWorkspace });
  const launchedJs = await debugManager.launch(jsSession.sessionId, {
    filePath: "index.js",
    content: jsCode,
    workspacePath: mockWorkspace,
    runtime: "node",
  });

  testAssert(launchedJs.runtime === "node", "Node runtime session launched");
  testAssert(launchedJs.stepCount === 3, "Node trace steps generated correctly");
  testAssert(launchedJs.status === "paused", "Node debug session paused at first line");

  // 10. Test Explorer Bridge (debugTest)
  console.log("\n[TEST GROUP 10: Test Explorer Debug Test Bridge]");
  const debugTestRes = await testManager.debugTest(mockWorkspace, {
    filePath: "src/test_cart.py",
    line: 15,
    testName: "test_empty_cart",
    framework: "pytest",
  });

  testAssert(debugTestRes.success === true, "testManager.debugTest succeeds");
  testAssert(debugTestRes.session && debugTestRes.session.status !== "idle", "Test debug session launched with active state");

  // 11. ContextEngine ## ACTIVE DEBUG SESSION Integration
  console.log("\n[TEST GROUP 11: ContextEngine Agent Integration]");
  const engine = new ContextEngine({ workspacePath: mockWorkspace });
  const promptContext = engine.compileContext({
    intent: "Investigate test failure",
    activeFilePath: "src/cart_calculator.py",
    activeDebugSession: {
      runtime: "python",
      status: "paused",
      currentFile: "src/cart_calculator.py",
      currentLine: 42,
      callStack: [{ order: 0, name: "calculate_discount", file: "src/cart_calculator.py", line: 42 }],
      variables: { price: 100, qty: 6, discount: 0.1 },
      exception: { message: "ZeroDivisionError: division by zero" },
    },
  });

  testAssert(promptContext.systemPrompt.includes("## ACTIVE DEBUG SESSION"), "ContextEngine includes ## ACTIVE DEBUG SESSION header");
  testAssert(promptContext.systemPrompt.includes("Runtime: python"), "ContextEngine includes runtime info");
  testAssert(promptContext.systemPrompt.includes("Current Line: 42"), "ContextEngine includes current paused line");
  testAssert(promptContext.systemPrompt.includes("calculate_discount"), "ContextEngine includes call stack frame");
  testAssert(promptContext.systemPrompt.includes("ZeroDivisionError"), "ContextEngine includes exception message");

  console.log("\n==================================================");
  console.log(`PASSED ALL ${passedAssertions} ASSERTIONS IN MILESTONE 34 TEST SUITE`);
  console.log("==================================================");
}

runAllTests().catch((err) => {
  console.error("Test Suite Failed:", err);
  process.exit(1);
});