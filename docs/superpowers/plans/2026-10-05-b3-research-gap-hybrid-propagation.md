# B3 Research Gap / Hybrid Propagation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make new Research Gap work Dossier-authoritative and expose exact Research Gap lifecycle status to Hybrid without leaking Research Gap conclusions or creating a second reasoning path.

**Architecture:** Remove the legacy direct `current_market_motion_items → Research Gap` producer while keeping historical `market_motion` lifecycle compatibility. Add a narrow Hybrid status adapter that loads the exact selected canonical Dossier, derives the same persistent `gapKey` identities as the Research Gap worker, and queries only safe lifecycle columns for those keys. Hybrid renders operational status only; analytical reasoning continues to come exclusively from the canonical Dossier/Story/Regime projection.

**Tech Stack:** TypeScript, Node test runner, Next.js server components, Supabase JS, existing Dossier V2 persistence/presentation readers, existing Research Gap lifecycle and identity helpers.

**Spec:** `docs/superpowers/specs/2026-10-05-b3-research-gap-hybrid-propagation-design.md`

## Global Constraints

- The Dossier remains the only System 2 analytical authority surfaced by Hybrid.
- Motion remains non-evidentiary.
- New Research Gap work may come only from current canonical Dossier `research_gaps`, `research_now`, and `investigations`.
- New direct `market_motion` Research Gap candidates must not be produced.
- Historical `market_motion` Research Gap cases must remain readable, claimable, researchable, and handoff-capable.
- Existing `research-gap-work-queue/1` remains the queue contract version.
- New queues must emit `sourceCounts.marketMotion = 0`.
- Hybrid joins Research Gap lifecycle by exact persistent `gapKey` only.
- Hybrid may expose only lifecycle status: `NEW`, `QUEUED`, `CLAIMED`, `RESEARCHING`, `COMPLETED`, `HANDED_OFF`, `CLOSED`.
- Hybrid must not load or expose `research_outcome`, `verdict`, `research_plan`, findings, confidence, live implication, or research-result next tests.
- The Hybrid status adapter must not reuse `listResearchGapCases(...)` or `ResearchGapCaseRow`.
- `COMPLETED` means research complete / canonical handoff pending.
- `HANDED_OFF` means returned to canonical research; it does not mean the current Dossier incorporated the result.
- Hybrid reasoning projection remains Dossier/Story/Regime-derived only.
- B3 must not trigger Dossier V2 after Research Gap handoff.
- No new database table, migration, queue, RPC, reasoning engine, Story path, Regime write, or A2/A3 change.

## Review Focus

- A promoted Motion has an identical next-test string to a Dossier Investigation: the raw Motion must still be unable to create a Research Gap candidate by itself.
- A lifecycle row has the same Investigation/Story links but a different `gap_key`: Hybrid must not display it.
- A lifecycle row is `HANDED_OFF` with `research_outcome="CONTRADICTING"`: Hybrid may show only HANDED_OFF and the unchanged canonical Dossier conclusion.
- The selected Hybrid Dossier is a fallback/older exact Dossier rather than the latest database row: status must be derived from the exact selected Dossier ID, not whatever is newest.
- A historical `market_motion` lifecycle case already exists: B3 must not make lifecycle claim/research/handoff code reject it.

---

## File Structure and Responsibilities

- `lib/research-gap-worker.ts`
  - Own Dossier-derived Research Gap candidate construction.
  - Stop reading/producing new Market Motion candidates.
  - Preserve source-kind/type compatibility for historical `market_motion` records.

- `tests/research-gap-worker.test.ts`
  - Pin the bypass removal, exact Dossier authority, and no Motion database read.

- `lib/hybrid-research-gap-status.ts` (new)
  - Load the exact selected canonical Dossier by ID.
  - Derive B3-authoritative candidate `gapKey` values using the same Research Gap worker.
  - Query `research_gap_cases` with a narrow safe column selection.
  - Return lifecycle status only.

- `tests/hybrid-research-gap-status.test.ts` (new)
  - Pin exact-key matching, safe select columns, selected-Dossier identity, and status-only projection.

