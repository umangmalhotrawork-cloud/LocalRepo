#!/usr/bin/env node
/**
 * Echo Nullity — Repository-Scale Patch Firewall Engine (Milestone 24)
 * 
 * Analyzes an entire repository-level git diff / pull request across multiple files
 * and hunks, invoking single-file counterfactual & blast radius evaluations, and
 * aggregated risk scoring into a deterministic merge recommendation (ALLOW, REVIEW, BLOCK).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const { parseUnifiedDiff, evaluateAIPatchFirewall } = require('./ai_patch_firewall');

const SCHEMA_VERSION = 1;

/**
 * Main Entry Point: Evaluates a Repository-Scale Patch against Safety Firewall
 */
async function evaluateRepositoryPatchFirewall(payload = {}) {
  const {
    patch_text = '',
    repository_path = process.cwd(),
    workspace_graph = null,
    max_depth = 3,
  } = payload;

  const parsedFiles = parseUnifiedDiff(patch_text);

  const affectedFiles = [];
  const allHunkResults = [];

  let totalFilesAnalyzed = 0;
  let totalHunksAnalyzed = 0;
  let riskyHunksCount = 0;
  let safeHunksCount = 0;
  let maxBlastRadiusScore = 0;
  let globalMaxRiskScore = 0;
  let hasHighRiskHunk = false;
  let hasBehaviorChange = false;

  if (parsedFiles.length === 0) {
    return {
      schema_version: SCHEMA_VERSION,
      repository_path,
      files_analyzed: 0,
      hunks_analyzed: 0,
      risky_hunks: 0,
      safe_hunks: 0,
      affected_files: [],
      top_risky_hunks: [],
      max_blast_radius_score: 0,
      risk_score: 0,
      risk_level: 'AUTO_APPROVE',
      merge_recommendation: 'ALLOW',
      safe_to_auto_apply: true,
    };
  }

  totalFilesAnalyzed = parsedFiles.length;

  for (const fileObj of parsedFiles) {
    const rawFilePath = fileObj.file_path;
    const absFilePath = path.isAbsolute(rawFilePath)
      ? rawFilePath
      : path.join(repository_path, rawFilePath);

    let fileSafeHunks = 0;
    let fileRiskyHunks = 0;
    let fileMaxBlastScore = 0;
    const evaluatedHunks = [];

    for (const hunk of fileObj.hunks) {
      totalHunksAnalyzed++;
      const lineRange = `${hunk.start_line}-${hunk.end_line}`;

      // Single-file firewall evaluation for this hunk
      const hunkEval = await evaluateAIPatchFirewall({
        file_path: absFilePath,
        candidate_line: lineRange,
        workspace_graph,
        max_depth,
      });

      const hunkFileRes = hunkEval.files && hunkEval.files[0] ? hunkEval.files[0].hunks[0] : null;
      const cfData = hunkFileRes ? hunkFileRes.counterfactual : { safe_to_remove: false, equivalence_score: 0.0, confidence: 0.0, trace_diff: [] };
      const blastData = hunkFileRes ? hunkFileRes.blast_radius : { blast_radius_score: 0, root_changed_functions: [], impacted_functions: [] };

      const isSafe = cfData.safe_to_remove;
      const blastScore = blastData.blast_radius_score || 0;
      fileMaxBlastScore = Math.max(fileMaxBlastScore, blastScore);
      maxBlastRadiusScore = Math.max(maxBlastRadiusScore, blastScore);

      let hunkRiskLevel = hunkEval.risk_level || (isSafe ? 'SAFE_REMOVE' : 'REVIEW_REQUIRED');
      let hunkRiskScore = hunkEval.risk_score !== undefined ? hunkEval.risk_score : (isSafe ? 0 : 50);

      if (isSafe) {
        safeHunksCount++;
        fileSafeHunks++;
      } else {
        riskyHunksCount++;
        fileRiskyHunks++;
        hasBehaviorChange = true;
      }

      if (hunkRiskLevel === 'HIGH_RISK' || hunkRiskScore >= 60) {
        hasHighRiskHunk = true;
      }

      globalMaxRiskScore = Math.max(globalMaxRiskScore, hunkRiskScore);

      const hunkRecord = {
        file_path: rawFilePath,
        abs_file_path: absFilePath,
        hunk_index: hunk.hunk_index,
        start_line: hunk.start_line,
        end_line: hunk.end_line,
        original_code: hunk.removed_lines.join('\n'),
        edited_code: hunk.added_lines.join('\n'),
        risk_level: hunkRiskLevel,
        risk_score: hunkRiskScore,
        equivalence_score: cfData.equivalence_score,
        safe_to_remove: isSafe,
        confidence: cfData.confidence || 1.0,
        blast_radius_score: blastScore,
        impacted_functions_count: blastData.impacted_functions ? blastData.impacted_functions.length : 0,
        counterfactual: cfData,
        blast_radius: blastData,
      };

      evaluatedHunks.push(hunkRecord);
      allHunkResults.push(hunkRecord);
    }

    affectedFiles.push({
      file_path: rawFilePath,
      abs_file_path: absFilePath,
      hunks_count: fileObj.hunks.length,
      safe_hunks_count: fileSafeHunks,
      risky_hunks_count: fileRiskyHunks,
      max_blast_score: fileMaxBlastScore,
      hunks: evaluatedHunks,
    });
  }

  // Sort top risky hunks deterministically by risk_score descending, then file_path ascending
  const topRiskyHunks = [...allHunkResults].sort((a, b) => {
    if (b.risk_score !== a.risk_score) return b.risk_score - a.risk_score;
    if (b.blast_radius_score !== a.blast_radius_score) return b.blast_radius_score - a.blast_radius_score;
    return a.file_path.localeCompare(b.file_path);
  });

  // Determine Merge Recommendation & Aggregated Risk
  let mergeRecommendation = 'ALLOW';
  let aggregatedRiskLevel = 'AUTO_APPROVE';
  let safeToAutoApply = true;

  if (hasHighRiskHunk || maxBlastRadiusScore >= 5 || globalMaxRiskScore >= 60) {
    mergeRecommendation = 'BLOCK';
    aggregatedRiskLevel = 'HIGH_RISK';
    safeToAutoApply = false;
  } else if (hasBehaviorChange || riskyHunksCount > 0) {
    mergeRecommendation = 'REVIEW';
    aggregatedRiskLevel = 'REVIEW_REQUIRED';
    safeToAutoApply = false;
  } else if (safeHunksCount > 0) {
    mergeRecommendation = 'ALLOW';
    aggregatedRiskLevel = 'SAFE_REMOVE';
    safeToAutoApply = true;
  } else {
    mergeRecommendation = 'ALLOW';
    aggregatedRiskLevel = 'AUTO_APPROVE';
    safeToAutoApply = true;
  }

  return {
    schema_version: SCHEMA_VERSION,
    repository_path,
    files_analyzed: totalFilesAnalyzed,
    hunks_analyzed: totalHunksAnalyzed,
    risky_hunks: riskyHunksCount,
    safe_hunks: safeHunksCount,
    affected_files: affectedFiles,
    top_risky_hunks: topRiskyHunks,
    max_blast_radius_score: maxBlastRadiusScore,
    risk_score: globalMaxRiskScore,
    risk_level: aggregatedRiskLevel,
    merge_recommendation: mergeRecommendation,
    safe_to_auto_apply: safeToAutoApply,
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
        const res = await evaluateRepositoryPatchFirewall(payload);
        console.log(JSON.stringify(res, null, 2));
      } catch (e) {
        console.log(JSON.stringify({ schema_version: SCHEMA_VERSION, error: e.message }));
      }
    });
  } else if (args.length > 0) {
    const diffFile = args[0];
    const repoPath = args[1] ? args[1] : process.cwd();
    let diffText = '';
    try {
      if (fs.existsSync(diffFile)) diffText = fs.readFileSync(diffFile, 'utf-8');
    } catch (e) {}

    evaluateRepositoryPatchFirewall({ patch_text: diffText, repository_path: repoPath })
      .then((res) => console.log(JSON.stringify(res, null, 2)));
  } else {
    console.log(JSON.stringify({ error: 'Usage: node repository_patch_firewall.js <diff_file_path> [repo_path]' }));
  }
}

module.exports = {
  evaluateRepositoryPatchFirewall,
};
