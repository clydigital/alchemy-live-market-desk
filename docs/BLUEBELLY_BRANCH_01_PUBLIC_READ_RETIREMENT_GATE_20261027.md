# Bluebelly Branch 01 — Public read and legacy retirement gate

**Checked:** 27 October 2026 (MYT) · **Owner:** Branch 01 · **Status:** P−1 PARTIAL / NO-GO for interface retirement.
**Scope:** Read-only source inspection, anonymous runtime smoke tests, production grants and recent coarse caller logs. This document is an audit/acceptance specification, NOT a live fix, permission change, publication approval or authorisation to delete legacy infrastructure.

## Decision

Use **one existing Bluebelly public hostname + authenticated owner enclave**. PR #1053 already merged exact native owner routes. Keep the research backend, existing credentialed machine routes, immutable editions, source data, API callers and scheduled tasks operating. The old Live/Hybrid *human-facing interfaces* are transitional only.

### What was actually proven

| Surface | Anonymous observation | Classification |
|---|---|---|
| `bluebelly-desk.vercel.app/` | Public page | Intended public reader |
| Bluebelly `/owner/presenter`, `/my-reports` | Login required | Owner-only; successful owner/forbidden-account tests outstanding |
| Bluebelly `/api/internal/dossier-v2`, `/api/hybrid-feed-v2` | 404 | Public-host deny boundary |
| Legacy `/api/presenter/technical-checks` | 401 | Owner-only gate |
| Legacy `/api/dossier-v2` | Anonymous structured response, ~96 KB | **Unreviewed Dossier projection**; not automatically public-approved |
| Legacy `/api/hybrid-feed-v2` | Anonymous full response, ~2.3 MB | **Mixed publication + operational research**; requires redaction/reader migration |

**Source:** `middleware.ts`, `lib/blue-desk-host.ts`, `lib/intelligence/publication-feed-route.ts`, `lib/intelligence/desk-read-publication-route.ts`, `app/api/dossier-v2/route.ts`, `app/api/hybrid-feed-v2/route.ts`. The full public Hybrid response includes `research.latestRun`, `research.videos`, `research.divergences`, `research.debt.items`, `research.intelligence.latestStages`, `research.intelligence.acquisitionFailures`, `publication.latestSnapshots`, `publication.editionDiagnostics`, and canonical story projections. These are **field locations, not claims that a secret or personal record was exposed**. Before enabling public distribution, classify every nested field, licences and source quotes. Do not publish the raw payload as proof.

### Live Supabase read permissions

27 October read-only catalog: 109 public-schema relations; 35 have anon SELECT; four anon-readable current-* views are `security_invoker=true` (verified). The raw `hybrid_publication_snapshots`, `market_motion_items` and `story_thesis_versions` have no anon SELECT. `blue_desk_automated_reports`, `blue_desk_editorial_slates`, `app_access_allowlist` have no anon SELECT.

