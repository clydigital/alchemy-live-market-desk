# Bluebelly — HTML-only Daily Intelligence generator (implementation handoff)

**Owner decision:** 31 Oct 2026 — choose one HTML output, retire the failed automatic PDF path as the **new report's** dependency (legacy PDFs stay untouched for history). Retain full-length Editorial Reader v4 (merged #1235), not the 3-page brief.

## What this stage actually does

1. Owner opens **My Desk → Daily Report Studio**, reads the existing private MacroPulse/Research Gap/verified News packet. The packet now includes up to seven **source-dated, attributed** summaries of previously reviewed creator transcripts directly from the existing `research_intake_items` store, with video URLs/IDs, claims and independent verification targets. **These are not verified issuer facts.**
2. User clicks **Generate full-length HTML report**. Five bounded browser-initiated model calls progressively draft contradiction/market events, cash economics, cross-asset transmission, creator thesis comparisons, and conditional verdict. Do not fabricate if packet lacks material. Each completed chapter is retained in the open UI and a model failure may be retried using **Continue HTML report**.
3. The complete report uses the already-adopted Editorial Reader v4 renderer, with readable HTML, source ledger from exact independently matched URLs, and (optionally) up to five exact original X-wire post cards the owner selects. X posts retain their published date and original-verified/attributed state. Their narrative claims are not independently validated.
4. User checks the HTML and clicks **Download HTML report**. The output is a single self-contained typography/layout HTML with optional click-to-load external X widgets and original-linked offline fallbacks. There is **no generated PDF**, background model job, new cron, new task, public publisher, or schema migration.

## Restraints / what is not yet done

- The current research packet is capped at ~24k characters. Reviewed creator arguments are bounded and labeled; this is **not** a full 14-video transcript reading or independent claim validation. Model-produced narrative remains `PRIVATE_DRAFT`, not fact-checked.
- Longform calls remain dependent on the configured editorial model and its availability. Five bounded, recoverable chapter requests reduce one-shot timeouts but cannot guarantee provider uptime; the user must keep the browser open and manually retry failed sections.
- HTML downloads are user-local; no automatic private archive, stable URL, owner-reviewed approval workflow, or immutable next-day replays in this stage.
- Legacy `DAILY_MACRO` PDF failures and historical file reads are retained unchanged, not falsely declared repaired.
- A separate later stage can implement repeatable private HTML edition persistence with source hash, historical errata, and acceptance/readback; do not create a sixth ChatGPT scheduled task.

## Quality gate

Full repository tests, TypeScript, Next.js build, database contracts. Private host and explicit POST owner allowlist. Same-origin/browser request. Model response no new monetary or percentage numerals absent from the source packet, no unsupported URLs or unsafe markup. No silent truncation on resume. Source-linked X cards only from exact DB matches. No current-creator inference from an old video retrieval timestamp. Check desktop/mobile visual presentation and owner/anonymous production access before claiming live completion.

**Primary issue:** #1181. **Style baseline:** `docs/editorial/BLUEBELLY_DAILY_INTELLIGENCE_EDITORIAL_READER_V4.md`.
