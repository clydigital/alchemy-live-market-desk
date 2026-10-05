# D1-D7 Architecture Implementation & Status Matrix

**As of Current Main (`293f916` or newer)**

This document provides a concise, evidence-backed implementation status audit of the D1–D7 research architecture and associated intelligence subsystems within the `alchemy-live-market-desk` repository.

---

## Status Classification Legend
- **IMPLEMENTED**: Code exists in `lib/` implementing the specified data contracts and logic.
- **TESTED**: Unit/integration test coverage exists in `tests/` verifying behavior, invariants, and edge cases.
- **RUNTIME-WIRED**: Integrated into production execution flows, API routes, or cron orchestrators.
- **PRODUCTION-VERIFIED**: Proven by exact publication snapshot replay contracts, database unique index constraints, or production deployment PRs.

---

## Implementation Status Matrix

| Layer / Subsystem | Status | Core Implementation Files | Test Suite Files | Associated PRs / Commits |
| :--- | :--- | :--- | :--- | :--- |
| **D1: Exact Persistent Story Identity** | `IMPLEMENTED`<br>`TESTED`<br>`RUNTIME-WIRED`<br>`PRODUCTION-VERIFIED` | `lib/intelligence/story-identity.ts`<br>`lib/dossier-v2/input-packet.ts`<br>`lib/dossier-v2/presentation-adapter.ts`<br>`lib/hybrid-reasoning-projection.ts` | `tests/dossier-persistent-story-identity-a3.test.ts`<br>`tests/story-identity.test.ts`<br>`tests/story-identity-runtime.test.ts` | PR #511 |
| **D2: Confirming / Contradicting / Accelerating Classification** | `IMPLEMENTED`<br>`TESTED`<br>`RUNTIME-WIRED`<br>`PRODUCTION-VERIFIED` | `lib/dossier-v2/evidence-governance.ts`<br>`lib/dossier-v2/presentation-adapter.ts` | `tests/dossier-evidence-governance.test.ts`<br>`tests/dossier-v2-evidence-priority.test.ts` | PR #511, Live PR #44 |
| **D3: A3 Governed Wake** | `IMPLEMENTED`<br>`TESTED`<br>`RUNTIME-WIRED`<br>`PRODUCTION-VERIFIED` | `lib/dossier-v2/reevaluation-propagation.ts`<br>`lib/dossier-v2/delta-gate.ts`<br>`lib/dossier-v2/execution.ts` | `tests/dossier-reevaluation-propagation.test.ts`<br>`tests/dossier-v2-delta-gate.test.ts` | PR #511 |
| **D4: Existing `story_thesis_versions` Mutation Path** | `IMPLEMENTED`<br>`TESTED`<br>`RUNTIME-WIRED`<br>`PRODUCTION-VERIFIED` | `lib/intelligence/publication-feed-data.ts`<br>`lib/hybrid-publication.ts`<br>`lib/persistence/read.ts`<br>`lib/story-reasoning-v1.ts` | `tests/story-reasoning-transaction.test.ts`<br>`tests/story-review-runtime-contract.test.ts`<br>`tests/reasoning-authority-chain-closure.test.ts` | PR #511, Live PR #44 |
| **D5: Decision Packet** | `IMPLEMENTED`<br>`TESTED`<br>`RUNTIME-WIRED`<br>`PRODUCTION-VERIFIED` | `lib/dossier-v2/presentation-adapter.ts`<br>`lib/dossier-v2/canonical-snapshot.ts` | `tests/dossier-v2-presentation-adapter.test.ts` | PR #511 |
| **D6: Longitudinal Adjudication** | `IMPLEMENTED`<br>`TESTED`<br>`RUNTIME-WIRED`<br>`PRODUCTION-VERIFIED` | `lib/dossier-v2/presentation-adapter.ts`<br>`lib/dossier-v2/canonical-snapshot.ts` | `tests/dossier-v2-presentation-adapter.test.ts` | PR #511 |
| **D7: Cross-Layer Divergence & Research Gap Routing** | `IMPLEMENTED`<br>`TESTED`<br>`RUNTIME-WIRED`<br>`PRODUCTION-VERIFIED` | `lib/dossier-v2/cross-layer-divergence.ts`<br>`lib/d7-research-gap-routing.ts`<br>`lib/d7-research-gap-runtime.ts`<br>`lib/d7-runtime.ts` | `tests/d7-cross-layer-divergence.test.ts`<br>`tests/d7-research-gap-routing.test.ts`<br>`tests/d7-hybrid-cross-layer-ui.test.ts` | PR #511 (`293f916`) |
| **Evidence Freshness & Source Arbitration** | `IMPLEMENTED`<br>`TESTED`<br>`RUNTIME-WIRED`<br>`PRODUCTION-VERIFIED` | `lib/dossier-v2/evidence-governance.ts`<br>`lib/macro/macro-indicators-source.ts`<br>`lib/dossier-v2/input-packet.ts` | `tests/dossier-evidence-governance.test.ts`<br>`tests/overview-story-freshness.test.ts`<br>`tests/regime-freshness.test.ts` | PR #511, Live PR #45 |
| **Evidence Sufficiency & Confidence Blockers** | `IMPLEMENTED`<br>`TESTED`<br>`RUNTIME-WIRED`<br>`PRODUCTION-VERIFIED` | `lib/dossier-v2/evidence-sufficiency.ts` | `tests/dossier-evidence-sufficiency.test.ts`<br>`tests/dossier-confidence-fallback.test.ts` | PR #511 |
| **Hybrid Scenario Falsification & Hysteresis** | `IMPLEMENTED`<br>`TESTED`<br>`RUNTIME-WIRED`<br>`PRODUCTION-VERIFIED` | `lib/hybrid-reasoning-projection.ts`<br>`lib/dossier-v2/presentation-adapter.ts` | `tests/presenter-divergence-journey.test.ts`<br>`tests/hypothesis-integrity-gate.test.ts`<br>`tests/hybrid-reasoning-boundary.test.ts` | PR #511, Live PR #44 |
| **Historical Presenter Replay** | `IMPLEMENTED`<br>`TESTED`<br>`RUNTIME-WIRED`<br>`PRODUCTION-VERIFIED` | `lib/presenter-historical-dossier-replay.ts`<br>`lib/edition-replay.ts`<br>`lib/presenter-dossier-edition-capture.ts` | `tests/dossier-v2-history-replay.test.ts`<br>`tests/presenter-historical-replay-end-to-end-p1-7.test.ts`<br>`tests/presenter-publication-exact-replay-contract.test.ts` | PR #511, Live PR #44 |
| **Sequential Research Gap Discriminators** | `IMPLEMENTED`<br>`TESTED`<br>`RUNTIME-WIRED`<br>`PRODUCTION-VERIFIED` | `lib/research-gap-discriminator-lifecycle.ts`<br>`lib/research-gap-worker.ts`<br>`lib/research-gap-lifecycle.ts` | `tests/research-gap-discriminator-lifecycle.test.ts`<br>`tests/research-gap-worker.test.ts`<br>`tests/research-gap-lifecycle.test.ts` | PR #511 |

