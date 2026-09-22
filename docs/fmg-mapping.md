# FMG mapping

Evidence: `Cursor-FMG-Integration-Prompt.md` plus live read-only discovery on `SBS_RSF` as login `AI` (2026-09-16). No exploratory INSERT. Writes stay disabled (`FMG_WRITES_ENABLED=false`).

SQL access is server-side only: Laravel on the office origin PC. VPN/LAN clients open `https://gbc.office.local` and never connect to port 1433. See `docs/office-vpn.md`.

## Implemented

| Neutral field | FMG source | Status |
|---|---|---|
| customerId | OrgView.IdOrg (string) | Implemented, assigned via EXISTS OrgGvariView.IdGvari |
| orgCode | OrgView.IdOrg (string) | Implemented; shown as Code |
| orgT / idOrgT | OrgView.OrgT / OrgView.IdOrgT | Implemented; shown on customer detail |
| canRealHalfComp | OrgTView.CanRealHalfComp by OrgView.IdOrgT | Implemented; gates half-pack on new order together with ProdView.CanRealHalfComp |
| sagad | OrgView.Sagad | Implemented; shown on customer detail |
| qseli / idQseli | OrgView.Qseli / OrgView.IdQseli | Implemented; shown on customer detail |
| latitude / longitude | OrgView.Lat / OrgView.Lon | Implemented. `0.0000000000` is treated as no pin. Opening that customer shows "ობიექტი არ არის დაპინული". |
| balance | AmountOfCustomerPocket.tanxa by idorg | Implemented; shown as დავალიანება |
| minOrderTotal / maxOrderTotal | SagadValiBlockView.MinReal / MaxReal by OrgView.Sagad | Implemented for the new-order review. Live: `Sagad` is unique in the view (10933 rows), `0` means no limit on that side, and 35 of 14959 pocket-visible customers have no row at all — both cases map to `null`. `POST /v1/orders/quote` returns `orderLimits`. The review step only **warns** ("მინიმალური/მაქსიმალური შეკვეთის ლიმიტი არის …") and does not block saving. `AlwaysBlock` / `ValiBlock` in the same view are debt-block flags and are not read. |
| itemId | ProdView.IdProd, leading zeros preserved | Implemented |
| prodS / prodT | ProdView.ProdS then ProdView.ProdT (FMG tables ProdS / ProdT) | Implemented. Product list and new-order picker: first compact filter is ProdS, then ProdT of the selected ProdS. `GET /v1/items/taxonomy` returns the pocket hierarchy. Item list accepts `prodS` and `prodT`. Lists are `Active=1` (and ShowInPocket=1) ordered by ProdT, then Prod. |
| presellerId | users.id_gvari mapped by admin | Implemented; unmapped → 403. List GvariView with `php artisan fmg:presellers`. Do not invent IDs. UserNameGvariView exists for FMG's own logins, not this app's auth |
| unitPrice | ProdView.Fasi{N} via CASE on OrgView.FG | Implemented. Customer FG 59 → Fasi59. Catalog without customer omits price; product list prices after a customer is selected. |
| quantity | OnlineReal2.Raod numeric(12,4) | New order quantity is **packs** (ProdView.CompRaod). 1 pack with CompRaod=24 writes Raod=24 pieces. Half pack (0.5 → 12 pieces) only if OrgTView.CanRealHalfComp=1 for the customer's IdOrgT **and** ProdView.CanRealHalfComp=1; otherwise 422 `HALF_PACK_NOT_ALLOWED`. Quote lines return `quantity`/`packQuantity` (packs) plus `pieces` (FMG Raod). |
| erpOrderId | OnlineReal1.IdOnlineReal1 | Status read only. Live: IDENTITY(1,1) on both header and lines |

Authorization SQL uses EXISTS, not assignment joins.

Live object types: catalog objects are views (`OrgView`, `ProdView`, `OrgGvariView`, `GvariView`, `ActionsView`, `UserNameGvariView`). Action filter tables and `OnlineReal1`/`OnlineReal2` are user tables. No triggers on OnlineReal1/2.

## Promotions

Tables confirmed: ActionsView, ActionsSagad / ActionsSagadView, ActionsProd / ActionsProdView, ActionsQseli / ActionsQseliView, ActionsFg, ActionsOrgT, ActionsReg / ActionsRegView, ActionsGvari, ActionsOrgCategory.

Live ActionsT counts: 3 = ფასდაკლება თანხის მიხედვით; 2 = ფიქსირებული ფასი; 1 = პროდუქციის დამატება; -1 = ნულოვანი აქცია.

Customer-scoped listing (GET `/v1/promotions?customerId=`) and quote:

