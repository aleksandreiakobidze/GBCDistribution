# Office VPN + ლოკალური HTTPS origin

ამ ეტაპზე გარე წვდომა არის **ოფისის VPN**, არა Cloudflare Tunnel. ახალი საჯარო დომენი გადავადებულია.

```
Phone / laptop (office Wi‑Fi or VPN)
  → https://gbc.office.local   (TCP 443 only)
  → Caddy (mkcert TLS) on the office origin PC
  → Laravel http://127.0.0.1:8080   (SPA /  and API /api, same origin)
  → FMG SQL on the LAN (this PC only; never from the VPN client)
```

Frontend იყენებს ფარდობით `/api`. ტელეფონზე `localhost` ან Vite `:5173` არ გაიხსნას.

SQL პორტი **1433** VPN-ში, როუტერზე და Caddy-ში **არ** შედის. ამ ჰოსტზე LAN FMG/Pocket კვლავ იყენებს 1433-ს (ეს მანქანა SQL-იც არის).

`geobeer.ge` და Microsoft 365 nameserver/MX **არ იცვლება**.

Cloudflare: [`cloudflare-tunnel.md`](cloudflare-tunnel.md) და [`deploy/cloudflared/config.yml`](../deploy/cloudflared/config.yml) რჩება სამომავლოდ; `cloudflared` service **არ** დგება.

---

## სერვერის გაშვება (ეს კომპიუტერი)

სრული ავტო-სტარტი reboot-ის შემდეგ: [`deploy/windows/bsc-api.nssm.md`](../deploy/windows/bsc-api.nssm.md).

### 1. წინაპირობები

