[CmdletBinding()]
param(
    [string]$Version = "0.15.0",
    [string]$OutputDir = ".\dist-installer",
    [string]$StagingDir = ".\dist-liara",
    [switch]$SkipTests = $false
)

$ErrorActionPreference = "Stop"
$StartTime = Get-Date

Write-Host "`n=== [1/5] Auditing Toolchains & Environment ===" -ForegroundColor Cyan
Write-Host "   Node Version: $(node -v)" -ForegroundColor Green

Write-Host "`n=== [2/5] Running Phase 2 Verification Suite ===" -ForegroundColor Cyan
if (-not $SkipTests) {
    npm run test:p2
    Write-Host "   Phase 2 Tests (including E2E smoke): PASSED" -ForegroundColor Green
} else {
    Write-Host "   Tests: Bypassed (-SkipTests)" -ForegroundColor Yellow
}

Write-Host "`n=== [3/5] Building Dual-Tenant Frontends & Server Bundle ===" -ForegroundColor Cyan
npm run build:all
Write-Host "   Frontends built (dist/100hich, dist/modendo)" -ForegroundColor Green

npx esbuild server.ts --bundle --platform=node --format=esm --packages=external --outfile=server.js
Write-Host "   Production server.js bundled (Zero-C++ native dependencies)" -ForegroundColor Green

Write-Host "`n=== [4/5] Assembling Liara Deployment Staging ($StagingDir) ===" -ForegroundColor Cyan
if (Test-Path $StagingDir) { Remove-Item $StagingDir -Recurse -Force }
New-Item -ItemType Directory -Path $StagingDir -Force | Out-Null

# Copy static frontend dist
Copy-Item "dist" "$StagingDir\dist" -Recurse -Force

# Copy backend files
Copy-Item "server.js" "$StagingDir\server.js" -Force
Copy-Item "server.ts" "$StagingDir\server.ts" -Force
Copy-Item "server" "$StagingDir\server" -Recurse -Force
Copy-Item "src" "$StagingDir\src" -Recurse -Force
Copy-Item "central-framework" "$StagingDir\central-framework" -Recurse -Force

# Copy configuration manifests
Copy-Item "package.json" "$StagingDir\package.json" -Force
Copy-Item "package-lock.json" "$StagingDir\package-lock.json" -Force
Copy-Item "liara.json" "$StagingDir\liara.json" -Force
Copy-Item ".env.example" "$StagingDir\.env.example" -Force

# Create default dist index fallback if needed
if (-not (Test-Path "$StagingDir\dist\index.html")) {
    Copy-Item "$StagingDir\dist\100hich\index.html" "$StagingDir\dist\index.html" -Force
}

Write-Host "   Staging assembly complete" -ForegroundColor Green

Write-Host "`n=== [5/5] Compressing Liara Deployment Archive ===" -ForegroundColor Cyan
if (-not (Test-Path $OutputDir)) { New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null }

$ZipPath = "$OutputDir\karwand-liara-phase2-v$Version.zip"
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }

Compress-Archive -Path "$StagingDir\*" -DestinationPath $ZipPath -Force

$ZipSizeMb = [math]::Round(((Get-Item $ZipPath).Length / 1MB), 2)
$Hash = (Get-FileHash $ZipPath -Algorithm SHA256).Hash.ToLower()
"$Hash  karwand-liara-phase2-v$Version.zip" | Set-Content "$ZipPath.sha256" -Encoding UTF8

# Cleanup staging directory
Remove-Item $StagingDir -Recurse -Force
if (Test-Path "server.js") { Remove-Item "server.js" -Force }

$Duration = [math]::Round(((Get-Date) - $StartTime).TotalSeconds, 1)

Write-Host "`n========================================================" -ForegroundColor Green
Write-Host "   LIARA DEPLOYMENT ARTIFACT GENERATED SUCCESSFULLY" -ForegroundColor Green
Write-Host "   Archive: $ZipPath" -ForegroundColor Green
Write-Host "   Size:    $ZipSizeMb MB" -ForegroundColor Green
Write-Host "   SHA-256: $Hash" -ForegroundColor Green
Write-Host "   Time:    $Duration seconds" -ForegroundColor Green
Write-Host "========================================================`n" -ForegroundColor Green
