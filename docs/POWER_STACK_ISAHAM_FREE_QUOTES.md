# Power Stack iSaham Malaysia quote pilot — 10 November 2026

## Verified setup
- Bluebelly / Vercel project `alchemy-live-market-desk` has a **secret** `iSaham_API_KEY` in Production and Preview (project metadata checked; value never read, printed, or committed).
- Existing private Supabase scheduler calls `/api/cron/power-stack/quotes` at **23:15 UTC Monday–Friday**, not on Vercel Cron.
- Only authenticated owner snapshots are read. Malaysia eligibility requires explicit `position.currency=MYR`, `currency=MYR`, `market=MYX/MY/BURSA`, or the `.KL/.MY` suffix. An ambiguous bare ticker is NEVER presumed Bursa.
- No upgrade requested or required: official iSaham Free allowance **500 credits/month**, single `/v1/stocks/quote?symbol=CODE` at **1 credit/quote**, **2 requests/second, 20/minute**, no bulk; `/v1/account/usage` costs zero credits.

## Implementation / safety
- The production-only adapter uses the HTTP `Authorization: Bearer` header. It never sends the key in a URL, never sends it to browser JavaScript or logs.
- Check free credits before scanning, reserve **50 credits**, cap each run to **12** distinct uncached Bursa codes, pace requests at >650 ms apart.
- Prevent repeat same-MYT-day quote spending by looking up today's existing source-attributed ingestions.
- Failed/missing provider responses remain `Unavailable`. All MYR observations are stored under their owner's original Power Stack ticker in the existing private table.
- iSaham `last_updated_timestamp` is a **batch start** (not last trade or validated live timestamp). Persist `timestamp_basis=upstream_batch` and `source_recorded_at`. Never substitute `metadata.timestamp` for absent batch time.
- The owner page displays `MYR` and explicitly labels batch dates. No fabricated quote time, FX conversion, issuer fundamentals, or PEG values.

## Remaining limitations
- iSaham **Free** does NOT include `/v1/stocks/fundamentals` (Basic+), nor forward estimates for PEG. This adapter fetches quotes only.
- No unauthorised auto-polling on other endpoints. The iSaham connector key is not an entitlement to FMP/Longbridge production data.
- Bursa corporate actions, code/warrant validity, and whether the upstream batch is stale all require future independent checks.
- Official docs: https://api.isaham.my/docs and pricing: https://api.isaham.my/pricing .
- Production smoke test must confirm one successful scheduled/authenticated response, provider quota, and owner-scoped MYR row readback before declaring this integration complete.
