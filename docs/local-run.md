# Local run

Office origin: Laravel `backend/public` on `http://127.0.0.1:8080`.
Frontend in development: Vite `http://127.0.0.1:5173` proxies `/api` to the backend.

## Backend

```powershell
cd backend
php artisan migrate
php artisan serve --host=127.0.0.1 --port=8080
```

Map presellers in Filament `/admin` (`users.id_gvari`). Unmapped accounts get 403 on `/api/v1/*` data routes.

## Frontend

```powershell
cd frontend
npm install --legacy-peer-deps
npm run dev
```

The client uses relative `/api`. Do not point the phone at localhost.

## FMG SQL

Fill `FMG_SQL_*` in `backend/.env`. Do not publish port 1433. `FMG_WRITES_ENABLED=false` until mapping is verified.

PHP needs `pdo_sqlsrv` / `sqlsrv`. This office SQL Server uses an untrusted TLS certificate; `FMG_SQL_TRUST_SERVER_CERTIFICATE=true` is a LAN-only exception. Login `AI` can open `SBS_RSF` after `sql/fmg-grant-ai.sql`. `/api/v1/health` returns provider `fmg` when SQL is reachable. Writes stay off.

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

SPA is at `/`, API at `/api`, admin at `/admin`. The build copies `/assets` into `backend/public/` so the tunnel host can load JS. For auto-start after reboot see `deploy/windows/bsc-api.nssm.md`. Public HTTPS uses a **separate** Cloudflare domain (`YOUR_APP_HOSTNAME`); `geobeer.ge` nameservers stay on Microsoft 365. Do not publish 1433.
