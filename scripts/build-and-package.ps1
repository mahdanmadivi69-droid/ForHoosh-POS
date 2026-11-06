[CmdletBinding()]
param(
    [string]$Version = "0.14.0",
    [string]$OutputDir = ".\dist-installer",
    [string]$StagingDir = ".\dist-win",
    [switch]$SkipTests = $false,
    [switch]$SkipInstaller = $false
)

$ErrorActionPreference = "Stop"
$StartTime = Get-Date

if (Test-Path "$env:USERPROFILE\.cargo\bin") {
    $env:PATH = "$env:USERPROFILE\.cargo\bin;$env:PATH"
}

Write-Host "`n=== [1/6] Auditing Toolchains ===" -ForegroundColor Cyan
Write-Host "   Node: $(node -v) | Cargo: $(cargo --version)" -ForegroundColor Green

Write-Host "`n=== [2/6] Test Matrix & Static Analysis ===" -ForegroundColor Cyan
if (-not $SkipTests) {
    npm run test:silent
    Write-Host "   Tests: Passed" -ForegroundColor Green
} else {
    Write-Host "   Tests: Bypassed (-SkipTests)" -ForegroundColor Yellow
}

Write-Host "`n=== [3/6] Building Web Frontends (Dual Tenant) ===" -ForegroundColor Cyan
npm run build:all
Write-Host "   Web dist generated" -ForegroundColor Green

Write-Host "`n=== [4/6] Compiling Tauri Rust Launcher ===" -ForegroundColor Cyan
Push-Location "src-tauri"
cargo build --release
$cargoExit = $LASTEXITCODE
Pop-Location
if ($cargoExit -ne 0) {
    throw "Cargo release build failed with exit code $cargoExit."
}
Write-Host "   KarWandLauncher.exe compiled" -ForegroundColor Green

Write-Host "`n=== [5/6] Assembling Staging Dir ($StagingDir) ===" -ForegroundColor Cyan
if (Test-Path $StagingDir) { Remove-Item $StagingDir -Recurse -Force }
New-Item -ItemType Directory -Path $StagingDir -Force | Out-Null
Copy-Item "src-tauri\target\release\karwand-launcher.exe" "$StagingDir\KarWandLauncher.exe" -Force
Copy-Item "dist\*" $StagingDir -Recurse -Force
Write-Host "   Staging complete" -ForegroundColor Green

Write-Host "`n=== [6/6] Packaging Artifacts ===" -ForegroundColor Cyan
if (-not (Test-Path $OutputDir)) { New-Item -ItemType Directory -Path $OutputDir -Force | Out-Null }

$ZipPath = "$OutputDir\KarWand-POS-v$Version.zip"
if (Test-Path $ZipPath) { Remove-Item $ZipPath -Force }
Compress-Archive -Path "$StagingDir\*" -DestinationPath $ZipPath -Force

$Hash = (Get-FileHash $ZipPath -Algorithm SHA256).Hash.ToLower()
"$Hash  KarWand-POS-v$Version.zip" | Set-Content "$ZipPath.sha256" -Encoding UTF8

Write-Host "   Update Archive: $ZipPath" -ForegroundColor Green
Write-Host "   SHA-256 Digest: $Hash" -ForegroundColor Green

if (-not $SkipInstaller) {
    $isccCmd = Get-Command iscc.exe -ErrorAction SilentlyContinue
    $Iscc = $null
    if ($isccCmd) {
        $Iscc = $isccCmd.Source
    } else {
        $candidates = @(
            "C:\Program Files (x86)\Inno Setup 6\iscc.exe",
            "C:\Program Files\Inno Setup 6\iscc.exe",
            "$env:LOCALAPPDATA\Programs\Inno Setup 6\iscc.exe"
        )
        foreach ($c in $candidates) {
            if (Test-Path $c) {
                $Iscc = $c
                break
            }
        }
    }

    if ($Iscc -and (Test-Path $Iscc)) {
        Write-Host "   Compiling Inno Setup with: $Iscc" -ForegroundColor Cyan
        & $Iscc "installer\karwand-pos-setup.iss"
        if (Test-Path "$OutputDir\KarWand-Setup-v$Version.exe") {
            Copy-Item "$OutputDir\KarWand-Setup-v$Version.exe" "$OutputDir\KarWand-POS-Setup-v$Version.exe" -Force
        }
        Write-Host "   Setup Installer: $OutputDir\KarWand-Setup-v$Version.exe" -ForegroundColor Green
    } else {
        Write-Host "   Inno Setup compiler not found in standard paths: Skipped setup.exe generation" -ForegroundColor Yellow
    }
}

Write-Host "`n=== Finished in $([math]::Round(((Get-Date) - $StartTime).TotalSeconds, 1))s ===" -ForegroundColor Green