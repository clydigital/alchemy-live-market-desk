# Bluebelly — Branch 04 public UX gap register and handoff
**Audit:** 27 October 2026 (MYT) · **Owner:** 04 — Public UX, Stories & Markets
**Production:** https://bluebelly-desk.vercel.app/ · **observed deployed SHA:** `67a9599c73d9abc6b2214b1fe1c925d53b0babc4`
**Source:** Live rendered public route reads, `app/blue-desk/**`, `lib/blue-desk-host.ts`, V6 references, merged #1054/#1058 and open #1057. Point-in-time findings, not future completion claims.

## Public route / feature inventory

| Route on Bluebelly host | Observed 27 Oct | Source-backed behaviour | Gap / owner |
| --- | --- | --- | --- |
| `/` | 200 | Verified-news first, recent observations, historical Stories, official Treasury yield summary and calendar | Internal system jargon and same-home yield shortcut. Branch 04 bounded fix here |
| `/key-stories` | 200 | 24 recorded ongoing Stories and investor-test / countercase framework; zero fresh verified news themes in sample | Dense long-form experience; Story detail and exact historical timeline remain acceptance work for 04 |
| `/markets` | 200 | 80 instruments, `group=ai/rates/energy/fx/credit/equities`, public nominal Treasury yield history | Needs deliberate cross-asset grouping, source-stale legibility and mobile interaction verification; 04 |
| `/calendar` | 200 | Economic windows, dates, issuer-vs-provider states, `#earnings-hub` and US earnings week | Some date-only notices. No fabricated publication time. Branch 04 can improve navigation; 02 owns factual feed |
| `/daily-report` | 200 | Existing read-only report and dated Story/current-data separation | Story-driven sequence, editorial review and publish receipts unproven; Branch 03 editorial, 04 reader |
| `/newsroom` | 404 | PR #1057 implements unmounted three-lens selector from verified read models | Branch 04 integrates after #1057 reviewed/merged; do not copy or fork component |
| `/creator-intelligence` | 404 | No publicly rendered creator-summary destination verified | Branch 02 transcript material; 03 editorial, 04 public reader and 05 private review |
| `/articles` | 404 | Legacy path not approved on public hostname | Do not expose legacy shell. 01 owns protected redirect / caller-retirement gates |
| `/my-reports` | Login required | Owner-only PDF library | Branch 05; not a public feature defect |
| `/blue-desk` | 200 | Public home alias | Keep compatibility until approved migration; not an additional product |
| `/blue-desk/markets` | 200 | Public Markets alias | Keep compatibility |
| `/stories/article:<editionUuid>:<articleUuid>?edition=<editionUuid>` | Source route implemented; valid live exact-edition pair not independently exercised in this audit | Exact immutable-edition selection and no-latest-fallback present in code | Needs real canonical recent and >24-old browser fixtures and ownership handoff; Branch 04 with 01/02 auth gate |

**Source quality observation:** Public sample returned *zero* fresh, source-verified headlines; the home page led with an explicitly dated historical Story rather than inventing live research. The data readout must remain honest. No source publisher, current quote or fresh market reaction was manufactured during this audit.

## V6 parity and prioritised gap register

| Rank | Gap | Consequence | Next smallest acceptance slice | Owner/dependency |
| --- | --- | --- | --- | --- |
| P0 / release gate | Private/public auth and approved-read boundary | Owner material could leak if cutover made before route audits | Anonymous/owner/machine matrix + RLS and live caller receipts | 01; do not alter middleware in 04 |
| P1 | Newsroom three-lens integration (#1057) | Public Newsroom URL unavailable despite built component | Review #1057 CI + source contracts, mount once in Today/Stories, verify fresh/empty/stale and keyboard | 04 after coordinated #1057 merge |
| P1 | Historical persistent Story depth, exact edition journey | Reader cannot yet trust complete frozen historical replay in UX | One canonical AI Story with exact edition, evidence, countercase, next test and older-than-24 negative fixture | 04; reader contract to 02/01 |
| P1 | Homepage wayfinding + reader wording | Treasury link loops within home rather than opening rates context, hero exposes internal workflow jargon | Change only home links/tag, assert public allowlist and browser proof | 04; this PR |
| P2 | Daily Reports truly story-driven | A broad briefing is not yet a verified chronological source-backed narrative | Render Branch 03 approved edition with source/time and no made-up scenes | 03 writer; 04 reader |
| P2 | Creator Intelligence source-aware reader | Public /creator-intelligence 404 | One consumed creator edition; video citations, transcript completeness and attribution visible | 02 ingestion, 03 standard, 04 reader; 05 private |
| P2 | Cross-asset insight over mere list | Markets displays a source-dated table but little guided rates/oil/FX interpretation | Add one rates/oil "expected vs observed vs unknown" read-only panel using measured observations | 04; 02 measured data |
| P2 | Company/Earnings Hub navigation | Useful weekly calendar feature is less discoverable than it should be | Home deep-link to existing `/calendar#earnings-hub`; later issuer-specific panels | 04 UI; 02 sources |
| P3 | Responsive + keyboard + empty/stale proof | Desktop render alone insufficient | Mobile 390px, keyboard tab order, empty/degraded provider, source timestamp screenshot tests | 04; 01 preview gate |
| P3 | Retire old public Legacy UI | Broken historical links and security/caller regressions if rushed | Reversible alias switch, archive replay, 30-day calls audit or equivalent | 01 coordinated release |

## This isolated slice — branch 04

Branch: `feat/bluebelly-b04-public-wayfinding-20261027`.

- Homepage **Rates & yields** call-to-action now opens the already-approved public Markets `?group=rates` view with Treasury chart and source dates.
- The footer **Observed Treasury yields** shortcut no longer targets an anchor on the current homepage; it opens that same expanded rates view.
- Footer adds direct links to the existing `/calendar#earnings-hub` and `/daily-report`, without creating a new route.
- Remove the operational tag "No Dossier approval required" from the hero; keep meaningful source / historical-status tag.
- Regression tests assert the destination, date-source-sensitive public paths and preserved owner gate.

**Intentionally unchanged:** public route allowlist, auth, private Studio, source admission, latest publisher feeds, thesis history, scheduled tasks, Newsroom #1057 files, database, cron, canonical IDs.

## Proof and pending acceptance

- Baseline URL observations: `/`, `/key-stories`, `/markets`, `/calendar`, `/daily-report` returned meaningful rendered content; `/newsroom`, `/creator-intelligence` and `/articles` returned 404; `/my-reports` required login.
- PR #1057 at `fd68cb9b4c67ad88d0bfbd253b4dbfb66d036454`: GitHub workflow `Validate Live Desk` concluded **success** in the inspected run; *not merged*.
- This branch's CI/preview verdict must be attached to the PR after checks, with the exact new commit SHA. A green component test does not mean production is deployed.
- Preview checks: homepage source labels; rates CTA opens source-dated graph and filter; footer Earnings Hub lands at its heading; mobile touch/keyboard; anonymous `/my-reports` still protected. If preview auth/browser proof fails, hold PR for review.

## Hand-off to 00 — Bluebelly Master Control & Rollout

**Decision:** No public cutover or autonomous merge. Review/merge this bounded PR when CI + preview accepted. Coordinate #1057 integration ownership, Branch 01 security gate and Branch 03 report writer before claiming full Live/Hybrid parity.

**Next owner move:** After this slice, mount reviewed Newsroom lens from #1057 onto an approved Today/Stories route; show zero-coverage states without inventing fresh news. Avoid a second Newsroom product or a canonical intelligence writer.
