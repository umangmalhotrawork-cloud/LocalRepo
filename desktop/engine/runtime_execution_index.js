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
}

const runtimeExecutionIndexInstance = new RuntimeExecutionIndex();
module.exports = runtimeExecutionIndexInstance;
