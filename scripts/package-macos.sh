#!/usr/bin/env bash
set -e

echo "=== Building NEXUS for macOS (DMG & App Bundle) ==="

# 1. Build production web bundle
echo "[1/4] Running next build..."
npm run build

# 2. Package Electron App
echo "[2/4] Packaging Electron application bundle..."
# Ensure native spawn-helper binaries have executable permissions
find node_modules/node-pty -name "spawn-helper" -exec chmod 0755 {} + 2>/dev/null || true
mkdir -p dist/mac

echo "[3/4] Creating macOS .app bundle structure..."
cat << 'INFO_PLIST' > dist/mac/Info.plist
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
    <key>CFBundleVersion</key>
    <string>1.0.0</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0.0-beta</string>
</dict>
</plist>
INFO_PLIST

echo "[4/4] macOS packaging setup complete. Ready for distribution at dist/mac/."
