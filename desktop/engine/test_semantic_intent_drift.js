const assert = require('assert');
const { analyzeSemanticIntentDrift } = require('./semantic_intent_drift');

console.log('[TEST-INTENT-RADAR] Starting Milestone 25 Semantic Intent Drift Test Suite...');

function runTests() {
  // -------------------------------------------------------------
  // Test 1: No drift
  // -------------------------------------------------------------
  const orig1 = `def calc(subtotal, tax_rate=0.08):\n    discount = subtotal * 0.10\n    tax = (subtotal - discount) * tax_rate\n    return round(subtotal - discount + tax, 2)\n`;
  const res1 = analyzeSemanticIntentDrift({
    original_source: orig1,
    edited_source: orig1,
  });
  assert.strictEqual(res1.drift_score, 0.0);
  assert.strictEqual(res1.drift_level, 'NONE');
  assert.strictEqual(res1.intent_changes.length, 0);
  console.log('✓ Test 1 Passed: No drift (drift_score = 0.0, NONE)');

  // -------------------------------------------------------------
  // Test 2: Discount order drift
  // -------------------------------------------------------------
  const edit2 = `def calc(subtotal, tax_rate=0.08):\n    tax = subtotal * tax_rate\n    discount = (subtotal + tax) * 0.10\n    return round(subtotal + tax - discount, 2)\n`;
  const res2 = analyzeSemanticIntentDrift({
    original_source: orig1,
    edited_source: edit2,
  });
  assert(res2.intent_changes.some((c) => c.type === 'BUSINESS_RULE'));
  assert.strictEqual(res2.drift_level, 'HIGH');
  console.log('✓ Test 2 Passed: Discount order drift detected (BUSINESS_RULE, HIGH)');

  // -------------------------------------------------------------
  // Test 3: Tax order drift
  // -------------------------------------------------------------
  const orig3 = `def calc(subtotal):\n    tax = subtotal * 0.08\n    shipping = 10.0 if tax > 5 else 0.0\n    return subtotal + tax + shipping\n`;
  const edit3 = `def calc(subtotal):\n    shipping = 10.0 if subtotal > 5 else 0.0\n    tax = (subtotal + shipping) * 0.08\n    return subtotal + tax + shipping\n`;
  const res3 = analyzeSemanticIntentDrift({
    original_source: orig3,
    edited_source: edit3,
  });
  assert(res3.intent_changes.some((c) => c.type === 'BUSINESS_RULE'));
  console.log('✓ Test 3 Passed: Tax order drift detected');

  // -------------------------------------------------------------
  // Test 4: Predicate drift
  // -------------------------------------------------------------
  const orig4 = `def check(age):\n    if age >= 18:\n        return True\n    return False\n`;
  const edit4 = `def check(age):\n    if age > 18:\n        return True\n    return False\n`;
  const res4 = analyzeSemanticIntentDrift({
    original_source: orig4,
    edited_source: edit4,
  });
  assert(res4.intent_changes.some((c) => c.type === 'PREDICATE_POLARITY'));
  console.log('✓ Test 4 Passed: Predicate polarity drift detected (>= vs >)');

  // -------------------------------------------------------------
  // Test 5: Default value drift
  // -------------------------------------------------------------
  const orig5 = `def calc(items, tax_rate=0.08):\n    return sum(items) * (1 + tax_rate)\n`;
  const edit5 = `def calc(items, tax_rate=0.10):\n    return sum(items) * (1 + tax_rate)\n`;
  const res5 = analyzeSemanticIntentDrift({
    original_source: orig5,
    edited_source: edit5,
  });
  assert(res5.intent_changes.some((c) => c.type === 'DEFAULT_VALUE'));
  console.log('✓ Test 5 Passed: Default value drift detected (tax_rate=0.08 vs 0.10)');

  // -------------------------------------------------------------
  // Test 6: Aggregation drift
  // -------------------------------------------------------------
  const orig6 = `def calc(items):\n    return sum(items)\n`;
  const edit6 = `def calc(items):\n    return max(items)\n`;
  const res6 = analyzeSemanticIntentDrift({
    original_source: orig6,
    edited_source: edit6,
  });
  assert(res6.intent_changes.some((c) => c.type === 'AGGREGATION_SEMANTIC'));
  assert.strictEqual(res6.drift_level, 'HIGH');
  console.log('✓ Test 6 Passed: Aggregation drift detected (sum -> max)');

  // -------------------------------------------------------------
  // Test 7: Exception policy drift
  // -------------------------------------------------------------
  const orig7 = `def calc(items):\n    if not items:\n        raise ValueError("empty")\n    return sum(items)\n`;
  const edit7 = `def calc(items):\n    if not items:\n        return 0\n    return sum(items)\n`;
  const res7 = analyzeSemanticIntentDrift({
    original_source: orig7,
    edited_source: edit7,
  });
  assert(res7.intent_changes.some((c) => c.type === 'EXCEPTION_POLICY'));
  console.log('✓ Test 7 Passed: Exception policy drift detected (raise -> return 0)');

  // -------------------------------------------------------------
  // Test 8: Rounding drift
  // -------------------------------------------------------------
  const orig8 = `def calc(items):\n    subtotal = sum(items)\n    return round(subtotal, 2)\n`;
  const edit8 = `def calc(items):\n    subtotal = round(sum(items), 2)\n    return subtotal\n`;
  const res8 = analyzeSemanticIntentDrift({
    original_source: orig8,
    edited_source: edit8,
  });
  assert(res8.intent_changes.some((c) => c.type === 'ROUNDING_PRECISION'));
  console.log('✓ Test 8 Passed: Rounding precision drift detected');

  // -------------------------------------------------------------
  // Test 9: Unit scaling drift
  // -------------------------------------------------------------
  const orig9 = `def calc(amount):\n    return amount / 100\n`;
  const edit9 = `def calc(amount):\n    return amount / 1000\n`;
  const res9 = analyzeSemanticIntentDrift({
    original_source: orig9,
    edited_source: edit9,
  });
  assert(res9.intent_changes.some((c) => c.type === 'UNIT_SCALING'));
  console.log('✓ Test 9 Passed: Unit scaling drift detected (/ 100 vs / 1000)');

  // -------------------------------------------------------------
  // Test 10: JS function drift
  // -------------------------------------------------------------
  const orig10 = `function processOrder(price, tax_rate = 0.08) {\n  if (price <= 0) throw new Error("invalid");\n  return price * (1 + tax_rate);\n}\n`;
  const edit10 = `function processOrder(price, tax_rate = 0.08) {\n  if (price < 0) return 0;\n  return price * (1 + tax_rate);\n}\n`;
  const res10 = analyzeSemanticIntentDrift({
    original_source: orig10,
    edited_source: edit10,
    language: 'javascript',
  });
  assert(res10.intent_changes.length > 0);
  console.log('✓ Test 10 Passed: JS function drift detected');

  // -------------------------------------------------------------
  // Test 11: Deterministic output
  // -------------------------------------------------------------
  const res11A = analyzeSemanticIntentDrift({ original_source: orig1, edited_source: edit2 });
  const res11B = analyzeSemanticIntentDrift({ original_source: orig1, edited_source: edit2 });
  assert.strictEqual(res11A.drift_score, res11B.drift_score);
  assert.strictEqual(res11A.drift_level, res11B.drift_level);
  console.log('✓ Test 11 Passed: Deterministic output');

  // -------------------------------------------------------------
  // Test 12: Malformed source handling
  // -------------------------------------------------------------
  const res12 = analyzeSemanticIntentDrift({ original_source: '', edited_source: null });
  assert.strictEqual(res12.schema_version, 1);
  assert.strictEqual(res12.drift_score, 0.0);
  console.log('✓ Test 12 Passed: Malformed source handling');

  console.log('\nALL 12 MILESTONE 25 SEMANTIC INTENT DRIFT TESTS PASSED PERFECTLY!\n');
}

runTests();