- `app/hybrid-output/page.tsx`
  - Remove raw Motion “Research Gap eligible” semantics.
  - Load status projection for `selection.selectedDossierId`.
  - Render bounded operational lifecycle status without changing analytical reasoning.

- `tests/hybrid-reasoning-boundary.test.ts`
  - Pin the reasoning firewall and page wiring.

- `tests/research-gap-execution.test.ts`
  - Pin that canonical handoff still does not invoke Dossier V2 and historical source kind is not rejected.

- `docs/RESEARCH_GAP_WORKER.md`
- `docs/RESEARCH_GAP_LIFECYCLE.md`
- `docs/MACRO_PULSE_MOTION_BRIDGE.md`
  - Update the post-B3 authority/status boundaries.

---

### Task 1: Retire direct Motion → Research Gap production

**Files:**
- Modify: `lib/research-gap-worker.ts`
- Modify: `tests/research-gap-worker.test.ts`

**Interfaces:**
- Keep:
  ```ts
  export type ResearchGapWorkSource =
    | "research_gap"
    | "research_now"
    | "investigation"
    | "market_motion";
  ```
  for historical compatibility.
- Change new queue production so only the first three source kinds can be emitted.
- Keep:
  ```ts
  export function buildResearchGapWorkQueue(
    dossier: MarketDossierV2,
    now?: Date,
    motionRows?: MarketMotionRecord[],
  ): ResearchGapWorkQueue
  ```
  during B3 for source compatibility if needed, but the third argument must be ignored/deprecated and unable to produce candidates. A later cleanup may remove it after all callers/fixtures are migrated.
- Keep `sourceCounts.marketMotion` but always emit `0` for new queues.

- [ ] **Step 1: Rewrite the direct-Motion worker test to RED**

Replace the existing “fresh promoted Motion opens one traceable research candidate” expectation with:

```ts
test("B3 raw promoted Motion cannot create Research Gap work outside the Dossier", () => {
  const queue = buildResearchGapWorkQueue(dossier(), NOW, [motion()]);
  assert.equal(queue.sourceCounts.marketMotion, 0);
  assert.equal(queue.candidates.some((item) => item.sourceKind === "market_motion"), false);
  assert.deepEqual(queue.candidates.map((item) => item.sourceKind), [
    "research_gap",
    "research_now",
    "investigation",
  ]);
});
```

Add an explicit same-next-test collision fixture: raw Motion and a Dossier Investigation use the same text; assert only the Dossier Investigation candidate exists.

- [ ] **Step 2: Rewrite the loader test to RED**

Change the loader mock so `fakeClient.from("current_market_motion_items")` throws.

Assert:
- `loadLatestResearchGapWorkQueue(...)` succeeds;
- only `market_dossiers_v2` is queried;
- `sourceCounts.marketMotion === 0`.

- [ ] **Step 3: Run RED**

Run:

`node --test --experimental-strip-types tests/research-gap-worker.test.ts`

Expected: FAIL because `buildResearchGapWorkQueue(...)` still emits Motion candidates and the loader still queries `current_market_motion_items`.

- [ ] **Step 4: Remove the active Motion producer**

In `lib/research-gap-worker.ts`:
- stop calling `marketMotionCandidates(...)`;
- remove the runtime Motion query from `loadLatestResearchGapWorkQueue(...)`;
- remove imports used only by active Motion candidate generation;
- keep `ResearchGapWorkSource = ... | "market_motion"`;
- keep legacy optional Motion-native fields on the work candidate type if needed for snapshot compatibility;
- emit `sourceCounts.marketMotion: 0`;
- update diagnostics to state that new work is Dossier-derived only.

Do not change `persistentResearchGapKey(...)` formulas for Dossier-native sources.

- [ ] **Step 5: Add B2-authority regression**

Add:

```ts
test("B3 Dossier Investigation and Research Now remain Research Gap sources", ...)
```

Assert:
- exact Investigation ID survives;
- exact Research Now stable key survives;
- raw Motion is irrelevant to the result.

