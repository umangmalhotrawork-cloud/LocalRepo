/**
 * PACKAGED DISTRIBUTION VALIDATION TEST
 * Validates macOS .app bundle integrity, release metadata, archive extraction,
 * clean-install isolation, and security boundaries.
 */

const assert = require("assert");
const path = require("path");
const fs = require("fs");
const os = require("os");
const { execSync } = require("child_process");

let passed = 0;
function check(cond, msg) {
  assert.ok(cond, msg);
  passed++;
  console.log("  ✔ [PASS] " + msg);
}

async function runPackagedDistributionAudit() {
  console.log("==================================================");
  console.log("VALIDATING PACKAGED DISTRIBUTION BUNDLE");
  console.log("==================================================\n");

  const appDir = path.join(process.cwd(), "dist", "mac", "NEXUS.app");
  const contentsDir = path.join(appDir, "Contents");
  const macosDir = path.join(contentsDir, "MacOS");
  const appResourcesDir = path.join(contentsDir, "Resources", "app");
  const metadataFile = path.join(process.cwd(), "dist", "mac", "release-metadata.json");
  const tarballFile = path.join(process.cwd(), "dist", "mac", "NEXUS-mac-" + os.arch() + ".tar.gz");

  // 1. App Bundle Structure
  console.log("[1/5] Checking App Bundle Structure");
  check(fs.existsSync(appDir), "NEXUS.app exists");
  check(fs.existsSync(path.join(macosDir, "NEXUS")), "Executable launcher exists");
  check(fs.existsSync(path.join(contentsDir, "Info.plist")), "Info.plist exists");
  
  const plistContent = fs.readFileSync(path.join(contentsDir, "Info.plist"), "utf8");
  check(plistContent.includes("com.echonullity.ide"), "Info.plist contains valid bundle identifier");
  check(plistContent.includes("<key>CFBundleExecutable</key>"), "Info.plist contains executable key");

  // 2. Production Asset Resolution
  console.log("\n[2/5] Checking Production Assets & Preload");
  check(fs.existsSync(path.join(appResourcesDir, "out", "desktop.html")), "Static renderer desktop.html exists");
  check(fs.existsSync(path.join(appResourcesDir, "desktop", "electron", "main.js")), "Main process entry exists");
  check(fs.existsSync(path.join(appResourcesDir, "desktop", "electron", "preload.js")), "Preload script exists");
  check(fs.existsSync(path.join(appResourcesDir, "desktop", "electron", "harness", "worker-entry.js")), "Harness worker-entry.js exists");

  // 3. Test File Exclusion from Packaged Bundle
  console.log("\n[3/5] Verifying Test File Exclusion from Bundle");
  const packagedDesktop = path.join(appResourcesDir, "desktop");
  function findFiles(dir, matchPattern) {
    let results = [];
    if (!fs.existsSync(dir)) return results;
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const e of entries) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) {
        results = results.concat(findFiles(full, matchPattern));
      } else if (matchPattern.test(e.name)) {
        results.push(full);
      }
    }
    return results;
  }

  const testFilesFound = findFiles(packagedDesktop, /^test_.*\.js$/);
  check(testFilesFound.length === 0, "Zero test suites bundled inside packaged Resources/app");

  // 4. Release Metadata & Archive Integrity
  console.log("\n[4/5] Checking Release Metadata & Archive Integrity");
  check(fs.existsSync(metadataFile), "release-metadata.json exists");
  const metadata = JSON.parse(fs.readFileSync(metadataFile, "utf8"));
  check(metadata.productName === "NEXUS" && metadata.version === "1.0.0", "Metadata defines NEXUS v1.0.0");
  check(metadata.rendererAsset === "out/desktop.html", "Metadata points to static production asset");

  check(fs.existsSync(tarballFile), "Distribution archive tarball exists");
  const stat = fs.statSync(tarballFile);
  check(stat.size > 100000, "Archive tarball size is valid (" + Math.round(stat.size / 1024) + " KB)");

  // 5. Clean Archive Extraction
  console.log("\n[5/6] Testing Archive Extraction in Isolated Sandbox");
  const extractTestDir = path.join(os.tmpdir(), "nexus_extract_test_" + Date.now());
  fs.mkdirSync(extractTestDir, { recursive: true });
  try {
    execSync(`tar -xzf "${tarballFile}" -C "${extractTestDir}"`, { stdio: "pipe" });
    check(fs.existsSync(path.join(extractTestDir, "NEXUS.app")), "Extracted archive contains NEXUS.app");
    check(fs.existsSync(path.join(extractTestDir, "release-metadata.json")), "Extracted archive contains release-metadata.json");
  } finally {
    try {
      fs.rmSync(extractTestDir, { recursive: true, force: true });
    } catch (_) {}
  }

  // 6. Real Git Operations & Module Closure Smoke Test
  console.log("\n[6/6] Testing Packaged Git Subsystem & Module Closure");
  const simpleGitModule = require(path.join(appResourcesDir, "node_modules/simple-git"));
  check(typeof simpleGitModule === "function", "simple-git module loadable from packaged app");

  const pathspecModule = require(path.join(appResourcesDir, "node_modules/@simple-git/args-pathspec"));
  check(Boolean(pathspecModule), "@simple-git/args-pathspec transitive dependency loadable");

  const gitManagerModule = require(path.join(appResourcesDir, "desktop/electron/gitManager.js"));
  check(Boolean(gitManagerModule), "gitManager module loadable from packaged resources");

  const tmpRepo = path.join(os.tmpdir(), "packaged_git_verify_" + Date.now());
  fs.mkdirSync(tmpRepo, { recursive: true });
  const env = Object.assign({}, process.env, {
    GIT_CONFIG_GLOBAL: "/dev/null",
    GIT_CONFIG_SYSTEM: "/dev/null",
    GIT_CONFIG_NOSYSTEM: "1"
  });

  try {
    execSync("git init", { cwd: tmpRepo, env, stdio: "ignore" });
    execSync("git config user.name \"PackagedAudit\"", { cwd: tmpRepo, env, stdio: "ignore" });
    execSync("git config user.email \"audit@nexus.io\"", { cwd: tmpRepo, env, stdio: "ignore" });
    fs.writeFileSync(path.join(tmpRepo, "audit.txt"), "packaged audit verification\n");
    execSync("git add audit.txt && git commit -m \"Audit commit\"", { cwd: tmpRepo, env, stdio: "ignore" });

    const isRepo = await gitManagerModule.isRepo(tmpRepo);
    check(isRepo === true, "Packaged gitManager verified repository");

    const status = await gitManagerModule.getStatus(tmpRepo);
    check(status.isClean === true, "Packaged gitManager computed repository status");

    const branches = await gitManagerModule.getBranches(tmpRepo);
    check(branches.all.length > 0, "Packaged gitManager enumerated branch list");

    const history = await gitManagerModule.getCommitHistory(tmpRepo);
    check(history.commits.length === 1, "Packaged gitManager parsed commit history");
  } finally {
    try {
      fs.rmSync(tmpRepo, { recursive: true, force: true });
    } catch (_) {}
  }

  console.log("\n==================================================");
  console.log("PASSED ALL " + passed + " PACKAGED DISTRIBUTION CHECKS");
  console.log("==================================================\n");
}

runPackagedDistributionAudit().catch((err) => {
  console.error("Packaged Distribution Audit Failed:", err);
  process.exit(1);
});
