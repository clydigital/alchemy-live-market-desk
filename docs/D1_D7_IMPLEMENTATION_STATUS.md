# D1–D7 Architecture Implementation Status

**Audit base:** current `main` at `9176f469cd2ab704559710d6f4c263f4c0509061` or newer.

This is an implementation audit, not a design document. It distinguishes code/test coverage from direct production observation.

## Status legend

- **IMPLEMENTED** — production code exists on `main`.
- **TESTED** — focused unit/integration/contract coverage exists.
- **RUNTIME-WIRED** — the code participates in an active runtime path rather than existing only as a pure helper.
- **PRODUCTION-VERIFIED** — the specific behaviour has been directly observed on a production deployment or production-backed route. Deployment alone is not enough.

## Matrix

| Layer / subsystem | Implemented | Tested | Runtime-wired | Production-verified | Primary evidence |
| --- | --- | --- | --- | --- | --- |
| **D1 — exact persistent Story identity** | ✅ | ✅ | ✅ | ✅ Sep 25 production replay pinned `story-duration-broadening` to exact Story UUID `93c3e32f-9168-49ec-aaa3-9ce678511c9b` | `lib/intelligence/story-identity.ts`, Dossier identity plumbing, Hybrid exact-ID resolution, identity tests |
| **D2 — CONFIRMING / CONTRADICTING / ACCELERATING classification** | ✅ | ✅ | ✅ | ✅ production Dossier `dc8f2531-a889-4704-90a4-f08514162ebe` emitted all three classifications into exact Story evidence obligations | Dossier evidence governance + Hybrid canonical Story classification |
| **D3 — A3 governed Story wake** | ✅ | ✅ | ✅ | ✅ production run `37421328562`: 5 planned, 5 enqueued, 0 skipped; all targeted exact Story `fed-long-end-stress` | Dossier reevaluation propagation, queue ownership/fencing, authority-chain tests |
| **D4 — canonical `story_thesis_versions` mutation path** | ✅ | ✅ | ✅ | ⚠️ exact Dossier-triggered assessment/no-op guard production-proven; fresh material Dossier-triggered version write not forced | production run `37422359132` consumed the exact D3 queues; assessment `e2d95dd3-7822-4c72-88d8-7869fc62fdc3` returned `unchanged`, so v13 correctly remained canonical; historical v13 is an `existing_story_maintenance` thesis revision |
| **D5 — Market-State Decision Packet** | ✅ | ✅ | ✅ | ✅ live `/api/dossier-v2` returned `DOSSIER_READ_MODEL / UNCHANGED` with exact Story impacts and regime comparison | Dossier presentation adapter / canonical snapshot tests |
| **D6 — longitudinal adjudication** | ✅ | ✅ | ✅ | ⚠️ exact-prior + fail-closed path production-proven; no persisted production Dossier yet contains measured reaction assessments | live Dossier `0864d399-06d3-444c-8b37-b61bd6e00d13` resolved exact prior `93f35369-df1c-467b-9f27-fde1a573ad95` and returned `UNRESOLVED` with 0 evaluated / 2 unresolved expectations |
| **D7 — cross-layer divergence comparator** | ✅ | ✅ | ✅ | ✅ comparator/UI observed | PR #505 + #510; production `/hybrid-output` rendered **Cross-layer checks** with HTTP 200 |
| **D7 → Research Gap routing** | ✅ | ✅ | ✅ | ✅ live D7 Dossier→Story divergence completed Research Gap and canonical handoff | case `f3fe4c1d-6269-415f-87b4-01d5f51f6b90`, `source_ref=d7:d7:dossier-story:story:ai-leadership-counterweight`, outcome `CONFIRMING`; PR #511 + #512 |
| **Evidence freshness / source arbitration** | ✅ | ✅ | ✅ | ⚠️ live FRESH / UNKNOWN availability and source-date fences observed; no natural STALE / CONFLICT arbitration case observed in this audit | current `/api/dossier-v2` evidenceStates + chronology fences #557/#558; evidence governance, temporal correctness, source-priority tests |
| **Evidence sufficiency / confidence blockers** | ✅ | ✅ | ✅ | ✅ production read model blocked high confidence on an active contradiction instead of averaging it away | current `/api/dossier-v2`: `story:energy-product-stress` has `ACTIVE_CONTRADICTION` and `highConfidenceBlocked=true`; `lib/dossier-v2/evidence-sufficiency.ts` + focused tests |
| **Hybrid scenario falsification / hysteresis** | ✅ | ✅ | ✅ | ✅ | PR #496; production `/hybrid-output` rendered bounded A/B/C/D/E ladder and guarded D/E tails |
| **Historical Presenter replay** | ✅ | ✅ | ✅ | ✅ exact UUID replay exercised on production; current overlays failed closed | PR #503 + historical replay tests; `93f35369-df1c-467b-9f27-fde1a573ad95` returned `historical_exact`, `dailyAssetState=null`, `stockedUpEvidenceBrief=null` |
| **Sequential Research Gap discriminators** | ✅ | ✅ | ✅ | ✅ live ADVANCE and EXHAUST observed; production reset exposed and repaired | case `7b8a6e71-527a-4138-a874-428bccd85a90` advanced index 0→1; case `ab5f11c0-e351-49f1-95b9-f4304d345a81` exhausted to `CLOSED`; carry-forward repairs #565/#566 |
| **Maintenance Story → Regime reprojection** | ✅ | ✅ | ✅ | ✅ production maintenance run `37422359132` created completed Regime projection `6b3bb1d3-a680-4b4b-a03d-963e6f5e7233` | PR #516; trigger `story_engine`, 5 persisted Regime versions, 0 warnings |
| **Unassigned Story → Regime routing debt** | ✅ | ✅ | ✅ | ✅ production progressed from 3 explicit unrouted Stories to **0 open routing debt** without weak fallback mappings | PR #578 + #583 + #589 + #590; initial projection `692377ff-296d-416b-99cd-5e23af0da6c3`, reuse proof `37514595584`, final manual projection `fb360236-5e3d-4e81-9944-69edfd489536` |
| **Story-domain quarantine** | ✅ | ✅ | ✅ | ✅ provenance/process-only Story preserved in canonical history but removed from the market Regime routing universe | PR #603; manual Regime proof run `37544943061`, projection `fb360236-5e3d-4e81-9944-69edfd489536`, `story-domain/2` debt |
| **Regime System 1 ↔ System 2 timing / coverage health** | ✅ | ✅ | ✅ | ✅ exact current-main deployed READY; production overview and subgroup responses previously observed HTTP 200 with 2 mapped context-only and 0 truly unmapped sensor-only subgroups | PRs #608–#610; `intelligence_story_states.last_evaluated_at` accepted review clock; immutable projection unaffected |

