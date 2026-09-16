#Requires -RunAsAdministrator
<#
  Install office origin services: Laravel on 127.0.0.1:8080 and (optional) cloudflared.
  Do not publish SQL Server 1433.
  Fill YOUR_APP_HOSTNAME in deploy/cloudflared/config.yml before installing cloudflared.
  Do not point this at geobeer.ge.
#>

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Backend = Join-Path $RepoRoot 'backend'
$Frontend = Join-Path $RepoRoot 'frontend'
$Php = 'C:\php\php.exe'
$Nssm = Get-Command nssm -ErrorAction SilentlyContinue

Write-Host "Repo: $RepoRoot"

if (-not (Test-Path $Php)) {
    throw "PHP not found at $Php. Edit this script with the real php.exe path."
}

Write-Host 'Building frontend into backend/public/app ...'
Push-Location $Frontend
try {
    if (-not (Test-Path 'node_modules')) {
        npm install --legacy-peer-deps
    }
    npm run build:spa
} finally {
    Pop-Location
}

if (-not $Nssm) {
    Write-Warning 'nssm is not on PATH. Install from https://nssm.cc/ then re-run, or install BscApi manually. See bsc-api.nssm.md.'
} else {
    $existing = & nssm status BscApi 2>$null
    if ($LASTEXITCODE -eq 0 -or $existing) {
        Write-Host 'BscApi service already exists; leaving it in place.'
    } else {
        & nssm install BscApi $Php
        & nssm set BscApi AppParameters 'artisan serve --host=127.0.0.1 --port=8080'
        & nssm set BscApi AppDirectory $Backend
        & nssm set BscApi AppStdout (Join-Path $Backend 'storage\logs\nssm-stdout.log')
        & nssm set BscApi AppStderr (Join-Path $Backend 'storage\logs\nssm-stderr.log')
        & nssm set BscApi Start SERVICE_AUTO_START
        & nssm start BscApi
        Write-Host 'BscApi installed and started.'
    }
}

$Cloudflared = Get-Command cloudflared -ErrorAction SilentlyContinue
$configSrc = Join-Path $RepoRoot 'deploy\cloudflared\config.yml'
$configText = Get-Content $configSrc -Raw
if ($configText -match 'YOUR_TUNNEL_ID|YOUR_APP_HOSTNAME') {
    Write-Warning 'deploy/cloudflared/config.yml still has placeholders. Skipping cloudflared service install.'
    Write-Warning 'Create a separate Cloudflare domain (not geobeer.ge), then fill the YAML and run: cloudflared service install'
} elseif (-not $Cloudflared) {
    Write-Warning 'cloudflared not found. Install with: winget install --id Cloudflare.cloudflared -e'
} else {
    $cfDir = Join-Path $env:USERPROFILE '.cloudflared'
    New-Item -ItemType Directory -Force -Path $cfDir | Out-Null
    Copy-Item $configSrc (Join-Path $cfDir 'config.yml') -Force
    & cloudflared tunnel ingress validate
    Write-Host 'Validated tunnel ingress (must be 127.0.0.1:8080 only; no 1433).'
    Write-Host 'If the Windows service is not installed yet: cloudflared service install'
}

Write-Host 'Done. Local health: http://127.0.0.1:8080/api/v1/health'
