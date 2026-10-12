# Free financial API adapters — controlled pilot

These are optional, read-only provider clients. They do not schedule themselves, mutate canonical Evidence, create Stories, or publish Dossier/Notion. Live Desk remains the single research owner.

## Credential names

The user configured Vercel Shared Environment Variables under these exact names:

- FRED_API — FRED API v1, including ALFRED vintage_dates; optional fallback FRED_API_KEY
- FMP_API — Financial Modeling Prep stable REST API; optional fallback FMP_API_KEY
- SEC_USER_AGENT — already configured for primary SEC EDGAR; no SEC API key

In Vercel Team Settings → Environment Variables, Shared Variables must be linked to the alchemy-live-market-desk project and Production environment. Check project linkage before expecting server access. Shared settings alone are not proof of deployed entitlement. A redeployment is required for functions to consume newly changed variables. Never use a browser-side NEXT_PUBLIC_ key, log secrets, or copy keys into GitHub/Notion.

## Source roles

1. SEC EDGAR: authoritative consolidated US issuer facts and filing accession/provenance.
2. FRED/ALFRED: Treasury yields, breakevens, spreads, and vintage-aware historical macro observations; vintageDate must be pinned for point-in-time comparison.
3. FMP: optional vendor cross-check for cash-flow statements, income/balance statements, estimates, and earnings calendar. It is not a source of canonical SEC identity; its statement capex is signed negative, while primary SEC cash PP&E is conventionally an absolute expense. Never compare these without normalizing sign, fiscal period, currency, entity and measurement scope.

Provider keys are deliberately absent from provenance URLs and returned result structures. Actual HTTP requests are made only when the caller explicitly invokes an adapter. Missing or denied credentials fail closed and produce a gap, not an invented value or silently substituted source.

## Pilot functions

- readFredSeries("DGS10", { vintageDate: "2026-10-09" })
- readFredSeries("BAMLH0A0HYM2")
- readFmpRecords({ endpoint:"cash-flow-statement", symbol:"AMZN", period:"quarter" })
- readFmpRecords({ endpoint:"analyst-estimates", symbol:"NVDA", period:"quarter" })
- readFmpRecords({ endpoint:"earnings-calendar", from:"2026-10-01", to:"2026-10-31" })

Use one or two low-volume requests to test each key once the shared variables are linked and a deployment has picked them up. FMP's Basic tier may restrict statements and estimates; mark unavailable/restricted and retain SEC as source of truth. Do not schedule bulk polling on Basic's low-volume allowance.

## Release gates

1. Verify Shared Environment Variables are actually linked to project/Production; do not inspect or print their values.
2. Run unit tests and typecheck on PR.
3. Execute a controlled, authenticated server-side smoke test with one FRED daily series and one FMP Basic-eligible endpoint, recording only status, observation/filing date, source, and provider entitlement. Do not record the credential-bearing request URL.
4. Validate source identity/units/periods and licence terms, including FMP redistribution rights, before connecting to canonical Evidence.
5. Only after passing these checks should a separate PR wire approved inputs through Research Gate / Dossier and existing monitoring cadence. No new reasoning engine or concurrent schedule.
