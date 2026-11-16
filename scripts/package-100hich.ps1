[CmdletBinding()]
param(
    [string]$OutputDir = ".\dist-installer"
)

$ErrorActionPreference = "Stop"

Write-Host "=== Packaging 100 HICH Windows Installer ===" -ForegroundColor Cyan

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

& $Iscc /DAppTenant=100hich installer\100hich.iss
$exitCode = $LASTEXITCODE
if ($exitCode -ne 0) {
    throw "ISCC compilation failed with exit code $exitCode."
}

$exePath = "$OutputDir\KarWand-100HICH-Setup-v0.16.1.exe"
if (Test-Path $exePath) {
    $hash = (Get-FileHash -Path $exePath -Algorithm SHA256).Hash
    Write-Host "`n Installer generated successfully!" -ForegroundColor Green
    Write-Host "   Path: $exePath" -ForegroundColor Cyan
    Write-Host "   SHA-256: $hash" -ForegroundColor Yellow
} else {
    throw "Expected installer artifact not found at $exePath"
}
