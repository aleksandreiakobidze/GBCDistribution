# BSC Distribution System

A full-cycle distribution management PWA for pre-selling operations. Built with Laravel 12 + Filament v5 (backend) and React 19 + Vite (frontend).

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
- SQLite (development) / MySQL (production)

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
npm install
```

### 4. Start development servers

Terminal 1 (Backend):
```bash
cd backend
php artisan serve
```

Terminal 2 (Frontend):
```bash
cd frontend
npm run dev
```

- Frontend: http://localhost:5173
- Backend API: http://localhost:8000/api
- Admin Panel: http://localhost:8000/admin

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

Features:
- Full CRUD for all entities
- Dashboard with KPI widgets and charts
- Order management with status workflows
- Inventory monitoring
- User management with roles

## Building for Production

### 1. Build frontend

```bash
cd frontend
npm run build
```

This outputs the built React app to `backend/public/app/`.

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
