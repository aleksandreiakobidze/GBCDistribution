# Cursor task: არსებული დისტრიბუციის პროექტის FMG ინტეგრაცია

## გამოყენება

ეს ფაილი ჩაამატე არსებული პროექტის root-ში და Cursor Agent-ს უთხარი:

> წაიკითხე Cursor-FMG-Integration-Prompt.md სრულად, შეამოწმე არსებული frontend/backend და განახორციელე აღწერილი FMG ინტეგრაცია. მხოლოდ გეგმით არ გაჩერდე: დაწერე API, გადააერთე frontend, დაამატე საჭირო SQL დიაგნოსტიკა და ტესტები. შეინარჩუნე არსებული მუშაობა. დაუდგენელი FMG ბიზნესწესები არ გამოიგონო; დანარჩენი სამუშაო გააგრძელე და კონკრეტული ბლოკერები ცალკე მომწერე ქართულად.

ქვემოთ არის თვითკმარი ტექნიკური დავალება და მოწოდებული SQL სქემიდან ამოღებული შესაბამისი ობიექტების სვეტები. ეს არის განხორციელების პრომპტი, არა უკვე გაშვებული ან FMG-ზე გამოცდილი API.

---

## 1. Goal and project constraints

You are working inside an EXISTING distribution application with a frontend and backend. Inspect its source, repository instructions, dependencies, authentication, database access, API contracts, draft/order flow, and run commands before editing.

Current ERP: FMG, a Georgian application using Microsoft SQL Server on the local network. Future ERP: Exact. The exact Exact product, version, schema, and supported write integration have not been provided.

Implement now:

1. Use FMG as the authoritative source for products, organizations, preseller assignments, prices, and promotions.
2. Let an authenticated preseller see and order only for assigned organizations.
3. Submit order header and lines to dbo.OnlineReal1 and dbo.OnlineReal2 through a server-side API.
4. Rewire the existing frontend to this API; preserve its design, Georgian text, mobile usability, and unrelated features.
5. Keep a stable provider-neutral contract so an Exact adapter can later replace the FMG adapter.

Reuse the existing backend language/framework and authentication when viable. Do not rewrite to C# merely because a previous architecture suggestion mentioned it. Do not add a second backend service if the existing one can host this adapter. Do not remove the backend: refactor it into a thin integration API responsible for authentication, authorization, validation, pricing orchestration and SQL access.

FMG owns master data and subsequent ERP processing. Remove duplicate master-data creation/editing from the normal distribution UI or make these screens read-only. Preserve app-owned data such as users, assignments to ERP identities, drafts, idempotency receipts, and logs where needed. Do not delete existing tables or records as part of this refactor. Identify obsolete paths and retire them only after replacements work.

Deployment is local: browser/mobile browser -> existing backend/API on a LAN server -> FMG SQL Server. No mandatory cloud service. A phone's localhost is not the LAN server. Configure the API URL or use a same-origin reverse proxy. Keep SQL access server-side and document local hostname, port, HTTPS certificate trust, firewall, and restart procedure. Remote access outside the LAN is outside this task.

## 2. Evidence: actual FMG schema

The appended metadata comes from the user's database column export. It proves names, column types and nullability only. It DOES NOT prove keys, identity columns, defaults, trigger behavior, stored procedures, permissions, business rules, or modification tracking. Check live metadata if a connection is configured. Do not invent a connection string, password, database name or server address.

| Entity | Verified object | Important columns |
|---|---|---|
| Products | dbo.ProdView | IdProd, Prod, Ert, Active, Fasi1 through Fasi60, CompRaod, ProdCode, MomcProdCode, ShowInPocket, CD |
| Customers | dbo.OrgView | IdOrg, Org, OrgCode, Address, Phone, Active, FG, Sagad, IdQseli, IdOrgT, IdReg, IdOrgCategory, UseProdList, OrgShowPocket, Lat, Lon, CD |
| Assignment and visit schedule | dbo.OrgGvariView | IdOrg, IdGvari, IdOrgGvari, MON through SUN, MONNum through SUNNum, TEL, TELNum |
| Presellers | dbo.GvariView | IdGvari, Gvari, IsPreseller, GvariActive |
| Possible existing username mapping | dbo.UserNameGvariView | IdUserName, UserName, IdGvari; this is NOT proof of an authentication mechanism |
| Promotion headers | dbo.ActionsView | IdActions, Data, DataEnd, Active, IdActionsT, ActionsT, Prioriteti, ActionsPercent, ActionsTanxa, FromStandardFasi, quantity fields |
| Promotion tax/entity scope | dbo.ActionsSagad | IdActions, Sagad, Exclude |
| Promotion products | dbo.ActionsProd | IdActions, IdProd, ActionsFasi, MustHave, ActionsProdRaod |
| Promotion chains | dbo.ActionsQseli | IdActions, IdQseli |
| Promotion price groups | dbo.ActionsFg | IdActions, Fg (nvarchar(20), not smallint) |
| Promotion organization types | dbo.ActionsOrgT | IdActions, IdOrgT |
| Promotion regions | dbo.ActionsReg | IdActions, IdReg |
| Other discovered scope candidates | dbo.ActionsGvari / dbo.ActionsOrgCategory | IdGvari / IdOrgCategory; determine whether FMG uses these for the relevant promotions |
| Incoming order header | dbo.OnlineReal1 | See complete write mapping below |
| Incoming order lines | dbo.OnlineReal2 | IdOnlineReal2, IdOnlineReal1, IdProd, Raod, Fasi, UN, CD, Tanxa |

User shorthand `actionssaga` corresponds to the found candidate `ActionsSagad`; `actionsidprod` corresponds to the found candidate `ActionsProd`. The literal shorthand names are absent from the supplied export. Use actual names and verify live object definitions.

