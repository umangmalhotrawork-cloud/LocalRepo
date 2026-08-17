/**
 * Runtime Execution Index Service
 * Collects, indexes, and correlates local runtime execution events with BDG node identities.
 */

const bdgEngine = require('./bdg_engine');

class RuntimeExecutionIndex {
  constructor() {
    this.telemetryMap = new Map(); // nodeId -> BDGNodeRuntimeTelemetry
    this.sessionMap = new Map();   // sessionId -> { type, timestamp, events: [] }
    this.activeSessionId = "session_current";
    this.sessionMap.set("session_current", {
      id: "session_current",
      name: "Current Run",
      type: "current",
      timestamp: Date.now(),
      events: []
    });
  }

  /**
   * Resets all runtime execution telemetry.
   */
  clear() {
    this.telemetryMap.clear();
    this.sessionMap.clear();
    this.activeSessionId = "session_current";
    this.sessionMap.set("session_current", {
      id: "session_current",
      name: "Current Run",
      type: "current",
      timestamp: Date.now(),
      events: []
    });
  }

  /**
   * Records a runtime execution event and updates BDG node telemetry.
   */
  recordEvent(event) {
    let nodeId = event.nodeId;

    // Attempt node ID resolution using BDG Engine if nodeId not directly provided
    if (!nodeId && (event.symbol || event.file)) {
      const matchedNode = Object.values(bdgEngine.nodes).find(
        (n) =>
          (event.symbol && (n.symbol === event.symbol || n.symbol.endsWith(`.${event.symbol}`))) &&
          (!event.file || n.file === event.file || n.file.endsWith(event.file))
      );
      if (matchedNode) {
        nodeId = matchedNode.id;
      }
    }

    if (!nodeId) {
      nodeId = `inferred::${event.file || 'unknown'}::${event.symbol || 'global'}`;
    }

    let telemetry = this.telemetryMap.get(nodeId);
    if (!telemetry) {
      telemetry = {
        observed: true,
        executionCount: 0,
        lastSeen: null,
        averageDurationMs: null,
        errorCount: 0,
        observedCallers: [],
        sessions: []
      };
    }

    const count = event.executionCount || 1;
    telemetry.observed = true;
    telemetry.executionCount += count;
    telemetry.lastSeen = event.timestamp || Date.now();

    if (event.durationMs !== undefined && event.durationMs !== null) {
      if (telemetry.averageDurationMs === null) {
        telemetry.averageDurationMs = event.durationMs;
      } else {
        telemetry.averageDurationMs = Math.round((telemetry.averageDurationMs + event.durationMs) / 2);
      }
    }

    if (!event.success || event.eventType === "error") {
      telemetry.errorCount += count;
    }

    if (event.callerSymbol && !telemetry.observedCallers.includes(event.callerSymbol)) {
      telemetry.observedCallers.push(event.callerSymbol);
    }

    const sessId = event.sessionId || this.activeSessionId;
    if (!telemetry.sessions.includes(sessId)) {
      telemetry.sessions.push(sessId);
    }

    this.telemetryMap.set(nodeId, telemetry);

    // Record into session
    let session = this.sessionMap.get(sessId);
    if (!session) {
      session = {
        id: sessId,
        name: event.sessionType ? `${event.sessionType.toUpperCase()} Run` : "Run Session",
        type: event.sessionType || "current",
        timestamp: Date.now(),
        events: []
      };
      this.sessionMap.set(sessId, session);
    }
    session.events.push({ ...event, nodeId });

    return telemetry;
  }

  /**
   * Records a batch of execution events for a named session.
   */
  recordSession(sessionId, sessionType, events = []) {
    const session = {
      id: sessionId,
      name: sessionType === "test_run" ? "Test Suite Run" : sessionType === "debug_run" ? "Debug Session" : "Execution Run",
      type: sessionType,
      timestamp: Date.now(),
      events: []
    };
    this.sessionMap.set(sessionId, session);
    this.activeSessionId = sessionId;

    for (const evt of events) {
      this.recordEvent({ ...evt, sessionId, sessionType });
    }

    return session;
  }

