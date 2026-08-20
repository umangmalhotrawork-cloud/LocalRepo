/**
 * Echo Nullity — Execution Graph & Memory Flow Test Suite
 * Validates step-by-step DAG node generation, function call hierarchy,
 * variable mutation tracking, exception nodes, and memory flow timelines.
 */

const assert = require("assert");

console.log("[TEST] Starting Execution Graph & Memory Flow Test Suite...");

function buildExecutionGraph(steps) {
  if (!steps || steps.length === 0) {
    return { nodes: [], edges: [] };
  }

  const nodes = [];
  const edges = [];
  const nodeSet = new Set();

  const addNode = (node) => {
    if (!nodeSet.has(node.id)) {
      nodeSet.add(node.id);
      nodes.push(node);
    }
  };

  let prevNodeId = null;
  const functionCallStack = [];
  const lastVarValueMap = new Map();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepNum = step.step || (i + 1);

    // 1. Function Node
    if (step.functionName) {
      const funcNodeId = `func_${step.functionName}_step_${stepNum}`;
      addNode({
        id: funcNodeId,
        label: `def ${step.functionName}()`,
        type: "function",
        step: stepNum,
        details: { line: step.line, event: step.event },
      });

      if (step.event === "call") {
        functionCallStack.push(funcNodeId);
      } else if (step.event === "return") {
        functionCallStack.pop();
      }

      if (prevNodeId) {
        edges.push({ from: prevNodeId, to: funcNodeId, label: step.event });
      }
      prevNodeId = funcNodeId;
    }

    // 2. Line Execution Node
    const lineNodeId = `line_${step.line}_step_${stepNum}`;
    addNode({
      id: lineNodeId,
      label: `Line ${step.line}`,
      type: "line",
      step: stepNum,
      details: {
        event: step.event,
        stdout: step.stdout,
        stderr: step.stderr,
      },
    });

    if (prevNodeId && prevNodeId !== lineNodeId) {
      edges.push({ from: prevNodeId, to: lineNodeId, label: "next" });
    }
    prevNodeId = lineNodeId;

    // 3. Variable Mutation Nodes
    const allVars = { ...(step.globals || {}), ...(step.locals || {}) };
    for (const [varName, varVal] of Object.entries(allVars)) {
      const valStr = JSON.stringify(varVal);
      const prevValStr = lastVarValueMap.get(varName);

      if (prevValStr !== valStr) {
        const varNodeId = `var_${varName}_${stepNum}`;
        addNode({
          id: varNodeId,
          label: `${varName} = ${valStr}`,
          type: "variable",
          step: stepNum,
          details: { name: varName, value: varVal },
        });

        edges.push({ from: lineNodeId, to: varNodeId, label: "mutates" });
        lastVarValueMap.set(varName, valStr);
      }
    }

    // 4. Exception Node
    if (step.event === "exception" || (step.stderr && step.stderr.includes("Error:"))) {
      const excNodeId = `exc_step_${stepNum}`;
      addNode({
        id: excNodeId,
        label: `Exception: ${step.stderr || "Error"}`,
        type: "exception",
        step: stepNum,
        details: { error: step.stderr },
      });

      edges.push({ from: lineNodeId, to: excNodeId, label: "raises" });
      prevNodeId = excNodeId;
    }
  }

  return { nodes, edges };
}

function extractVariableTimelines(steps) {
  if (!steps || steps.length === 0) return [];

  const timelineMap = new Map();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepNum = step.step || (i + 1);
    const allVars = { ...(step.globals || {}), ...(step.locals || {}) };

    for (const [varName, varVal] of Object.entries(allVars)) {
      if (!timelineMap.has(varName)) {
        timelineMap.set(varName, { name: varName, history: [] });
      }

      const entryList = timelineMap.get(varName).history;
      const prevEntry = entryList.length > 0 ? entryList[entryList.length - 1] : null;
      const changed = !prevEntry || JSON.stringify(prevEntry.value) !== JSON.stringify(varVal);

      entryList.push({
        step: stepNum,
        line: step.line,
        value: varVal,
        changed,
      });
    }
  }

  return Array.from(timelineMap.values());
}

function runTests() {
  const mockSteps = [
    { step: 1, line: 1, locals: { a: 10 }, globals: {}, stdout: "", stderr: "", event: "line" },
    { step: 2, line: 2, locals: { a: 10, b: 20 }, globals: {}, stdout: "", stderr: "", event: "line" },
    { step: 3, line: 5, locals: { x: 5 }, globals: { a: 10, b: 20 }, stdout: "", stderr: "", event: "call", functionName: "factorial" },
    { step: 4, line: 6, locals: { x: 5, res: 120 }, globals: { a: 10, b: 20 }, stdout: "Calculated 120\n", stderr: "", event: "return", functionName: "factorial" },
    { step: 5, line: 10, locals: { a: 10, b: 20 }, globals: {}, stdout: "", stderr: "ZeroDivisionError: division by zero", event: "exception" },
  ];

  // 1. Build Graph
  const graph = buildExecutionGraph(mockSteps);
  assert(graph.nodes.length > 0 && graph.edges.length > 0, "Test 1: Graph build failed");
  console.log("[PASS] Test 1: Build Graph");

  // 2. Verify Function Nodes
  const funcNodes = graph.nodes.filter((n) => n.type === "function");
  assert.strictEqual(funcNodes.length, 2, "Expected 2 function nodes");
  console.log("[PASS] Test 2: Function Nodes");

  // 3. Verify Line Nodes
  const lineNodes = graph.nodes.filter((n) => n.type === "line");
  assert.strictEqual(lineNodes.length, 5, "Expected 5 line nodes");
  console.log("[PASS] Test 3: Line Nodes");

  // 4. Verify Variable Nodes
  const varNodes = graph.nodes.filter((n) => n.type === "variable");
  assert(varNodes.length >= 3, "Expected at least 3 variable mutation nodes");
  console.log("[PASS] Test 4: Variable Mutation Nodes");

  // 5. Verify Exception Nodes
  const excNodes = graph.nodes.filter((n) => n.type === "exception");
  assert.strictEqual(excNodes.length, 1, "Expected 1 exception node");
  console.log("[PASS] Test 5: Exception Nodes");

  // 6. Verify Memory Flow Timelines
  const timelines = extractVariableTimelines(mockSteps);
  const aTimeline = timelines.find((t) => t.name === "a");
  assert(aTimeline && aTimeline.history.length > 0, "Expected timeline for variable a");
  console.log("[PASS] Test 6: Memory Flow Timelines");

  // 7. Determinism Test
  const graph2 = buildExecutionGraph(mockSteps);
  assert.strictEqual(JSON.stringify(graph), JSON.stringify(graph2), "Execution graph generation must be deterministic");
  console.log("[PASS] Test 7: Deterministic Output");

  console.log(">>> ALL 7 EXECUTION GRAPH & MEMORY FLOW TESTS PASSED! <<<");
}

try {
  runTests();
} catch (err) {
  console.error("[TEST ERROR]", err);
  process.exit(1);
}
