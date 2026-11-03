# Bluebelly research fallback and expenditure controls — 4 November 2026

**Scope:** the existing five Work automations and deployed Bluebelly research/reader stack. This is a fallback runbook, NOT authority to add a collector, public publisher, sixth task, paid subscription or change canonical evidence policy. Read-only verification uses original timestamps and existing source IDs. An output must distinguish `SOURCE_UNAVAILABLE`, `ORIGINAL_VERIFIED`, `REVIEW_PENDING`, `PUBLIC_RENDERED`, and `UNKNOWN`.

## Source → bounded fallback → terminal disposition

| Stage | Preferred existing input | First fallback | Final included/free fallback | Stop/receipt |
| --- | --- | --- | --- | --- |
| Macro/economic event | Official agency/central-bank original dated release; existing completed `macro_releases` + `macro_release_metrics` | Agency release archive / original downloadable PDF or official source endpoint using already configured TEAM SHARED credentials | Independently date-vintaged reporting for *reported* event only; original actual remains `SOURCE_PENDING` | Never infer actual from calendar `scheduled`, API key presence, nonmatching consensus or a future release. Record release ID/source/attempt/clock. |
| Company earnings / credit | Existing issuer IR/SEC original and parsed previous company checkpoint | Original SEC filing/issuer archive or authorized company investor relations | Dated corroborating reporting; no fabricated GAAP/adjusted same-basis consensus or private-company audited numbers | Mark `EARNINGS_REACTION_INCOMPLETE` if event-timed price absent, with smallest original missing source; do not rerun all 16. |
| Market reaction | Existing matched quote/observation and release timestamp | Authorised exchange/provider daily or after-hours as-of quote | Independently corroborated timestamped reporting | `REACTION_UNKNOWN`, never infer 5m move from daily/after-hours price or price causation from a headline. |
| X handoff | Read-only `https://bluebelly-desk.vercel.app/api/x-wire/discovery` JSON, IDs and source coverage | Connected Vercel `web_fetch_vercel_url` for the SAME endpoint (verified working 4 Nov), then authorised bounded read-only durable X Supabase ledger if present | Targeted original public post via connected browser/Work Cloud Browser, then FxEmbed proxy JSON; one targeted Exa; Firecrawl only where included balance verified and material | Feed HTTP error from one browser is NOT system outage. Validate `generatedAt`, source `last_completed_at`, original post `publishedAt`, lead freshness, healthy vs monitored counts. Label `PROXY` or `X_PARTIAL`, and never publish raw provider health/secrets. No routine full 12-handle rescan. |
| Creator transcript | Already-reviewed video-ID / ordered original transcript ledger | vidIQ transcript FIRST for new eligible ID, 5 included credits per actual call, verify remaining quota | YouTube native transcript or authorised free timed transcript providers, one provider per useful stage | Exclude descriptions/AI gist/metadata as transcript; enqueue exact source ID/retry reason on failure. No purchase/top-up. Keep reserve for StockedUp and other Tier 1. |
| Hormuz physical crossing | Existing Bluebelly cache and source clocks, 30m lease | Authorised existing read-only machine endpoint | Verified time-matched external shipping/official statements for *reported* disruption | Stale >90min/invalid dates, AIS missingness and vessel counts never converted into oil volume. Do not direct poll upstream sensor. |
| Notion delivery | Existing dated Pulse FULL Post → matching Log with non-null Published At and truthful source count | Recover same Pulse ID and complete missing Post or Log in place | If Notion unavailable, keep source ledger/cursor and return `HANDOFF_BLOCKED` without creating duplicate/pretend receipt | Research source found ≠ canonical/public accepted. Skip quiet slots with real checked sources. |
| Research Investigation / owner brief | Full changed Notion Post(s) + Registry → existing private `blue_desk_macropulse_briefs` review row | Safe idempotent source UUID+digest insert/readback through existing authorised connector/endpoint | Existing Notion Run and qualified source links with `PRIVATE_BRIDGE_BLOCKED` on connector failure | Exact record ID/SHA/status required; `RESEARCH_DERIVED_UNADJUDICATED` is awaiting review, not failed publication. Max 3 changed private digests. |
| Private Daily Report | Complete `CHATGPT_WORK` source-dated HTML for the EXACT last completed regular US equity session ET with actual header/source-manifest coherence | Source-qualified new current-session edition from existing 06:00/08:00 MacroPulse+Gate if absent; preserve immutable previous edition as baseline | `SCHEDULED_RESEARCH` abbreviated private source-led draft; distinguish from full Work edition | NEVER reuse by latest `created_at` alone; if saved `report_day` contradicts document's claimed ET session, `SESSION_MISMATCH`, do not silently relabel. Missing original proof → `WITHHELD_COVERAGE_GAP`. |
| Bluebelly public reader | Current deployed `/calendar`, `/newsroom`, `/key-stories` with exact event/result and source timestamp | Connected Vercel read of exact public host if ordinary web fetch fails | Read-only DB/Notion evidence and `PUBLIC_READBACK_PENDING`, not claim of deployment | HTTP 200 alone ≠ correct card or public source admission; historical preview left intact. Public mutation requires existing approval/release path. |

