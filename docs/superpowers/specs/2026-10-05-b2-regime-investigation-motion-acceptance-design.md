# B2 Regime / Investigation Motion Acceptance — Design

## Status

Draft from the approved in-chat design direction. Awaiting written-spec review. Once approved, this spec becomes implementation-authoritative for B2 only.

## Goal

Allow canonically corroborated Market Motion to enter Dossier System 2 even when it has no exact persistent Story link, while preserving the evidence firewall and preventing orphan Motion from guessing or directly mutating Stories.

B2 extends the existing flow from:

```text
canonical Evidence
→ PROMOTED Motion with exact Story
→ Dossier A2
→ ACCEPT / REFINE
→ A3 Story reevaluation
```

to:

```text
canonical Evidence
→ PROMOTED Motion
→ explicit routing class
   ├─ STORY
   ├─ REGIME
   └─ INVESTIGATION_CANDIDATE
→ Dossier System 2
→ destination rules constrained by routing class
→ existing A3 Story propagation only when an exact Story or explicit Regime route exists
```

Motion remains non-evidentiary. Canonical Evidence remains the only factual basis for ACCEPT / REFINE and for any downstream Story reevaluation.

## Why B2 is needed

B1 replaced Story-change-only promotion with exact canonical-evidence corroboration, but deliberately retained an exact `primary_story_id` requirement.

That leaves two valid classes of research-worthy Motion outside the Dossier:

1. Motion with an exact Regime route but no persistent Story identity.
2. Motion with no Story or Regime identity but a concrete unresolved `next_test` suitable for Investigation formation.

A production audit on 2026-10-05 found current Motion in all three shapes:

- Story-linked Motion;
- 2 Regime-only Motion rows;
- 6 fully unrouted Motion rows, all six with concrete `next_test` values and all six above the existing B1 materiality / relevance thresholds.

Those counts are diagnostic context only, not permanent assumptions.

A2 already understands destination references such as `REGIME:CURRENT`, `INVESTIGATION:<id>` and `RESEARCH_NOW`. A3 already knows how to route `REGIME:CURRENT` through existing `market_regime_story_links` into the canonical Story reevaluation queue.

The missing B2 capability is therefore admission and fail-closed routing semantics, not another reasoning engine.

## Architectural principles

B2 preserves these hard invariants:

1. Motion is context, never canonical Evidence.
2. Exact eligible canonical Evidence is still required before Motion promotion.
3. No fuzzy Story lookup is introduced.
4. No orphan Motion may directly create or mutate a persistent Story.
5. Regime routing may reach Stories only through the existing Regime→Story link table and existing A3 queue path.
6. Investigation-only acceptance does not enqueue Story reevaluation.
7. Research Now is a follow-up action, not a sufficient canonical destination by itself for orphan Motion.
8. No new reasoning table, promotion table, queue or database migration is added.
9. B2 does not implement B3 Research Gap / Hybrid propagation.

## Scope

B2 includes:

- expanding canonical-evidence Motion promotion beyond Story-linked Motion;
- assigning each promoted Motion an explicit routing class;
- admitting fresh promoted Regime-only and Investigation-candidate Motion into bounded Dossier Motion context;
- exposing the routing class to Research Brain;
- constraining Motion `destination_refs` according to routing class;
- allowing Regime-only ACCEPT / REFINE to use the existing A3 Regime→Story propagation path;
- allowing Investigation-candidate ACCEPT / REFINE to attach to an Investigation in the same immutable Dossier output without Story queue mutation;
- preserving B1 Story-linked behavior unchanged;
- preserving historical B1 Motion/Dossier readability;
- focused tests for routing, evidence firewall and propagation boundaries.

B2 does not include:

- direct Motion→Story identity inference;
- direct Motion→Regime persistence;
- a persistent Investigation table;
- a new Investigation queue;
- Research Gap handoff or execution changes;
- Hybrid propagation changes;
- Story reasoning changes;
- A3 queue architecture changes;
- Regime projection changes;
- Research Now-only acceptance for orphan Motion;
- Thesis or Main Thread promotion from orphan Motion;
- database migrations.

## Existing architecture B2 must reuse

### B1 canonical-evidence promotion

`lib/market-motion-promotion.ts` already:

