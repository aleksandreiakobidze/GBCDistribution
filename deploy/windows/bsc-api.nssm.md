# Windows origin services (Laravel + cloudflared)

Office origin: SPA `/` and API `/api` on `http://127.0.0.1:8080`. Cloudflare named tunnel publishes **only** that HTTP port as `https://YOUR_APP_HOSTNAME`. Do not expose SQL Server 1433.

`geobeer.ge` / Microsoft 365 nameservers stay unchanged. `YOUR_APP_HOSTNAME` is a **separate** domain on Cloudflare DNS.

## 1. Build the SPA into Laravel

```powershell
cd frontend
npm install --legacy-peer-deps
npm run build:spa
```

Vite writes `backend/public/app/` and copies `/assets`, icons, and the service worker to `backend/public/` so `https://YOUR_APP_HOSTNAME/` can load JS.

## 2. Laravel as a Windows service (NSSM)

Install [NSSM](https://nssm.cc/) (Administrator). Adjust the PHP and repo paths:

```powershell
nssm install BscApi "C:\php\php.exe"
nssm set BscApi AppParameters "artisan serve --host=127.0.0.1 --port=8080"
nssm set BscApi AppDirectory "C:\Users\YOUR_USER\Documents\BSC Distribution\backend"
nssm set BscApi AppStdout "C:\Users\YOUR_USER\Documents\BSC Distribution\backend\storage\logs\nssm-stdout.log"
nssm set BscApi AppStderr "C:\Users\YOUR_USER\Documents\BSC Distribution\backend\storage\logs\nssm-stderr.log"
nssm set BscApi Start SERVICE_AUTO_START
nssm start BscApi
```

Or run `deploy\windows\install-origin.ps1` as Administrator (placeholders inside).

## 3. cloudflared as a Windows service

Fill `deploy/cloudflared/config.yml` (`YOUR_TUNNEL_ID`, credentials path, `YOUR_APP_HOSTNAME`). Ingress must stay `http://127.0.0.1:8080` plus `http_status:404`. No 1433.

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.cloudflared" | Out-Null
Copy-Item "C:\Users\YOUR_USER\Documents\BSC Distribution\deploy\cloudflared\config.yml" "$env:USERPROFILE\.cloudflared\config.yml" -Force
cloudflared tunnel ingress validate
cloudflared service install
```

Credentials JSON stays under `C:\ProgramData\cloudflared\` (or the path in config). Do not commit it.

## 4. After reboot

- `http://127.0.0.1:8080/api/v1/health`
- `https://YOUR_APP_HOSTNAME/api/v1/health` from **mobile data**

If Laravel `.env` still has `APP_URL=http://localhost`, cookies for the public host will fail. Set `APP_URL`, `SESSION_SECURE_COOKIE=true`, and `SANCTUM_STATEFUL_DOMAINS=YOUR_APP_HOSTNAME` only after the hostname exists. Until then, keep localhost for office use.
