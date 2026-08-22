#!/usr/bin/env bash
set -e

echo "=================================================="
echo "=== Building NEXUS for Linux (Tarball & Bundle) =="
echo "=================================================="

# 1. Build production web bundle
echo "[1/4] Running next build (static export)..."
npm run build

# 2. Package Linux Application Structure
echo "[2/4] Creating Linux distribution directory structure..."
APP_DIR="dist/linux/NEXUS-linux-x64"
RESOURCES_APP_DIR="${APP_DIR}/resources/app"

rm -rf "dist/linux"
mkdir -p "${APP_DIR}"
mkdir -p "${RESOURCES_APP_DIR}"

# 3. Copy bundled assets and source modules
echo "[3/4] Copying production assets, harness, and runtime modules..."
cp package.json "${RESOURCES_APP_DIR}/"
cp -R out "${RESOURCES_APP_DIR}/"
cp -R desktop "${RESOURCES_APP_DIR}/"

# Exclude test suites and test fixtures from production bundle
find "${RESOURCES_APP_DIR}/desktop" -name "test_*.js" -delete
find "${RESOURCES_APP_DIR}/desktop" -name "*.test.js" -delete
find "${RESOURCES_APP_DIR}/desktop" -name "*.test.ts" -delete
find "${RESOURCES_APP_DIR}/desktop" -name "*.test.tsx" -delete

if [ -f "package-lock.json" ]; then
  cp package-lock.json "${RESOURCES_APP_DIR}/"
fi

# Copy full production runtime dependency closure
node scripts/copy-production-dependencies.js "${RESOURCES_APP_DIR}"

# Ensure native spawn-helper binaries have executable permissions
find node_modules/node-pty -name "spawn-helper" -exec chmod 0755 {} + 2>/dev/null || true

# Create executable launcher script
cat << 'LAUNCHER' > "${APP_DIR}/nexus"
#!/usr/bin/env bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_PATH="$(cd "${DIR}/resources/app" && pwd)"
export NODE_ENV=production
if command -v electron >/dev/null 2>&1; then
  exec electron "${APP_PATH}" "$@"
elif [ -f "${APP_PATH}/node_modules/.bin/electron" ]; then
  exec "${APP_PATH}/node_modules/.bin/electron" "${APP_PATH}" "$@"
else
  exec node "${APP_PATH}/desktop/electron/main.js" "$@"
fi
LAUNCHER
chmod 0755 "${APP_DIR}/nexus"

# 4. Generate Release Metadata & Archive
echo "[4/4] Generating release metadata & distribution archive..."
BUILD_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

cat << METADATA > dist/linux/release-metadata.json
{
  "productName": "NEXUS",
  "version": "1.0.0",
  "releaseChannel": "beta",
  "platform": "linux",
  "architecture": "x64",
  "electronVersion": "33.2.1",
  "buildTimestamp": "${BUILD_TIMESTAMP}",
  "bundleId": "com.echonullity.ide",
  "mainEntry": "desktop/electron/main.js",
  "workerEntry": "desktop/electron/harness/worker-entry.js",
  "rendererAsset": "out/desktop.html"
}
METADATA

tar -czf dist/linux/NEXUS-linux-x64.tar.gz -C dist/linux NEXUS-linux-x64 release-metadata.json

echo "=================================================="
echo "Linux packaging complete!"
echo "App Directory: ${APP_DIR}"
echo "Archive:       dist/linux/NEXUS-linux-x64.tar.gz"
echo "Metadata:      dist/linux/release-metadata.json"
echo "=================================================="

