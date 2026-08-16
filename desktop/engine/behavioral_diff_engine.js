/**
 * Behavioral Diff / Impact Review Engine
 * Compares baseline BDG graph snapshots against current graph state and Git modifications.
 * Differentiates Textual Changes (formatting/comments) from Structural & Behavioral Impact.
 */

const bdgEngine = require('./bdg_engine');
const runtimeExecutionIndex = require('./runtime_execution_index');

class BehavioralDiffEngine {
  constructor() {
    this.baselineGraph = null;
  }

  /**
   * Sets the baseline graph snapshot.
   */
  setBaselineGraph(graphData) {
    this.baselineGraph = JSON.parse(JSON.stringify(graphData || bdgEngine.getGraphData()));
  }

  /**
   * Computes Behavioral Impact Review comparing baseline vs current graph.
   */
  computeBehavioralDiff(previousGraph, currentGraph, gitStatus = { modifiedFiles: [], stagedFiles: [] }) {
    const prev = previousGraph || this.baselineGraph || { nodes: {}, edges: [] };
    const curr = currentGraph || bdgEngine.getGraphData();

    const prevNodes = prev.nodes || {};
    const currNodes = curr.nodes || {};
    const prevEdges = prev.edges || [];
    const currEdges = curr.edges || [];

    const structuralChanges = [];

    // 1. Identify Added Nodes
    for (const [id, node] of Object.entries(currNodes)) {
      if (!prevNodes[id]) {
        let type = "node_added";
        if (node.type === "database-op") type = "db_op_changed";
        if (node.type === "external-api") type = "external_api_changed";
        structuralChanges.push({
          type,
          node,
          detail: `Added ${node.type} '${node.symbol}' in ${node.file} (L${node.location.line})`
        });
      }
    }

    // 2. Identify Removed Nodes
    for (const [id, node] of Object.entries(prevNodes)) {
      if (!currNodes[id]) {
        let type = "node_removed";
        if (node.type === "database-op") type = "db_op_changed";
        if (node.type === "external-api") type = "external_api_changed";
        structuralChanges.push({
          type,
          node,
          detail: `Removed ${node.type} '${node.symbol}' from ${node.file}`
        });
      }
    }

    // 3. Identify Changed Call & Dependency Edges
    const prevEdgeMap = new Map(prevEdges.map((e) => [e.id, e]));
    const currEdgeMap = new Map(currEdges.map((e) => [e.id, e]));

    for (const [id, edge] of currEdgeMap.entries()) {
      if (!prevEdgeMap.has(id)) {
        const sourceNode = currNodes[edge.source];
        if (sourceNode) {
          let type = "dependency_changed";
          if (edge.relationship === "calls" || edge.relationship === "invokes") type = "call_changed";
          if (["database-read", "database-write"].includes(edge.relationship)) type = "db_op_changed";
          if (edge.relationship === "external-call") type = "external_api_changed";

          structuralChanges.push({
            type,
            node: sourceNode,
            detail: `Added relationship '${edge.relationship}' from ${sourceNode.symbol} to ${edge.target}`
          });
        }
      }
    }

    for (const [id, edge] of prevEdgeMap.entries()) {
      if (!currEdgeMap.has(id)) {
        const sourceNode = prevNodes[edge.source] || currNodes[edge.source];
        if (sourceNode) {
          let type = "dependency_changed";
          if (edge.relationship === "calls" || edge.relationship === "invokes") type = "call_changed";

          structuralChanges.push({
            type,
            node: sourceNode,
            detail: `Removed relationship '${edge.relationship}' from ${sourceNode.symbol} to ${edge.target}`
          });
        }
      }
    }

    // 4. Textual vs Structural Classifier
    const hasModifiedFiles = gitStatus.modifiedFiles.length > 0 || gitStatus.stagedFiles.length > 0;
    const textualChangeOnly = hasModifiedFiles && structuralChanges.length === 0;
    const hasBehavioralChange = structuralChanges.length > 0;

    if (textualChangeOnly) {
      return {
        gitStatus,
        hasBehavioralChange: false,
        textualChangeOnly: true,
        structuralChanges: [],
        impactedFunctions: [],
        impactedFiles: gitStatus.modifiedFiles,
        impactedTests: [],
        impactedDbOps: [],
        impactedExternalApis: [],
        runtimeEvidenceSummary: { totalObservedExecutions: 0, observedCallers: [], errorsInvolved: 0 },
        whatIfPredictions: [],
        riskLevel: "LOW"
      };
    }

    // 5. Aggregate Behavioral Impact
    const impactedFunctionMap = new Map();
    const impactedFileSet = new Set(gitStatus.modifiedFiles);
    const impactedTestSet = new Map();
    const impactedDbSet = new Map();
    const impactedExternalSet = new Map();
    let totalObservedExecutions = 0;
    let errorsInvolved = 0;
    const observedCallerSet = new Set();
    const whatIfPredictions = [];

    for (const change of structuralChanges) {
      impactedFileSet.add(change.node.file);

      // Run Blast Radius to evaluate behavioral fallout
      const blast = bdgEngine.calculateBlastRadiusBySymbol(change.node.symbol, change.node.file, change.node.location.line);
      for (const fn of blast.affectedFunctions) {
        impactedFunctionMap.set(fn.id, fn);
      }
      for (const t of blast.coveringTests) {
        impactedTestSet.set(t.id, t);
      }
      for (const ext of blast.externalEffects) {
        if (ext.type === "database-op") impactedDbSet.set(ext.id, ext);
        if (ext.type === "external-api") impactedExternalSet.set(ext.id, ext);
      }

      // Overlay runtime telemetry
      const tel = runtimeExecutionIndex.getTelemetryForNode(change.node.id);
      if (tel.observed) {
        totalObservedExecutions += tel.executionCount;
        errorsInvolved += tel.errorCount;
        (tel.observedCallers || []).forEach((c) => observedCallerSet.add(c));
      }

      // What-If integration for removed nodes
      if (change.type === "node_removed") {
        const whatif = bdgEngine.simulateWhatIf({ targetNodeId: change.node.id, operation: "remove-node" });
        whatIfPredictions.push(whatif);
      }
    }

    const impactedFunctions = Array.from(impactedFunctionMap.values());
    const impactedFiles = Array.from(impactedFileSet);
    const impactedTests = Array.from(impactedTestSet.values());
    const impactedDbOps = Array.from(impactedDbSet.values());
    const impactedExternalApis = Array.from(impactedExternalSet.values());

    // 6. Risk Level Calculation
    let riskLevel = "LOW";
    if ((impactedDbOps.length > 0 || impactedExternalApis.length > 0) && impactedFiles.length > 2) {
      riskLevel = "CRITICAL";
    } else if (impactedFiles.length > 2 || impactedFunctions.length > 4) {
      riskLevel = "HIGH";
    } else if (impactedFiles.length > 1 || impactedFunctions.length > 1) {
      riskLevel = "MEDIUM";
    }

    return {
      gitStatus,
      hasBehavioralChange,
      textualChangeOnly: false,
      structuralChanges,
      impactedFunctions,
      impactedFiles,
      impactedTests,
      impactedDbOps,
      impactedExternalApis,
      runtimeEvidenceSummary: {
        totalObservedExecutions,
        observedCallers: Array.from(observedCallerSet),
        errorsInvolved
      },
      whatIfPredictions,
      riskLevel
    };
  }
}

const behavioralDiffEngineInstance = new BehavioralDiffEngine();
module.exports = behavioralDiffEngineInstance;