## Current governed chain

The codebase now has one canonical reasoning/mutation chain:

`canonical evidence → Dossier/System 2 → exact persistent Story identity → A3 governed wake → canonical Story assessment → story_thesis_versions → Regime projection → Hybrid projection → D7 divergence read → Research Gap → new canonical evidence`

Important boundaries remain intact:

- Motion is context, not evidence.
- No fuzzy Story identity is allowed.
- Only canonical evidence UUIDs may justify Story mutation.
- Dossier does not write Story thesis versions directly.
- Hybrid does not write Stories.
- D7 is a comparison/routing layer, not another reasoning engine.
- Research Gap acquires evidence; it does not mutate Stories.
- Historical Dossiers and Presenter snapshots remain immutable.

## Key merged proof / implementation PRs

- **#496** — Hybrid scenario falsification, hysteresis and persistent identity resolution.
- **#497** — preserve material Evidence provenance in Story versions.
- **#501** — Regime Divergence Lab routing bound to exact Story provenance.
- **#503** — exact immutable Story + Dossier historical Presenter replay.
- **#504** — sequential bounded Research Gap causal discriminators.
- **#505** — deterministic D7 cross-layer divergence read model.
- **#508** — canonical reasoning authority-chain closure test.
- **#510** — D7 cross-layer checks in Hybrid UI.
- **#511** — material D7 divergences routed into existing Research Gap lifecycle.
- **#512** — end-to-end exact Story → Regime → Hybrid → D7 → Research Gap proof.
- **#516** — maintenance-only accepted Story reassessment now reprojects Regimes before stopping downstream reasoning/publication.
- **#557** — historical Dossier global-rates enrichment is fenced by requested `asOf`.
- **#558** — historical Dossier EIA weekly petroleum enrichment is fenced by requested `asOf`.
- **#559** — dormant Stories cannot be revived by fuzzy Dossier Story matching alone; explicit canonical revival routes remain allowed.
- **#565** — Research Gap discriminator state falls back to immutable occurrence history when requeue has cleared the active worker plan.
- **#566** — discriminator recovery is monotonic within the latest plan signature, preventing a later Dossier sync from regressing an already-advanced discriminator.
- **#578** — unrouted active Stories now become explicit `research_debt` using `regime-routing:<story-id>`; routed restoration resolves the same debt, and zero-link newer projections own routing state.
- **#580** — repaired stale Dossier LY-style build assertions exposed only after #578 merged on top of the parallel #579 reader-language rewrite.
- **#583** — idempotently reused Regime projections now still reconcile routing debt from the identical deterministic input without creating a new projection/version or forcing a route.
- **#589** — expanded deterministic AI routing vocabulary so gated frontier-model releases, compute/API demand and trusted-tester controls route to the existing AI Capital Cycle without Story-specific IDs.
- **#590** — versions deterministic Regime routing semantics in projection identity and keeps reused-run routing debt consistent with persisted links.
- **#592** — resolved Regime routing debt now records lifecycle-consistent metadata (`routingStatus=routed|inactive`, exact resolving projection ID, resolved timestamp) and backfills prior resolved rows.
- **#602** — adds an audited GitHub-OIDC manual `regime_shadow` production trigger so exact Regime projection behaviour can be proven without coupling to the broader research workflow.
- **#608** — shows independent System 1 telemetry, System 2 interpretation and Regime projector clocks without changing stored projection semantics.
- **#609** — uses accepted `intelligence_story_states.last_evaluated_at` (hypothesis-edit timestamp only as fallback) to avoid falsely treating an unchanged-but-reviewed Story as stale.
- **#610** — splits non-durable subgroup coverage into mapped context-only seed/episode Stories versus truly unmapped sensor-only telemetry; neither may be promoted to a durable Story just to clear health counts.
- **#603** — tightens Story-domain classification to `story-domain/2`, preventing generic prose such as `authoritative guidance` from falsely making provenance/process Stories market-admissible.
- **#605** — clarifies the live routing-health copy to apply to **market-admissible** active Stories, keeping routing health semantically consistent with separate domain-quarantine health.

