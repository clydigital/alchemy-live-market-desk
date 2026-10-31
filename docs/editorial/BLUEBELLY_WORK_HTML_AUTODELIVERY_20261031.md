# Bluebelly — automatic Work HTML delivery into private My Desk

**31 October 2026**. A finished HTML report created in ChatGPT Work should go straight into the private My Desk history. It must not require the owner to download and re-upload.

## Writer / Work delivery contract

On finishing a **complete, source-labelled, static Bluebelly HTML report**, use the already-connected **Supabase** plugin (project `qdtlrfgxpsnxajiptrno`) to submit the article to the `public.blue_desk_work_html_editions` private inbox through `execute_sql`. This is a **service-only tool action**, not an anonymous/public endpoint and not an automatic content-publishing command.

Construct a safe SQL `INSERT ... SELECT` using the original HTML as a dollar-quoted UTF-8 literal with a unique delimiter absent from the report. The query must:

1. Select the intended owner from **the single active owner**: `auth.users` joined on active `public.app_access_allowlist`; proceed ONLY if count is exactly 1. Do not print the owner's email, ID or credentials.
2. Supply the **original market-session date** (not merely today's run date), a human-readable report headline, and the **static HTML** after removing JavaScript widgets. Preserve the entire article, SVG charts and original source links. Reject any active-content tags/attributes; never silently truncate.
3. Compute `html_sha256 = encode(digest(convert_to(html_content,'UTF8'),'sha256'),'hex')`. Compute a stable `content_sha256` from `'BLUEBELLY_WORK_HTML_V1|'` + session day + static HTML, and ensure the owner/content unique constraint; retrying the same edition must not duplicate it.
4. Use `source_manifest = '[]'::jsonb` unless original receipts were independently verified by an approved workflow; the original hyperlinks in the HTML are **not** themselves verification. Set `delivery_type='CHATGPT_WORK'`, `review_status='PRIVATE_DRAFT'`. Never claim public publication.
5. Use `ON CONFLICT (owner_user_id,content_sha256) DO NOTHING`, then **read back the matching row ID/hash** and confirm it is visible in the owner archive index (or record that the owner-authenticated UI check is pending). Report a failure if insert/readback fails; do not claim archive success.

No new schedule, cron, PDF dependency, unauthenticated upload endpoint or public release is introduced. Existing Work tasks can adopt this at their next execution when writing a full report.

## Private reader behaviour

Bluebelly's existing `/api/owner/html-editions` GET, behind the same allowed private host + authenticated Supabase user + active allowlist, lists owner-created storage editions and Work-delivered inline editions together. Work HTML is validated against the static import rules and its SHA-256 before returning an inert sandboxed HTML response. It can be downloaded intact. There are no browser-accessible grants on the new table. An immutability trigger denies updates and deletes. The user may not directly select a Work-origin edition as a correction target in the manual owner editor.

Work-delivered reports are explicitly marked **Automatically delivered from Work** and **PRIVATE_DRAFT** in My Desk. Source links within the article are kept but are *not* promoted to verified evidence.

## Immediate backfill

The manually created 30 October `Editorial Reader v4 Corrected` may be delivered once through this contract from the supplied conversation HTML, retaining the market session date `2026-10-30`. The user should not need to import it again through a file picker. Verify both its database row and owner-filtered readback; preserve original markup and SVGs, stripping only active external script content. No material inside this private report is displayed publicly.
