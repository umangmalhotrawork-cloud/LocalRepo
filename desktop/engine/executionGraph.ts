import { DebugStep } from "../runtime/pythonTimeTravelDebugger";

export type ExecutionNode = {
  id: string;
  label: string;
  type: 'function' | 'line' | 'variable' | 'exception';
  step: number;
  details?: Record<string, any>;
};

export type ExecutionEdge = {
  from: string;
  to: string;
  label?: string;
};

export type ExecutionGraph = {
  nodes: ExecutionNode[];
  edges: ExecutionEdge[];
};

export type VariableHistoryEntry = {
  step: number;
  line: number;
  value: any;
  changed: boolean;
};

export type VariableTimeline = {
  name: string;
  history: VariableHistoryEntry[];
};

export function buildExecutionGraph(steps: DebugStep[]): ExecutionGraph {
  if (!steps || steps.length === 0) {
    return { nodes: [], edges: [] };
  }

  const nodes: ExecutionNode[] = [];
  const edges: ExecutionEdge[] = [];
  const nodeSet = new Set<string>();

  const addNode = (node: ExecutionNode) => {
    if (!nodeSet.has(node.id)) {
      nodeSet.add(node.id);
      nodes.push(node);
    }
  };

  let prevNodeId: string | null = null;
  const functionCallStack: string[] = [];
  const lastVarValueMap = new Map<string, string>();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const stepNum = step.step || (i + 1);

    // 1. Function Node
    if (step.functionName) {
      const funcNodeId = `func_${step.functionName}_step_${stepNum}`;
      addNode({
        id: funcNodeId,
        label: `fn ${step.functionName}()`,
        type: 'function',
        step: i,
        details: { functionName: step.functionName, line: step.line },
      });

      if (step.event === 'call') {
        if (functionCallStack.length > 0) {
          edges.push({
            from: functionCallStack[functionCallStack.length - 1],
            to: funcNodeId,
            label: 'calls',
          });
        }
        functionCallStack.push(funcNodeId);
      } else if (step.event === 'return') {
        if (functionCallStack.length > 0) {
          const calledFunc = functionCallStack.pop();
          if (calledFunc && calledFunc !== funcNodeId) {
            edges.push({
              from: funcNodeId,
              to: calledFunc,
              label: 'returns',
            });
          }
        }
      }
    }

    // 2. Line Node
    const lineNodeId = `line_${step.line}_step_${stepNum}`;
    const lineLabel = `L${step.line}${step.functionName ? ` [${step.functionName}]` : ''}`;

    addNode({
      id: lineNodeId,
      label: lineLabel,
      type: 'line',
      step: i,
      details: { line: step.line, functionName: step.functionName },
    });

    // Execution sequence edge
    if (prevNodeId && prevNodeId !== lineNodeId) {
      edges.push({
        from: prevNodeId,
        to: lineNodeId,
        label: 'next',
      });
    }
    prevNodeId = lineNodeId;

    // 3. Variable Nodes for Local/Global assignments
    const allVars = { ...step.globals, ...step.locals };
    for (const [varName, varVal] of Object.entries(allVars)) {
      const valStr = JSON.stringify(varVal);
      const prevValStr = lastVarValueMap.get(varName);

      if (prevValStr !== valStr) {
        lastVarValueMap.set(varName, valStr);
        const varNodeId = `var_${varName}_step_${stepNum}`;

        addNode({
          id: varNodeId,
          label: `${varName} = ${typeof varVal === 'object' && varVal !== null ? JSON.stringify(varVal).slice(0, 15) : varVal}`,
          type: 'variable',
          step: i,
          details: { name: varName, value: varVal, line: step.line },
        });

        // Edge from Line -> Variable Mutation
        edges.push({
          from: lineNodeId,
          to: varNodeId,
          label: 'mutates',
        });
      }
    }

    // 4. Exception Node
    if (step.event === 'exception' || (step.stderr && step.stderr.includes('Error'))) {
      const excNodeId = `exc_step_${stepNum}`;
      addNode({
        id: excNodeId,
        label: `Exception @ L${step.line}`,
        type: 'exception',
        step: i,
        details: { line: step.line, stderr: step.stderr },
      });

      edges.push({
        from: lineNodeId,
        to: excNodeId,
        label: 'throws',
      });
    }
  }

  return { nodes, edges };
}

export function extractVariableTimelines(steps: DebugStep[]): VariableTimeline[] {
  if (!steps || steps.length === 0) return [];

  const varMap = new Map<string, VariableHistoryEntry[]>();

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const allVars = { ...step.globals, ...step.locals };

    for (const [varName, varVal] of Object.entries(allVars)) {
      if (!varMap.has(varName)) {
        varMap.set(varName, []);
      }
      const history = varMap.get(varName)!;
      const prevEntry = history.length > 0 ? history[history.length - 1] : null;
      const isChanged = !prevEntry || JSON.stringify(prevEntry.value) !== JSON.stringify(varVal);

      history.push({
        step: i,
        line: step.line,
        value: varVal,
        changed: isChanged,
      });
    }
  }

  return Array.from(varMap.entries()).map(([name, history]) => ({
    name,
    history,
  }));
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildExecutionGraph,
    extractVariableTimelines,
  };
}
