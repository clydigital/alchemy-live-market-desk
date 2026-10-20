# P−1 API field review — compatibility inventory

**Date:** 20 October 2026. **Status:** HOLD / inventory only. **Authority:** code-level `MarketIntelligenceSnapshotV1`, `DossierPresentationSelection`, and `DossierPresentationV1` type declarations, plus their current GET handlers and Hybrid reader imports. No field is approved for a new public V6 API by this inventory.

## The actual exposure and consumer contracts

- `GET /api/market-intelligence-snapshot` returns `market-intelligence-snapshot/v1` from the legacy Live backend. An anonymous test returned a large presentation JSON. Live's `app/mobile-brief/page.tsx` fetches this route; the source builder includes Dossier/regime context, stories, research gaps and guardrails. Do not silently remove keys or change the contract version.
- `GET /api/dossier-v2` returns a selection wrapper containing the full `dossier-presentation/1`; Hybrid's `lib/live-desk-feed.js` fetches this exact endpoint and `lib/dossier-v2-handoff.js` uses `header`, `whatMattersNow.stories`, `rateRegime`, `watchNext`, `health`, `policyOutlook` and other nested fields to build Journey. Do not require owner browser login for this route without a working Hybrid server-to-server replacement.
- `GET /api/dossier-v2/history` exports a bounded history index. Its `DossierHistoryIndex` schema includes ID, predecessor ID, timestamp, headline, epistemic label, health and investigation counts. Verify each nested field against public editorial/privacy rules before adding to V6.
- Bluebelly's public hostname blocks all `/api/*` routes and owner/cron paths via `blueDeskHostAccess`. The original Live hostname preserves compatibility with legacy consumers. **A permissive CORS header is not an authorisation mechanism.**
- Raw `hybrid_publication_snapshots`, `story_events`, `story_thesis_versions` and Motion records have separate server-only/RLS protections. A presentation DTO can still contain research detail even if raw-table grants are sound.

## Enforced inventory, not an enforcement of publication permissions

`lib/blue-desk-public-api-field-review.ts` contains exhaustive, type-checked top-level fields for all three contracts. An added/renamed field forces an explicit classification update at build time via `satisfies Record<keyof ..., ...>`.

- `PUBLIC_CANDIDATE`: contracts, publication timestamps or attribution metadata that may be safe following final licensing and provenance review. *Does not authorise release*.
- `REVIEW_REQUIRED`: nested financial/regime/Story fields, measurements, historical IDs and source-linked text. Requires original-source attribution, external redistribution permission, per-claim as-of and a public projection contract.
- `OWNER_ONLY_TARGET`: desired target state for operational research diagnostics and private deliberation fields, including memory, internal evidence governance, calibration/decision audit, creator-verification inputs, research gaps and guardrails. **Current endpoint output is not changed**: migrating Hybrid/mobile consumers precedes removing these fields.

The helper `isPublicFieldApproved()` is hard-coded false. It is intentionally not wired to production responses or a new endpoint. A compile-time catalogue cannot substitute for a full nested-field audit or data access enforcement.

## Proposed migration sequence (not performed)

1. Snapshot and fixture-compare the actual legacy JSON contracts and callers at an exact deployment ID. Establish whether `dossier-v2` needs an additional server-to-server token or can consume a smaller approved public DTO. Preserve current Hybrid Journey parity.
2. For the new V6 public reader, introduce a **new versioned, field-allowlisted projection**, not `{...legacyDto}` or raw archive passthrough. Only admit claim-level facts from frozen editions, direct licensed source URLs and clearly labelled uncertainty. Do not admit `OWNER_ONLY_TARGET` fields.
3. Switch V6/GPT public readers to this bounded projection, with negative tests for unapproved fields and exact past editions. Migrate Hybrid/mobile individually and prove same IDs, dates, decisions and no owner-only data.
4. After consumer migration and 30 days of telemetry/equivalent proof, narrow old GET routes as appropriate. Re-run anonymous, approved/denied owner, expired-session and real machine-token tests. Do not set `DASHBOARD_AUTH_REQUIRED` globally as a shortcut.
5. Obtain explicit public-content/licensing sign-off and address `supabase_admin` future grant defaults under [#849](https://github.com/clydigital/alchemy-live-market-desk/issues/849); the public/private release gate remains [#834](https://github.com/clydigital/alchemy-live-market-desk/issues/834).

**Verdict: P−1 HOLD.** This inventory provides drift detection and migration decisions; it is not evidence of an exploitable personal-data leak and is not a security cutover.
