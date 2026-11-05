# X Wire shared social discovery handoff — 28 October 2026

## Ownership and canonical boundary
- One persisted private source ledger: `x_wire_accounts` and `x_wire_posts` on Supabase with service-role-only access, provider leases and exact X post IDs.
- Source owners: @Bluekurtic, @HFI_Research, @OilandEnergy, **@HormuzReport**, @TheStudyofWar, @Currentreport1, @arena, **@KobeissiLetter**, @FirstSquawk, **@zerohedge**, **@TGLetter**, **@macropaperr** (12). Historical ZeroHedge exclusion withdrawn on 30 October 2026; @GordianKnotDev remains excluded. Source assignment never proves factual claims.
- One private owner experience: `https://bluebelly-desk.vercel.app/owner/x-wire` remains Google-OAuth plus active allowlist.
- One bounded read-only handoff: `https://bluebelly-desk.vercel.app/api/x-wire/discovery` reports up to 12 **UNVERIFIED_SOCIAL_LEAD** entries with original post URLs/IDs, handle, publication/retrieval time, maximum 240-character public-post excerpts, theme and discovery priority, plus aggregate coverage only. No private account errors, cursor/leases, privileged posting state, service-role credentials, or server-side source refresh are exposed. A failed DB read is HTTP 503, not an empty 'quiet' feed. Only the exact Bluebelly hostname/path is public.
- The existing morning/evening Vercel research acquisition invokes the same persisted X Wire and the same pure market-themed triage. Up to 12 qualified market leads go to the **existing** research intake, not to a shadow writer or new cron.
- The existing two-hour **ChatGPT MacroPulse Market Watch** reads this public-safe handoff first (when accessible) rather than independently scanning the same twelve active source profiles every time. It may independently check the **original X post and linked primary source** when a material event merits investigation, and may fall back to targeted X discovery if the handoff is unavailable. Notion full Post then Log remains MacroPulse's sole publication authority; no new scheduled task.

## Ranking and observation limits
- Supported discovery categories: Hormuz/oil/tankers/shipping/LNG, macro rates/yields/FX/Fed, geopolitics/conflict/tariffs, equities/AI/earnings/capex and corporate actions.
- Source emphasis for **HormuzReport** and **KobeissiLetter** affects *attention order only*, not reliability, evidence grade or verification status.
- Max 12 promoted discoveries, max 3 per account and 5 per leading theme; 48-hour recent eligible intake; dedupe by post ID and original URL; exclude bare reposts and explicit X exclusions. Work budgets are independent of persisted raw backlog.
- Account **health** proves only observed provider-window retrieval; it does not establish source truth, chart accuracy or market reaction. Social content is non-evidentiary and *does not* set `original_verified`, story thesis, source-check verification or force a published Notion entry.
- Source URLs, event vintage, publication timestamps, actual observation timestamps and the strongest counterexample must be checked with independent **original** evidence before a material claim becomes an article/report/Story fact. No new Story writer, third reasoning engine or standalone Research Gap worker.

## Verification / acceptance
1. `@HormuzReport` confirmed by live FxEmbed public timeline with original authored posts, then idempotently registered in Supabase. `@KobeissiLetter` remains one row.
2. GitHub CI: full tests, typecheck, production Next build, database contracts.
3. Production: deployment READY, public handoff GET 200 **without OAuth** with truthful 12-source coverage and noncanonical flags, private owner X Wire still authenticated.
4. Confirm persisted HormuzReport checkpoint and actual posts after due-source scan; check no duplicates, X Wire health and data timestamps; do not claim healthy 12/12 until source is observed.
5. Check next natural MacroPulse Notion Post and Log: references real original X IDs from shared feed or discloses fallback; do not claim the handoff proved until that readback.

**30 October source update:** `@GordianKnotDev` is removed from active X Wire scanning, public discovery, source-health totals and MacroPulse fallback checks; historical records remain audit-only. ZeroHedge restored and TGLetter added on 30 October, subject to verified database migration and deployment. No other account eligibility changes.


## 4 November 2026 roster reconciliation

The Macro Paper (@macropaperr) is an authorised twelfth **discovery** source. Its production Supabase account was registered earlier but remained `unconfigured` because production code scanned the previous eleven-source roster. The source must be checked by the existing scheduled X collector after deployment, with true `last_completed_at`/checkpoint; inclusion in `X_CORE_ROSTER` alone does **not** prove ingestion. The public read-only endpoint `/api/x-wire/discovery` supports up to twelve ranked leads and separately reports `coverage.monitored` and `coverage.healthy`; a successful HTTP 200 does not make the feed complete or verify an underlying market claim. The existing user exclusion of @GordianKnotDev persists.


## 5 November 2026 roster addition

The user requested **@BeginnerTrades** (https://x.com/BeginnerTrades/) as a 13th attributed X Wire discovery account. Include it through the existing `X_CORE_ROSTER`, owner-only durable collector, and read-only shared discovery handoff; register its state idempotently as `unconfigured` in `x_wire_accounts` and preserve all account checkpoints. No new cron, scheduling, canonical writer, or automatic evidence admission. The ordinary source priority applies until independently justified; social chart/trading claims remain unverified leads. Treat the first provider retrieval, original post IDs, and due-source account checkpoint as separate production acceptance tests. Historical 12-source coverage results above describe earlier observations, not the new state.

## 6 November 2026 roster addition

The user requested **@OddStats** (https://x.com/OddStats) as a 14th attributed discovery account. Add it to the existing private X Wire and public-safe MacroPulse discovery roster with a `statistics` focus, plus an idempotent `unconfigured` registration in `x_wire_accounts`. Preserve the existing source budgets, excluded handle, checkpoints, privacy and no-new-scheduler boundary. The user-provided profile URL is not proof of live FxEmbed retrieval or the accuracy of any post's statistics. Confirm provider identity, exact original post IDs, dated metrics and external primary evidence before interpreting or publishing a claim; separately verify migration application, production scan, and downstream handoff.
