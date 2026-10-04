# B1 Canonical-Evidence Motion Promotion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace Story-change-only Market Motion promotion with exact canonical-evidence corroboration while preserving Motion as non-evidentiary Dossier context.

**Architecture:** Keep promotion inside the existing Market Motion path. A pure selector matches fresh current Motion to canonical `EvidencePackItem` by exact origin item key, reusing `isCanonicalEligibleEvidence()` and `sourceVerificationWeight()`; the persistence adapter appends a `PROMOTED` Motion version carrying the canonical Evidence UUID. Runtime invokes this after canonical Evidence loading and before System 1/model early exits, while ingestion preserves any already-recorded promotion across later event merges.

**Tech Stack:** TypeScript, Node test runner, Supabase JS, existing Market Motion append-only RPC path, existing intelligence Evidence pack/source-verification rules.

**Spec:** `docs/superpowers/specs/2026-10-05-b1-canonical-evidence-motion-promotion-design.md`

## Global Constraints

- Motion remains non-evidentiary.
- Promotion policy is exactly `canonical-evidence-corroborated/v1`.
- B1 requires an exact `primary_story_id`.
- Promotion requires exact Motion-origin ↔ canonical-Evidence `itemKey` overlap.
- Reuse `isCanonicalEligibleEvidence()` and `sourceVerificationWeight()`; do not duplicate canonical source rules.
- Do not promote from Motion prose, `sourceRefs`, Story publication, Story confidence, Regime identity, ticker overlap, or fuzzy similarity.
- Preserve `MARKET_MOTION_PROMOTION_MIN_MATERIALITY = 80`.
- Preserve `MARKET_MOTION_PROMOTION_MIN_RELEVANCE = 75`.
- Preserve `MARKET_MOTION_PROMOTION_LIMIT = 6`.
- Add `MARKET_MOTION_PROMOTION_EVIDENCE_LIMIT = 8` for bounded corroboration audit metadata.
- LEAD / REPORTED / VERIFIED Motion may be promoted when exact eligible canonical Evidence exists.
- CONTRADICTED / UNRESOLVED / PARTIAL Motion may not be promoted in B1.
- Promotion does not upgrade the Motion verification state.
- Persist the selected canonical `intelligence_evidence.id` UUID into promoted Motion `evidence_id`.
- An already-promoted Motion must remain promoted across later event merges.
- Dry runs must never append promoted Motion versions.
- B1 does not add Regime-only or Investigation-only promotion; that remains B2.
- No new database table, migration, RPC, reasoning engine, Hybrid path, A2 contract, or A3 contract.

## Review Focus

- A current Motion has both creator and reporting origin keys, but only creator transcript Evidence is eligible by identity: it must remain unpromoted until an independently canonical-eligible origin key exists.
- An eligible canonical Evidence row shares the Story/asset/ticker but not the exact Motion origin item key: it must not promote the Motion.
- An already-promoted current Motion is merged with a stronger later reporting candidate: lifecycle, canonical evidence UUID, promotion reason, and promotion metadata must survive.
- Promotion persistence fails for one candidate after others are eligible: failure must be warning-isolated without preventing remaining candidates or failing the intelligence run.
- Runtime has no published Story and exits before model reasoning: valid evidence-backed Motion promotion must still run exactly once when not dry-run.

---

## File Structure and Responsibilities

- `lib/market-motion-promotion.ts`
  - Own exact canonical-evidence corroboration.
  - Own deterministic evidence selection/ranking.
  - Own promoted Motion input construction and append-only persistence.
  - Continue owning the Dossier selector for already-promoted Motion.

- `lib/market-motion-ingestion.ts`
  - Preserve prior promotion state/evidence pointer when later source candidates merge into the same Motion event identity.
  - Do not make new promotion decisions.

- `lib/intelligence/runtime.ts`
  - Invoke evidence-backed promotion after `loadEvidence(requiredEvidenceIds)`.
  - Remove the old published-Story-gated promotion call.
  - Keep promotion non-blocking and dry-run-safe.