- Date window: Active=1, Data ≤ today, DataEnd null or ≥ today (Asia/Tbilisi). IdActionsT = -1 skipped.
- AND filters. Empty table for that IdActions = that dimension matches everyone. Filled table = customer must match: ActionsOrgT.IdOrgT, ActionsQseliView.IdQseli, ActionsRegView.IdReg, ActionsOrgCategory.IdOrgCategory, ActionsSagadView.Sagad, ActionsFg.Fg (string compare to OrgView.FG; no CAST of Fg to int). ActionsGvari is not used.
- ActionsSagadView.Exclude=1 for this Sagad → action does not apply.
- Products from ActionsProdView left-joined to ProdView for Fasi columns. Empty product list → applies to all products for Prioriteti competition.
- **Quantity window** (in selling units, not packs) is read per type, each type using only its own columns:
  - IdActionsT=3 → `Raod >= ActionsRaod3`, no upper bound.
  - IdActionsT=2 → `ActionsRaod1 <= Raod <= ActionsRaod2`, where `ActionsRaod2 = 0` means no upper bound (761/820 active actions carry the 30000 sentinel, 44 carry 0, 13 carry 10000, 2 carry 3000).
  - Other types (gift) have no window; they never reach pricing.
  - `ActionsRaod` is unused (0/820). Live FMG cross-populates the columns — T=3 actions that only fill `ActionsRaod1` (264916 "RC 3ლ, 88 ცალიდან 39%", R1=450) and T=2 actions that only fill `ActionsRaod3` (264826 "Horeca ლუდი 0.5ლ 40 ცალიდან 32%", R3=760) are therefore ungated and apply at any quantity.
- **Prioriteti:** the quantity window is part of eligibility, so candidates are first reduced to actions whose window contains the line quantity, and only then does **lower Prioriteti win** (tie → smaller IdActions). A bulk action with a higher threshold no longer blocks a smaller-tier action the line does qualify for. A line matching no window keeps its standard price.
- GET `/v1/promotions` has no quantity, so it shows **one winner per (product, window)** — every quantity tier stays visible with its own price, and Prioriteti only resolves ties inside a tier. The page renders the minimum (`5 ცალიდან`); the upper bound is enforced on quote only.
- **Orders are charged at list price. Promo values are display-only** (temporary policy). Quote lines carry the standard price in `unitPrice`, and the winning promo is reported alongside as `promoUnitPrice` / `promoDiscount` with a basket-level `promoDiscountTotal`. `total` is the full list amount, `priceState` is always `computed` and `unresolvedRules` is always empty, so no promotion can block a submit. Reverting to applied pricing means feeding `promoUnitPrice` back into the line price in `DefaultPricingService` / `FakePricingService`.
- The winner price still computed for IdActionsT=2 (ActionsFasi) and IdActionsT=3 (FromStandardFasi=1 → OrgT 102/110 Fasi1, 106 Fasi60, 111 Fasi59; FromStandardFasi=0 → Fasi{N} for FG; ActionsPercent 0–100 is a discount → Fasi × (1 − percent/100)).
- Thresholds are in selling units: "Rad rain 0.25ლ, 96 ცალიდან" carries Raod3=2304 (96 × 24).
- A resolved promo price must be > 0 and below the list price. Live FMG has T=2 rows with ActionsFasi=0; those are not free goods, so they are hidden from GET `/v1/promotions` and reported as no promo at all rather than a ₾0.00 unit price.
- IdActionsT=1 (gift) is still unresolved, but it now simply produces no promo information; the order goes through at list price.

## UseProdList / ShowInPocket

If OrgView.UseProdList = 1, catalog is not opened (`ASSORTMENT_UNRESOLVED`). Live tenant: every OrgView row has UseProdList = 0. Customer list and detail only include OrgShowPocket=1 (14952 orgs); OrgShowPocket=0 (49031) is hidden. ShowInPocket=0 / OrgShowPocket=0 also fail closed on the product catalog.

## Order write (still disabled)

`FMG_WRITES_ENABLED=false`. Dummy 0/empty is not used just to satisfy NOT NULL.

Live schema facts:

| Column | Live finding |
|---|---|
| IdOnlineReal1 / IdOnlineReal2 | IDENTITY; omit on INSERT, capture via OUTPUT |
| RecieveData | DEFAULT `(getdate())` |
| IdVisitStatus | DEFAULT `((-1))`; live majority is -1 |
| GpsDistance | DEFAULT `((0))` |
| IdRealT | DEFAULT `((1))`; live majority is 1 |
| Lat / Lon | DEFAULT `((0))` |
| Shen | DEFAULT `('')` |
| IdRealWayBill1 | SQL DEFAULT `(0)`, but common live values are `-1` → **do not assume 0** |
| IdReal1Pocket | SQL DEFAULT `(0)`; live values are real pocket IDs, not 0 |
| Tanxa | computed `([Raod] * [Fasi])`; omit on INSERT |
| Exported / Active | NOT NULL, no default. Unexported rows mix Active 0 and 1. `spOnlineCheckStatus` treats Exported=1 as already processed |
| IdMdz | NOT NULL, FK to `Mdz`, no default. `AI` cannot SELECT `Mdz` (table includes `MdzPass`). Unresolved |
| PK / FK | PK_OnlineReal1; PK_OnlineReal2; unique clustered IX_OnlineReal2; FK to Org, Gvari, Mdz, Prod, OnlineReal1 |

App-owned: users, id_gvari, erp_quotes, erp_order_receipts (idempotency). FMG schema is not migrated by Laravel. Receipt DB ≠ FMG SQL Server → live writes stay off until a recoverable cross-db approach exists.