  /**
   * Returns runtime telemetry for a given BDG node ID.
   */
  getTelemetryForNode(nodeId) {
    const telemetry = this.telemetryMap.get(nodeId);
    if (telemetry) return telemetry;

    // Check if matching symbol exists in telemetry map
    const targetNode = bdgEngine.nodes[nodeId];
    if (targetNode) {
      for (const [id, tel] of this.telemetryMap.entries()) {
        if (id.endsWith(`::${targetNode.symbol}`) || id.includes(targetNode.symbol)) {
          return tel;
        }
      }
    }

    return {
      observed: false,
      executionCount: 0,
      lastSeen: null,
      averageDurationMs: null,
      errorCount: 0,
      observedCallers: [],
      sessions: []
    };
  }

  /**
   * Compares static BDG callers vs observed runtime callers for a node.
   */
  getStaticVsRuntimeCallChain(nodeId) {
    const staticCallers = bdgEngine.getCallers(nodeId);
    const telemetry = this.getTelemetryForNode(nodeId);
    const runtimeCallers = telemetry.observedCallers || [];

    const runtimeCallerSet = new Set(runtimeCallers);
    const unobservedCallers = staticCallers.filter(
      (node) => !runtimeCallerSet.has(node.symbol) && !runtimeCallerSet.has(node.id)
    );

    return {
      staticCallers,
      runtimeCallers,
      unobservedCallers
    };
  }

  /**
   * Returns all active execution sessions.
   */
  getActiveSessionList() {
    return Array.from(this.sessionMap.values()).map((s) => ({
      id: s.id,
      name: s.name,
      type: s.type,
      timestamp: s.timestamp,
      eventCount: s.events.length
    }));
  }

  /**
   * Calculates evidence confidence score for a correlated dependency.
   */
  _calculateEvidenceConfidence(classification, staticEvidence, runtimeEvidence) {
    if (classification === "CONFIRMED") {
      const volumeBoost = Math.min(runtimeEvidence.executionCount / 100, 0.15);
      const errorPenalty = runtimeEvidence.errorCount > 0
        ? Math.min(runtimeEvidence.errorCount / Math.max(runtimeEvidence.executionCount, 1), 0.1)
        : 0;
      const recencyBoost = (runtimeEvidence.lastSeen && (Date.now() - runtimeEvidence.lastSeen) < 3600000)
        ? 0.05
        : 0;
      return Math.min(parseFloat((0.80 + volumeBoost + recencyBoost - errorPenalty).toFixed(2)), 1.0);
    }

    if (classification === "STATIC_ONLY") {
      const depthPenalty = staticEvidence.depth * 0.1;
      const edgeBoost = Math.min(staticEvidence.edgeCount * 0.05, 0.1);
      return Math.max(parseFloat((0.50 + edgeBoost - depthPenalty).toFixed(2)), 0.1);
    }

    if (classification === "RUNTIME_ONLY") {
      const volumeBoost = Math.min(runtimeEvidence.executionCount / 50, 0.2);
      const errorPenalty = runtimeEvidence.errorCount > 0 ? 0.1 : 0;
      return Math.min(parseFloat((0.40 + volumeBoost - errorPenalty).toFixed(2)), 0.7);
    }

    return 0.0;
  }

