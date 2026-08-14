#!/usr/bin/env node
/**
 * Echo Nullity — Behavioral Blast Radius Estimator Engine (Flagship Feature)
 * 
 * Performs single-file edit analysis against baseline code to determine:
 * 1. Root function behavioral diffs between baseline source and edited source.
 * 2. Downstream impacted call-graph functions across the workspace.
 * 3. Blast radius scoring and observed vs static node classification.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const child_process = require('child_process');
const { compareBehavioralFingerprints } = require('./behavior_compare');
const { generateJSBehavioralFingerprint } = require('./js_behavior_fingerprint');

const SCHEMA_VERSION = 1;
const DEFAULT_MAX_DEPTH = 3;

/**
 * Normalizes symbol names for matching.
 */
function normalizeSymbol(sym) {
  if (!sym) return '';
  return sym.trim().toLowerCase();
}

/**
 * Helper to generate behavioral fingerprint for a file path.
 * Supports both JS/TS (via js_behavior_fingerprint) and Python (via python3 child process).
 */
function generateFingerprintForFile(filePath, sourceCode) {
  return new Promise((resolve) => {
    const isJS = filePath.match(/\.(js|jsx|ts|tsx)$/i);

    if (isJS) {
      try {
        const fp = generateJSBehavioralFingerprint(filePath);
        resolve(fp);
      } catch (err) {
        resolve({ error: err.message, functions: [] });
      }
      return;
    }

    // Python engine execution
    const enginePath = path.join(__dirname, 'behavior_fingerprint.py');
    child_process.execFile('python3', [enginePath, filePath], { maxBuffer: 10 * 1024 * 1024 }, (error, stdout, stderr) => {
      if (error && !stdout) {
        return resolve({ error: stderr || error.message, functions: [] });
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        resolve({ error: 'Failed to parse python fingerprint JSON output', functions: [] });
      }
    });
  });
}

/**
 * Calculates deterministic Blast Radius Score based on root severity and downstream impacted nodes.
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
    let nodeWeight = 0.25;

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
 * Computes Behavioral Blast Radius for an AI edit.
 */
