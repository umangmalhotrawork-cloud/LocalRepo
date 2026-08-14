#!/usr/bin/env node
/**
 * Echo Nullity — AI Patch Safety Firewall Engine (Milestone 23 Flagship)
 * 
 * Evaluates AI-generated code patches (unified git diffs or edited file buffers)
 * BEFORE they are accepted into a codebase. Integrates:
 * 1. Counterfactual Execution Engine (Milestone 22)
 * 2. Behavioral Blast Radius Estimator Engine (Milestone 21)
 * 3. Polyglot observation matrices (Python + Node.js/TypeScript)
 * 
 * Computes deterministic risk_score (0-100), risk_level (AUTO_APPROVE, SAFE_REMOVE, REVIEW_REQUIRED, HIGH_RISK),
 * and safe_to_auto_apply flags with complete trace diff reports.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { computeCounterfactualAnalysis, produceCounterfactualSource } = require('./counterfactual_engine');
const { calculateBehavioralBlastRadius } = require('./behavioral_blast_radius');
const { analyzeSemanticIntentDrift } = require('./semantic_intent_drift');

const SCHEMA_VERSION = 1;

/**
 * Parses a unified git diff text into structured file & hunk targets.
 */
function parseUnifiedDiff(patchText) {
  if (!patchText || typeof patchText !== 'string') return [];

  const files = [];
  const lines = patchText.split('\n');
  let currentFile = null;
  let currentHunk = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    if (line.startsWith('--- ') || line.startsWith('+++ ')) {
      const isNew = line.startsWith('+++ ');
      const rawPath = line.substring(4).trim();
      const cleanPath = rawPath.replace(/^[ab]\//, '');

      if (cleanPath && cleanPath !== '/dev/null') {
        if (!currentFile || currentFile.file_path !== cleanPath) {
          if (isNew) {
            currentFile = { file_path: cleanPath, hunks: [] };
            files.push(currentFile);
          }
        }
      }
    } else if (line.startsWith('@@ ')) {
      if (!currentFile) {
        currentFile = { file_path: 'patch_target', hunks: [] };
        files.push(currentFile);
      }

      // Extract hunk range: @@ -start,count +start,count @@
      const match = line.match(/@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/);
      if (match) {
        const startOrig = parseInt(match[1], 10);
        const countOrig = match[2] ? parseInt(match[2], 10) : 1;
        const startNew = parseInt(match[3], 10);
        const countNew = match[4] ? parseInt(match[4], 10) : 1;

        currentHunk = {
          hunk_index: currentFile.hunks.length + 1,
          start_line: startOrig,
          end_line: startOrig + Math.max(0, countOrig - 1),
          start_new_line: startNew,
          end_new_line: startNew + Math.max(0, countNew - 1),
          removed_lines: [],
          added_lines: [],
          raw_lines: [],
        };
        currentFile.hunks.push(currentHunk);
      }
    } else if (currentHunk) {
      if (line.startsWith('-') && !line.startsWith('---')) {
        currentHunk.removed_lines.push(line.substring(1));
      } else if (line.startsWith('+') && !line.startsWith('+++')) {
        currentHunk.added_lines.push(line.substring(1));
      }
      currentHunk.raw_lines.push(line);
    }
  }

  return files;
}

/**
 * Main Entry Point: Evaluates AI Patch against Safety Firewall
 */