## 3. Architecture and provider boundary

Create small interfaces/modules in the existing stack, not a microservice framework:

- CustomerRepository: list/get authorized customers and schedules.
- ProductRepository: list/get products allowed for a customer.
- PricingService: quote an order for an authorized customer using FMG rules.
- PromotionRepository/evaluator: retrieve and apply verified FMG promotion rules.
- OrderGateway: submit to ERP and retrieve authorized receipts/status.
- ErpProvider: compose these implementations; configuration `ERP_PROVIDER=fmg`.

Use Fmg implementations now. Expose neutral fields such as customerId, itemId, presellerId, unitPrice, quantity, erpOrderId. Keep names like IdOrg and IdGvari inside adapters/mapping documents. Expose external IDs consistently as strings, while binding validated native types in SQL. Preserve leading zeros in IdProd. For a future Exact provider, include the interface and a clearly unimplemented boundary only. Do not invent Exact SQL or pretend it works.

Do not maintain another authoritative copy of FMG products/customers. Caches are optional and disposable. Any cache must be scoped to provider/company, authenticated identity/assignments, customer price group, and appropriate pricing date. Clear user-specific data on logout/account switch. Assignment changes must revoke access even if a cache is warm.

## 4. Authentication and preseller isolation

Reuse secure existing login. Map the authenticated application identity to one verified FMG IdGvari, or explicitly configured multiple identities if required. Mapping is maintained server-side by an authorized administrator. No public signup endpoint may choose its own preseller ID or grant itself administrator access.

Inspect UserNameGvariView only as a possible mapping source: do not authenticate by username presence, accept a supplied IdGvari as proof of identity, guess FMG password formats, or expose FMG credentials. If the current app lacks authentication, implement local secure accounts using the existing framework's supported password hashing/session facilities and an explicit secure initial-admin setup. Never ship default credentials or a fallback universal preseller.

If the account is unmapped, reject FMG data access with a clear 403/application error. Resolve assignment context from the authenticated server session/token, not query/body `presellerId`.

All list, detail, search, price, promotion, quote, order write, receipt, history and status routes must enforce authorization. The SQL access pattern is:

```sql
SELECT o.IdOrg, o.Org, o.OrgCode, o.Address, o.Phone,
       o.FG, o.Sagad, o.IdQseli, o.IdOrgT, o.IdReg,
       o.IdOrgCategory, o.Lat, o.Lon
FROM dbo.OrgView AS o
WHERE EXISTS (
    SELECT 1
    FROM dbo.OrgGvariView AS og
    WHERE og.IdOrg = o.IdOrg
      AND og.IdGvari = @AuthenticatedIdGvari
)
-- Add parameterized filters, verified activity policy and stable pagination.
```

Use EXISTS rather than joining assignment rows into duplicate customers. Check the actual uniqueness of IdOrg in OrgView. Null Active behavior and mobile visibility flags require an explicit policy. Default fail closed for unknown/inactive eligibility, document it, and verify FMG's actual meaning before enabling ordering. Revalidate the preseller's active status and customer assignment for each write. Do not expose all price lists, customer financial fields, bank details or personal identity fields via SELECT *.

Preserve route schedules MON..SUN and sequence MONNum..SUNNum where the existing frontend needs them. A visit day is not automatically an authorization restriction: verify the business rule before disallowing an otherwise assigned customer on another day.

## 5. Product and customer pricing

OrgView.FG is smallint. ProdView has Fasi1..Fasi60. Candidate rule: FG=1 selects Fasi1, FG=2 selects Fasi2, etc. This is a strong mapping candidate, NOT a confirmed business rule. Verify using FMG definitions, current application logic, or known customer/product price examples.

Implement an explicit PriceGroupMapping configuration/adapter. A valid mapping must select a fixed allowlisted column; do not concatenate untrusted input into SQL identifiers. Prefer a fixed CASE/mapping. Return only the customer's selected price. Invalid/unmapped groups and NULL prices must yield a clear pricing error, never silently use Fasi1 or 0. Zero price, free promotional lines, inactive items, packaging and partial packs each need a verified rule.

Determine and document:

- Whether FasiN includes VAT; meaning of Dgg, DggIsNull and related flags. Do not assume Dgg is a percentage to add.
- Pricing/order/delivery date semantics and business timezone, configured explicitly (expected deployment Georgia/Asia/Tbilisi, verify).
- Quantity units: Ert, Unit, UnitName, CompRaod, ProdKoef and CanRealHalfComp. Do not assume pack count equals base-unit quantity.
- UseProdList and ShowInPocket/OrgShowPocket behavior. If a customer requires a product assortment and its source/rule is unresolved, do not expose an unrestricted orderable catalog for that customer.
- Rounding, line totals, discounts and order total rules.

Use decimal arithmetic internally for money and quantities, including in JavaScript via a decimal library if this is a Node project. Return monetary/quantity decimals as canonical decimal strings where needed to avoid client binary-float calculations. OnlineReal2.Fasi and Tanxa are legacy SQL float fields: convert only at the validated SQL boundary and explicitly test FMG's rounding compatibility. Raod is numeric(12,4), at most 8 integral and 4 fractional digits. Reject overflow and unintended precision loss. Do not round silently.

## 6. Promotions: preserve FMG behavior

Join promotion detail tables to ActionsView by IdActions only after validating actual definitions. Scope candidates are ActionsSagad.Sagad -> OrgView.Sagad, ActionsQseli.IdQseli -> OrgView.IdQseli, ActionsFg.Fg -> verified customer FG representation, ActionsOrgT.IdOrgT -> OrgView.IdOrgT, ActionsReg.IdReg -> OrgView.IdReg, ActionsProd.IdProd -> ProdView.IdProd. Sagad lengths differ (20 vs 100): do not truncate values to make matches. Fg is a string: do not perform unsafe blanket casts or assume all values are numeric.

