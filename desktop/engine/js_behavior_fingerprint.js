#!/usr/bin/env node
/**
 * Echo Nullity — JavaScript & TypeScript Behavioral Fingerprint Engine (Phase 2)
 * Discovers JS/TS functions using TypeScript Compiler API, executes them in isolated Node subprocesses,
 * normalizes outputs/exceptions, calculates canonical SHA-256 fingerprint hashes, and provides fingerprint comparisons.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const child_process = require('child_process');
const ts = require('typescript');

const SCHEMA_VERSION = 1;
const DEFAULT_TIMEOUT_MS = 2000;

/**
 * Normalizes JS values into JSON-safe deterministic representations.
 */
function normalizeValue(val) {
  if (val === null) return { type: 'null', value: null };
  if (val === undefined) return { type: 'undefined', value: null };
  if (typeof val === 'boolean') return { type: 'boolean', value: val };
  if (typeof val === 'number') {
    if (!Number.isFinite(val)) return { type: 'number', value: String(val) };
    return { type: 'number', value: Math.round(val * 1e6) / 1e6 };
  }
  if (typeof val === 'string') return { type: 'string', value: val };
  if (Array.isArray(val)) return { type: 'array', value: val.map(normalizeValue) };
  if (typeof val === 'object') {
    try {
      const normalizedObj = {};
      for (const k of Object.keys(val).sort()) {
        normalizedObj[k] = normalizeValue(val[k]);
      }
      return { type: 'object', value: normalizedObj };
    } catch (e) {
      return { type: 'unsupported', value: String(val) };
    }
  }
  return { type: 'unsupported', value: String(val) };
}

/**
 * Computes canonical SHA-256 fingerprint hash for function observations.
 */
function computeFingerprintHash(observations) {
  const canonicalObs = observations.map((obs) => ({
    input: obs.input,
    status: obs.status,
    output: obs.output || null,
    exception_type: obs.exception_type || null,
    message: obs.message || null,
  }));

  const serialized = JSON.stringify(canonicalObs);
  return crypto.createHash('sha256').update(serialized).digest('hex').substring(0, 16);
}

/**
 * Discovers function declarations, arrow functions, and function expressions using TypeScript Compiler API.
 */
