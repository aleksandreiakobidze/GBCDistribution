# Local run

Office origin: Laravel `backend/public` on `http://127.0.0.1:8080`.
LAN/VPN HTTPS: Caddy `https://gbc.office.local` → that loopback port. See `docs/office-vpn.md`.
Frontend in development: Vite `http://127.0.0.1:5173` proxies `/api` to the backend. VPN users must not use Vite.

## Backend

```powershell
cd backend
php artisan migrate
php artisan serve --host=127.0.0.1 --port=8080
```

Map presellers in Filament `/admin` (`users.id_gvari`). Unmapped accounts get 403 on `/api/v1/*` data routes. List live FMG IDs with `php artisan fmg:presellers` (does not guess mappings). Office login is `https://gbc.office.local/admin`. Plain `http://127.0.0.1:8080/admin` will not send `SESSION_SECURE_COOKIE=true` cookies.

## Frontend

```powershell
cd frontend
npm install --legacy-peer-deps
npm run dev
```

The client uses relative `/api`. Do not point the phone at localhost.

## FMG SQL

Fill `FMG_SQL_*` in `backend/.env`. Do not publish port 1433. VPN clients do not get a SQL route. `FMG_WRITES_ENABLED=false` until mapping is verified.

PHP needs `pdo_sqlsrv` / `sqlsrv` plus Microsoft ODBC Driver 17 or 18. On this office host, Native Client 11 is used instead via `FMG_ODBC_DSN` and `pdo_odbc` (Windows auth as the origin service account). That driver turns Georgian `nvarchar` into `?` unless the app pulls UTF-16 as hex (`FmgNvarchar`). This instance uses an untrusted TLS certificate; `FMG_SQL_TRUST_SERVER_CERTIFICATE=true` is a LAN-only exception. Login `AI` can open `SBS_RSF` after `sql/fmg-grant-ai.sql`. TCP `127.0.0.1` Windows auth fails here (untrusted domain); use `localhost\FMGSQL` or the Native Client DSN. `/api/v1/health` returns provider `fmg` when SQL is reachable. Writes stay off.

Timezone: `ERP_TIMEZONE=Asia/Tbilisi`.

## Tests

```powershell
cd backend
php artisan test
```

Tests use `ERP_PROVIDER=fake` (phpunit.xml). They do not prove live SQL Server.

## Production-like same origin

```powershell
cd frontend
npm run build:spa
cd ../backend
php artisan serve --host=127.0.0.1 --port=8080
```

SPA is at `/`, API at `/api`, admin at `/admin`. The build copies `/assets` into `backend/public/` so `https://gbc.office.local` can load JS. For auto-start after reboot see `deploy/windows/bsc-api.nssm.md`. LAN/VPN HTTPS is Caddy + mkcert on `gbc.office.local`. Cloudflare named tunnel is deferred. `geobeer.ge` nameservers stay on Microsoft 365. Do not publish 1433.
