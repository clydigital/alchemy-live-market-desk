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


## Mandatory Shared Environment Variable diagnostic gate (31 October 2026)

**Source-of-truth incident rule for humans, ChatGPT research plugins and coding agents:**
FRED_API and FMP_API were declared configured in Vercel **Team Shared Environment Variables**, not necessarily project-level variable listings. Never infer their absence from `filter_project_envs` or any project-level-only inventory. Do not request the user to recreate keys without these checks.

Use this order for every reported API failure (including BEA, EIA, Alpha Vantage, SEC and third-party market providers):

1. Read **this document** and the deployed provider-adapter names/fallbacks. Establish which team, Vercel project, deployment SHA and environment actually run the request.
2. Inspect **Vercel Team Settings → Environment Variables → Shared**. Confirm the named key exists **without revealing its value**. If a connector cannot enumerate Shared Variables, record `SHARED_SCOPE_UNVERIFIED`, not `MISSING_KEY`.
3. Verify the **Shared Variable's project attachment**, its **Production/Preview target**, and whether the key was changed *after* the active deployment; redeploy when necessary. A project-level key list cannot complete this check.
4. Run the **authenticated existing** `/api/cron/provider-acceptance` diagnostic (FRED/FMP/BEA) or owner-only `/market-tools?check=providers` check (FRED/EIA/Alpha). Respect existing cron schedules and low free-tier quotas; do not create another task or fetch secret values.
5. Classify separately: `SHARED_SCOPE_UNVERIFIED`, `NOT_VISIBLE_TO_RUNNING_DEPLOYMENT`, `HTTP_AUTH_FAILURE`, `PLAN_OR_ENDPOINT_RESTRICTED`, `RATE_LIMITED`, `NETWORK_OR_TIMEOUT`, `EMPTY_OR_INVALID_PAYLOAD`, `STALE_OR_NOT_INGESTED`, or `READY_WITH_DATED_ROWS`.
6. Verify **canonical ingestion and source-dated readback** independently of HTTP 200 / provider readiness before declaring a Bluebelly research feed fixed.

The authenticated provider-acceptance receipt now includes `credentialDiagnostics` with non-secret runtime-presence statuses and an explicit `missingFromVercelClaimSupported: false`. **Runtime absence is not proof that the team Shared Variable is absent.** The diagnostic cannot independently enumerate Vercel Shared Variables; project attachment and target remain unverified until inspected in Team Settings or through a separately authorised shared-variable inventory tool.

**Closeout contract:** Every incident must report `project + deployment`, `Shared scope checked/unknown`, `project attachment checked/unknown`, `production target checked/unknown`, `runtime visibility`, `provider response/entitlement`, `source observation date`, and `canonical write/readback`. An unknown is a finding, not a reason to make up a configuration verdict.


## Owner-only five-provider manual readback (31 October 2026)

The existing protected `/market-tools?check=providers` now checks FRED, EIA v2, Alpha Vantage, FMP earnings-calendar and BEA GDP/PCE **in parallel**. Its result is read-only, limited to server-side `process.env` key presence and dated source responses, and cached for 60 minutes. FMP event dates are **calendar-event dates**, not observations of issuer earnings outcomes. BEA results use official quarterly period identifiers. FMP `restricted` is displayed as `limited`; HTTP 403/entitlement failures must never be rewritten as missing keys.

The UI explicitly states that it **cannot enumerate or attest Vercel Team Shared Variables, project attachments or environment targets**, and that successful direct API reads do not prove canonical research ingestion. The existing `/api/cron/provider-acceptance` keeps its schedule and CRON_SECRET protection; neither a new poll nor a new canonical writer was added.

To finish an incident, inspect Team Shared scope through authorised Vercel Team Settings or a proper shared-variable inventory tool and confirm actual ingestion/dated readback separately. If those tools or auth are unavailable, return `SHARED_SCOPE_UNVERIFIED` / `CANONICAL_INGESTION_UNVERIFIED`, not a key-reset recommendation or a success claim.


## Verified BEA adapter defect and repair — 31 October 2026

Official BEA NIPA API guide (https://apps.bea.gov/api/_pdf/bea_web_service_api_user_guide.pdf, Appendix B) states that **each GetData request may specify only one NIPA TableName**. The old Bluebelly sensor incorrectly submitted `T10101,T20304` in one TableName parameter. This is a provider request bug, **not evidence of a missing Shared Environment Variable**. The corrected adapter makes two bounded parallel calls, one per registered table, and only declares `ready` when both return valid dated observations. A one-table failure is `partial` with explicit safe per-table status and no canonical evidence promotion.

The old GDP table `T10101` measures **percent change from the preceding period in real GDP**. It was incorrectly labelled as a GDP level. Current-dollar GDP level uses `T10105`, line 1, with BEA-supplied metric and unit multiplier retained; PCE price index remains `T20304`, line 1. Neither is mislabelled as a monthly release, and retrieval time is not a publication time. The protected BEA sensor returns a failure status for partial results; the scheduled provider-acceptance receipt also fails its ready gate on partial BEA data.

Official source: BEA API NIPA Appendix B; BEA Table 1.1.1 vs 1.1.5; BEA PCE Price Index table 2.3.4. No key values or credential-bearing URLs are recorded.