- PHP 8.2+ (`pdo_sqlsrv` / `sqlsrv` FMG-სთვის), Composer, Node.js 20+
- [NSSM](https://nssm.cc/)
- [Caddy](https://caddyserver.com/docs/install#windows) — მაგ. `C:\caddy\caddy.exe`
- [mkcert](https://github.com/FiloSottile/mkcert/releases)

### 2. Laravel `.env`

`backend/.env.example`-დან დააკოპირე `backend/.env` (არ ჩაიდოს git-ში):

```
APP_URL=https://gbc.office.local
SESSION_SECURE_COOKIE=true
SANCTUM_STATEFUL_DOMAINS=gbc.office.local,localhost,localhost:5173,127.0.0.1:5173,127.0.0.1:8080
TRUSTED_PROXIES=*
ERP_PROVIDER=fmg
FMG_WRITES_ENABLED=false
```

შეავსე `FMG_SQL_*`. 1433 მხოლოდ LAN-ზე, ამ ჰოსტიდან. Cloudflare ცვლადები დატოვე ცარიელი.

```powershell
cd backend
composer install
php artisan key:generate
php artisan migrate
```

Filament `/admin`: Users → FMG `IdGvari`. Unmapped ანგარიში `/api/v1/*` მონაცემებზე იღებს 403.

### 3. SPA + TLS + სერვისები

```powershell
cd frontend
npm install --legacy-peer-deps
npm run build:spa

# Administrator PowerShell, repo root:
.\deploy\caddy\generate-certs.ps1
.\deploy\windows\install-origin.ps1 -LanSubnets '192.168.0.0/24' -VpnSubnets 'YOUR_VPN_SUBNET'
```

`YOUR_VPN_SUBNET` ჩაანაცვლე რეალური VPN pool-ით (მაგ. `10.8.0.0/24`). Laravel bind არის მხოლოდ `127.0.0.1:8080`.

### 4. შემოწმება

- ამ PC-დან: `http://127.0.0.1:8080/api/v1/health`
- LAN ან VPN-დან: `https://gbc.office.local/api/v1/health`
- SPA: `https://gbc.office.local/` — ლოგინი (Sanctum), პრესელერის გაფილტვრა
- Admin: `https://gbc.office.local/admin`

PWA/HTTPS: mkcert CA (`mkcert -CAROOT`\rootCA.pem) დააყენე ოფისის PC-ებსა და ტელეფონებზე.

დეველოპერის Vite (`npm run dev`) მხოლოდ ამ მანქანაზეა. VPN მომხმარებელი Vite-ს არ იყენებს.

---

## ქსელის ადმინისტრატორი — DNS, VPN route, firewall

შეავსე ფრჩხილებში placeholder-ები და გააკეთე მხოლოდ ეს. საჯარო დომენი და Cloudflare **არ** გჭირდება.

| ველი | მნიშვნელობა |
|---|---|
| შიდა ჰოსტი | `gbc.office.local` |
| Origin PC LAN IP | `YOUR_ORIGIN_LAN_IP` (ეს Windows ჰოსტი) |
| Office LAN CIDR | `YOUR_LAN_CIDR` (მაგ. `192.168.0.0/24`) |
| VPN client pool | `YOUR_VPN_SUBNET` (მაგ. `10.8.0.0/24`) |
| FMG SQL | `YOUR_FMG_SQL_IP:1433` (დოკუმენტირებული მაგალითი: `192.168.0.200:1433`) |
| ვებპორტი | TCP **443** only → origin PC |
| SQL VPN-დან | **აკრძალულია** |

### DNS

1. შიდა DNS A (ან split DNS): `gbc.office.local` → `YOUR_ORIGIN_LAN_IP`.
2. VPN კლიენტებმა **იგივე** სახელი უნდა გადაჭრან (VPN DNS ან split DNS). Public DNS-ზე ეს სახელი არ უნდა გამოჩნდეს.
3. `geobeer.ge` nameserver-ები, MX, autodiscover **არ** იცვლება.

DNS-მდე დროებით ამ origin PC-ზე `hosts`: `YOUR_ORIGIN_LAN_IP gbc.office.local` — მხოლოდ ტესტისთვის.

### VPN

1. **Split tunnel (რეკომენდებული):** VPN-ით მხოლოდ ოფისის საჭირო ქსელი, არა მთელი ინტერნეტი.
2. Route: `YOUR_ORIGIN_LAN_IP/32` (ან მინიმალური LAN route) VPN კლიენტებიდან origin-მდე.
3. ნება: VPN pool → origin `YOUR_ORIGIN_LAN_IP` **TCP 443**.
4. აკრძალვა: VPN pool → `YOUR_FMG_SQL_IP` **TCP 1433** (და სხვა SQL/RDP/SMB, თუ არ არის ცალკე მოთხოვნილი).
5. აკრძალვა: VPN pool → origin TCP **8080** და **1433** (Laravel loopback-ზეა; მაინც არ გაიხსნას).
6. VPN მომხმარებელს სჭირდება მხოლოდ ვებპორტი: `https://gbc.office.local`. SQL პირდაპირ არ სჭირდება.

### Firewall (როუტერი / SQL Server / origin)

**Origin Windows PC** (ესვეა FMG SQL; სკრიპტი [`deploy/windows/set-origin-firewall.ps1`](../deploy/windows/set-origin-firewall.ps1)):

- Allow inbound TCP 443 from `YOUR_LAN_CIDR` + `YOUR_VPN_SUBNET`
- Block inbound TCP 8080
- **არ** დაიბლოკოს 1433 მთელ LAN-ზე — FMG კლიენტები აქ რჩებიან
- თუ VPN pool ცნობილია: Block inbound TCP 1433 **მხოლოდ** `YOUR_VPN_SUBNET`-იდან

**WAN / perimeter:**

- Deny TCP 1433 from ინტერნეტიდან
- SQL არ გამოქვეყნდეს NAT/port-forward-ით

**ოფისის perimeter:** 1433, 8080, 445 არ გაიხსნას WAN-ზე.

### რა არ გააკეთო

- Cloudflare Tunnel / ახალი საჯარო დომენი — გადავადებულია
- `geobeer.ge`-ზე CNAME ან nameserver-ის შეცვლა
- VPN-ით სრული LAN „ყველაფერი ღიაა“
- ტელეფონის მითითება `http://127.0.0.1:5173` ან SQL IP-ზე