async function calculateBehavioralBlastRadius(payload) {
  if (!payload || typeof payload !== 'object') {
    return {
      schema_version: SCHEMA_VERSION,
      error: 'Invalid or missing payload supplied to Blast Radius Engine.',
    };
  }

  const originalPath = payload.original_path || payload.originalPath || '';
  const editedSource = payload.edited_source !== undefined ? payload.edited_source : (payload.editedSource || '');
  const workspaceGraph = payload.workspace_graph || payload.workspaceGraph || { nodes: [], edges: [] };
  const maxDepth = payload.max_depth || payload.maxDepth || DEFAULT_MAX_DEPTH;

  if (!originalPath) {
    return {
      schema_version: SCHEMA_VERSION,
      error: 'Missing required original_path parameter.',
    };
  }

  const isJS = Boolean(originalPath.match(/\.(js|jsx|ts|tsx)$/i));
  const language = isJS ? (originalPath.match(/\.(ts|tsx)$/i) ? 'typescript' : 'javascript') : 'python';
  const ext = path.extname(originalPath) || (isJS ? '.js' : '.py');

  // Create temporary file for edited source
  const tempFileName = `echonullity_blast_${Date.now()}_${Math.random().toString(36).substring(2, 8)}${ext}`;
  const tempFilePath = path.join(os.tmpdir(), tempFileName);

  let baselineFp = null;
  let editedFp = null;

  try {
    // 1. Read or generate baseline fingerprint for original file
    if (fs.existsSync(originalPath)) {
      const origSource = fs.readFileSync(originalPath, 'utf-8');
      baselineFp = await generateFingerprintForFile(originalPath, origSource);
    } else {
      baselineFp = { file_path: originalPath, language, functions: [] };
    }

    // 2. Write edited source to temporary file and generate edited fingerprint
    fs.writeFileSync(tempFilePath, editedSource, 'utf-8');
    editedFp = await generateFingerprintForFile(tempFilePath, editedSource);

  } catch (err) {
    return {
      schema_version: SCHEMA_VERSION,
      language,
      error: `Failed during blast radius analysis: ${err.message}`,
      root_changed_functions: [],
      impacted_functions: [],
      blast_radius_score: 0.0,
      summary: { changed_functions: 0, impacted_functions: 0, changed_observations: 0 },
    };
  } finally {
    // Clean up temporary file
    try {
      if (fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
    } catch (e) {}
  }

  // 3. Compare baseline vs edited fingerprints
  const diffResult = compareBehavioralFingerprints(baselineFp, editedFp);
  const changedFnList = [
    ...(diffResult.changed_functions || []),
    ...(diffResult.added_functions || []),
    ...(diffResult.removed_functions || []),
  ];
  const rootChangedFunctions = [];
  let totalChangedObservations = 0;

  for (const fnDiff of changedFnList) {
    const changedObs = fnDiff.changed_observations_count || (fnDiff.differences ? fnDiff.differences.length : (fnDiff.observations_count || 1));
    totalChangedObservations += changedObs;

    rootChangedFunctions.push({
      name: fnDiff.name,
      file: originalPath,
      diff_type: fnDiff.type || fnDiff.diff_type || 'CHANGED',
      severity: fnDiff.severity || 'HIGH',
      changed_observations: changedObs,
      description: fnDiff.description || `Behavioral diff detected in ${fnDiff.name} (${fnDiff.severity || 'HIGH'})`,
    });
  }

  if (rootChangedFunctions.length === 0) {
    return {
      schema_version: SCHEMA_VERSION,
      language,
      original_path: originalPath,
      root_changed_functions: [],
      impacted_functions: [],
      blast_radius_score: 0.0,
      summary: {
        changed_functions: 0,
        impacted_functions: 0,
        changed_observations: 0,
      },
    };
  }

  // 4. Downstream call graph traversal for impacted callers
  const nodes = workspaceGraph.nodes || [];
  const edges = workspaceGraph.edges || [];

  // Build reverse adjacency list: calleeNodeId -> Set of callerNodeIds
  const callerAdj = new Map();
  for (const e of edges) {
    const srcId = e.source; // caller
    const tgtId = e.target; // callee
    if (!callerAdj.has(tgtId)) callerAdj.set(tgtId, new Set());
    callerAdj.get(tgtId).add(srcId);
  }

  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const impactedMap = new Map(); // fnKey -> node impact record

  for (const rootFn of rootChangedFunctions) {
    const rootSymNorm = normalizeSymbol(rootFn.name);
    const rootFileNorm = originalPath.toLowerCase();

    const matchingNodes = nodes.filter((n) => {
      const symMatch = normalizeSymbol(n.symbol) === rootSymNorm;
      const fileMatch = !rootFileNorm || (n.file && n.file.toLowerCase().includes(rootFileNorm));
      return symMatch && fileMatch;
    });

    const queue = [];
    const visited = new Set();

    for (const rNode of matchingNodes) {
      visited.add(rNode.id);
      queue.push({ nodeId: rNode.id, depth: 0 });
    }

    if (queue.length === 0) {
      const virtId = `${originalPath}::${rootFn.name}`;
      visited.add(virtId);
      queue.push({ nodeId: virtId, depth: 0 });
    }

    while (queue.length > 0) {
      const { nodeId, depth } = queue.shift();

      if (depth > 0) {
        const nodeObj = nodeMap.get(nodeId);
        const name = nodeObj ? (nodeObj.symbol || nodeObj.label) : nodeId.split('::').pop();
        const file = nodeObj ? nodeObj.file : originalPath;
        const fnKey = `${file}::${name}`;

        const classification = rootFn.severity === 'HIGH' ? 'OBSERVED_CHANGE' : 'STATIC_IMPACT';

        if (!impactedMap.has(fnKey) || depth < impactedMap.get(fnKey).distance) {
          impactedMap.set(fnKey, {
            id: nodeId,
            name: name,
            symbol: name,
            file: file,
            line: nodeObj ? nodeObj.line : 1,
            distance: depth,
            classification: classification,
            severity: rootFn.severity,
            description: classification === 'OBSERVED_CHANGE' 
              ? `Downstream caller of ${rootFn.name} with observed behavioral divergence.`
              : `Static caller of ${rootFn.name} within call graph.`,
          });
        }
      }

      if (depth < maxDepth) {
        const callers = callerAdj.get(nodeId) || new Set();
        for (const callerId of callers) {
          if (!visited.has(callerId)) {
            visited.add(callerId);
            queue.push({ nodeId: callerId, depth: depth + 1 });
          }
        }
      }
    }
  }

  // Convert impacted map to array and sort deterministically
  const impactedFunctions = Array.from(impactedMap.values()).sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance;
    if (a.classification !== b.classification) {
      return a.classification === 'OBSERVED_CHANGE' ? -1 : 1;
    }
    return a.name.localeCompare(b.name);
  });

  // Calculate highest root severity
  const severities = rootChangedFunctions.map((r) => r.severity);
  const highestRootSeverity = severities.includes('HIGH') ? 'HIGH' : (severities.includes('MEDIUM') ? 'MEDIUM' : 'LOW');

  const blastRadiusScore = calculateBlastRadiusScore(highestRootSeverity, impactedFunctions);

  return {
    schema_version: SCHEMA_VERSION,
    language: language,
    original_path: originalPath,
    root_changed_functions: rootChangedFunctions,
    impacted_functions: impactedFunctions,
    blast_radius_score: blastRadiusScore,
    summary: {
      changed_functions: rootChangedFunctions.length,
      impacted_functions: impactedFunctions.length,
      changed_observations: totalChangedObservations,
    },
  };
}

if (require.main === module) {
  let raw = '';
  process.stdin.on('data', (chunk) => {
    raw += chunk;
  });
  process.stdin.on('end', async () => {
    try {
      const payload = JSON.parse(raw);
      const res = await calculateBehavioralBlastRadius(payload);
      console.log(JSON.stringify(res, null, 2));
    } catch (e) {
      console.log(JSON.stringify({ schema_version: SCHEMA_VERSION, error: `JSON stdin decode error: ${e.message}` }));
    }
  });
}

module.exports = { calculateBehavioralBlastRadius, calculateBlastRadiusScore };