- `tests/market-motion-promotion.test.ts`
  - Pin B1 eligibility, evidence firewall, deterministic ranking, persistence input, runtime call ordering, bounds, and failure isolation.

- `tests/market-motion-ingestion.test.ts`
  - Pin later-run corroboration identity merging and sticky-promotion preservation.

- `docs/MACRO_PULSE_MOTION_BRIDGE.md`
  - Replace Story-change promotion wording with exact canonical-evidence promotion wording.

---

### Task 1: Exact canonical-evidence promotion selector

**Files:**
- Modify: `lib/market-motion-promotion.ts`
- Modify: `tests/market-motion-promotion.test.ts`

**Interfaces:**
- Consumes:
  - `MarketMotionRecord[]`
  - `EvidencePackItem[]`
  - `Date`
  - `isCanonicalEligibleEvidence(item: EvidencePackItem): boolean`
  - `sourceVerificationWeight(item: EvidencePackItem): number`
- Produces:
  - `MARKET_MOTION_PROMOTION_POLICY = "canonical-evidence-corroborated/v1"`
  - `MARKET_MOTION_PROMOTION_EVIDENCE_LIMIT = 8`
  - `MarketMotionPromotionCandidate`
  - `selectPromotableMarketMotion(rows: MarketMotionRecord[], evidence: EvidencePackItem[], now?: Date): MarketMotionPromotionCandidate[]`
  - updated `marketMotionPromotionInput(candidate: MarketMotionPromotionCandidate, context: { researchRunId: string | null; engineRunId: string }): MarketMotionInput`

Define:

```ts
export type MarketMotionPromotionCandidate = {
  motion: MarketMotionRecord;
  selectedEvidence: EvidencePackItem;
  matchingEvidenceIds: string[];
  matchingOriginItemKeys: string[];
  evidenceWeight: number;
};
```

- [ ] **Step 1: Rewrite the existing promotion tests to RED against B1 semantics**

Add/replace tests proving:

```ts
test("B1 promotion requires exact eligible canonical Evidence, not Story publication", ...)
test("B1 allows LEAD Motion when independent eligible canonical Evidence matches exact origin item key", ...)
test("B1 blocks contradicted unresolved partial expired weak and no-Story Motion", ...)
test("B1 rejects transcript scheduled research-analysis and discovery-only Evidence", ...)
test("B1 rejects same Story Regime ticker or headline without exact origin item overlap", ...)
test("B1 chooses strongest canonical corroborator deterministically", ...)
test("B1 promotion remains capped at six Motion items", ...)
```

Fixtures must include:
- Motion `metadata.originItemKeys`;
- canonical Evidence `structuredPayload.itemKey`;
- at least one creator transcript Evidence and one independent reporting/official Evidence;
- multiple exact Evidence matches with different source weights.

Assertions:
- selector returns `MarketMotionPromotionCandidate`, not bare Motion rows;
- `selectedEvidence.id` is the exact expected canonical UUID;
- `matchingEvidenceIds` is deterministic and capped at 8;
- LEAD is allowed;
- Story-publication input is no longer part of the selector signature.

- [ ] **Step 2: Run RED**

Run:

`node --test --experimental-strip-types tests/market-motion-promotion.test.ts`

Expected: FAIL because the current selector still requires published Story IDs and returns bare Motion records.

- [ ] **Step 3: Implement origin-key extraction and exact Evidence matching**

In `lib/market-motion-promotion.ts` add private helpers:

```ts
function motionOriginItemKeys(item: MarketMotionRecord): string[]
function evidenceItemKey(item: EvidencePackItem): string | null
function eligibleCorroborators(item: MarketMotionRecord, evidence: EvidencePackItem[]): EvidencePackItem[]
```