function discoverFunctions(filePath, code) {
  const scriptKind = filePath.endsWith('.tsx')
    ? ts.ScriptKind.TSX
    : filePath.endsWith('.ts')
    ? ts.ScriptKind.TS
    : filePath.endsWith('.jsx')
    ? ts.ScriptKind.JSX
    : ts.ScriptKind.JS;

  const sourceFile = ts.createSourceFile(filePath, code, ts.ScriptTarget.Latest, true, scriptKind);
  const lines = code.split('\n');
  const functions = [];

  function getLineInfo(node) {
    const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
    const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd());
    return {
      line: start.line + 1,
      end_line: end.line + 1,
    };
  }

  function visit(node) {
    // 1. Standard Function Declarations: function foo(a, b) {}
    if (ts.isFunctionDeclaration(node) && node.name) {
      const name = node.name.getText(sourceFile);
      const lineInfo = getLineInfo(node);
      const params = node.parameters.map((p) => p.name.getText(sourceFile));
      const fnCode = lines.slice(lineInfo.line - 1, lineInfo.end_line).join('\n');
      const fnHash = crypto.createHash('sha256').update(fnCode).digest('hex').substring(0, 16);

      functions.push({
        name,
        line: lineInfo.line,
        end_line: lineInfo.end_line,
        parameters: params,
        param_count: params.length,
        source_hash: fnHash,
      });
    }

    // 2. Const/Var Variable Statements with Arrow Functions or Function Expressions
    if (ts.isVariableStatement(node)) {
      for (const decl of node.declarationList.declarations) {
        if (decl.name && ts.isIdentifier(decl.name) && decl.initializer) {
          if (ts.isArrowFunction(decl.initializer) || ts.isFunctionExpression(decl.initializer)) {
            const name = decl.name.getText(sourceFile);
            const lineInfo = getLineInfo(node);
            const params = decl.initializer.parameters.map((p) => p.name.getText(sourceFile));
            const fnCode = lines.slice(lineInfo.line - 1, lineInfo.end_line).join('\n');
            const fnHash = crypto.createHash('sha256').update(fnCode).digest('hex').substring(0, 16);

            functions.push({
              name,
              line: lineInfo.line,
              end_line: lineInfo.end_line,
              parameters: params,
              param_count: params.length,
              source_hash: fnHash,
            });
          }
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  functions.sort((a, b) => a.line - b.line);
  return functions;
}

/**
 * Generates a bounded, deterministic candidate input matrix for parameters.
 */
function generateInputMatrix(paramCount) {
  if (paramCount === 0) return [[]];

  if (paramCount === 1) {
    return [[0], [1], [-1], [10], ['test'], [''], [true], [false], [[1, 2]], [null]];
  }

  if (paramCount === 2) {
    const inputs = [];
    const p1 = [0, 1, 10, 'test'];
    const p2 = [0, 1, 'test', true];
    for (const v1 of p1) {
      for (const v2 of p2) {
        inputs.push([v1, v2]);
      }
    }
    return inputs;
  }

  return [
    new Array(paramCount).fill(0),
    new Array(paramCount).fill(1),
    new Array(paramCount).fill(10),
    new Array(paramCount).fill('test'),
    new Array(paramCount).fill(true),
  ];
}

/**
 * Executes a target JS/TS function with candidate arguments in an isolated Node child process.
 */
function executeFunctionIsolated(filePath, code, functionName, argsList, timeoutMs = DEFAULT_TIMEOUT_MS) {
  const isTS = filePath.endsWith('.ts') || filePath.endsWith('.tsx');

  // Transpile TS code to CommonJS JS if necessary
  let jsCode = code;
  if (isTS) {
    const transpileRes = ts.transpileModule(code, {
      compilerOptions: {
        module: ts.ModuleKind.CommonJS,
        target: ts.ScriptTarget.ES2022,
        jsx: ts.JsxEmit.React,
      },
    });
    jsCode = transpileRes.outputText;
  }

  // Write isolated runner script to a temporary file
  const runnerScript = `
const path = require('path');

const codeToRun = ${JSON.stringify(jsCode)};
const functionName = ${JSON.stringify(functionName)};
const argsList = ${JSON.stringify(argsList)};

try {
  const moduleObj = { exports: {} };
  const wrapper = new Function('module', 'exports', 'require', '__filename', '__dirname', codeToRun);
  wrapper(moduleObj, moduleObj.exports, require, ${JSON.stringify(filePath)}, ${JSON.stringify(path.dirname(filePath))});
  
  let targetFn = moduleObj.exports[functionName] || moduleObj.exports.default?.[functionName];
  if (!targetFn && typeof globalThis[functionName] === 'function') {
    targetFn = globalThis[functionName];
  }
  
  if (!targetFn) {
    const evalScope = new Function('argsList', codeToRun + '\\nif (typeof ' + functionName + ' === "function") { return ' + functionName + '(...argsList); } else { throw new Error("Function " + ' + JSON.stringify(functionName) + ' + " not found"); }');
    const res = evalScope(argsList);
    console.log('RESULT_JSON:' + JSON.stringify({ status: 'success', result: res }));
    process.exit(0);
  }

  const res = targetFn(...argsList);
  console.log('RESULT_JSON:' + JSON.stringify({ status: 'success', result: res }));
  process.exit(0);
} catch (err) {
  console.log('RESULT_JSON:' + JSON.stringify({
    status: 'exception',
    exception_type: err.name || 'Error',
    message: err.message || String(err)
  }));
  process.exit(1);
}
`;

  const tempFile = path.join(os.tmpdir(), `echonullity_runner_${Date.now()}_${Math.random().toString(36).substr(2, 6)}.js`);
  fs.writeFileSync(tempFile, runnerScript, 'utf-8');

  const startTime = Date.now();
  try {
    const nodeExecutable = process.versions.electron
      ? (process.env.npm_node_execpath || process.env.NODE_BINARY || 'node')
      : process.execPath;
    const output = child_process.execFileSync(nodeExecutable, [tempFile], {
      timeout: timeoutMs,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    const durationMs = Date.now() - startTime;
    for (const line of output.split('\n')) {
      if (line.startsWith('RESULT_JSON:')) {
        const payload = JSON.parse(line.substring(12));
        if (payload.status === 'success') {
          return {
            input: argsList.map(normalizeValue),
            status: 'success',
            output: normalizeValue(payload.result),
            duration_ms: durationMs,
          };
        } else {
          return {
            input: argsList.map(normalizeValue),
            status: 'exception',
            exception_type: payload.exception_type || 'Error',
            message: payload.message || 'Runtime exception',
            duration_ms: durationMs,
          };
        }
      }
    }

    return {
      input: argsList.map(normalizeValue),
      status: 'exception',
      exception_type: 'ExecutionError',
      message: 'No output returned from function runner',
      duration_ms: durationMs,
    };
  } catch (err) {
    const durationMs = Date.now() - startTime;
    if (err.code === 'ETIMEDOUT' || err.killed) {
      return {
        input: argsList.map(normalizeValue),
        status: 'timeout',
        message: `Execution timed out after ${timeoutMs / 1000}s`,
        duration_ms: durationMs,
      };
    }

    if (err.stdout) {
      for (const line of err.stdout.split('\n')) {
        if (line.startsWith('RESULT_JSON:')) {
          const payload = JSON.parse(line.substring(12));
          return {
            input: argsList.map(normalizeValue),
            status: 'exception',
            exception_type: payload.exception_type || 'Error',
            message: payload.message || 'Runtime exception',
            duration_ms: durationMs,
          };
        }
      }
    }

    return {
      input: argsList.map(normalizeValue),
      status: 'exception',
      exception_type: err.name || 'Error',
      message: err.message || String(err),
      duration_ms: durationMs,
    };
  } finally {
    if (fs.existsSync(tempFile)) {
      try {
        fs.unlinkSync(tempFile);
      } catch (e) {}
    }
  }
}

/**
 * Generates a complete Behavioral Fingerprint for a JS/TS source file.
 */
function generateJSBehavioralFingerprint(filePath) {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    return {
      error: `File not found: ${filePath}`,
      schema_version: SCHEMA_VERSION,
      file_path: filePath,
      functions: [],
    };
  }

  const code = fs.readFileSync(absPath, 'utf-8');
  const fileHash = crypto.createHash('sha256').update(code).digest('hex').substring(0, 16);
  const discovered = discoverFunctions(absPath, code);
  const isTS = absPath.endsWith('.ts') || absPath.endsWith('.tsx');
  const language = isTS ? 'typescript' : 'javascript';

  const fnFingerprints = [];

  for (const fn of discovered) {
    const inputMatrix = generateInputMatrix(fn.param_count);
    const observations = [];

    for (const argsTuple of inputMatrix) {
      const obs = executeFunctionIsolated(absPath, code, fn.name, argsTuple);
      observations.push(obs);
    }

    const fnHash = computeFingerprintHash(observations);
    fnFingerprints.push({
      name: fn.name,
      line: fn.line,
      end_line: fn.end_line,
      parameters: fn.parameters,
      param_count: fn.param_count,
      source_hash: fn.source_hash,
      observations_count: observations.length,
      success_count: observations.filter((o) => o.status === 'success').length,
      exception_count: observations.filter((o) => o.status === 'exception').length,
      timeout_count: observations.filter((o) => o.status === 'timeout').length,
      observations,
      fingerprint_hash: fnHash,
    });
  }

  return {
    schema_version: SCHEMA_VERSION,
    file_path: absPath,
    file_name: path.basename(absPath),
    language,
    source_hash: fileHash,
    functions_count: fnFingerprints.length,
    functions: fnFingerprints,
    generated_at: new Date().toISOString(),
  };
}

/**
 * Compares two Behavioral Fingerprints and returns a structured diff.
 */
function compareFingerprints(fpA, fpB) {
  const funcsA = new Map((fpA.functions || []).map((f) => [f.name, f]));
  const funcsB = new Map((fpB.functions || []).map((f) => [f.name, f]));

  const allNames = Array.from(new Set([...funcsA.keys(), ...funcsB.keys()])).sort();
  const differences = [];
  let totalObs = 0;
  let changedObs = 0;

  for (const name of allNames) {
    const fA = funcsA.get(name);
    const fB = funcsB.get(name);

    if (!fA) {
      differences.push({
        function: name,
        type: 'added_function',
        description: `Function '${name}' added in second fingerprint`,
      });
      continue;
    }

    if (!fB) {
      differences.push({
        function: name,
        type: 'removed_function',
        description: `Function '${name}' removed in second fingerprint`,
      });
      continue;
    }

    const obsA = fA.observations || [];
    const obsB = fB.observations || [];
    totalObs += Math.max(obsA.length, obsB.length);

    const mapA = new Map(obsA.map((o) => [JSON.stringify(o.input), o]));
    const mapB = new Map(obsB.map((o) => [JSON.stringify(o.input), o]));

    for (const [inpStr, oA] of mapA.entries()) {
      const oB = mapB.get(inpStr);
      if (!oB) {
        changedObs++;
        differences.push({
          function: name,
          type: 'missing_observation',
          input: oA.input,
          description: `Observation for input ${inpStr} missing in target fingerprint`,
        });
        continue;
      }

      const statusA = oA.status;
      const statusB = oB.status;
      const outputA = JSON.stringify(oA.output);
      const outputB = JSON.stringify(oB.output);

      if (statusA !== statusB || outputA !== outputB) {
        changedObs++;
        differences.push({
          function: name,
          type: 'behavior_change',
          input: oA.input,
          status_a: statusA,
          status_b: statusB,
          output_a: oA.output,
          output_b: oB.output,
          message_a: oA.message,
          message_b: oB.message,
          description: `Function '${name}' behavior changed for input ${inpStr}`,
        });
      }
    }
  }

  const unchangedObs = Math.max(0, totalObs - changedObs);

  return {
    changed: differences.length > 0,
    total_observations: totalObs,
    changed_observations: changedObs,
    unchanged_observations: unchangedObs,
    differences_count: differences.length,
    differences,
  };
}

if (require.main === module) {
  const args = process.argv.slice(2);

  if (args[0] === '--json') {
    let raw = '';
    process.stdin.on('data', (chunk) => {
      raw += chunk;
    });
    process.stdin.on('end', () => {
      try {
        const payload = JSON.parse(raw);
        if (payload.cmd === 'compare') {
          const res = compareFingerprints(payload.fingerprint_a || {}, payload.fingerprint_b || {});
          console.log(JSON.stringify(res, null, 2));
        } else {
          const res = generateJSBehavioralFingerprint(payload.file_path || payload.file);
          console.log(JSON.stringify(res, null, 2));
        }
      } catch (e) {
        console.log(JSON.stringify({ error: `JSON stdin decode error: ${e.message}` }));
      }
    });
  } else if (args[0] === '--compare' && args.length >= 3) {
    const fpA = generateJSBehavioralFingerprint(args[1]);
    const fpB = generateJSBehavioralFingerprint(args[2]);
    const res = compareFingerprints(fpA, fpB);
    console.log(JSON.stringify(res, null, 2));
  } else if (args[0]) {
    const res = generateJSBehavioralFingerprint(args[0]);
    console.log(JSON.stringify(res, null, 2));
  } else {
    console.log(JSON.stringify({ error: 'No file path provided' }));
  }
}

module.exports = {
  generateJSBehavioralFingerprint,
  discoverFunctions,
  generateInputMatrix,
  normalizeValue,
  computeFingerprintHash,
  compareFingerprints,
};
