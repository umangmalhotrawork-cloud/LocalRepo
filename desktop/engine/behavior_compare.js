#!/usr/bin/env node
/**
 * Echo Nullity — Phase 3A: Cross-Version Behavioral Comparison Engine
 * Implements deterministic multi-level behavioral comparison across two Behavioral Fingerprint Version 1 objects.
 */

const fs = require('fs');
const path = require('path');

const SCHEMA_VERSION = 1;

/**
 * Normalizes language string for compatibility check.
 */
function getNormalizedLanguage(fp) {
  if (!fp || typeof fp !== 'object') return 'unknown';
  const lang = (fp.language || '').toLowerCase();
  if (lang.includes('python') || (fp.file_path && fp.file_path.endsWith('.py'))) return 'python';
  if (lang.includes('typescript') || (fp.file_path && (fp.file_path.endsWith('.ts') || fp.file_path.endsWith('.tsx')))) return 'typescript';
  if (lang.includes('javascript') || (fp.file_path && (fp.file_path.endsWith('.js') || fp.file_path.endsWith('.jsx')))) return 'javascript';
  return lang || 'unknown';
}

/**
 * Compares two JS objects for equality.
 */
function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Performs Phase 3A Multi-Level Cross-Version Behavioral Comparison.
 */
function compareBehavioralFingerprints(fpA, fpB) {
  if (!fpA || typeof fpA !== 'object' || !fpB || typeof fpB !== 'object') {
    return {
      schema_version: SCHEMA_VERSION,
      compatible: false,
      error: 'Invalid or malformed fingerprint objects supplied to comparison engine.',
    };
  }

  const langA = getNormalizedLanguage(fpA);
  const langB = getNormalizedLanguage(fpB);

  // Cross-Language Compatibility Guard
  if (langA !== langB && langA !== 'unknown' && langB !== 'unknown') {
    // Treat JavaScript and TypeScript as compatible JS ecosystem
    const isEcosystemA = langA === 'javascript' || langA === 'typescript';
    const isEcosystemB = langB === 'javascript' || langB === 'typescript';

    if (!(isEcosystemA && isEcosystemB)) {
      return {
        schema_version: SCHEMA_VERSION,
        compatible: false,
        reason: `Cross-language semantic comparison is not supported in Phase 3A. (${langA} vs ${langB})`,
        language_a: langA,
        language_b: langB,
      };
    }
  }

  const funcsA = new Map((fpA.functions || []).map((f) => [f.name, f]));
  const funcsB = new Map((fpB.functions || []).map((f) => [f.name, f]));

  const allNames = Array.from(new Set([...funcsA.keys(), ...funcsB.keys()])).sort();

  const addedFunctions = [];
  const removedFunctions = [];
  const changedFunctions = [];
  const unchangedFunctions = [];

  let totalObservations = 0;
  let changedObservations = 0;
  let hasHighSeverity = false;
  let hasMediumSeverity = false;
  let hasLowSeverity = false;

  for (const name of allNames) {
    const fA = funcsA.get(name);
    const fB = funcsB.get(name);

    // LEVEL 1: Function Existence (Added)
    if (!fA) {
      hasHighSeverity = true;
      addedFunctions.push({
        name,
        line: fB.line,
        end_line: fB.end_line,
        parameters: fB.parameters,
        param_count: fB.param_count,
        observations_count: fB.observations_count,
        fingerprint_hash: fB.fingerprint_hash,
        type: 'added_function',
        description: `Function '${name}' added in Version B (${fB.param_count} params, ${fB.observations_count} observations).`,
      });
      continue;
    }

    // LEVEL 1: Function Existence (Removed)
    if (!fB) {
      hasHighSeverity = true;
      removedFunctions.push({
        name,
        line: fA.line,
        end_line: fA.end_line,
        parameters: fA.parameters,
        param_count: fA.param_count,
        observations_count: fA.observations_count,
        fingerprint_hash: fA.fingerprint_hash,
        type: 'removed_function',
        description: `Function '${name}' removed in Version B (previously ${fA.observations_count} observations).`,
      });
      continue;
    }

    // Retained Function - Compare Level 2 (Coverage) & Levels 3,4,5 (Observations)
    const obsA = fA.observations || [];
    const obsB = fB.observations || [];
    totalObservations += Math.max(obsA.length, obsB.length);

    const mapA = new Map(obsA.map((o) => [JSON.stringify(o.input), o]));
    const mapB = new Map(obsB.map((o) => [JSON.stringify(o.input), o]));

    const allInputs = Array.from(new Set([...mapA.keys(), ...mapB.keys()])).sort();
    const differences = [];
    let fnCoverageChange = null;

    if (obsA.length !== obsB.length) {
      const type = obsB.length < obsA.length ? 'coverage_reduction' : 'coverage_expansion';
      fnCoverageChange = {
        type,
        observations_a: obsA.length,
        observations_b: obsB.length,
        description: `Observation candidate count changed from ${obsA.length} in Version A to ${obsB.length} in Version B.`,
      };
      if (type === 'coverage_reduction') hasMediumSeverity = true;
      else hasLowSeverity = true;
    }

    for (const inpStr of allInputs) {
      const oA = mapA.get(inpStr);
      const oB = mapB.get(inpStr);

      if (!oA) {
        changedObservations++;
        hasLowSeverity = true;
        differences.push({
          type: 'input_added',
          input: oB.input,
          status_a: null,
          status_b: oB.status,
          output_a: null,
          output_b: oB.output || null,
          description: `New input candidate evaluated in Version B for '${name}': ${inpStr}`,
        });
        continue;
      }

      if (!oB) {
        changedObservations++;
        hasMediumSeverity = true;
        differences.push({
          type: 'input_removed',
          input: oA.input,
          status_a: oA.status,
          status_b: null,
          output_a: oA.output || null,
          output_b: null,
          description: `Input candidate missing in Version B evaluation for '${name}': ${inpStr}`,
        });
        continue;
      }

      // Both observations exist — compare statuses & outputs
      const statusA = oA.status;
      const statusB = oB.status;
      const sameOutput = deepEqual(oA.output, oB.output);

      if (statusA === statusB && sameOutput) {
        continue; // Unchanged observation
      }

      changedObservations++;

      // Level 3: Success ➔ Success Output Change
      if (statusA === 'success' && statusB === 'success' && !sameOutput) {
        hasLowSeverity = true;
        differences.push({
          type: 'output_change',
          input: oA.input,
          status_a: statusA,
          status_b: statusB,
          output_a: oA.output,
          output_b: oB.output,
          description: `Function '${name}' changed output for input ${inpStr} (Before: ${JSON.stringify(oA.output?.value)}, After: ${JSON.stringify(oB.output?.value)}).`,
        });
      }
      // Level 4: Success ➔ Exception
      else if (statusA === 'success' && statusB === 'exception') {
        hasHighSeverity = true;
        differences.push({
          type: 'success_to_exception',
          input: oA.input,
          status_a: statusA,
          status_b: statusB,
          output_a: oA.output,
          output_b: null,
          exception_b: oB.exception_type,
          message_b: oB.message,
          description: `Function '${name}' changed from returning ${JSON.stringify(oA.output?.value)} to raising ${oB.exception_type} ("${oB.message}") for input ${inpStr}.`,
        });
      }
      // Level 4: Exception ➔ Success
      else if (statusA === 'exception' && statusB === 'success') {
        hasHighSeverity = true;
        differences.push({
          type: 'exception_to_success',
          input: oA.input,
          status_a: statusA,
          status_b: statusB,
          output_a: null,
          output_b: oB.output,
          exception_a: oA.exception_type,
          message_a: oA.message,
          description: `Function '${name}' changed from raising ${oA.exception_type} ("${oA.message}") to returning ${JSON.stringify(oB.output?.value)} for input ${inpStr}.`,
        });
      }
      // Level 4: Exception ➔ Exception (different error)
      else if (statusA === 'exception' && statusB === 'exception') {
        hasMediumSeverity = true;
        differences.push({
          type: 'exception_to_exception',
          input: oA.input,
          status_a: statusA,
          status_b: statusB,
          exception_a: oA.exception_type,
          exception_b: oB.exception_type,
          message_a: oA.message,
          message_b: oB.message,
          description: `Function '${name}' exception changed from ${oA.exception_type} ("${oA.message}") to ${oB.exception_type} ("${oB.message}") for input ${inpStr}.`,
        });
      }
      // Level 5: Success ➔ Timeout
      else if (statusA === 'success' && statusB === 'timeout') {
        hasHighSeverity = true;
        differences.push({
          type: 'success_to_timeout',
          input: oA.input,
          status_a: statusA,
          status_b: statusB,
          output_a: oA.output,
          output_b: null,
          description: `Function '${name}' timed out in Version B for input ${inpStr} (previously returned ${JSON.stringify(oA.output?.value)}).`,
        });
      }
      // Level 5: Timeout ➔ Success
      else if (statusA === 'timeout' && statusB === 'success') {
        hasHighSeverity = true;
        differences.push({
          type: 'timeout_to_success',
          input: oA.input,
          status_a: statusA,
          status_b: statusB,
          output_a: null,
          output_b: oB.output,
          description: `Function '${name}' recovered from timeout in Version A to returning ${JSON.stringify(oB.output?.value)} for input ${inpStr}.`,
        });
      }
      // Fallback transition
      else {
        hasMediumSeverity = true;
        differences.push({
          type: 'status_change',
          input: oA.input,
          status_a: statusA,
          status_b: statusB,
          output_a: oA.output || null,
          output_b: oB.output || null,
          description: `Function '${name}' behavioral status changed from ${statusA} to ${statusB} for input ${inpStr}.`,
        });
      }
    }

    if (differences.length > 0 || fnCoverageChange) {
      changedFunctions.push({
        name,
        line_a: fA.line,
        line_b: fB.line,
        param_count_a: fA.param_count,
        param_count_b: fB.param_count,
        hash_a: fA.fingerprint_hash,
        hash_b: fB.fingerprint_hash,
        differences_count: differences.length,
        coverage_change: fnCoverageChange,
        differences,
      });
    } else {
      unchangedFunctions.push({
        name,
        line: fA.line,
        param_count: fA.param_count,
        observations_count: obsA.length,
        fingerprint_hash: fA.fingerprint_hash,
      });
    }
  }

  // Level 6: Overall Severity Classification
  let severity = 'NO_CHANGE';
  if (hasHighSeverity) severity = 'HIGH';
  else if (hasMediumSeverity) severity = 'MEDIUM';
  else if (hasLowSeverity || changedFunctions.length > 0) severity = 'LOW';

  const unchangedObservations = Math.max(0, totalObservations - changedObservations);

  return {
    schema_version: SCHEMA_VERSION,
    compatible: true,
    language: langA || 'python',
    severity,
    version_a: {
      file_name: fpA.file_name || path.basename(fpA.file_path || 'Version A'),
      file_path: fpA.file_path || '',
      source_hash: fpA.source_hash || '',
      functions_count: funcsA.size,
    },
    version_b: {
      file_name: fpB.file_name || path.basename(fpB.file_path || 'Version B'),
      file_path: fpB.file_path || '',
      source_hash: fpB.source_hash || '',
      functions_count: funcsB.size,
    },
    summary: {
      total_functions_a: funcsA.size,
      total_functions_b: funcsB.size,
      added_functions_count: addedFunctions.length,
      removed_functions_count: removedFunctions.length,
      changed_functions_count: changedFunctions.length,
      unchanged_functions_count: unchangedFunctions.length,
      total_observations: totalObservations,
      changed_observations: changedObservations,
      unchanged_observations: unchangedObservations,
    },
    added_functions: addedFunctions,
    removed_functions: removedFunctions,
    changed_functions: changedFunctions,
    unchanged_functions: unchangedFunctions,
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
      const res = compareBehavioralFingerprints(payload.fingerprint_a || payload.fpA, payload.fingerprint_b || payload.fpB);
      console.log(JSON.stringify(res, null, 2));
    } catch (e) {
      console.log(JSON.stringify({ schema_version: SCHEMA_VERSION, compatible: false, error: `JSON stdin decode error: ${e.message}` }));
    }
  });
}

module.exports = { compareBehavioralFingerprints };