- matches Motion origin item keys to canonical Evidence `structuredPayload.itemKey`;
- reuses `isCanonicalEligibleEvidence(...)`;
- ranks corroborators with `sourceVerificationWeight(...)`;
- requires materiality >= 80;
- requires relevance >= 75;
- allows LEAD / REPORTED / VERIFIED Motion;
- rejects expired and non-MOTION rows;
- persists the selected canonical Evidence UUID into Motion `evidence_id`;
- uses append-only Motion versioning;
- keeps promotion sticky across later event merges.

B2 must reuse that exact evidence-admission boundary.

### Dossier Motion context

`lib/dossier-v2/motion-context.ts` already:

- selects fresh current `PROMOTED` Motion;
- applies chronology safety;
- caps Motion context at 3 items;
- carries Story / Regime identities and bounded Motion text;
- carries the origin Evidence UUID only when it is part of the canonical Dossier packet.

B2 expands the selector beyond Story-linked Motion but preserves all bounds and chronology rules.

### A2 Motion acceptance

The existing A2 output contract already has:

```ts
type MotionSynthesisDecision = "ACCEPT" | "REFINE" | "UNRESOLVED" | "REJECT";

interface MotionAcceptanceDecision {
  motion_id: string;
  decision: MotionSynthesisDecision;
  conclusion: string | null;
  canonical_evidence_refs: string[];
  destination_refs: string[];
  rationale: string;
  next_test: string | null;
}
```

The current destination vocabulary already includes:

- `MAIN_THREAD`;
- `REGIME:CURRENT`;
- `RESEARCH_NOW`;
- `STORY:<id>`;
- `INVESTIGATION:<id>`;
- `THESIS:<id>`.

B2 does not add a new output destination syntax.

### A3 propagation

`lib/dossier-v2/reevaluation-propagation.ts` already:

- requires ACCEPT / REFINE;
- requires queueable canonical Evidence identity;
- honors explicit `STORY:<id>` destinations;
- otherwise uses Motion `primary_story_id`;
- honors `REGIME:CURRENT` by reading Motion `primary_regime_slug`;
- routes the Regime through existing `market_regime_story_links`;
- queues only canonical Story reevaluation rows;
- never directly mutates Regime state.

B2 must not create a parallel propagation mechanism.

## Routing classes

Add an explicit routing class:

```ts
export type MarketMotionRoutingClass =
  | "STORY"
  | "REGIME"
  | "INVESTIGATION_CANDIDATE";
```

The routing class is structural routing metadata, not evidence and not a conclusion.

### STORY

Use `STORY` when:

```text
primary_story_id != null
```

A Story-linked Motion may also have a Regime slug. Story identity remains the strongest routing identity.

### REGIME

Use `REGIME` when:

```text
primary_story_id == null
primary_regime_slug != null
```

The Regime slug must already be a valid existing Regime identity. B2 does not infer a Regime from free text during promotion.

### INVESTIGATION_CANDIDATE

Use `INVESTIGATION_CANDIDATE` when:

```text
primary_story_id == null
primary_regime_slug == null
next_test passes isConcreteMarketMotionNextTest(...)
```

Add one pure Motion-domain helper:

```ts
export function isConcreteMarketMotionNextTest(value: string | null | undefined): boolean
```

It returns false for blank input and for the two current ingestion fallback strings, compared after trim and case normalisation:

```text
Check whether the linked assets and broader Story / Regime reaction confirm the information.

Seek independent or primary-source confirmation, then test whether the market reaction persists.
```

All other non-empty `next_test` values qualify structurally. B2 does not use semantic scoring to decide whether a question “sounds” specific.

This class means only: “the canonically corroborated Motion is worth System 2 investigation but lacks a safe persistent Story/Regime route.”

It does not pre-create an Investigation ID.

### Fail closed

A Motion with no Story, no Regime and no concrete `next_test` is not B2 promotable.

No routing class is inferred from:

- headline similarity;
- tickers;
- `big_picture_bridge`;
- category;
- source;
- model judgement;
- semantic similarity.

## Promotion policy

New B2 promotions use:

```ts
MARKET_MOTION_PROMOTION_POLICY = "canonical-evidence-corroborated/v2"
```

B1 historical `canonical-evidence-corroborated/v1` Motion remains valid historical state.

New promoted Motion metadata records:

```ts
{
  promotionPolicy: "canonical-evidence-corroborated/v2",
  promotionRoutingClass: "STORY" | "REGIME" | "INVESTIGATION_CANDIDATE",
  ...
}
```

All B1 evidence identity metadata remains unchanged.

