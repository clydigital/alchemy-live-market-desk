# Bluebelly #1011 — independent hostname and preview acceptance contract
Status: **test-only review branch, not production authorisation**, 25 October 2026 (MYT).

## Checked immutable references

- Integration: [PR #1011](https://github.com/clydigital/alchemy-live-market-desk/pull/1011), main-based head `57885fc3d2eecff9d5a0bb940b62f570df501a96`, complete GitHub CI green.
- Protected child-branch review deployment: `dpl_9e844VLZG1DWT6oBxw7gV2QKT9TR` `https://alchemy-live-market-desk-q7jxltce0-rogue-magazine.vercel.app` — READY at preview-child SHA `5d2d7c84` (same product code with branch-specific preview-only deployment config/tests; no production alias).
- Production: `bluebelly-desk.vercel.app` points to `dpl_4DKkiKk1ktDp1Shv4WTbLswWksPG`, SHA `6b1ad47d` on `main` (before #1011). Production is not yet an acceptance environment for #1011.
- In an unauthenticated Opera read, `https://alchemy-live-market-desk-q7jxltce0-rogue-magazine.vercel.app/key-stories` redirected to `/login?next=%2Fkey-stories`. This proves only the observed lack of a session on that protected preview; **not** that the target page works after login.

## Host-dependent route matrix

| User-visible path | Production Bluebelly hostname | Canonical Live hostname | Temporary Vercel preview hostname |
|---|---|---|---|
| `/` | Public, rewrite `/blue-desk` | Public, rewrite `/blue-desk` | Private request, no rewrite |
| `/markets` | Public, rewrite `/blue-desk/markets` | Same | Private request, no rewrite |
| `/calendar` | Public, rewrite `/blue-desk/calendar` | Same | Private request, no rewrite |
| `/key-stories` | Public, rewrite `/blue-desk/key-stories` | Same | Private request, no rewrite |
| `/rates` | Public, rewrite `/blue-desk/rates` | Same | Private request, no rewrite |
| `/what-changed` | Public, rewrite `/blue-desk/what-changed` | Same | Private request, no rewrite |
| `/presenter` | Private, rewrite `/blue-desk/presenter` | Private, same rewrite | Private request, no rewrite |
| `/presenter/full-prep` | Private, rewrite `/blue-desk/presenter/full-prep` | Private, no rewrite | Private request, no rewrite |
| `/api/owner/editorial-generate` | Private owner API | Private owner API | Private unless handler further denies |
| `/api/owner/bluebelly/v1/overview` | Blocked | Private owner API on owning hosts when future plugin stack ships | Private route if deployed; not a public reader |

The actual private page modules on the branch-preview hostname are `/blue-desk/presenter` and `/blue-desk/presenter/full-prep`; the actual public-content page modules are `/blue-desk/key-stories`, `/blue-desk/rates`, `/blue-desk/what-changed` and `/blue-desk/calendar`. **Do not infer that these internal paths reproduce the actual public navigation or anonymous middleware behaviour.** The shared header chooses `PRIVATE_NAV` on temporary preview hosts, so visual screenshots from that host cannot by themselves certify public navigation parity.

## Two distinct access layers

1. Vercel Deployment Protection can require authentication before Next.js receives a request on a preview.
2. Supabase SSR + middleware's active `app_access_allowlist` then guards owner pages/API. A user authenticated to one layer, or in a different browser profile, is not automatically authenticated to the other.

Do not disable preview SSO, change `PUBLIC_AUTH_PATHS`, append preview hostnames to Bluebelly production reader-host allowlist or expose raw Supabase/GraphQL to bypass visual-test friction.

## Release-gating evidence required (not yet met)

1. Dedicated exact-host or appropriately controlled branch-specific visual test with `/ → /key-stories → /rates → /what-changed → /calendar → /markets` at 360, 768, 1440 px. Check visible content and links; CI-only route mappings do not count as visual proof.
2. Approved-owner browser session via the exact Bluebelly host (or matched private test host with explicitly reviewed auth parity): `/presenter`, Writer generate/revise, `/api/presenter/technical-checks` GET/PUT and persistence on reload.
3. Exact older-than-24 `?edition=UUID`, same-slot superseded ID, invalid/missing edition, duplicated Story/Motion/Regime/Event values and mismatched frozen Dossier: no falling back to latest.
4. Unauthenticated and unapproved-user responses for private presenter, writer, checklist and legacy/raw APIs. Do not let a protected Vercel login page stand in for an application-level denial test.
5. Original-source and as-of provenance for current oil/rates/AI and future economic events. #950 and #951 are upstream feed gates, not evidence of a successful content pipeline.
6. #1004 remains the separate external OAuth RLS migration; this QA work does not approve ChatGPT OAuth.

## Scope of this PR

`tests/bluebelly-convergence-host-preview-qa.test.ts` tests the exact host-to-route mapping, static existence of public page modules, private owner isolation and unchanged `vercel.json` deployment gates. No functional application files, deployment config, secrets, scheduled tasks, RLS policies, provider ingestion, editors, or canonical thesis logic changed. **Test pass does not substitute for runtime acceptance.**
