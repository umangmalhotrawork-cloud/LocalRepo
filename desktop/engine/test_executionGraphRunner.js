const { execFileSync } = require('child_process');
const path = require('path');

console.log("[TEST] Running Execution Graph & Memory Flow Test Suite...");
try {
  const output = execFileSync('npx', ['tsx', path.join(__dirname, 'test_executionGraph.ts')], {
    encoding: 'utf8',
  });
  console.log(output);
} catch (err) {
  console.error('[TEST ERROR]', err.stdout || err.message);
  process.exit(1);
}
