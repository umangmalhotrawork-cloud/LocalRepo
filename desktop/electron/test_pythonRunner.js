const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

async function main() {
  console.log("[TEST] Starting Python Execution & Output Pipeline Test Suite...");

  const tempDir = path.join(__dirname, '..', '..', 'scratch', 'test_py_run');
  fs.mkdirSync(tempDir, { recursive: true });

  // TEST 1: Successful Python execution
  const okScript = path.join(tempDir, 'ok_script.py');
  fs.writeFileSync(okScript, 'print("Echo Nullity test successful")\n', 'utf-8');

  let stdoutData = "";
  let stderrData = "";
  let exitCode = null;

  await new Promise((resolve) => {
    const child = spawn("python3", [okScript], { cwd: tempDir, env: process.env });
    child.stdout.on('data', (data) => { stdoutData += data.toString(); });
    child.stderr.on('data', (data) => { stderrData += data.toString(); });
    child.on('close', (code) => { exitCode = code; resolve(); });
  });

  console.log(`[TEST 1] Standard script execution: stdout="${stdoutData.trim()}", exitCode=${exitCode}`);
  if (stdoutData.trim() !== "Echo Nullity test successful" || exitCode !== 0) {
    throw new Error("Test 1 failed: Expected 'Echo Nullity test successful' and exitCode 0");
  }

  // TEST 2: Python script with error / traceback
  const errScript = path.join(tempDir, 'err_script.py');
  fs.writeFileSync(errScript, 'def foo()\n', 'utf-8'); // Syntax error

  let errStdout = "";
  let errStderr = "";
  let errExitCode = null;

  await new Promise((resolve) => {
    const child = spawn("python3", [errScript], { cwd: tempDir, env: process.env });
    child.stdout.on('data', (data) => { errStdout += data.toString(); });
    child.stderr.on('data', (data) => { errStderr += data.toString(); });
    child.on('close', (code) => { errExitCode = code; resolve(); });
  });

  console.log(`[TEST 2] Syntax error script execution: stderrContainsSyntaxError=${errStderr.includes("SyntaxError")}, exitCode=${errExitCode}`);
  if (!errStderr.includes("SyntaxError") || errExitCode === 0) {
    throw new Error("Test 2 failed: Expected SyntaxError in stderr and non-zero exit code");
  }

  // TEST 3: Progressive streaming verification
  const streamScript = path.join(tempDir, 'stream_script.py');
  fs.writeFileSync(streamScript, 'import time\nprint("Line 1")\nprint("Line 2")\n', 'utf-8');

  const chunks = [];
  await new Promise((resolve) => {
    const child = spawn("python3", ['-u', streamScript], { cwd: tempDir, env: process.env });
    child.stdout.on('data', (chunk) => { chunks.push(chunk.toString()); });
    child.on('close', resolve);
  });

  // TEST 4: Hard Test for LINE 1, LINE 2, LINE 3
  const hardScript = path.join(tempDir, 'test.py');
  fs.writeFileSync(hardScript, "print('LINE 1')\nprint('LINE 2')\nprint('LINE 3')\n", 'utf-8');

  let hardStdout = "";
  let hardExitCode = null;
  await new Promise((resolve) => {
    const child = spawn("python3", ['-u', hardScript], { cwd: tempDir, env: { ...process.env, PYTHONUNBUFFERED: '1' } });
    child.stdout.on('data', (data) => { hardStdout += data.toString(); });
    child.on('close', (code) => { hardExitCode = code; resolve(); });
  });

  const lines = hardStdout.trim().split("\n");
  console.log(`[TEST 4] Hard test output lines: count=${lines.length}, content=${JSON.stringify(lines)}`);
  if (lines.length !== 3 || lines[0] !== "LINE 1" || lines[1] !== "LINE 2" || lines[2] !== "LINE 3") {
    throw new Error(`Test 4 failed: Expected LINE 1, LINE 2, LINE 3. Got: ${JSON.stringify(lines)}`);
  }

  // Cleanup temp files
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (e) {}

  console.log("\n>>> ALL PYTHON RUNNER TESTS PASSED SUCCESSFULLY! <<<\n");
}

main().catch((err) => {
  console.error("[TEST ERROR]", err);
  process.exit(1);
});
