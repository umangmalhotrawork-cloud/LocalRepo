/**
 * EVIDENCE GRAPH & VERIFIED ENGINEERING TRAIL (Phase 2F)
 * 
 * Manages an in-memory, session-scoped evidence graph separating Model Inference from
 * Observed Facts and Verifications (Firewall, Transaction, Test, User).
 * 
 * Safety Rules:
 * 1. Max 1000 nodes per active session.
 * 2. Max 2000 characters per statement.
 * 3. Max 50 related node IDs per node.
 * 4. All free-form text sanitized via secretFilter.
 * 5. Rejects path traversal and normalizes workspace paths.
 * 6. Never stores API keys, auth headers, or raw provider HTTP payloads.
 */

const path = require('path');
const secretFilter = require('../../security/secretFilter');

const PROVENANCE_CLASSES = {
  MODEL_INFERENCE: 'MODEL_INFERENCE',
  OBSERVED: 'OBSERVED',
  FIREWALL_VERIFIED: 'FIREWALL_VERIFIED',
  TRANSACTION_VERIFIED: 'TRANSACTION_VERIFIED',
  TEST_VERIFIED: 'TEST_VERIFIED',
  USER_APPROVED: 'USER_APPROVED',
  SYSTEM_GENERATED: 'SYSTEM_GENERATED',
};

const VERIFICATION_LEVELS = {
  UNVERIFIED: 'UNVERIFIED',
  OBSERVED: 'OBSERVED',
  SAFETY_VERIFIED: 'SAFETY_VERIFIED',
  TRANSACTION_VERIFIED: 'TRANSACTION_VERIFIED',
  TEST_VERIFIED: 'TEST_VERIFIED',
  USER_VERIFIED: 'USER_VERIFIED',
};

const NODE_TYPES = {
  TASK: 'TASK',
  OBSERVATION: 'OBSERVATION',
  AI_DECISION: 'AI_DECISION',
  CODE_CHANGE: 'CODE_CHANGE',
  SAFETY_CHECK: 'SAFETY_CHECK',
  TRANSACTION: 'TRANSACTION',
  TEST_RUN: 'TEST_RUN',
  TEST_RESULT: 'TEST_RESULT',
  VERIFICATION: 'VERIFICATION',
  USER_APPROVAL: 'USER_APPROVAL',
};

const EDGE_TYPES = {
  DERIVED_FROM: 'DERIVED_FROM',
  INSPECTED: 'INSPECTED',
  PROPOSED: 'PROPOSED',
  REVIEWED_BY: 'REVIEWED_BY',
  APPROVED_BY: 'APPROVED_BY',
  APPLIED_BY: 'APPLIED_BY',
  VERIFIED_BY: 'VERIFIED_BY',
  FAILED_BECAUSE: 'FAILED_BECAUSE',
  REPAIRED_BY: 'REPAIRED_BY',
};

const MAX_NODES_PER_SESSION = 1000;
const MAX_STATEMENT_LENGTH = 2000;
const MAX_RELATED_NODES = 50;

class EvidenceGraph {
  constructor() {
    this.sessionNodes = new Map(); // sessionId -> Map(nodeId -> Node)
    this.sessionEdges = new Map(); // sessionId -> Array of { from, to, type }
  }

  /**
   * Helper: Ensures session maps exist.
   */
  _ensureSession(sessionId) {
    const key = sessionId || 'default_session';
    if (!this.sessionNodes.has(key)) {
      this.sessionNodes.set(key, new Map());
      this.sessionEdges.set(key, []);
    }
    return key;
  }

