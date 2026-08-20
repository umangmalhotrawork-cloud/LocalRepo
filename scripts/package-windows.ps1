Write-Host "=================================================="
Write-Host "=== Building NEXUS for Windows (Portable Bundle) ="
Write-Host "=================================================="

Write-Host "[1/4] Running next build (static export)..."
npm run build

Write-Host "[2/4] Creating Windows distribution directory structure..."
$appDir = "dist/win/NEXUS-win-x64"
$resourcesAppDir = "$appDir/resources/app"

if (Test-Path "dist/win") {
    Remove-Item -Recurse -Force "dist/win"
}
New-Item -ItemType Directory -Force -Path $resourcesAppDir | Out-Null

Write-Host "[3/4] Copying production assets, harness, and runtime modules..."
Copy-Item "package.json" "$resourcesAppDir/"
Copy-Item -Recurse "out" "$resourcesAppDir/out"
Copy-Item -Recurse "desktop" "$resourcesAppDir/desktop"

if (Test-Path "package-lock.json") {
    Copy-Item "package-lock.json" "$resourcesAppDir/"
}

# Create launcher batch script
$launcherContent = @"
@echo off
set NODE_ENV=production
set APP_PATH=%~dp0resources\app
electron "%APP_PATH%" %*
"@
Set-Content -Path "$appDir/nexus.bat" -Value $launcherContent

Write-Host "[4/4] Generating release metadata & distribution archive..."
$timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
$metadata = @"
{
  "productName": "NEXUS",
  "version": "1.0.0",
  "releaseChannel": "beta",
  "platform": "win32",
  "architecture": "x64",
  "electronVersion": "33.2.1",
  "buildTimestamp": "$timestamp",
  "bundleId": "com.echonullity.ide",
  "mainEntry": "desktop/electron/main.js",
  "workerEntry": "desktop/electron/harness/worker-entry.js",
  "rendererAsset": "out/desktop.html"
}
"@
Set-Content -Path "dist/win/release-metadata.json" -Value $metadata

Compress-Archive -Path "$appDir", "dist/win/release-metadata.json" -DestinationPath "dist/win/NEXUS-win-x64.zip" -Force

Write-Host "=================================================="
Write-Host "Windows packaging complete!"
Write-Host "App Directory: $appDir"
Write-Host "Archive:       dist/win/NEXUS-win-x64.zip"
Write-Host "Metadata:      dist/win/release-metadata.json"
Write-Host "=================================================="

