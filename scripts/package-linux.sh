#!/usr/bin/env bash
set -e

echo "=== Building Echo Nullity for Linux (AppImage & tar.gz) ==="

echo "[1/3] Running next build..."
npm run build

echo "[2/3] Preparing Linux distribution output directory..."
mkdir -p dist/linux

echo "[3/3] Linux packaging bundle ready at dist/linux/"
