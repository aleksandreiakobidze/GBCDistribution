# Cloudflare named tunnel

**გადავადებულია.** ამ ეტაპზე გარე წვდომა არის ოფისის VPN: [`office-vpn.md`](office-vpn.md) (`https://gbc.office.local`). `cloudflared` Windows service **არ** დგება; [`deploy/cloudflared/config.yml`](../deploy/cloudflared/config.yml) placeholders რჩება სამომავლოდ.

Cloudflare აქ **არ არის** ფოსტა, FMG ბაზა ან აპის ლოგინი. ის მხოლოდ საჯარო კარია: ტელეფონი მობილური ინტერნეტით (VPN-ის გარეშე) ხსნის HTTPS-ს, Cloudflare მოაქვს ოფისის კომპიუტერზე Laravel-ამდე. SQL პორტი 1433 tunnel-ში **არ** შედის და როუტერზე არ იხსნება.

```
Phone (mobile data) → https://YOUR_APP_HOSTNAME → Cloudflare → cloudflared (office PC)
  → Laravel http://127.0.0.1:8080  (SPA /  and API /api, same origin)
  → FMG SQL 192.168.0.200:1433 on LAN only
```

`trycloudflare.com` დროებითია — არ გამოვიყენოთ.

## geobeer.ge / Microsoft 365 — უცვლელი

`geobeer.ge`-ს nameserver-ები, MX, autodiscover, SPF, DKIM **არ იცვლება**. ამ დომენზე CNAME-საც არ ვამატებთ.

Tunnel-ის ჰოსტი არის **სხვა მუდმივი დომენი** (`YOUR_APP_HOSTNAME`), რომლის DNS-იც Cloudflare-ზეა. იცვლება მხოლოდ იმ ახალი დომენის nameserver-ები, არა `geobeer.ge`.

Placeholders (ნამდვილი token/ID git-ში არ შედის):

- `YOUR_APP_HOSTNAME` მაგ. `app.example.com` (ცალკე დომენი ან მისი subdomain)
- `YOUR_TUNNEL_NAME` მაგ. `bsc-distribution`
- `YOUR_TUNNEL_ID`
- credentials JSON მხოლოდ ოფისის კომპიუტერზე

## შენი ნაბიჯები (დომენი + Cloudflare)

აგენტს Cloudflare ანგარიში/დომენი არ აქვს. გააკეთე ზუსტად ეს:

1. იყიდე ან აიღე **ცალკე** დომენი. არა `geobeer.ge`.
2. გახსენი https://dash.cloudflare.com/sign-up (უფასო ანგარიში).
3. Add site → **მხოლოდ ახალი** დომენი. Cloudflare მოგცემს ორ nameserver-ს.
4. ამ ახალი დომენის registrar-ზე ჩასვი Cloudflare-ის nameserver-ები. M365 / `geobeer.ge` არ შეეხო.
5. დაელოდე სანამ Cloudflare zone Active გახდება.
6. ამ ოფისის კომპიუტერზე **Administrator** PowerShell:

```powershell
winget install --id Cloudflare.cloudflared -e --accept-package-agreements --accept-source-agreements
cloudflared tunnel login
cloudflared tunnel create bsc-distribution
```

7. დაბეჭდილ Tunnel ID და credentials JSON-ის გზა ჩასვი `deploy/cloudflared/config.yml`-ში (`YOUR_TUNNEL_ID`, `credentials-file`, `YOUR_APP_HOSTNAME`).
8. DNS ჩანაწერი Cloudflare-ზე (CNAME ჰოსტი → tunnel):

```powershell
cloudflared tunnel route dns bsc-distribution YOUR_APP_HOSTNAME
```

9. დააკოპირე config და დააყენე Windows service (იხილე `deploy/windows/bsc-api.nssm.md`):

```powershell
New-Item -ItemType Directory -Force -Path "$env:USERPROFILE\.cloudflared" | Out-Null
Copy-Item "deploy\cloudflared\config.yml" "$env:USERPROFILE\.cloudflared\config.yml" -Force
cloudflared tunnel ingress validate
cloudflared service install
```

`config.yml` ingress უნდა იყოს მხოლოდ:

- `YOUR_APP_HOSTNAME` → `http://127.0.0.1:8080`
- catch-all `http_status:404`

არანაირი `1433` / `sqlserver` service.

10. Laravel `.env` ოფისის origin-ზე (როცა ჰოსტი უკვე რეალურია; სანამ არ არის, localhost დატოვე):

```
APP_URL=https://YOUR_APP_HOSTNAME
SESSION_SECURE_COOKIE=true
SANCTUM_STATEFUL_DOMAINS=YOUR_APP_HOSTNAME
TRUSTED_PROXIES=*
```

11. Frontend build + Laravel service: `deploy/windows/bsc-api.nssm.md` ან `deploy/windows/install-origin.ps1`.
12. ტელეფონზე **მობილური ინტერნეტით** (არა ოფისის Wi‑Fi) გახსენი `https://YOUR_APP_HOSTNAME`, გაიარე ლოგინი, შეამოწმე `/api/v1/health`.

Tunnel არ ცვლის აპის ლოგინს და პრესელერის `IdGvari` ავტორიზაციას.

როცა გექნება `YOUR_APP_HOSTNAME` და Tunnel ID, ჩასმა შეიძლება config/`.env`-ში — token-ები git-ში არ უნდა მოხვდეს.
