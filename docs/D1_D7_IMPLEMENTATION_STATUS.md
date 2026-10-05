# D1–D7 Architecture Implementation Status

**Audit base:** current `main` at `7f6cfff66c2866f033b49e62f160aadb6e08e431` or newer.

This is an implementation audit, not a design document. It distinguishes code/test coverage from direct production observation.

## Status legend

- **IMPLEMENTED** — production code exists on `main`.
- **TESTED** — focused unit/integration/contract coverage exists.
- **RUNTIME-WIRED** — the code participates in an active runtime path rather than existing only as a pure helper.
- **PRODUCTION-VERIFIED** — the specific behaviour has been directly observed on a production deployment or production-backed route. Deployment alone is not enough.

## Matrix

| Layer / subsystem | Implemented | Tested | Runtime-wired | Production-verified | Primary evidence |
| --- | --- | --- | --- | --- | --- |
| **D1 — exact persistent Story identity** | ✅ | ✅ | ✅ | Not independently smoke-proven | `lib/intelligence/story-identity.ts`, Dossier identity plumbing, Hybrid exact-ID resolution, identity tests |
| **D2 — CONFIRMING / CONTRADICTING / ACCELERATING classification** | ✅ | ✅ | ✅ | Not independently smoke-proven | Dossier evidence governance + Hybrid canonical Story classification |
| **D3 — A3 governed Story wake** | ✅ | ✅ | ✅ | Not independently smoke-proven | Dossier reevaluation propagation, queue ownership/fencing, authority-chain tests |
| **D4 — canonical `story_thesis_versions` mutation path** | ✅ | ✅ | ✅ | Not independently smoke-proven | canonical Story assessment/apply path; PR #497; authority-chain proof #508 |
| **D5 — Market-State Decision Packet** | ✅ | ✅ | ✅ | Not independently smoke-proven | Dossier presentation adapter / canonical snapshot tests |
| **D6 — longitudinal adjudication** | ✅ | ✅ | ✅ | Not independently smoke-proven | Dossier longitudinal adjudication / replay tests |
| **D7 — cross-layer divergence comparator** | ✅ | ✅ | ✅ | ✅ comparator/UI observed | PR #505 + #510; production `/hybrid-output` rendered **Cross-layer checks** with HTTP 200 |
| **D7 → Research Gap routing** | ✅ | ✅ | ✅ | Deployed, but no live material-divergence handoff was observed during this audit | PR #511 + end-to-end proof #512 |
| **Evidence freshness / source arbitration** | ✅ | ✅ | ✅ | Not independently smoke-proven | evidence governance, temporal correctness, source-priority tests |
| **Evidence sufficiency / confidence blockers** | ✅ | ✅ | ✅ | Not independently smoke-proven | `lib/dossier-v2/evidence-sufficiency.ts` + focused tests |
| **Hybrid scenario falsification / hysteresis** | ✅ | ✅ | ✅ | ✅ | PR #496; production `/hybrid-output` rendered bounded A/B/C/D/E ladder and guarded D/E tails |
| **Historical Presenter replay** | ✅ | ✅ | ✅ | Deployed; exact replay not manually exercised in this audit | PR #503 + historical replay tests |
| **Sequential Research Gap discriminators** | ✅ | ✅ | ✅ | Deployed; live ADVANCE/EXHAUST transition not manually exercised in this audit | PR #504 + lifecycle tests |
| **Maintenance Story → Regime reprojection** | ✅ | ✅ | ✅ | Newly merged; awaiting natural production exercise | PR #516 |

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

## Production observations from this audit

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
