# X Wire P2 — persistent discovery ledger (23 October 2026)

## Scope
Bluebelly's authenticated X Wire navigation entry (`/owner/x-wire`) reads the service-role-only operational ledger. It is private on the Bluebelly hostname and the operations host; unauthorised users are redirected to Google login, while unrelated owner routes and APIs remain blocked. No public ledger access is granted. As of the 26 October 2026 exclusion, it uses the remaining registered nine-account roster and no paid X API, independent reasoning engine, new research task or cron.

## ZeroHedge X Wire exclusion (26 October 2026)
@zerohedge must never be fetched, queued, shown, counted as active/deferred, used as X Wire attribution, or promoted as an X Wire evidence lead. Remove it from the roster and fail closed in candidate parsing and durable scan. Historical posts remain retained for audit, but are marked rejected by the migration and omitted from X Wire readers/counts. Legacy clients must not claim a lease for this excluded handle. This restriction is scoped to X Wire and the X sweep, not unrelated news-source selection.

## Durable records and security
Two operational public-schema tables are RLS-protected with all anon/authenticated privileges revoked:
- x_wire_accounts: durable last-completed checkpoint; last attempt, observed post, provider cursor and window start; lease token/expiry; source health, failures and unrecovered-history marker.
- x_wire_posts: canonical X post identity, attribution URL, published/retrieved time, text/media link, and discovery/deferred state. Original verification defaults false.
Only the Supabase service-role server adapter writes these objects; claim_x_wire_account atomically leases one due source.

## Acquisition order and safety
1. The authenticated owner view opportunistically checks a source if its 30-minute eligibility gate permits. Concurrent requests cannot take the same unexpired 100-second lease.
2. Resume the saved cursor and original window; otherwise use 2.5h default with 30m overlap from last completed checkpoint. Missed recovery is capped at 72h, retaining an explicit unrecovered gap.
3. FxEmbed public timeline: requests of up to 50 posts/page (provider may actually return 20); maximum 6 pages per account with an 18-second per-source wall-clock budget, 5 concurrent sources, and 7s per request. No X API key. A source may complete before cursor exhaustion **only** when valid, non-reposted, same-author statuses occur in descending time order (allowing at most 60-second upstream adjacent jitter, while rejecting larger inversions) and cross the beginning of the requested observation window.
4. Check original handle, post ID, timestamp, text and external links. Dedupe by post ID. Preserve bare repost filtering and citation to original X post; missing timestamps are not new posts.
5. Save all validated rows before advancing the provider cursor; a failed backlog write cannot advance a completed checkpoint. A normal continuation cursor persists with a 5-minute retry window; a complete scan advances checkpoint and cools down 30 minutes. A first-page HTTP 404 gets at most one same-host retry without the optional `since` parameter. Retrieved rows must still pass author, timestamp and requested-window checks; two failed reads remain unavailable. A previously observed account with an unexplained 404 has a 5-minute retry window; an older inactive source retains the 30-minute window. A provider **404 on a continuation** is ambiguous: discard only that unusable cursor, retain the incomplete-coverage marker, and retry the fresh head after 5 minutes. Never interpret it as verified end-of-feed or an account deletion. A recoverable historical gap anchors the next lookback; older-than-72h gaps remain explicitly partial.
6. The active candidate workload remains capped at 250 globally and 40 per account; excess validated posts are persisted as deferred backlog rather than lost. Failure and incomplete source states remain explicit.

## Authority and verification
An X post, even correctly attributed, is noncanonical social discovery, not market-fact confirmation. The existing MacroPulse ChatGPT task alone writes its Notion Post/Log and the existing Research Gap Gate handles verification. No Story, Dossier, thesis-version or canonical evidence write was added.

Runtime acceptance requires green CI, applied/verified migration, private route deployment and actual logged source retrieval. A 9/9 healthy label additionally needs nine observed, fresh full-window checkpoint results; saved posts alone are not sufficient. Current provider 404 errors may prevent full historical recovery, and that limitation must remain visible. If FxEmbed is unavailable, the UI must show failure rather than claim successful ingestion. On-demand access does not create a 2-hour autonomous server collector.
