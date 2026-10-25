# Bluebelly: reporting outside the canonical Dossier hot path (25 Oct 2026)

## Decision

Keep the existing Dossier, canonical Story reasoning and exact replay as immutable audit/history and long-term thesis adjudication. Do not delete their schemas, workers, source lineage or previously accepted evidence. **Daily briefing and COTD/OB drafting must not require a newly accepted Story thesis.**

## Current first slice (this branch)

- `/daily-report` (exact Bluebelly/Live reader hosts) is its own page, not the current immutable `/reports` article library. It reads verified latest Motion news independently of published Dossier article admission, plus separately labelled admitted article explanations, frozen historical Story watch and the existing forward calendar.
- It shows the publication clock and explicitly warns when no current ET-day research edition is available. It does not claim the news is a new accepted Story, or old research is current.
- `/calendar#earnings-hub` exposes existing issuer-confirmed and provider-reported forward earnings with source URLs, expectation field and questions.
- Private `EditorialWorkbench` gains chart-first vs catalyst-first guided research questions, causal moving parts and forward calendar/earnings input. It uses the same authenticated writer and preserves independent publication review.
- Navigation preserves production `/reports`, the isolated synthetic `/editorial-lab`, and their precise public-host route rules.

## Remaining integration for actual ChatGPT-quality Daily Report (not falsely claimed by this branch)

**Inputs / provenance:** Read latest MacroPulse Notion discovery and Research Gate Notion investigations through authorised, read-only server adapters, with run ID, observedAt, source-verified time, canonical evidence ID if one exists, verification stage and reason for missing coverage. Reuse already available market monitor observations and economic/issuer calendars. Neither a Notion summary nor a creator transcript becomes factual proof merely by appearing in a packet.

**Synthesis:** Reuse the existing owner Writing Brain/model-routing policy as a separate explicit analysis/draft action, not as implicit LLM generation on every public GET. The report first explains: (1) What is new? (2) What happened versus what was expected? (3) Mechanism, each causal step and exposed markets (4) Alternative/countercase (5) Price action with source date and timezone (6) Next economic releases, earnings and thesis-changing tests. Unproven moves, chart breaks and event-window correlations must be marked UNKNOWN. Label producedAt and all source observation clocks. Give each claim its original source or a clearly scoped hypothesis label.

**Review/publish:** A private review step can approve a bounded, immutable `daily-report` publication projection and safely expose the reviewed public copy. Do not merge it into canonical Story/Dossier. If the latest research has no verified explanation, the page still shows verified raw news and coverage warnings. A reviewed daily report is not an automatic canonical thesis mutation.

**Story state:** Provide `Last assessed`, `What changed since last assessment`, `Evidence admitted?`, `Current hypothesis` and `Next deciding test` as separate fields. Live updates can challenge the frozen thesis without re-labelling a historical version as currently accepted. Accepted evidence changes continue through the one existing Story thesis-version path only.

**Scheduling:** Reuse current MacroPulse/Research Gate cadences and owner-invoked workflow. No new scheduled tasks or duplicate reasoning engine. Do not automatically write to Supabase on public GET.

## Cutover validation

- A nonempty fresh verified news feed must render even with zero accepted Story articles.
- A stale edition stays visibly stale and cannot be silently joined to newer market facts as one assessed thesis.
- Source clocks, fiscal quarter, consensus, units, time precision and event occurrence must be checked before an interpreted claim.
- Anonymous exact-host Daily Report, Calendar and published COTD/OB remain read-only; preview hosts inherit no new public bypass.
- Existing owner Writer draft/revise, publication authority and 14 monitor checks remain guarded.
- Confirm canonical Story historical exact replay still works with #1029 scope fix before retiring old Presenter navigation.
- Tests, TypeScript, Next build, PostgreSQL contracts and 360/768/1440 browser QA on the final integrated tree, not on an isolated stacked branch.
- Retain the ability to revert only the new UI/read-model paths while leaving canonical Dossier unchanged.
