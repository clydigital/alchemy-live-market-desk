# X Wire P1 — free-provider private preview (23 October 2026)

## What was built
- New **owner-only** /owner/x-wire page, authenticated by the existing Blue Desk middleware on an operations hostname; Bluebelly public hostname remains 404.
- On-demand, server-side fixed-host FxEmbed X profile timeline requests (https://api.fxtwitter.com/2/profile/{handle}/statuses?count=50&since=...), using its published free API v2. No keys, paid X API, browser tokens, cron, scheduler, database, or canonical evidence writes.
- Reads the approved ten-account roster from lib/x-sweep-core.ts, concurrent request limit 3, 7-second per-account timeout, 1MB response cap, original X URLs, publication timestamps, attributable text and media-attachment counts. The user-selected normal 2.5h window, 250 candidate cap, 40/account soft cap and core dedup code are reused.
- Per-source actual attempt/response state: healthy means the third-party provider replied with a suitable result, not that X original verified it or that historical coverage is complete. Provider 429, 401, 403 are blocked; failures and malformed payloads are labelled. Missing timestamps, unexpected authors, bare reposts, bad IDs and other inconsistent rows are withheld.
- Candidate posts link directly to X, and only the account handle returned by the third-party provider is attributed. The UI does not display detached imagery without original provenance.

## Limitations / follow-up
- This is **stateless** on-demand diagnostics, not continuous ingest or historical backfill. It DOES NOT store per-account checkpoints, a durable backlog, extracted media, Story references, nor mutate canonical Dossier, edition or thesis versions.
- No server-to-Notion/Gate write is authorised. The existing two-hour ChatGPT MacroPulse task remains responsible for Notion discovery/sourcing; source-attempts must still appear in a future verified Pulse to accept that scheduled workflow as operational.
- Free provider availability is contingent on third-party service. If HTTP access from the actual Vercel deployment fails, source health will visibly show this failure. A READY deployment only verifies build/deploy; an authenticated owner readback must establish real X posts and their source times.
- A first 50-item page may not represent an entire busy account's window. When its continuation cursor indicates possible missing in-window posts the account is PARTIAL, not complete; overspill from soft limits is not saved and is explicitly labelled deferred/not persisted. Do not claim complete coverage.
- Provider identity/source attribution is not equal to underlying geopolitical, economic, price or oil/war claim verification. Existing Research Gate and canonical evidence admission remain mandatory.
- Future P2 should add bounded paginated recovery and a durable source ledger using the existing approved intake layer after separate authentication/data-lifecycle review. No new reasoning engine.

## Docs
- FxEmbed API overview: https://docs.fxembed.com/api/introduction/
- Timeline contract: https://docs.fxembed.com/api/twitter/operations/2profilehandlestatuses/
- Existing default and research boundary: docs/X_SWEEP_MACROPULSE_INTEGRATION_20261023.md.
