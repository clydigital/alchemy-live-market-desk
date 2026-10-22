# Blue Desk P−1d — Access parity and cutover evidence (22 October 2026)

**Gate: STOP / NO GO.** This is a test-only, documentation-only dependent PR stacked on Live P−1c draft PR #961. The new endpoint is neither merged nor deployed. Companion Hybrid P−1c is draft PR #123. Related independent Live draft PRs: P−1a #958 and P−1b #959.

## Actual anonymous runtime observations

| URL/surface | Observed | What this proves |
|---|---|---|
| `bluebelly-desk.vercel.app/` | Public homepage rendered | The approved homepage is available |
| `bluebelly-desk.vercel.app/api/dossier-v2` | HTTP 404 | The dedicated public host blocks this route |
| `bluebelly-desk.vercel.app/api/internal/dossier-v2` | HTTP 404 | The dedicated public host blocks this route |
| Operational alias `/owner/live` | login_required | Anonymous owner-page access is denied |
| Operational alias `/api/presenter/technical-checks` | HTTP 401 | Anonymous Presenter checks are denied |
| Operational alias `/api/internal/dossier-v2` | HTTP 404 | P−1c private route has **not** been deployed; NOT proof of its future bearer guard |
| Operational alias `/api/dossier-v2/history` | Public JSON index retrieved | Legacy operational-alias API exposure persists |

These are read-only, anonymous negative/availability checks. No Google OAuth session, authenticated owner, machine bearer, scheduler trigger, authenticated private Dossier or exact runtime Hybrid handshake was performed.

## Deploy-time configuration evidence (names only; no secret values viewed)

- Live Vercel: 38 env entries; `LIVE_HYBRID_DOSSIER_READ_TOKEN` absent; `DASHBOARD_AUTH_REQUIRED` absent; `CRON_SECRET` exists for independent cron machinery.
- Hybrid Vercel: 8 env entries; `LIVE_HYBRID_DOSSIER_READ_TOKEN` absent; `LIVE_DESK_DOSSIER_TRANSPORT` absent.
- Current Live and Hybrid production are still on earlier READY builds, not these draft PR heads.

## Source-grounded access rules

- Dedicated Bluebelly host blocks all internal APIs before the machine bypass in `middleware.ts`.
- Canonical Live and operational alias classify private API routes as `private`, **not** as authenticated. On non-public hosts, ordinary APIs still pass through middleware when `DASHBOARD_AUTH_REQUIRED !== "true"`; route-specific auth must be checked.
- The P−1c new internal route is in `MACHINE_AUTH_PATHS` and performs its **own** dedicated bearer check before invoking the existing Dossier reader. This is a *source/CI* assertion until deployed.
- Owner pages require Google claims and an active `app_access_allowlist`; Presenter technical checks additionally use `auth.getUser()` and the allowlist. Positive real owner/denied-account tests remain outstanding.

## Legacy/API dependency inventory — do not overrestrict

| Existing reader | Path/contract | Migration requirement |
|---|---|---|
| Hybrid current Dossier & Journey | `GET /api/dossier-v2` via `lib/live-desk-feed.js` | Switch only after P−1c bearer parity; validate fallback/degraded/unavailable/current |
| Hybrid published canonical Story/feed | `GET /api/intelligence-feed` via same Hybrid module | Unchanged by P−1c; audit separately before restricting |
| Live mobile briefing | `GET /api/market-intelligence-snapshot` in `app/mobile-brief/page.tsx` | Independent read contract; public-facing field/security review required |
| Live Dossier history | `GET /api/dossier-v2/history` | Still accessible on operational alias; P−1a cache fix does not remove authorization gap |
| Live owner technical checklist | `GET/PUT /api/presenter/technical-checks` | Owner-only, per-user record; do not convert to machine/public surface |
| Existing scheduler and Research Gap APIs | `/api/cron/*`, other `MACHINE_AUTH_PATHS` | Preserve each independent credential; **do not execute cron for a smoke test** |

Additional research callers may exist beyond the inspected Live/Hybrid repositories. A release sign-off must cover deployed client traffic and any undocumented consumers, not only code search.

## Gated cutover sequence (none executed)

1. Review dependency stack and merge order, green tests, production-risk assessment and rollback. Rebase test-only P−1d after P−1c when appropriate.
2. Provision a **dedicated**, randomly generated `LIVE_HYBRID_DOSSIER_READ_TOKEN` server-side only. Never reuse cron/research/OAuth/Supabase credentials, nor emit the value to logs or user-facing bundle.
3. Live deploy first in authorised maintenance window, **without** blocking legacy readers. Verify canonical host and operational alias: missing/invalid bearer => 401 (or unprovisioned => 503); approved private bearer => exact current Dossier response; Bluebelly => 404; no wildcard CORS; `private, no-store`.
4. Deploy Hybrid code with `LIVE_DESK_DOSSIER_TRANSPORT=legacy`, validate Journey/Dossier; then opt in `authenticated` for a bounded reviewer session. Validate current/degraded/fallback/unavailable and historical exact edition reads; confirm error fails CLOSED and does not retry anonymous.
5. Prove owner approved/denied Google login, Presenter isolation by user, and scheduler machine-auth positive/negative behaviour **only via authorised safe test fixtures**, not stateful cron triggers. Independently classify Dossier history, Market Intelligence and canonical intelligence-feed consumers.
6. Audit deployment aliases and Supabase RLS/default grants; **never** globally enable dashboard auth, revoke raw grants or restrict `/api/dossier-v2` before verified replacement readers.
7. Close #834/#849 only against their full criteria; perform approved staged cutover and rollback proof. Until then: **P−1 STOP / NO GO**.

## Unverified gates

Actual bearer handshake, permission and licence review for public source data, API response-field approval, actual OAuth positive/denied owner, machine positive, deployed source clock/edition parity, long-tail third-party/old clients, platform grant defaults, rollback drill and authenticated preview remain unverified. Unit tests and CI cannot replace these proofs.
