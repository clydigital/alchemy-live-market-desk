# Bluebelly Investor Mindset — source-to-reasoning workflow (14 Nov 2026)

## Scope and ownership
One canonical analytical brain: **Dossier V2**. The Investor Mindset homepage board is a read-only presentation of Dossier interpretations plus independently fetched, source-dated market observations. Creator transcripts and X-Wire supply research leads, never established market motives. No separate public AI endpoint, task, prompt store, Story publisher or per-page generation process is introduced.

## Automatic cadence (Asia/Kuala_Lumpur)
- **09:30 / 21:30**: existing Vercel source-only morning/evening acquisition. These persist source receipts. Acquisition completion is not a published thesis and remains fast/fail-independent of Dossier.
- **10:20 and 10:40**: existing authenticated morning Dossier cron and bounded retry.
- **23:00 and 23:20**: existing authenticated evening Dossier cron and bounded retry. This is the current live schedule, not precisely 12 hours after the first research pass; do not describe it as a guaranteed 12-hour interval.
- No new cron jobs or ChatGPT automations are required.
- After an eligible source-only intake finishes, the existing `research_slot_runs.stage_summary.postResearchDossier` checkpoint is claimed once via compare-and-swap. It permits at most two bounded attempts, records `PERSISTED`, `NO_CHANGE` or `ALREADY_CURRENT`, and persists an existing Dossier V2 when there is material evidence. Legacy Story/Hybrid publication still remains `not_required` in source-only mode.
- Dossier failures must **not** turn source acquisition into an apparent failure or silently substitute an older thesis. Readiness is independent.

## Game-theory reasoning
The existing `buildResearchBrainSystemInstructions()` adds bounded investor-incentive questions within current `market_verdict.lenses` and `investigations` fields: buying/selling/holding incentives, expected-vs-actual surprise, capital rotation, likely persistence, cross-asset confirmation, competing explanations and falsifier. This is **not** a new schema or separate writer. Explanations remain an epistemically labelled inference grounded in admitted observations.

## Homepage reader
- The existing price board reads recent per-asset source sessions separately from the canonical Dossier.
- A Dossier assessment appears **only** if the newest exact selected edition is healthy and no older than 30 hours. Its lens must have a source-backed observed reaction and cited evidence references; missing, degraded or older sections stay as unverified investor questions.
- The board shows distinct *Source / market as of* and *Fundamental Dossier as of* dates. Rendering the page never writes a Dossier, schedules research, or asserts institutional flows.
- A `NO_CHANGE` run preserves the last material Dossier. Do not advance the Dossier date merely because a cron fired. Check the existing post-research checkpoint for evidence of the newer review.

## Manual refresh
Use the **existing** GitHub Actions `Run Live Research Now` workflow with `workflow_dispatch` mode `dossier_v2_persist`, strategy `auto`, lookback 168 hours and evidence limit 180; it uses the same authorized `/api/admin/dossier-v2/run` endpoint and same Dossier V2 brain. For a full additional acquisition, use the existing manual `research` flow where appropriate; do not use an unauthenticated button or public LLM route.

## Failure and acceptance checks
1. Source-only run completes without changing canonical Story or PDF state.
2. Dossier scheduled trigger denies unauthenticated access and refuses incomplete/unhealthy source receipts.
3. A second invocation cannot claim an active run or issue a third attempt; completed runs are idempotent.
4. Manual and scheduled Dossier both use one existing output schema, the current primary evidence and the frozen prior view.
5. Homepage reveals independent market and Dossier timestamps; stale/degraded/missing assessment never becomes a fresh investor verdict.
6. Verify post-research checkpoint `DONE` and exact dossier selection after next scheduled run, or record `FAILED` with the precise reason. A deployment or source-only success alone is not proof of fresh fundamental analysis.