## Production observations from this audit

### D1–D4 Dossier → Story production proof · 6 October 2026

Observed directly on production:

- **Historical chronology fence:** PR **#557** fenced global-rates enrichment by Dossier `asOf`; PR **#558** did the same for EIA weekly petroleum. The repeated Sep 25 dry run then fell from 18 contaminated observations to **14 chronology-safe observations** while retaining the intended rates Story.
- **D1:** the Sep 25 replay pinned analytical Story `story-duration-broadening` to exact persistent Story `93c3e32f-9168-49ec-aaa3-9ce678511c9b` / `fed-long-end-stress`.
- **D2/D3:** production Dossier `dc8f2531-a889-4704-90a4-f08514162ebe` produced **5** governed evidence obligations across ACCELERATING / CONTRADICTING / CONFIRMING classifications. Runtime logged `planned=5, enqueued=5, skippedExisting=0`.
- **D4:** maintenance run `37422359132`, engine run `2dc07169-69af-4abb-ab2b-b51bada93327`, claimed and completed all five exact D3 queues. Assessment `e2d95dd3-7822-4c72-88d8-7869fc62fdc3` returned `unchanged` with `material_change_applied=false`, so the canonical Story correctly remained on thesis **v13** rather than manufacturing v14.
- **Refresh hygiene:** PR **#559** now prevents dormant Stories from being revived by fuzzy `dossier_story_match` alone. Explicit canonical links and exact affected-topic routes may still wake archived Stories. Eight stale fuzzy dormant queues created before the fix were cancelled; exact A3 queues were untouched.
- Historical thesis **v13** is itself a real `existing_story_maintenance` `thesis_revision`, but its older event metadata predates the full current engine/evidence provenance shape. Therefore the audit does **not** claim that a fresh material Dossier-triggered version-write branch was exercised on 6 October.
- **D5 live read model:** current production Dossier `0864d399-06d3-444c-8b37-b61bd6e00d13` returned `decisionPacket.basis=DOSSIER_READ_MODEL`, `state=UNCHANGED`, exact Story-level impacts, and `RATES_LED_TIGHTENING → RATES_LED_TIGHTENING` with `changed=false`.
- **D6 exact-prior adjudication:** the same live response resolved `previousDossierId=93f35369-df1c-467b-9f27-fde1a573ad95` with `basis=EXACT_PRIOR_DOSSIER`. Because no exact reaction checks were available, it correctly returned `UNRESOLVED` with 0 evaluated and 2 unresolved expectations. A database scan found no persisted production Dossier with `system1_reaction_assessments` yet, so the measured CONFIRMED/PARTIALLY_CONFIRMED/CONTRADICTED branch remains naturally unexercised rather than synthetically forced.
- **Maintenance → Regime:** the D4 maintenance engine run `2dc07169-69af-4abb-ab2b-b51bada93327` immediately produced Regime shadow projection run `6b3bb1d3-a680-4b4b-a03d-963e6f5e7233` with `trigger_kind=story_engine`, status `completed`, five persisted Regime version IDs, and no warnings.
- **Exact historical replay:** production `/api/dossier-v2?id=93f35369-df1c-467b-9f27-fde1a573ad95` returned `status=historical_exact`, preserved predecessor `f51be1b9-be52-430d-8ecd-0cbe315526d3`, and explicitly suppressed current-only overlays with `dailyAssetState=null` and `stockedUpEvidenceBrief=null`. Its D5 packet was reconstructed against the historical baseline as `UPDATED`, not substituted from the current edition.
- **Evidence sufficiency:** the current production read model emitted `dossier-evidence-sufficiency/1`. `story:energy-product-stress` retained its active supporting evidence but also the live contradicting WTI reference, yielding blocker `ACTIVE_CONTRADICTION` and `highConfidenceBlocked=true`. This directly proves the confidence-blocker boundary.
- **Freshness/source state:** production source health includes observed `FRESH` and optional-unavailable/`UNKNOWN` states with bounded source timestamps. The historical chronology fixes #557/#558 are directly exercised, but no natural `STALE` or `CONFLICT` source-arbitration case was observed, so this row remains partial.
- **D7 → Research Gap:** production case `f3fe4c1d-6269-415f-87b4-01d5f51f6b90` originated from `source_ref=d7:d7:dossier-story:story:ai-leadership-counterweight`, completed with `CONFIRMING`, and reached `HANDED_OFF`. Canonical `intelligence_evidence` contains the exact `researchGapHandoff.gapId` and mixed official/news evidence, proving the existing D7 → Research Gap → canonical-evidence route end to end.
- **Sequential discriminator ADVANCE:** case `7b8a6e71-527a-4138-a874-428bccd85a90`, plan signature `73d8d58721fba4c946a1`, advanced from discriminator index 0 to index 1 in immutable occurrence history.
- **Sequential discriminator EXHAUST:** one-discriminator case `ab5f11c0-e351-49f1-95b9-f4304d345a81` was canonically handed off and later closed, directly exercising the bounded EXHAUST path.
- **Carry-forward repair:** the ADVANCE proof also exposed a production race: requeue clears `research_plan`, so a later Dossier sync could restart the same plan signature at index 0 before the worker rebuilt its plan. PR #565 added immutable-occurrence fallback; PR #566 made recovery monotonic within the latest plan signature. Production deployment `c756848e4e2b71a4d639b7e70a36b98abc6c33c4` reached **READY**. The already-regressed queued case was then repaired under a guarded predicate to discriminator 1 while still unclaimed; no active worker state was overwritten.