Required behavior to discover and parity-test:

- Active/date-window rules and whether DataEnd is inclusive; do not invent end-of-day extensions.
- How restrictions across dimensions combine (AND/OR), multiple values within a dimension, and what an empty detail table means.
- Exclusion behavior of ActionsSagad.Exclude.
- IdActionsT types and quantity thresholds/steps: ActionsRaod, ActionsRaodPlus, OnlyExactRaod, ActionsRaod1/2/3, ActionsMaxRaod, ActionsProdRaod, MustHave.
- ActionsPercent, ActionsTanxa, ActionsFasi, FromStandardFasi and ActionsMaxDiscount.
- Priority direction of Prioriteti, tie-breaking, stacking, and whether calculations are per line or whole basket.
- Applicability of additional ActionsGvari and ActionsOrgCategory restrictions discovered in this schema. Do not ignore active restrictions because they were not in the user's shorthand list.

First reuse an existing FMG pricing procedure/function or application algorithm if found and understood. Otherwise implement only verified rules with FMG comparison fixtures. Do not silently treat every promotion as a simple percentage or select the cheapest promotion by guesswork. If pricing cannot establish whether an unresolved rule affects an order, return PRICING_RULE_UNRESOLVED and block final submission for that affected basket. Continue implementing customer/product reads, UI wiring, and other independent work. Clearly label candidate promotions versus a final computed price.

Provide one server-side quote endpoint; reuse the same pricing implementation on submit. Client unit prices, discount percentages, preseller IDs and totals are not authoritative. If the price changes between the displayed quote and submit, return a 409 PRICE_CHANGED with a fresh authorized quote and require user reconfirmation. Do not silently submit at a new price. Persist/replay an already committed idempotent request without repricing it.

## 7. Stable API contract

Adapt existing route names if necessary while keeping one documented contract. Suggested endpoints:

| Route | Behavior |
|---|---|
| Existing auth routes | Keep secure existing login/logout/session lifecycle |
| GET /api/v1/me | Current user and authorized preseller context; no secrets |
| GET /api/v1/customers | Assigned customers only, search and bounded stable pagination |
| GET /api/v1/customers/{customerId} | Authorized customer detail |
| GET /api/v1/items?customerId=... | Authorized assortment and customer-specific price state |
| GET /api/v1/items/{itemId}?customerId=... | Same authorization and pricing scope |
| GET /api/v1/promotions?customerId=... | Authorized promotion information, state whether indicative |
| POST /api/v1/orders/quote | Authoritative basket validation and pricing |
| POST /api/v1/orders | Atomic incoming-order submission with idempotency |
| GET /api/v1/orders/{erpOrderId}/status | Authorized FMG receipt/status using verified semantics |
| GET /api/v1/health | Minimal liveness; keep detailed DB diagnostics administrator-only |

Use stable keyset pagination where supported: e.g. verified unique IdOrg/IdProd ordering, default 100, maximum 500, hasMore and nextCursor. Tie the cursor to filters and identity context; do not let it override authorization. Avoid large offset scans and unlimited queries.

CD exists but is NOT proven to change on every update. OrgGvariView has no CD column in the export. Do not promise reliable changedSince synchronization based on these columns. Start with bounded online reads/refresh and honest cache freshness; add delta sync only after proving a change mechanism including assignment revocation and deletions. Avoid NOLOCK for authorization, pricing and order validation.

Suggested order request (illustrative IDs, not test credentials or real customer data):

```json
{
  "externalId": "b65be7b7-fccd-44c8-90fb-f93f15338bb0",
  "customerId": "12345",
  "quoteId": "server-issued-quote-id",
  "note": "შეკვეთა",
  "location": { "latitude": "41.7151000000", "longitude": "44.8271000000" },
  "lines": [
    { "itemId": "ITEM-001", "quantity": "12.0000" }
  ]
}
```

Do not add deliveryDate, warehouseId, driverId, visitStatus or documentType inputs as mandatory until their actual FMG mapping and valid values are known. Do not discard a business-required field silently: add it after verifying its destination/rule.

Example accepted response shape:

```json
{
  "externalId": "b65be7b7-fccd-44c8-90fb-f93f15338bb0",
  "erpOrderId": "123456",
  "status": "received",
  "message": "შეკვეთა მიღებულია FMG-ში დასამუშავებლად"
}
```

`received` means committed to OnlineReal1/2, NOT invoiced, posted or successfully processed by FMG. Do not guess Exported/Active/IdRealWayBill1 status meanings. Until verified, distinguish submission receipt from unavailable processing status in the API/UI.

Errors: 400 malformed input, 401 unauthenticated, 403 unmapped/forbidden or consistent scoped 404, 409 idempotency conflict/price change, 422 verified business validation failure, 503 source unavailable/unconfigured capability. Return a stable code, Georgian user message and correlationId. Never expose SQL text, connection strings, stack traces or another customer's existence through detailed errors.

## 8. Order write mapping and atomicity

Write to OnlineReal1/OnlineReal2 as requested, respecting FMG's real input contract. Before enabling writes, inspect object type, defaults, identity flags, keys, indexes, foreign keys, triggers and the established FMG incoming-order path. An INSERT can trigger business actions; do not run exploratory test inserts against production, even inside a rollback transaction. Use a disposable/local test copy for write tests and require explicit target configuration for live writes. Prepare implementation and tests without waiting for optional choices.

OnlineReal1 mapping:

| Column | Mapping/verification needed |
|---|---|
| IdOnlineReal1 int NOT NULL | Verify identity/sequence/established allocator. Never use MAX(id)+1 |
| IdOrg int NOT NULL | Authorized selected customer |
| IdGvari smallint NOT NULL | Verified server-side authenticated preseller |
| IdMdz smallint NOT NULL | Required FMG domain/mapping unknown; inspect references; do not assume warehouse or driver |
| Data smalldatetime NOT NULL | Verify order/delivery/document date meaning |
| Zedd nvarchar(30) NULL | Verify document numbering ownership; do not use for a UUID idempotency key |
| UN nvarchar(15) NULL | Verified FMG audit identity; reject overlength rather than truncate usernames |
| CD smalldatetime NULL | Verified FMG timestamp/default |
| Exported bit NOT NULL | Verify initial state and consumer workflow; do not guess |
| Active bit NOT NULL | Verify initial state/default |
| RecieveData datetime NOT NULL | Exact spelling; verify receipt time convention/default |
| IdRealWayBill1 int NOT NULL | Verify link/default/sentinel; do not manufacture 0 |
| IdReal1Pocket int NOT NULL | Verify source link/default/sentinel |
| Shen nvarchar(300) NULL | Order note, validated length |
| Lat / Lon numeric(18,10) NOT NULL | Validated location if supplied; absent location needs a documented FMG policy, not fake coordinates |
| IdVisitStatus smallint NOT NULL | Verify valid domain/status |
| GpsDistance int NOT NULL | Verify calculation/unit/default; do not guess |
| IdRealT smallint NOT NULL | Verify document type domain/mapping |

OnlineReal2 mapping:

| Column | Mapping/verification needed |
|---|---|
| IdOnlineReal2 int NOT NULL | Verified allocator; no MAX+1 |
| IdOnlineReal1 int NOT NULL | Actual inserted header identifier |
| IdProd nvarchar(20) NOT NULL | Validated authorized/orderable product |
| Raod numeric(12,4) NOT NULL | Quantity with verified unit and precision |
| Fasi float NOT NULL | Server-calculated price, verified VAT/discount meaning |
| UN nvarchar(15) NULL | Verified audit identity |
| CD smalldatetime NULL | Verified timestamp/default |
| Tanxa float NULL | Verified FMG line total formula and rounding; don't guess price × quantity if tax/promotion semantics differ |

All required columns must be resolved from verified defaults, server mappings or valid input. No dummy 0/empty strings just to satisfy NOT NULL. Use precise parameter types/lengths and explicit INSERT column lists. Capture generated IDs using a SQL Server mechanism compatible with existing triggers (for example OUTPUT INTO where required), not assumptions about ORM behavior.

One transaction/connection must encompass the durable idempotency claim, header, ALL lines and committed receipt. Roll back everything on any failure. Validate assignment/pricing with a documented consistency policy at submission. Do not acknowledge success until COMMIT is confirmed; handle a lost response via idempotent retry.

Durable idempotency is mandatory because users/mobile connections retry:

- Client generates externalId once per intended order and persists it across retry/reload. Use the same ID after an uncertain response; after a definitive price-change rejection, reconfirm the quote without creating a second committed order.
- Store an integration-owned receipt in a dedicated integration schema/table or an existing suitable durable store. Prefer the same SQL Server database transaction when possible; do not alter FMG-owned table structures for this. Provide a separate clearly scoped migration rather than auto-running ORM migrations on FMG.
- Define a unique key scoped by provider, company/database and authenticated application user plus externalId. Store request hash, real preseller/customer, ERP header ID, result and timestamps. Hash the canonical submitted business payload, including quote reference; ignore volatile transport headers.
- Same key/same payload returns the original committed receipt. Same key/different payload returns 409. Concurrent identical requests produce exactly one header. Check receipt replay before repricing but still enforce current user/receipt authorization.
- If the receipt store is in another database/connection and cannot share an atomic commit, implement a proven recoverable approach or leave live writes disabled with a precise blocker. An in-memory Map or post-commit best-effort log is insufficient.
- Do not purge receipts while the client's retry window or ERP reconciliation still requires them. Document retention and protect against duplicates after process restart.

Do not let the application mark orders Exported, posted or invoiced unless verified FMG workflow explicitly delegates this. UI editing after submission is outside scope until FMG supports it safely.

## 9. SQL discovery and missing-rule report

Create `sql/fmg-discovery.sql`: read-only diagnostics for the named objects. Include:

1. sys.objects/sys.schemas object type and schema; include views and synonyms if relevant.
2. sys.columns/sys.types including lengths, precision/scale, nullability, identity/computed flags, default definitions.
3. Primary/unique keys, indexes, foreign-key relationships for order header/lines and relevant references.
4. Trigger names, enabled state and definitions on OnlineReal1/2; view definitions for selected views via sys.sql_modules/OBJECT_DEFINITION when permitted.
5. Existing procedures/functions/dependencies that insert into OnlineReal1/2 or calculate prices/promotions. Note that encrypted definitions and dynamic SQL may prevent complete discovery; lack of visible metadata does not prove absence.
6. Targeted, bounded, explicitly selected examples for pricing groups, ActionsT/ActionsG types and order field domains when data access is available. Avoid customer personal data, credentials, and indiscriminate full-table exports.

Generate `docs/fmg-mapping.md` with every implemented mapping, evidence source and unresolved rule. Produce a short `docs/fmg-blockers.md` listing only remaining blockers after inspection, their affected capability, and the exact query/example needed to resolve them. Do not ask the user to supply the entire schema again: this file already contains the relevant column export.