Rules:
- Motion keys = unique strings from `metadata.originItemKeys` plus scalar `metadata.itemKey` when present.
- Evidence key = string `structuredPayload.itemKey` only.
- Match by exact string equality only.
- Evidence must pass `isCanonicalEligibleEvidence()`.
- Empty/missing keys fail closed.

- [ ] **Step 4: Implement the new selector**

Implement:

```ts
export function selectPromotableMarketMotion(
  rows: MarketMotionRecord[],
  evidence: EvidencePackItem[],
  now = new Date(),
): MarketMotionPromotionCandidate[]
```

Motion eligibility:
- current effective state not expired;
- lifecycle `MOTION`;
- exact `primary_story_id`;
- materiality >= 80;
- relevance >= 75;
- verification state in LEAD / REPORTED / VERIFIED.

Evidence ranking:
1. `sourceVerificationWeight`, descending;
2. `availableAt || eventAt`, newest first;
3. Evidence UUID ascending.

Motion ranking:
1. selected evidence weight, descending;
2. materiality descending;
3. relevance descending;
4. novelty descending;
5. occurred time descending;
6. Motion ID ascending.

Return at most six.

- [ ] **Step 5: Update promoted-input construction**

Implement:

```ts
export function marketMotionPromotionInput(
  candidate: MarketMotionPromotionCandidate,
  context: { researchRunId: string | null; engineRunId: string },
): MarketMotionInput
```

Required output:
- `lifecycleState: "PROMOTED"`;
- preserve Motion `verificationState`;
- preserve Story / Regime / expiry;
- `evidenceId = candidate.selectedEvidence.id`;
- evidence-based `promotionReason`;
- metadata:
  - `promotionPolicy: "canonical-evidence-corroborated/v1"`;
  - `promotedFromMotionId`;
  - `promotionEngineRunId`;
  - `promotionResearchRunId`;
  - `promotionEvidenceId`;
  - `promotionEvidenceItemKey`;
  - deterministic `promotionEvidenceIds`, capped at 8;
  - deterministic `promotionEvidenceItemKeys`, capped at 8.

Do not change Motion verification state.

- [ ] **Step 6: Run GREEN**

Run:

`node --test --experimental-strip-types tests/market-motion-promotion.test.ts`

Expected: PASS.

- [ ] **Step 7: Run the full test suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 8: Commit**

Commit message:

`Add canonical-evidence Motion promotion selector`

---

### Task 2: Later-run corroboration and sticky promotion

**Files:**
- Modify: `lib/market-motion-ingestion.ts`
- Modify: `tests/market-motion-ingestion.test.ts`

**Interfaces:**
- Consumes:
  - existing `unifyMarketMotionCandidates(candidates, options)`
  - existing prior-current-row merge through `recordAsInput(prior)`
- Produces:
  - merged event identity retaining all exact `originItemKeys`;
  - sticky preservation of `PROMOTED` lifecycle, canonical `evidenceId`, promotion reason, and promotion metadata.

- [ ] **Step 1: Write RED tests for later-run corroboration identity**

Add:

```ts
test("later independent reporting merges its origin key into an earlier creator Motion event", ...)
```

Build:
1. creator Anthropic Motion from run N;
2. independent reporting candidate from run N+1 that collapses to the same event key;
3. unify both.

Assert:
- one unified event;
- `originItemKeys` includes both exact item keys;
- stronger reporting source/verification context may become primary.

- [ ] **Step 2: Write RED tests for sticky promotion**

Add:

```ts
test("later event merge cannot demote an already PROMOTED Motion", ...)
```

Construct an already-promoted candidate with:
- `lifecycleState: "PROMOTED"`;
- canonical `evidenceId`;
- `promotionReason`;
- promotion metadata.

Merge with a later stronger reporting/official `MOTION` candidate for the same event.

Assert:
- lifecycle remains `PROMOTED`;
- prior canonical `evidenceId` remains;
- prior promotion reason remains;
- `promotionPolicy` and evidence metadata remain;
- source/verification context can still strengthen;
- origin keys continue merging.

