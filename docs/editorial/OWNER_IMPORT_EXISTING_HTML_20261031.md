# Import finished HTML reports into My Desk

31 October 2026 — owner-only enhancement to the existing HTML edition archive.

## Why it exists

A manually produced `.html` report downloaded to a user's device is **not** automatically present in Bluebelly's archive. Until now, the owner studio could only archive content assembled by its internal draft editor. The 30 October corrected Editorial Reader v4 was a standalone manual file, which explains why My Desk showed no edition despite a successful archive deployment.

## How to use

1. Open [Bluebelly My Desk — Daily Report Studio](https://bluebelly-desk.vercel.app/owner/daily-report) while signed into the approved account.
2. Under **My HTML report editions**, use **Already have a finished HTML report?** → **Choose file** and select the dated `.html` report.
3. Click **Import HTML report into My Desk**. After success, the original section design, inline SVG graphs, hyperlinks and static X-post links remain in the private HTML edition history.
4. Open **Read archived HTML** or **Download exact edition**. The file stored is the *static, executable-script-removed* version and its SHA-256 is verified on each read.
5. An optional correction target creates a separate immutable edition with the same original date.

The 30 October pilot's title and date are read from its existing markup and date-bearing filename. The current importer does **not** automatically ingest ChatGPT conversation attachments or provide automatic scheduled reports.

## Security and evidence limits

Imports go through the **existing** `/api/owner/html-editions` endpoint with the same private host gate, Supabase user and active allowlist, and same-origin POST check. Input is bounded to 950KB of UTF-8 HTML, requires a Bluebelly document and a real `YYYY-MM-DD` report date, strips scripts and rejects iframe/form/networked media, event-handler attributes and other executable markup. This is conservative by design: an unsupported HTML artifact is rejected rather than silently saved in a dangerous form.

Uploaded documents remain `PRIVATE_DRAFT`; source_manifest is intentionally empty because the upload path cannot independently verify the document's 97 linked sources. The original source hyperlinks remain inside the document. Imported owner HTML is private, hashed, append-only, never promoted to public news and does not change research ingestion, generator QA, PDF or schedules.

**Boundary:** No direct background upload of the ChatGPT-attached bytes occurs. A real saved record requires the authorised owner to select and import the file within My Desk. Do not claim the standalone file is archived until the database row and storage object are observed together.