- [ ] **Step 6: Run GREEN**

Run:

`node --test --experimental-strip-types tests/research-gap-worker.test.ts`

Expected: PASS.

- [ ] **Step 7: Run prioritiser compatibility**

Run:

`node --test --experimental-strip-types tests/research-gap-prioritizer.test.ts tests/research-gap-worker.test.ts`

Expected: PASS. Existing historical `market_motion` scoring/type fixtures may remain valid.

- [ ] **Step 8: Commit**

Commit message:

`Remove direct Motion Research Gap production`

---

### Task 2: Add a narrow exact-key Hybrid lifecycle adapter

**Files:**
- Create: `lib/hybrid-research-gap-status.ts`
- Create: `tests/hybrid-research-gap-status.test.ts`

**Interfaces:**

Create:

```ts
export type HybridResearchGapStatusItem = {
  gapKey: string;
  sourceKind: "research_gap" | "research_now" | "investigation";
  sourceRef: string;
  lifecycleStatus: ResearchGapCaseStatus;
  linkedInvestigationIds: string[];
  linkedStoryIds: string[];
  latestDossierId: string;
  latestDossierAsOf: string;
  updatedAt: string;
};

export type HybridResearchGapStatusProjection = {
  dossierId: string;
  dossierAsOf: string;
  items: HybridResearchGapStatusItem[];
  counts: Partial<Record<ResearchGapCaseStatus, number>>;
};

export async function loadHybridResearchGapStatus(
  dossierId: string,
  client?: SupabaseClient,
): Promise<HybridResearchGapStatusProjection | null>;
```

Use `getMarketDossierV2ById(dossierId, client)` to load the exact selected Dossier. Use `buildResearchGapWorkQueue(dossier)` to derive the same B3-authoritative `gapKey` identities.

Approved safe database selection is exactly:

```text
gap_key,status,source_kind,source_ref,linked_investigation_ids,linked_story_ids,latest_dossier_id,latest_dossier_as_of,updated_at
```

Do not import `ResearchGapCaseRow` or call `listResearchGapCases(...)`.

- [ ] **Step 1: Write RED tests for exact selected-Dossier identity**

Create a fake client with:
- exact Dossier A requested by `dossierId`;
- a newer unrelated Dossier B available elsewhere;
- lifecycle rows for candidate keys from both.

Assert `loadHybridResearchGapStatus(A)` uses only A's derived keys and never substitutes B.

- [ ] **Step 2: Write RED query-firewall test**

Capture the `.select(...)` string for `research_gap_cases`.

Assert it equals the approved safe column string and does **not** contain:

```text
research_outcome
verdict
research_plan
confidence
finding
live_implication
```

Also assert the module source does not import `ResearchGapCaseRow` or `listResearchGapCases`.

- [ ] **Step 3: Write RED exact-key matching tests**

Provide:
- one exact matching `gap_key`;
- one row with identical Story/Investigation links but a different `gap_key`;
- one historical `market_motion` row.

Assert only the exact current-Dossier Dossier-native row appears.

- [ ] **Step 4: Write RED status projection tests**

Prove:
- `COMPLETED` projects only `lifecycleStatus: "COMPLETED"`;
- `HANDED_OFF` projects only `lifecycleStatus: "HANDED_OFF"`;
- result type/object has no `researchOutcome`, `verdict`, `finding`, or `confidence` property;
- missing lifecycle rows produce no invented item/status.

- [ ] **Step 5: Run RED**

Run:

`node --test --experimental-strip-types tests/hybrid-research-gap-status.test.ts`

Expected: FAIL because the adapter does not exist.

- [ ] **Step 6: Implement the adapter**

Implementation rules:
1. clean/validate non-empty `dossierId`;
2. load exact Dossier via `getMarketDossierV2ById`;
3. return null if absent;
4. derive `buildResearchGapWorkQueue(dossier).candidates`;
5. retain only source kinds `research_gap | research_now | investigation`;
6. if no candidate keys, return projection with `items: []` without querying lifecycle rows;
7. query `research_gap_cases` using the exact safe select and `.in("gap_key", exactKeys)`;
8. map lifecycle rows by exact `gap_key`;
9. emit items in Dossier candidate order, omitting unmatched rows;
10. build counts from emitted lifecycle statuses only.

