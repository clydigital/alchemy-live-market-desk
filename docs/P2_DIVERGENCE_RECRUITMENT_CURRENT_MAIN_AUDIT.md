# Audit: P2.2–P2.4 Canonical Divergence Evidence Recruitment vs Current Main

**Date**: October 2026
**Target Repository**: `clydigital/alchemy-live-market-desk`
**Base Commit**: `7f6cfff` (Regime: reproject after maintenance-only Story reassessment #516)
**Evaluated Branches / PRs**:
- PR #459 (`feat/bounded-divergence-evidence-recruitment-p2-2`)
- PR #461 (`feat/divergence-evidence-presenter-proof-p2-3`)
- PR #463 (`feat/divergence-recruitment-lifecycle-p2-4`)
- Current Main Merged Infrastructure (#503, #504, #511, #512, #516)

---

## 1. Genuinely Missing Capabilities on Current Main

Current main has implemented D1–D7 end-to-end integration proof (#512), Research Gap sequential discriminators (#504), and Causal discriminators (#503). However, the following specific capabilities from PRs #459, #461, and #463 are **genuinely missing** on current main:

1. **Domain-Specific Divergence Recruitment Planner (P2.2 / PR #459)**:
   - Pure domain-specific recruitment planner (`planDivergenceEvidenceRecruitment`) evaluating unresolved canonical divergences from the Hypothesis stage and generating targeted evidence recruitment plans (e.g., real yields/breakevens for rates/gold, refined cracks for oil, VIX/breadth for equities, rate differentials for FX, credit spreads for funding).
   - Automated persistence of open divergence recruitment plans to the `research_debt` table (`debt_key = "divergence:<id>"`, `metadata.kind = "canonical_divergence_recruitment"`) during `runScheduledResearchCycle()`.
   - Ingestion and adaptation of open `divergence:` research debt rows into the `ResearchGapWorkQueue` inside `lib/research-gap-worker.ts` as `sourceKind: "research_gap"`, `severity: "MATERIAL"`.

2. **Presenter Bridge & UI Proof for Divergence Recruitment (P2.3 / PR #461)**:
   - Presenter bridge mapping in `lib/presenter-canonical-story-bridge.ts` formatting divergence recruitment evidence into readable mechanism branches and presenter codes.
   - UI presentation component support in `components/live-desk/PresenterDivergenceJourney.tsx` rendering active recruitment status and required evidence categories.

---

## 2. Capabilities Duplicated or Superseded by Merged Code (#504, #511, #512) — Explicit Deletion Flags

The following code from old PRs #459, #461, and #463 is **duplicated or superseded** by merged infrastructure and MUST BE DELETED / NOT RE-INTRODUCED:

1. **DELETE: Custom Divergence Lifecycle Engine (`lib/intelligence/divergence-recruitment-lifecycle.ts` from PR #463)**:
   - **Reason**: #504 introduced generic sequential Research Gap discriminator lifecycles (`lib/research-gap-lifecycle.ts` and `lib/research-gap-discriminator-lifecycle.ts`).
   - **Action**: **ELIMINATE P2.4 as a separate engine file entirely**. Divergence recruitment debt lifecycle state transitions (`OPEN` -> `RESOLVED` / `EXPIRED`) can be handled directly by calling the existing #504 `evaluateResearchGapEvidence` / `researchGapDiscriminatorLifecycleFromPlan`.

2. **DELETE: Standalone Divergence Discriminator Schemas in PR #459 / #463**:
   - **Reason**: #504 introduced `ResearchGapDiscriminatorLifecycleSnapshot` and `causalDiscriminator` directly onto `ResearchGapPlan` in `lib/research-gap-plan.ts`.
   - **Action**: Do NOT create parallel discriminator types. Attach divergence recruitment requirements directly to `ResearchGapPlan.causalDiscriminator` / `ResearchGapRequirement`.

3. **DELETE: Custom D7 Routing Triggers in PR #463**:
   - **Reason**: #511 established lazy-loaded Live runtime routing synced at the Research Gap boundary (`lib/d7-research-gap-routing.ts`).
   - **Action**: Omit all custom D7 triggers from PR #463. Divergence items must sync purely through established Research Gap sync boundaries.

4. **DELETE: Direct Database / UI Bypasses in PR #461**:
   - **Reason**: #512 established strict reasoning authority closure: Live Desk -> Dossier -> Research Gap -> Presenter Bridge -> UI.
   - **Action**: Presenter mappings in P2.3 must read purely from canonical state projections without direct database calls or unvalidated UI state mutations.

---

## 3. Recommended Micro-Partition Strategy (1–3 Files Each, Post-P2.1)

To avoid long validation, compilation, or test load times, we recommend splitting P2.2–P2.3 into strict 1–3 file micro-partitions and **eliminating P2.4 entirely**:

### Micro-Partition P2.2a: Pure Divergence Recruitment Planner
- **Files (2)**:
  1. `lib/intelligence/divergence-evidence-recruitment.ts` *(NEW)*
  2. `tests/divergence-evidence-recruitment.test.ts` *(NEW)*
- **Scope**: Pure planner function (`planDivergenceEvidenceRecruitment`), domain-specific discriminator packs, and cycle cap of 4 items. Zero side effects or network calls.

### Micro-Partition P2.2b: Scheduled Runtime Persistence & Queue Ingestion
- **Files (3)**:
  1. `lib/intelligence/runtime.ts` *(scheduled cycle debt persistence)*
  2. `lib/research-gap-worker.ts` *(queue loader `divergence:` debt ingestion)*
  3. `tests/research-gap-worker.test.ts` *(queue integration unit tests)*
- **Scope**: Wire planner output into `research_debt` DB write inside `runScheduledResearchCycle()` and adapt `divergence:` debt rows into `ResearchGapWorkQueue`.

### Micro-Partition P2.3a: Presenter Bridge Mapping
- **Files (2)**:
  1. `lib/presenter-canonical-story-bridge.ts` *(divergence recruitment mechanism codes)*
  2. `tests/presenter-canonical-story-bridge.test.ts` *(bridge unit tests)*
- **Scope**: Pure canonical story bridge mapping for divergence recruitment evidence.

### Micro-Partition P2.3b: Divergence Journey UI Presentation
- **Files (2)**:
  1. `components/live-desk/PresenterDivergenceJourney.tsx` *(UI component rendering)*
  2. `tests/presenter-divergence-journey.test.ts` *(UI render unit tests)*
- **Scope**: Frontend rendering of active recruitment status and required evidence categories.

### Micro-Partition P2.4: ELIMINATED (Reuses #504 Sequential Lifecycle)
- **Files (0)**: No new engine files required.
- **Scope**: Lifecycle transitions reuse `lib/research-gap-lifecycle.ts` and `lib/research-gap-discriminator-lifecycle.ts` merged in #504.

---

## 4. Exact Files Touched by Each Micro-Partition

| Partition | Code File(s) | Test File(s) | Total Files | Status |
| :--- | :--- | :--- | :---: | :--- |
| **P2.2a** | `lib/intelligence/divergence-evidence-recruitment.ts` | `tests/divergence-evidence-recruitment.test.ts` | **2** | Ready after P2.1 |
| **P2.2b** | `lib/intelligence/runtime.ts`, `lib/research-gap-worker.ts` | `tests/research-gap-worker.test.ts` | **3** | Follows P2.2a |
| **P2.3a** | `lib/presenter-canonical-story-bridge.ts` | `tests/presenter-canonical-story-bridge.test.ts` | **2** | Follows P2.2b |
| **P2.3b** | `components/live-desk/PresenterDivergenceJourney.tsx` | `tests/presenter-divergence-journey.test.ts` | **2** | Follows P2.3a |
| **P2.4** | *(None — Reuses `lib/research-gap-lifecycle.ts`)* | *(None — Reuses existing tests)* | **0** | **ELIMINATED** |

---

## 5. Risks: Duplicate Queues, Research Debt Accumulation, and Lifecycle Semantics

1. **Duplicate Queue Risk (`research_debt` vs `research_gap_cases`)**:
   - Divergence recruitment creates rows in `research_debt` (`debt_key = "divergence:<id>"`).
   - `buildResearchGapWorkQueue()` maps these rows into `ResearchGapWorkQueue` candidates.
   - **Risk**: If a manual or automated process creates a separate `research_gap_cases` row for the exact same divergence, the queue will contain duplicate candidate items.
   - **Mitigation**: De-duplicate candidate work items in `buildResearchGapWorkQueue()` using `debt_key` and `blocking_refs`.

2. **Research Debt Accumulation Risk**:
   - P2.2 caps new recruitment plans at 4 per cycle.
   - **Risk**: Stale open divergence debts occupy queue slots and budget capacity.
   - **Mitigation**: Enforce an automatic 7-day TTL / expiration window on unresolved divergence debt directly in `buildResearchGapWorkQueue()`.

3. **Lifecycle Semantics Alignment**:
   - Research Gap execution yields verdicts: `CONFIRMING`, `CONTRADICTING`, `NO_CHANGE`, `UNRESOLVED`.
   - **Risk**: Mismatch between Research Gap execution verdicts and debt resolution status.
   - **Mitigation**: Leverage existing #504 `evaluateResearchGapEvidence` which automatically resolves or expires cases based on evidence directness and quality.

---

## 6. Old Pull Requests to Close After Transplant

Once P2.2a, P2.2b, P2.3a, and P2.3b micro-partitions are transplanted and merged onto main, the following old PRs must be closed:

1. **PR #459** (`feat/bounded-divergence-evidence-recruitment-p2-2`)
2. **PR #461** (`feat/divergence-evidence-presenter-proof-p2-3`)
3. **PR #463** (`feat/divergence-recruitment-lifecycle-p2-4`) — **Completely superseded and eliminated by #504**
