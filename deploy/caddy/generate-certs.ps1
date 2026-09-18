#Requires -RunAsAdministrator
<#
  Create a local CA (mkcert) and TLS cert for gbc.office.local.
  Install the CA on office PCs and phones so HTTPS/PWA trust works.
  Do not commit the PEM files.
#>

$ErrorActionPreference = 'Stop'
$CaddyDir = $PSScriptRoot
$CertDir = Join-Path $CaddyDir 'certs'
$Mkcert = Get-Command mkcert -ErrorAction SilentlyContinue

if (-not $Mkcert) {
    throw 'mkcert not found on PATH. Install from https://github.com/FiloSottile/mkcert/releases then re-run.'
}

New-Item -ItemType Directory -Force -Path $CertDir | Out-Null

Write-Host 'Installing mkcert local CA (if not already installed)...'
& mkcert -install

$cert = Join-Path $CertDir 'gbc.office.local.pem'
$key = Join-Path $CertDir 'gbc.office.local-key.pem'

Write-Host 'Issuing certificate for gbc.office.local, localhost, 127.0.0.1 ...'
& mkcert -cert-file $cert -key-file $key gbc.office.local localhost 127.0.0.1

$caroot = & mkcert -CAROOT
Write-Host "CA root: $caroot"
Write-Host "Cert: $cert"
Write-Host "Key: $key"
Write-Host 'Copy rootCA.pem from CAROOT onto phones/PCs that will open https://gbc.office.local'
