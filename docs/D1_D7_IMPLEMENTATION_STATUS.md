# D1–D7 Architecture Implementation Status

**Audit base:** current `main` at `03500453c93124376ca41daf2d58898d9a42b1ee` or newer.

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
| **D7 → Research Gap routing** | ✅ | ✅ | ✅ | Deployed, but no live material-divergence handoff was observed during this audit | PR #511 + end-to-end proof #512 |
| **Evidence freshness / source arbitration** | ✅ | ✅ | ✅ | Not independently smoke-proven | evidence governance, temporal correctness, source-priority tests |
| **Evidence sufficiency / confidence blockers** | ✅ | ✅ | ✅ | Not independently smoke-proven | `lib/dossier-v2/evidence-sufficiency.ts` + focused tests |
| **Hybrid scenario falsification / hysteresis** | ✅ | ✅ | ✅ | ✅ | PR #496; production `/hybrid-output` rendered bounded A/B/C/D/E ladder and guarded D/E tails |
| **Historical Presenter replay** | ✅ | ✅ | ✅ | Deployed; exact replay not manually exercised in this audit | PR #503 + historical replay tests |
| **Sequential Research Gap discriminators** | ✅ | ✅ | ✅ | Deployed; live ADVANCE/EXHAUST transition not manually exercised in this audit | PR #504 + lifecycle tests |
| **Maintenance Story → Regime reprojection** | ✅ | ✅ | ✅ | ✅ production maintenance run `37422359132` created completed Regime projection `6b3bb1d3-a680-4b4b-a03d-963e6f5e7233` | PR #516; trigger `story_engine`, 5 persisted Regime versions, 0 warnings |

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