No fuzzy fallback.

- [ ] **Step 7: Run GREEN**

Run:

`node --test --experimental-strip-types tests/hybrid-research-gap-status.test.ts tests/research-gap-worker.test.ts`

Expected: PASS.

- [ ] **Step 8: Commit**

Commit message:

`Add safe Hybrid Research Gap lifecycle projection`

---

### Task 3: Wire status-only lifecycle into Hybrid and retire direct Motion eligibility UI

**Files:**
- Modify: `app/hybrid-output/page.tsx`
- Modify: `tests/hybrid-reasoning-boundary.test.ts`
- Test: `tests/hybrid-research-gap-status.test.ts`

**Interfaces:**
- Consume `loadHybridResearchGapStatus(selection.selectedDossierId)`.
- Do not pass lifecycle data to `buildHybridReasoningProjection(...)`.
- Do not call `marketMotionInvestigationEligibility(...)` from Hybrid Output after B3.

- [ ] **Step 1: Write RED page-boundary assertions**

In `tests/hybrid-reasoning-boundary.test.ts`, assert:
- page imports/calls `loadHybridResearchGapStatus`;
- page does not import/call `marketMotionInvestigationEligibility`;
- page does not contain “operational Research Gap worker uses the same eligibility gate”;
- page does not contain outcome labels `CONFIRMING`, `CONTRADICTING`, or `NO_CHANGE` as Research Gap lifecycle rendering logic;
- `buildHybridReasoningProjection(...)` call remains independent of Research Gap status data.

- [ ] **Step 2: Add RED lifecycle wording assertions**

Assert page/source contains operational wording equivalent to:
- COMPLETED → `Research complete; canonical handoff pending`;
- HANDED_OFF → `Returned to canonical research; current Dossier remains authoritative`.

Assert it does not say HANDED_OFF means incorporated/updated Dossier.

- [ ] **Step 3: Run RED**

Run:

`node --test --experimental-strip-types tests/hybrid-reasoning-boundary.test.ts`

Expected: FAIL because current page still uses raw Motion investigation eligibility and has no lifecycle projection.

- [ ] **Step 4: Wire the safe status loader**

In `app/hybrid-output/page.tsx`:
- after `getDossierV2PresentationSelection()`, use the exact `selection.selectedDossierId`;
- load lifecycle status only when that ID exists;
- do not use `latestDossierId` as a substitute;
- keep page rendering fail-safe: a status-loader error should result in no lifecycle status panel rather than changing canonical Dossier rendering.

Preferred implementation: a small local `try/catch` helper or safe exported loader wrapper; do not weaken the status adapter query contract.

- [ ] **Step 5: Remove direct Motion eligibility semantics**

From Hybrid Output:
- remove `marketMotionInvestigationEligibility` import/call;
- remove `investigationEligible`, `investigationReason`, and direct Research Gap eligibility badge/href from the Motion journey mapping unless another component contract requires a neutral replacement;
- keep Motion headline/context/next-test display;
- rewrite the Motion path copy to say Motion is discovery context and operational Research Gap work begins only from canonical Dossier research/investigation outputs;
- do not add a fuzzy Motion→Research Gap status link.

- [ ] **Step 6: Render bounded lifecycle status**

In the existing “Current handoff status” area:
- show counts/items from `HybridResearchGapStatusProjection`;
- badge existing lifecycle state;
- for COMPLETED show “Research complete; canonical handoff pending”;
- for HANDED_OFF show “Returned to canonical research; current Dossier remains authoritative”;
- show no analytical outcome text.

Keep the list bounded by the adapter's Dossier candidate count; do not load all lifecycle cases.

- [ ] **Step 7: Run GREEN**

Run:

`node --test --experimental-strip-types tests/hybrid-reasoning-boundary.test.ts tests/hybrid-research-gap-status.test.ts`

