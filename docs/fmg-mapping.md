# FMG mapping

Evidence: `Cursor-FMG-Integration-Prompt.md` plus live read-only discovery on `SBS_RSF` as login `AI` (2026-09-16). No exploratory INSERT. Writes stay disabled.

## Implemented

| Neutral field | FMG source | Status |
|---|---|---|
| customerId | OrgView.IdOrg (string) | Implemented, assigned via EXISTS OrgGvariView.IdGvari |
| itemId | ProdView.IdProd, leading zeros preserved | Implemented |
| presellerId | users.id_gvari mapped by admin | Implemented; unmapped → 403. FMG also has UserNameGvariView (UserName → IdGvari) for their own logins |
| unitPrice | ProdView.Fasi{N} via CASE on OrgView.FG | **Candidate.** Live: OrgView.FG is 1–60; ProdView has Fasi1–Fasi60. View SQL does not encode the CASE. Invalid/NULL fail closed |
| quantity | OnlineReal2.Raod numeric(12,4) | Validated; overflow rejected |
| erpOrderId | OnlineReal1.IdOnlineReal1 | Status read only. Live: IDENTITY(1,1) on both header and lines |

Authorization SQL uses EXISTS, not assignment joins.

Live object types: catalog objects are views (`OrgView`, `ProdView`, `OrgGvariView`, `GvariView`, `ActionsView`, `UserNameGvariView`). Action filter tables and `OnlineReal1`/`OnlineReal2` are user tables. No triggers on OnlineReal1/2.

## Promotions

Tables confirmed: ActionsView, ActionsSagad, ActionsProd, ActionsQseli, ActionsFg, ActionsOrgT, ActionsReg, ActionsGvari, ActionsOrgCategory.

Live ActionsT counts: 3 = ფასდაკლება თანხის მიხედვით; 2 = ფიქსირებული ფასი; 1 = პროდუქციის დამატება; -1 = ნულოვანი აქცია.

Any in-window Active promotion is listed as **indicative**. Algorithm (AND/OR, Exclude, Prioriteti, stacking, DataEnd inclusive) is unresolved → submit returns `PRICING_RULE_UNRESOLVED`.

## UseProdList / ShowInPocket

If OrgView.UseProdList = 1, catalog is not opened (`ASSORTMENT_UNRESOLVED`). Live tenant: every OrgView row has UseProdList = 0. OrgShowPocket=1 for 14952 orgs, 0 for 49031. ShowInPocket=0 / OrgShowPocket=0 fail closed.

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