High-impact unknowns to resolve include FG/Fasi mapping; promotion algorithm/priority; account-to-IdGvari mapping; IdMdz/IdRealT/IdVisitStatus values; order ID generation; all required header defaults; date/VAT/unit/rounding behavior; and whether FMG consumes incoming headers only after complete transactional insertion. Use existing code, verified FMG metadata and known successful FMG examples first.

## 10. Frontend refactor and local operation

- Inventory all existing API consumers before changes. Preserve existing business flows outside the integration scope.
- Replace mocks/static catalogs and duplicate CRUD data sources with the new API when FMG provider is enabled. Do not fall back to mock records if FMG fails.
- Customer picker shows only assigned customers. Changing customer invalidates the previous customer-specific prices, promotions and quote; revalidate or clearly clear the cart.
- Product screen shows unit, current customer price, and verified applicable promotion information. Unknown prices are unavailable, never zero.
- Quote before submit; handle price-change reconfirmation. Show retryable network errors and distinguish draft, pending/unknown submission result, received, and verified FMG processing status.
- Keep existing offline drafts if present; use durable externalId and retry queue if supported. An offline draft has provisional prices and must be revalidated online. Do not claim full offline ordering if it was not implemented and tested.
- Avoid destructive migrations and duplicate master-data administration. Keep app auth/configuration/receipt storage if needed.
- Document environment variables using placeholders: ERP_PROVIDER, FMG_SQL_SERVER, FMG_SQL_DATABASE, FMG_SQL_USER/password or supported integrated-auth configuration, API local host/port, business timezone and write-enable configuration. Secrets stay out of git, frontend bundles and logs.
- SQL credentials must have only required read permissions on selected views/tables plus narrowly scoped order-write/receipt permissions or EXECUTE on a reviewed wrapper procedure. Runtime login must not be db_owner. Prepare grants separately from application startup.
- Use parameterized SQL, connection pooling, timeouts, bounded payloads/line counts and transaction cleanup. CORS must match configured frontend origins; use the existing framework's CSRF protection if cookie-authenticated. Avoid wildcard credentialed CORS.
- Do not disable SQL certificate validation silently. Document certificate configuration for the local server and isolate any explicit development-only exception.
- Audit user, preseller, customer, externalId, ERP header ID, timing and outcome; avoid logging passwords/tokens/full customer payloads. Expose detailed diagnostics only to administrators.

## 11. Implementation sequence and verification

Work autonomously through:

1. Inspect project; document stack and source-of-truth changes briefly.
2. Add provider boundary, configuration, SQL connection and metadata diagnostics.
3. Implement identity mapping, authorization and customer/product reads with actual columns.
4. Implement verified customer pricing and promotion quote path; isolate unresolved cases.
5. Implement atomic order gateway, durable idempotency and receipt/status mapping.
6. Wire frontend end to end, preserve unrelated functions and local deployment.
7. Run build/lint and meaningful tests supported by the project; fix issues.
8. Report changed files, run instructions, passing tests and any capabilities blocked by missing FMG information. Speak to the user in Georgian.

Required meaningful tests:

- Two different presellers cannot read, search, quote, order for, or inspect receipts belonging to unauthorized customers. Spoofed presellerId does not alter scope. Unmapped identity fails closed.
- Duplicate assignment rows do not duplicate customers; changed assignment revokes access including warm-cache paths.
- At least two confirmed FG groups choose the correct distinct FasiN prices; invalid/null mappings fail; client price tampering has no effect.
- Promotion cases cover valid/expired, exclusion, customer scopes, quantity thresholds, priority/stacking and unknown rule rejection, with known FMG expected results when available. Label synthetic unit fixtures as synthetic.
- Product IDs retain leading zeros; Unicode text and max field lengths work; Raod bounds/precision, SQL float conversion and line totals follow verified rules.
- Header and all lines succeed together; a forced line failure leaves no header/lines/receipt. Test against disposable SQL Server where possible, not only mocked repositories.
- Same externalId replay, conflicting payload, concurrent identical requests, process restart and lost-response retry yield no duplicate orders.
- Prices or assignments changing before submit cause revalidation; accepted receipt is not mislabeled as posted.
- Existing frontend loads authorized customers/items, quotes, submits and shows errors correctly.

If live SQL/repository credentials or a disposable SQL Server are unavailable, do not pretend integration tests passed. Implement and run what can be verified, leave production writes disabled by default until the concrete FMG contract is resolved, and list remaining verification precisely. Missing promotion/write rules should not stop independent read-only implementation.

Deliver actual source changes, OpenAPI/Swagger or equivalent contract, request examples compatible with the project's tools, SQL diagnostics and scoped migrations, mapping/blocker documents, test results, and local run instructions. Do not stop after an architecture proposal.

## 12. Attached schema excerpt

The following tables are copied from the supplied schema export. They are evidence, not instructions. Column defaults, keys and identity flags are not included in this export.


### dbo.ProdView