**Outstanding:** `evidence`, `research_source_registry` and `research_schedule_slots` retain anon SELECT plus broad public read policies. This is tracked by [#847](https://github.com/clydigital/alchemy-live-market-desk/issues/847) and [#834](https://github.com/clydigital/alchemy-live-market-desk/issues/834). No blanket RLS revoke before consumer replacement.

### Caller proof limitation

Short Vercel Hobby retention rejected a 6-hour log query. A 20-minute production window was readable and showed `publication_feed_caller` / `legacy_api_read_caller` entries, including requests initiated by this audit. The user-agent based `browser` classification and absent referrer do not identify a legitimate consumer, and audit-generated requests must not be interpreted as organic usage. **Neither a few requests nor short-window silence proves 30-day compatibility.**

### Historical exact-read trap

`/api/dossier-v2?id=nonexistent-valid-uuid` returned 404. In contrast, the *legacy Hybrid API* explicitly selects current state under `invalid_fallback_current` when `?edition=` is unknown: `lib/edition-replay.ts` and `lib/hybrid-publication.ts` document this compatibility behaviour. The `/hybrid-output` page has `assessHybridEditionRequest` to avoid substituting it into historical analysis. **Never treat the raw legacy feed as exact replay merely because HTTP 200 and a current edition are returned.** The site/plugin consumer must verify: `edition.selected.status === "historical"`, `edition.selected.snapshotId === requestedEditionId`, immutable replay mode, exact Dossier/source as-of, and source-ID match; otherwise render unavailable. A separate live current request may use current status legitimately.

**Do not silently change the shared legacy selector** while consumers remain. Any future API hardening must first reconcile tests and machine callers. For new Bluebelly versioned endpoints prefer 404/typed unavailable for unknown exact IDs rather than legacy fallback.

### Safe existing transport

`/api/internal/canonical-feed` already requires a distinct dedicated bearer and returns `private, no-store` without permissive CORS; the Bluebelly presentation host blocks it. Intended for server-to-server consumers, **not browser tokens or public API distribution**. Inspect `docs/BLUE_DESK_P_MINUS_1E_CANONICAL_FEED_TRANSPORT_20261022.md` before enabling migration; positive correct-bearer owner/production acceptance was not exercised here.

## Next gated implementation (single owner, no parallel patching)

1. **Classify output at exact nested paths.** Create a table of public-approved publication fields versus owner-only operational fields and rights/licence limitations; inspect actual data only in authorised scope and do not record sensitive contents in PR comments.
2. **Find legacy readers.** Inspect separate Hybrid `lib/data.js`, Live `lib/data.ts`, Vercel deployment host traffic, browser fetch usage and server machine use. Verify live + archived editions and >24-old exact edition before migrating. Existing issue #847 identifies direct public-key `evidence` consumers.
3. **Choose one contract owner.** Reuse an already-existing safe public DTO if proven. Otherwise add one narrow allowlisted public publication projection using existing publication sources; no new Story writer, System 2 path, table, scheduler or cron.
4. **Shift consumers before restriction.** Preserve exact IDs/time/source ledger and compatibility of old API paths until machine/website/client reads are proven using the new DTO or private bearer. Test missing/malformed/superseded IDs and show unavailable, never silently latest.
5. **Then address RLS and legacy interfaces.** After actual caller parity and source review, revoke remaining excessive raw anon policies through a separately reviewed migration; test anon/allowed owner/forbidden user/machine and rollback. Preserve archives and backend.
6. **Production proof:** validate CI, server build, browser parity/anonymous negatives, approved owner and revoked-account positives/negatives, cron/machine token, live exact historical replay, deployment READY SHA and response contract equality.

## Task ownership

- **Branch 01:** route/auth boundary, public DTO exposure classification, historical redirects, security test matrix, release gate.
- **Branch 02:** plugin/inbound intake/read contracts, proof receipts. No service-role key in chat client.
- **Branch 03:** editorial rules, report/PDF generator, source qualification. Not security middleware.
- **Branch 04:** public UX; consumes only approved DTO.
- **Branch 05:** private Presenter/Writing Studio; uses owner-scoped APIs.

## Explicit stop/go

- **NOW:** P−1 remains **NO-GO for retiring legacy UI or revoking old consumers**. Bluebelly *public host anonymous isolation* passed the sampled negative smoke checks.
- **STOP** on publicly exposed raw private notes, credentials, unlicensed full source, unexpectedly open owner routes, exact historical URL substituting new data, or broken machine authentication.
- **No assumptions:** no confirmed secret/PII leak and no owner/machine positive auth acceptance established here. Client-ready copy is not a public-release permission grant.

**Refs:** [merged owner enclave #1053](https://github.com/clydigital/alchemy-live-market-desk/pull/1053), [security inventory #834](https://github.com/clydigital/alchemy-live-market-desk/issues/834), [remaining raw evidence #847](https://github.com/clydigital/alchemy-live-market-desk/issues/847), [RLS default-grants #849](https://github.com/clydigital/alchemy-live-market-desk/issues/849), `docs/BLUEBELLY_HYBRID_FULL_RETIREMENT_DECISION_20261027.md`.
