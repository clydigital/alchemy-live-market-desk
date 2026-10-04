# B2 Regime / Investigation Motion Acceptance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let canonically corroborated Motion without a persistent Story enter Dossier System 2 through explicit STORY / REGIME / INVESTIGATION_CANDIDATE routing classes, while preserving the evidence firewall and preventing orphan Motion from guessing Stories.

**Architecture:** Extend the existing B1 promotion selector with a pure Motion-domain routing-class helper and policy v2, then expose that class in bounded Dossier Motion context. Research Brain validation becomes routing-aware: Story-linked Motion keeps existing behavior, Regime-only Motion may target the current Regime or an Investigation, and Investigation candidates must target an Investigation. Existing A3 Regime→Story propagation is reused unchanged; investigation-only acceptance deliberately queues no Story work.

**Tech Stack:** TypeScript, Node test runner, existing Market Motion append-only persistence, Dossier V2 contracts/validation, Supabase-backed A3 reevaluation planner.

**Spec:** `docs/superpowers/specs/2026-10-05-b2-regime-investigation-motion-acceptance-design.md`

## Global Constraints

- Motion remains non-evidentiary.
- Exact eligible canonical Evidence remains mandatory for Motion promotion.
- ACCEPT / REFINE still require canonical Evidence.
- New promotions use policy exactly `canonical-evidence-corroborated/v2`.
- Routing classes are exactly `STORY`, `REGIME`, `INVESTIGATION_CANDIDATE`.
- `STORY` wins when both Story and Regime identities are present.
- `REGIME` requires no Story and an existing `primary_regime_slug`.
- `INVESTIGATION_CANDIDATE` requires no Story, no Regime, and `isConcreteMarketMotionNextTest(...)=true`.
- The two known generic fallback next-test strings are not concrete.
- Global Motion promotion cap remains 6.
- Dossier Motion context cap remains 3.
- Story-linked B1 behavior remains unchanged.
- Regime-only Motion may not route directly to Story, Thesis or Main Thread.
- Investigation candidates may not route directly to Story, Regime, Thesis or Main Thread.
- `RESEARCH_NOW` alone is insufficient for orphan Motion ACCEPT / REFINE.
- No fuzzy Story/Regime lookup is introduced.
- No direct Regime mutation is introduced.
- No new persistent Investigation store is introduced.
- No new table, migration, RPC, queue or reasoning engine is introduced.
- B3 Research Gap / Hybrid propagation remains out of scope.

## Review Focus

- A historical B1 promoted Motion has no explicit routing metadata but still has a Story ID: it must remain readable and behave as `STORY`.
- A promoted Motion has no Story/Regime and only the generic “Seek independent…” fallback next test: it must not enter Dossier as an Investigation candidate.
- A Regime-only Motion ACCEPT cites `RESEARCH_NOW` but no Regime/Investigation destination: validation must reject it.
- An Investigation-candidate Motion ACCEPT references a nonexistent Investigation ID: validation must reject it even when canonical Evidence is valid.
- A Regime-only ACCEPT to `REGIME:CURRENT` reaches A3 via existing Regime→Story links, while an Investigation-only ACCEPT queues no Story work.

---

## File Structure and Responsibilities

- `lib/market-motion.ts`
  - Own pure routing-class derivation.
  - Own exact generic-fallback next-test exclusion.

- `lib/market-motion-promotion.ts`
  - Reuse B1 exact canonical-Evidence matching.
  - Promote all valid routing classes under policy v2.
  - Persist routing class in promotion metadata.
  - Keep historical promoted rows readable.

- `lib/dossier-v2/input-packet.ts`
  - Add optional `routing_class` to immutable Motion context items for historical compatibility.

- `lib/dossier-v2/motion-context.ts`
  - Admit any fresh PROMOTED Motion with a valid routing class.
  - Emit the routing class explicitly for newly built packets.

- `lib/dossier-v2/research-brain-prompt.ts`
  - Tell System 2 the routing-class destination rules.

- `lib/dossier-v2/research-brain-validation.ts`
  - Enforce routing-specific destination allowlists and minimum destination requirements.

- `lib/dossier-v2/reevaluation-propagation.ts`
  - Expected to need no architecture change; only adjust if tests reveal a real gap.

- Tests:
  - `tests/market-motion-promotion.test.ts`
  - `tests/dossier-motion-context.test.ts`
  - `tests/research-brain.test.ts`
  - `tests/dossier-reevaluation-propagation.test.ts`

- `docs/MACRO_PULSE_MOTION_BRIDGE.md`
  - Update B2 boundary wording after code is green.

---

### Task 1: Routing-class derivation and B2 promotion

**Files:**
- Modify: `lib/market-motion.ts`
- Modify: `lib/market-motion-promotion.ts`
- Modify: `tests/market-motion-promotion.test.ts`

