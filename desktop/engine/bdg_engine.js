/**
 * Behavioral Dependency Graph (BDG) Engine Service
 * Constructs and maintains an in-memory normalized behavioral graph.
 * Supports debounced incremental single-file re-analysis and rich graph query APIs.
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const { extractJSBDG } = require('./bdg_js_extractor');

const EXCLUDE_DIRS = new Set([
  '.git',
  '__pycache__',
  'node_modules',
  '.next',
  'venv',
  '.venv',
  'dist',
  'build',
  '.idea',
  '.vscode',
]);

class BDGEngine {
  constructor() {
    this.nodes = {};
    this.edges = [];
    this.workspacePath = null;
    this.fileMap = new Map(); // relPath -> list of node IDs owned by file
    this.debounceTimers = new Map();
  }

  /**
   * Resets internal graph state.
   */
  clear() {
    this.nodes = {};
    this.edges = [];
    this.workspacePath = null;
    this.fileMap.clear();
  }

  /**
   * Scans a workspace directory and constructs the complete BDG.
   */
  buildGraphForWorkspace(workspacePath) {
    this.clear();
    this.workspacePath = workspacePath;
    if (!fs.existsSync(workspacePath)) return this.getGraphData();

    const filesToProcess = [];
    const scanDir = (dir) => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (EXCLUDE_DIRS.has(entry.name)) continue;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          scanDir(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (['.py', '.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
            filesToProcess.push(fullPath);
          }
        }
      }
    };

    scanDir(workspacePath);
    for (const fullPath of filesToProcess) {
      const relPath = path.relative(workspacePath, fullPath);
      this.analyzeFile(fullPath, relPath);
    }

    const graphData = this.getGraphData();
    try {
      const behavioralDiffEngine = require("./behavioral_diff_engine");
      behavioralDiffEngine.setBaselineGraph(graphData);
    } catch (e) {}

    return graphData;
  }

  /**
   * Analyzes a single file and integrates its nodes/edges into the graph.
   */
  analyzeFile(fullPath, relPath, content) {
    const ext = path.extname(fullPath).toLowerCase();
    let fileResult = { nodes: {}, edges: [] };

    if (ext === '.py') {
      try {
        const pythonScript = path.join(__dirname, 'bdg_python_extractor.py');
        let cmd = `python3 "${pythonScript}" "${fullPath}" --rel-path "${relPath}"`;
        const stdout = execSync(cmd, { encoding: 'utf-8', timeout: 5000 });
        fileResult = JSON.parse(stdout);
      } catch (err) {
        // Fallback file node if python execution fails
        const fileNodeId = `file::${relPath}`;
        fileResult.nodes[fileNodeId] = {
          id: fileNodeId,
          type: 'file',
          file: relPath,
          symbol: path.basename(relPath),
          location: { line: 1, col: 1 },
          language: 'python',
          metadata: { error: err.message },
        };
      }
    } else if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
      try {
        fileResult = extractJSBDG(fullPath, content, relPath);
      } catch (err) {
        const fileNodeId = `file::${relPath}`;
        fileResult.nodes[fileNodeId] = {
          id: fileNodeId,
          type: 'file',
          file: relPath,
          symbol: path.basename(relPath),
          location: { line: 1, col: 1 },
          language: 'javascript',
          metadata: { error: err.message },
        };
      }
    }

    // Merge nodes & edges into graph
    const nodeIdsForFile = [];
    if (fileResult.nodes) {
      for (const [nodeId, nodeData] of Object.entries(fileResult.nodes)) {
        this.nodes[nodeId] = nodeData;
        nodeIdsForFile.push(nodeId);
      }
    }
    this.fileMap.set(relPath, nodeIdsForFile);

    if (fileResult.edges) {
      for (const edge of fileResult.edges) {
        // Prevent duplicate edges
        if (!this.edges.some((e) => e.id === edge.id)) {
          this.edges.push(edge);
        }
      }
    }
  }

  /**
   * Performs an incremental update for a single file without rescanning the entire repository.
   */
  updateFile(fullPath, content) {
    const relPath = this.workspacePath ? path.relative(this.workspacePath, fullPath) : path.basename(fullPath);

    // 1. Remove previous nodes owned by this file
    const oldNodeIds = this.fileMap.get(relPath) || [];
    const oldNodeSet = new Set(oldNodeIds);
    for (const nodeId of oldNodeIds) {
      delete this.nodes[nodeId];
    }
    this.fileMap.delete(relPath);

    // 2. Remove previous edges associated with this file or its nodes
    this.edges = this.edges.filter(
      (edge) => !oldNodeSet.has(edge.source) && !oldNodeSet.has(edge.target)
    );

    // 3. Re-analyze file and re-insert updated nodes & edges
    this.analyzeFile(fullPath, relPath, content);
    return this.getGraphData();
  }

  /**
   * Debounced version of updateFile to prevent unnecessary work on rapid keystrokes.
   */
  updateFileDebounced(fullPath, content, delayMs = 300) {
    return new Promise((resolve) => {
      if (this.debounceTimers.has(fullPath)) {
        clearTimeout(this.debounceTimers.get(fullPath));
      }

      const timer = setTimeout(() => {
        this.debounceTimers.delete(fullPath);
        const updatedGraph = this.updateFile(fullPath, content);
        resolve(updatedGraph);
      }, delayMs);

      this.debounceTimers.set(fullPath, timer);
    });
  }

  /**
   * Returns current raw graph data.
   */
  getGraphData() {
    return {
      nodes: { ...this.nodes },
      edges: [...this.edges],
    };
  }

  /**
   * Returns nodes that call the target nodeId.
   */
  getCallers(nodeId) {
    const callerIds = this.edges
      .filter((e) => e.target === nodeId && ['calls', 'invokes', 'test-covers'].includes(e.relationship))
      .map((e) => e.source);
    return callerIds.map((id) => this.nodes[id]).filter(Boolean);
  }

  /**
   * Returns nodes that are called by source nodeId.
   */
  getCallees(nodeId) {
    const calleeIds = this.edges
      .filter((e) => e.source === nodeId && ['calls', 'invokes', 'test-covers'].includes(e.relationship))
      .map((e) => e.target);
    
    // Also resolve symbolic names if target matches symbol
    const targetNodes = [];
    for (const edge of this.edges.filter((e) => e.source === nodeId)) {
      if (this.nodes[edge.target]) {
        targetNodes.push(this.nodes[edge.target]);
      } else {
        // Find matching node by symbol
        const matched = Object.values(this.nodes).find(
          (n) => n.symbol === edge.target || n.id.endsWith(`::${edge.target}`)
        );
        if (matched) targetNodes.push(matched);
      }
    }
    return targetNodes;
  }

  /**
   * Returns direct dependencies (nodes targeted by outgoing edges).
   */
  getDirectDependencies(nodeId) {
    const targetIds = this.edges.filter((e) => e.source === nodeId).map((e) => e.target);
    return Array.from(new Set(targetIds)).map((id) => this.nodes[id]).filter(Boolean);
  }

  /**
   * Returns transitive dependencies up to maxDepth.
   */
  getTransitiveDependencies(nodeId, maxDepth = 3) {
    const visited = new Set();
    const queue = [{ id: nodeId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift();
      if (visited.has(id) || depth >= maxDepth) continue;
      if (id !== nodeId) visited.add(id);

      const targets = this.edges.filter((e) => e.source === id).map((e) => e.target);
      for (const t of targets) {
        if (!visited.has(t)) {
          queue.push({ id: t, depth: depth + 1 });
        }
      }
    }

    return Array.from(visited).map((id) => this.nodes[id]).filter(Boolean);
  }

  /**
   * Queries symbol dependencies for editor context (by symbol, file, or line).
   */
  querySymbolDependencies(symbol, relPath, line) {
    let targetNode = null;

    const isFileMatch = (nodeFile, targetPath) => {
      if (!targetPath) return true;
      if (nodeFile === targetPath) return true;
      if (nodeFile.endsWith(targetPath) || targetPath.endsWith(nodeFile)) return true;
      if (path.basename(nodeFile) === path.basename(targetPath)) return true;
      return false;
    };

    if (symbol) {
      targetNode = Object.values(this.nodes).find(
        (n) => n.symbol === symbol && isFileMatch(n.file, relPath)
      );
    }

    if (!targetNode && relPath && line) {
      targetNode = Object.values(this.nodes).find(
        (n) => isFileMatch(n.file, relPath) && n.location.line <= line && (n.location.endLine || n.location.line + 20) >= line
      );
    }

    if (!targetNode && symbol) {
      targetNode = Object.values(this.nodes).find(
        (n) => n.symbol === symbol || n.symbol.endsWith(`.${symbol}`) || n.id.endsWith(`::${symbol}`)
      );
    }

    if (!targetNode) {
      return {
        node: null,
        callers: [],
        callees: [],
        reads: [],
        writes: [],
        externalEffects: [],
        directDependencies: [],
        transitiveDependencies: [],
      };
    }

    const nodeId = targetNode.id;
    const callers = this.getCallers(nodeId);
    const callees = this.getCallees(nodeId);
    const directDeps = this.getDirectDependencies(nodeId);
    const transitiveDeps = this.getTransitiveDependencies(nodeId, 3);

    const reads = this.edges
      .filter((e) => e.source === nodeId && e.relationship === 'reads')
      .map((e) => this.nodes[e.target])
      .filter(Boolean);

    const writes = this.edges
      .filter((e) => e.source === nodeId && e.relationship === 'writes')
      .map((e) => this.nodes[e.target])
      .filter(Boolean);

    const externalEffects = this.edges
      .filter((e) => e.source === nodeId && ['database-read', 'database-write', 'external-call'].includes(e.relationship))
      .map((e) => this.nodes[e.target])
      .filter(Boolean);

    return {
      node: targetNode,
      callers,
      callees,
      reads,
      writes,
      externalEffects,
      directDependencies: directDeps,
      transitiveDependencies: transitiveDeps,
    };
  }

  /**
   * Calculates the Behavioral Blast Radius for a given nodeId.
   * Performs bounded cycle-safe graph traversal upstream and downstream.
   * Categorizes relationships into CERTAIN, PROBABLE, and INFERRED.
   */
  calculateBlastRadius(nodeId, maxDepth = 5) {
    const targetNode = this.nodes[nodeId];
    if (!targetNode) {
      return {
        targetNode: null,
        certainItems: [],
        probableItems: [],
        inferredItems: [],
        affectedFiles: [],
        affectedFunctions: [],
        externalEffects: [],
        coveringTests: [],
        riskSummary: {
          filesAffectedCount: 0,
          functionsAffectedCount: 0,
          externalSystemsCount: 0,
          testsCount: 0,
          riskLevel: "LOW",
        },
      };
    }

    const certainItems = [];
    const probableItems = [];
    const inferredItems = [];

    const visitedUpstream = new Set([nodeId]);
    const visitedDownstream = new Set([nodeId]);
    const affectedNodeMap = new Map();

    // 1. Upstream Traversal (Callers & Callers of Callers)
    const upstreamQueue = [{ id: nodeId, depth: 0 }];
    while (upstreamQueue.length > 0) {
      const { id: currId, depth } = upstreamQueue.shift();
      if (depth >= maxDepth) continue;

      const incomingEdges = this.edges.filter((e) => e.target === currId);
      for (const edge of incomingEdges) {
        const sourceNode = this.nodes[edge.source];
        if (!sourceNode || visitedUpstream.has(sourceNode.id)) continue;

        visitedUpstream.add(sourceNode.id);
        affectedNodeMap.set(sourceNode.id, sourceNode);

        const isDirect = depth === 0;
        const confidence = isDirect ? "CERTAIN" : "PROBABLE";
        const reasoning = isDirect
          ? `Directly invokes ${targetNode.symbol} (L${edge.sourceLocation ? edge.sourceLocation.line : 1})`
          : `Indirectly depends on ${targetNode.symbol} via call chain (depth ${depth + 1})`;

        const item = {
          node: sourceNode,
          relationship: edge.relationship,
          confidence,
          depth: depth + 1,
          reasoning,
        };

        if (confidence === "CERTAIN") {
          certainItems.push(item);
        } else {
          probableItems.push(item);
        }

        upstreamQueue.push({ id: sourceNode.id, depth: depth + 1 });
      }
    }

    // 2. Downstream Traversal (Callees, Data Reads/Writes, External Effects)
    const downstreamQueue = [{ id: nodeId, depth: 0 }];
    while (downstreamQueue.length > 0) {
      const { id: currId, depth } = downstreamQueue.shift();
      if (depth >= maxDepth) continue;

      const outgoingEdges = this.edges.filter((e) => e.source === currId);
      for (const edge of outgoingEdges) {
        let targetNodeRef = this.nodes[edge.target];
        if (!targetNodeRef) {
          // Attempt symbol lookup for non-file prefixed targets
          targetNodeRef = Object.values(this.nodes).find(
            (n) => n.symbol === edge.target || n.id.endsWith(`::${edge.target}`)
          );
        }

        if (!targetNodeRef || visitedDownstream.has(targetNodeRef.id)) continue;

        visitedDownstream.add(targetNodeRef.id);
        affectedNodeMap.set(targetNodeRef.id, targetNodeRef);

        const isDirect = depth === 0;
        const confidence = isDirect ? "CERTAIN" : "PROBABLE";
        const reasoning = isDirect
          ? `Direct dependency (${edge.relationship}) of ${targetNode.symbol}`
          : `Transitive dependency (${edge.relationship}) at depth ${depth + 1}`;

        const item = {
          node: targetNodeRef,
          relationship: edge.relationship,
          confidence,
          depth: depth + 1,
          reasoning,
        };

        if (confidence === "CERTAIN") {
          certainItems.push(item);
        } else {
          probableItems.push(item);
        }

        downstreamQueue.push({ id: targetNodeRef.id, depth: depth + 1 });
      }
    }

    // 3. Inferred Symbolic Matches (Same symbol names across workspace files)
    const symbolMatches = Object.values(this.nodes).filter(
      (n) =>
        n.id !== nodeId &&
        n.symbol === targetNode.symbol &&
        !visitedUpstream.has(n.id) &&
        !visitedDownstream.has(n.id)
    );

    for (const matchNode of symbolMatches) {
      inferredItems.push({
        node: matchNode,
        relationship: "symbolic-match",
        confidence: "INFERRED",
        depth: 0,
        reasoning: `Matching symbol '${matchNode.symbol}' in ${matchNode.file} (Static AST resolution inferred)`,
      });
      affectedNodeMap.set(matchNode.id, matchNode);
    }

    // 4. Aggregations & Categorizations
    const allAffectedNodes = Array.from(affectedNodeMap.values());
    const affectedFiles = Array.from(new Set(allAffectedNodes.map((n) => n.file)));
    const affectedFunctions = allAffectedNodes.filter((n) => ["function", "class"].includes(n.type));
    const externalEffects = allAffectedNodes.filter((n) => ["database-op", "external-api"].includes(n.type));
    const coveringTests = allAffectedNodes.filter(
      (n) => n.type === "test" || n.symbol.toLowerCase().includes("test")
    );

    // 5. Risk Assessment Calculation
    let riskLevel = "LOW";
    if (externalEffects.length > 0 && affectedFiles.length > 3) {
      riskLevel = "CRITICAL";
    } else if (affectedFiles.length > 2 || affectedFunctions.length > 5) {
      riskLevel = "HIGH";
    } else if (affectedFiles.length > 1 || affectedFunctions.length > 2) {
      riskLevel = "MEDIUM";
    }

    // Attach runtime telemetry to target node if present
    const runtimeIndex = require('./runtime_execution_index');
    if (targetNode) {
      targetNode.runtimeTelemetry = runtimeIndex.getTelemetryForNode(targetNode.id);
    }

    return {
      targetNode,
      certainItems,
      probableItems,
      inferredItems,
      affectedFiles,
      affectedFunctions,
      externalEffects,
      coveringTests,
      riskSummary: {
        filesAffectedCount: affectedFiles.length,
        functionsAffectedCount: affectedFunctions.length,
        externalSystemsCount: externalEffects.length,
        testsCount: coveringTests.length,
        riskLevel,
      },
    };
  }

  /**
   * Helper to query blast radius by symbol name, file, or line.
   */
  calculateBlastRadiusBySymbol(symbol, relPath, line) {
    let targetNode = null;
    const isFileMatch = (nodeFile, targetPath) => {
      if (!targetPath) return true;
      if (nodeFile === targetPath) return true;
      if (nodeFile.endsWith(targetPath) || targetPath.endsWith(nodeFile))
        return true;
      if (path.basename(nodeFile) === path.basename(targetPath)) return true;
      return false;
    };

    if (symbol) {
      targetNode = Object.values(this.nodes).find(
        (n) =>
          (n.symbol === symbol ||
            n.symbol.endsWith(`.${symbol}`) ||
            n.symbol.includes(symbol)) &&
          isFileMatch(n.file, relPath)
      );
    }
    if (!targetNode && relPath && line) {
      targetNode = Object.values(this.nodes).find(
        (n) =>
          isFileMatch(n.file, relPath) &&
          n.location.line <= line &&
          (n.location.endLine || n.location.line + 20) >= line
      );
    }
    if (!targetNode && symbol) {
      targetNode = Object.values(this.nodes).find(
        (n) =>
          n.symbol === symbol ||
          n.symbol.endsWith(`.${symbol}`) ||
          n.id.endsWith(`::${symbol}`)
      );
    }

    if (!targetNode) {
      return this.calculateBlastRadius("non_existent_id");
    }

    return this.calculateBlastRadius(targetNode.id);
  }

  /**
   * Simulates a What-If hypothetical change on an immutable in-memory clone of the BDG graph.
   * Workspace source files on disk and real BDG graph are NEVER modified.
   */
  simulateWhatIf(request) {
    const targetNodeId = request.targetNodeId;
    const targetNode = this.nodes[targetNodeId];
    if (!targetNode) {
      return {
        operation: request.operation,
        targetNode: null,
        originalRiskLevel: "LOW",
        hypotheticalRiskLevel: "LOW",
        removedEdges: [],
        newlyDisconnectedNodes: [],
        newlyAffectedNodes: [],
        runtimeObservedImpact: {
          observedExecutionsLost: 0,
          errorCountSaved: 0,
          observedCallersImpacted: [],
        },
        predictedRisks: ["Target node not found"],
      };
    }

    const clonedNodes = JSON.parse(JSON.stringify(this.nodes));
    let clonedEdges = JSON.parse(JSON.stringify(this.edges));

    const originalBlast = this.calculateBlastRadius(targetNodeId);
    const removedEdges = [];
    const disconnectedNodeIds = new Set();

    if (request.operation === "remove-node") {
      delete clonedNodes[targetNodeId];
      clonedEdges = clonedEdges.filter((e) => {
        if (e.source === targetNodeId && e.relationship === "external-call") {
          removedEdges.push(e);
          return false;
        }
        return true;
      });
    } else if (operation === "disable-database-op") {
      clonedEdges = clonedEdges.filter((e) => {
        if (e.source === targetNodeId && ["database-read", "database-write"].includes(e.relationship)) {
          removedEdges.push(e);
          return false;
        }
        return true;
      });
    }

    // Evaluate disconnected nodes (had incoming callers in original graph, now 0 in cloned graph)
    const newlyDisconnectedNodes = [];
    for (const nodeId of Object.keys(clonedNodes)) {
      if (nodeId === targetNodeId) continue;
      const origIncoming = this.edges.filter((e) => e.target === nodeId && e.relationship === "calls");
      const cloneIncoming = clonedEdges.filter((e) => e.target === nodeId && e.relationship === "calls");

      if (origIncoming.length > 0 && cloneIncoming.length === 0) {
        newlyDisconnectedNodes.push(clonedNodes[nodeId]);
      }
    }

    // Evaluate hypothetical risk level
    const operation = request.operation || "remove-node";
    const affectedFiles = originalBlast.affectedFiles;
    let hypotheticalRiskLevel = "LOW";
    if (newlyDisconnectedNodes.length > 3 || (originalBlast.externalEffects.length > 0 && operation !== "disable-external-api")) {
      hypotheticalRiskLevel = "HIGH";
    } else if (newlyDisconnectedNodes.length > 0 || affectedFiles.length > 1) {
      hypotheticalRiskLevel = "MEDIUM";
    }

    // Overlay runtime execution telemetry
    const runtimeIndex = require("./runtime_execution_index");
    const tel = runtimeIndex.getTelemetryForNode(targetNodeId);

    const runtimeObservedImpact = {
      observedExecutionsLost: tel.observed ? tel.executionCount : 0,
      errorCountSaved: tel.errorCount,
      observedCallersImpacted: tel.observedCallers || [],
    };

    // Generate predicted risks
    const predictedRisks = [];
    if (removedEdges.length > 0) {
      predictedRisks.push(`Removing operation removes ${removedEdges.length} structural dependency edge(s).`);
    }
    if (newlyDisconnectedNodes.length > 0) {
      predictedRisks.push(`${newlyDisconnectedNodes.length} function(s) will have zero incoming callers in hypothetical graph.`);
    }
    if (tel.observed) {
      predictedRisks.push(`Hypothetical change impacts ${tel.executionCount} observed runtime execution(s).`);
    } else {
      predictedRisks.push(`Symbol has NO RUNTIME EVIDENCE in selected sessions. (Static risk only).`);
    }

    return {
      operation,
      targetNode,
      originalRiskLevel: originalBlast.riskSummary.riskLevel,
      hypotheticalRiskLevel,
      removedEdges,
      newlyDisconnectedNodes,
      newlyAffectedNodes: originalBlast.affectedFunctions,
      runtimeObservedImpact,
      predictedRisks,
    };
  }

  /**
   * Helper to run What-If simulation by symbol name, file, or line.
   */
  simulateWhatIfBySymbol(symbol, relPath, line, operation, secondarySymbol) {
    let targetNode = null;
    const isFileMatch = (nodeFile, targetPath) => {
      if (!targetPath) return true;
      if (nodeFile === targetPath) return true;
      if (nodeFile.endsWith(targetPath) || targetPath.endsWith(nodeFile)) return true;
      if (path.basename(nodeFile) === path.basename(targetPath)) return true;
      return false;
    };

    if (symbol) {
      targetNode = Object.values(this.nodes).find(
        (n) =>
          (n.symbol === symbol || n.symbol.endsWith(`.${symbol}`) || n.symbol.includes(symbol)) &&
          isFileMatch(n.file, relPath)
      );
    }
    if (!targetNode && relPath && line) {
      targetNode = Object.values(this.nodes).find(
        (n) => isFileMatch(n.file, relPath) && n.location.line <= line && (n.location.endLine || n.location.line + 20) >= line
      );
    }
    if (!targetNode && symbol) {
      targetNode = Object.values(this.nodes).find(
        (n) => n.symbol === symbol || n.symbol.endsWith(`.${symbol}`) || n.id.endsWith(`::${symbol}`)
      );
    }

    if (!targetNode) {
      return this.simulateWhatIf({ targetNodeId: "non_existent_id", operation });
    }

    let secondaryNodeId = undefined;
    if (secondarySymbol) {
      const secNode = Object.values(this.nodes).find((n) => n.symbol === secondarySymbol || n.symbol.includes(secondarySymbol));
      if (secNode) secondaryNodeId = secNode.id;
    }

    return this.simulateWhatIf({ targetNodeId: targetNode.id, operation, secondaryNodeId });
  }
}

const bdgEngineInstance = new BDGEngine();
module.exports = bdgEngineInstance;
