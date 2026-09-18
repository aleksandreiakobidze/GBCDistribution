#Requires -RunAsAdministrator
<#
  Install office origin: Laravel on 127.0.0.1:8080 and Caddy HTTPS on :443 (gbc.office.local).
  Access path: LAN / office VPN → https://gbc.office.local
  Do not publish SQL Server 1433.
  Cloudflare named tunnel is deferred — cloudflared is not installed.
#>

param(
    [string]$Php = 'C:\php\php.exe',
    [string]$Caddy = 'C:\caddy\caddy.exe',
    # Fill office LAN CIDR(s). Example: 192.168.0.0/24
    [string[]]$LanSubnets = @('192.168.0.0/24'),
    # Fill VPN pool CIDR(s). Leave YOUR_VPN_SUBNET until the network admin provides it.
    [string[]]$VpnSubnets = @('YOUR_VPN_SUBNET')
)

$ErrorActionPreference = 'Stop'
$RepoRoot = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
$Backend = Join-Path $RepoRoot 'backend'
$Frontend = Join-Path $RepoRoot 'frontend'
$CaddyDir = Join-Path $RepoRoot 'deploy\caddy'
$Nssm = Get-Command nssm -ErrorAction SilentlyContinue

Write-Host "Repo: $RepoRoot"

function Resolve-Php {
    param([string]$Preferred)
    if ($Preferred -and (Test-Path $Preferred)) { return $Preferred }
    $cmd = Get-Command php -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    throw "PHP not found at $Preferred and not on PATH. Edit -Php or install PHP 8.2+."
}

function Resolve-Caddy {
    param([string]$Preferred)
    if ($Preferred -and (Test-Path $Preferred)) { return $Preferred }
    $cmd = Get-Command caddy -ErrorAction SilentlyContinue
    if ($cmd) { return $cmd.Source }
    return $null
}

function Install-NssmService {
    param(
        [string]$Name,
        [string]$Exe,
        [string]$Parameters,
        [string]$Directory,
        [string]$Stdout,
        [string]$Stderr
    )
    $existing = & nssm status $Name 2>$null
    if ($LASTEXITCODE -eq 0 -or $existing) {
        Write-Host "$Name service already exists; leaving it in place."
        return
    }
    & nssm install $Name $Exe
    if ($Parameters) {
        & nssm set $Name AppParameters $Parameters
    }
    & nssm set $Name AppDirectory $Directory
    & nssm set $Name AppStdout $Stdout
    & nssm set $Name AppStderr $Stderr
    & nssm set $Name Start SERVICE_AUTO_START
    & nssm start $Name
    Write-Host "$Name installed and started."
}

$Php = Resolve-Php -Preferred $Php

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
    Write-Warning 'nssm is not on PATH. Install from https://nssm.cc/ then re-run, or install BscApi/BscCaddy manually. See bsc-api.nssm.md.'
} else {
    $logDir = Join-Path $Backend 'storage\logs'
    New-Item -ItemType Directory -Force -Path $logDir | Out-Null
    Install-NssmService -Name 'BscApi' -Exe $Php `
        -Parameters 'artisan serve --host=127.0.0.1 --port=8080' `
        -Directory $Backend `
        -Stdout (Join-Path $logDir 'nssm-stdout.log') `
        -Stderr (Join-Path $logDir 'nssm-stderr.log')

    $caddyExe = Resolve-Caddy -Preferred $Caddy
    $cert = Join-Path $CaddyDir 'certs\gbc.office.local.pem'
    $key = Join-Path $CaddyDir 'certs\gbc.office.local-key.pem'
    if (-not $caddyExe) {
        Write-Warning 'Caddy not found. Place caddy.exe at C:\caddy\caddy.exe or on PATH, generate certs, then re-run. See docs/office-vpn.md.'
    } elseif (-not ((Test-Path $cert) -and (Test-Path $key))) {
        Write-Warning 'mkcert PEM files missing. Run deploy\caddy\generate-certs.ps1 as Administrator, then re-run this script.'
    } else {
        $caddyLogs = Join-Path $CaddyDir 'logs'
        New-Item -ItemType Directory -Force -Path $caddyLogs | Out-Null
        Install-NssmService -Name 'BscCaddy' -Exe $caddyExe `
            -Parameters 'run --config Caddyfile' `
            -Directory $CaddyDir `
            -Stdout (Join-Path $caddyLogs 'nssm-stdout.log') `
            -Stderr (Join-Path $caddyLogs 'nssm-stderr.log')
    }
}

$firewallScript = Join-Path $PSScriptRoot 'set-origin-firewall.ps1'
if (Test-Path $firewallScript) {
    & $firewallScript -LanSubnets $LanSubnets -VpnSubnets $VpnSubnets
}

Write-Host 'Cloudflare named tunnel is deferred. Skipping cloudflared service install.'
$cfConfig = Join-Path $RepoRoot 'deploy\cloudflared\config.yml'
if (Test-Path $cfConfig) {
    $configText = Get-Content $cfConfig -Raw
    if ($configText -match 'YOUR_TUNNEL_ID|YOUR_APP_HOSTNAME') {
        Write-Host 'deploy/cloudflared/config.yml still has placeholders (expected until a public domain is requested).'
    }
}

Write-Host 'Done. Loopback health: http://127.0.0.1:8080/api/v1/health'
Write-Host 'LAN/VPN health: https://gbc.office.local/api/v1/health'
