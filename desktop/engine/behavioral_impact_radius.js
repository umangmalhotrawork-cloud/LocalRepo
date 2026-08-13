#!/usr/bin/env node
/**
 * Echo Nullity — Milestone 19: Behavioral Impact Radius Engine
 * Combines Static Workspace Call-Graph + Runtime Behavioral Fingerprinting + Cross-Version Diffing.
 * Calculates deterministic downstream blast-radius and separates Static Impact from Observed Change.
 */

const fs = require('fs');
const path = require('path');
const { compareBehavioralFingerprints } = require('./behavior_compare');

const SCHEMA_VERSION = 1;
const DEFAULT_MAX_DEPTH = 3;

/**
 * Normalizes symbol/function names for fuzzy call matching.
 */
function normalizeSymbol(sym) {
  if (!sym) return '';
  return sym.trim().toLowerCase();
}

/**
 * Calculates deterministic Behavioral Blast-Radius Score.
 */
function calculateBlastRadiusScore(rootSeverity, impactedNodes) {
  const severityMultiplier = {
    HIGH: 3.0,
    MEDIUM: 2.0,
    LOW: 1.0,
    NO_CHANGE: 0.0,
  }[rootSeverity] || 1.0;

  let nodeSum = 0;
  for (const node of impactedNodes) {
    const depthFactor = Math.pow(0.5, Math.max(0, node.distance - 1));
    let nodeWeight = 0.25; // Default for UNVERIFIED

    if (node.classification === 'OBSERVED_CHANGE') {
      nodeWeight = node.severity === 'HIGH' ? 2.5 : 1.5;
    } else if (node.classification === 'STATIC_IMPACT') {
      nodeWeight = 0.5;
    }
    nodeSum += nodeWeight * depthFactor;
  }

  const rawScore = severityMultiplier * (1.0 + nodeSum);
  return Math.round(rawScore * 10) / 10;
}

/**
 * Computes Behavioral Impact Radius starting from a target modified root function.
 */