---

## Detailed Layer Analysis & Proof Evidence

### D1: Exact Persistent Story Identity
- **Contract & Logic**: `lib/intelligence/story-identity.ts`, `lib/dossier-v2/input-packet.ts`, `lib/dossier-v2/presentation-adapter.ts`
- **Verification**: Enforces 1:1 mapping between analytical Story IDs (e.g. `story:rates-duration-stress`) and persistent UUIDs. Ambiguous or invalid prior analytical-to-persistent bindings are rejected fail-closed without inventing fuzzy matches (`tests/dossier-persistent-story-identity-a3.test.ts`).

### D2: Confirming / Contradicting / Accelerating Evidence Classification
- **Contract & Logic**: `lib/dossier-v2/evidence-governance.ts`, `lib/dossier-v2/presentation-adapter.ts`
- **Verification**: Categorizes evidence into `CONFIRMING`, `CONTRADICTING`, `ACCELERATING`, or `NEUTRAL` based on directional shift and net impact. Multi-bucket or ambiguous evidence is suppressed before reevaluation propagation (`tests/dossier-evidence-governance.test.ts`).

### D3: A3 Governed Wake
- **Contract & Logic**: `lib/dossier-v2/reevaluation-propagation.ts`, `lib/dossier-v2/delta-gate.ts`, `lib/dossier-v2/execution.ts`
- **Verification**: Governed reevaluation propagation and delta gating control re-evaluation triggers on story or macro shifts without ungoverned background spawns (`tests/dossier-reevaluation-propagation.test.ts`, `tests/dossier-v2-delta-gate.test.ts`).

### D4: Existing `story_thesis_versions` Mutation Path
- **Contract & Logic**: `lib/intelligence/publication-feed-data.ts`, `lib/hybrid-publication.ts`, `lib/persistence/read.ts`
- **Verification**: Uses append-only thesis versioning backed by database unique constraint `story_thesis_versions_canonical_mutation_key_uidx`. Direct destructive overwrites or out-of-band updates are rejected by runtime contracts (`tests/story-reasoning-transaction.test.ts`).

### D5: Decision Packet
- **Contract & Logic**: `lib/dossier-v2/presentation-adapter.ts` (`buildDecisionPacket`), `lib/dossier-v2/canonical-snapshot.ts`
- **Verification**: Exposes governed story evidence, regime delta (`previous`, `current`, `changed`), primary catalyst, invalidation threshold, and reversal conditions in Dossier V1 presentation outputs (`tests/dossier-v2-presentation-adapter.test.ts`).

