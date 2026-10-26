# Hybrid retirement decision — Bluebelly sole presentation product

**Decision 27 October 2026:** Fully retire the separate `alchemy-hybrid-market-desk` website and any legacy user-facing Hybrid surfaces. This is NOT a merger or another Bluebelly page. One public market site, one authenticated owner workspace, one canonical Live research backend.

## Target UX
- **Bluebelly Today:** sourced current developments and explicit freshness.
- **Bluebelly Stories:** catalyst-led explanation and what changes the thesis.
- **Bluebelly Markets:** observed cross-asset data and dated source.
- **Bluebelly Daily Report:** readable report experience, with the automatic client-ready PDF in the approved visibility scope.
- **Private Presenter Studio** at `/owner/presenter`: technical checks, live run of show, source-context and a direct link to `/owner/daily-report`. Never route the user to a separate Hybrid app.
- The existing Calendar is an embedded/linked support view rather than a second market story engine. No net-new front-end page is required to retire Hybrid.

## Important factual blocker on 27 October
The production `blue_desk_automated_reports` table was inspected and contains **zero completed report rows**. The current backend uses `status='ready'` and `ready_at`, stores PDFs privately, and renders them under the authenticated Bluebelly `/owner/daily-report`. The public `/daily-report/pdf` route is deliberately disabled. The earlier public PDF project spec has been superseded by the actual private implementation. Do not describe the PDF as a published replacement until a real source-qualified file exists and the approved reader opens it. No proof of editorial factual correctness has been established.

## Retirement gates, in order
1. **PDF production acceptance:** one real successful automatic morning/evening edition; actual persisted PDF bytes and source ledger; render and download through the intended Bluebelly reader; verify dates, linked references, countercase, source gaps, actionable watchpoints and no unsupported market prices. Then prove the next edition reuses the same schedule without duplicate jobs.
2. **Client access decision:** retain the current owner-only implementation unless a separately authorised change opens client access. `client-ready` quality is not permission to expose private drafts/data. If a public/client edition is desired, use an independently source-reviewed promotion gate.
3. **Presentation cutover:** replace user-facing links and bookmarks that launch legacy `/hybrid-output` or the separate Hybrid domain with existing Bluebelly destinations. Keep minimal temporary redirects for bookmarked URLs. Do not create a `/hybrid` landing page or another competing report.
4. **Consumer audit:** confirm no active readers require the former Hybrid domain, `/api/hybrid-feed`, `/api/hybrid-feed-v2`, `/api/intelligence-feed`, or `/api/internal/canonical-feed`. Retire outbound machine-feed compatibility only after API caller telemetry or code consumers demonstrate it is safe. Do not remove the Live canonical research pipeline, Story/Dossier writers, immutable publication snapshots, evidence UUIDs or `story_thesis_versions`.
5. **Infrastructure retirement:** stop/decommission the Vercel project `alchemy-hybrid-market-desk` and archive the GitHub `clydigital/alchemy-hybrid-market-desk` repo **after gates 1–4**. Preserve an archive or export of user-owned notes, investigation reviews, and edition replay data if that separate app owns any. Remove obsolete secrets and scheduled checks only when the relevant consumers are gone. Archive and disable rather than destructive database deletion.
6. **Final QA:** Bluebelly public + owner navigation contains no Hybrid entry points; no broken links from Story/Markets/Presenter surfaces; no external callers broken; server secrets remain private; Bluebelly report and technical checks work without ChatGPT at work.

## Safe phase one shipped by this PR
- Link the private Bluebelly navigation **Presenter Prep** to the native `/owner/presenter`.
- Link the private homepage to the same Presenter Studio.
- Replace presenter and writing-desk outbound Hybrid-prep links with existing local context/report navigation.
- No legacy code, route or database deletion while the PDF output is unproven.

## Ownership boundary
Live Desk retains the sole canonical **research/Dossier/System 2** authority. The PDF/storytelling formatter is not a new system for admitting evidence, creating thesis versions or changing regimes. Hybrid's independent deployable product has no enduring role in the target architecture.

## Out of scope now
No new cron slots, new client page, automatic publication to public, Story engine duplication, migration of obsolete Hybrid visuals, or hard delete of historical research records.