## Anti-duplication and quotas

1. All Work executions use the existing five tasks only. MacroPulse is every **two hours at even MYT hours** (84/week), Investigation twice daily (14/week), AI Bubble 06:00 daily (7/week), Creator 07:00 daily (7/week), Writing Brain 09:30 Monday–Saturday (6/week): **118 scheduled starts/week** before any manual runs.
2. MacroPulse's quiet even-hour slots perform DELTA only. Two substantial comprehensive slots (06:00/18:00); 08:00/20:00 targeted handoff. No automatic full browser/transcript/16-company repeat on quiet updates. Normal editorial focus 2–3 developments, max 5 review topics, with uncapped compact material-event backlog IDs.
3. Research Investigation normally reads at most **4 full changed Posts**, up to 8 only for new material P0; max 5 deep questions. A 74-item provisional P0 backlog is triage **debt**, not 74 compulsory deep dives each run. Reclassify on new source evidence/urgency without discarding unread IDs or advancing a false complete checkpoint.
4. AI Bubble checks all 16 **statuses** but deep-extracts changed issuers only; Tesla remains adjacent overlay. Creator target is 15 COMPLETE reviews per day with hard maximum 18 and no paid-credit guarantee; a vidIQ call counts its credits even when captions fail. Reserve successful slots 16–18 for Tier 1 retries.
5. Fallbacks must not endlessly retry. At most one attempt per failed transport/provider in current slot, then record exact error and next eligible retry; expansion max two genuinely new source hops for a material question. Favor available existing official receipts over alternative providers.
6. Credit safety: Firecrawl 0 by default; before any optional credit-consuming path verify an included balance and benefit. Never spend hundreds of credits to fix X retrieval when the public read-only Vercel endpoint works. Track real provider credits and failed calls, NOT only successful content rows.
7. Every report/trace records `RUN_ASOF`, `SOURCE_WATERMARK`, `FALLBACK_ROUTE`, `SOURCE_CALLS`, `CREDITS_SPENT` where available, `DEDUPED`, `UNREAD_P0`, `POST_LOG_READBACK`, `PRIVATE_REPORT_SESSION_ET`, `PRIVATE_STATUS`, `PUBLIC_STATUS`, `NEXT_OWNER`, `COVERAGE`. Missing actual account-level Work-usage accounting must be declared as UNKNOWN, not equated to prompt length or run count.

## Known live evidence as of 4 November 2026 (not guarantees)

- MacroPulse 4 Nov 00:00 MYT: exact Notion Post and Log were verified; overall `PARTIAL_COVERAGE`; a prior 3 Nov 22:00 Post/Log inconsistency remains in backlog.
- Production X GET initially reported `coverage.monitored=11`, but PR #1308 was subsequently deployed and the same live endpoint independently read back `coverage.monitored=12`, `healthy=7`, `complete=false`; `@macropaperr` was still `unconfigured` and requires a real existing collector scan before claiming success.
- Supabase original macro releases for RBA 3 Nov, BLS JOLTS 3 Nov and BEA September PCE were `completed`; BEA four numerical actual metrics read back.
- Private 2 Nov ET full Work report exists. A 3 Nov source-update edition was mislabelled around an older 30 Oct ET session: detect and correct at delivery-selection, never overwrite it in place.
- Bluebelly Calendar, Newsroom, Key Stories 4 Nov 00:06 MYT returned HTTP 200 and showed corrected RBA/Apple/Palantir/JOLTS material; old AI Hub notes predating public fixes are not current production proof.
- Research Investigation last observed 74 provisional unread high-priority Posts and 109 total deferred. Creator last observed 8 complete reviews, a Tier-1 transcript missing, and 5 included vidIQ credits remaining. Credit availability changes over time.

## 4 November — strengthened operating controls

### 1. Progressive P0 backlog drain, without inventing closures