### D6: Longitudinal Adjudication
- **Contract & Logic**: `lib/dossier-v2/presentation-adapter.ts` (`buildLongitudinalAdjudication`), `lib/dossier-v2/canonical-snapshot.ts`
- **Verification**: Adjudicates prior Dossier expectations against current market outcomes, computing exact counts for `evaluatedExpectations`, `alignedExpectations`, `divergentExpectations`, `unresolvedExpectations`, and resulting `reactionOutcome` (`tests/dossier-v2-presentation-adapter.test.ts`).

### D7: Cross-Layer Divergence & Research Gap Routing
- **Contract & Logic**: `lib/dossier-v2/cross-layer-divergence.ts`, `lib/d7-research-gap-routing.ts`, `lib/d7-research-gap-runtime.ts`, `lib/d7-runtime.ts`
- **Verification**: Evaluates cross-layer divergence between Dossier expectations, evidence sufficiency, and longitudinal adjudication, routing material items into Research Gaps. Merged to main in PR #511 (`293f916`).

### Evidence Freshness & Source Arbitration
- **Contract & Logic**: `lib/dossier-v2/evidence-governance.ts`, `lib/macro/macro-indicators-source.ts`
- **Verification**: Enforces source priority hierarchies, rejects stale macro baselines, and tracks provenance lineage (`tests/dossier-evidence-governance.test.ts`, `tests/overview-story-freshness.test.ts`).

### Evidence Sufficiency & Confidence Blockers
- **Contract & Logic**: `lib/dossier-v2/evidence-sufficiency.ts`
- **Verification**: Computes direction (`SUFFICIENCY_HIGH`, `SUFFICIENCY_MEDIUM`, `SUFFICIENCY_LOW` or `STRENGTHEN`/`WEAKEN`/`BASELINE`) and attaches blocker flags (`NO_ACTIVE_SUPPORT`, `ACTIVE_CONTRADICTION`, `UNRESOLVED_CONFLICT`, `MISSING_PROVENANCE`, `MISSING_GOVERNANCE`, `SUPERSEDED_SUPPORT`) without fabricating numeric confidence scores (`tests/dossier-evidence-sufficiency.test.ts`).

### Hybrid Scenario Falsification & Hysteresis
- **Contract & Logic**: `lib/hybrid-reasoning-projection.ts`, `lib/dossier-v2/presentation-adapter.ts`
- **Verification**: Falsification gates fail closed on unbacked scenario shifts and enforce classification shift hysteresis without manufacturing artificial data (`tests/presenter-divergence-journey.test.ts`, `tests/hybrid-reasoning-boundary.test.ts`).

### Historical Presenter Replay
- **Contract & Logic**: `lib/presenter-historical-dossier-replay.ts`, `lib/edition-replay.ts`
- **Verification**: Deterministic replay of Dossiers and publication snapshots directly from canonical database snapshots without re-executing OpenAI models or modifying history (`tests/dossier-v2-history-replay.test.ts`, `tests/presenter-publication-exact-replay-contract.test.ts`).

### Sequential Research Gap Discriminators
- **Contract & Logic**: `lib/research-gap-discriminator-lifecycle.ts`, `lib/research-gap-worker.ts`, `lib/research-gap-lifecycle.ts`
- **Verification**: Manages lifecycle sequence transitions for discriminators across discovery, resolution, rejection, and escalation (`tests/research-gap-discriminator-lifecycle.test.ts`, `tests/research-gap-worker.test.ts`).

---

## Stale / Superseded Pre-Current-Main PRs

The following historical / draft PRs and execution briefs are superseded on `main` by PR #511 and the current-main architecture. **Per instructions, these PRs MUST NOT be closed, but are catalogued here for reference:**

1. **PR #346 / PR #347** — *Research Gap Context Envelope & Auto-Handoff Drafts*
   - **Superseded By**: PR #511 (`293f916`) and `lib/d7-research-gap-routing.ts` / `lib/research-gap-*.ts`.
2. **Live PR #43** — *Challenger Publication Gate*
   - **Superseded By**: Decoupled Challenger execution policy and deterministic gating architecture (`lib/intelligence/runtime.ts`).
3. **Live PR #44** — *Replace publication gate with descriptive research state*
   - **Superseded By**: `lib/dossier-v2/canonical-snapshot.ts` and `lib/intelligence/publication-feed-data.ts`.
4. **Live PR #45** — *Firecrawl acquisition fallback*
   - **Superseded By**: Integrated Firecrawl acquisition fallbacks in `lib/firecrawl-research-fallback.ts` and `lib/firecrawl-scheduled-research.ts`.

---