The promotion reason should remain evidence-based and may mention the routing class, but must not claim a Story or Regime conclusion.

## Promotion eligibility

B2 keeps every B1 eligibility rule except the exact Story requirement.

A current Motion is B2 promotable only when:

1. effective state is not `EXPIRED`;
2. lifecycle state is `MOTION`;
3. materiality >= 80;
4. relevance >= 75;
5. verification state is LEAD / REPORTED / VERIFIED;
6. at least one exact origin item key matches eligible canonical Evidence;
7. a valid routing class can be determined.

The canonical Evidence match remains exact and unchanged from B1.

### Route-class ranking

Routing class should not override evidence quality.

Motion ranking remains:

1. selected canonical evidence strength;
2. materiality;
3. relevance;
4. novelty;
5. occurrence time;
6. Motion ID.

The global promotion cap remains 6.

No quota is introduced per routing class in B2.

## Historical compatibility

Historical B1 Motion has no `promotionRoutingClass` metadata.

For read compatibility, routing class may be deterministically derived from structural fields:

1. Story present → `STORY`;
2. no Story + Regime present → `REGIME`;
3. no Story + no Regime + concrete next test → `INVESTIGATION_CANDIDATE`;
4. otherwise no valid class.

New B2 promotions must persist the explicit metadata field.

This fallback exists only for historical/legacy records. It is not a fuzzy inference mechanism.

## Dossier Motion context contract

New Dossier packets should expose routing class explicitly on each Motion context item:

```ts
interface DossierMotionContextItem {
  ...
  routing_class?: MarketMotionRoutingClass;
}
```

The TypeScript property remains optional so immutable historical packets remain readable.

For all newly built B2 packets, `routing_class` is required in practice and emitted by `boundedMotionItem(...)`.

The existing `dossier-motion-context/1` contract version may remain unchanged because:

- historical packet shape remains readable;
- no existing field changes meaning;
- the new field is additive;
- the acceptance output shape is unchanged.

B2 should not force a contract-version migration across immutable historical Dossiers.

## Dossier selector

Replace the B1 assumption:

```text
PROMOTED + exact primary_story_id
```

with:

```text
PROMOTED + valid routing class
```

The Dossier selector continues to require:

- fresh effective PROMOTED state;
- chronology safety;
- existing Motion ranking;
- bounded maximum of 3 Motion items.

Story-linked B1 Motion continues to qualify exactly as before.

## System 2 destination policy

B2 keeps the global A2 requirement:

- ACCEPT / REFINE require canonical Evidence;
- ACCEPT / REFINE require at least one destination;
- REFINE requires a concrete `next_test`;
- REJECT uses no destinations and no conclusion.

B2 adds routing-class-specific destination policy.

### STORY Motion

Keep current A2 destination behavior.

A `STORY` Motion may use any currently valid A2 destination that passes existing output reference validation.

B2 does not narrow Story-linked behavior.

### REGIME Motion

Allowed destination kinds:

```text
REGIME:CURRENT
INVESTIGATION:<id>
RESEARCH_NOW
```

Forbidden destination kinds:

```text
MAIN_THREAD
STORY:<id>
THESIS:<id>
```

For ACCEPT / REFINE, at least one of these must be present:

```text
REGIME:CURRENT
INVESTIGATION:<id>
```

`RESEARCH_NOW` may accompany either, but is not sufficient by itself.

This prevents a Regime-only Motion from guessing a persistent Story while still allowing System 2 to decide:

- this is directly relevant to the current Regime;
- this should become/remain an Investigation;
- or both.

### INVESTIGATION_CANDIDATE Motion

Allowed destination kinds:

```text
INVESTIGATION:<id>
RESEARCH_NOW
```

Forbidden destination kinds:

```text
MAIN_THREAD
REGIME:CURRENT
STORY:<id>
THESIS:<id>
```

For ACCEPT / REFINE, at least one `INVESTIGATION:<id>` is mandatory.

`RESEARCH_NOW` may accompany the Investigation but is not sufficient alone.

The referenced Investigation may be one of the bounded Investigations emitted in the same Research Brain output.

This lets System 2 create a new Investigation for a canonically corroborated orphan Motion without manufacturing a persistent Story identity upstream.

## UNRESOLVED / REJECT destination behavior

Routing-class allowlists apply to every non-empty destination list, including UNRESOLVED.

This prevents even a non-conclusive Motion decision from emitting destinations that violate its identity boundary.

