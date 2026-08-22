/**
 * DETERMINISTIC PRODUCTION DEPENDENCY PACKAGER
 * Uses `npm list --omit=dev --all --parseable` to copy the complete, transitive
 * production dependency closure from node_modules into the packaged application bundle,
 * strictly excluding development dependencies and test fixtures.
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

function copyProductionDependencies(targetAppDir) {
  const targetNodeModules = path.join(targetAppDir, "node_modules");
  fs.mkdirSync(targetNodeModules, { recursive: true });

  const rootDir = process.cwd();
  const rootNodeModules = path.join(rootDir, "node_modules");

  const raw = execSync("npm list --omit=dev --all --parseable", { encoding: "utf8", cwd: rootDir });
  const lines = raw.trim().split("\n").filter(Boolean);

  let count = 0;
  for (const line of lines) {
    if (line === rootDir) continue;
    const rel = path.relative(rootNodeModules, line);
    const dest = path.join(targetNodeModules, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.cpSync(line, dest, { recursive: true, dereference: false });
    count++;
  }

  console.log(`[PACKAGING] Successfully copied ${count} production dependency packages into ${targetNodeModules}`);
}

if (require.main === module) {
  const target = process.argv[2];
  if (!target) {
    console.error("Usage: node scripts/copy-production-dependencies.js <target-app-dir>");
    process.exit(1);
  }
  copyProductionDependencies(path.resolve(target));
}

module.exports = { copyProductionDependencies };
