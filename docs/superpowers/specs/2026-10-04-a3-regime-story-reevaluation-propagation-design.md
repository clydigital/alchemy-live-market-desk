# A3 Regime/Story Reevaluation Propagation — Design

## Status

Approved design direction. This spec is implementation-authoritative for A3 only.

## Goal

Propagate Dossier System 2 Motion acceptance into the existing canonical Story reevaluation path so accepted/refined ideas can cause the correct persistent Stories to be reconsidered, while preserving the one-way evidence architecture:

```text
canonical evidence
→ Dossier System 2
→ Motion ACCEPT / REFINE
→ Story reevaluation request
→ canonical Story assessment / mutation
→ Regime projection
```

Motion remains attention and framing context. It never becomes canonical evidence and never directly mutates a Story or Regime.

## Scope

A3 includes:

- deterministic propagation from A2 `motion_acceptance` decisions;
- bounded routing to existing persistent Stories;
- use of existing `intelligence_reevaluation_queue`;
- canonical evidence IDs as the only evidence pointers used by propagation;
- explicit auditability from Dossier decision to Story reevaluation;
- existing Story-engine → Regime projection as the only Regime mutation path;
- regression coverage proving no Motion-to-evidence or Regime feedback loop is introduced.

A3 does not include:

- B1 replacement of Story-change-only Motion promotion;
- B2 regime-/investigation-only acceptance;
- B3 Research Gap / Hybrid propagation;
- a new Hybrid reasoning path;
- a second Story reasoning engine;
- a separate Regime reevaluation queue;
- direct Dossier mutation of persistent Story or Regime state;
- Rates audits;
- the Research Brain `max_output_tokens` cleanup;
- the Hybrid snapshot cache-size cleanup.

## Existing architecture A3 must reuse

### Dossier

`lib/dossier-v2/execution.ts` already:

1. obtains or deterministically patches a Research Brain output;
2. persists the immutable Market Dossier;
3. queues evidence-backed Story refresh candidates through `enqueueDossierStoryRefreshAgenda`;
4. invokes `persistRegimeShadowProjectionSafely({ trigger: "dossier" })`.

A2 added bounded `motion_context` input and `motion_acceptance` output with the following invariant:

- `ACCEPT` and `REFINE` require canonical evidence IDs;
- `UNRESOLVED` and `REJECT` do not establish conclusions;
- Motion IDs are not members of the canonical evidence ID set.

### Story review

`intelligence_reevaluation_queue` is already the durable request channel for persistent Story reconsideration.

Queue rows carry:

- `target_kind = "story"`;
- `target_id = <story UUID>`;
- `requested_by_evidence_id = <canonical intelligence_evidence UUID> | null`;
- `reason`;
- `priority`;
- lifecycle fields.

The normal Story review runtime already:

- loads explicit queue rows;
- loads requested canonical evidence;
- caps review targets;
- applies material mutation only when eligible non-creator canonical evidence exists;
- can explicitly wake archived Stories.

A3 must reuse that exact path.

### Regime

Regime projection already follows Story state:

```text
Story engine completes
→ persistRegimeShadowProjectionSafely({ trigger: "story_engine" })
→ Regime projection consumes latest Story thesis versions
```

The Regime subsystem also has deterministic System 1 → Story activation, but Regime output is not canonical evidence.

A3 must preserve the hard direction:

```text
Evidence → Story reasoning → Regime projection
```

A Regime projection must not recursively author or mutate Story conclusions.

## Architectural decision

A3 adds one focused adapter:

`lib/dossier-v2/reevaluation-propagation.ts`

Its job is to convert A2 Motion acceptance into a bounded, auditable Story reevaluation plan, then enqueue that plan through the existing Story queue.

It does not perform Story reasoning.

It does not perform Regime reasoning.

It does not decide whether a Story thesis changes.

It only decides which existing Story(s) should be reviewed, using A2 routing output and existing Regime↔Story relationships.

## Contract

### Propagation contract version

```ts
export const DOSSIER_REEVALUATION_PROPAGATION_CONTRACT_VERSION =
  "dossier-reevaluation-propagation/1";
```

### Plan item

```ts
export type DossierReevaluationPropagationItem = {
  motion_id: string;
  decision: "ACCEPT" | "REFINE";
  canonical_evidence_id: string;
  target_story_id: string;
  target_story_slug: string;
  target_regime_slug: string | null;
  route_kind: "explicit_story" | "regime_core" | "regime_bridge";
  priority: number;
  reason: string;
};
```

### Plan

```ts
export type DossierReevaluationPropagationPlan = {
  contract_version: "dossier-reevaluation-propagation/1";
  items: DossierReevaluationPropagationItem[];
  omitted_count: number;
  warnings: string[];
};
```

### Execution result

```ts
export type DossierReevaluationPropagationResult = {
  contract_version: "dossier-reevaluation-propagation/1";
  dossier_id: string;
  planned: number;
  enqueued: number;
  skipped_existing: number;
  omitted_count: number;
  items: DossierReevaluationPropagationItem[];
  warnings: string[];
};
```

