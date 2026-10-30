#Requires -RunAsAdministrator
<#
  Restrict inbound TCP 443 to office LAN + VPN pools.
  Laravel 8080 stays on loopback (not published).

  This PC is also the FMG SQL host. Do not blanket-block TCP 1433:
  LAN clients (FMG / Pocket) must keep the existing SQL allow rule.
  If a real VPN pool is passed, block 1433 from that pool only.
#>

param(
    [string[]]$LanSubnets = @('192.168.0.0/24'),
    [string[]]$VpnSubnets = @('YOUR_VPN_SUBNET')
)

$ErrorActionPreference = 'Stop'
$HttpsRule = 'GBC HTTPS LAN/VPN'
$Deny8080 = 'GBC deny inbound 8080'
$Deny1433All = 'GBC deny inbound 1433'
$Deny1433Vpn = 'GBC deny SQL from VPN'

$httpsRemote = @()
$vpnRemote = @()
foreach ($cidr in $LanSubnets) {
    if (-not $cidr -or $cidr -match 'YOUR_') { continue }
    $httpsRemote += $cidr
}
foreach ($cidr in $VpnSubnets) {
    if (-not $cidr) { continue }
    if ($cidr -match 'YOUR_') {
        Write-Warning "Skipping placeholder subnet: $cidr (ask the network admin for the VPN pool)."
        continue
    }
    $httpsRemote += $cidr
    $vpnRemote += $cidr
}

if ($httpsRemote.Count -eq 0) {
    Write-Warning 'No LAN/VPN subnets resolved. HTTPS firewall rule was not created. Fill -LanSubnets / -VpnSubnets and re-run.'
} else {
    Get-NetFirewallRule -DisplayName $HttpsRule -ErrorAction SilentlyContinue | Remove-NetFirewallRule
    New-NetFirewallRule -DisplayName $HttpsRule `
        -Direction Inbound -Action Allow -Protocol TCP -LocalPort 443 `
        -RemoteAddress $httpsRemote | Out-Null
    Write-Host ("Allowed inbound TCP 443 from: " + ($httpsRemote -join ', '))
}

# VPN pools are usually private. Open the web ports only. Do not touch SQL 1433 or Laravel 8090.
$PrivateWeb = @('10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16')
$WebRule = 'GBC web private LAN/VPN'
Get-NetFirewallRule -DisplayName $WebRule -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $WebRule `
    -Direction Inbound -Action Allow -Protocol TCP -LocalPort 80,443,8443 `
    -RemoteAddress $PrivateWeb | Out-Null
Write-Host ("Allowed inbound TCP 80, 443, 8443 from: " + ($PrivateWeb -join ', '))

Get-NetFirewallRule -DisplayName $Deny8080 -ErrorAction SilentlyContinue | Remove-NetFirewallRule
New-NetFirewallRule -DisplayName $Deny8080 `
    -Direction Inbound -Action Block -Protocol TCP -LocalPort 8080 | Out-Null
Write-Host 'Blocked inbound TCP 8080'

# Never re-create the old "block 1433 from everyone" rule. This host serves FMG on LAN.
Get-NetFirewallRule -DisplayName $Deny1433All -ErrorAction SilentlyContinue | Remove-NetFirewallRule
Get-NetFirewallRule -DisplayName $Deny1433Vpn -ErrorAction SilentlyContinue | Remove-NetFirewallRule
if ($vpnRemote.Count -gt 0) {
    New-NetFirewallRule -DisplayName $Deny1433Vpn `
        -Direction Inbound -Action Block -Protocol TCP -LocalPort 1433 `
        -RemoteAddress $vpnRemote | Out-Null
    Write-Host ("Blocked inbound TCP 1433 from VPN: " + ($vpnRemote -join ', '))
} else {
    Write-Host 'LAN SQL 1433 left open (existing My_SQLPORT_TCP). VPN pool not set, so no VPN-only SQL deny.'
}
