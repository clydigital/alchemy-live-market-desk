# Branch 02 — Notion-backed source attestation for the existing Bluebelly review intake

**27 October 2026 · Draft-only additive integration.** This is not another research task, scheduler, Story/Regime engine, table, publication service or authenticated-owner access change.

## Implemented

- The existing private, bearer-gated `POST /api/internal/bluebelly-editorial` accepts an **optional** `proofMode: "NOTION_SOURCE_ATTESTED"` on the existing `bluebelly/macropulse-brief/1` draft envelope.
- The endpoint can independently read an original MacroPulse Notion page with a **separately authorised, server-side read-only** credential `BLUEBELLY_NOTION_RESEARCH_TOKEN`; it cannot use the ChatGPT Composio OAuth connection.
- Verification checks exact source page ID and one approved MacroPulse ancestor, the expected dated daily archive title, whether the page is live/nonarchived and recent, native `created_time` and `last_edited_time`, an exact Pulse ID in the complete bounded block fetch, and all supplied source links present in the original page content or rich-text hyperlinks.
- A success overwrites sender-supplied scheduled publication/retrieval clocks with **Notion page creation** and server source-retrieval clocks before it uses the existing `parseMacroPulseDigest` and review-table write. `created_time` is a page-creation **proxy**, not an independently observed public publication event.
- Existing `review`/`RESEARCH_DERIVED_UNADJUDICATED` storage, original idempotent content hash, source URL limits, bearer token, nonpublic host, body limit and 200 duplicate / 202 creation responses are preserved.
- No original linked release is fetched or fact-checked by this attestation. **The claim remains unverified research.** It cannot be admitted into canonical Evidence or become a PDF simply by passing source metadata checks.

## Inputs and credentials

- `BLUEBELLY_MACROPULSE_INGEST_TOKEN`: existing dedicated 32+-character private ingress bearer, currently unconfigured in production at the time of the prior audit.
- `BLUEBELLY_NOTION_RESEARCH_TOKEN`: **additional** separately authorised read-only Notion integration identity. Grant access only to the approved MacroPulse root, its dated archives and child Pulse pages. Scope independently from ChatGPT-connected credentials. Do not put tokens into source files, docs, GitHub issues, Notion blocks or model prompts.
- Optional `BLUEBELLY_REQUIRE_NOTION_ATTESTATION=true`: only switch on after a tested valid producer uses the new mode. When true, the receiver rejects the older unauthenticated-to-Notion editorial draft mode with 422, while still requiring the existing ingress bearer. No environment value is changed in this PR.

The client sends the existing strict editorial JSON with one additional field:

```json
{
  "contractVersion": "bluebelly/macropulse-brief/1",
  "proofMode": "NOTION_SOURCE_ATTESTED",
  "sourcePageId": "<original Notion Pulse UUID>",
  "sourcePulseId": "<exact 2026-MM-DD-HHMM-slug in original Pulse>",
  "sourcePageUrl": "<matching exact Notion page URL>",
  "sourcePublishedAt": "<declared original clock, schema-valid but replaced after successful proof>",
  "sourceRetrievedAt": "<declared retrieval clock, schema-valid but replaced after successful proof>",
  "headline": "<editorial headline>",
  "standfirst": "<bounded summary>",
  "whatChanged": "<bounded attributed research claim>",
  "whyItMatters": "<possible mechanism, not independently confirmed>",
  "countercase": "<material counterargument>",
  "watchNext": "<next dated source to check>",
  "primaryRegion": "US",
  "editorialModel": "chatgpt-manual-review-v1",
  "sourceLinks": [
    {
      "url": "<exact original URL contained in the Pulse>",
      "label": "<short original-source attribution>",
      "kind": "PRIMARY_RELEASE"
    }
  ]
}
```

The placeholders are explanatory only, not a valid request. The complete JSON must satisfy the existing v1 parser's field, length, clock and source-link checks.

## Preview rollout / acceptance — Branch 01 secrets, Branch 02 adapter

1. CI: run `tests/blue-desk-macropulse-notion-attestation.test.ts`, full validation and database-contract suite. Preserve the optional old draft mode until explicit migration acceptance.
2. Branch 01 provisions server-scoped Notion **read-only** permission and existing ingest bearer in an **approved private preview**, never the public Bluebelly reader host. No secrets committed.
3. Auth negatives: wrong public host 404, unconfigured ingest 503, invalid bearer 401, wrong content type 415, oversized input 413; the route must never fetch Notion before private-host/bearer checks.
4. Source negatives: wrong ancestor/archive, unlinked source, wrong Pulse ID, stale/future page, incomplete/not-readable block listing; no database row on 422/503.
5. A current real original Pulse with a properly transformed bounded draft yields **202** and a row with `source_published_at=page.created_time` proxy and server `source_retrieved_at`; independent DB readback verifies the link list, review-only state and provenance. Replay the same input: **200 duplicate**, not two rows. Two distinct attributed story angles from the same Pulse may validly produce different hashes and separate review rows.
6. Branch 01 separately tests approved owner 200 and anonymous/unauthorised denies on exactly the private research review pages/APIs after its host-router reconciliation. Never make the ingress path public.
7. Only after (1–6) can a separately authorised existing workflow/Composio webhook trigger be connected. The source-trigger step and its unattended producer run receipt are **NOT implemented by this PR**; do not claim full hands-off ingestion from code tests.

## Existing wiring and exclusions

- Source data still originates in Notion MacroPulse/Research Gate. The private `getOwnerDeliveredResearchBriefs` and `buildDailyResearchPacket` stay read-only and unadjudicated.
- The existing scheduled Writing Brain is unchanged; its independent 09:00 MYT natural DB write needs a distinct receipt.
- Branch 01 is the sole writer of `lib/blue-desk-host.ts` while it sequences private owner access and public-news PR #1067. This PR does **not** modify that file.
- No new cron, source license grant, database migration, RLS changes, public News classification, canonical Dossier transition, report publisher, private PDF generation claim or auto-publication.
