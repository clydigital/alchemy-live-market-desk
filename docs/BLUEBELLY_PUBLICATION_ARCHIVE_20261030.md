# Bluebelly Public-Reader Archive and Unified Newsroom Index

Date: 30 October 2026 · P2 implementation.

## User decisions

1. **News may expire from the visible seven-day surface.** This does not authorise deletion of the historical source and editorial review record. `bluebelly_publication_archive` retains original-source metadata and immutable public reader identities.
2. **Fix disconnected publication history.** Newsroom search and category counts cover both current `NewsBriefV1` reports and known reviewed Bluebelly reader snapshots, with exact-ID/source-URL deduplication. A previously reviewed public snapshot is labelled as such; it is not automatically an approved editor publication or canonical evidence revision.

## Private backend storage

Migration `20261030110000_bluebelly_publication_archive.sql` creates `bluebelly_publication_archive` as a **private metadata archive**, RLS enabled and no anonymous/authenticated direct grants. Records include stable ID, event kind, headline, source URL/name, source code module, affected entities/topics, exact event timestamp **or** source date-only, source-reviewed versus approved-with-receipt status, and original Bluebelly public reader link.

The migration seeds nine existing publicly reviewed original-source reader records (Fed, Bank of Canada, RBNZ, BEA PCE, Amazon, Intel, Sandisk, SK hynix and TSMC). Source data originated from existing in-repository reviewed snapshots, **not** arbitrary research intake or private owner drafts. No new story/market/regime verdict or publication receipt is invented.

The archive is durable metadata and source reference; full narrative replay is **not** reconstructed from this table. Underlying reviewed narrative and metrics remain in the referenced Git-versioned source modules, while existing frozen `hybrid_publication_snapshots` and evidence/source archives remain untouched. If complete independently recoverable backend article-body retention is required, follow with a separately reviewed immutable content-payload migration; do not claim this first migration stores full articles.

## Public reader

- `getRecentArchivedPublicReaderItems` runs server-side, using existing service credentials only on the server; it returns a narrow allowlisted metadata projection.
- `projectPublicArchive` explicitly validates allowed public-origin source modules, safe source URLs, exact internal reader IDs, event dates, category tags, and review state. Even if a database row is malformed, it cannot create a public indexed article.
- Live Newsroom shows **one integrated search and category count**, including reviewed public-reader cards, without copying their full research or creating a new verification gate. Exact same original URL is deduplicated between archival and wire records.
- The seven-day public filter does not delete backend records; no new scheduled task or cron.
- Source-only news wire and archived reviewed reader have **different visible labels**.
- In case of an archive query failure, Newsroom still works for current news and exposes a coverage warning rather than silently reporting a fully complete history.

## Remaining work

The empty `editorial_publications` table is the existing **COTD/OB/Daily Report** library, with a separate owner review and PDF contract, not a ready-made index of the 2026 event recaps. Do not insert fabricated approved `editorial_publications` records just to make news appear.

A future approved-publication process should append immutable revision/snapshot **content** and owner review receipts to the index, including newly authored articles and corrections, using existing authorised workflows. Exact-edition legacy archives continue in `hybrid_publication_snapshots`; do not read them via public service-role APIs without redaction and verified admission. The current `?postEvent=` reader may intentionally stop resolving after seven days, as requested. Backend archive metadata persists regardless.

## Acceptance

- Migration dry-run in CI + production application and metadata readback.
- Nine source-linked reviewed entries present in backend, no owner/private rows admitted.
- Live Newsroom search `q=Amazon` yields a qualified Amazon reader, `q=FOMC` yields Fed, and no duplicate source URL is listed.
- Retain seven-day expiry while verifying old TSMC historical metadata remains stored.
- No change to public Market Monitor, Regime Watch, schedule stack, original news verification, canonical Story/Regime versions or owner/public hostname allowlists.
