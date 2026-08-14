#!/usr/bin/env node
/**
 * Echo Nullity — Semantic Intent Drift Radar Engine (Milestone 25 Flagship)
 * 
 * Detects when an AI-generated edit preserves syntax and basic test passing
 * but silently alters the semantic intent or business logic of a function.
 */

const SCHEMA_VERSION = 1;

/**
 * Main Entry Point: Analyzes Semantic Intent Drift between Original and Edited source code.
 */
function analyzeSemanticIntentDrift(payload = {}) {
  const {
    original_source = '',
    edited_source = '',
    language = 'python',
    function_name = 'target_function',
  } = payload;

  const intentChanges = [];

  if (!original_source || !edited_source || original_source.trim() === edited_source.trim()) {
    return {
      schema_version: SCHEMA_VERSION,
      function_name,
      drift_score: 0.0,
      drift_level: 'NONE',
      intent_changes: [],
      confidence: 1.0,
      summary: 'No semantic intent drift detected. Original and edited functions are semantically aligned.',
    };
  }

  const isPython = language.toLowerCase() === 'python' || original_source.includes('def ');

  // Helper to extract function body (excluding parameter header line)
  const getBodySource = (src) => {
    const lines = src.split('\n');
    return lines.length > 1 ? lines.slice(1).join('\n') : src;
  };

  const origBody = getBodySource(original_source);
  const editBody = getBodySource(edited_source);

  // 1. Business-rule order drift (e.g. discount before tax, tax before shipping)
  const rules = [
    { nameA: 'discount', regexA: /discount|rebate|coupon/i, nameB: 'tax', regexB: /\btax\b|\bvat\b|\bgst\b|tax\s*=/i },
    { nameA: 'tax', regexA: /\btax\b|\bvat\b|\bgst\b|tax\s*=/i, nameB: 'shipping', regexB: /shipping|freight|delivery/i },
    { nameA: 'discount', regexA: /discount|rebate|coupon/i, nameB: 'shipping', regexB: /shipping|freight|delivery/i },
  ];

  for (const rule of rules) {
    const origA = origBody.search(rule.regexA);
    const origB = origBody.search(rule.regexB);
    const editA = editBody.search(rule.regexA);
    const editB = editBody.search(rule.regexB);

    if (origA !== -1 && origB !== -1 && editA !== -1 && editB !== -1) {
      const origOrder = origA < origB ? `${rule.nameA}_before_${rule.nameB}` : `${rule.nameB}_before_${rule.nameA}`;
      const editOrder = editA < editB ? `${rule.nameA}_before_${rule.nameB}` : `${rule.nameB}_before_${rule.nameA}`;

      if (origOrder !== editOrder) {
        intentChanges.push({
          type: 'BUSINESS_RULE',
          description: `Order of business rules altered: ${origOrder.replace(/_/g, ' ')} changed to ${editOrder.replace(/_/g, ' ')}`,
          severity: 'HIGH',
        });
      }
    }
  }

  // 2. Predicate polarity drift (> vs >=, < vs <=, == vs !=, and vs or)
  const countRegex = (src, regex) => (src.match(regex) || []).length;

  const compareOps = [
    { regex1: />=/g, regex2: />(?!=)/g, name1: '>=', name2: '>' },
    { regex1: /<=/g, regex2: /<(?!=)/g, name1: '<=', name2: '<' },
    { regex1: /==/g, regex2: /!=/g, name1: '==', name2: '!=' },
    { regex1: /\band\b/gi, regex2: /\bor\b/gi, name1: 'and', name2: 'or' },
    { regex1: /&&/g, regex2: /\|\|/g, name1: '&&', name2: '||' },
  ];

  for (const comp of compareOps) {
    const c1Orig = countRegex(original_source, comp.regex1);
    const c2Orig = countRegex(original_source, comp.regex2);
    const c1Edit = countRegex(edited_source, comp.regex1);
    const c2Edit = countRegex(edited_source, comp.regex2);

    if ((c1Orig > c1Edit && c2Orig < c2Edit) || (c1Orig < c1Edit && c2Orig > c2Edit)) {
      intentChanges.push({
        type: 'PREDICATE_POLARITY',
        description: `Predicate polarity altered: operator '${comp.name1}' changed to '${comp.name2}'`,
        severity: 'HIGH',
      });
    }
  }

  // 3. Default value drift (e.g. tax_rate=0.08 -> 0.10)
  const extractDefaults = (src) => {
    const defaults = {};
    const matches = src.matchAll(/([a-zA-Z0-9_]+)\s*=\s*([0-9.]+|"[\s\S]*?"|'[\s\S]*?'|None|True|False|null|true|false)/g);
    for (const m of matches) {
      defaults[m[1]] = m[2];
    }
    return defaults;
  };

  const origDefaults = extractDefaults(original_source);
  const editDefaults = extractDefaults(edited_source);

  for (const key of Object.keys(origDefaults)) {
    if (editDefaults[key] && origDefaults[key] !== editDefaults[key]) {
      // Only flag if parameter is likely a default argument or setting
      if (['tax_rate', 'discount_rate', 'limit', 'timeout', 'rate', 'multiplier', 'default_code', 'threshold'].includes(key)) {
        intentChanges.push({
          type: 'DEFAULT_VALUE',
          description: `Default parameter value drift for '${key}': ${origDefaults[key]} changed to ${editDefaults[key]}`,
          severity: 'MEDIUM',
        });
      }
    }
  }

  // 4. Aggregation semantic drift (sum -> max, sum -> min, etc.)
  const aggFuncs = ['sum', 'max', 'min', 'avg', 'reduce'];
  for (const agg of aggFuncs) {
    if (original_source.includes(`${agg}(`) && !edited_source.includes(`${agg}(`)) {
      const replacement = aggFuncs.find((other) => other !== agg && edited_source.includes(`${other}(`));
      if (replacement) {
        intentChanges.push({
          type: 'AGGREGATION_SEMANTIC',
          description: `Aggregation function altered: '${agg}' changed to '${replacement}'`,
          severity: 'HIGH',
        });
      }
    }
  }

  // 5. Exception policy drift (raise -> return fallback or vice versa)
  const origRaises = /raise\s+|throw\s+/i.test(original_source);
  const editRaises = /raise\s+|throw\s+/i.test(edited_source);

  if (origRaises && !editRaises) {
    intentChanges.push({
      type: 'EXCEPTION_POLICY',
      description: 'Exception policy drift: Exception raising removed in favor of silent return fallback',
      severity: 'HIGH',
    });
  } else if (!origRaises && editRaises) {
    intentChanges.push({
      type: 'EXCEPTION_POLICY',
      description: 'Exception policy drift: Exception raising introduced replacing silent fallback',
      severity: 'HIGH',
    });
  }

  // 6. Rounding / precision drift
  const origRoundIdx = original_source.indexOf('round(');
  const editRoundIdx = edited_source.indexOf('round(');

  if (origRoundIdx !== -1 && editRoundIdx !== -1) {
    const origSumIdx = original_source.search(/sum\(|max\(|min\(|\+|\-|\*|\//);
    const editSumIdx = edited_source.search(/sum\(|max\(|min\(|\+|\-|\*|\//);

    const origRoundBeforeOp = origRoundIdx < origSumIdx;
    const editRoundBeforeOp = editRoundIdx < editSumIdx;

    if (origRoundBeforeOp !== editRoundBeforeOp || original_source.indexOf('round(') !== edited_source.indexOf('round(')) {
      // Check if round wraps sum/expression in edited but not in original
      const origWraps = /round\s*\(\s*(sum|max|min|[a-zA-Z0-9_]+\s*[\+\-\*\/])/i.test(original_source);
      const editWraps = /round\s*\(\s*(sum|max|min|[a-zA-Z0-9_]+\s*[\+\-\*\/])/i.test(edited_source);

      if (origWraps !== editWraps || origRoundBeforeOp !== editRoundBeforeOp) {
        intentChanges.push({
          type: 'ROUNDING_PRECISION',
          description: 'Rounding precision drift: Rounding operation moved prior to aggregation/subtotal calculation',
          severity: 'HIGH',
        });
      }
    }
  } else if (origRoundIdx !== -1 && editRoundIdx === -1) {
    intentChanges.push({
      type: 'ROUNDING_PRECISION',
      description: 'Rounding precision drift: Explicit rounding operation removed',
      severity: 'MEDIUM',
    });
  }

  // 7. Unit / scaling drift (e.g. / 100 vs / 1000 or * 100)
  const origDiv100 = original_source.includes('/ 100') || original_source.includes('/100');
  const editDiv1000 = edited_source.includes('/ 1000') || edited_source.includes('/1000');
  const origMult100 = original_source.includes('* 100');
  const editMult1000 = edited_source.includes('* 1000');

  if ((origDiv100 && editDiv1000) || (origMult100 && editMult1000)) {
    intentChanges.push({
      type: 'UNIT_SCALING',
      description: 'Unit scaling drift: Scaling factor magnitude changed (e.g. percentage ↔ per-thousand scaling mismatch)',
      severity: 'HIGH',
    });
  }

  // Compute Drift Score & Level
  let totalScore = 0;
  for (const ic of intentChanges) {
    if (ic.severity === 'HIGH') totalScore += 0.50;
    else if (ic.severity === 'MEDIUM') totalScore += 0.25;
    else totalScore += 0.10;
  }

  const driftScore = Math.min(1.0, Math.round(totalScore * 100) / 100);

  let driftLevel = 'NONE';
  const hasHighChange = intentChanges.some((ic) => ic.severity === 'HIGH');
  if (hasHighChange || driftScore >= 0.50) driftLevel = 'HIGH';
  else if (driftScore >= 0.25) driftLevel = 'MEDIUM';
  else if (driftScore > 0.0) driftLevel = 'LOW';

  const confidence = 0.94;
  let summary = 'No semantic intent drift detected. Original and edited functions are semantically aligned.';

  if (driftLevel === 'HIGH') {
    summary = 'HIGH SEMANTIC DRIFT DETECTED: Function behavior appears semantically altered despite structural similarity.';
  } else if (driftLevel === 'MEDIUM') {
    summary = 'MODERATE SEMANTIC DRIFT: Business logic parameters or precision rules were modified.';
  } else if (driftLevel === 'LOW') {
    summary = 'MINOR SEMANTIC DRIFT: Low severity code drift detected.';
  }

  return {
    schema_version: SCHEMA_VERSION,
    function_name,
    drift_score: driftScore,
    drift_level: driftLevel,
    intent_changes: intentChanges,
    confidence,
    summary,
  };
}

module.exports = {
  analyzeSemanticIntentDrift,
};
