# A3 Regime/Story Reevaluation Propagation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Propagate evidence-backed A2 Motion ACCEPT/REFINE decisions into the existing persistent Story reevaluation queue, then let the existing Story engine drive Regime projection.

**Architecture:** Add one Dossier adapter that plans bounded Story reevaluation targets from A2 decisions, exact Motion Story links, and active Regime↔Story links. The adapter only queues existing canonical `intelligence_evidence` UUIDs; it never mutates Story/Regime state itself. Dossier persistence records the immutable propagation plan before queue execution; the existing Story review and Regime projector remain final authorities.

**Tech Stack:** TypeScript, Node test runner, Supabase JS, existing Dossier V2 / Story review / Regime projector contracts.

**Spec:** `docs/superpowers/specs/2026-10-04-a3-regime-story-reevaluation-propagation-design.md`

## Global Constraints

- Motion remains non-evidentiary.
- Only `ACCEPT` and `REFINE` decisions may propagate automatically.
- Every queue row must use an existing `intelligence_evidence.id` UUID resolved from the exact A2/Dossier evidence identity.
- Preserve the exact A2 `canonical_evidence_ref` separately from the queue UUID.
- Exact identity resolution may use `id`, `external_evidence_id`, or the canonical `ev:<id>` fallback; never hash, fuzzy-match, or invent an evidence row.
- Reuse `intelligence_reevaluation_queue`; do not create a second Story or Regime reasoning path.
- A3 may target at most four unique Stories per Dossier execution.
- One Regime-routed decision may fan out to at most one core plus two bridge/supporting Stories.
- Existing Story mutation evidence gates remain unchanged.
- Existing Story-engine → Regime projection remains the only persistent Regime update path.
- Hybrid, B1, B2, B3, Rates audits, Research Brain token cleanup, and Hybrid cache cleanup remain out of scope.

## Review Focus

- A2 decision uses an external canonical evidence ref: queue only when it resolves to exactly one existing canonical row; ambiguous or derived-only refs fail closed.
- Exact Motion Story link points to a discarded/missing Story: no weak substitute Story is invented.
- Explicit Story and Regime routing hit the same Story: collapse deterministically without duplicate target/evidence rows.
- Same Story has an open System 1 null-evidence activation row: A3 evidence-backed row is still allowed.
- Queue/routing reads fail after Research Brain succeeds: Dossier persistence remains successful and warnings are truthful.

---

### Task 1: Pure A3 propagation planner

**Files:**
- Create: `lib/dossier-v2/reevaluation-propagation.ts`
- Create: `tests/dossier-reevaluation-propagation.test.ts`

**Interfaces:**
- Consumes: `DossierV2InputPacket`, `ResearchBrainOutputV1`, Story registry rows, active Regime↔Story routing rows, queueable canonical evidence UUIDs.
- Produces:
  - `DOSSIER_REEVALUATION_PROPAGATION_CONTRACT_VERSION`
  - `DossierReevaluationPropagationItem`
  - `DossierReevaluationPropagationPlan`
  - `buildDossierReevaluationPropagationPlan(input): DossierReevaluationPropagationPlan`
  - `MAX_DOSSIER_REEVALUATION_PROPAGATION_TARGETS = 4`

- [ ] **Step 1: Write failing planner tests**

Add tests proving:
- ACCEPT + canonical UUID + explicit `STORY:<id>` plans that Story.
- REFINE + canonical UUID + exact Motion `primary_story_id` plans that Story when no explicit Story destination exists.
- UNRESOLVED and REJECT plan nothing.
- a Motion ID cannot become `canonical_evidence_ref` or queue UUID.
- exact external evidence refs resolve only to the matching canonical row UUID.
- ambiguous external evidence refs fail closed.
- `ev:<row-uuid>` resolves only to that existing canonical row.
- derived-only non-UUID Dossier evidence is ignored for propagation.
- `origin_evidence_ref` absent from A2 `canonical_evidence_refs` is ignored.
- explicit Story routing outranks Motion Story fallback.
- `REGIME:CURRENT` adds active linked Stories ordered core → bridge/supporting by confidence.
- Regime routing fans out to no more than three Stories per decision.
- total unique Story targets are capped at four.
- duplicate Story/evidence targets collapse deterministically.
- missing/discarded Story targets are skipped without prose inference.