function computeBehavioralImpactRadius(payload) {
  if (!payload || typeof payload !== 'object') {
    return {
      schema_version: SCHEMA_VERSION,
      error: 'Invalid or missing payload supplied to Impact Radius Engine.',
    };
  }

  const rootFnName = payload.root_function || payload.rootFunction || '';
  const rootFile = payload.root_file || payload.rootFile || '';
  const maxDepth = payload.max_depth || payload.maxDepth || DEFAULT_MAX_DEPTH;
  const graph = payload.workspace_graph || payload.workspaceGraph || { nodes: [], edges: [] };
  const fpA = payload.fingerprint_a || payload.fingerprintA || null;
  const fpB = payload.fingerprint_b || payload.fingerprintB || null;
  const depFpsA = payload.dependent_fingerprints_a || payload.dependentFingerprintsA || {};
  const depFpsB = payload.dependent_fingerprints_b || payload.dependentFingerprintsB || {};

  // 1. Evaluate root function cross-version diff
  let rootSeverity = 'NO_CHANGE';
  let rootDiffResult = null;

  if (fpA && fpB) {
    rootDiffResult = compareBehavioralFingerprints(fpA, fpB);
    if (rootDiffResult && rootDiffResult.severity) {
      rootSeverity = rootDiffResult.severity;
    }
  }

  // 2. Build caller adjacency map from workspace graph
  const nodes = graph.nodes || [];
  const edges = graph.edges || [];

  // Map nodes by id & symbol
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const symbolToNodes = new Map();

  for (const n of nodes) {
    const sym = normalizeSymbol(n.symbol);
    if (sym) {
      if (!symbolToNodes.has(sym)) symbolToNodes.set(sym, []);
      symbolToNodes.get(sym).push(n);
    }
  }

  // Build reverse adjacency list: calleeNodeId -> Set of callerNodeIds
  const callerAdj = new Map();
  for (const e of edges) {
    const srcId = e.source; // caller
    const tgtId = e.target; // callee

    if (!callerAdj.has(tgtId)) callerAdj.set(tgtId, new Set());
    callerAdj.get(tgtId).add(srcId);
  }

  // Locate root graph nodes matching root_function & root_file
  const rootSymNorm = normalizeSymbol(rootFnName);
  const rootFileNorm = rootFile.toLowerCase();
  
  const rootNodes = nodes.filter((n) => {
    const symMatch = normalizeSymbol(n.symbol) === rootSymNorm;
    const fileMatch = !rootFileNorm || (n.file && n.file.toLowerCase().includes(rootFileNorm));
    return symMatch && fileMatch;
  });

  // 3. BFS Traversal for Downstream Callers
  const visited = new Set();
  const queue = [];

  for (const rNode of rootNodes) {
    visited.add(rNode.id);
    queue.push({ nodeId: rNode.id, depth: 0 });
  }

  // If root node not found in graph, seed virtual root node
  if (queue.length === 0 && rootFnName) {
    const virtId = `${rootFile}::${rootFnName}::root`;
    visited.add(virtId);
    queue.push({ nodeId: virtId, depth: 0 });
  }

  const impactedNodes = [];
  let observedChangesCount = 0;
  let staticImpactsCount = 0;
  let unverifiedCount = 0;
  let maxDepthReached = 0;

  while (queue.length > 0) {
    const { nodeId, depth } = queue.shift();
    if (depth > maxDepth) continue;

    if (depth > maxDepthReached) {
      maxDepthReached = depth;
    }

    // Direct and indirect callers traversal
    const directCallers = callerAdj.get(nodeId) || new Set();

    for (const callerId of directCallers) {
      if (visited.has(callerId)) continue;
      visited.add(callerId);

      const callerNode = nodeMap.get(callerId) || {
        id: callerId,
        symbol: callerId.split('::')[2] || 'caller',
        file: callerId.split('::')[0] || '',
        line: 1,
        kind: 'call',
      };

      const currentDistance = depth + 1;
      const relationship = currentDistance === 1 ? 'direct-caller' : 'indirect-caller';

      // Check if dependent fingerprints exist for caller file
      const callerFileKey = callerNode.file;
      const depFpA = depFpsA[callerFileKey];
      const depFpB = depFpsB[callerFileKey];

      let classification = 'UNVERIFIED';
      let nodeSeverity = 'NO_CHANGE';
      let nodeDiffs = [];
      let description = `${relationship.replace('-', ' ')} '${callerNode.symbol}' in ${callerNode.file}.`;

      if (depFpA && depFpB) {
        const comp = compareBehavioralFingerprints(depFpA, depFpB);
        if (comp && comp.changed_functions) {
          const fnDiff = comp.changed_functions.find((f) => normalizeSymbol(f.name) === normalizeSymbol(callerNode.symbol));
          if (fnDiff && fnDiff.differences_count > 0) {
            classification = 'OBSERVED_CHANGE';
            nodeSeverity = comp.severity || 'MEDIUM';
            nodeDiffs = fnDiff.differences;
            description = `OBSERVED BEHAVIOR CHANGE: ${relationship.replace('-', ' ')} '${callerNode.symbol}' exhibited ${fnDiff.differences_count} observation diff(s).`;
            observedChangesCount++;
          } else {
            classification = 'STATIC_IMPACT';
            nodeSeverity = 'NO_CHANGE';
            description = `STATIC DEPENDENCY: ${relationship.replace('-', ' ')} '${callerNode.symbol}' evaluated (behavior equivalent).`;
            staticImpactsCount++;
          }
        } else {
          classification = 'STATIC_IMPACT';
          staticImpactsCount++;
        }
      } else {
        classification = 'UNVERIFIED';
        unverifiedCount++;
        description = `UNVERIFIED STATIC DEPENDENCY: ${relationship.replace('-', ' ')} '${callerNode.symbol}' in call graph.`;
      }

      impactedNodes.push({
        id: callerNode.id,
        symbol: callerNode.symbol,
        file: callerNode.file,
        line: callerNode.line || 1,
        kind: callerNode.kind || 'call',
        distance: currentDistance,
        relationship,
        classification,
        severity: nodeSeverity,
        description,
        differences: nodeDiffs,
      });

      if (currentDistance < maxDepth) {
        queue.push({ nodeId: callerId, depth: currentDistance });
      }
    }
  }

  // 4. Determine Global Severity & Score
  let globalSeverity = rootSeverity;
  if (impactedNodes.some((n) => n.severity === 'HIGH')) {
    globalSeverity = 'HIGH';
  } else if (globalSeverity === 'NO_CHANGE' && impactedNodes.some((n) => n.classification === 'OBSERVED_CHANGE')) {
    globalSeverity = 'MEDIUM';
  }

  const blastRadiusScore = calculateBlastRadiusScore(rootSeverity, impactedNodes);

  return {
    schema_version: SCHEMA_VERSION,
    root_function: {
      name: rootFnName,
      file: rootFile,
      severity: rootSeverity,
      differences_count: rootDiffResult?.summary?.changed_observations || 0,
      differences: rootDiffResult?.changed_functions?.[0]?.differences || [],
    },
    summary: {
      total_impacted_nodes: impactedNodes.length,
      observed_changes_count: observedChangesCount,
      static_impacts_count: staticImpactsCount,
      unverified_count: unverifiedCount,
      max_depth_reached: maxDepthReached,
      blast_radius_score: blastRadiusScore,
      global_severity: globalSeverity,
    },
    impacted_nodes: impactedNodes,
  };
}

if (require.main === module) {
  let raw = '';
  process.stdin.on('data', (chunk) => {
    raw += chunk;
  });
  process.stdin.on('end', () => {
    try {
      const payload = JSON.parse(raw);
      const res = computeBehavioralImpactRadius(payload);
      console.log(JSON.stringify(res, null, 2));
    } catch (e) {
      console.log(JSON.stringify({ schema_version: SCHEMA_VERSION, error: `JSON stdin decode error: ${e.message}` }));
    }
  });
}

module.exports = { computeBehavioralImpactRadius, calculateBlastRadiusScore };