  /**
   * Adds a structured evidence node to the graph.
   */
  addNode(data = {}) {
    const sessionId = this._ensureSession(data.sessionId);
    const nodeMap = this.sessionNodes.get(sessionId);

    // Memory bounding limit check
    if (nodeMap.size >= MAX_NODES_PER_SESSION) {
      // Delete oldest node if overflow
      const oldestKey = nodeMap.keys().next().value;
      nodeMap.delete(oldestKey);
    }

    const type = data.type || NODE_TYPES.OBSERVATION;
    const prefix = type.toLowerCase();
    const id = data.id || `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

    // String statement sanitization & bounding
    let statement = data.statement || data.description || '';
    if (typeof statement === 'string') {
      statement = secretFilter.sanitizeString(statement);
      if (statement.length > MAX_STATEMENT_LENGTH) {
        statement = statement.slice(0, MAX_STATEMENT_LENGTH) + '... [TRUNCATED]';
      }
    }

    // Path normalization & security validation
    let filePath = data.filePath;
    if (filePath && typeof filePath === 'string') {
      const norm = filePath.replace(/\\/g, '/');
      if (norm.includes('../') || norm.includes('..\\')) {
        filePath = 'invalid_path_traversal';
      } else {
        filePath = norm;
      }
    }

    // Related node IDs limit
    let relatedNodeIds = Array.isArray(data.relatedNodeIds) ? data.relatedNodeIds.slice(0, MAX_RELATED_NODES) : [];

    const node = {
      id,
      type,
      timestamp: data.timestamp || Date.now(),
      source: secretFilter.sanitizeString(data.source || 'system'),
      provenance: data.provenance || PROVENANCE_CLASSES.OBSERVED,
      verified: Boolean(data.verified),
      sessionId,
      statement,
      workspacePath: data.workspacePath ? path.normalize(data.workspacePath) : null,
      filePath: filePath || null,
      lineRange: data.lineRange || null,
      roleId: data.roleId || null,
      providerId: data.providerId || null,
      modelId: data.modelId || null,
      relatedNodeIds,
      metadata: data.metadata ? secretFilter.sanitizeObject(data.metadata) : {},
    };

    nodeMap.set(id, node);
    return node;
  }

  /**
   * Adds a directional edge between two nodes.
   */
  addEdge(fromId, toId, type = EDGE_TYPES.DERIVED_FROM, sessionId = 'default_session') {
    const key = this._ensureSession(sessionId);
    const edgeList = this.sessionEdges.get(key);

    // Prevent duplicate edges
    const exists = edgeList.some(e => e.from === fromId && e.to === toId && e.type === type);
    if (!exists) {
      edgeList.push({ from: fromId, to: toId, type, timestamp: Date.now() });
    }

    // Update related node lists on both nodes
    const nodeMap = this.sessionNodes.get(key);
    const fromNode = nodeMap.get(fromId);
    const toNode = nodeMap.get(toId);

    if (fromNode && !fromNode.relatedNodeIds.includes(toId) && fromNode.relatedNodeIds.length < MAX_RELATED_NODES) {
      fromNode.relatedNodeIds.push(toId);
    }
    if (toNode && !toNode.relatedNodeIds.includes(fromId) && toNode.relatedNodeIds.length < MAX_RELATED_NODES) {
      toNode.relatedNodeIds.push(fromId);
    }

    return { from: fromId, to: toId, type };
  }

  /**
   * Retrieves a node by ID across sessions.
   */
  getNode(id, sessionId = null) {
    if (sessionId) {
      const nodeMap = this.sessionNodes.get(sessionId);
      return nodeMap ? nodeMap.get(id) || null : null;
    }
    for (const nodeMap of this.sessionNodes.values()) {
      if (nodeMap.has(id)) {
        return nodeMap.get(id);
      }
    }
    return null;
  }

  /**
   * Returns all nodes for a session.
   */
  getNodesBySession(sessionId) {
    const key = sessionId || 'default_session';
    const nodeMap = this.sessionNodes.get(key);
    return nodeMap ? Array.from(nodeMap.values()) : [];
  }

  /**
   * Traverses graph from a starting node ID.
   */
  traverseFrom(startId, sessionId = 'default_session', direction = 'both') {
    const key = this._ensureSession(sessionId);
    const nodeMap = this.sessionNodes.get(key);
    const edgeList = this.sessionEdges.get(key);

    if (!nodeMap || !nodeMap.has(startId)) {
      return { nodes: [], edges: [] };
    }

    const visitedNodes = new Set([startId]);
    const visitedEdges = [];
    const queue = [startId];

    while (queue.length > 0) {
      const curr = queue.shift();
      for (const edge of edgeList) {
        if ((direction === 'downstream' || direction === 'both') && edge.from === curr) {
          visitedEdges.push(edge);
          if (!visitedNodes.has(edge.to)) {
            visitedNodes.add(edge.to);
            queue.push(edge.to);
          }
        }
        if ((direction === 'upstream' || direction === 'both') && edge.to === curr) {
          visitedEdges.push(edge);
          if (!visitedNodes.has(edge.from)) {
            visitedNodes.add(edge.from);
            queue.push(edge.from);
          }
        }
      }
    }

    const resultNodes = Array.from(visitedNodes).map(id => nodeMap.get(id)).filter(Boolean);
    return { nodes: resultNodes, edges: visitedEdges };
  }

  /**
   * Computes authoritative verification summary for a session.
   */
  getVerificationSummary(sessionId) {
    const nodes = this.getNodesBySession(sessionId);
    if (nodes.length === 0) {
      return {
        taskStatus: 'IDLE',
        evidenceCount: 0,
        filesInspected: 0,
        filesChanged: 0,
        firewallStatus: 'NOT_EVALUATED',
        transactionStatus: 'NONE',
        testStatus: 'NOT_RUN',
        testsPassed: 0,
        testsFailed: 0,
        verificationLevel: VERIFICATION_LEVELS.UNVERIFIED,
        unresolvedClaims: 0,
      };
    }

    const inspectedFiles = new Set(nodes.filter(n => n.type === NODE_TYPES.OBSERVATION && n.filePath).map(n => n.filePath));
    const changedFiles = new Set(nodes.filter(n => n.type === NODE_TYPES.CODE_CHANGE && n.filePath).map(n => n.filePath));

    const firewallNode = nodes.slice().reverse().find(n => n.type === NODE_TYPES.SAFETY_CHECK);
    const transactionNode = nodes.slice().reverse().find(n => n.type === NODE_TYPES.TRANSACTION);
    const testResultNode = nodes.slice().reverse().find(n => n.type === NODE_TYPES.TEST_RESULT);
    const userApproveNode = nodes.slice().reverse().find(n => n.type === NODE_TYPES.USER_APPROVAL);

    let firewallStatus = firewallNode ? firewallNode.metadata?.riskLevel || 'SAFE' : 'NOT_EVALUATED';
    let transactionStatus = transactionNode ? (transactionNode.metadata?.success ? 'COMMITTED' : 'FAILED') : 'NONE';
    let testStatus = testResultNode ? testResultNode.metadata?.status || 'NOT_RUN' : 'NOT_RUN';

    let testsPassed = testResultNode?.metadata?.summary?.passed || 0;
    let testsFailed = testResultNode?.metadata?.summary?.failed || 0;

    // Determine strongest verification level
    let verificationLevel = VERIFICATION_LEVELS.UNVERIFIED;
    if (userApproveNode && userApproveNode.verified) {
      verificationLevel = VERIFICATION_LEVELS.USER_VERIFIED;
    } else if (testResultNode && testResultNode.verified && testStatus === 'PASSED') {
      verificationLevel = VERIFICATION_LEVELS.TEST_VERIFIED;
    } else if (transactionNode && transactionNode.verified) {
      verificationLevel = VERIFICATION_LEVELS.TRANSACTION_VERIFIED;
    } else if (firewallNode && firewallNode.verified) {
      verificationLevel = VERIFICATION_LEVELS.SAFETY_VERIFIED;
    } else if (inspectedFiles.size > 0) {
      verificationLevel = VERIFICATION_LEVELS.OBSERVED;
    }

    const unverifiedDecisions = nodes.filter(n => n.type === NODE_TYPES.AI_DECISION && !n.verified).length;

    const taskNode = nodes.find(n => n.type === NODE_TYPES.TASK);

    return {
      taskStatus: taskNode ? (testStatus === 'PASSED' ? 'COMPLETED' : 'IN_PROGRESS') : 'IDLE',
      evidenceCount: nodes.length,
      filesInspected: inspectedFiles.size,
      filesChanged: changedFiles.size,
      firewallStatus,
      transactionStatus,
      testStatus,
      testsPassed,
      testsFailed,
      verificationLevel,
      unresolvedClaims: unverifiedDecisions,
    };
  }

  /**
   * Exports a compact metadata summary compatible with Continuum schema v1.0.0.
   */
  exportCompactSummary(sessionId) {
    const summary = this.getVerificationSummary(sessionId);
    const nodes = this.getNodesBySession(sessionId);

    return {
      sessionId,
      summary,
      recentEvidence: nodes.slice(-10).map(n => ({
        id: n.id,
        type: n.type,
        provenance: n.provenance,
        statement: n.statement.slice(0, 100),
        verified: n.verified,
      })),
    };
  }

  /**
   * Resets nodes and edges for a session.
   */
  reset(sessionId) {
    const key = sessionId || 'default_session';
    this.sessionNodes.delete(key);
    this.sessionEdges.delete(key);
  }
}

const evidenceGraph = new EvidenceGraph();

module.exports = {
  EvidenceGraph,
  evidenceGraph,
  PROVENANCE_CLASSES,
  VERIFICATION_LEVELS,
  NODE_TYPES,
  EDGE_TYPES,
};
