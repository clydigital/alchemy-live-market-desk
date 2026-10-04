# B1 Canonical-Evidence Motion Promotion — Design

## Status

Approved design direction. This spec is implementation-authoritative for B1 only.

## Goal

Replace the current Story-change-only Market Motion promotion rule with a canonical-evidence corroboration rule.

B1 should allow a fresh high-value Motion item to become `PROMOTED` when the exact event identity has been independently admitted into canonical Evidence, even if no Story changes in that intelligence run.

The intended flow is:

```text
creator / Macro Pulse / reporting
→ Market Motion candidate
→ unified event identity
→ canonical research intake
→ canonical Evidence
→ exact origin-item corroboration
→ PROMOTED Motion
→ Dossier System 2
→ A2 ACCEPT / REFINE / UNRESOLVED / REJECT
→ A3 canonical Story reevaluation
```

Motion remains non-evidentiary. Promotion means only that short-horizon Motion context has exact canonical support and may enter Dossier System 2.

## Why B1 is needed

The current promotion path is:

```text
linked canonical Story changes in intelligence runtime
→ promote Motion attached to that Story
```

That creates a circular dependency:

```text
Motion can enter Dossier only after Story changes
→ but A2/A3 exist so Dossier can decide whether Motion should cause Story reevaluation
```

A production audit on 2026-10-05 found:

- 276 historical Market Motion rows;
- all were `MOTION`;
- all were `LEAD`;
- all were creator-transcript Motion leads;
- zero carried `evidence_id`;
- zero had ever reached `PROMOTED`.

This confirms the Story-change gate prevents the A2/A3 path from receiving the Motion context it was designed to adjudicate.

These counts are diagnostic context only, not permanent assumptions.

## Scope

B1 includes:

- replacing Story-change-only promotion with exact canonical-evidence corroboration;
- scanning fresh current Motion across the normal 48-hour Motion window;
- exact matching from Motion origin item identity to canonical Evidence identity;
- reuse of the existing canonical evidence eligibility rules;
- persisting the selected canonical Evidence UUID in the promoted Motion version;
- preserving the existing exact `primary_story_id` requirement for B1;
- making promotion independent of whether a Story changed or was published in the current intelligence run;
- moving promotion early enough in the intelligence runtime that early System 2 exits do not suppress valid promotion;
- making promotion sticky across later event merges so ingestion cannot silently demote an already-promoted Motion;
- updating Motion bridge documentation and tests.

B1 does not include:

- regime-only Motion promotion;
- investigation-only Motion promotion;
- Motion without an exact persistent Story link;
- fuzzy or semantic evidence matching;
- Motion-to-evidence conversion;
- direct Story mutation;
- direct Regime mutation;
- Hybrid reasoning changes;
- Research Gap propagation changes;
- A2/A3 contract changes;
- a new promotion table;
- a new canonical evidence table;
- a database migration.

Those remain later roadmap work, especially B2/B3.

## Existing architecture B1 must reuse

### Market Motion ingestion

`lib/market-motion-ingestion.ts` already:

- creates Motion from news, creator transcript leads and Macro Pulse candidates;
- derives or preserves exact Story and Regime links;
- deduplicates Motion into event identities with `eventMotionKey(...)`;
- merges source context into `metadata.sourceRefs`;
- merges exact origin item keys into `metadata.originItemKeys`;
- persists append-only Motion versions through `persistMarketMotion(...)`.

The event merge is important because a creator lead and later independent reporting can converge on the same Motion identity. When they do, the merged Motion retains both origin item keys.

### Canonical research intake

`lib/intelligence/runtime.ts` already canonicalises research intake into `intelligence_evidence`.

For research-intake Evidence:

- `external_evidence_id = research-intake:<research_intake_items.id>`;
- `structured_payload.itemKey = research_intake_items.item_key`;
- immutable raw/normalised provenance is enforced by the database;
- source role/tier/reliability are loaded into the existing `EvidencePackItem` representation.

B1 must reuse that canonical identity rather than manufacture a separate corroboration ledger.

### Canonical eligibility

`lib/intelligence/source-verification.ts` already exposes:

```ts
isCanonicalEligibleEvidence(item)
sourceVerificationWeight(item)
```

The eligibility rule already rejects:

- discovery-only sources;
- scheduled-event placeholders;
- transcript evidence;
- `research_analysis`;
- source tiers above the accepted canonical range.

B1 must call this rule rather than duplicate or weaken it.

### Dossier Motion intake

A2 currently consumes only fresh `PROMOTED` Motion with an exact `primary_story_id`.

That remains correct for B1.

## Architectural decision

B1 keeps promotion in `lib/market-motion-promotion.ts`, but changes the trigger and selector.

Replace:

```ts
promoteMarketMotionForPublishedStories(...)
```

