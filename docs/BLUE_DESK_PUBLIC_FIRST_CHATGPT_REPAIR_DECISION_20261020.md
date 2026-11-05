# Bluebelly / Live Desk — public-first ChatGPT repair decision
**Decision recorded 20 October 2026.** The owner explicitly prioritises making Live Desk/Bluebelly research, presentation and frontend **readable publicly while the system is repaired through ChatGPT-connected tools**, rather than waiting for private Google OAuth acceptance before frontend/content work. This supersedes **the prior rollout sequencing priority**, not the factual findings of security audit #834/#849 or the canonical evidence boundary.

## What "public" means for the implementation
- Read-only presentation pages, articles, historical Story editions, market context, analytic charts and proposed view-only Dossier/Presenter screens should be **available without an interactive login** when the product intends to expose them for ChatGPT/browser review. If existing pages carry write capabilities or internal/private payloads, implement a safe read-only view/projection rather than exposing privileged operations as a shortcut.
- The GitHub repository, design/runbooks and Vercel-hosted public reading paths remain convenient for connected ChatGPT, browser tools, TinyFish and other reviewers. Do not require an operator Google session solely to view public research.
- No automatic publication approval is implied: only content intentionally selected for public distribution should appear in a public reader. Do **not** expose Vercel/Supabase/OpenAI or financial provider keys, bearer tokens, machine credentials, service-role clients, unapproved personal information, raw authorization headers, or mutable administration/cron endpoints. Public read access is **not** permission to issue uncredentialed database writes.
- Exact-source UUIDs/URLs may be visibly cited where publication/redistribution is permitted. The canonical immutable edition/Story/thesis reader, factual gating, and source licensing/copyright obligations remain unchanged.

## Immediate prioritisation
The former **P−1 security GO prerequisite is no longer a dependency for isolated public-reader design, story content fixes, chart work, or preview/PR testing**. Security findings remain open and should be fixed in bounded parallel tasks; do not treat issues #834 and #849 as already remediated or quietly weaken access to privileged data.

1. **P2-AI now:** Build one substantive, edition-pinned, source-grounded AI Story article with short LY-style paragraphs, observation-versus-inference labels, issuer facts, mechanism where actually supported, counterargument, measurable next tests, direct evidence links and truthful missing-reaction states. Use the existing `market-brief-article/1` and approved `blue-desk-public-story-evidence/1` constructs, not a new Story writer.
2. **Visualisation:** Add the smallest truthful quantitative chart when the edition contains comparable dated series; otherwise display a concise "Source data unavailable" state. Use installed Build Web Apps + Build Web Data Visualization skills while implementing the existing Next.js UI.
3. **ChatGPT-side QA:** Test anonymously accessible actual public URLs in Webcmd or another supported browser, exact historic links, mobile interactions and response text. Document access/tool failures as distinct from site failures.
4. **Further slices:** Rates/US02Y–US30Y + Gold, oil, then broader Story pages; connect the separate read-only editorial projection to actual publication only after idempotency, source checks and a verified authorised writer path.
5. **Scheduling:** Keep MacroPulse even-hour and Research Gap Gate 08:40/20:40 unchanged; do not add an automatic 09:15/21:15 writer until a working content compiler/publisher exists. No second reasoning table/engine/thesis path.

## Release and security are separate checklists
- **Content/UI acceptance:** observable rendered page, correct pinned edition IDs and source URLs, supported/noninvented copy and charts, keyboard/mobile regression and working public deep links.
- **Operational protection:** protected mutations and secrets, no public service keys, safe read-only projections for otherwise privileged screens, and source licensing; retain issue #834/#849 progress as engineering risks without forcing unrelated article/UI work to stop.
- A READY deployment proves build/release state, not data access approval, correct Story adjudication or evidence-backed explanatory depth.
- Do not call a public URL accessible when browser tools cannot actually retrieve it. Run documented browser checks before declaring site acceptance.

## Relationship to prior records
- `docs/BLUE_DESK_P_MINUS_1_P1B_ACCEPTANCE_20261020.md` and `docs/BLUE_DESK_PUBLIC_API_FIELD_REVIEW_20261020.md` remain factual snapshots of observed technical risk as of that audit and must not be rewritten as false PASS states.
- `docs/BLUE_DESK_VISUAL_EDITORIAL_QA_WORKFLOW_20261020.md` is amended to refer to this owner's revised **public-first implementation priority**.
- Do not close #834/#849 simply because the user accepts public **viewing** during development.