Expected: PASS.

- [ ] **Step 8: Run Hybrid-related regressions**

Run:

`node --test --experimental-strip-types tests/hybrid-*.test.ts tests/market-motion-edition-publication.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit**

Commit message:

`Show status-only Research Gap lifecycle in Hybrid`

---

### Task 4: Lock handoff semantics, historical compatibility, docs, and whole-branch verification

**Files:**
- Modify: `tests/research-gap-execution.test.ts`
- Modify: `docs/RESEARCH_GAP_WORKER.md`
- Modify: `docs/RESEARCH_GAP_LIFECYCLE.md`
- Modify: `docs/MACRO_PULSE_MOTION_BRIDGE.md`
- Modify other tests only for verified review defects.

**Interfaces:**
- Existing Research Gap handoff remains unchanged.
- Existing lifecycle APIs continue accepting historical source kinds because lifecycle operations are case-ID/status based, not source-kind gated.

- [ ] **Step 1: Add handoff no-Dossier-trigger regression**

In `tests/research-gap-execution.test.ts`, inspect:
- `lib/research-gap-auto-handoff.ts`;
- `lib/research-gap-manual-handoff-run.ts`;
- `.github/workflows/run-live-research.yml`.

Assert:
- canonical handoff still targets research update;
- handoff code does not import/call `runManualDossierV2`, Dossier V2 admin route, or a Dossier persist trigger;
- scheduled `research_gap_cycle` ends after exact handoff and does not invoke `dossier_v2_persist` within the cycle block.

- [ ] **Step 2: Add historical market_motion lifecycle compatibility regression**

Add a focused source/behavior test proving:
- `ResearchGapWorkSource` still includes `market_motion`;
- lifecycle claim/start/complete/handoff functions do not branch/reject on `source_kind === "market_motion"`;
- no B3 migration/rewrite path is present.

This may be source-level if lifecycle RPC wrappers never receive source kind.

- [ ] **Step 3: Update documentation**

Document:
- new work source authority = Dossier only;
- raw Motion can no longer create Research Gap work directly;
- historical Motion cases continue;
- lifecycle status is operational only;
- Hybrid never reads Research Gap outcomes/verdicts;
- HANDED_OFF does not mean Dossier incorporated;
- next Dossier run remains the analytical incorporation point.

- [ ] **Step 4: Confirm all Review Focus cases have explicit tests**

Check the five Review Focus lines above. Add the smallest missing regression before final verification.

- [ ] **Step 5: Run full repository verification**

Run:
- `npm test`
- `npm run test:task-c`
- `npx tsc --noEmit`
- `npx next build`

Expected: all PASS.

- [ ] **Step 6: Verify database contracts**

Run the existing repository database-contract workflow/check.

Expected: PASS with no migration.

- [ ] **Step 7: Whole-branch review against B3 spec**

Review specifically for:
- any remaining active `current_market_motion_items → Research Gap` path;
- any Hybrid load of `research_outcome`, verdict, plan, finding or confidence;
- any non-exact lifecycle join;
- any Research Gap status changing Hybrid analytical reasoning;
- any `HANDED_OFF` wording that implies Dossier incorporation;
- any automatic Dossier V2 trigger added after handoff;
- any historical `market_motion` lifecycle incompatibility;
- any new schema/queue/reasoning path.

Any Critical/Important finding requires a reproducing RED test before repair.

- [ ] **Step 8: Commit documentation/review fixes**

Docs-only commit:

`docs: document B3 Research Gap and Hybrid boundary`

Use a separate commit for any verified defect repair.

- [ ] **Step 9: Open B3 implementation PR**

PR description must state:
- Research Gap new-work authority is Dossier-only;
- direct Motion producer is removed;
- historical Motion cases remain compatible;
- Hybrid loads exact-key lifecycle status only;
- Hybrid does not load outcomes/verdicts/research findings;
- Hybrid reasoning remains Dossier-only;
- handoff does not trigger Dossier V2;
- no migration/new queue/reasoning engine.
