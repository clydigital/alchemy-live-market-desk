# Macro research pipeline — design contract (proposal)
Status: REVIEW ONLY. No scheduler, prompt, production data, or canonical routing changes authorised by this document.

## Goal
Preserve the existing two-hour ChatGPT MacroPulse watch as a fast, independent discovery/Notion publication lane. Add a separate bounded deep-research lane that never blocks or rewrites that pulse. Existing ChatGPT Morning/Evening Pre-Live Research Gate tasks remain enabled during migration. No extra ChatGPT scheduled-task slots, subscription upgrades, or paid APIs without approval.

## Actual current boundaries (verify before implementation)
- ChatGPT MacroPulse task: every two hours on even MYT hours; full qualifying posts and skipped heartbeats in Notion Financial Research.
- ChatGPT pre-live Gate tasks: 08:10 and 20:10 MYT; read verified full Notion MacroPulse posts, research 2–4 priority gaps (hard 5), persist Notion Research Gap Runs and registry.
- Backend Research Gap is a **different implementation**: Vercel one-case cycles 11:15 and 23:15 MYT plus handoff retries; it reads canonical Dossier research gaps, not raw MacroPulse. Do not conflate the ChatGPT pre-live Gate with the backend Gap worker.
- MacroPulse Motion bridge accepts bounded LEAD candidates; MacroPulse is discovery context, not evidence; backend Gate has no canonical machine-readable MacroPulse reader.
- Creator intelligence runs separately; creator transcripts supply hypotheses and coverage taxonomy, not canonical evidence.

## Proposed execution
1. FAST: unchanged scheduled MacroPulse does broad source-backed market surveillance and writes original Notion post/log. Yahoo Finance headline discovery can supplement official/authoritative sources; exclude FXStreet as a required source. Preserve dedupe, heartbeat and no-change path.
2. DEEP: independent manual or existing-backend-triggered session after a pulse, or once daily pre-live if justified by measured duration and cost. Never create a new ChatGPT task per compartment. Triggering and concurrency require an audited existing worker/queue before implementation.
3. DEEP partitions: taxonomy compartments 1–6, each checkpointed with run ID, originating pulse IDs, source URLs/timestamps, findings, unknowns, Motion leads and links to previous/current Live Desk Regimes and Stories. Run each independently; on failure retain partial results.
4. FINAL partition 7: cross-market synthesis; compare expected versus actual market behaviour; enumerate contradictions and precise verification questions.
5. EVIDENCE: route candidate questions through the **existing** appropriate verification boundary. ChatGPT pre-live Gate and backend Dossier Gap are distinct; do not bypass backend Dossier/System 2 eligibility. Creator and Pulse claims are leads only.
6. ORGANISER: create a Notion briefing with source links and canonical IDs where available, narrative hierarchy, update targets, unsupported claims, and a short LIVE handoff. No Story/Regime mutation by this document.
7. RETRY: at most one bounded targeted evidence follow-up per missing material question, maximum two organiser passes; then mark UNRESOLVED and stop. No infinite loops.

## Scheduler and cost invariants
- Existing two-hour pulse and pre-live tasks never wait for deep research.
- No new ChatGPT scheduled-task slots; reuse existing backend scheduling only after capacity audit.
- No guarantee of zero backend cost: record search/model/hosting consumption and enforce budgets.
- Do not create overlapping jobs that edit the same Notion page; use immutable partition pages or append-only records with idempotency keys.
- Measure wall-clock runtime and failure rate for 3 manual dry runs before enabling automatic deep execution.
- No new reasoning engine, database reasoning table, or Story thesis-version path.

## Notion and review UX
- Keep MacroPulse original and Research Gap Run as authoritative human-readable records.
- Organiser is a linked, versioned synthesis, NOT a duplicated MacroPulse dump.
- Lead with: WHAT CHANGED / WHY IT MATTERS / MARKET REACTION / WHAT DOES NOT FIT / WHAT LIVE SHOULD UPDATE / WHAT TO WATCH.
- Keep source traceability, time window, verification status and unresolved gaps visible. A reviewer should understand the top story within 60 seconds and inspect supporting detail without reading all raw inputs.
- Slide decks are presentation derivatives, not research authority; do not force Notion's readable narrative into slide-shaped tables.

## Implementation acceptance
Audit actual task/project attachment, Notion schemas, backend provider/API integrations, queue/worker capacity, and current Live Desk read contracts. Validate one complete manual sample against reviewer checklist; do not enable or merge automation without documented checks.

