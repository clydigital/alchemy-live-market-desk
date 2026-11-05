# Bluebelly V6 — editorial, visualisation and browser QA workflow
**Adopted 20 October 2026; updated for the owner's public-first ChatGPT repair decision.** Read the priority override in [PUBLIC_FIRST_CHATGPT_REPAIR_DECISION_20261020.md](./BLUE_DESK_PUBLIC_FIRST_CHATGPT_REPAIR_DECISION_20261020.md). This is an implementation and acceptance runbook, **not** authority to expose credentials, mutate canonical evidence or invent research. Read alongside `docs/BLUE_DESK_P_MINUS_1_P1B_ACCEPTANCE_20261020.md`, `docs/BLUE_DESK_CONTENT_PRODUCTION_READINESS_20261020.md` and `docs/BLUE_DESK_PUBLIC_API_FIELD_REVIEW_20261020.md`. Re-check current production/PR state rather than treating their 20 October snapshots as perpetually current.

## Architecture and ownership (unchanged)
1. **MacroPulse** (existing even-hour MYT task) owns broad research, source manifests and Notion Pulse/Log publication. Specialists are selected by question; original source/measurement provenance is mandatory.
2. **Research Gap Gate** (existing 08:40/20:40 MYT task) resolves 2–4 material discriminators with primary-source verification and writes the *existing* Notion Run and Registry. Do not turn this into an editorial writer.
3. **Canonical Live Desk / Dossier / System 2** alone admits evidence, adjudicates Motion and mutates the existing Story thesis-version path. Motion, creator and social materials remain non-evidentiary until independently admitted. No additional reasoning engine, database table, Story writer or thesis-version route.
4. **Bluebelly Editorial Compiler** is a proposed downstream **read-only presentation projector** using approved edition-pinned published facts and interpretations. It may arrange and explain only authorised material: no new Story judgement, evidence mutation, source invention, or revision of frozen historical editions. It is **not a separately authorised production job** until its inputs, output contract, QA and access controls are implemented and reviewed.
5. **Bluebelly V6 frontend** displays approved public versioned DTOs on existing Vercel infrastructure. Legacy Live and Hybrid consumers keep their existing behaviour until explicitly migrated and parity-tested. Presenter/owner-private analysis never enters a public DTO.

## Installed capability routing (use selectively)
| Tool/skill | Owner | Use | Not for |
|---|---|---|---|
| **Build Web Apps** (frontend-app-builder, React best practices, frontend testing/debugging) | Frontend implementation | Existing V6 mockup fidelity, Story/article reading components, section hierarchy, source and uncertainty UI, mobile/desktop behaviour; reuse current Next.js architecture | Research truth, automatic publication authority, replacing canonical Next.js/Vercel/Supabase |
| **Build Web Data Visualization** (router; React/Next.js, D3, dashboards, uncertainty, testing, accessibility) | Chart engineer | Rates curve and US02Y–US30Y vs gold; AI capex/revenue/FCF; expected-vs-actual CPI/FOMC/tape timelines; evidence-linked charts and responsive fallbacks | Inventing chart points, confidence, event timing, or causal relationships |
| **Webcmd** (browser) | Independent browser QA / bounded source inspection | Actual anonymous and owner-authorised UI smoke, source-link click-through, exact-edition replay, chart interaction, console/network errors, responsive/keyboard QA; capture URL/time/observed result | Security approval from screenshots alone, fabricated access proof, database writes, unverified transcript claims |
| **Tiniest Cloud** | Isolated experiment only | Optional disposable demo independent of canonical production | Production article DB, research source of truth, Story/edition publisher, shadow auth store |
| **Cerebrium** | Deferred inference infrastructure | Only after measured CPU/GPU workload, cost and security justification; explicitly review deployment billing and auth | MVP narrative repair, alternate reasoning authority or speculative infrastructure |
| **Vercel / Supabase / GitHub** | Existing production owners | Current protected service infrastructure, release CI/observability and exact read contracts | Bypassing P−1 or creating parallel truth stores |

**Important:** ChatGPT-installed tools and skills are not automatically executable in Vercel, a scheduled ChatGPT task, or another connected account. Frontend implementation uses the skills while changing code; browser QA requires an actual session; runtime publication requires its own authorised implementation and verified secrets. No tool name alone is evidence that a retrieval ran.

## Suggested editorial read contract (implement and test before any writer schedule)
For one eligible, immutable `editionId + storyId + thesisVersionId?` (with a nullable `dossierId` if truly absent), a versioned **public allowlisted** projection should expose only validated presentation fields:
- `title`, `deck`, `asOf`, `editionId`, source status and explicit epistemic / uncertainty state.
- Paragraph blocks `whatHappened`, `whyItMatters`, `marketReaction`, `countercase`, `nextTests`: **each material assertion** points to exact evidence UUID(s), original URL(s), source vintage and relevant observation window. Missing fields render *unavailable*, never hallucinated prose.
- `chartSpecs[]` with `chartId`, insight/question, typed observable series, units, scale and comparison semantics, source UUID/URL for every series, data-as-of, market timezone/period, `null`/missingness, annotation provenance, and edition boundary. If actual price/yield series are absent, show an explicitly labelled research question or no chart.
- `causalLinks[]` only where exact frozen accepted edges and permitted evidence exist; preserve observed/supported/inferred/speculative labels. Never auto-promote a source correlation to proof.
- `relatedStoryLinks[]` and historical links preserve exact edition on every navigation; invalid or unauthorised historical identity fails closed (not current-edition fallback).
- Server-side public allowlist must exclude Research Gap internals, private Presenter annotations, raw Dossier deliberation, sensitive operational fields, credentials, and unapproved market-data redistribution.