Existing A2 semantics remain:

- UNRESOLVED has `conclusion = null`;
- REJECT has `conclusion = null`;
- REJECT must use `destination_refs = []`.

B2 does not require UNRESOLVED to have a destination.

## Investigation formation

B2 does not introduce a persistent Investigation store.

Research Brain already emits bounded immutable Dossier Investigations with exact `investigation_id` values.

For an `INVESTIGATION_CANDIDATE` Motion:

1. canonical Evidence supports the factual basis;
2. Motion supplies bounded short-horizon context and `next_test`;
3. Research Brain may create or select an Investigation in the same output;
4. Motion acceptance references that exact `INVESTIGATION:<id>`;
5. validation confirms the ID exists in the same output.

This preserves the Dossier as the System 2 analytical workspace.

Persistent downstream research execution remains B3.

## A3 interaction

B2 does not modify A3 architecture.

### STORY

Existing behavior remains:

```text
ACCEPT / REFINE
→ explicit Story destination or Motion primary Story
→ existing Story reevaluation queue
```

### REGIME

If a Regime Motion ACCEPT / REFINE includes `REGIME:CURRENT`:

```text
Motion primary_regime_slug
→ existing market_regime_story_links
→ bounded core/bridge/supporting Story selection
→ existing evidence-backed Story reevaluation queue
```

No direct Regime mutation occurs.

If the same Regime Motion routes only to an Investigation, A3 queues no Story work.

### INVESTIGATION_CANDIDATE

An Investigation-candidate Motion has no safe Story or Regime route.

Therefore:

```text
ACCEPT / REFINE
→ INVESTIGATION:<id>
→ immutable Dossier analytical state
→ no A3 Story queue mutation
```

That is intentional.

B3 will define downstream Research Gap / Hybrid propagation for Investigation and Research Now outcomes.

## Promotion vs acceptance boundary

Promotion and acceptance remain separate gates.

### Promotion asks

```text
Is this Motion canonically corroborated and structurally routable enough to enter System 2?
```

### A2/B2 acceptance asks

```text
What conclusion, if any, does System 2 support from canonical Evidence, and where may that conclusion safely belong?
```

A `REGIME` or `INVESTIGATION_CANDIDATE` promotion does not itself establish a Regime or Investigation conclusion.

## Delta / rebase behavior

B2 Motion context remains part of the canonical packet hash.

A new promoted Regime or Investigation-candidate Motion entering bounded Motion context should therefore participate in the existing Dossier delta/rebase machinery exactly like Story-linked Motion.

B2 should not add a separate rebase trigger.

## Research Gap boundary

B2 may create/route to immutable Dossier Investigations and Research Now actions, but it must not change Research Gap persistence or execution.

Current Research Gap worker behavior may continue consuming existing Dossier Investigation and Motion structures according to its own rules.

Any deliberate propagation from B2 Investigation acceptance into durable Research Gap / Hybrid workflows is B3.

## Database expectation

No migration is required.

B2 reuses:

- `market_motion_items.primary_story_id`;
- `market_motion_items.primary_regime_slug`;
- `market_motion_items.next_test`;
- `market_motion_items.metadata`;
- `market_motion_items.evidence_id`;
- existing append-only Motion versions;
- existing Dossier JSON;
- existing `market_regime_story_links`;
- existing `intelligence_reevaluation_queue`.

No new table, foreign key, RPC, queue or persistence engine is added.

## Expected files

Likely modify:

- `lib/market-motion.ts` — routing-class derivation and concrete-next-test helper
- `lib/market-motion-promotion.ts`
- `lib/dossier-v2/input-packet.ts`
- `lib/dossier-v2/motion-context.ts`
- `lib/dossier-v2/research-brain-prompt.ts`
- `lib/dossier-v2/research-brain-validation.ts`
- `tests/market-motion-promotion.test.ts`
- `tests/dossier-motion-context.test.ts` or existing equivalent
- `tests/research-brain.test.ts`
- `tests/dossier-reevaluation-propagation.test.ts`
- `docs/MACRO_PULSE_MOTION_BRIDGE.md`

Routing-class derivation should live as a focused pure Motion-domain helper in `lib/market-motion.ts`; promotion and Dossier adapters reuse it rather than duplicating the rules.

Do not modify for B2:

- database migrations;
- A3 queue schema;
- Regime persistence;
- Story reasoning engine;
- Research Gap execution;
- Hybrid propagation.