## Delivery-first operating rule (review amendment)
- FAST MacroPulse publishes independently on its existing cadence; it never waits for creator transcripts, deep partitions, the Gate or Organiser.
- DEEP produces a **best-effort briefing** from completed partitions at the handoff deadline. Incomplete partitions are explicitly marked SKIPPED, STALE, SOURCE_UNAVAILABLE or UNRESOLVED and queued for a later attempt, not treated as publication failures.
- Every partition has a bounded execution budget and checkpoint. On budget exhaustion, persist what is supported, record the gap and advance; never restart the whole session.
- Seven categories are **coverage checks across the research window**, not seven mandatory long essays per run. No-change is a valid outcome.
- Do not block the whole run on a failed creator transcript, Notion write, external source or backend verification step. Preserve links and a recoverable follow-up task; do not falsely label unverified material verified.
- Prioritise delivery: headline briefing first, then links and caveats, then optional details. Evidence required for canonical Story mutation remains a hard boundary, but lack of such evidence must not block a clearly labelled research briefing.
- Multiple categories referencing one development should point to a single lead finding with secondary connections, not reproduce the article.
- Do not add additional ChatGPT tasks, queue tables, or new services to implement these rules without separate approval.

## Researcher-side retrieval providers and fallback — 12 October 2026

**Scope:** a documented ChatGPT research procedure only. It does not connect these ChatGPT plugins to Vercel, a GitHub Action, the backend Research Gap executor or an automated MacroPulse task. All existing schedules, canonical evidence rules, budget limits and Live/Hybrid boundaries remain unchanged.

| Tool | Appropriate use | Limitation |
| --- | --- | --- |
| Firecrawl | Extract readable page/PDF content, crawl a permitted site, or inspect developer docs | An extraction is not independent verification of the originating source |
| Parallel Search | Web discovery and fetching relevant URL content; cross-check discovery coverage | Search excerpts may be incomplete or stale |
| Exa | Discover pertinent financial, technical and primary-source documents | Discovery rankings are not evidence-quality scores |
| TinyFish | Navigate a specific permitted interactive page when ordinary extraction fails | Not a bulk crawler or CAPTCHA/verification bypass |
| Opera Browser Connector | Inspect content in browser tabs with user authorisation | Depends on the user's connected browser/session |
| Tavily | Optional search, scrape, crawl and structured retrieval alternative | Connect and validate separately; not assumed available |

**FAST MacroPulse procedure**
1. Prioritise the original source (agency release, SEC filing, company IR, exchange or official dataset), with a timestamped reporting article for secondary context.
2. Use Exa/Parallel Search to discover candidate originals. Extract the exact source with direct access or Firecrawl; try a second compatible extractor if needed, not merely a second copy of the same article. Browser tools are a last-mile alternative for specific permitted pages.
3. Record original publisher, source URL, publication timestamp, market observation timestamp, access timestamp, units/revisions, expected versus observed and the countercase. Two tools citing the same origin are **one independent source**.
4. If the source remains unavailable, mark `SOURCE_UNAVAILABLE`/`UNRESOLVED`, retain supported findings and the ordinary no-change/heartbeat path. No fabrication, forced publication, repeated retry loops or silent conversion of a summary into evidence.
5. Preserve full-post-first Pulse ID/Log idempotency; Notion is research memory, not the primary source. Deep research and the pre-live Gate do not block FAST.

**Pre-live Notion Research Gap Gate**: carry forward exact prior run/window/Pulse IDs, prioritise 2–4 changed gaps (hard 5), require original timestamped evidence and contradiction checks, and route only supported candidates through the existing canonical Live boundary. See [Research Gap execution](RESEARCH_GAP_EXECUTION.md) for the *separate* backend worker; it does not read Notion MacroPulse as a canonical feed.

**Creator-specific caution:** a YouTube page, search snippet, Gemini video summary, chapter list or channel metadata is never a full caption transcript. These tools may discover or inspect pages, but cannot manufacture a transcript or bypass the research-update transcript gate. See [Research video intake](research-video-intake.md).

Corresponding Notion procedure: [MacroPulse](https://app.notion.com/p/3ea519b67a948161ba4dec8f97ebf658), [Research Gap Gate](https://app.notion.com/p/3ea519b67a9481f9aa03d9767069487e), and [Financial Research](https://app.notion.com/p/3ea519b67a9481d0910ff8d54c5b40b3).
