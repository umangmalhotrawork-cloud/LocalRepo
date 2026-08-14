#!/usr/bin/env node
/**
 * Echo Nullity — Counterfactual Execution Engine (Milestone 22 Flagship)
 * 
 * Given an original source file and a candidate statement or edited source,
 * materializes both the Original World and Counterfactual World in isolated temporary storage,
 * executes both worlds with strict timeouts, captures return values, exceptions, stdout/stderr,
 * process exit codes, compares behavioral observation matrices, and computes deterministic
 * equivalence scores and safety confidence.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const child_process = require('child_process');
const { compareBehavioralFingerprints } = require('./behavior_compare');
const { generateJSBehavioralFingerprint } = require('./js_behavior_fingerprint');

const SCHEMA_VERSION = 1;

/**
 * Generate behavioral fingerprint for a given file path.
 * Supports both JS/TS (via js_behavior_fingerprint) and Python (via behavior_fingerprint.py).
 */
function generateFingerprintForFile(filePath) {
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

    const enginePath = path.join(__dirname, 'behavior_fingerprint.py');
    child_process.execFile('python3', [enginePath, filePath], { maxBuffer: 10 * 1024 * 1024, timeout: 15000 }, (error, stdout, stderr) => {
      if (error && !stdout) {
        return resolve({ error: stderr || error.message, functions: [] });
      }
      try {
        resolve(JSON.parse(stdout));
      } catch (e) {
        resolve({ error: 'Failed to parse Python fingerprint JSON output', functions: [] });
      }
    });
  });
}

/**
 * Executes a script file to capture raw process execution output:
 * exit code, stdout, stderr, duration, timed out flag.
 */
function executeRawScript(filePath, timeoutSec = 5) {
  return new Promise((resolve) => {
    const isJS = filePath.match(/\.(js|jsx|ts|tsx)$/i);
    const cmd = isJS ? 'node' : 'python3';
    const start = Date.now();

    child_process.execFile(cmd, [filePath], { timeout: timeoutSec * 1000, maxBuffer: 5 * 1024 * 1024 }, (error, stdout, stderr) => {
      const duration_ms = Date.now() - start;
      const timedOut = error && error.killed && error.signal === 'SIGTERM';
      const exitCode = error ? (error.code || 1) : 0;

      resolve({
        exit_code: exitCode,
        stdout: stdout || '',
        stderr: stderr || '',
        duration_ms,
        timed_out: timedOut || false,
        error: error ? error.message : null,
      });
    });
  });
}

/**
 * Removes specified candidate line(s) from source code string.
 * Supports line numbers (e.g. 9 or "9-12"), 1-indexed.
 */
function produceCounterfactualSource(sourceCode, candidateLine) {
  if (!sourceCode) return '';
  if (candidateLine === undefined || candidateLine === null) return sourceCode;

  const lines = sourceCode.split('\n');
  let linesToRemove = new Set();

  if (typeof candidateLine === 'number') {
    linesToRemove.add(candidateLine);
  } else if (typeof candidateLine === 'string') {
    if (candidateLine.includes('-')) {
      const [startStr, endStr] = candidateLine.split('-');
      const start = parseInt(startStr.trim(), 10);
      const end = parseInt(endStr.trim(), 10);
      if (!isNaN(start) && !isNaN(end)) {
        for (let i = start; i <= end; i++) {
          linesToRemove.add(i);
        }
      }
    } else {
      const parsed = parseInt(candidateLine.trim(), 10);
      if (!isNaN(parsed)) {
        linesToRemove.add(parsed);
      }
    }
  } else if (Array.isArray(candidateLine)) {
    candidateLine.forEach((l) => linesToRemove.add(Number(l)));
  }

  const filtered = lines.filter((_, idx) => !linesToRemove.has(idx + 1));
  return filtered.join('\n');
}

/**
 * Main Entry Point: Computes Counterfactual Execution Analysis
 */
