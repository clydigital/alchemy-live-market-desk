# Bluebelly Writing Brain — Notion-first living theses
**Decision: 8 November 2026. Supersedes future editorial-output instructions in the 6 November source-first three-idea-slate contract.**

## What changed
- **Canonical editorial working memory:** [Writing Brain — Living Editorial Theses](https://app.notion.com/p/411519b67a9481fcb612c2d975d7f31d) under the existing [Financial Research](https://app.notion.com/p/3ea519b67a9481d0910ff8d54c5b40b3) hub.
- **First reviewed historical import:** [AI Financing vs Cash Conversion](https://app.notion.com/p/411519b67a94814d869fc8ed53d3dcd8). It is a *working* interpretation, seeded from the 7 November [Research Gap record](https://app.notion.com/p/3eb519b67a948169a685f0bf9689467f), with exact source links and unknowns. Its creation is **not** a fresh trading signal or issuer confirmation.
- **Producer:** ChatGPT/Work **on demand**. No daily 3-angle quota, no new automation, no report-parent ID/SHA, no new Vercel model generator and no auto-publication.
- **Reader:** Private My Desk offers a plain link to the Notion hub. Bluebelly Watch still reads *approved public Story memory*; it does not read or promote unapproved private Notion hypotheses.
- **Historical storage:** Retain Supabase `blue_desk_editorial_slates`, `material_event_receipts`, `blue_desk_automated_reports`, existing authenticated readers, PDF editions, and old exact links *as historical records*. They are not the target for new Writing Brain outputs. No deletion or schema change.

## On-demand Writing Brain execution contract
1. Read the Notion thesis hub and existing matching thesis page **first**. Use stable thesis ID. If one exists, update it instead of opening a duplicate.
2. Fix `RUN_ASOF_UTC`, MYT/ET date and most recent completed US trading session. Read latest relevant MacroPulse Post, Research Gap Run/Registry, issuer documents, creator leads (attributed), and Bluebelly verified-source/market observations. An unavailable connector is a coverage gap, not a verified absence.
3. Only after matching metric, vintage and original source, distinguish:
   - **OBSERVED:** original verified source URL, publication and retrieval times, measured value, units and period.
   - **HYPOTHESIS:** proposed mechanism that can be wrong.
   - **COUNTERCASE:** strongest alternative mechanism or disconfirming evidence.
   - **UNKNOWN:** consensus, precise price reaction, net proceeds or source not proved.
4. Write or append the **existing Notion thesis**: falsifiable claim; observed evidence; interpretation; countercase; missing proof; next deciding test; status (STRENGTHENED/CHALLENGED/UNRESOLVED/INVALIDATED/ARCHIVED); optional article angle; timestamped revision log. Preserve previous revisions and original source IDs/URLs.
5. Do not write a daily slate to Supabase, require exactly three ideas, generate a private editorial PDF/HTML merely to fulfil the handoff, create a Dossier or mutate the canonical Story/Evidence ledger. Draft actual articles only when asked; publication requires existing review and source gates.
6. Verify the Notion write through a page URL or readback. If write access fails, report not saved and return a clearly marked draft; never claim persistence from model text alone.
7. Public Watch uses only its existing source-limited Story query and old article deep links. A living Notion thesis never becomes a public Story automatically. Any future bridge would require a separate owner-approved source+privacy audit.

## Legacy dependency inventory and exit criteria
- `lib/editorial-slate-server.ts` and `lib/bluebelly-owner-editorial-recall.ts` still read historical Supabase slates for owner evidence recall. Keep their semantics and RLS.
- `lib/blue-desk-private-slate-job.ts` and `lib/blue-desk-automated-report-late-handoff.ts` are legacy PDF generators. Existing `BLUEBELLY_ENABLE_LEGACY_PDF` is opt-in/off, and source-only scheduled research short-circuits Dossier/report generation. Do not enable either to fulfil a Writing Brain quota.
- Old My Desk report-parent readers and exact-version selectors stay protected; avoid changing last-good historical editions to new Notion content.
- The former Writing Brain automation `6ad93a63093c81918e686dc6ab799101` was disabled in the 6 Nov audit. Its runtime state/prompt cannot be assumed changed until the Automations connector confirms; no task is created or resumed by this PR.
- No new production Notion API integration or public API is added. Notion access inherits the existing Financial Research workspace permissions; check Notion sharing separately before treating content as confidential.

## Verification
- Notion hub and initial thesis created/read back through connected Notion; dated Research Gap sources linked.
- My Desk external Notion link remains behind existing owner auth; no new public path.
- Tests assert Notion-first contract, preserved historical reader and lack of Supabase editorial writes in current My Desk.
- GitHub CI must pass tests, TypeScript and production build. Production deployment and authorised-owner link click should be separately verified.

## Rollback
Stop using the new editorial ledger and revert the private link/contract if necessary. Existing Supabase history remains available; do not turn on old scheduled PDF/HTML producers as an automatic rollback. Re-enabling generation would require separate authorisation and cost/source audit.
