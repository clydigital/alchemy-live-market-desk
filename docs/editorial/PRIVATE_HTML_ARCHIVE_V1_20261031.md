# Bluebelly — Private HTML edition archive v1

**Owner-authorised:** 31 Oct 2026. **Scope:** private HTML storage and historical readback, parallel to the independent generator QA workstream. **Not** an automatic publisher or a new scheduled report engine.

## Workflow

1. Open **Bluebelly → My Desk → Daily Report Studio** and create/edit a full narrative.
2. Choose original source receipts and optional original X posts. Preview the approved large-type **Editorial Reader v4**.
3. Under **My HTML report editions**, click **Archive current HTML report**. The server rebuilds the reader from the submitted report text and current independently matched source receipts; it **does not trust client-supplied HTML**.
4. Save receipt: immutable `PRIVATE_DRAFT` with a SHA-256 of the report+source manifest and an independent byte SHA-256 of its stored HTML, plus UTC creation time and the Malaysia report day.
5. Read prior editions by opening the owner-only archive URL. The browser inline read has an inert sandbox CSP: archived scripts/X widgets will not execute. Download the exact file to read offline.
6. To issue a correction, select an earlier edition as **Correction of**, edit the report, preview it, then save a **new** edition. The original is never overwritten. The correction stores `supersedes_id`.

## Source/evidence boundaries

Only original URLs that exactly match independently source-verified News receipts appear in the verified source ledger. Selected X posts must exactly match stored original-X-wire URLs, creators, dates and attribution states. Social posts remain attributed, not proof of issuer numbers or market causality. Unmatched links must not be promoted into source citations.

The archive records the *actual evidence receipt at save time*. It is not guaranteed to reproduce an earlier preview timestamp or later external source changes: the saved file itself is frozen. Source-poor reports remain clearly labelled `PRIVATE_DRAFT`; there is no auto-review or publication.

## Storage and access design

- Table: `public.blue_desk_private_html_editions`. Service role only; RLS enabled; no grants or policies for `anon` or `authenticated`. A database trigger rejects every UPDATE and DELETE.
- Bucket: `editorial-html`, non-public with no direct browser policies. Exact path `private-html/{owner_user_id}/{report_day}/{uuid}.html`, upload `upsert=false`.
- Route: `/api/owner/html-editions` checks the allowed private host and independently validates Supabase `auth.getUser()` plus the active `app_access_allowlist` for every GET and POST. POST additionally requires a matching browser Origin. Service role is only used *after* this check.
- Reads are scoped by `owner_user_id`, then by matching exact database path; stored bytes must reproduce the recorded SHA-256. All responses are `private,no-store`; HTML replay uses a restrictive scriptless sandbox CSP and exact optional download.
- Idempotence: content + source receipt checksum is unique per owner. Retries of an identical draft return the same archived edition, not a duplicate file.
- On a failed DB commit, upload is removed. Old editions are never modified.

## No overlap with generator QA chat

Archive branch owns `app/api/owner/html-editions/route.ts`, `lib/bluebelly-private-html-archive*.ts`, `components/blue-desk/OwnerHtmlEditionArchive.tsx`, its CSS, dedicated DB migration and tests. The only shared file edits are an additive owner API host allowlist and a single component placement in the existing writer. If another PR changes the writer, reconcile those two lines rather than reapplying whole-file snapshots.

## Release QA

Check the full suite, typecheck, Next production build, local DB contracts, migration and Supabase security advisors. Verify live bucket private status and table RLS/grants, then production owner route denial without login, actual owner save/list/download and byte hash. No production-success claim until an authenticated save/read has been observed. No new task, PDF pipeline, Google Drive dependency or public story writer.
