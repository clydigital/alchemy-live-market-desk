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
