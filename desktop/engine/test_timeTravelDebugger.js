const { execFileSync } = require('child_process');
const path = require('path');

console.log("[TEST] Running Time-Travel Debugger v2 Test Suite...");
try {
  const output = execFileSync('npx', ['tsx', path.join(__dirname, '../runtime/test_pythonTimeTravelDebugger.ts')], {
    encoding: 'utf8',
  });
  console.log(output);
} catch (err) {
  console.error('[TEST ERROR]', err.stdout || err.message);
  process.exit(1);
}
