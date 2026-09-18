# Windows origin services (Laravel + Caddy)

Office origin: SPA `/` and API `/api` on `http://127.0.0.1:8080`. Caddy publishes **only** that HTTP port as `https://gbc.office.local` (TCP 443) for LAN and office VPN. Do not expose SQL Server 1433.

Cloudflare named tunnel is **deferred**. Do not install `cloudflared`. `geobeer.ge` / Microsoft 365 nameservers stay unchanged.

Or run `deploy\windows\install-origin.ps1` as Administrator (fill PHP/Caddy paths and LAN/VPN CIDRs).

## 1. Build the SPA into Laravel

```powershell
cd frontend
npm install --legacy-peer-deps
npm run build:spa
```

Vite writes `backend/public/app/` and copies `/assets`, icons, and the service worker to `backend/public/` so `https://gbc.office.local/` can load JS. The client uses relative `/api`.

## 2. TLS certificate (mkcert)

```powershell
# Install mkcert from https://github.com/FiloSottile/mkcert/releases
# Then, as Administrator:
.\deploy\caddy\generate-certs.ps1
```

Install the mkcert CA (`mkcert -CAROOT`\rootCA.pem) on office PCs and phones. Without it, browsers warn and PWA install may fail.

## 3. Laravel as a Windows service (NSSM)

Install [NSSM](https://nssm.cc/) (Administrator). Adjust the PHP and repo paths:

```powershell
nssm install BscApi "C:\php\php.exe"
nssm set BscApi AppParameters "artisan serve --host=127.0.0.1 --port=8080"
nssm set BscApi AppDirectory "C:\Users\Administrator\Documents\GBCDistribution\backend"
nssm set BscApi AppStdout "C:\Users\Administrator\Documents\GBCDistribution\backend\storage\logs\nssm-stdout.log"
nssm set BscApi AppStderr "C:\Users\Administrator\Documents\GBCDistribution\backend\storage\logs\nssm-stderr.log"
nssm set BscApi Start SERVICE_AUTO_START
nssm start BscApi
```

Bind **127.0.0.1 only**. Do not use `0.0.0.0` for artisan.

## 4. Caddy as a Windows service (NSSM)

Place `caddy.exe` at `C:\caddy\caddy.exe` (or another path). Certs must already exist under `deploy\caddy\certs\`.

```powershell
nssm install BscCaddy "C:\caddy\caddy.exe"
nssm set BscCaddy AppParameters "run --config Caddyfile"
nssm set BscCaddy AppDirectory "C:\Users\Administrator\Documents\GBCDistribution\deploy\caddy"
nssm set BscCaddy AppStdout "C:\Users\Administrator\Documents\GBCDistribution\deploy\caddy\logs\nssm-stdout.log"
nssm set BscCaddy AppStderr "C:\Users\Administrator\Documents\GBCDistribution\deploy\caddy\logs\nssm-stderr.log"
nssm set BscCaddy Start SERVICE_AUTO_START
nssm start BscCaddy
```

Caddyfile ingress is only `gbc.office.local` → `http://127.0.0.1:8080`. No 1433.

## 5. Windows Firewall

```powershell
.\deploy\windows\set-origin-firewall.ps1 -LanSubnets '192.168.0.0/24' -VpnSubnets 'YOUR_VPN_SUBNET'
```

Replace `YOUR_VPN_SUBNET` with the real VPN pool (for example `10.8.0.0/24`). This allows TCP 443 from LAN/VPN and blocks inbound 8080. LAN SQL 1433 stays open on this host; 1433 is denied from the VPN pool only when that CIDR is set.

## 6. Cloudflare (deferred)

Leave [`deploy/cloudflared/config.yml`](../cloudflared/config.yml) as placeholders. Do **not** run `cloudflared service install`. Future public HTTPS: [`docs/cloudflare-tunnel.md`](../../docs/cloudflare-tunnel.md).

## 7. After reboot

- `http://127.0.0.1:8080/api/v1/health` (this PC only)
- `https://gbc.office.local/api/v1/health` from office LAN or VPN

Laravel `.env` on this host:

```
APP_URL=https://gbc.office.local
SESSION_SECURE_COOKIE=true
SANCTUM_STATEFUL_DOMAINS=gbc.office.local,localhost,localhost:5173,127.0.0.1:5173,127.0.0.1:8080
TRUSTED_PROXIES=*
FMG_WRITES_ENABLED=false
```

Network DNS/VPN routes: [`docs/office-vpn.md`](../../docs/office-vpn.md).
