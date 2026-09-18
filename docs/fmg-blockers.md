# FMG blockers

დარჩენილი ბლოკერები. დაუდგენელი წესები არ არის გამოგონილი.

## 1. FG → FasiN (დადასტურება)

- Capability: საბოლოო ფასი
- Live: `OrgView.FG` არის 1–60; `ProdView`-ში არის `Fasi1`…`Fasi60`. View-ის SQL ამ CASE-ს არ შეიცავს.
- Candidate: FG=N → FasiN. ჯერ არ არის დადასტურებული FMG UI-ის მაგალითით.
- Example: ერთი IdOrg FG=1 და ერთი FG=2, იგივე IdProd, FMG-ში ნაჩვენები ფასები.

## 2. პრომოების ალგორითმი (ნაწილობრივ)

- Resolved (app): empty-filter=all; ActionsSagadView Exclude=1; quantity window per type (T=3 → ActionsRaod3; T=2 → ActionsRaod1..ActionsRaod2 with 0 = no cap); window filters candidates before Prioriteti, then lower Prioriteti wins; each (product, window) tier is listed separately; zero ActionsFasi produces no promo; T=2 / T=3 display formulas (see `fmg-mapping.md`).
- **No promo currently affects money.** By decision, orders are quoted and submitted at list price and the winning promo is shown as "this is what would have come off" only. That mitigates every pricing risk below for as long as the policy holds, but each item must still be answered before promo prices are charged again.
- Still unresolved: IdActionsT=1 gift quantity; ActionsTanxa; multi-action stacking beyond Prioriteti.
- **ActionsPercent is a discount off list** (`Fasi × (1 − percent/100)`). Confirmed against live FMG: Rad Rain 4860103352378 Fasi59 = ₾1.28, sibling T=2 action 260991 ("5 შეკვრა 33%") stores ActionsFasi = ₾0.86 = 1.28 × (1 − 0.33), and T=3 action 261864 ("14%", 48 ცალიდან) now shows ₾1.10 rather than ₾0.18. Revisit only if an FMG example contradicts this.
- Accepted consequence of the strict per-type split: actions whose type does not match the populated column carry no threshold and apply at any quantity — T=3 filling only `ActionsRaod1` (264906-264916, e.g. "RC 3ლ, 88 ცალიდან 39%" R1=450) and T=2 filling only `ActionsRaod3` (264825/264826, "Horeca ლუდი 0.5ლ 40 ცალიდან 32%" R3=760). If FMG in fact reads the other column for these, they are currently shown too widely.
- Open question: `OnlyExactRaod` is set on 26 active actions. If it means "quantity must equal the threshold" rather than ">=", those lines currently show a promo they should not; needs an FMG example before implementing.
- Example still needed: ერთი წარმატებული FMG შეკვეთა + ActionsView row-ები იმავე Sagad/FG/IdProd-ზე.

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

## 5. გარე წვდომა (Cloudflare — გადავადებული)

ამ ეტაპზე წვდომა არის ოფისის VPN + `https://gbc.office.local`. Cloudflare named tunnel და ახალი საჯარო დომენი **არ** არის მიმდინარე ბლოკერი.

კონფიგი რჩება გამორთული: [`deploy/cloudflared/config.yml`](../deploy/cloudflared/config.yml), ჩეკლისტი [`cloudflare-tunnel.md`](cloudflare-tunnel.md). `geobeer.ge` / Microsoft 365 უცვლელი.

VPN/DNS/firewall მოთხოვნები: [`office-vpn.md`](office-vpn.md). SQL 1433 VPN კლიენტებზე **არ** იხსნება.
