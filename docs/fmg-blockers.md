# FMG blockers

დარჩენილი ბლოკერები. დაუდგენელი წესები არ არის გამოგონილი.

## 1. FG → FasiN (დადასტურება)

- Capability: საბოლოო ფასი
- Live: `OrgView.FG` არის 1–60; `ProdView`-ში არის `Fasi1`…`Fasi60`. View-ის SQL ამ CASE-ს არ შეიცავს.
- Candidate: FG=N → FasiN. ჯერ არ არის დადასტურებული FMG UI-ის მაგალითით.
- Example: ერთი IdOrg FG=1 და ერთი FG=2, იგივე IdProd, FMG-ში ნაჩვენები ფასები.

## 2. პრომოების ალგორითმი

- Capability: quote-ის საბოლოო ფასი და submit
- უცნობია: DataEnd inclusive, Exclude, AND/OR, Prioriteti მიმართულება, stacking, ActionsPercent/Tanxa/Fasi
- Example: ერთი წარმატებული FMG შეკვეთა + ActionsView row-ები იმავე Sagad/FG/IdProd-ზე.

## 3. OnlineReal1 ჩაწერის დარჩენილი სვეტები

- Capability: live write
- გადაწყდა live discovery-ით: IDENTITY header/lines; Tanxa = Raod*Fasi (computed); defaults RecieveData/IdVisitStatus/GpsDistance/IdRealT/Lat/Lon/Shen. ტრიგერები არ არის.
- ჯერ კიდევ უცნობია:
  - `IdMdz` (FK `Mdz`; `AI`-ს `Mdz`-ზე SELECT არ აქვს, ცხრილში არის `MdzPass` — პირდაპირ GRANT არ უნდა)
  - `Exported` / `Active` საწყისი მნიშვნელობა (unexported-ზე Active არის და 0 და 1)
  - `IdRealWayBill1` SQL default არის 0, live ხშირად -1
  - `IdReal1Pocket` incoming path-ის წყარო
- Query: `Mdz`-ის უსაფრთხო view (`IdMdz`, `IdGvari`, `MdzActive` — **არა** `MdzPass`) + ერთი ცნობილი pocket შეკვეთის header (PII-ს გარეშე).

## 4. Cross-database idempotency

- Receipt არის აპის SQLite-ში, FMG სხვა SQL Server-ზე. ერთი COMMIT შეუძლებელია.
- Live write რჩება გათიშული.

## 5. Cloudflare named tunnel (ცალკე დომენი)

ტელეფონი ჩვეულებრივი ინტერნეტით `192.168.0.200`-ს ვერ ნახავს. საჭიროა named tunnel, არა SQL პაროლი.

`geobeer.ge` და Microsoft 365 nameserver/MX **უცვლელი რჩება**. Tunnel-ის ჰოსტი არის სხვა მუდმივი დომენი (`YOUR_APP_HOSTNAME`), რომლის DNS-იც Cloudflare-ზეა. `trycloudflare.com` არ გამოიყენება.

რა გჭირდება შენგან:
1. ცალკე დომენი (არა `geobeer.ge`) + [Cloudflare](https://dash.cloudflare.com/sign-up) ანგარიში.
2. Cloudflare-ზე დაამატე **მხოლოდ** ეს ახალი დომენი; `geobeer.ge`-ს NS არ შეცვალო.
3. ოფისის კომპიუტერზე `cloudflared` login + named tunnel → `http://127.0.0.1:8080`.

სრული ჩეკლისტი: [`docs/cloudflare-tunnel.md`](cloudflare-tunnel.md). SQL პორტი 1433 tunnel-ში **არ** შედის.
