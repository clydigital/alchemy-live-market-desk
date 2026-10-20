# Blue Desk — content production readiness (20 October 2026)

## Observed evidence from production (read-only)

The latest daily-brief snapshot fcea17ef-f575-4283-a363-7d5fa9c918c7 (19 October 2026, 16:19 UTC) contains six Dossier lessons, zero manifest entries, zero stories and zero market-tape source links. Its lessons cite 29 canonical intelligence-evidence UUIDs; all 29 match real evidence records and contain original provenance URLs. The article projector never joined this lineage, so Blue Desk showed no citations.

Four attributable issuer-class records support the AI backlog/cash-conversion lesson. The other five lessons currently have no qualifying primary evidence under the conservative source-tier/class screening. Some Research Gap observations explicitly state that source pages did not expose reliable values. These are context only and must not be promoted to confirmed market observations.

An edition with no material changes may correctly have zero new manifest entries. The existing Dossier composer prevents inventing new changes in that case; retain this behaviour.

## Editorial publication requirements

1. Read canonical source IDs from exactly the frozen article paragraphs, never infer sources by topic or fuzzy URL matching.
2. Use actual source-level HTTPS page URLs from evidence provenance, not provider homepages. Evidence availability and creation time must predate the frozen Dossier as-of.
3. The client-facing headline describes a market event or persisting market condition. Research gap resolution, pipeline, evidence reclassification and validation belong to diagnostics.
4. Keep reader readiness distinct from System 2: READY / DEVELOPING / RESEARCH_ONLY is editorial gating only, not adjudication.
5. In a quiet session, acknowledge the continuing regime; do not invent new price movement.
6. Include trigger, comparison, causal mechanism, asset transmission, countercase and deciding next test only where the supplied evidence supports each part.
7. Motion is context, not evidence. Only canonical UUIDs can justify Story mutation through existing thesis-version machinery.

## Partitioned build and acceptance

**P0: Original evidence URLs and client-facing admission** — PR #829 adds a bounded source resolver (max 120 UUIDs, 12 URLs/article), as-of rejection, first-tier attribution and a market-story readiness gate. Verified publisher process chatter may never lead the brief.

**P1: Future daily-brief writer** — build original article-specific citation lists into the *new* publication payload from exact UUIDs; keep old editions frozen. Fail visibly on missing citations or unusable provider pages, not on expected zero-change sessions.

**P2: Existing System 2/Dossier composer** — improve material-change editorial structure: observed fact, affected markets, causal chain, contradiction, next test. Never add a second prose model or a competing Story mutation route. Client-facing text must avoid operational labels.

**P3: Exact Story routes** — fix outstanding 404 on story detail, validate articleId and pinned edition from the runtime (not inferred from page time). A wrong or missing edition must remain a 404.

**P4: V6 content parity** — restore deep-reading, market company screens, interactive mechanism and source exploration, historical Journey and Presenter Studio only after published source integrity is proven.

## Bounded 20 October follow-up on draft PR #829

- **Factual News Briefs are distinct from canonical Stories.** `news-brief/1` is a read-only public projection of current `VERIFIED` Motion with an eligible direct original news/official page. It requires real observed/retrieved times and a current, nonexpired item; unverified, creator-only, future, process-related and homepage-link items are rejected. This is `SOURCE_VERIFIED` reporting, **not** a new System 2 acceptance or new thesis.
- The Blue Desk homepage may show a sourced News Brief as its lead only when it lacks a reader-ready canonical Story. The user follows the **original report**, never a fabricated Story article route. The existing Motion feed's source-verified factual items share the same selection filter.
- **History:** the Deep Dive now resolves exact immutable daily-brief snapshots by UUID using an independent indexed reader, not the latest-24 presenter picker; malformed or nonexistent editions fail closed and cannot silently fall back to the latest.
- New regression tests cover factual news versus creator/discovery leads, original source URL admission, stale/future material, no Story authority mutation, and the exact historical-link implementation.
- The title, prose and mechanism portions of the source Dossier remain unchanged. This is NOT an AI-generated editorial writer or full Bluebelly V6 narrative producer.
- **Release stop:** read-only 20 Oct metadata audit showed Live Vercel deployment protection not enabled and `DASHBOARD_AUTH_REQUIRED` absent from retrieved environment-key metadata. Supabase `hybrid_publication_snapshots`, `market_motion_items` and `story_thesis_versions` currently have public-read SELECT policies. These facts do **not** prove an owner-only data leak, but require explicit route/payload/role smoke tests (and published-data classification) before public cutover or merging this draft. Do not expose an admin/service-role key, loosen RLS, or blindly flip an auth flag.
- Remaining P0/P2 gate: freeze a real AI Story fixture with exact Dossier/Story/thesis IDs, assert that each displayed financial/causal claim has actual supporting evidence, test its market impact and contradiction against the frozen as-of edition, and ensure private Presenter notes are inaccessible. Current 19 Oct edition has six 2-paragraph lessons but no canonical Story manifest entries and no market-tape source manifest. A missing mechanism must remain UNKNOWN, not be filled with invented prose.

## Production QC checklist

- Counts by frozen edition of READY, DEVELOPING and RESEARCH_ONLY, with reasons.
- Canonical cited UUID coverage; original article URLs vs provider landing URLs.
- Primary vs contextual source mix, timing and verified availability.
- Separately track legitimate zero-new-evidence editions versus broken provider output.
- Check real story detail HTTP result and pinned identity, not merely whether a button exists.
- Retain legacy Live Desk API contracts and historical publication records throughout migration.

## Implementation skill routing and browser quality gates — 20 October addendum

Use [Bluebelly V6 — editorial, visualisation and browser QA workflow](./BLUE_DESK_VISUAL_EDITORIAL_QA_WORKFLOW_20261020.md) when implementing V6: **Build Web Apps** owns the Next.js UI, **Build Web Data Visualization** owns honest edition-pinned analytical chart components, and **Webcmd** independently verifies real browser behaviour and public/private boundary. Tiniest Cloud remains prototype-only and Cerebrium remains deferred; neither is a production source, publisher or new reasoning engine. The new workflow proposes **no automatic writing schedule** before P−1 GO, exact claim-level evidence read contracts and verified publisher authentication. This routing does not override the earlier release stop.
