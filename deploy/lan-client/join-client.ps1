<#
  Installs the office certificate and the name zz.office.local.
  If this window is not Administrator, it asks Windows for permission and continues there.
#>
$ErrorActionPreference = 'Stop'

function Test-IsAdmin {
    $identity = [Security.Principal.WindowsIdentity]::GetCurrent()
    $principal = New-Object Security.Principal.WindowsPrincipal($identity)
    return $principal.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if ($env:ZZ_ELEVATED -ne '1' -and -not (Test-IsAdmin)) {
    $self = Join-Path $env:TEMP 'zz-join.ps1'
    Invoke-WebRequest -Uri 'http://192.168.0.22/join-client.ps1' -OutFile $self -UseBasicParsing
    Write-Host 'Approve the Windows permission window (Yes).'
    Start-Process powershell -Verb RunAs -ArgumentList "-NoProfile -ExecutionPolicy Bypass -Command `"`$env:ZZ_ELEVATED='1'; & '$self'`""
    return
}

$hostsPath = Join-Path $env:SystemRoot 'System32\drivers\etc\hosts'
$line = '192.168.0.22 zz.office.local'
$existing = @(Get-Content -Path $hostsPath -ErrorAction SilentlyContinue)
if ($existing -notcontains $line) {
    Add-Content -Path $hostsPath -Value $line
    Write-Host "Added hosts: $line"
} else {
    Write-Host "Hosts already has: $line"
}

$cer = Join-Path $env:TEMP 'zz-root.cer'
Invoke-WebRequest -Uri 'http://192.168.0.22/zz-root.cer' -OutFile $cer -UseBasicParsing
& certutil -addstore -f Root $cer | Out-Host
& certutil -user -addstore -f Root $cer | Out-Host

Write-Host 'Close the browser completely, then open https://zz.office.local'
Start-Process 'https://zz.office.local/'