with an evidence-backed entry point such as:

```ts
promoteMarketMotionFromCanonicalEvidence(...)
```

The promotion adapter receives canonical Evidence already loaded by the intelligence runtime.

It must not:

- infer facts from Motion prose;
- promote from `sourceRefs` alone;
- promote from Story publication;
- perform Story reasoning;
- perform Dossier reasoning;
- create canonical Evidence.

It only decides whether an existing Motion event has an exact eligible canonical corroborator.

## Promotion policy contract

Add an explicit policy identifier:

```ts
export const MARKET_MOTION_PROMOTION_POLICY =
  "canonical-evidence-corroborated/v1" as const;
```

A promoted Motion version records this value in metadata.

The previous policy:

```text
canonical-story-changed/v1
```

must no longer be emitted by the active promotion path.

Historical rows remain valid historical records.

## Promotion candidate eligibility

A current Motion row is eligible for B1 consideration only when all of the following are true:

1. effective state is not `EXPIRED`;
2. lifecycle state is exactly `MOTION`;
3. `primary_story_id` is present;
4. materiality is at least `MARKET_MOTION_PROMOTION_MIN_MATERIALITY = 80`;
5. relevance is at least `MARKET_MOTION_PROMOTION_MIN_RELEVANCE = 75`;
6. Motion verification state is one of:
   - `LEAD`;
   - `REPORTED`;
   - `VERIFIED`;
7. at least one exact origin item key resolves to eligible canonical Evidence.

B1 deliberately allows a `LEAD` Motion to be promoted when independent canonical Evidence corroborates the same event.

The Motion's own verification label is not evidence and therefore is not the promotion proof.

B1 excludes current Motion marked:

- `CONTRADICTED`;
- `UNRESOLVED`;
- `PARTIAL`;

until a later design explicitly defines their promotion semantics.

## Exact evidence identity rule

B1 may only corroborate Motion through exact origin-item identity.

### Motion side

Read origin identities from:

```text
metadata.originItemKeys[]
```

For backward compatibility, an exact scalar `metadata.itemKey` may also be included in the candidate origin set.

No headline, ticker, regime, Story thesis or prose similarity is used for evidence matching.

### Evidence side

For each canonical `EvidencePackItem`, use:

```text
structuredPayload.itemKey
```

The match condition is:

```text
Motion originItemKeys contains Evidence.structuredPayload.itemKey
```

and that Evidence must pass:

```ts
isCanonicalEligibleEvidence(evidence)
```

This is the canonical corroboration boundary.

### Why this supports later corroboration

Market Motion ingestion already merges multiple sources for the same exact event identity.

Example:

```text
Run N:
creator transcript lead
→ Motion event X
→ originItemKeys = [creator:item]

Run N+1:
independent Reuters/official intake
→ same event X
→ Motion merge
→ originItemKeys = [creator:item, reporting:item]
→ reporting:item canonicalises to Evidence
→ exact origin-item overlap
→ B1 promotion becomes eligible
```

The independent evidence can therefore arrive in a later research run.

B1 must scan fresh current Motion across the full Motion window rather than filtering Motion by the current `research_run_id`.

## No fuzzy fallback

If canonical Evidence does not share an exact origin item key with Motion, B1 does not promote it.

Forbidden fallback signals include:

- same `primary_story_id`;
- same `primary_regime_slug`;
- overlapping ticker;
- headline similarity;
- shared topic;
- shared asset;
- source URL similarity;
- model judgement;
- Motion `sourceRefs`;
- Motion `market_reaction`;
- Story publication or Story confidence change.

Fail closed rather than inventing corroboration.

## Canonical evidence selection

A Motion may have multiple exact eligible canonical Evidence matches.

Choose one primary evidence record deterministically.

Rank matches by:

1. `sourceVerificationWeight(evidence)`, descending;
2. `availableAt` / `eventAt`, newest first;
3. Evidence UUID, ascending as deterministic tie-break.

The promoted Motion's existing `evidence_id` column stores the selected primary canonical Evidence UUID.

Promotion metadata may additionally record all exact eligible corroborators, bounded and sorted deterministically, for audit:

```ts
promotionEvidenceIds: string[]
promotionEvidenceItemKeys: string[]
```

Those metadata arrays are audit context only. Canonical Evidence remains the source of truth.

## Promotion output

`marketMotionPromotionInput(...)` should accept the selected canonical Evidence match.

The resulting Motion version must set:

```text
lifecycle_state = PROMOTED
evidence_id = selected canonical intelligence_evidence.id
primary_story_id = unchanged exact Story identity
primary_regime_slug = unchanged
expires_at = unchanged
verification_state = preserved Motion verification state
```

B1 does not upgrade `verification_state` merely because promotion occurred.

This keeps two concepts separate:

- Motion verification describes the Motion representation/source state;
- `evidence_id` proves the canonical evidence used to admit it into Dossier context.

### Promotion reason

Use evidence-based wording, for example:

```text
Canonical Evidence <evidence-id> corroborated this Motion during intelligence run <engine-run-id>; Story <story-id> remains the exact routing identity. Motion is promoted as short-horizon Dossier context, not as canonical evidence.
```

The reason is audit prose only.

### Promotion metadata

Persist at least:

```ts
{
  promotedFromMotionId: item.id,
  promotionEngineRunId: engineRunId,
  promotionResearchRunId: researchRunId,
  promotionPolicy: "canonical-evidence-corroborated/v1",
  promotionEvidenceId: selectedEvidence.id,
  promotionEvidenceItemKey: selectedEvidence.structuredPayload.itemKey,
  promotionEvidenceIds: [...bounded exact eligible evidence ids],
  promotionEvidenceItemKeys: [...bounded exact origin item keys]
}
```

## Sticky promotion invariant

B1 makes promotion useful only if later ingestion cannot silently undo it.

Today `mergeCandidatePair(...)` chooses the stronger source candidate and inherits its lifecycle/evidence fields from object spread. A later stronger `MOTION` candidate can therefore overwrite a previously promoted current record.

B1 must change event merging so that if either side is already `PROMOTED`:

- merged `lifecycleState` remains `PROMOTED`;
- existing canonical `evidenceId` is preserved unless a later explicit promotion operation replaces it;
- existing `promotionReason` is preserved;
- existing promotion metadata is preserved;
- stronger verification/source context may still merge normally;
- expiry is still recalculated only according to the existing Motion versioning rules.

This is not a new promotion decision. It is preservation of an already-recorded promotion decision.

An expired row is not revived by this invariant.

## Runtime placement

The current runtime invokes Motion promotion near the end and only when:

```text
publishedStories.length > 0
```

B1 removes that dependency.

The new promotion call should run after canonical Evidence has been loaded:

```text
canonicaliseIntake(...)
↓
loadEvidence(requiredEvidenceIds)
↓
B1 evidence-backed Motion promotion
↓
fresh-news recruitment / System 1
↓
Story review / System 2
↓
Story persistence
↓
Regime projection
```

This placement matters because the runtime has several legitimate early exits:

- no System 1 research-worthy cluster;
- maintenance-only run;
- no model-required Story review;
- other non-publication paths.

A Motion with exact eligible canonical corroboration must not be blocked simply because no Story was published.

### Evidence input

B1 should use the full canonical `evidence` collection returned by `loadEvidence(requiredEvidenceIds)`, not only `reasoningEvidence`.

Reason:

- promotion is a deterministic canonical-admission check;
- it should not depend on System 1 attention selection;
- current-run canonicalised Evidence IDs are explicitly included in `requiredEvidenceIds`, so fresh corroborators are pinned into the loaded set.

## Dry-run behaviour

Dry runs must not persist promoted Motion versions.

Pure selection/planning helpers may still be exercised in tests, but the runtime persistence call remains guarded by `!dryRun`.

## Bounds

Retain the existing promotion safety bound:

```text
MARKET_MOTION_PROMOTION_LIMIT = 6
```

Ranking eligible Motion remains deterministic.

Recommended Motion ranking:

1. canonical evidence strength of the selected match;
2. Motion materiality;
3. Motion relevance;
4. Motion novelty;
5. Motion occurrence time;
6. Motion ID tie-break.

This replaces the previous verification-first ranking because canonical corroboration, not Motion verification, is now the promotion proof.

## Idempotency

B1 promotion remains append-only and idempotent through current-state semantics.

- only current `MOTION` rows are promotion candidates;
- after successful promotion, current state is `PROMOTED`;
- a replay does not append another promotion version;
- sticky promotion prevents later ingestion from accidentally returning the event to `MOTION`.

If persistence of one Motion fails, other eligible Motion may still be attempted and the failure is returned in `warnings`.

## Dossier / A2 / A3 interaction

B1 does not change A2 or A3.

After B1:

```text
eligible canonical Evidence
→ PROMOTED Motion with evidence_id
→ Dossier motion_context
→ A2 System 2 adjudication
→ ACCEPT / REFINE requires canonical Evidence
→ A3 exact canonical Story reevaluation
```

The Motion's `evidence_id` is useful provenance, but A2 still independently validates canonical evidence references inside the Dossier packet.

B1 promotion never authorises Story mutation by itself.

## B2 boundary

B1 still requires exact `primary_story_id`.

A Motion with:

- a Regime link but no Story link;
- an Investigation destination but no Story link;
- a Research Now destination only;

does not enter the B1 promotion path.

That is intentional.