The plan/result is audit metadata, not evidence.

## Eligibility rules

Only A2 decisions with:

- `decision === "ACCEPT"` or `decision === "REFINE"`;
- at least one `canonical_evidence_ref`;

are eligible for A3 propagation.

`UNRESOLVED` does not propagate automatically.

`REJECT` does not propagate automatically.

A3 never derives a new evidence ID from:

- Motion ID;
- Motion `origin_evidence_ref` unless that exact ID is already present in the A2 decision's validated `canonical_evidence_refs`;
- Motion verification state;
- Motion lifecycle / promotion state;
- Motion materiality/relevance/novelty;
- Motion prose;
- Motion market reaction.

The only queue evidence pointer is an ID from the validated A2 `canonical_evidence_refs` array.

## Destination routing

### 1. Explicit Story destination

If an eligible decision contains:

`STORY:<story-id>`

and that Story exists, is not discarded, and is present in the persistent Story registry, it is the first routing choice.

The canonical evidence ID is paired with that Story.

### 2. Regime destination

If an eligible decision contains `REGIME:CURRENT`, A3 uses the corresponding Motion item's `primary_regime_slug`.

A3 then reads existing Regime↔Story links from the persisted Regime routing layer.

Candidates are ranked by:

1. route role: `core` before `bridge` before `supporting`;
2. existing route score, descending;
3. current Story thesis confidence, descending;
4. Story ID as deterministic tie-break.

Automatic fan-out for one Regime-routed decision is capped at:

- one core Story;
- up to two bridge/supporting Stories.

If no Regime link clears the existing routing relationship, A3 records a warning and does not force a weak Story mapping.

### 3. Other destinations

For A3:

- `MAIN_THREAD` is not a persistent Story target by itself;
- `INVESTIGATION:<id>` is not propagated automatically;
- `THESIS:<id>` is not propagated automatically;
- `RESEARCH_NOW` is not propagated automatically.

Those destinations remain available for later roadmap work.

## Global bounds

A3 respects the existing Story review budget.

The propagation plan may contain at most:

`MAX_STORY_REVIEW_TARGETS = 4`

unique Story targets per Dossier execution.

If multiple Motion decisions map to the same Story:

- collapse to one Story/evidence request for each unique canonical evidence ID;
- preserve the highest priority;
- merge audit reason fragments deterministically.

If more than four unique Story targets are eligible, rank by:

1. explicit Story destination;
2. `ACCEPT` before `REFINE`;
3. Regime role: core before bridge/supporting;
4. priority;
5. Story ID.

Increment `omitted_count` for overflow.

## Queue semantics

A3 enqueues through `intelligence_reevaluation_queue`.

Each inserted row must use:

```text
target_kind = story
target_id = target_story_id
requested_by_evidence_id = canonical_evidence_id
status = pending
available_at = Dossier packet as_of
```

The queue `reason` is audit context only and must use a deterministic prefix:

```text
dossier_motion_acceptance:<dossier-id>:<motion-id>:<decision>
```

Optional route detail may follow after `|`.

Example:

```text
dossier_motion_acceptance:7dd...:4ea...:REFINE | regime:us-rate-regime | role:core
```

The reason string must never be interpreted as evidence.

## Duplicate handling

Before insert, A3 checks open queue rows with:

- same `target_kind = story`;
- same `target_id`;
- same `requested_by_evidence_id`;
- status in `pending`, `processing`, or `retryable`.

Such rows count as `skipped_existing`.

A prior queue row for the same Story but a different canonical evidence ID does not suppress the new request.

A prior System 1 activation row with `requested_by_evidence_id = null` does not suppress an A3 evidence-backed reevaluation.

## Dossier audit persistence

The Dossier should retain the A3 propagation intent before execution so the immutable Dossier explains why later Story reevaluation was requested.

Add:

```ts
payload.reevaluation_propagation = {
  contract_version: "dossier-reevaluation-propagation/1",
  items: [...planned items...],
  omitted_count,
  warnings,
}
```

This is a plan snapshot, not a claim that queue insertion succeeded.

The post-persistence `DossierV2ExecutionResult` returns the execution result including `enqueued` and `skipped_existing`.

The queue itself remains the source of truth for whether the reevaluation request was durably created.

## Execution order

A3 changes Dossier persistence flow to:

```text
Research Brain / deterministic Dossier patch
↓
build canonical Dossier input
↓
build A3 propagation plan using:
  - motion_acceptance
  - bounded motion_context
  - existing Story registry
  - existing Regime↔Story links
↓
attach plan snapshot to Dossier payload
↓
persist immutable Dossier
↓
enqueue A3 Story reevaluations
↓
run existing generic Dossier Story refresh agenda
↓
run existing Regime shadow projection
```

The generic Dossier Story refresh agenda stays in place. A3 does not replace it.

A3 requests are more explicit because they originate from System 2 Motion adjudication. The existing generic refresh agenda remains useful for other evidence-backed Dossier attention.

## Story mutation rules remain unchanged

A3 queueing does not authorise thesis mutation.

The existing Story assessment path remains final authority.

