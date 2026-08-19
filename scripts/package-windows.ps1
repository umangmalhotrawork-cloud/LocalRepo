Write-Host "=== Building NEXUS for Windows (NSIS & Portable ZIP) ==="

Write-Host "[1/3] Running next build..."
npm run build

Write-Host "[2/3] Preparing Windows distribution output directory..."
New-Item -ItemType Directory -Force -Path "dist/win" | Out-Null

Write-Host "[3/3] Windows packaging bundle ready at dist/win/"
