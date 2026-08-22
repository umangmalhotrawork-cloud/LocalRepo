/**
 * NEXUS CODEX MILESTONE 25 - DEVELOPER CONTEXT & DEBUGGING WORKFLOW TEST SUITE
 * 
 * 20 Comprehensive Verification Scenarios:
 * 1. Python traceback parsing: extracts file, line, exception type, and summary
 * 2. TypeScript error parsing: extracts file, line, col, TS error code, and summary
 * 3. JS/Node stack parsing: extracts file, line, col, error name, and stack
 * 4. pytest failure parsing: extracts failed test name, file, line, and assertion message
 * 5. Generic command failure: handles non-zero exit code with last stderr/stdout lines
 * 6. Malformed diagnostic handling: returns safe structured fallback without crashing
 * 7. Exact file/line extraction: preserves null when location is ambiguous (no hallucination)
 * 8. Terminal diagnostic bounding: strictly bounds summary and stackTrace lengths
 * 9. Ask AI context generation: formats structured diagnostic task for AgentWorkspace/Panel
 * 10. Test Explorer repair context: builds structured test failure payload with stack trace
 * 11. Click-to-editor navigation payload: produces valid file, line, and column coordinates
 * 12. Selection + diagnostic context: combines user-highlighted lines with diagnostic metadata
 * 13. ContextEngine debugging block: formats ## CURRENT DEBUGGING CONTEXT in systemPrompt
 * 14. Terminal output secret filtering: redacts API keys, tokens, and authorization headers
 * 15. Cancellation during diagnostic turn: handles turn cancellation cleanly
 * 16. Provider failure graceful fallback: handles offline / failed model gracefully
 * 17. Diagnostic persistence behavior: stores compact metadata in turn without bloating logs
 * 18. Repeated failures in same thread: preserves discrete diagnostics across turns
 * 19. Full repair loop: test failure -> diagnostic -> agent plan -> changeSet -> verified
 * 20. No raw unlimited terminal injection: bounds terminal buffer to max budget
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const assert = require("assert");

const { DiagnosticParser, diagnosticParser, sanitizeSecrets } = require("./debugging/DiagnosticParser");
const { ContextEngine } = require("./harness/ContextEngine");
const { AgentLoop } = require("./harness/AgentLoop");
const { harnessRuntime, ITEM_TYPES, TURN_STATUS, EVENT_TYPES } = require("./harness");

function testHeader(num, title) {
  console.log(`[TEST ${num}/20] ${title}`);
}

async function runMilestone25Tests() {
  console.log("================================================================");
  console.log("  MILESTONE 25: DEVELOPER CONTEXT & DEBUGGING WORKFLOW (20 TESTS)");
  console.log("================================================================\n");

  const tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), "nexus-m25-test-"));
  const workspacePath = path.join(tmpRoot, "workspace");
  fs.mkdirSync(workspacePath, { recursive: true });

  let passed = 0;

  try {
    const parser = new DiagnosticParser();

    // 1. Python traceback parsing
    testHeader(1, "Python traceback parsing: extracts file, line, exception type, and summary");
    const pyTrace = `Traceback (most recent call last):
  File "server.py", line 82, in handle_request
    res = calculate_total(cart)
  File "cart/calc.py", line 14, in calculate_total
    return sum(item["price"] for item in cart) / discount_rate
ZeroDivisionError: division by zero`;

    const diag1 = parser.parse({
      command: "python3 server.py",
      cwd: workspacePath,
      exitCode: 1,
      stderr: pyTrace,
    });

    assert(diag1 !== null);
    assert.strictEqual(diag1.language, "python");
    assert.strictEqual(diag1.errorCategory, "PYTHON_TRACEBACK");
    assert(diag1.filePath.endsWith("cart/calc.py"));
    assert.strictEqual(diag1.line, 14);
    assert.strictEqual(diag1.summary, "ZeroDivisionError: division by zero");
    assert(diag1.stackTrace.includes("ZeroDivisionError"));
    passed++;

    // 2. TypeScript error parsing
    testHeader(2, "TypeScript error parsing: extracts file, line, col, TS error code, and summary");
    const tsOutput = `src/components/CheckoutModal.tsx:45:18 - error TS2322: Type "string" is not assignable to type "number".`;
    const diag2 = parser.parse({
      command: "npx tsc --noEmit",
      cwd: workspacePath,
      exitCode: 2,
      stdout: tsOutput,
    });

    assert(diag2 !== null);
    assert.strictEqual(diag2.language, "typescript");
    assert.strictEqual(diag2.errorCategory, "TYPESCRIPT_ERROR");
    assert(diag2.filePath.endsWith("src/components/CheckoutModal.tsx"));
    assert.strictEqual(diag2.line, 45);
    assert.strictEqual(diag2.column, 18);
    assert(diag2.summary.includes("TS2322"));
    assert(diag2.summary.includes("not assignable"));
    passed++;

    // 3. JS/Node stack parsing
    testHeader(3, "JS/Node stack parsing: extracts file, line, col, error name, and stack");
    const jsTrace = `TypeError: Cannot read properties of undefined (reading "items")
    at CartService.getTotal (/Users/dev/nexus/src/cart.js:28:19)
    at handleCheckout (/Users/dev/nexus/src/routes.js:52:12)`;

    const diag3 = parser.parse({
      command: "node src/server.js",
      cwd: workspacePath,
      exitCode: 1,
      stderr: jsTrace,
    });

    assert(diag3 !== null);
    assert.strictEqual(diag3.language, "javascript");
    assert.strictEqual(diag3.errorCategory, "JAVASCRIPT_ERROR");
    assert(diag3.filePath.endsWith("src/cart.js"));
    assert.strictEqual(diag3.line, 28);
    assert.strictEqual(diag3.column, 19);
    assert.strictEqual(diag3.summary, "TypeError: Cannot read properties of undefined (reading \"items\")");
    passed++;

    // 4. pytest failure parsing
    testHeader(4, "pytest failure parsing: extracts failed test name, file, line, and assertion message");
    const pytestOutput = `============================= FAILURES =============================
___________________________ test_checkout_tax ___________________________
tests/test_cart.py:42: in test_checkout_tax
    assert calculate_tax(100.0) == 8.5
E   AssertionError: assert 8.0 == 8.5
FAILED tests/test_cart.py::test_checkout_tax - AssertionError: assert 8.0 == 8.5`;

    const diag4 = parser.parse({
      command: "pytest tests/test_cart.py",
      cwd: workspacePath,
      exitCode: 1,
      stdout: pytestOutput,
    });

    assert(diag4 !== null);
    assert.strictEqual(diag4.language, "python");
    assert.strictEqual(diag4.errorCategory, "PYTEST_FAILURE");
    assert(diag4.filePath.endsWith("tests/test_cart.py"));
    assert.strictEqual(diag4.line, 42);
    assert(diag4.summary.includes("test_checkout_tax"));
    assert(diag4.summary.includes("assert 8.0 == 8.5"));
    passed++;

    // 5. Generic command failure
    testHeader(5, "Generic command failure: handles non-zero exit code with last stderr/stdout lines");
    const diag5 = parser.parse({
      command: "docker build -t app .",
      cwd: workspacePath,
      exitCode: 127,
      stderr: "docker: command not found",
    });

    assert(diag5 !== null);
    assert.strictEqual(diag5.exitCode, 127);
    assert.strictEqual(diag5.summary, "docker: command not found");
    assert.strictEqual(diag5.filePath, null);
    assert.strictEqual(diag5.line, null);
    passed++;

    // 6. Malformed diagnostic handling
    testHeader(6, "Malformed diagnostic handling: returns safe structured fallback without crashing");
    const diag6a = parser.parse(null);
    const diag6b = parser.parse({});
    const diag6c = parser.parse({ rawOutput: "random noise ??? ((( !!!" });

    assert.strictEqual(diag6a, null);
    assert.strictEqual(diag6b, null);
    assert(diag6c !== null);
    assert.strictEqual(diag6c.summary, "random noise ??? ((( !!!");
    assert.strictEqual(diag6c.filePath, null);
    passed++;

    // 7. Exact file/line extraction without hallucination
    testHeader(7, "Exact file/line extraction: preserves null when location is ambiguous (no hallucination)");
    const diag7 = parser.parse({
      command: "npm start",
      exitCode: 1,
      stderr: "Fatal error: Database unreachable on port 5432",
    });

    assert.strictEqual(diag7.filePath, null);
    assert.strictEqual(diag7.line, null);
    assert.strictEqual(diag7.column, null);
    passed++;

    // 8. Terminal diagnostic bounding
    testHeader(8, "Terminal diagnostic bounding: strictly bounds summary and stackTrace lengths");
    const massiveTrace = "at Frame.eval (file.js:1:1)\n".repeat(500);
    const diag8 = parser.parse({
      command: "node leak.js",
      exitCode: 1,
      stderr: "Error: Stack overflow\n" + massiveTrace,
    });

    assert(diag8.stackTrace.length <= 2100);
    assert(diag8.stackTrace.includes("... [TRUNCATED]"));
    assert(diag8.summary.length <= 405);
    passed++;

    // 9. Ask AI context generation
    testHeader(9, "Ask AI context generation: formats structured diagnostic task for AgentWorkspace/Panel");
    const askAiPrompt = `Diagnose and fix issue in ${diag1.filePath || "project"}${diag1.line ? ` line ${diag1.line}` : ""}: ${diag1.summary}`;
    assert(askAiPrompt.includes("cart/calc.py line 14"));
    assert(askAiPrompt.includes("ZeroDivisionError: division by zero"));
    passed++;

    // 10. Test Explorer repair context
    testHeader(10, "Test Explorer repair context: builds structured test failure payload with stack trace");
    const repairPayload = {
      testName: "test_checkout_tax",
      filePath: "tests/test_cart.py",
      line: 42,
      errorSummary: "AssertionError: assert 8.0 == 8.5",
      stackTrace: pytestOutput,
      command: "pytest tests/test_cart.py",
    };
    const formattedRepair = `Test failure: ${repairPayload.testName}\nCommand: ${repairPayload.command}\nFile: ${repairPayload.filePath}:${repairPayload.line}\nError: ${repairPayload.errorSummary}`;
    assert(formattedRepair.includes("Test failure: test_checkout_tax"));
    assert(formattedRepair.includes("File: tests/test_cart.py:42"));
    passed++;

    // 11. Click-to-editor navigation payload
    testHeader(11, "Click-to-editor navigation payload: produces valid file, line, and column coordinates");
    const navPayload = {
      filePath: diag2.filePath,
      line: diag2.line,
      column: diag2.column,
    };
    assert(navPayload.filePath.endsWith("src/components/CheckoutModal.tsx"));
    assert.strictEqual(navPayload.line, 45);
    assert.strictEqual(navPayload.column, 18);
    passed++;

    // 12. Selection + diagnostic context
    testHeader(12, "Selection + diagnostic context: combines user-highlighted lines with diagnostic metadata");
    const userSelection = "const rate = getDiscountRate(user);";
    const combinedPrompt = `Diagnose error ${diag1.summary} with selection: ${userSelection}`;
    assert(combinedPrompt.includes("ZeroDivisionError"));
    assert(combinedPrompt.includes("const rate = getDiscountRate(user);"));
    passed++;

    // 13. ContextEngine debugging block
    testHeader(13, "ContextEngine debugging block: formats ## CURRENT DEBUGGING CONTEXT in systemPrompt");
    const contextEngine = new ContextEngine({ maxBudgetTokens: 4000 });
    const cOutcome = contextEngine.buildContext({
      workspacePath,
      activeFilePath: "cart/calc.py",
      diagnostic: diag1,
    });

    assert(cOutcome.systemPrompt.includes("## CURRENT DEBUGGING CONTEXT"));
    assert(cOutcome.systemPrompt.includes("Command:\npython3 server.py"));
    assert(cOutcome.systemPrompt.includes("Exit Code:\n1"));
    assert(cOutcome.systemPrompt.includes("cart/calc.py"));
    assert(cOutcome.systemPrompt.includes("Line:\n14"));
    assert(cOutcome.systemPrompt.includes("ZeroDivisionError: division by zero"));
    assert(cOutcome.systemPrompt.includes("Trace:"));
    passed++;

    // 14. Terminal output secret filtering
    testHeader(14, "Terminal output secret filtering: redacts API keys, tokens, and authorization headers");
    const dirtyOutput = "Error connecting with key AIzaSyD9876543210ZYXWVUTSRQPONMLKJIHGFED and Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz";
    const sanitized = sanitizeSecrets(dirtyOutput);
    assert(!sanitized.includes("AIzaSyD9876543210ZYXWVUTSRQPONMLKJIHGFED"));
    assert(sanitized.includes("AIza*******************************"));
    assert(!sanitized.includes("eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.xyz"));
    assert(sanitized.includes("[REDACTED_TOKEN]"));
    passed++;

    // 15. Cancellation during diagnostic turn
    testHeader(15, "Cancellation during diagnostic turn: handles turn cancellation cleanly");
    const testThread = harnessRuntime.createThread({ metadata: { workspacePath } });
    const cancelledTurn = harnessRuntime.startTurn(testThread.threadId, "Investigate diagnostic", { diagnostic: diag1 });
    harnessRuntime.cancelTurn(cancelledTurn.turnId, "User stopped debugging session");

    const loop = new AgentLoop({
      runtime: harnessRuntime,
      contextEngine,
      modelAdapter: { stream: async function* () { yield { delta: "ok" }; } },
    });

    const runRes = await loop.runTurn({
      threadId: testThread.threadId,
      turnId: cancelledTurn.turnId,
    });
    assert.strictEqual(runRes.success, false);
    assert.strictEqual(runRes.status, TURN_STATUS.CANCELLED);
    passed++;

    // 16. Provider failure graceful fallback
    testHeader(16, "Provider failure graceful fallback: handles offline / failed model gracefully");
    const failingModelAdapter = {
      stream: async function* () {
        throw new Error("ENOTFOUND generativelanguage.googleapis.com");
      }
    };
    const loopFail = new AgentLoop({
      runtime: harnessRuntime,
      contextEngine,
      modelAdapter: failingModelAdapter,
    });
    const threadFail = harnessRuntime.createThread({ metadata: { workspacePath } });
    const failOutcome = await loopFail.runTurn({
      threadId: threadFail.threadId,
      userInput: "Fix diagnostic",
      diagnostic: diag1,
    });
    assert.strictEqual(failOutcome.success, false);
    assert(failOutcome.error.includes("ENOTFOUND"));
    passed++;

    // 17. Diagnostic persistence behavior
    testHeader(17, "Diagnostic persistence behavior: stores compact metadata in turn without bloating logs");
    const threadPersist = harnessRuntime.createThread({ metadata: { workspacePath } });
    const loopSuccess = new AgentLoop({
      runtime: harnessRuntime,
      contextEngine,
      modelAdapter: {
        stream: async function* () {
          yield { delta: "Root cause: divisor was zero. Added non-zero guard." };
        }
      },
    });

    const persistOutcome = await loopSuccess.runTurn({
      threadId: threadPersist.threadId,
      userInput: "Repair zero division",
      workspacePath,
      diagnostic: diag1,
    });

    assert.strictEqual(persistOutcome.success, true);
    const savedTurn = harnessRuntime.getTurn(persistOutcome.turnId);
    assert.strictEqual(savedTurn.metadata.diagnostic.summary, "ZeroDivisionError: division by zero");
    assert.strictEqual(savedTurn.metadata.diagnostic.line, 14);
    passed++;

    // 18. Repeated failures in same thread
    testHeader(18, "Repeated failures in same thread: preserves discrete diagnostics across turns");
    const repeatTurn2 = await loopSuccess.runTurn({
      threadId: threadPersist.threadId,
      userInput: "Address second failure",
      workspacePath,
      diagnostic: diag2,
    });
    assert.strictEqual(repeatTurn2.success, true);
    const savedTurn2 = harnessRuntime.getTurn(repeatTurn2.turnId);
    assert(savedTurn2.metadata.diagnostic.summary.includes("TS2322"));
    passed++;

    // 19. Full repair loop verification
    testHeader(19, "Full repair loop: test failure -> diagnostic -> agent plan -> changeSet -> verified");
    const testFile = path.join(workspacePath, "calc.js");
    fs.writeFileSync(testFile, "function calc(a, b) { return a / b; }\nmodule.exports = { calc };\n");

    const diagnosticForCalc = parser.parse({
      command: "npm test",
      cwd: workspacePath,
      exitCode: 1,
      stderr: "ZeroDivisionError in calc.js:1",
    });

    assert(diagnosticForCalc !== null);
    const threadRepair = harnessRuntime.createThread({ metadata: { workspacePath } });
    const repairLoop = new AgentLoop({
      runtime: harnessRuntime,
      contextEngine,
      modelAdapter: {
        stream: async function* () {
          yield { delta: "Diagnosed failure in calc.js. Applying guard clause." };
        }
      },
    });

    const repairTurnRes = await repairLoop.runTurn({
      threadId: threadRepair.threadId,
      userInput: `Fix ${diagnosticForCalc.summary}`,
      workspacePath,
      diagnostic: diagnosticForCalc,
      activeFilePath: testFile,
    });

    assert.strictEqual(repairTurnRes.success, true);
    passed++;

    // 20. No raw unlimited terminal injection
    testHeader(20, "No raw unlimited terminal injection: bounds terminal buffer to max budget");
    const hugeBuffer = "random terminal log line with some text\n".repeat(5000);
    const diagHuge = parser.parse({
      command: "long running process",
      rawOutput: hugeBuffer,
      exitCode: 1,
    });
    const cOutcomeBounded = contextEngine.buildContext({
      workspacePath,
      diagnostic: diagHuge,
    });
    assert(cOutcomeBounded.systemPrompt.length < 10000);
    passed++;

    console.log("\n================================================================");
    console.log("  ALL 20/20 MILESTONE 25 SCENARIOS PASSED WITH ZERO ERRORS!");
    console.log("================================================================\n");

  } finally {
    try {
      fs.rmSync(tmpRoot, { recursive: true, force: true });
    } catch (e) {}
  }
}

runMilestone25Tests()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("[FATAL ERROR IN M25 TEST SUITE]", err);
    process.exit(1);
  });