- [ ] **Step 3: Run RED**

Run:

`node --test --experimental-strip-types tests/market-motion-ingestion.test.ts`

Expected: sticky-promotion test FAIL because current `mergeCandidatePair(...)` inherits lifecycle/evidence from the stronger primary candidate.

- [ ] **Step 4: Implement sticky merge preservation**

In `mergeCandidatePair(...)`:
- after selecting primary/secondary, detect whether either input is already `PROMOTED`;
- choose the promoted side as the preservation source for:
  - `lifecycleState`;
  - `evidenceId`;
  - `promotionReason`;
  - promotion metadata keys.
- Continue using existing stronger-source logic for ordinary source/verification/content fields.
- Do not manufacture a new promotion when neither input is promoted.
- Do not revive expired state; persistence/current-state expiry continues to control effective state.

- [ ] **Step 5: Run GREEN**

Run:

`node --test --experimental-strip-types tests/market-motion-ingestion.test.ts`

Expected: PASS.

- [ ] **Step 6: Run Task 1 + Task 2 tests together**

Run:

`node --test --experimental-strip-types tests/market-motion-promotion.test.ts tests/market-motion-ingestion.test.ts`

Expected: PASS.

- [ ] **Step 7: Commit**

Commit message:

`Preserve promoted Motion across event merges`

---

### Task 3: Evidence-backed promotion persistence and runtime placement

**Files:**
- Modify: `lib/market-motion-promotion.ts`
- Modify: `lib/intelligence/runtime.ts`
- Modify: `tests/market-motion-promotion.test.ts`

**Interfaces:**
- Consumes Task 1 `selectPromotableMarketMotion(...)` and `marketMotionPromotionInput(...)`.
- Produces:
  - `promoteMarketMotionFromCanonicalEvidence(input): Promise<MarketMotionPromotionResult>`
  - runtime call immediately after canonical `loadEvidence(requiredEvidenceIds)`.

Define:

```ts
export async function promoteMarketMotionFromCanonicalEvidence(input: {
  researchRunId: string | null;
  engineRunId: string;
  evidence: EvidencePackItem[];
  now?: Date;
  client?: SupabaseClient;
}): Promise<MarketMotionPromotionResult>
```

- [ ] **Step 1: Write RED persistence-adapter tests**

Add tests with a Supabase-shaped mock proving:
- adapter loads fresh current Motion across the normal Motion window, not by current research-run ID;
- selector receives canonical Evidence;
- successful promotion appends `PROMOTED` versions with the selected canonical Evidence UUID;
- at most six writes occur;
- one persistence failure adds a warning while later candidates are still attempted;
- replay/current `PROMOTED` rows are not selected again.

- [ ] **Step 2: Run RED**

Run:

`node --test --experimental-strip-types tests/market-motion-promotion.test.ts`

Expected: FAIL because `promoteMarketMotionFromCanonicalEvidence` does not exist.

- [ ] **Step 3: Implement the persistence adapter**

In `lib/market-motion-promotion.ts`:
- load `current_market_motion_items` using the existing freshness/current-state window;
- do not filter by `research_run_id`;
- call Task 1 selector;
- persist each promoted input through existing `persistMarketMotion(...)`;
- isolate per-item persistence errors into `warnings`;
- return existing result shape:
  - `considered`;
  - `eligible`;
  - `promoted`;
  - `motionIds`;
  - `warnings`.

Remove or retire `promoteMarketMotionForPublishedStories(...)` once no production call site remains.

- [ ] **Step 4: Write RED runtime-order regression**

Add a source-order regression in `tests/market-motion-promotion.test.ts` using `readFileSync` against `lib/intelligence/runtime.ts`.

Assert:
- runtime imports/calls `promoteMarketMotionFromCanonicalEvidence`;
- its awaited call occurs after `await loadEvidence(requiredEvidenceIds)`;
- its awaited call occurs before `buildFreshNewsRecruitment(...)`;
- no active call to `promoteMarketMotionForPublishedStories` remains;
- no `publishedStories.length > 0` gate surrounds B1 promotion;
- promotion call is guarded from persistence when `dryRun` is true.

