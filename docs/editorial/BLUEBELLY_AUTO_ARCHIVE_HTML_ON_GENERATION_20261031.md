# Bluebelly — automatic private HTML archive on generation (31 October 2026)

**Decision:** A completed HTML-only report is durably archived as a `PRIVATE_DRAFT` automatically. Generating a file and then separately clicking Upload, Import, or Archive must no longer be required **when the report is generated inside My Desk**.

## Runtime contract

- After all five bounded longform chapters finish, **one** authenticated private Editorial Reader request renders the full report and writes the exact resulting HTML + its SHA-256 to the existing `editorial-html` private bucket, then inserts an immutable archive row with its source receipts.
- A full manual reader preview of an edited complete draft uses the same optional `autoArchive:true` contract. Internal previews without this flag remain non-storing; there is no public auto-save capability.
- The browser receives a valid `X-Bluebelly-Archive-Id` and the exact archived HTML before displaying **Saved automatically**. Historical list refreshes on the returned receipt. The redundant manual Archive button is disabled when the completed snapshot has been saved; linked corrections remain a distinct explicit revision action.
- Failed generation, incomplete chapters, failed storage upload and failed DB receipts are **not** marked archived. If a receipt insert fails, the orphan upload is removed. An unchanged retry returns the canonical prior stored HTML after its byte SHA is checked, rather than creating a duplicate or silently swapping the archive.
- Content idempotence uses report date, title, narrative section content and exact selected independent receipt statuses; it deliberately excludes preview request time. This is no claim that the full article text has been fact-checked.
- Only an active Supabase owner session and allowlisted account can trigger it. RLS, private storage, append-only corrections and sandboxed readback remain unchanged. No public publication, PDF dependency or sixth scheduled task.

## Separate pipeline boundary

The 30 October user-provided Editorial Reader was originally written **outside Bluebelly**, in ChatGPT, then downloaded. A browser-only, generation-triggered auto-archive cannot see attachments from unrelated ChatGPT conversations. That file is not imported merely because this feature deploys. A secure Work-to-Bluebelly delivery connector or an authenticated Work Cloud Browser session is required to persist **externally created** HTML automatically; do not claim that case is solved by this PR alone. The existing owner import remains a fallback for legacy reports. Work task ingestion/publishing must remain distinct from public story publication.
