import { buildExecutionGraph, extractVariableTimelines } from "./executionGraph";
import { DebugStep } from "../runtime/pythonTimeTravelDebugger";

export function runExecutionGraphTests() {
  console.log("[TEST] Starting Execution Graph & Memory Flow Test Suite...");

  // Mock Debug Steps
  const mockSteps: DebugStep[] = [
    {
      step: 1,
      line: 1,
      locals: { a: 10 },
      globals: {},
      stdout: "",
      stderr: "",
      event: "line",
    },
    {
      step: 2,
      line: 2,
      locals: { a: 10, b: 20 },
      globals: {},
      stdout: "",
      stderr: "",
      event: "line",
    },
    {
      step: 3,
      line: 5,
      locals: { x: 5 },
      globals: { a: 10, b: 20 },
      stdout: "",
      stderr: "",
      event: "call",
      functionName: "factorial",
    },
    {
      step: 4,
      line: 6,
      locals: { x: 5, res: 120 },
      globals: { a: 10, b: 20 },
      stdout: "Calculated 120\n",
      stderr: "",
      event: "return",
      functionName: "factorial",
    },
    {
      step: 5,
      line: 10,
      locals: { a: 10, b: 20 },
      globals: {},
      stdout: "",
      stderr: "ZeroDivisionError: division by zero",
      event: "exception",
    },
  ];

  // 1. Build Graph
  const graph = buildExecutionGraph(mockSteps);
  console.log(`[TEST 1] Nodes count=${graph.nodes.length}, Edges count=${graph.edges.length}`);

  // 2. Verify Function Nodes
  const funcNodes = graph.nodes.filter((n) => n.type === "function");
  console.log(`[TEST 2] Function nodes: ${funcNodes.length}`);
  if (funcNodes.length !== 2) throw new Error("Expected 2 function nodes");

  // 3. Verify Line Nodes
  const lineNodes = graph.nodes.filter((n) => n.type === "line");
  console.log(`[TEST 3] Line nodes: ${lineNodes.length}`);
  if (lineNodes.length !== 5) throw new Error("Expected 5 line nodes");

  // 4. Verify Variable Nodes
  const varNodes = graph.nodes.filter((n) => n.type === "variable");
  console.log(`[TEST 4] Variable mutation nodes: ${varNodes.length}`);
  if (varNodes.length < 3) throw new Error("Expected at least 3 variable mutation nodes");

  // 5. Verify Exception Nodes
  const excNodes = graph.nodes.filter((n) => n.type === "exception");
  console.log(`[TEST 5] Exception nodes: ${excNodes.length}`);
  if (excNodes.length !== 1) throw new Error("Expected 1 exception node");

  // 6. Verify Memory Flow Timelines
  const timelines = extractVariableTimelines(mockSteps);
  console.log(`[TEST 6] Variable timelines count: ${timelines.length}`);
  const aTimeline = timelines.find((t) => t.name === "a");
  if (!aTimeline || aTimeline.history.length === 0) {
    throw new Error("Expected timeline for variable 'a'");
  }

  // 7. Determinism Test
  const graph2 = buildExecutionGraph(mockSteps);
  if (JSON.stringify(graph) !== JSON.stringify(graph2)) {
    throw new Error("Execution graph generation must be deterministic");
  }
  console.log("[TEST 7] Deterministic output verified");

  console.log(">>> ALL 7 EXECUTION GRAPH & MEMORY FLOW TESTS PASSED SUCCESSFULLY! <<<");
  return true;
}

if (typeof require !== "undefined" && require.main === module) {
  runExecutionGraphTests();
}
