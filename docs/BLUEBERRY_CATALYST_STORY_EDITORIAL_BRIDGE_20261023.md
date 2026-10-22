# Blueberry V7 — catalyst-to-story-to-article integration (23 October 2026)

**Status:** staged integration specification, not a new reasoning/writing engine. Implement the shared public display pieces in PR #983, preserve the R10 presenter preview in PR #981 (stacked on R9 #979), and reconcile those branches only after R10 security/owner gates. No separate cron or paid X API.

## Single identity spine

Use `canonical story UUID + exact edition UUID` for a published Story reading. Persisted Story and thesis-version history remain authoritative; source-linked publication snapshots remain immutable. An event or X post may have overlapping symbols without belonging to that Story. Do not join Stories by similar headline, subject image, or asset overlap. The published projection may carry existing upstream `subjectAssets`, but artwork and asset filtering must not manufacture a canonical Story/Regime edge.

- `sourceEvent`: original X post ID, URL, author handle, observed/published timestamps, retrievedAt, attached images/links, provider coverage and verification.
- `catalyst`: source-verified development with canonical evidence UUIDs only after Research Gate; retain direct source, publication time, thesis-consistent/contradicting status and event timestamp.
- `storyVersion`: persisted thesis version, actual upstream `storyId`, edition, as-of and explicit change status; chronology is sorted by frozen publication time, not browsing time.
- `regimeRelation`: only persist an existing canonical relationship ID when adjudicated. A shared countryball never proves a regime link.
- `presentationTag`: multiple market/country/company keys projected from existing `subjectAssets` plus explicitly named subjects. Visual-only; countryballs/company icons have no evidentiary force.
- `articleDraft`: owner-only writer state, exact story/edition/catalyst/evidence IDs, selected 4H/daily/weekly chart check references, LY editorial style and human sign-off; not an automatically accepted Story.

## End-to-end route

1. X Sweeper candidate discovery uses the existing MacroPulse schedule: **2.5-hour lookback, 30-minute overlap and original-post-ID dedupe**. A post remains a Motion/research lead until original-source verification. Preserve media reference as URL, never silently download/re-use copyrighted images.
2. Research Gate checks independent primary evidence, reconciles source as-of and observed market history. Motion alone never writes Story or Regime; existing System 2 is sole adjudicator.
3. On an admitted canonical change, compose the latest source-authored **catalyst headline** for the same persistent Story ID. Older immutable readings stay accessible in a sidebar (not title-similarity joins).
4. Blueberry front page shows the **latest iteration per Story**, six items per page (3x2 desktop), with subject-ball filters. Calendar uses the same badge contract for macro releases/earnings and labels actual vs scheduled/estimated times; symbol matches are discovery, not verified causality.
5. In the R10 owner Presenter, selecting a Story/edition/event must carry those explicit IDs through the existing `/presenter` → full prep / editorial adapters; show related verified source URLs, current dated Brent/WTI/yields etc, separate manual technical checklist, and COTD/OB drafts with sources and LY editorial quality checks. Author approval is required for final publication.

## Integration guards

- Keep PR #981 preview-only Vercel exemption **out of main**, and do not merge a broader hostname auth exception.
- Maintain R10 owner Google SSO allowlist; the public reader must never receive private technical notes, Dossier raw JSON or unverified X leads.
- Treat time windows independently: X event time, source observation time, edition publication time, scheduled calendar event time, technical-chart timeframe.
- Render explicit `UNAVAILABLE / STALE / PROXY / MONTHLY` states where evidence is incomplete. No chart data manufactured by visual representation.
- Do not combine R10, PR #983 or X Sweeper changes by blind file overwrite. Perform scoped three-way reconciliation for shared `app/blue-desk/page.tsx`, common CSS, owner navigation and public host routing. Run full CI, source/reader snapshots, production host allowlist tests and authenticated owner preview smoke test.

## Acceptance path

- Anonymous user: latest catalyst on page 1, older published Story on page 2, matching filters, same-Story edition history and original sources, calendar badge links. Cannot see owner prep or unverified X leads.
- Owner: click a specific latest verified catalyst, inspect same Dossier/Story and historical editions, check technicals, choose COTD/OB, edit with LY constraints. No automatic publication.
- X post pending primary verification: appears in research leads only, not the public Story or its causal history.
- Rejected or unresolved System 2 change: no new canonical Story headline masquerading as accepted.
- Existing preserved R10 presenter/Google OAuth and source-gated publication remain intact.

**Current implementation:** PR #983 ships bounded edition archive/pagination, exact Story history, ball filters, calendar identity and official macro trends. The X-Sweeper-to-Presenter handoff is a separate adapter integration gate and cannot be treated as completed by these display changes.
