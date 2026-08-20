#!/usr/bin/env bash
set -e

echo "=================================================="
echo "=== Building NEXUS for macOS (DMG & App Bundle) ==="
echo "=================================================="

# 1. Build production web bundle (Static Next.js export to out/)
echo "[1/5] Running next build (static export)..."
npm run build

# 2. Package Electron App Structure
echo "[2/5] Creating macOS .app bundle directory structure..."
APP_DIR="dist/mac/NEXUS.app"
CONTENTS_DIR="${APP_DIR}/Contents"
MACOS_DIR="${CONTENTS_DIR}/MacOS"
RESOURCES_APP_DIR="${CONTENTS_DIR}/Resources/app"

rm -rf "dist/mac"
mkdir -p "${MACOS_DIR}"
mkdir -p "${RESOURCES_APP_DIR}"

# 3. Create Info.plist
echo "[3/5] Generating Info.plist..."
cat << 'INFO_PLIST' > "${CONTENTS_DIR}/Info.plist"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>NEXUS</string>
    <key>CFBundleIdentifier</key>
    <string>com.echonullity.ide</string>
    <key>CFBundleName</key>
    <string>NEXUS</string>
    <key>CFBundleDisplayName</key>
    <string>NEXUS</string>
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0-beta</string>
    <key>CFBundlePackageType</key>
    <string>APPL</string>
    <key>CFBundleSignature</key>
    <string>????</string>
    <key>LSMinimumSystemVersion</key>
    <string>11.0.0</string>
    <key>NSHighResolutionCapable</key>
    <true/>
</dict>
</plist>
INFO_PLIST

# 4. Copy bundled assets and source modules
echo "[4/5] Copying production assets, harness, and runtime modules..."
cp package.json "${RESOURCES_APP_DIR}/"
cp -R out "${RESOURCES_APP_DIR}/"
cp -R desktop "${RESOURCES_APP_DIR}/"

# Copy package-lock.json if available
if [ -f "package-lock.json" ]; then
  cp package-lock.json "${RESOURCES_APP_DIR}/"
fi

# Ensure native spawn-helper binaries have executable permissions
find node_modules/node-pty -name "spawn-helper" -exec chmod 0755 {} + 2>/dev/null || true

# Create executable launcher script
cat << 'LAUNCHER' > "${MACOS_DIR}/NEXUS"
#!/usr/bin/env bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_PATH="$(cd "${DIR}/../Resources/app" && pwd)"
export NODE_ENV=production
if command -v electron >/dev/null 2>&1; then
  exec electron "${APP_PATH}" "$@"
elif [ -f "${APP_PATH}/node_modules/.bin/electron" ]; then
  exec "${APP_PATH}/node_modules/.bin/electron" "${APP_PATH}" "$@"
else
  exec node "${APP_PATH}/desktop/electron/main.js" "$@"
fi
LAUNCHER
chmod 0755 "${MACOS_DIR}/NEXUS"

# 5. Generate Release Metadata & Archive
echo "[5/5] Generating release metadata & distribution archive..."
BUILD_TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
ARCH=$(uname -m)

cat << METADATA > dist/mac/release-metadata.json
{
  "productName": "NEXUS",
  "version": "1.0.0",
  "releaseChannel": "beta",
  "platform": "darwin",
  "architecture": "${ARCH}",
  "electronVersion": "33.2.1",
  "buildTimestamp": "${BUILD_TIMESTAMP}",
  "bundleId": "com.echonullity.ide",
  "mainEntry": "desktop/electron/main.js",
  "workerEntry": "desktop/electron/harness/worker-entry.js",
  "rendererAsset": "out/desktop.html",
  "harnessModules": [
    "desktop/electron/harness/HarnessRuntime.js",
    "desktop/electron/harness/AgentLoop.js",
    "desktop/electron/harness/WorkerRuntime.js",
    "desktop/electron/harness/WorkspaceIsolationManager.js",
    "desktop/electron/harness/mcp/MCPServerManager.js",
    "desktop/electron/harness/ProjectCapabilityLoader.js",
    "desktop/electron/harness/HarnessPersistenceAdapter.js"
  ]
}
METADATA

tar -czf dist/mac/NEXUS-mac-${ARCH}.tar.gz -C dist/mac NEXUS.app release-metadata.json

echo "=================================================="
echo "macOS packaging complete!"
echo "App Bundle: ${APP_DIR}"
echo "Archive:    dist/mac/NEXUS-mac-${ARCH}.tar.gz"
echo "Metadata:   dist/mac/release-metadata.json"
echo "=================================================="