async function computeCounterfactualAnalysis(payload = {}) {
  const { original_path, edited_source, candidate_line, workspace_graph } = payload;

  if (!original_path || !fs.existsSync(original_path)) {
    return {
      schema_version: SCHEMA_VERSION,
      error: `Original file not found: ${original_path}`,
      equivalence_score: 0.0,
      safe_to_remove: false,
      changed_observations: 0,
      confidence: 0.0,
      trace_diff: [],
    };
  }

  const isJS = original_path.match(/\.(js|jsx|ts|tsx)$/i);
  const ext = isJS ? '.js' : '.py';
  const timestamp = Date.now();
  const rand = Math.random().toString(36).substring(2, 8);

  const tempOrigFile = path.join(os.tmpdir(), `echonullity_cf_orig_${timestamp}_${rand}${ext}`);
  const tempEditFile = path.join(os.tmpdir(), `echonullity_cf_edit_${timestamp}_${rand}${ext}`);

  let originalSource = '';
  try {
    originalSource = fs.readFileSync(original_path, 'utf-8');
  } catch (err) {
    return {
      schema_version: SCHEMA_VERSION,
      error: `Failed to read original source: ${err.message}`,
      equivalence_score: 0.0,
      safe_to_remove: false,
      changed_observations: 0,
      confidence: 0.0,
      trace_diff: [],
    };
  }

  // Determine counterfactual source
  let cfSource = edited_source;
  if (cfSource === undefined || cfSource === null) {
    cfSource = produceCounterfactualSource(originalSource, candidate_line);
  }

  try {
    // 1. Write original and counterfactual source to temporary files
    fs.writeFileSync(tempOrigFile, originalSource, 'utf-8');
    fs.writeFileSync(tempEditFile, cfSource, 'utf-8');

    // 2. Execute raw process run to capture exit code, stdout/stderr, durations
    const [rawOrigExec, rawEditExec] = await Promise.all([
      executeRawScript(tempOrigFile),
      executeRawScript(tempEditFile),
    ]);

    // 3. Generate behavioral fingerprints for both worlds
    const [fpA, fpB] = await Promise.all([
      generateFingerprintForFile(tempOrigFile),
      generateFingerprintForFile(tempEditFile),
    ]);

    // 4. Compare behavioral fingerprints
    const diffResult = compareBehavioralFingerprints(fpA, fpB);

    const totalObs = diffResult.summary?.total_observations || 0;
    const changedObs = diffResult.summary?.changed_observations || 0;

    // Check stdout/stderr/exit code diffs
    const exitMatch = rawOrigExec.exit_code === rawEditExec.exit_code;
    const stdoutMatch = rawOrigExec.stdout === rawEditExec.stdout;
    const stderrMatch = rawOrigExec.stderr === rawEditExec.stderr;
    const rawMatch = exitMatch && stdoutMatch && stderrMatch;

    // Determine safety & equivalence score
    const safe_to_remove = changedObs === 0 && (diffResult.severity === 'NO_CHANGE' || !diffResult.severity);
    
    let equivalence_score = 1.0;
    if (totalObs > 0) {
      equivalence_score = parseFloat(((totalObs - changedObs) / totalObs).toFixed(4));
    }

    let confidence = 0.0;
    if (safe_to_remove) {
      confidence = totalObs >= 5 ? 1.0 : 0.99;
    } else {
      confidence = Math.max(0.0, parseFloat((equivalence_score * 0.8).toFixed(2)));
    }

    // Build detailed trace diff
    const trace_diff = [];
    
    // Add raw process execution diff if any
    if (!rawMatch) {
      trace_diff.push({
        type: 'process_execution',
        description: `Raw process execution difference: Exit Code (${rawOrigExec.exit_code} vs ${rawEditExec.exit_code}), Stdout Match: ${stdoutMatch}, Stderr Match: ${stderrMatch}`,
        original_world: { exit_code: rawOrigExec.exit_code, stdout: rawOrigExec.stdout, stderr: rawOrigExec.stderr, duration_ms: rawOrigExec.duration_ms },
        counterfactual_world: { exit_code: rawEditExec.exit_code, stdout: rawEditExec.stdout, stderr: rawEditExec.stderr, duration_ms: rawEditExec.duration_ms },
      });
    }

    // Add function behavioral diffs
    const changedFns = [
      ...(diffResult.changed_functions || []),
      ...(diffResult.added_functions || []),
      ...(diffResult.removed_functions || []),
    ];

    for (const fn of changedFns) {
      trace_diff.push({
        type: 'function_behavior',
        name: fn.name,
        severity: fn.severity || 'HIGH',
        description: fn.description || `Behavioral diff in function '${fn.name}'`,
        differences: fn.differences || [],
      });
    }

    return {
      schema_version: SCHEMA_VERSION,
      original_path,
      candidate_line: candidate_line || null,
      equivalence_score,
      safe_to_remove,
      changed_observations: changedObs,
      total_observations: totalObs,
      confidence,
      severity: diffResult.severity || (safe_to_remove ? 'NO_CHANGE' : 'HIGH'),
      trace_diff,
      original_world: {
        file_path: tempOrigFile,
        raw_execution: rawOrigExec,
        functions_count: fpA.functions_count || (fpA.functions ? fpA.functions.length : 0),
      },
      counterfactual_world: {
        file_path: tempEditFile,
        raw_execution: rawEditExec,
        functions_count: fpB.functions_count || (fpB.functions ? fpB.functions.length : 0),
      },
      summary: {
        exit_code_match: exitMatch,
        stdout_match: stdoutMatch,
        stderr_match: stderrMatch,
        diff_functions_count: changedFns.length,
      },
    };
  } catch (err) {
    return {
      schema_version: SCHEMA_VERSION,
      error: `Counterfactual engine error: ${err.message}`,
      equivalence_score: 0.0,
      safe_to_remove: false,
      changed_observations: 0,
      confidence: 0.0,
      trace_diff: [],
    };
  } finally {
    // 5. Clean up temporary files
    [tempOrigFile, tempEditFile].forEach((f) => {
      if (fs.existsSync(f)) {
        try {
          fs.unlinkSync(f);
        } catch (e) {}
      }
    });
  }
}

if (require.main === module) {
  const args = process.argv.slice(2);
  let rawInput = '';
  
  if (args.length > 0 && args[0] === '--json') {
    process.stdin.on('data', (chunk) => { rawInput += chunk; });
    process.stdin.on('end', async () => {
      try {
        const payload = JSON.parse(rawInput);
        const res = await computeCounterfactualAnalysis(payload);
        console.log(JSON.stringify(res, null, 2));
      } catch (e) {
        console.log(JSON.stringify({ schema_version: SCHEMA_VERSION, error: e.message }));
      }
    });
  } else if (args.length > 0) {
    const targetFile = args[0];
    const candidateLine = args[1] ? args[1] : undefined;
    computeCounterfactualAnalysis({ original_path: targetFile, candidate_line: candidateLine })
      .then((res) => console.log(JSON.stringify(res, null, 2)));
  } else {
    console.log(JSON.stringify({ error: 'Usage: node counterfactual_engine.js <original_path> [candidate_line]' }));
  }
}

module.exports = {
  computeCounterfactualAnalysis,
  produceCounterfactualSource,
  executeRawScript,
};