### Unassigned Story → Regime routing-debt production proof · 7 October 2026

Observed directly on production:

- **#578 / schema contract:** the existing `research_debt` table is reused; there is no new routing/reasoning table. `sync_regime_routing_debt_v1` is service-role only. Newer shadow projection ownership includes legitimate zero-link projections, so an older worker cannot resurrect stale Story links.
- **No forced routing:** production Regime projection `692377ff-296d-416b-99cd-5e23af0da6c3`, triggered by Story engine run `e1a21847-42f4-4b7a-80bb-c316a82fd1ff`, completed with warning: `3 active Story routing debt item(s) remain unassigned; no weak Regime mapping was forced.`
- **Exact debt set:** production created exactly three open `regime-routing:*` obligations: two `monitor` Stories at medium severity and one `publish` Story at high severity. All three had no live Regime link; no routed active Story was incorrectly tagged.
- **No duplicate debt:** the partial unique index and runtime reconciliation left exactly one open row per `regime-routing:<story-id>`; the production duplicate-open-key check returned none.
- **Reuse gap found naturally:** Story-maintenance run `37513419180` completed successfully but initially could not backfill routing debt when the Regime projector reused an identical completed run; the `begun.reused` branch returned before the #578 reconciliation. This was a genuine idempotency/governance gap, not a synthetic test case.
- **#583 repair:** reused projections rebuild the same deterministic projection in memory, derive the same Story routes, and run only the routing-debt sidecar reconciliation. They remain `reused: true`, create no new Regime run/version, and remain stale-owner guarded.
- **Reuse production proof:** maintenance Actions run `37514595584` / engine run `04afedf1-64dc-4c14-9099-2ab1e4366b79` completed with the same Regime warning for three unassigned Stories. The newest persisted Regime run at the start of that maintenance invocation was already `bd2db8fc-956f-426a-b584-0c5b85106a79`, created at `18:56:27 UTC`; no newer projection row was created by maintenance. The three routing-debt rows were nevertheless refreshed at `18:57:35 UTC` and now reference that existing projection, directly proving the repaired **reused projection → routing-debt reconciliation** path.
- **AI routing debt resolved naturally:** the high-severity OpenAI Astra / Daybreak Story was not force-mapped. PR #589 expanded the general deterministic AI vocabulary; production then persisted the intended three routes: **AI Control / Governance core (80)**, **Cloud / Inference supporting (70)** and **Models supporting (60)**. Its routing debt is `resolved` with `routingStatus=routed`.
- **Stable-value routing debt resolved naturally:** Story `stable-value-market-contractual-structure-limits-industry-wide-run-risk` later gained a governed route and its medium routing debt was resolved by projection `f50b81fc-6299-4511-8993-70e5a4780107`.
- **Routing semantics are versioned:** PR #590 binds the deterministic routing contract version into Regime projection identity, so a routing-vocabulary change cannot be hidden behind an older idempotent run.
- **Resolved debt metadata repaired:** PR #592 aligned relational lifecycle state with JSON audit metadata. The resolved OpenAI row now records `routingStatus=routed` and `resolvedByProjectionRunId=87b3c521-6114-4020-9c7a-bf0d017ad669`; the forward migration is present in production migration history.
- **Audited manual proof path:** PR #602 added the GitHub-OIDC `regime_shadow` workflow mode. Manual Actions run `37544943061` executed against production main `383edb743fcff52db6ca2a3f7c9c9f363785c425` and completed successfully.
- **Story-domain v2 production proof:** the same manual run created completed projection `fb360236-5e3d-4e81-9944-69edfd489536` with warning: `1 active Story domain quarantine item(s) remain outside the market routing universe; canonical Story history was preserved.` The provenance-only Story `primary-source-timestamps-as-the-decisive-evidence-for-record-reclassifi` had its old routing debt resolved as `domain_quarantined` and now has exactly one open `story-domain:*` governance item with `contractVersion=story-domain/2`.
- **Live health surface:** production `/regimes` returned HTTP 200 and rendered **0 Unassigned active Stories**, **1 Domain-quarantined Story**, **0 high/critical** domain quarantine, and the separate Story-domain warning. PR #605 narrows the routing-ready copy to “Every market-admissible active Story…” so the two health surfaces do not contradict each other.
- **Current governed result:** there is **zero open Regime routing debt**. Every market-admissible active Story clears a governed Regime route; one active provenance/process Story is deliberately preserved outside that market-routing universe under explicit Story-domain quarantine. No weak mapping was manufactured merely to reach zero routing debt.

