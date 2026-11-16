# X Wire P2 — persistent discovery ledger (23 October 2026)

## Scope
Bluebelly's authenticated X Wire navigation entry (`/owner/x-wire`) reads the service-role-only operational ledger. It is private on the Bluebelly hostname and the operations host; unauthorised users are redirected to Google login, while unrelated owner routes and APIs remain blocked. Raw X posts and private owner health records remain protected; the shared discovery brief exposes only bounded redacted public-post leads and no privileged diagnostics. As of the 30 October 2026 owner override, the proposed roster contains eleven accounts and no paid X API, independent reasoning engine, new research task or cron.

## ZeroHedge X Wire restoration (30 October 2026)
The owner withdrew the 26 October exclusion. @zerohedge is restored alongside newly approved @TGLetter; previously rejected historical posts are retained for audit, not automatically re-labelled verified. A forward migration reactivates the ZeroHedge checkpoint and adds TGLetter. Both remain unverified social leads requiring original-source checking and must never independently trigger canonical Dossier/Story promotion. @TGLetter preparedness reports belong in Newsroom Awareness research, not Regime changes.

## GordianKnotDev X Wire exclusion (30 October 2026)
`@GordianKnotDev` is excluded from retrieval, source-health totals, public discovery, fallback scans and active/deferred post counts. Retain any historical posts for audit only, mark them rejected, and prevent leasing the old account row. Other accounts are unaffected.

## Durable records and security
Two operational public-schema tables are RLS-protected with all anon/authenticated privileges revoked:
- x_wire_accounts: durable last-completed checkpoint; last attempt, observed post, provider cursor and window start; lease token/expiry; source health, failures and unrecovered-history marker.
- x_wire_posts: canonical X post identity, attribution URL, published/retrieved time, text/media link, and discovery/deferred state. Original verification defaults false.
Only the Supabase service-role server adapter writes these objects; claim_x_wire_account atomically leases one due source.

## Acquisition order and safety
1. The authenticated owner view opportunistically checks a source if its 30-minute eligibility gate permits. Concurrent requests cannot take the same unexpired 100-second lease.
2. Resume the saved cursor and original window; otherwise use 2.5h default with 30m overlap from last completed checkpoint. Missed recovery is capped at 72h, retaining an explicit unrecovered gap.
3. FxEmbed public timeline: requests of up to 50 posts/page (provider may actually return 20); maximum 6 pages per account with an 18-second per-source wall-clock budget, 5 concurrent sources, and 7s per request. No X API key. A source may complete before cursor exhaustion **only** when valid, non-reposted, same-author statuses occur in descending time order (excluding bare repost timestamps from chronology proof, allowing at most 60-second adjacent jitter, and rejecting larger original-status inversions) and cross the beginning of the requested observation window.
4. Check original handle, post ID, timestamp, text and external links. Dedupe by post ID. Preserve bare repost filtering and citation to original X post; missing timestamps are not new posts.
5. Save all validated rows before advancing the provider cursor; a failed backlog write cannot advance a completed checkpoint. A normal continuation cursor persists with a 5-minute retry window; a complete scan advances checkpoint and cools down 30 minutes. A first-page HTTP 404 gets at most one same-host retry without the optional `since` parameter. Retrieved rows must still pass author, timestamp and requested-window checks; two failed reads remain unavailable. A previously observed account with an unexplained 404 has a 5-minute retry window; an older inactive source retains the 30-minute window. A provider **404 on a continuation** is ambiguous: discard only that unusable cursor, retain the incomplete-coverage marker, and retry the fresh head after 5 minutes. Never interpret it as verified end-of-feed or an account deletion. A recoverable historical gap anchors the next lookback; older-than-72h gaps remain explicitly partial.
6. The active candidate workload remains capped at 250 globally and 40 per account; excess validated posts are persisted as deferred backlog rather than lost. Failure and incomplete source states remain explicit.

## Authority and verification
An X post, even correctly attributed, is noncanonical social discovery, not market-fact confirmation. The existing MacroPulse ChatGPT task alone writes its Notion Post/Log and the existing Research Gap Gate handles verification. No Story, Dossier, thesis-version or canonical evidence write was added.

Runtime acceptance requires green CI, applied/verified migration, private route deployment and actual logged source retrieval. A 9/9 healthy label additionally needs nine observed, fresh full-window checkpoint results; saved posts alone are not sufficient. Current provider 404 errors may prevent full historical recovery, and that limitation must remain visible. If FxEmbed is unavailable, the UI must show failure rather than claim successful ingestion. On-demand access does not create a 2-hour autonomous server collector.

## 16 November 2026 — automated retry repair

Production ledger readback found five complete sources, two recent completions with older unresolved history, four continuation 404s and three head 404s (14 active sources). Direct unfiltered FxEmbed timeline checks returned HTTP 200 for all seven failing sources. The previous retry timestamps did not themselves trigger work: the only writer was the twice-daily acquisition.

- The existing source-only morning/evening five-minute continuation invocations now pick up failed, incomplete or stale sources using the same lease and cooldown. No additional cron schedule or research writer is introduced; completed recent accounts are skipped. The retry window is still the existing morning/evening burst, not an independent all-day job.
- Prefer the unfiltered timeline head, validate the exact requested local lookback and retry the same failed 404 request once within the budget. On a persistent head/continuation 404, use at most one bounded FxEmbed latest search (`from:handle since:YYYY-MM-DD`) to salvage attributable posts via the same deduplicated ledger. Live search probes successfully returned attributable posts for HormuzReport, KobeissiLetter, OddStats and OilandEnergy. Search is not exhaustive, so it never closes a timeline checkpoint or historical gap. No fallback request is made after a 429/403.
- Homepage shows strict complete coverage, recent-window completions and historical gaps separately, and uses the actual last source-attempt timestamp. Page rendering time is not a retrieval receipt. Older gaps remain explicit; no post is independently verified by either endpoint.
- Acceptance: verify scheduled retry receipt and database readback; distinguish current-window completion, retained search leads, historical gaps and persistent provider failures. The public handoff remains read-only.