**Editorial length is a quality target, never an evidence bypass:** For a genuinely supported major Story, aim for 2–3 short paragraphs explaining what happened, 3–4 on mechanism/why it matters, 2–3 on observed cross-asset reaction, 2 on contradicting interpretations, and 1–2 on measurable next steps. Preserve LY-style 1–3 sentence paragraphs, concrete data, brief causal links and defensible uncertainties. If sufficient source support is unavailable, publish a shorter labelled `SOURCE_VERIFIED FACT / DEVELOPING / RESEARCH_ONLY` or no eligible article. A News Brief and a chart monitor are **not** automatically long-form Stories. Never stretch paragraphs to hit quotas or silently change `UNRESOLVED` to accepted.

## First vertical slice — AI Story only
1. Freeze production `editionId`, Story ID, optional Dossier/thesis IDs, accepted status, source UUIDs and source URLs using the **current** read contract. Compare to the known 19 October frozen fixture without substituting newer data into it.
2. Render one existing edition-pinned AI public Story with an accurate status, one issuer fact/source block and empty-state mechanism/market reaction where necessary. Current reported TSMC/CoreWeave numbers are *issuer facts*; absent tape evidence is not licence to claim a price reaction.
3. Add one evidence-linked chart **only if** a comparable, as-of bounded series actually exists (e.g. capex vs operating cash flow with same period, unit and definition). If absent, include a tested `DATA UNAVAILABLE` component rather than synthetic points.
4. Build with the **existing** Next.js component structure (Build Web Apps); implement visualisation in a bounded dynamically loaded client component (Web Data Visualization). Keep React responsible for shell/controls and the renderer for chart geometry.
5. Preserve current public Bluebelly and old exact-edition Story pages. Build and preview public reader improvements **now**, without waiting for owner Google OAuth tests; avoid opening mutable owner tools or unreviewed raw database payloads. A READY build is not proof of factual article quality or source provenance.

## UI/visualisation acceptance
- Insight-led chart title, clearly visible units, named series, original links and *observed* data-as-of near each chart.
- Missing/stale/partial/offline values visible, never silently interpolated or carried forward as live.
- Desktop/mobile portrait reading paths; chart-first responsive summary with tap/keyboard controls, non-hover source access, contrast and reduced-motion support.
- Timezone-correct releases, historical edition as-of safety, correct expected-versus-observed timing; source image/graphic never substitutes for a factual measurement.
- Lazy-load heavy renderers; avoid duplicative data fetches, hydration mismatches, chart instance leaks and layout shifts.
- Visual regression, accessible labels/keyboard, valid source links and exact UUID/period assertions in tests.

## Webcmd browser and security QA gates
Use Webcmd's installed browser skill and prerequisites for actual pages; if unavailable, use existing supported browser/Playwright fallback with recorded limitation. Capture **deployed URL, deployment/commit ID, observation time, auth role, exact URL and outcome** for each check:
1. Anonymous Bluebelly public root/calendar/approved edition-pinned Story succeed, but all private owner/Presenter routes and `/api/*` on Bluebelly stay denied per host contract.
2. Anonymous original Live public reading routes work; owner `/owner/live`/Dossier require authentication; test approved Google user, unapproved user and expired session **only when authorised test accounts exist**. A negative 401/404 is not positive owner-login proof.
3. Genuine machine/cron bearer path verified by an authorised operator without revealing or copying secrets; no guessed tokens or blanket `DASHBOARD_AUTH_REQUIRED` flip.
4. Correct cited source links, exact edition replay and invalid-edition failure; compare visible DOM/JSON claims to frozen IDs, not page generated time.
5. Every major section has substantive supported paragraphs *or* explicit honest absence; charts label unavailable/stale states, annotations and source vintage.
6. Compare mobile/desktop screenshots, keyboard/source navigation, loading/error states; inspect runtime network and console errors. Failing required checks block merge/cutover.

**Revised prioritisation:** The user has approved **public-first read-only viewing to facilitate ChatGPT-side fixes**. P−1 technical findings (#834, #849) stay unresolved in a separate risk/remediation track but no longer block safe public-reader UX, narrative depth, data-chart components or preview work. Exposing privileged credentials, unapproved confidential payloads or anonymous write operations remains prohibited. Automatic publication still requires a verified authorised writer, exact-source contract and content QA.

## Publishing cadence decision
- Prefer **on-demand / event-driven, idempotent compilation** after an accepted canonical edition and approved read projection: key by `editionId + storyId + projectionVersion`; skip empty/identical/unsupported material.
- A possible **09:15 and 21:15 MYT** fallback writing/retry schedule is **NOT CREATED OR ACTIVATED** by this runbook. It must follow actual Gate completion (existing 08:40/20:40), an implemented edition-pinned content compiler and a verified authorised writer/publish bridge. A public reader does not require public writer privileges.
- Do not write new MacroPulse posts from the publishing lane, or edit the 16-company Notion hub on the web-editorial cadence.

## Release partitions
- **Parallel access/security track**: classify owner data and sensitive fields, verify protected writer/machine actions, source licensing and update #834/#849; do not treat this as a dependency for public reader layout, research explanation or chart QA.
- **P0/P1a/P1b** frozen fixtures, first-tier citation admission and honest quiet-session fact/News Brief selection.
- **P2-AI (immediate work)** one complete but evidence-limited edition-pinned AI Story vertical slice, source-linked visual component, responsive layout, anonymous-read Webcmd QA.
- **P3** rates and US02Y–US30Y/gold, then oil and larger AI monitor panels **only after** evidence and performance proof.
- **P4** repeatable editorial compiler/publisher acceptance and optional retry cadence (separate reviewed PR), never a second canonical reasoning engine.

No code, migration, auth setting, production schedule or deployment is changed merely by adopting this workflow document.
