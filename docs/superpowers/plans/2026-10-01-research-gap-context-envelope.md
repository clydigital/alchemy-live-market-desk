# Research Gap Context Envelope Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bounded multi-Dossier and future MacroPulse provenance to the merged Research Gap plan pipeline without creating a second analytical authority.

**Architecture:** A pure context adapter loads the exact occurrence and up to three linked Dossiers. The existing plan builder consumes that context, while the existing start RPC fences context identity atomically.

**Tech Stack:** TypeScript, Node test runner, Next.js, Supabase/PostgreSQL.

**Spec:** `docs/superpowers/specs/2026-10-01-research-gap-context-envelope-design.md`

## Global Constraints

- Keep `research-gap-plan/1` backward compatible.
- Maximum Dossier lineage length is three.
- Only the newest Dossier is canonical.
- MacroPulse and older Dossiers are context-only.
- No Story, Regime, thesis, or canonical investigation mutation.

## Review Focus

- Unrelated recent Dossiers must never enter lineage; Task 1 tests exact predecessor traversal.
- Missing/cyclic predecessors must fail closed; Task 1 tests both.
- Context-only content must not override plan fields; Task 2 tests conflicting older and MacroPulse inputs.
- Concurrent latest-work/Dossier changes must reject start; Task 3 tests database fencing.
- Existing persisted plans without context must remain replayable; Task 2 tests validation compatibility.

---

### Task 1: Frozen Context Adapter

**Files:** Create `lib/research-gap-context.ts`; create `tests/research-gap-context.test.ts`.

**Interfaces:** Produces `loadResearchGapPlanContext(gap, client, now)`, `adaptMacroPulseContext(input)`, and `ResearchGapPlanContext`.

- [ ] Write and run failing lineage, authority, cycle, missing predecessor, and MacroPulse tests.
- [ ] Implement the bounded exact loader and pure adapter.
- [ ] Run focused tests and commit `feat: add research gap context envelope`.

### Task 2: Context-Aware Existing Plan

**Files:** Modify `lib/research-gap-plan.ts`, `app/api/research-gap/execution/route.ts`, `tests/research-gap-plan.test.ts`, and `tests/research-gap-execution.test.ts`.

**Interfaces:** `buildResearchGapPlan(gap, now, context?)` remains backward compatible; new endpoint starts always pass context.

- [ ] Write and run failing authoritative-field, provenance, and compatibility tests.
- [ ] Add optional plan context, exact current-investigation enrichment, and endpoint loading.
- [ ] Run focused tests and commit `feat: build plans from frozen context`.

### Task 3: Start Fence, Documentation, and Delivery

**Files:** Create a forward migration and SQL contract; modify CI and `docs/RESEARCH_GAP_EXECUTION.md`.

**Interfaces:** Preserve the existing RPC signature and reject mismatched `sourceWorkId` / `authoritativeDossierId` when context is present.

- [ ] Write the failing database contract, update the RPC, and wire the contract into CI.
- [ ] Run all local verification, push a clean branch, and use CI for disposable PostgreSQL proof.
- [ ] Open and attach the follow-up PR; keep production migration as a separate authorised operation.