  /**
   * Correlates static BDG dependencies with runtime telemetry for a target symbol.
   * Returns a RuntimeEvidenceReport classifying each dependency as CONFIRMED, STATIC_ONLY, or RUNTIME_ONLY.
   */
  correlateRuntimeEvidence(symbol, relPath, line, targetNodeId = null) {
    const emptyReport = {
      targetSymbol: symbol || "unknown",
      targetFile: relPath || "unknown",
      targetNode: null,
      targetTelemetry: null,
      correlatedDependencies: [],
      summary: {
        totalDependencies: 0,
        confirmedCount: 0,
        staticOnlyCount: 0,
        runtimeOnlyCount: 0,
        overallConfidence: 0,
      },
      callerCorrelation: {
        staticCallers: [],
        runtimeCallers: [],
        confirmedCallers: [],
        unobservedCallers: [],
        unexpectedCallers: [],
      },
      riskLevel: "LOW",
      riskExplanation: "No target node resolved for evidence correlation.",
    };

    // 1. Resolve target node via BDG
    let targetNode = (targetNodeId && bdgEngine.nodes[targetNodeId]) || null;
    let queryResult = null;
    if (targetNode) {
      queryResult = bdgEngine.querySymbolDependencies(targetNode.symbol, targetNode.file, targetNode.location?.line, targetNode.id);
    } else {
      queryResult = bdgEngine.querySymbolDependencies(symbol, relPath, line);
      targetNode = queryResult?.node;
    }
    if (!targetNode) {
      return emptyReport;
    }

    // 2. Get target telemetry
    const targetTelemetry = this.getTelemetryForNode(targetNode.id);

    // 3. Gather all static dependencies from queryResult
    const staticDeps = [];
    const staticDepIdSet = new Set();

    const addStaticDeps = (nodes, relationship, depth) => {
      for (const node of nodes) {
        if (!node || node.id === targetNode.id || node.type === "file" || node.type === "module") continue;
        if (!staticDepIdSet.has(node.id)) {
          staticDepIdSet.add(node.id);
          // Count edges between target and this node
          const edgeCount = bdgEngine.edges.filter(
            (e) => (e.source === targetNode.id && e.target === node.id) ||
                   (e.source === node.id && e.target === targetNode.id)
          ).length;
          staticDeps.push({ node, relationship, depth, edgeCount });
        }
      }
    };

    addStaticDeps(queryResult.callers || [], "calls", 0);
    addStaticDeps(queryResult.callees || [], "calls", 0);
    addStaticDeps(queryResult.reads || [], "reads", 0);
    addStaticDeps(queryResult.writes || [], "writes", 0);
    addStaticDeps(queryResult.externalEffects || [], "external-call", 0);
    addStaticDeps(queryResult.directDependencies || [], "dependency", 0);
    addStaticDeps(queryResult.transitiveDependencies || [], "transitive", 1);

    // 4. For each static dependency, look up telemetry and classify
    const correlatedDependencies = [];

    for (const dep of staticDeps) {
      const depTelemetry = this.getTelemetryForNode(dep.node.id);
      const observed = depTelemetry && depTelemetry.observed;
      const classification = observed ? "CONFIRMED" : "STATIC_ONLY";

      const staticEvidence = {
        present: true,
        edgeCount: dep.edgeCount,
        depth: dep.depth,
      };
      const runtimeEvidence = {
        observed: !!observed,
        executionCount: depTelemetry?.executionCount || 0,
        errorCount: depTelemetry?.errorCount || 0,
        lastSeen: depTelemetry?.lastSeen || null,
        averageDurationMs: depTelemetry?.averageDurationMs || null,
      };

      const confidenceScore = this._calculateEvidenceConfidence(classification, staticEvidence, runtimeEvidence);

      const reasoning = classification === "CONFIRMED"
        ? `${dep.node.symbol} is both statically linked (${dep.relationship}) and observed at runtime (${runtimeEvidence.executionCount} executions).`
        : `${dep.node.symbol} exists in static BDG graph (${dep.relationship}) but has not been observed at runtime.`;

      correlatedDependencies.push({
        node: dep.node,
        relationship: dep.relationship,
        classification,
        staticEvidence,
        runtimeEvidence,
        confidenceScore,
        reasoning,
      });
    }

    // 5. Scan for RUNTIME_ONLY: telemetry entries whose observedCallers include targetSymbol
    //    or whose symbol appears in target's observedCallers, but are NOT in static deps
    for (const [telId, tel] of this.telemetryMap.entries()) {
      if (!tel.observed || staticDepIdSet.has(telId) || telId === targetNode.id) continue;

      // Check if this runtime entry has a caller-callee relationship with target
      const telSymbol = telId.split("::").pop() || "";
      const targetObservedCallers = targetTelemetry?.observedCallers || [];
      const telObservedCallers = tel.observedCallers || [];

      const isRelated =
        telObservedCallers.includes(targetNode.symbol) ||
        telObservedCallers.includes(targetNode.id) ||
        targetObservedCallers.includes(telSymbol);

      if (!isRelated) continue;

      // Resolve to a BDG node if possible
      let runtimeNode = bdgEngine.nodes[telId] || null;
      if (!runtimeNode) {
        runtimeNode = Object.values(bdgEngine.nodes).find(
          (n) => n.symbol === telSymbol || n.id === telId
        ) || null;
      }

      if (!runtimeNode || runtimeNode.type === "file" || runtimeNode.type === "module") continue;

      const staticEvidence = { present: false, edgeCount: 0, depth: 0 };
      const runtimeEvidence = {
        observed: true,
        executionCount: tel.executionCount,
        errorCount: tel.errorCount,
        lastSeen: tel.lastSeen,
        averageDurationMs: tel.averageDurationMs,
      };

      const confidenceScore = this._calculateEvidenceConfidence("RUNTIME_ONLY", staticEvidence, runtimeEvidence);

      correlatedDependencies.push({
        node: runtimeNode,
        relationship: "runtime-observed",
        classification: "RUNTIME_ONLY",
        staticEvidence,
        runtimeEvidence,
        confidenceScore,
        reasoning: `${runtimeNode.symbol} was observed at runtime (${tel.executionCount} executions) with caller/callee relationship to ${targetNode.symbol}, but no static BDG edge exists.`,
      });
    }

    // 6. Build caller correlation using existing getStaticVsRuntimeCallChain
    const callChain = this.getStaticVsRuntimeCallChain(targetNode.id);
    const staticCallerSymbols = (callChain.staticCallers || []).map((n) => n.symbol);
    const runtimeCallerSymbols = callChain.runtimeCallers || [];
    const runtimeCallerSet = new Set(runtimeCallerSymbols);
    const staticCallerSet = new Set(staticCallerSymbols);

    const confirmedCallers = staticCallerSymbols.filter((s) => runtimeCallerSet.has(s));
    const unexpectedCallers = runtimeCallerSymbols.filter((s) => !staticCallerSet.has(s));

    // 7. Compute summary
    const confirmedCount = correlatedDependencies.filter((d) => d.classification === "CONFIRMED").length;
    const staticOnlyCount = correlatedDependencies.filter((d) => d.classification === "STATIC_ONLY").length;
    const runtimeOnlyCount = correlatedDependencies.filter((d) => d.classification === "RUNTIME_ONLY").length;
    const totalDependencies = correlatedDependencies.length;

    // Weighted average confidence
    let weightedSum = 0;
    let weightTotal = 0;
    for (const dep of correlatedDependencies) {
      const w = dep.classification === "CONFIRMED" ? 3 : dep.classification === "RUNTIME_ONLY" ? 2 : 1;
      weightedSum += dep.confidenceScore * w;
      weightTotal += w;
    }
    const overallConfidence = weightTotal > 0 ? parseFloat((weightedSum / weightTotal).toFixed(2)) : 0;

    // 8. Derive risk level
    let riskLevel = "LOW";
    let riskExplanation = "";

    if (totalDependencies === 0) {
      riskLevel = "LOW";
      riskExplanation = "No dependencies found for evidence correlation.";
    } else if (runtimeOnlyCount > confirmedCount) {
      riskLevel = "CRITICAL";
      riskExplanation = `${runtimeOnlyCount} runtime-only dependencies exceed ${confirmedCount} confirmed — static graph may be incomplete.`;
    } else if (runtimeOnlyCount > 0 && staticOnlyCount > confirmedCount) {
      riskLevel = "HIGH";
      riskExplanation = `${staticOnlyCount} static-only and ${runtimeOnlyCount} runtime-only dependencies detected — low runtime coverage of static graph.`;
    } else if (confirmedCount / totalDependencies >= 0.8) {
      riskLevel = "LOW";
      riskExplanation = `${confirmedCount}/${totalDependencies} dependencies confirmed by runtime evidence (${Math.round(confirmedCount / totalDependencies * 100)}% coverage).`;
    } else {
      riskLevel = "MEDIUM";
      riskExplanation = `${confirmedCount}/${totalDependencies} dependencies confirmed (${Math.round(confirmedCount / totalDependencies * 100)}% coverage), ${staticOnlyCount} static-only.`;
    }

    return {
      targetSymbol: targetNode.symbol,
      targetFile: targetNode.file,
      targetNode,
      targetTelemetry,
      correlatedDependencies,
      summary: {
        totalDependencies,
        confirmedCount,
        staticOnlyCount,
        runtimeOnlyCount,
        overallConfidence,
      },
      callerCorrelation: {
        staticCallers: callChain.staticCallers || [],
        runtimeCallers: runtimeCallerSymbols,
        confirmedCallers,
        unobservedCallers: callChain.unobservedCallers || [],
        unexpectedCallers,
      },
      riskLevel,
      riskExplanation,
    };
  }
}

const runtimeExecutionIndexInstance = new RuntimeExecutionIndex();
module.exports = runtimeExecutionIndexInstance;