- [ ] **Step 2: Run RED**

Run:
`node --test --experimental-strip-types tests/dossier-reevaluation-propagation.test.ts`

Expected: FAIL because `reevaluation-propagation.ts` / exported planner does not exist.

- [ ] **Step 3: Implement the pure planner**

Use these exact route priorities:
- explicit Story + ACCEPT: 95
- explicit Story + REFINE: 90
- Motion primary Story + ACCEPT: 92
- Motion primary Story + REFINE: 87
- Regime core + ACCEPT: 90
- Regime core + REFINE: 85
- Regime bridge/supporting + ACCEPT: 85
- Regime bridge/supporting + REFINE: 80

Use only the first queueable canonical evidence ref in the A2 decision, preserving decision order. `route_kind` is one of `explicit_story | motion_primary_story | regime_core | regime_bridge`; supporting links use `regime_bridge`.

- [ ] **Step 4: Run GREEN**

Run:
`node --test --experimental-strip-types tests/dossier-reevaluation-propagation.test.ts`

Expected: PASS.

- [ ] **Step 5: Run full tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `Add A3 Dossier reevaluation propagation planner`

---

### Task 2: Database routing loader and durable queue adapter

**Files:**
- Modify: `lib/dossier-v2/reevaluation-propagation.ts`
- Modify: `tests/dossier-reevaluation-propagation.test.ts`

**Interfaces:**
- Consumes Task 1 planner.
- Produces:
  - `prepareDossierReevaluationPropagationPlan({ client, packet, analyticalOutput }): Promise<DossierReevaluationPropagationPlan>`
  - `DossierReevaluationPropagationResult`
  - `enqueueDossierReevaluationPropagation({ client, dossierId, asOf, plan }): Promise<DossierReevaluationPropagationResult>`
  - pure duplicate helper used by tests.

- [ ] **Step 1: Write failing adapter tests**

Add tests proving:
- A2 evidence refs resolve to queue UUIDs only through exact canonical row identity (`id`, `external_evidence_id`, or `ev:<id>`);
- ambiguous or missing canonical row identities are not queueable;
- active Regime links use `market_regimes.slug`, `market_regime_story_links.role`, and `confidence`;
- same Story + same evidence open row is skipped;
- same Story + different evidence is inserted;
- same Story + null-evidence System 1 row does not suppress A3;
- queue reason begins `dossier_motion_acceptance:<dossier-id>:<motion-id>:<decision>`;
- queue insertion uses `available_at = packet.as_of`;
- enqueue failure returns `enqueued = 0` plus warning and never claims success.

- [ ] **Step 2: Run RED**

Run:
`node --test --experimental-strip-types tests/dossier-reevaluation-propagation.test.ts`

Expected: FAIL because preparation/enqueue APIs are not implemented.

- [ ] **Step 3: Implement bounded database reads**

Load:
- non-discarded Stories: `id,slug,status,confidence`;
- candidate `intelligence_evidence.id` rows only for A2 UUID refs;
- active `market_regimes.id,slug`;
- active `market_regime_story_links.regime_id,story_id,role,confidence` with `effective_to is null`.

Preparation failures return an empty plan with warnings; they do not throw into Dossier persistence.

- [ ] **Step 4: Implement queue idempotency**

Before insert, inspect open `pending|processing|retryable` Story rows for the planned target/evidence combinations. Insert only missing target/evidence pairs.

- [ ] **Step 5: Run GREEN and full tests**

Run:
`node --test --experimental-strip-types tests/dossier-reevaluation-propagation.test.ts`
then:
`npm test`

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `Add A3 Story reevaluation queue adapter`

---

