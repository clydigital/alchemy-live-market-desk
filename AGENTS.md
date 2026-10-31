# Bluebelly coding and provider-audit instructions

## Non-negotiable API failure gate (31 October 2026)
Read `docs/FREE_FINANCIAL_API_ADAPTERS.md` before any diagnosis involving FRED, ALFRED, FMP, BEA, EIA, Alpha Vantage or Bluebelly provider ingestion. The user has already configured FRED_API and FMP_API in **Vercel Team Shared Environment Variables**. The Vercel project-level `filter_project_envs` inventory is NOT evidence that a team Shared Variable is absent.

Do not state that a key is missing, invalid, unconfigured in Vercel or needs recreation until an authorised check covers the Vercel Team Shared Variable, its project link, its target environment (Production / Preview), the active deployment and the server-runtime visibility. If the connected tools cannot enumerate Team Shared Variables, explicitly report `SHARED_SCOPE_UNVERIFIED`, not `MISSING_KEY`. A key absent from `process.env` is only `NOT_VISIBLE_TO_RUNNING_DEPLOYMENT`. Never print, export or rotate secrets as a diagnostic shortcut.

Use the existing protected `/api/cron/provider-acceptance` receipt (FRED, FMP, BEA) and owner-only `/market-tools?check=providers` (FRED, EIA, Alpha Vantage) to distinguish HTTP status, entitlement, rate limit, network failure, dated source rows, and whether canonical ingestion/write/readback occurred. The runtime presence flags are explicitly **not** a Vercel Shared Variable inventory. Existing source adapters and low-volume requests should be reused; do not add an extra scheduled task. A working ChatGPT data plugin does not prove the Bluebelly backend has ingested anything.

For incident closeout report: provider; deployed project and SHA; exact env aliases; Team Shared Variable checked/unknown; project attachment checked/unknown; target env checked/unknown; runtime presence; HTTP/entitlement result; last dated reading; canonical ingestion status; exact next action. Never elevate unverified inputs to canonical Evidence, Motion, Story, or Regime.

Bluebelly is the only new user-facing destination. Preserve the backend's existing authentication, research ownership, schedules, canonical evidence rules, historical IDs, and publication approval boundaries.
