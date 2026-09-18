# BSC Distribution System

A full-cycle distribution management PWA for pre-selling operations. Built with Laravel 12 + Filament v5 (backend) and React 19 + Vite (frontend).

Presell catalog, prices and incoming orders are sourced from FMG (Microsoft SQL Server on the office LAN). Remote users reach the app over HTTPS on the office LAN or office VPN (`gbc.office.local`). FMG SQL is never published to the internet or to VPN clients.

## Features

- **Pre-selling Workflow**: Sales reps visit customers, take orders (works offline), orders sync to warehouse
- **Warehouse Management**: Inventory tracking, stock movements, order picking and packing
- **Delivery Management**: Route assignment, delivery tracking, proof of delivery (signature + photo)
- **Invoicing & Payments**: Auto-generated invoices, payment tracking (cash, bank transfer, check)
- **Returns Management**: Process product returns with condition tracking
- **Analytics & Reports**: Sales reports, inventory reports, sales rep performance
- **Offline Support**: Full offline order creation with background sync (Dexie.js + Workbox)
- **Multi-language**: English and Georgian (ქართული)
- **PWA**: Install as native app on any device
- **Role-based Access**: Admin, Sales Rep, Warehouse Staff, Driver
- **FMG integration**: Assigned customers, customer-specific list prices, quote-then-submit (writes disabled until FMG mapping is verified)
- **Remote access**: Phone → office VPN → `https://gbc.office.local` → Caddy → office Laravel → FMG SQL on LAN (SQL not on the VPN)

## Tech Stack

### Frontend
- React 19 + TypeScript + Vite 6
- Tailwind CSS 4
- TanStack Query v5
- Zustand (state management)
- React Hook Form + Zod (form validation)
- Dexie.js (IndexedDB for offline)
- Workbox (service worker / PWA)
- Recharts (charts)
- i18next (internationalization)

### Backend
- Laravel 12
- Filament v5 (admin panel)
- Laravel Sanctum (API auth)
- Spatie Permission (roles)
- SQLite (application DB) / Microsoft SQL Server (FMG, LAN only)

## Prerequisites

- PHP 8.2+
- Composer 2.x
- Node.js 20+
- npm 10+
- MySQL 8 (for production)

## Local Development Setup

### 1. Clone and install backend

```bash
cd backend
composer install
cp .env.example .env
php artisan key:generate
```

### 2. Configure database

For local development, SQLite is pre-configured. Just run:

```bash
php artisan migrate:fresh --seed
```

This creates the database with demo data.

### 3. Install frontend

```bash
cd frontend
npm install --legacy-peer-deps
```

### 4. Start development servers

On this Windows host port 8000 may be blocked; use 8080:

Terminal 1 (Backend):
```bash
cd backend
php artisan serve --host=127.0.0.1 --port=8080
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

- Frontend (dev): http://127.0.0.1:5173 (relative `/api` via Vite proxy)
- Backend API: http://127.0.0.1:8080/api
- Admin Panel: http://127.0.0.1:8080/admin
- ERP contract: http://127.0.0.1:8080/api/v1/health
- LAN/VPN origin: https://gbc.office.local (Caddy → Laravel; same `/api`)

Map each sales user to FMG `IdGvari` in Filament (Users → FMG IdGvari). Unmapped accounts cannot load FMG customers/items.

Office VPN, HTTPS, firewall, FMG SQL: see `docs/office-vpn.md`, `docs/local-run.md`, `docs/fmg-blockers.md`. Cloudflare tunnel is deferred (`docs/cloudflare-tunnel.md`).

### 5. Demo Login Credentials

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@bsc.ge | password |
| Sales Rep | nino@bsc.ge | password |
| Sales Rep | davit@bsc.ge | password |
| Warehouse | levan@bsc.ge | password |
| Driver | tornike@bsc.ge | password |

## Admin Panel (Filament)

Access at `/admin`. Log in with admin@bsc.ge / password.

When `ERP_PROVIDER=fmg`, Filament customer/product create-edit is disabled (FMG owns master data). User → IdGvari mapping remains admin-owned.

## Building for Production

### 1. Build frontend

```bash
cd frontend
npm run build:spa
```

This outputs the built React app to `backend/public/app/` (and copies `/assets` into `backend/public/`). Laravel then serves the SPA at `/` and the API at `/api` (same origin).

Remote users reach that origin through the **office VPN** as `https://gbc.office.local` (Caddy TLS). `geobeer.ge` Microsoft 365 DNS/nameservers are not changed. FMG SQL stays on the LAN and is not routed to VPN clients. See `docs/office-vpn.md`. A named Cloudflare Tunnel is deferred (`docs/cloudflare-tunnel.md`, `deploy/cloudflared/config.yml`). Do not publish SQL Server.

### 2. Configure backend for production

```bash
cd backend
cp .env.production .env
# Edit .env with your actual database credentials and domain
php artisan key:generate
php artisan migrate --seed
php artisan config:cache
php artisan route:cache
php artisan view:cache
php artisan storage:link
```

## Deploying to Hostinger

### Shared Hosting

1. Upload the entire `backend/` directory to your Hostinger public_html
2. Point your domain to `public_html/backend/public`
3. Set up MySQL database in Hostinger panel
4. Update `.env` with database credentials
5. Run migrations via SSH: `php artisan migrate --seed`

### VPS Hosting

1. SSH into your VPS
2. Clone the project
3. Install dependencies: `composer install --no-dev --optimize-autoloader`
4. Build frontend: `cd frontend && npm install && npm run build`
5. Configure Nginx/Apache to point to `backend/public`
6. Set up MySQL, update `.env`
7. Run: `php artisan migrate --seed && php artisan config:cache`

### Important Hostinger Settings

- PHP version: 8.2+
- Set document root to `backend/public`
- Enable SSL (required for PWA)
- Set the following in `.env`:
  - `APP_URL=https://yourdomain.com`
  - `SANCTUM_STATEFUL_DOMAINS=yourdomain.com`

## Project Structure

```
Distribution/
├── backend/                 # Laravel 12 + Filament
│   ├── app/
│   │   ├── Enums/          # PHP enums (OrderStatus, etc.)
│   │   ├── Models/         # Eloquent models
│   │   ├── Filament/       # Admin panel resources
│   │   ├── Http/
│   │   │   ├── Controllers/Api/  # REST API
│   │   │   ├── Requests/         # Validation
│   │   │   └── Resources/        # JSON transformers
│   │   └── Services/       # Business logic
│   ├── database/
│   │   ├── migrations/     # Schema
│   │   └── seeders/        # Demo data
│   └── routes/api.php      # API routes
├── frontend/                # React PWA
│   ├── src/
│   │   ├── components/     # UI & layout components
│   │   ├── features/       # Feature modules
│   │   ├── lib/           # API, DB, i18n, utils
│   │   ├── stores/        # Zustand state
│   │   └── types/         # TypeScript types
│   └── public/            # PWA assets
└── README.md
```

## Currency

All monetary values are in Georgian Lari (₾ GEL).

## License

Proprietary - BSC Distribution