- `74 provisional unread P0 / 109 deferred` is a dated **snapshot**, not a current fixed workload. The 08:40/20:40 Research Investigation must recompute actual open/closed/duplicate/revised status from existing Registry IDs and priority metadata.
- Preserve `first_seen`, last attempted, original dated source/claim, review state, number of failed attempts, retry_after and next owner in existing Registry/Run; never silently delete or advance a cursor past unread P0.
- Normally max **four** full changed Posts per run: up to two genuinely new high-impact P0, one highest outstanding risk, and at least one *oldest material unresolved* P0. When fewer than two new urgent source changes exist, spend spare capacity on further oldest P0 cases up to four total. Only a real overload of new urgent P0 suspends old-backlog drain; record the exact deferred IDs.
- After review, classify `CONFIRMED_NEW`, `REVIEWED_STILL_OPEN`, `NEEDS_OFFICIAL_SOURCE`, `SUPERSEDED`, `DUPLICATE`, `RESOLVED` with exact evidence. Only a genuine reviewed closure reduces the unread count. Age buckets 0–2, 3–7, >7 days and repeat-failure health expose queue starvation. No 74-post full replay.
- Review queue already containing at least 12 distinct unadjudicated rows: at most **two** genuinely new consequential verified P0 private briefs this slot; other material cases remain saved as Registry IDs for later. Unadjudicated review is **not a technical-publication failure**.

### 2. X and creator partial-health recovery

- The exact public read-only X endpoint has a measured 4 Nov state of 12 monitored, 7 healthy and 0 verified market claims. **12 rostered ≠ 12 observed; HTTP 200 ≠ health PASS**. Collector-only `last_completed_at` plus actual acquired original IDs is needed to close `@macropaperr` and other account health.
- Two consecutive *optional* provider route failures without changed status impose a **six-hour per-route Work cooldown**; this does NOT suppress official P0 checks. Use public read model → Vercel reader → bounded existing ledger → targeted original URL/FxEmbed; do not poll all 12 X accounts from every 2-hour MacroPulse.
- Creator transcripts require original video ID and authentic ordered transcript. vidIQ current balance on 4 Nov was **5 renewable credits remaining out of 150**, renewing **1 Dec 2026 UTC**. Reserve the last one-call allocation for a genuinely novel Tier-1 candidate only after checking current remaining quota. Tier-2 uses native YouTube transcripts or authentic free routes. Failed captions/metadata ≠ review completed. No credit purchase or forced daily output quota.
- Firecrawl current provider balance was **131/1,000**, billing period ending **14 Nov 2026**. Firecrawl remains ZERO default, not a compulsory X/transcript fallback.

### 3. Explicit run spend *proxies*, not fictitious Work billing

Record these in each existing task receipt: `TASK_ID`, `RUN_ASOF`, `ORIGINAL_SOURCE_IDS_NEW`, `REUSED_IDS`, `CONNECTOR_CALLS_BY_PROVIDER`, `FAILED_FETCHES`, `FALLBACK_ATTEMPTS`, `VIDEO_IDS_COMPLETED` (creator), `CREDITS_BEFORE/AFTER` only if provider returns them, `QUEUE_AGE_BUCKETS` (Investigation), `POST_LOG_READBACK`, `LAST_COMPLETED_US_SESSION_ET`, `REVIEW/PUBLIC_STATUS`, `NEXT_OWNER`.

The provider ledger is a **usage proxy**. A ChatGPT Work weekly allowance/real dollar charge cannot be obtained from task prompt length, counts or elapsed run duration alone; report `WORK_ALLOWANCE=UNKNOWN` absent an official authoritative meter. Never trigger more Work runs solely to measure costs.

### 4. NYSE calendar contract for private Daily Intelligence

`lib/bluebelly-us-equity-trading-calendar.ts` holds an *offline versioned official schedule* from [NYSE Holidays & Trading Hours](https://www.nyse.com/trade/hours-calendars) for **2026–2028**, cross-checked for 2026 with [Nasdaq Trader Calendar](https://www.nasdaqtrader.com/trader.aspx?id=Calendar). Full closures including Good Friday, observed holidays, Thanksgiving and Christmas are excluded. Official 13:00 Eastern early closes are recognised for 2026 Nov 27 and Dec 24, 2027 Nov 26, 2028 Jul 3 and Nov 24. `America/New_York` determines UTC/DST boundaries.

Outside this verified range, the existing weekday calculation remains a **WEEKDAY_ESTIMATE**, not authoritative proof. Unplanned exchange closures must still be checked against official alerts. Calendar day and trading session are not evidence of a specific measured price/market reaction. Existing private title/report_day/session coherence and source-admission approval gates remain enforced.

### Acceptance for the next normal runs

1. One material original macro release keeps an exact Post+Log and a bounded Research Investigation handoff; missing X transport does not rewrite the upstream work.
2. The Research Investigation receipt separates fresh urgent P0 count from oldest unresolved work, ageing buckets and exact retry IDs; drain without cutting off newer urgent news.
3. Creator reports true missing-Tier1 availability and credit usage, rather than 15 invented reviews. No extra charge on blocked sources.
4. Work metrics list actual provider calls/balances where available, and explicitly `WORK_ALLOWANCE=UNKNOWN`.
5. A 2026 Thanksgiving or Christmas closure yields **no phantom weekday market-session report**, and the 13:00 Eastern half-day is treated as completed at its real close.
6. No sixth automation, new external paid provider, new canonical engine, owner approval bypass, or private-to-public data leak.