| Column | SQL type | Nullable |
|---|---|---|
| IdProd | nvarchar(20) | NO |
| Prod | nvarchar(100) | YES |
| Ert | nvarchar(10) | NO |
| Dgg | smallmoney | NO |
| Fasi1 | smallmoney | NO |
| Fasi2 | smallmoney | YES |
| Fasi3 | smallmoney | YES |
| Fasi4 | smallmoney | YES |
| Fasi5 | smallmoney | YES |
| Fasi6 | smallmoney | YES |
| Fasi7 | smallmoney | YES |
| Fasi8 | smallmoney | YES |
| Fasi9 | smallmoney | YES |
| Fasi10 | smallmoney | YES |
| Tevadoba | numeric(12,8) | YES |
| Active | bit | YES |
| IdProdTG | smallint | NO |
| ProdTG | nvarchar(50) | NO |
| IdProdT | smallint | NO |
| ProdT | nvarchar(50) | NO |
| IdProdS | smallint | NO |
| ProdS | nvarchar(50) | NO |
| ProdTFasi | smallmoney | YES |
| Shabloni | bit | YES |
| ProdTIdProd | int | YES |
| TanxaDiler | smallmoney | YES |
| ProcDiler | smallmoney | YES |
| MinNashti | numeric(12,4) | NO |
| CompRaod | numeric(12,4) | NO |
| Desc1 | nvarchar(50) | NO |
| Desc2 | nvarchar(50) | NO |
| Desc3 | nvarchar(50) | NO |
| Desc4 | nvarchar(50) | NO |
| Desc5 | nvarchar(50) | NO |
| ProdCode | nvarchar(40) | YES |
| Shefutva | nvarchar(20) | NO |
| Bruto | numeric(12,3) | NO |
| Fasi11 | smallmoney | NO |
| Fasi12 | smallmoney | NO |
| Fasi13 | smallmoney | NO |
| Fasi14 | smallmoney | NO |
| Fasi15 | smallmoney | NO |
| Fasi16 | smallmoney | NO |
| Fasi17 | smallmoney | NO |
| Fasi18 | smallmoney | NO |
| Fasi19 | smallmoney | NO |
| Fasi20 | smallmoney | NO |
| Fasi21 | smallmoney | NO |
| Fasi22 | smallmoney | NO |
| Fasi23 | smallmoney | NO |
| Fasi24 | smallmoney | NO |
| Fasi25 | smallmoney | NO |
| Fasi26 | smallmoney | NO |
| Fasi27 | smallmoney | NO |
| Fasi28 | smallmoney | NO |
| Fasi29 | smallmoney | NO |
| Fasi30 | smallmoney | NO |
| Aqcizi | numeric(8,3) | NO |
| IsGadazidva | bit | NO |
| UN | nvarchar(15) | NO |
| CD | smalldatetime | NO |
| IdUnit | smallint | NO |
| UnitName | nvarchar(20) | NO |
| MomcProdCode | nvarchar(40) | NO |
| Unit | nvarchar(50) | NO |
| IdProdG | smallint | NO |
| ProdG | nvarchar(50) | NO |
| UploadProdCode | bit | NO |
| Position | nvarchar(50) | NO |
| IdProdCategory | smallint | NO |
| ProdCategory | nvarchar(50) | YES |
| IsVirtual | bit | NO |
| PicturePath | nvarchar(300) | NO |
| HasPic | bit | YES |
| AqciziCode | nvarchar(50) | NO |
| IsDggNulovani | bit | NO |
| ShowInPocket | bit | NO |
| Fasi31 | money | NO |
| Fasi32 | money | NO |
| Fasi33 | money | NO |
| Fasi34 | money | NO |
| Fasi35 | money | NO |
| Fasi36 | money | NO |
| Fasi37 | money | NO |
| Fasi38 | money | NO |
| Fasi39 | money | NO |
| Fasi40 | money | NO |
| Fasi41 | money | NO |
| Fasi42 | money | NO |
| Fasi43 | money | NO |
| Fasi44 | money | NO |
| Fasi45 | money | NO |
| Fasi46 | money | NO |
| Fasi47 | money | NO |
| Fasi48 | money | NO |
| Fasi49 | money | NO |
| Fasi50 | money | NO |
| Fasi51 | money | NO |
| Fasi52 | money | NO |
| Fasi53 | money | NO |
| Fasi54 | money | NO |
| Fasi55 | money | NO |
| Fasi56 | money | NO |
| Fasi57 | money | NO |
| Fasi58 | money | NO |
| Fasi59 | money | NO |
| Fasi60 | money | NO |
| PaletRaod | smallint | NO |
| MomcKoef | int | NO |
| ProdKoef | numeric(7,3) | NO |
| IsTara | bit | NO |
| CanRealHalfComp | bit | NO |

### dbo.OrgView

| Column | SQL type | Nullable |
|---|---|---|
| IdCity | smallint | NO |
| City | nvarchar(50) | NO |
| IdReg | smallint | NO |
| Reg | nvarchar(50) | NO |
| IdOrg | int | NO |
| Org | nvarchar(100) | YES |
| Address | nvarchar(100) | YES |
| Direk | nvarchar(50) | YES |
| Phone | nvarchar(50) | YES |
| Active | bit | YES |
| Shen | nvarchar(200) | YES |
| LegalAddress | nvarchar(100) | YES |
| Contact | nvarchar(50) | YES |
| Vada | int | YES |
| Limit | int | YES |
| FG | smallint | NO |
| Sagad | nvarchar(100) | YES |
| IdOrgT | smallint | NO |
| OrgT | nvarchar(50) | NO |
| IdStaat | smallint | NO |
| Staat | nvarchar(50) | NO |
| Raod | int | NO |
| Banki | nvarchar(50) | YES |
| Angarishi | nvarchar(50) | YES |
| Inv | nvarchar(50) | NO |
| InvRaod | smallint | NO |
| OrgCode | nvarchar(100) | YES |
| IdQseli | smallint | NO |
| Qseli | nvarchar(50) | NO |
| NeedFactura | bit | NO |
| ExportVali | bit | NO |
| ExportHistory | bit | NO |
| UseSimpleZedd | bit | NO |
| Nagdi | bit | NO |
| NeedJamuriFactura | bit | NO |
| OrgMiigo1 | nvarchar(50) | NO |
| OrgMiigo2 | nvarchar(50) | NO |
| OrgMiigo3 | nvarchar(50) | NO |
| ShowOrgMiigoForm | bit | NO |
| UN | nvarchar(15) | NO |
| CD | smalldatetime | NO |
| OrgIsCitizen | bit | NO |
| IdOrgCategory | smallint | NO |
| OrgCategory | nvarchar(50) | NO |
| DggIsNull | bit | NO |
| Lat | numeric(18,10) | NO |
| Lon | numeric(18,10) | NO |
| UseProdList | bit | NO |
| IdOrgTG | smallint | NO |
| OrgTG | nvarchar(50) | NO |
| CheckMac | bit | NO |
| InputOnlyBarcode | bit | NO |
| CheckSecondZedd | bit | NO |
| IdUbani | smallint | NO |
| Ubani | nvarchar(50) | NO |
| Chaibara1 | nvarchar(50) | NO |
| Chaibara2 | nvarchar(50) | NO |
| Chaibara3 | nvarchar(50) | NO |
| VadaByDay | bit | NO |
| PaymentDay | smallint | NO |
| ValiLimit | money | NO |
| IdOrgCompanyCategory | smallint | NO |
| OrgCompanyCategory | nvarchar(50) | NO |
| OrgDesc1 | nvarchar(200) | NO |
| OrgDesc2 | nvarchar(200) | NO |
| OrgDesc3 | nvarchar(200) | NO |
| OrgDesc4 | nvarchar(200) | NO |
| OrgDesc5 | nvarchar(200) | NO |
| OrgShowPocket | bit | NO |