- [ ] **Step 5: Run RED**

Run:

`node --test --experimental-strip-types tests/market-motion-promotion.test.ts`

Expected: runtime-order test FAIL because the old Story-publication call is still present near the end of the runtime.

- [ ] **Step 6: Move the runtime call**

In `lib/intelligence/runtime.ts`:

After:

```ts
const evidence = await loadEvidence(requiredEvidenceIds);
```

and before fresh-news recruitment/model early exits:
- if `!dryRun`, call `promoteMarketMotionFromCanonicalEvidence({ researchRunId, engineRunId, evidence, now: new Date(analysisAsOf) })`;
- append promotion warnings to runtime warnings;
- do not fail the intelligence run if promotion throws unexpectedly: convert to one bounded warning;
- remove the old end-of-run Story-publication-gated promotion block.

- [ ] **Step 7: Run GREEN**

Run:

`node --test --experimental-strip-types tests/market-motion-promotion.test.ts`

Expected: PASS.

- [ ] **Step 8: Run full tests**

Run: `npm test`

Expected: PASS.

- [ ] **Step 9: Commit**

Commit message:

`Run Motion promotion from canonical Evidence`

---

### Task 4: Documentation, whole-branch verification, and review

**Files:**
- Modify: `docs/MACRO_PULSE_MOTION_BRIDGE.md`
- Modify tests only if final review exposes a real defect.
- Do not expand scope into B2/B3.

**Interfaces:**
- Consumes Tasks 1–3.
- Produces a merge-ready B1 branch.

- [ ] **Step 1: Update Motion bridge documentation**

Replace the old rule:

`canonical Story change may PROMOTE Motion`

with:

`exact eligible canonical Evidence may PROMOTE Motion`.

Document:
- Macro Pulse / creator Motion is discovery context;
- exact canonical research admission is required;
- Motion never becomes Evidence;
- B1 still requires exact Story identity;
- Regime-/Investigation-only promotion remains future B2 work.

- [ ] **Step 2: Add/confirm Review Focus regression coverage**

Confirm the test suite explicitly covers all five Review Focus cases:
1. creator-only exact Evidence does not promote;
2. same Story/asset/ticker without origin-key overlap does not promote;
3. later stronger source cannot demote promoted Motion;
4. one promotion write failure does not stop later candidates;
5. zero-published-Story / early-exit runtime still runs B1 before reasoning when not dry-run.

If any case is missing, add the smallest reproducing test before any code fix.

- [ ] **Step 3: Run complete verification**

Run:

- `npm test`
- `npx tsc --noEmit`
- `npm run build`

Expected: all PASS.

- [ ] **Step 4: Verify database contracts**

Run the repository's existing database-contract workflow/check.

Expected: PASS with no migration.

- [ ] **Step 5: Whole-branch review against the B1 spec**

Review specifically for:
- any fuzzy evidence-match fallback;
- any Motion prose treated as evidence;
- any Story-publication dependency remaining;
- any path that strips a prior promotion during ingestion;
- any B2/B3 scope leakage;
- any direct Story/Regime mutation introduced by B1.

Any Critical/Important finding requires a reproducing RED test before repair.

- [ ] **Step 6: Commit documentation or verified review fixes**

Commit message for docs-only closeout:

`Document canonical-evidence Motion promotion`

If review fixes exist, use a separate commit describing the verified defect.

- [ ] **Step 7: Open implementation PR**

PR description must state:
- Story publication is no longer the promotion trigger;
- exact eligible canonical Evidence is required;
- creator/Macro Pulse context remains non-evidentiary;
- exact Story link is still required in B1;
- promoted state is sticky across later event merges;
- no migration/A2/A3/Hybrid/Regime changes.

