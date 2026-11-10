# Bluebelly daily Treasury yield recording — source-only repair (10 Nov 2026)

## Observed baseline (read-only audit)

At 10 Nov 2026 07:44 UTC, the production read endpoint `/api/rates/source-integrity` returned five official **9 Nov** Treasury observations (2Y, 5Y, 10Y, 20Y, 30Y), all with publisher update `2026-11-10T01:03:51Z`. That is the correct latest completed U.S. session in Malaysian daylight hours on 10 Nov.

The canonical Market Dossier was dated 6 Nov and referenced Treasury values of 5 Nov. This is not an upstream loss: the 7 Nov **BLUEBELLY_SOURCE_ONLY_V1** cutover intentionally disabled scheduled Dossier/Story/report generation. Existing `market_series_observations` is a legacy **monthly end-of-period** snapshot table last populated 3 Aug, not the live daily Treasury collection store. Do **not** reactivate scheduled Dossier or coerce daily rows into that monthly series.

## Narrow implementation

- Add private `treasury_daily_closes` with official constant-maturity *par yields* (not intraday trade closes), exact tenor and observation day, publisher update time, original URL and insertion time.
- Existing authorised 09:30/21:30 MYT source-acquisition slots collect **up to 35 published sessions per tenor**, one fetch of the existing Treasury adapter. No new cron, vendor, model, or second Story/Dossier writer.
- Deterministic ID `treasury-nominal:<tenor>:<date>:<yield>` makes repeat runs no-op; revised published values append new records. The original row is never rewritten. No synthetic weekends/holidays or lookahead.
- A bounded readback of each tenor's latest exact ID verifies durable ingestion, including idempotent duplicate runs.
- Failures report `UPSTREAM_UNAVAILABLE`, `PARTIAL` or `PERSISTENCE_FAILED` without blocking the existing news acquisition and without filling missing values.
- RLS enabled, no anon/authenticated direct table grants. Service-role server only. Public `/api/rates/close-ledger` reveals only approved official government yields, dates and freshness status; no private Dossier or owner details.
- The pre-existing `/api/rates/source-integrity` remains unchanged and may report `PENDING_REBASE` by design in source-only mode. Use `close-ledger` to audit the data recorder independently of disabled Dossier reasoning.

## Deployment and acceptance

1. Merge only after TypeScript, targeted tests and CI pass.
2. Apply the SQL migration with the approved migration deployment path **before enabling the collector**. If database and application deployments are separate, coordinate them; a missing table produces a logged nonblocking persistence failure.
3. Verify first real scheduled run's `scheduled_treasury_daily_closes` event. Record each tenor's actual source date, readback status, source URL and count of newly inserted rows.
4. Read `treasury_daily_closes` directly by series and observation date; all five published 9 Nov tenor rows should be present once the first successful scheduled collection runs.
5. Independently check `GET /api/rates/close-ledger`: five `RECORDED` states when latest source sessions have been stored. During publisher-to-cron delay, `PENDING_COLLECTION` is expected, not a broken pipeline; a 12-hour publisher-to-recorder lag is flagged.
6. Repeat the cron: zero new identical rows; unchanged recorded observations. Verify a later business session increments each supported tenor without inventing weekend values.
7. Verify the original source-only mode still returns `not_required` for scheduled Dossier/HTML/PDF and neither triggers a model nor writes Story/Regime/Hybrid.

This improves measured market-close durability without changing the research-to-reasoning cutover decision. Equity/ETF and non-US sovereign close persistence require separately specified provider licences, sessions and source contracts.
