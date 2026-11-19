[CmdletBinding()]
param(
    [string]$OutputDir = ".\dist-installer"
)

$ErrorActionPreference = "Stop"

Write-Host "=== Packaging Modendo Windows Installer (v0.16.1) ===" -ForegroundColor Cyan

$isccCmd = Get-Command iscc.exe -ErrorAction SilentlyContinue
$Iscc = $null
if ($isccCmd) {
    $Iscc = $isccCmd.Source
} else {
    $candidates = @(
        "$env:LOCALAPPDATA\Programs\Inno Setup 6\iscc.exe",
        "C:\Program Files (x86)\Inno Setup 6\iscc.exe",
        "C:\Program Files\Inno Setup 6\iscc.exe"
    )
    foreach ($c in $candidates) {
        if (Test-Path $c) {
            $Iscc = $c
            break
        }
    }
}

if (-not $Iscc -or -not (Test-Path $Iscc)) {
    throw "Inno Setup Compiler (iscc.exe) not found in PATH or standard installation locations."
}

Write-Host "Using Inno Setup Compiler: $Iscc" -ForegroundColor Green

if (-not (Test-Path $OutputDir)) {
    New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null
}

if (-not (Test-Path "dist-win\KarWandLauncher.exe")) {
    throw "Required binary 'dist-win\KarWandLauncher.exe' missing. Build Tauri launcher before packaging."
}

if (-not (Test-Path "dist\modendo\index.html")) {
    throw "Required web distribution 'dist\modendo\index.html' missing. Run 'npm run build:modendo' first."
}

& $Iscc /DAppTenant=modendo installer\modendo.iss
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
    throw "ISCC compilation failed with exit code $exitCode."
}

$exePath = "$OutputDir\KarWand-Modendo-Setup-v0.16.1.exe"
if (Test-Path $exePath) {
    $hash = (Get-FileHash -Path $exePath -Algorithm SHA256).Hash.ToLower()
    $shaFile = "$exePath.sha256"
    "$hash  KarWand-Modendo-Setup-v0.16.1.exe" | Set-Content -Path $shaFile -Encoding UTF8
    
    $fileItem = Get-Item $exePath
    $sizeMb = [math]::Round($fileItem.Length / 1MB, 2)
    
    Write-Host "`n✓ Modendo Installer generated successfully!" -ForegroundColor Green
    Write-Host "   Path:     $exePath" -ForegroundColor Cyan
    Write-Host "   Size:     $sizeMb MB ($($fileItem.Length) bytes)" -ForegroundColor Cyan
    Write-Host "   SHA-256:  $hash" -ForegroundColor Yellow
    Write-Host "   Checksum: $shaFile" -ForegroundColor Green
} else {
    throw "Installer binary was not found at expected path: $exePath"
}