async function evaluateAIPatchFirewall(payload = {}) {
  const {
    patch_text,
    file_path,
    edited_source,
    candidate_line,
    workspace_graph,
    max_depth = 3,
  } = payload;

  const parsedFiles = parseUnifiedDiff(patch_text);
  const resultFiles = [];

  let totalChangedHunks = 0;
  let safeRemovalsCount = 0;
  let behaviorChangesCount = 0;
  let totalImpactedFunctionsCount = 0;
  let maxBlastRadiusScore = 0;
  let hasExceptionTransitions = false;
  let overallMinConfidence = 1.0;

  // Single file edited source or candidate line handling if patch_text is not a unified diff
  if (parsedFiles.length === 0 && file_path) {
    let origSource = '';
    try {
      if (fs.existsSync(file_path)) {
        origSource = fs.readFileSync(file_path, 'utf-8');
      }
    } catch (e) {}

    let calcEditedSource = edited_source;
    if (calcEditedSource === undefined || calcEditedSource === null) {
      calcEditedSource = produceCounterfactualSource(origSource, candidate_line);
    }

    // Run Counterfactual Analysis
    const cfResult = await computeCounterfactualAnalysis({
      original_path: file_path,
      edited_source: calcEditedSource,
      candidate_line,
      workspace_graph,
    });

    let blastResult = null;
    if (!cfResult.safe_to_remove || cfResult.changed_observations > 0) {
      blastResult = await calculateBehavioralBlastRadius({
        original_path: file_path,
        edited_source: calcEditedSource,
        workspace_graph,
        max_depth,
      });
    }

    const isSafe = cfResult.safe_to_remove;
    if (isSafe) safeRemovalsCount++;
    else behaviorChangesCount++;

    totalChangedHunks = 1;
    overallMinConfidence = Math.min(overallMinConfidence, cfResult.confidence || 0.0);

    const blastScore = blastResult ? (blastResult.blast_radius_score || 0) : 0;
    maxBlastRadiusScore = Math.max(maxBlastRadiusScore, blastScore);

    const impactedCount = blastResult && blastResult.impacted_functions ? blastResult.impacted_functions.length : 0;
    totalImpactedFunctionsCount += impactedCount;

    if (cfResult.trace_diff && cfResult.trace_diff.some((t) => t.severity === 'HIGH' || (t.differences && t.differences.some((d) => d.type?.includes('exception'))))) {
      hasExceptionTransitions = true;
    }

    resultFiles.push({
      file_path,
      hunks: [
        {
          hunk_index: 1,
          start_line: candidate_line ? parseInt(String(candidate_line).split('-')[0], 10) || 1 : 1,
          end_line: candidate_line ? parseInt(String(candidate_line).split('-').pop(), 10) || 1 : 1,
          original_code: origSource,
          edited_code: calcEditedSource,
          counterfactual: {
            equivalence_score: cfResult.equivalence_score,
            safe_to_remove: cfResult.safe_to_remove,
            changed_observations: cfResult.changed_observations,
            total_observations: cfResult.total_observations,
            confidence: cfResult.confidence,
            trace_diff: cfResult.trace_diff || [],
          },
          blast_radius: blastResult ? {
            blast_radius_score: blastResult.blast_radius_score,
            root_changed_functions: blastResult.root_changed_functions || [],
            impacted_functions: blastResult.impacted_functions || [],
          } : {
            blast_radius_score: 0,
            root_changed_functions: [],
            impacted_functions: [],
          },
        },
      ],
    });
  } else if (parsedFiles.length > 0) {
    // Process each file in the parsed unified diff
    for (const fileObj of parsedFiles) {
      const targetFilePath = file_path || fileObj.file_path;
      let origSource = '';
      try {
        if (fs.existsSync(targetFilePath)) {
          origSource = fs.readFileSync(targetFilePath, 'utf-8');
        }
      } catch (e) {}

      const hunkResults = [];

      for (const hunk of fileObj.hunks) {
        totalChangedHunks++;
        const lineRange = `${hunk.start_line}-${hunk.end_line}`;

        const cfResult = await computeCounterfactualAnalysis({
          original_path: targetFilePath,
          candidate_line: lineRange,
          workspace_graph,
        });

        let blastResult = null;
        if (!cfResult.safe_to_remove || cfResult.changed_observations > 0) {
          const editedHunkSource = produceCounterfactualSource(origSource, lineRange);
          blastResult = await calculateBehavioralBlastRadius({
            original_path: targetFilePath,
            edited_source: editedHunkSource,
            workspace_graph,
            max_depth,
          });
        }

        const isSafe = cfResult.safe_to_remove;
        if (isSafe) safeRemovalsCount++;
        else behaviorChangesCount++;

        overallMinConfidence = Math.min(overallMinConfidence, cfResult.confidence || 0.0);

        const blastScore = blastResult ? (blastResult.blast_radius_score || 0) : 0;
        maxBlastRadiusScore = Math.max(maxBlastRadiusScore, blastScore);

        const impactedCount = blastResult && blastResult.impacted_functions ? blastResult.impacted_functions.length : 0;
        totalImpactedFunctionsCount += impactedCount;

        if (cfResult.trace_diff && cfResult.trace_diff.some((t) => t.severity === 'HIGH' || (t.differences && t.differences.some((d) => d.type?.includes('exception'))))) {
          hasExceptionTransitions = true;
        }

        hunkResults.push({
          hunk_index: hunk.hunk_index,
          start_line: hunk.start_line,
          end_line: hunk.end_line,
          original_code: hunk.removed_lines.join('\n'),
          edited_code: hunk.added_lines.join('\n'),
          counterfactual: {
            equivalence_score: cfResult.equivalence_score,
            safe_to_remove: cfResult.safe_to_remove,
            changed_observations: cfResult.changed_observations,
            total_observations: cfResult.total_observations,
            confidence: cfResult.confidence,
            trace_diff: cfResult.trace_diff || [],
          },
          blast_radius: blastResult ? {
            blast_radius_score: blastResult.blast_radius_score,
            root_changed_functions: blastResult.root_changed_functions || [],
            impacted_functions: blastResult.impacted_functions || [],
          } : {
            blast_radius_score: 0,
            root_changed_functions: [],
            impacted_functions: [],
          },
        });
      }

      resultFiles.push({
        file_path: targetFilePath,
        hunks: hunkResults,
      });
    }
  }

  // Calculate Risk Score & Risk Level
  let hasHighDrift = false;
  for (const f of resultFiles) {
    for (const h of f.hunks) {
      const driftRes = analyzeSemanticIntentDrift({
        original_source: h.original_code,
        edited_source: h.edited_code,
      });
      h.semantic_intent_drift = driftRes;
      if (driftRes.drift_level === 'HIGH') {
        hasHighDrift = true;
      }
    }
  }

  let riskScore = 0;
  let riskLevel = 'REVIEW_REQUIRED';
  let safeToAutoApply = false;

  if (totalChangedHunks === 0) {
    riskScore = 0;
    riskLevel = 'AUTO_APPROVE';
    safeToAutoApply = true;
  } else if (behaviorChangesCount === 0 && safeRemovalsCount > 0 && maxBlastRadiusScore === 0 && !hasHighDrift) {
    riskScore = 0;
    riskLevel = 'SAFE_REMOVE';
    safeToAutoApply = true;
  } else if (behaviorChangesCount === 0 && safeRemovalsCount === 0 && !hasHighDrift) {
    riskScore = 0;
    riskLevel = 'AUTO_APPROVE';
    safeToAutoApply = true;
  } else {
    riskScore = Math.min(100, Math.round(maxBlastRadiusScore * 4 + behaviorChangesCount * 25 + (hasExceptionTransitions ? 35 : 0) + (hasHighDrift ? 30 : 0)));
    
    if (riskScore >= 60 || hasExceptionTransitions || maxBlastRadiusScore >= 15 || (hasHighDrift && maxBlastRadiusScore >= 5)) {
      riskLevel = 'HIGH_RISK';
      safeToAutoApply = false;
    } else if (hasHighDrift || riskScore > 0) {
      riskLevel = 'REVIEW_REQUIRED';
      safeToAutoApply = false;
    } else {
      riskLevel = 'REVIEW_REQUIRED';
      safeToAutoApply = false;
    }
  }

  return {
    schema_version: SCHEMA_VERSION,
    files: resultFiles,
    risk_score: riskScore,
    risk_level: riskLevel,
    safe_to_auto_apply: safeToAutoApply,
    confidence: overallMinConfidence,
    summary: {
      changed_hunks: totalChangedHunks,
      safe_removals: safeRemovalsCount,
      behavior_changes: behaviorChangesCount,
      impacted_functions: totalImpactedFunctionsCount,
      max_blast_radius_score: maxBlastRadiusScore,
    },
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);
  let rawInput = '';
  
  if (args.length > 0 && args[0] === '--json') {
    process.stdin.on('data', (chunk) => { rawInput += chunk; });
    process.stdin.on('end', async () => {
      try {
        const payload = JSON.parse(rawInput);
        const res = await evaluateAIPatchFirewall(payload);
        console.log(JSON.stringify(res, null, 2));
      } catch (e) {
        console.log(JSON.stringify({ schema_version: SCHEMA_VERSION, error: e.message }));
      }
    });
  } else if (args.length > 0) {
    const targetFile = args[0];
    const candidateLine = args[1] ? args[1] : undefined;
    evaluateAIPatchFirewall({ file_path: targetFile, candidate_line: candidateLine })
      .then((res) => console.log(JSON.stringify(res, null, 2)));
  } else {
    console.log(JSON.stringify({ error: 'Usage: node ai_patch_firewall.js <file_path> [candidate_line]' }));
  }
}

module.exports = {
  evaluateAIPatchFirewall,
  parseUnifiedDiff,
};