## Test requirements

### Routing-class derivation

Prove:

- Story-linked Motion → `STORY`;
- no Story + exact Regime → `REGIME`;
- no Story + no Regime + concrete next test → `INVESTIGATION_CANDIDATE`;
- no identities + no next test → not promotable;
- either known generic fallback next-test string → not promotable as INVESTIGATION_CANDIDATE;
- a non-empty non-fallback next test → eligible for INVESTIGATION_CANDIDATE routing;
- Story identity wins when Story and Regime both exist.

### Evidence firewall

Prove every B1 evidence rule remains unchanged:

- exact origin item overlap required;
- transcript Evidence alone cannot promote;
- scheduled-event Evidence cannot promote;
- `research_analysis` cannot promote;
- discovery-only Evidence cannot promote;
- Story / Regime / ticker / headline similarity cannot substitute for exact Evidence identity.

### Promotion

Prove:

- canonically corroborated Regime-only Motion can promote;
- canonically corroborated Investigation-candidate Motion can promote;
- selected canonical Evidence UUID is persisted;
- new promotions use policy `canonical-evidence-corroborated/v2`;
- metadata includes explicit `promotionRoutingClass`;
- historical B1 v1 Story promotions remain selectable/readable;
- global promotion cap remains 6;
- sticky promotion and expiry behavior remain unchanged.

### Dossier context

Prove:

- fresh promoted Story Motion remains admitted;
- fresh promoted Regime Motion is admitted without a Story ID;
- fresh promoted Investigation-candidate Motion is admitted without Story/Regime IDs;
- new bounded items emit `routing_class`;
- invalid/unroutable promoted Motion is excluded;
- chronology and context cap remain unchanged.

### Destination validation — STORY

Prove existing A2 Story-linked destinations remain valid.

### Destination validation — REGIME

Prove:

- ACCEPT/REFINE with `REGIME:CURRENT` is valid;
- ACCEPT/REFINE with `INVESTIGATION:<id>` is valid;
- either may additionally include `RESEARCH_NOW`;
- `RESEARCH_NOW` alone is invalid;
- `STORY:<id>`, `THESIS:<id>` and `MAIN_THREAD` are invalid;
- canonical Evidence is still mandatory.

### Destination validation — INVESTIGATION_CANDIDATE

Prove:

- ACCEPT/REFINE must reference a valid Investigation in the same output;
- `RESEARCH_NOW` may accompany it;
- `RESEARCH_NOW` alone is invalid;
- `REGIME:CURRENT`, `STORY:<id>`, `THESIS:<id>` and `MAIN_THREAD` are invalid;
- canonical Evidence is still mandatory.

### UNRESOLVED / REJECT

Prove:

- UNRESOLVED remains conclusion-null and may have no destination;
- any UNRESOLVED destination still obeys routing-class allowlists;
- REJECT remains destination-empty.

### A3 boundary

Prove:

- Regime-only ACCEPT + `REGIME:CURRENT` routes through existing Regime→Story links;
- Regime-only ACCEPT + Investigation only queues no Story work;
- Investigation-candidate ACCEPT queues no Story work;
- no fuzzy substitute Story is inferred;
- only canonical Evidence UUIDs can back any queued Story reevaluation;
- no direct Regime write is introduced.

### Historical replay

Prove historical Dossier/Motion fixtures without explicit `routing_class` remain readable through deterministic structural fallback.

## Acceptance criteria

B2 is complete when all of the following are true:

1. Canonically corroborated Motion no longer requires a Story ID to enter Dossier System 2.
2. Every newly promoted Motion has one explicit routing class: STORY, REGIME or INVESTIGATION_CANDIDATE.
3. Exact canonical Evidence remains mandatory for promotion and ACCEPT / REFINE.
4. Story-linked B1 behavior is unchanged.
5. Regime-only Motion can be accepted/refined without guessing a Story.
6. Regime→Story propagation uses only existing A3 links and queue infrastructure.
7. Investigation-candidate Motion can become/reference a Dossier Investigation without Story queue mutation.
8. Research Now alone cannot serve as the acceptance destination for orphan Motion.
9. Orphan Motion cannot route directly to Story, Thesis or Main Thread.
10. Motion remains non-evidentiary.
11. No new database table, migration, queue or reasoning engine is introduced.
12. B3 Research Gap / Hybrid propagation remains out of scope.
13. Full tests, typecheck, production build and database contracts remain green.
