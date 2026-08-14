#!/usr/bin/env node
/**
 * Echo Nullity — Semantic Intent Drift Radar Engine CLI Wrapper
 */

const fs = require('fs');
const { analyzeSemanticIntentDrift } = require('./semantic_intent_drift');

const SCHEMA_VERSION = 1;

const args = process.argv.slice(2);
let rawInput = '';

if (args.length > 0 && args[0] === '--json') {
  process.stdin.on('data', (chunk) => { rawInput += chunk; });
  process.stdin.on('end', () => {
    try {
      const payload = JSON.parse(rawInput);
      const res = analyzeSemanticIntentDrift(payload);
      console.log(JSON.stringify(res, null, 2));
    } catch (e) {
      console.log(JSON.stringify({ schema_version: SCHEMA_VERSION, error: e.message }));
    }
  });
} else if (args.length >= 2) {
  const origFile = args[0];
  const editFile = args[1];
  const orig = fs.readFileSync(origFile, 'utf-8');
  const edit = fs.readFileSync(editFile, 'utf-8');
  const res = analyzeSemanticIntentDrift({ original_source: orig, edited_source: edit });
  console.log(JSON.stringify(res, null, 2));
} else {
  console.log(JSON.stringify({ error: 'Usage: node semantic_intent_drift.cli.js <orig_file> <edit_file>' }));
}