### Task 3: Persist propagation intent and integrate execution order

**Files:**
- Modify: `lib/dossier-v2/execution.ts`
- Modify: `lib/dossier-v2/manual-run.ts`
- Modify: `tests/dossier-v2-execution.test.ts`
- Modify: `tests/dossier-reevaluation-propagation.test.ts`

**Interfaces:**
- Consumes Task 2 prepare/enqueue APIs.
- Produces:
  - `DossierV2ExecutionResult.reevaluation_propagation`
  - optional `ManualDossierV2RunResult.reevaluation_propagation`
  - persisted `payload.reevaluation_propagation` plan snapshot.

- [ ] **Step 1: Write failing execution tests**

Prove:
- `buildMarketDossierV2InputFromResearchBrain` can receive/attach an A3 plan snapshot without altering analytical output.
- persisted Dossier payload contains `reevaluation_propagation.contract_version`, items, omitted count, warnings.
- A3 enqueue executes after Dossier persistence.
- generic `enqueueDossierStoryRefreshAgenda` remains present after A3.
- `persistRegimeShadowProjectionSafely({ trigger: "dossier" })` remains after both Story queue paths.
- NO_CHANGE returns an empty propagation result and does not invent new queue work.
- queue failure does not roll back the already-persisted Dossier.
- manual persisted runs expose the propagation result.

- [ ] **Step 2: Run RED**

Run:
`node --test --experimental-strip-types tests/dossier-v2-execution.test.ts tests/dossier-reevaluation-propagation.test.ts`

Expected: FAIL because execution does not expose/persist A3 propagation.

- [ ] **Step 3: Integrate pre-persistence planning**

Execution order must be:
1. obtain analytical output;
2. build Dossier input;
3. prepare A3 plan;
4. clone plan into `dossierInput.payload.reevaluation_propagation`;
5. persist Dossier;
6. enqueue A3 propagation;
7. run existing generic Dossier Story refresh agenda;
8. run existing Dossier Regime shadow projection.

If A3 preparation fails, attach an empty warning-bearing plan and continue.

- [ ] **Step 4: Integrate result surfaces**

Add `reevaluation_propagation` to Dossier execution result and manual persisted result. Dry runs do not queue and may omit this field.

- [ ] **Step 5: Run GREEN and full tests**

Run:
`node --test --experimental-strip-types tests/dossier-v2-execution.test.ts tests/dossier-reevaluation-propagation.test.ts`
then:
`npm test`

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message: `Integrate A3 propagation into Dossier execution`

---

### Task 4: Cycle guard, typecheck, build, and branch verification

**Files:**
- Modify tests only if a regression test exposes a real defect.
- No new architecture beyond the approved A3 spec.

**Interfaces:**
- Consumes Tasks 1–3.
- Produces a merge-ready A3 branch.

- [ ] **Step 1: Add/confirm cycle-guard regression assertions**

Prove:
- A3 module never writes `market_regime_current` or `market_regime_versions`;
- Regime System 1 activation still inserts `requested_by_evidence_id: null`;
- A3 does not add Regime projection output to Dossier canonical evidence collections;
- Hybrid files are unchanged.

- [ ] **Step 2: Run complete verification**

Run:
- `npm test`
- `npx tsc --noEmit`
- `npm run build`

Expected: all PASS.

- [ ] **Step 3: Verify database contracts**

Run the repository's DB-contract CI workflow / equivalent existing contract check.

Expected: PASS with no migration required.

- [ ] **Step 4: Whole-branch review**

Review the branch against this plan and the A3 design spec, with special attention to the five Review Focus cases above. Any Critical/Important finding requires a reproducing failing test before a fix.

- [ ] **Step 5: Commit any verified review fixes**

Commit only fixes backed by RED→GREEN tests.

- [ ] **Step 6: Open PR**

PR scope must state explicitly that A3:
- reuses the existing Story reevaluation queue;
- keeps Motion non-evidentiary;
- does not implement B1/B2/B3;
- does not create direct Regime mutation.