### Regime interpretation timing and coverage · 7 October 2026

- **Current production deployment:** the Vercel production deployment for commit `9176f469cd2ab704559710d6f4c263f4c0509061` (`#610`) reached **READY**. GitHub `Validate Live Desk` push run [`37550274122`](https://github.com/clydigital/alchemy-live-market-desk/actions/runs/37550274122) completed successfully; GitHub's Vercel commit status is `success`.
- **Live read-model verification:** the previous production inspection recorded HTTP **200** for `/regimes` and the `global-rates` and `treasury-fiscal` subgroup views, with **2 mapped context-only** subgroups and **0 truly unmapped sensor-only** subgroups. This is a timestamped observation, not a promise about future telemetry.
- **Correct freshness authority:** the two context-only subgroup mappings exist but refer to seed/episode Stories, which remain ineligible to drive durable Regime interpretation. Three Story-backed subgroups had accepted evaluation clocks later than their last telemetry at the earlier production diagnosis; an unchanged accepted thesis does not become stale merely because its hypothesis text was not edited.
- **No synthetic repair:** no Story is promoted, no reevaluation queue item is fabricated for non-durable coverage, and no Regime versions/snapshots or evidence contracts are changed by #608–#610.
- **Residual proof scope remains separate:** D4 fresh material Story version, D6 measured reaction assessment and natural STALE/CONFLICT source arbitration still require qualifying real observations. Their absence is not evidence that the implemented paths failed.
- **Error-scan boundary:** a 7 October 2026 Vercel runtime error-group scan found a single historical `/hybrid-output` timeout last seen 6 October; it belongs to the separately owned loading-diagnosis lane. A 30-minute production error/fatal log query around 03:26 UTC on 7 October returned no matching logs; this does not establish zero errors outside that window.

### Earlier D7 / Hybrid production proof

The production deployment for the D7 proof commit `395b261c4d74cdf18c5bab24bc22e21249aefa01` reached **READY**.

Observed directly:

- `/hybrid-output` returned HTTP **200**.
- `/dossier` returned HTTP **200**.
- `/hybrid-output` rendered the D7 **Cross-layer checks** panel.
- The Hybrid scenario ladder and guarded D/E tail language rendered in production.
- No runtime errors were present in the final 15-minute verification window.

This does **not** prove every internal branch executed against a live material case. Rows above therefore avoid marking deeper backend behaviour as production-verified unless it was actually observed.

## Non-overlapping boundary regression added by this audit

`tests/d1-d6-boundary-matrix-regression.test.ts` adds focused regression coverage for D1–D6/evidence-sufficiency/Research-Gap lifecycle boundaries without changing production logic or the dedicated D7 end-to-end proof.

The reserved D7 proof remains:

`tests/d7-end-to-end-integration-proof.test.ts`

## Superseded branches / PRs

These older implementation attempts are superseded by current-main replacements and should not be treated as active architecture:

- **#426** → superseded by **#516**.
- **#500 / #502** → superseded by merged **#504**.
- **#506 / #509** → superseded by merged **#511**.
- **#507** → superseded by merged **#510**.
- Older chained Motion/B4 branches **#402, #404–#408** are historical attempts; current main contains the governed replacement architecture.

This audit does not close historical PRs automatically.