B2 will separately define regime-/investigation-only acceptance without weakening B1's Story identity invariant.

## Database expectation

No migration is required.

B1 reuses:

- `market_motion_items.evidence_id`;
- `market_motion_items.primary_story_id`;
- `market_motion_items.metadata`;
- `intelligence_evidence.id`;
- `intelligence_evidence.structured_payload.itemKey`;
- existing append-only Motion versioning;
- current Motion view.

No new table, foreign key, RPC or reasoning store should be added.

## Expected files

Modify:

- `lib/market-motion-promotion.ts`
- `lib/intelligence/runtime.ts`
- `lib/market-motion-ingestion.ts`
- `tests/market-motion-promotion.test.ts`
- Motion-ingestion tests as needed for sticky promotion
- `docs/MACRO_PULSE_MOTION_BRIDGE.md`

Potentially reuse/import:

- `isCanonicalEligibleEvidence`
- `sourceVerificationWeight`
- `EvidencePackItem`

Do not modify for B1:

- A2 Dossier acceptance contracts;
- A3 reevaluation propagation contracts;
- Hybrid publication logic;
- Research Gap propagation;
- Regime persistence;
- database migrations.

## Documentation update

The Macro Pulse bridge currently says:

```text
canonical Story change may PROMOTE Motion
```

B1 should replace that with the new boundary:

```text
exact eligible canonical Evidence may PROMOTE Motion
```

Macro Pulse remains discovery-only. Its carried URLs/references cannot promote Motion unless the underlying event independently enters canonical Evidence through the normal research path and exact event/origin identity is preserved.

## Test requirements

### Promotion eligibility

Prove:

- fresh high-materiality/relevance Motion with an exact Story link and eligible canonical Evidence is promotable;
- no Story publication/change is required;
- creator `LEAD` Motion can become promotable after later independent canonical corroboration;
- expired Motion is not promotable;
- missing Story link is not promotable in B1;
- contradicted/unresolved/partial Motion is not promotable;
- weak Motion thresholds remain blocked.

### Evidence firewall

Prove:

- creator transcript Evidence alone cannot promote Motion;
- scheduled-event Evidence cannot promote Motion;
- `research_analysis` Evidence cannot promote Motion;
- discovery-only Evidence cannot promote Motion;
- sourceRefs metadata cannot promote Motion;
- same Story without origin-item overlap cannot promote Motion;
- same Regime without origin-item overlap cannot promote Motion;
- same ticker/headline without origin-item overlap cannot promote Motion;
- exact canonical origin-item overlap is required.

### Later-run corroboration

Prove:

1. creator Motion is created in run N with creator origin key;
2. later reporting/official candidate in run N+1 merges into the same Motion event identity;
3. merged `originItemKeys` contains both origins;
4. canonical Evidence for the later reporting/official origin exists;
5. B1 selects that Evidence and promotes the existing Motion.

### Promotion persistence

Prove promoted input:

- sets `lifecycleState = PROMOTED`;
- sets `evidenceId` to canonical Evidence UUID;
- preserves exact `primaryStoryId`;
- preserves expiry;
- preserves Motion verification state;
- emits policy `canonical-evidence-corroborated/v1`;
- records selected evidence identity in metadata;
- no longer claims Story change as the reason.

### Sticky promotion

Prove:

- merging a later stronger reporting candidate into an already promoted Motion does not demote lifecycle;
- canonical `evidenceId` remains present;
- promotion reason/metadata remain present;
- merged source/verification context may still strengthen;
- expired Motion is not revived.

### Runtime integration

Prove:

- runtime invokes B1 with canonical Evidence even when `publishedStories.length === 0`;
- promotion runs before model-stage early-return branches that previously suppressed it;
- dry run does not persist promotion;
- promotion failure is warning-isolated and does not fail the intelligence run.

### Bounds and idempotency

Prove:

- at most six Motion items are promoted per invocation;
- deterministic strongest canonical corroboration wins when multiple Evidence rows match;
- replay of a current PROMOTED Motion does not append another promotion.

## Acceptance criteria

B1 is complete when all of the following are true:

1. Motion promotion no longer depends on Story mutation/publication.
2. Promotion requires exact eligible canonical Evidence.
3. Creator/Macro Pulse context remains discovery-only until independently canonicalised/corroborated.
4. Fresh creator Motion can be promoted by later independent evidence in another run.
5. The canonical Evidence UUID is persisted in the promoted Motion version.
6. Exact `primary_story_id` remains required for B1.
7. Motion itself never becomes canonical Evidence.
8. Later ingestion cannot silently demote a promoted Motion or strip its evidence pointer.
9. A2/A3 remain unchanged and remain the only Dossier→Story reasoning path.
10. No new database table or migration is introduced.
11. Full tests, typecheck, production build and database contracts remain green.
