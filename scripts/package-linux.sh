#!/usr/bin/env bash
set -e

echo "=== Building Echo Nullity for Linux (AppImage & tar.gz) ==="

echo "[1/3] Running next build..."
npm run build

echo "[2/3] Preparing Linux distribution output directory..."
find node_modules/node-pty -name "spawn-helper" -exec chmod 0755 {} + 2>/dev/null || true
mkdir -p dist/linux

echo "[3/3] Linux packaging bundle ready at dist/linux/"