**Interfaces:**

Produce in `lib/market-motion.ts`:

```ts
export type MarketMotionRoutingClass =
  | "STORY"
  | "REGIME"
  | "INVESTIGATION_CANDIDATE";

export function isConcreteMarketMotionNextTest(
  value: string | null | undefined,
): boolean;

export function deriveMarketMotionRoutingClass(input: {
  primaryStoryId?: string | null;
  primaryRegimeSlug?: string | null;
  nextTest?: string | null;
}): MarketMotionRoutingClass | null;
```

B2 promotion candidate adds:

```ts
routingClass: MarketMotionRoutingClass;
```

New promotion policy:

```ts
MARKET_MOTION_PROMOTION_POLICY = "canonical-evidence-corroborated/v2"
```

- [ ] **Step 1: Write RED tests for pure routing-class derivation**

Add tests proving:

```ts
test("B2 routing class prefers STORY over REGIME", ...)
test("B2 routing class admits REGIME without a Story", ...)
test("B2 routing class admits concrete Investigation candidates", ...)
test("B2 routing class rejects blank and generic fallback next tests", ...)
```

Assert the two generic fallback strings return false from `isConcreteMarketMotionNextTest(...)`.

- [ ] **Step 2: Run RED**

Run:

`node --test --experimental-strip-types tests/market-motion-promotion.test.ts`

Expected: FAIL because routing helpers do not exist.

- [ ] **Step 3: Implement the pure Motion-domain helpers**

Implement the exact signatures above.

Rules:
1. non-empty Story → `STORY`;
2. else non-empty Regime → `REGIME`;
3. else concrete next test → `INVESTIGATION_CANDIDATE`;
4. else null.

Generic fallback comparisons are trim + case normalised against exactly:

```text
Check whether the linked assets and broader Story / Regime reaction confirm the information.

Seek independent or primary-source confirmation, then test whether the market reaction persists.
```

No semantic scoring or prose inference.

- [ ] **Step 4: Extend promotion tests to RED for Regime and Investigation candidates**

Add:

```ts
test("B2 promotes canonically corroborated Regime-only Motion", ...)
test("B2 promotes canonically corroborated Investigation-candidate Motion", ...)
test("B2 keeps exact Evidence firewall for orphan Motion", ...)
test("B2 v2 promotion persists explicit routing class", ...)
```

Keep existing B1 Evidence firewall tests unchanged.

- [ ] **Step 5: Run RED**

Expected: Regime/investigation tests FAIL because `selectPromotableMarketMotion(...)` still requires `primary_story_id`.

- [ ] **Step 6: Update the promotion selector and input builder**

In `selectPromotableMarketMotion(...)`:
- remove the Story-only filter;
- derive routing class for each Motion;
- reject null routing class;
- carry `routingClass` on the candidate;
- retain every existing B1 Evidence, status, freshness, materiality, relevance, ranking and cap rule.

In `marketMotionPromotionInput(...)`:
- remove the Story-required throw;
- retain exact selected Evidence identity requirement;
- persist `promotionRoutingClass`;
- use policy v2;
- preserve Story/Regime fields as-is;
- promotion reason must describe the routing class without claiming a Story/Regime conclusion.

- [ ] **Step 7: Historical compatibility test**

Add a test proving an already-promoted historical B1 row with:
- no `promotionRoutingClass` metadata;
- valid `primary_story_id`;

is still classified/selectable as `STORY` through structural fallback.

- [ ] **Step 8: Run GREEN**

Run:

`node --test --experimental-strip-types tests/market-motion-promotion.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit**

Commit message:

`Add B2 Motion routing classes and promotion`

---

### Task 2: Admit all valid routing classes into bounded Dossier context

**Files:**
- Modify: `lib/dossier-v2/input-packet.ts`
- Modify: `lib/dossier-v2/motion-context.ts`
- Modify: `tests/dossier-motion-context.test.ts`

**Interfaces:**

Extend:

```ts
export interface DossierMotionContextItem {
  ...
  routing_class?: MarketMotionRoutingClass;
}
```

The property stays optional for immutable historical packet compatibility.

- [ ] **Step 1: Write RED Dossier-context tests**

Add tests proving:

```ts
test("B2 Dossier context admits Story Regime and Investigation-candidate promoted Motion", ...)
test("B2 Dossier context emits routing_class on new bounded items", ...)
test("B2 Dossier context excludes promoted Motion with no valid routing class", ...)
test("B2 Dossier context excludes generic-fallback Investigation candidates", ...)
```

Use three rows:
- Story-linked promoted Motion;
- Regime-only promoted Motion;
- no Story/Regime with a concrete next test.

Also retain chronology and max-3 assertions.

- [ ] **Step 2: Run RED**

Run:

`node --test --experimental-strip-types tests/dossier-motion-context.test.ts`

Expected: FAIL because Dossier selector still filters to exact Story-linked Motion and no `routing_class` exists.

- [ ] **Step 3: Update the Dossier selector**

Change `selectPromotedMarketMotionForDossier(...)` / its underlying selector so eligibility is:

```text
fresh effective PROMOTED + deriveMarketMotionRoutingClass(...) != null
```

Do not change ranking or limit behavior.

Historical B1 rows derive their routing class structurally.

- [ ] **Step 4: Extend bounded Motion packet shape**

In `input-packet.ts`:
- import/type-share `MarketMotionRoutingClass`;
- add optional `routing_class`.

In `boundedMotionItem(...)`:
- derive and emit `routing_class` for every newly admitted item.

Do not change `dossier-motion-context/1`.

- [ ] **Step 5: Run GREEN**

Run:

`node --test --experimental-strip-types tests/dossier-motion-context.test.ts tests/market-motion-promotion.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