### dbo.OrgGvariView

| Column | SQL type | Nullable |
|---|---|---|
| IdCity | smallint | NO |
| City | nvarchar(50) | NO |
| IdReg | smallint | NO |
| Reg | nvarchar(50) | NO |
| IdOrg | int | NO |
| Org | nvarchar(100) | YES |
| Address | nvarchar(100) | YES |
| Direk | nvarchar(50) | YES |
| Phone | nvarchar(50) | YES |
| Active | bit | YES |
| Shen | nvarchar(200) | YES |
| LegalAddress | nvarchar(100) | YES |
| Contact | nvarchar(50) | YES |
| Vada | int | YES |
| Limit | int | YES |
| FG | smallint | NO |
| Sagad | nvarchar(100) | YES |
| IdOrgT | smallint | NO |
| OrgT | nvarchar(50) | NO |
| IdStaat | smallint | NO |
| Staat | nvarchar(50) | NO |
| Raod | int | NO |
| Banki | nvarchar(50) | YES |
| Angarishi | nvarchar(50) | YES |
| Inv | nvarchar(50) | NO |
| InvRaod | smallint | NO |
| OrgCode | nvarchar(100) | YES |
| IdOrgGvari | int | NO |
| MON | bit | NO |
| TUE | bit | NO |
| WED | bit | NO |
| THU | bit | NO |
| FRI | bit | NO |
| SAT | bit | NO |
| SUN | bit | NO |
| TEL | bit | NO |
| MONNum | int | NO |
| TUENum | int | NO |
| WEDNum | int | NO |
| THUNum | int | NO |
| FRINum | int | NO |
| SATNum | int | NO |
| SUNNum | int | NO |
| TELNum | int | NO |
| IdManag | smallint | NO |
| Manag | nvarchar(50) | NO |
| IdSuper | smallint | NO |
| Super | nvarchar(50) | NO |
| IdGvari | smallint | NO |
| Gvari | nvarchar(50) | NO |
| IdQseli | smallint | NO |
| Qseli | nvarchar(50) | NO |
| ExportVali | bit | NO |
| ExportHistory | bit | NO |
| UseSimpleZedd | bit | NO |
| OrgMiigo1 | nvarchar(50) | NO |
| OrgMiigo2 | nvarchar(50) | NO |
| OrgMiigo3 | nvarchar(50) | NO |
| ShowOrgMiigoForm | bit | NO |
| Chaibara1 | nvarchar(50) | NO |
| Chaibara2 | nvarchar(50) | NO |
| Chaibara3 | nvarchar(50) | NO |
| GvariPiradiNom | nvarchar(15) | NO |
| GvariLimit | money | NO |
| OrgIsCitizen | bit | NO |
| IdOrgCategory | smallint | NO |
| OrgCategory | nvarchar(50) | NO |
| Lat | numeric(18,10) | NO |
| Lon | numeric(18,10) | NO |
| UseProdList | bit | NO |
| IdOrgTG | smallint | NO |
| OrgTG | nvarchar(50) | NO |
| CheckMac | bit | NO |
| InputOnlyBarcode | bit | NO |
| CheckSecondZedd | bit | NO |
| IdUbani | smallint | NO |
| Ubani | nvarchar(50) | NO |
| VadaByDay | bit | NO |
| PaymentDay | smallint | NO |
| ValiLimit | money | NO |

### dbo.GvariView

| Column | SQL type | Nullable |
|---|---|---|
| IdManag | smallint | NO |
| Manag | nvarchar(50) | NO |
| IdSuper | smallint | NO |
| Super | nvarchar(50) | NO |
| IdGvari | smallint | NO |
| Gvari | nvarchar(50) | NO |
| FG | smallint | YES |
| SalAparati | nvarchar(20) | YES |
| AgebaProc | smallmoney | YES |
| GegmaTanxa | money | NO |
| IdSalaro | smallint | NO |
| Salaro | nvarchar(50) | NO |
| ZeddPrefics | nvarchar(10) | NO |
| GvariPiradiNom | nvarchar(15) | NO |
| GvariLimit | money | NO |
| IdGvariSac | smallint | NO |
| GvariSac | nvarchar(200) | NO |
| IsPreseller | bit | NO |
| ExportZedd | bit | NO |
| GvariActive | bit | NO |
| IdCashMachine | smallint | NO |
| CashMachine | nvarchar(50) | NO |
| IdMan | smallint | NO |
| Man | nvarchar(50) | YES |
| GPSDevice | nvarchar(50) | YES |
| CanChangeMarsh | bit | NO |

