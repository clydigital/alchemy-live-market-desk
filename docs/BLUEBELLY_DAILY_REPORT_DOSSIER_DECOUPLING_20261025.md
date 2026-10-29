# Bluebelly Dossier-light Cutover — 25 October 2026

## Decision

Retire the **mandatory canonical Dossier and Story judgement layer from Bluebelly's everyday publishing and display paths**. Keep archival schema, jobs, historical evidence and old URLs available during migration. Do **not** drop tables, switch off research workers, erase Dossier versions, break exact historical bookmarks or change the canonical backend during this front-end cutover.

The test of success is whether the newsroom can deliver a useful sourced market briefing, COTD/OB, and live topic watch even if no new Dossier Story version is accepted.

## Implemented now on PR #1030 (current-main base)

| Surface | New source flow | Dossier dependency |
| --- | --- | --- |
| Public homepage | Recent source-verified news, source-dated market monitor, already reviewed reports, live topics and calendar | None |
| Public /daily-report | Recent verified developments; rolling topic questions; owner-reviewed published COTD/OB history; next economic events and earnings | None |
| Public /key-stories | Grouped verified updates (48h) with event time, original URL and a question for further investigation | None |
| /calendar#earnings-hub | Existing provider/issuer earnings calendar, proper precision and source labels | None |
| Private OB/COTD writer | Existing authorised model draft/revise, COTD chart vs OB catalyst guide, each mechanical step, countercase, future calendar and earnings | None in owner draft path |
| Public /reports | Reviewed immutable COTD/OB publications and PDFs | None |
| Legacy /dossier and old exact historical routes | Existing archival read and operational compatibility | Retained; no new authority |

The legacy system and its pure snapshot projections remain in the repository. The new public pages do not read them. The topic grouping code receives **only** the independently source-verified news read model: it does not read raw leads, infer a current price move, or create its own truth score. Older topics expire from the live page rather than being disguised as fresh headlines.

## What this does NOT yet provide

- A full, newly reasoned "what happened today?" synthesis from **current Notion MacroPulse + Research Gate investigation**. At present the public page shows dated facts and previously reviewed editorial assessments, not a new AI-authored verdict on every refresh.
- Live Story belief updating and historical belief diffs. Rolling topics are headline groupings and open questions, not a persistent analytical thesis memory.
- Direct on-page model actions for anonymous readers, which would pose cost, secret, abuse and evidentiary issues. Private authoring already uses the existing owner-only model route.
- Removal of old Dossier triggers, queues, research contracts, cron jobs, schema, edition IDs and Presenter routes. They remain critical until all dependent workflow consumers are identified and migrated.

## Remaining phased migration — no new scheduler or reasoning engine

### B1 — Source-qualified research handoff
Connect current Notion MacroPulse and Research Gate **through a read-only authenticated adapter** using their original records. Each record must retain run ID, originating URL, occurred/observed/verified timestamps, verification decision and coverage state. Use only accepted facts for factual claims; report researcher hypotheses separately. Import creator/video and X posts only as attributed leads. Continue existing two-hour and review schedules rather than creating more scheduled tasks.

### B2 — Existing Writing Brain as the analyst
Reuse the authenticated `/api/owner/editorial-generate` model stack, its owner allowance and current routing configuration. Create a **bounded private Daily Report drafting workflow** that combines B1 accepted facts, dated public monitor observations, prior editor-approved conclusions and upcoming economic/issuer events. Its section goals:

1. What is new, source and actual event clock?
2. What was expected before this event, and what actually happened?
3. Mechanics: actor -> immediate effect -> supply/demand/financing/earnings channel -> exposed asset.
4. What did markets actually do, from appropriate dated bars or event-window evidence?
5. What else could explain those moves, and what does not fit?
6. If-then scenarios and exact falsification tests.
7. Forward releases, auctions and earnings, with date precision, issuer link and the decision question.

Output British English, accessible prose, brief paragraphs, original-source links and UNKNOWN for unsourced numbers or reactions. A well-grounded paragraph does not require a canonical Story mutation.

### B3 — Reviewed daily publication
Persist source snapshot, generated draft, owner review state and an immutable public article version **through an appropriately reviewed, minimal editorial publication path**. Do not silently treat a model completion as "verified". A public GET remains a read-only reader; it never generates, edits, or writes. Preserve approved report versions for browsing and comparisons.

### B4 — Retire obsolete Dossier runtime dependencies
Inventory old consumer routes, Research Gap triggers, Dossier publication schedule, auth and historical Presenter bookmarks. Only disable a job after the B1–B3 replacement has run successfully for multiple consecutive periods with source and access proofs. Preserve an export/restore path and exact legacy URLs, at least until no active caller relies on them.

## Verification gates

- New public GET paths use **no** Dossier reader, snapshot join, canonical Story mutation or model generation. They continue using the established server-side verified-Motion adapter, but only the existing sanitised and evidence-screened public projection is rendered; any privileged upstream access must remain server-side and access-reviewed.
- No anonymous host, preview alias, /reports or /editorial-lab route can access private owner APIs or raw canonical tables.
- Report remains useful with zero accepted Story changes; no fresh news and provider outage show an explicit honest empty/coverage state.
- News claims are never labelled as causally proven; topic grouping is transparent and bounded to 48h.
- Reviewed COTD/OB preserve exact published dates, original references and immutable PDFs.
- Earnings date-only, issuer-confirmed and provider-reported records remain visibly different.
- New branch passes tests, TypeScript, build, database contracts; responsive exact-host and authenticated owner smoke follow before release.
- Test older approved reports vs fresh news on a live page, not simply snapshot tests.
- Keep PR #1029 edition-scope fix separate for legacy Presenter until migration is complete.

## Rollback

This change is additive and primarily read-only. Revert the new routes/homepage/view changes as a unit, without touching Supabase tables, research cron jobs, canonical evidence or old historical editions.

## Compact earnings explainers in current and future daily briefs (28 October 2026)

When an already-verified earnings release is material, the owner-authored daily briefing and presenter summary should show a short source-backed **beat/miss + what rose/fell** scorecard before explaining why price might react. Include reported revenue, profit/EPS, free cash flow and capital expenditure, comparison baseline, guidance change and missing-data states; never treat a company-reported preliminary profit figure as verified free cash flow, equate planned capex with spent cash, or invent same-day stock reactions. Apply [Bluebelly Simple Earnings Scorecard](BLUEBELLY_SIMPLE_EARNINGS_SCORECARD.md) as the common readable contract, without creating a second earnings tracker, autonomous publisher, extra scheduler or canonical Dossier dependence.