Commit message:

`Admit B2 Motion routing classes to Dossier context`

---

### Task 3: Routing-aware Research Brain prompt and validation

**Files:**
- Modify: `lib/dossier-v2/research-brain-prompt.ts`
- Modify: `lib/dossier-v2/research-brain-validation.ts`
- Modify: `tests/research-brain.test.ts`

**Interfaces:**

Add one validation helper, local or exported for direct testing:

```ts
function motionRoutingClass(item: DossierMotionContextItem): MarketMotionRoutingClass | null
```

Behavior:
- use explicit `routing_class` when valid;
- otherwise derive structurally for historical packets.

No new output contract fields are required.

- [ ] **Step 1: Write RED validation tests for REGIME Motion**

Create a valid packet/output fixture with a Regime-only Motion.

Prove:
- ACCEPT + `REGIME:CURRENT` valid;
- ACCEPT + `INVESTIGATION:<existing-id>` valid;
- either plus `RESEARCH_NOW` valid;
- `RESEARCH_NOW` alone invalid;
- `STORY:<id>`, `THESIS:<id>`, `MAIN_THREAD` invalid;
- missing canonical Evidence remains invalid.

- [ ] **Step 2: Write RED validation tests for INVESTIGATION_CANDIDATE**

Prove:
- ACCEPT/REFINE + valid `INVESTIGATION:<existing-id>` valid;
- Investigation + `RESEARCH_NOW` valid;
- `RESEARCH_NOW` alone invalid;
- nonexistent Investigation invalid;
- `REGIME:CURRENT`, `STORY:<id>`, `THESIS:<id>`, `MAIN_THREAD` invalid;
- canonical Evidence remains mandatory.

- [ ] **Step 3: Write RED UNRESOLVED / REJECT tests**

Prove:
- UNRESOLVED with no destinations remains valid;
- UNRESOLVED with a disallowed routing-class destination is invalid;
- REJECT still requires empty destinations.

- [ ] **Step 4: Run RED**

Run:

`node --test --experimental-strip-types tests/research-brain.test.ts`

Expected: FAIL because current validation uses one global destination set and no routing-class policy.

- [ ] **Step 5: Implement routing-aware destination validation**

Keep global destination existence validation first.

Then apply class rules:

For `STORY`:
- existing A2 behavior unchanged.

For `REGIME`:
- allowed: `REGIME:CURRENT`, `INVESTIGATION:<id>`, `RESEARCH_NOW`;
- ACCEPT / REFINE require at least one Regime or Investigation destination;
- reject Story / Thesis / Main Thread.

For `INVESTIGATION_CANDIDATE`:
- allowed: `INVESTIGATION:<id>`, `RESEARCH_NOW`;
- ACCEPT / REFINE require at least one Investigation destination;
- reject Regime / Story / Thesis / Main Thread.

For every class:
- routing allowlists also apply to non-empty UNRESOLVED destinations;
- REJECT remains empty.

If routing class cannot be established, fail closed.

- [ ] **Step 6: Update Research Brain instructions**

Extend the Motion acceptance boundary with the exact three routing classes and destination rules.

Prompt wording must explicitly state:
- Motion routing class is structural context, not evidence;
- orphan Motion may not invent a Story;
- Research Now alone cannot satisfy orphan ACCEPT / REFINE;
- Investigation candidates must reference an Investigation emitted in the same output.

- [ ] **Step 7: Prompt regression test**

Add a test asserting `buildResearchBrainPrompt(...)` includes:
- `STORY`;
- `REGIME`;
- `INVESTIGATION_CANDIDATE`;
- the prohibition on direct Story routing for orphan Motion.

- [ ] **Step 8: Run GREEN**

Run:

`node --test --experimental-strip-types tests/research-brain.test.ts tests/dossier-motion-context.test.ts tests/market-motion-promotion.test.ts`

Expected: PASS.

- [ ] **Step 9: Commit**

Commit message:

`Enforce B2 Motion destination rules in System 2`

---

### Task 4: Prove A3 boundary and preserve one-way propagation

**Files:**
- Modify: `tests/dossier-reevaluation-propagation.test.ts`
- Modify: `lib/dossier-v2/reevaluation-propagation.ts` only if a failing test proves a real implementation gap.

**Interfaces:**
- Reuse existing `buildDossierReevaluationPropagationPlan(...)`.
- No new queue or persistence API.

- [ ] **Step 1: Add Regime-only propagation regression**

Create a packet Motion with:
- `primary_story_id = null`;
- valid `primary_regime_slug`;
- routing class `REGIME`;
- ACCEPT decision to `REGIME:CURRENT`;
- queueable canonical Evidence.

Provide existing Regime→Story links.

Assert:
- plan contains existing linked Story targets;
- route kinds remain `regime_core` / `regime_bridge`;
- canonical Evidence UUID is the queue justification.

- [ ] **Step 2: Add Regime-to-Investigation-only no-queue regression**

Same Regime Motion, but destination refs contain only `INVESTIGATION:<id>`.

Assert:
- propagation plan contains no Story queue items.

- [ ] **Step 3: Add Investigation-candidate no-queue regression**

Motion:
- no Story;
- no Regime;
- routing class `INVESTIGATION_CANDIDATE`;
- ACCEPT to `INVESTIGATION:<id>`.

Assert:
- no Story propagation candidates;
- no fuzzy substitute Story warning/route is manufactured.

- [ ] **Step 4: Run tests**

Run:

`node --test --experimental-strip-types tests/dossier-reevaluation-propagation.test.ts`

Expected: PASS without production changes if A3 already satisfies B2.

If a test fails, add the smallest correction only; do not add a new propagation path.

- [ ] **Step 5: Re-run A2/A3 regression set**

Run:

`node --test --experimental-strip-types tests/research-brain.test.ts tests/dossier-reevaluation-propagation.test.ts tests/dossier-v2-execution.test.ts`

Expected: PASS.

- [ ] **Step 6: Commit**

If tests only:

`test: lock B2 A3 propagation boundaries`

If a minimal A3 repair is genuinely needed, use a separate fix commit after the RED regression.

---

### Task 5: Documentation and whole-branch verification

**Files:**
- Modify: `docs/MACRO_PULSE_MOTION_BRIDGE.md`
- Modify tests only for verified review defects.

- [ ] **Step 1: Update the Motion bridge**

Document the post-B2 flow:

```text
exact eligible canonical Evidence
→ PROMOTED Motion
→ STORY / REGIME / INVESTIGATION_CANDIDATE
→ Dossier System 2
```

State explicitly:
- Story-linked behavior is unchanged;
- Regime-only acceptance may use existing Regime→Story links;
- Investigation candidates stay inside Dossier analytical state;
- B3 owns deliberate Research Gap / Hybrid propagation.

- [ ] **Step 2: Confirm all Review Focus cases are directly tested**

Verify the five Review Focus cases above each have an explicit regression test.

If any is missing, add the smallest test before final verification.

- [ ] **Step 3: Run full repository verification**

Run:

- `npm test`
- `npm run test:task-c`
- `npx tsc --noEmit`
- `npx next build`

Expected: all PASS.

- [ ] **Step 4: Verify database contracts**

Run the existing repository database-contract workflow/check.

Expected: PASS with no migration.

- [ ] **Step 5: Whole-branch review against the B2 spec**

Review specifically for:
- any fuzzy Story or Regime inference;
- any path where routing metadata is treated as Evidence;
- any orphan Motion direct Story/Thesis/Main Thread route;
- any Research Now-only orphan acceptance;
- any investigation-only Story queue mutation;
- any direct Regime persistence;
- any B3 scope leakage;
- historical B1 replay breakage.

Any Critical/Important finding requires a reproducing RED test before repair.

- [ ] **Step 6: Commit closeout changes**

Docs-only commit:

`docs: document B2 Motion routing and acceptance`

Use separate commits for any verified regression repair.

- [ ] **Step 7: Open the B2 implementation PR**

PR description must state:
- B1 exact canonical-Evidence firewall is preserved;
- STORY / REGIME / INVESTIGATION_CANDIDATE routing classes are explicit;
- Regime-only Motion can reach existing A3 Regime→Story propagation;
- Investigation-only acceptance deliberately creates no Story queue work;
- Research Now alone is not a valid orphan acceptance destination;
- no migration / new queue / direct Regime write / B3 change.