### dbo.UserNameGvariView

| Column | SQL type | Nullable |
|---|---|---|
| IdUserNameGvari | int | NO |
| IdUserName | smallint | NO |
| UserName | nvarchar(50) | NO |
| IdGvari | smallint | NO |
| Gvari | nvarchar(50) | NO |
| Super | nvarchar(50) | NO |

### dbo.ActionsView

| Column | SQL type | Nullable |
|---|---|---|
| IdActions | nvarchar(6) | NO |
| Actions | nvarchar(50) | NO |
| Data | smalldatetime | NO |
| DataEnd | smalldatetime | NO |
| IdActionsT | smallint | NO |
| ActionsRaod | int | NO |
| ActionsRaodPlus | int | NO |
| OnlyExactRaod | bit | NO |
| ActionsRaod1 | int | NO |
| ActionsRaod2 | int | NO |
| Prioriteti | int | NO |
| ActionsPercent | numeric(5,2) | NO |
| ActionsTanxa | numeric(8,2) | NO |
| FromStandardFasi | bit | NO |
| Active | bit | NO |
| CD | datetime | NO |
| UN | nvarchar(20) | NO |
| ActionsT | nvarchar(50) | NO |
| IdActionsG | smallint | NO |
| ActionsG | nvarchar(50) | NO |
| ActionsMaxRaod | int | NO |
| ActionsMaxDiscount | int | NO |
| ActionsRaod3 | int | NO |

### dbo.ActionsSagad

| Column | SQL type | Nullable |
|---|---|---|
| IdActionsSagad | int | NO |
| IdActions | nvarchar(6) | NO |
| Sagad | nvarchar(20) | NO |
| Exclude | bit | NO |
| UN | nvarchar(50) | YES |
| CD | smalldatetime | YES |

### dbo.ActionsProd

| Column | SQL type | Nullable |
|---|---|---|
| IdActionsProd | int | NO |
| IdActions | nvarchar(6) | NO |
| IdProd | nvarchar(20) | NO |
| ActionsFasi | smallmoney | NO |
| UN | nvarchar(50) | YES |
| CD | smalldatetime | YES |
| MustHave | bit | NO |
| ActionsProdRaod | int | NO |

### dbo.ActionsQseli

| Column | SQL type | Nullable |
|---|---|---|
| IdActionsQseli | int | NO |
| IdActions | nvarchar(6) | NO |
| IdQseli | smallint | NO |
| UN | nvarchar(50) | YES |
| CD | smalldatetime | YES |

### dbo.ActionsFg

| Column | SQL type | Nullable |
|---|---|---|
| IdActionsFg | int | NO |
| IdActions | nvarchar(6) | NO |
| Fg | nvarchar(20) | NO |
| UN | nvarchar(50) | YES |
| CD | smalldatetime | YES |

### dbo.ActionsOrgT

| Column | SQL type | Nullable |
|---|---|---|
| IdActionsOrgT | int | NO |
| IdActions | nvarchar(6) | NO |
| IdOrgT | smallint | NO |
| UN | nvarchar(50) | YES |
| CD | smalldatetime | YES |

### dbo.ActionsReg

| Column | SQL type | Nullable |
|---|---|---|
| IdActionsReg | int | NO |
| IdActions | nvarchar(6) | NO |
| IdReg | smallint | NO |
| UN | nvarchar(50) | YES |
| CD | smalldatetime | YES |

### dbo.ActionsGvari

| Column | SQL type | Nullable |
|---|---|---|
| IdActionsGvari | int | NO |
| IdActions | nvarchar(6) | NO |
| IdGvari | smallint | NO |
| UN | nvarchar(50) | YES |
| CD | smalldatetime | YES |

### dbo.ActionsOrgCategory

| Column | SQL type | Nullable |
|---|---|---|
| IdActionsOrgCategory | int | NO |
| IdActions | nvarchar(6) | NO |
| IdOrgCategory | smallint | NO |
| UN | nvarchar(50) | YES |
| CD | smalldatetime | YES |

### dbo.ActionsT

| Column | SQL type | Nullable |
|---|---|---|
| IdActionsT | smallint | NO |
| ActionsT | nvarchar(50) | NO |

### dbo.ActionsG

| Column | SQL type | Nullable |
|---|---|---|
| IdActionsG | smallint | NO |
| ActionsG | nvarchar(50) | NO |

### dbo.OnlineReal1

| Column | SQL type | Nullable |
|---|---|---|
| IdOnlineReal1 | int | NO |
| IdOrg | int | NO |
| IdMdz | smallint | NO |
| IdGvari | smallint | NO |
| Data | smalldatetime | NO |
| Zedd | nvarchar(30) | YES |
| UN | nvarchar(15) | YES |
| CD | smalldatetime | YES |
| Exported | bit | NO |
| Active | bit | NO |
| RecieveData | datetime | NO |
| IdRealWayBill1 | int | NO |
| IdReal1Pocket | int | NO |
| Shen | nvarchar(300) | YES |
| Lat | numeric(18,10) | NO |
| Lon | numeric(18,10) | NO |
| IdVisitStatus | smallint | NO |
| GpsDistance | int | NO |
| IdRealT | smallint | NO |

### dbo.OnlineReal2

| Column | SQL type | Nullable |
|---|---|---|
| IdOnlineReal2 | int | NO |
| IdOnlineReal1 | int | NO |
| IdProd | nvarchar(20) | NO |
| Raod | numeric(12,4) | NO |
| Fasi | float | NO |
| UN | nvarchar(15) | YES |
| CD | smalldatetime | YES |
| Tanxa | float | YES |