For a material Story change, existing rules still require eligible canonical evidence.

Creator-only / transcript-only material mutation remains blocked.

Invalidation keeps its stricter source/corroboration requirements.

Archived Story revival continues through the existing canonical review path.

## Regime propagation rules

A3 does not write `market_regime_current`, Regime versions, Regime Story links, or Regime snapshots directly.

A Story reassessment may result in:

- unchanged Story;
- reinforced Story;
- updated Story;
- weakened Story;
- invalidated Story;
- archived/revived Story according to existing lifecycle rules.

After the Story engine completes, the existing call:

```ts
persistRegimeShadowProjectionSafely({
  trigger: "story_engine",
  triggerRef: engineRunId,
})
```

projects the latest accepted Story state into Regimes.

No additional A3 Regime mutation service is created.

## Cycle guard

The following is forbidden:

```text
Regime projection
→ synthetic canonical evidence
→ Story mutation
→ Regime projection
```

Regime telemetry may continue to create the existing non-evidentiary System 2 Story activation requests, but those rows use `requested_by_evidence_id = null` and do not satisfy a material mutation gate by themselves.

A3 must not change that behavior.

## Error handling

Propagation is secondary to Dossier persistence.

If A3 plan construction fails because optional routing tables are unavailable:

- persist the Dossier with an empty propagation plan;
- add a warning;
- continue existing Dossier Story refresh and Regime projection.

If queue insertion fails after Dossier persistence:

- return a propagation warning in `DossierV2ExecutionResult`;
- do not roll back the Dossier;
- do not fabricate a successful queue result.

A3 failures must not convert Motion into evidence as a fallback.

## Files expected to change

Create:

- `lib/dossier-v2/reevaluation-propagation.ts`
- `tests/dossier-reevaluation-propagation.test.ts`

Modify:

- `lib/dossier-v2/execution.ts`
- `lib/dossier-v2/contracts.ts` only if a stronger typed payload helper is useful; the top-level `payload` remains backward-compatible
- existing Dossier execution tests as needed for the new result field
- optionally `lib/regime-system2-activation.ts` only to reuse/extract deterministic route-role ranking; do not change System 1 activation semantics

Do not modify for A3:

- `lib/market-motion-promotion.ts`
- Hybrid publication or presentation reasoning
- Research Gap propagation
- Motion promotion policy
- Regime persistence schema unless current Regime↔Story link reads prove insufficient

## Database expectation

A3 should not require a migration if the current Regime Story-link table exposes:

- Story ID;
- Regime identity/slug relation;
- role;
- route score or equivalent ranking field.

If the current link schema lacks enough information for deterministic bounded routing, implementation must stop and amend this spec before adding a migration. Do not infer routing from prose when a canonical link is unavailable.

## Test requirements

### Propagation eligibility

Prove:

- ACCEPT with canonical evidence can produce a Story reevaluation plan.
- REFINE with canonical evidence can produce a Story reevaluation plan.
- UNRESOLVED produces no automatic propagation.
- REJECT produces no automatic propagation.

### Evidence firewall

Prove:

- a Motion ID cannot become `requested_by_evidence_id`;
- a Motion `origin_evidence_ref` absent from the validated A2 decision cannot become queue evidence;
- every planned queue evidence ID is present in the Dossier packet canonical evidence set;
- Motion market-reaction prose does not create an evidence pointer.

### Routing

Prove:

- explicit `STORY:<id>` wins over inferred Regime routing;
- `REGIME:CURRENT` routes through existing Regime↔Story links;
- core outranks bridge/supporting;
- one Regime decision fans out to no more than three linked Stories;
- all A3 Story targets remain within the global four-target Story-review cap;
- no weak route is invented when the Regime has no linked Story.

### Queue behavior

Prove:

- duplicate Story + evidence open rows are skipped;
- same Story + new evidence is allowed;
- a null-evidence System 1 activation row does not suppress an A3 request;
- archived Stories can be queued through the same canonical path.

### Persistence and execution

Prove:

- Dossier payload stores the propagation plan snapshot;
- Dossier persists even if A3 queue insertion fails;
- execution result reports queue failure without claiming success;
- existing generic Story refresh agenda still runs;
- existing Regime projection still runs after Dossier persistence.

### Cycle guard

Prove by source-level or behavioral regression that:

- A3 does not write Regime state directly;
- Regime projection is not added to any canonical evidence collection;
- Regime System 1 activation remains `requested_by_evidence_id = null`.

## Acceptance criteria

A3 is complete when all of the following are true:

1. A2 ACCEPT/REFINE can deterministically wake the correct persistent Story(s).
2. Every A3 queue request is backed by canonical evidence already validated by A2.
3. Motion remains non-evidentiary.
4. Story mutation still occurs only through the existing canonical Story review engine.
5. Regime mutation still occurs only through the existing Story-driven projection path.
6. Automatic fan-out is bounded.
7. Duplicate queue requests are idempotently suppressed.
8. The immutable Dossier records the propagation plan for audit.
9. Hybrid remains read-only.
10. Full tests, typecheck, production build and DB contracts remain green.
