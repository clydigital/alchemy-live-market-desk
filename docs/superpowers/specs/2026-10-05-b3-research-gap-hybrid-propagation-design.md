# B3 Research Gap / Hybrid Propagation — Design

## Status

Approved written specification. Implementation-authoritative for B3 only.

## Goal

Close the Dossier → Research Gap → canonical research → Hybrid loop without creating a second reasoning source.

B3 makes two architectural changes:

1. New Research Gap work becomes Dossier-authoritative. The worker no longer creates new cases directly from `current_market_motion_items`.
2. Hybrid may show exact Research Gap lifecycle status for current Dossier-derived work, but must never expose Research Gap research outcomes, verdicts or conclusions before those findings return through canonical research and a later canonical Dossier.

The intended flow is:

```text
canonical Evidence
→ Motion
→ B2 Dossier System 2
→ Dossier research_gap / research_now / investigation
→ Research Gap lifecycle
→ web research
→ canonical research handoff
→ canonical Evidence / Story intelligence
→ next canonical Dossier
→ Hybrid reasoning
```

Hybrid may observe lifecycle progress alongside this flow:

```text
Dossier-derived gapKey
→ exact research_gap_cases.gap_key
→ NEW / QUEUED / CLAIMED / RESEARCHING / COMPLETED / HANDED_OFF / CLOSED
→ Hybrid status only
```

Lifecycle status is operational metadata, not market reasoning.

## Why B3 is needed

B1 and B2 established the correct Motion reasoning boundary:

```text
Motion
→ exact canonical Evidence corroboration
→ Dossier System 2
→ bounded Story / Regime / Investigation routing
```

However, the current Research Gap worker still has a legacy direct path:

```text
current_market_motion_items
→ marketMotionInvestigationEligibility(...)
→ Research Gap candidate
```

That path independently re-reads promoted Motion and can create Research Gap work without requiring a B2 Motion acceptance decision in the Dossier. It therefore bypasses the System 2 boundary B2 was designed to establish.

At the same time, the worker already has Dossier-native sources:

- `dossier.research_gaps`;
- `analytical_output.research_now`;
- `analytical_output.investigations`.

Dossier persistence already calls `syncLatestPrioritisedResearchGapCases(...)`, which materialises selected Dossier-derived work into the existing `research_gap_cases` lifecycle.

The scheduled `research_gap_cycle` already:

1. retries completed-but-unhanded cases;
2. researches exactly one queued case;
3. hands the completed result into canonical `/api/research-update`;
4. marks the case `HANDED_OFF` only after successful canonical admission.

The canonical handoff runs the normal research/intelligence path, but it does not itself run Dossier V2 afterwards. Therefore Hybrid must not treat a successful handoff as a new Dossier conclusion.

## Architectural principles

B3 preserves these hard invariants:

1. The Dossier is the only System 2 analytical authority surfaced by Hybrid.
2. Motion remains non-evidentiary and cannot directly create new Research Gap work after B3.
3. Research Gap performs evidence acquisition, not Story / Regime / Dossier reasoning.
4. Research Gap outcomes are not Hybrid conclusions.
5. `HANDED_OFF` means the result returned to canonical research; it does not mean the current Dossier incorporated it.
6. Hybrid may show lifecycle status only.
7. Hybrid must not load Research Gap verdict/outcome payloads into its status projection.
8. Exact `gapKey` identity is required for Dossier↔Research Gap status joins.
9. No fuzzy question, Story, Investigation, ticker or prose matching is allowed.
10. Historical `market_motion` Research Gap cases remain readable and operational; B3 only stops creating new ones.
11. Existing Research Gap lifecycle, queue, handoff and canonical research APIs are reused.
12. No new reasoning engine, queue, database table or migration is introduced.

## Scope

B3 includes:

- removing new direct Market Motion candidate generation from the Research Gap work queue;
- removing the Research Gap worker's runtime query of `current_market_motion_items`;
- keeping `market_motion` source-kind compatibility for historical lifecycle cases;
- retaining the existing Research Gap queue/lifecycle contract version where additive compatibility permits;
- adding a read-only, safe Research Gap lifecycle-status projection for Hybrid;
- matching lifecycle cases to current Dossier-derived candidates by exact persistent `gapKey`;
- exposing only existing lifecycle state and safe provenance identifiers to Hybrid;
- retiring Hybrid wording/UI that claims raw Motion itself is directly Research Gap eligible;
- preserving the canonical research handoff path;
- preserving the requirement that conclusions appear in Hybrid only after a later canonical Dossier incorporates them;
- tests proving the bypass is removed and outcome leakage is impossible.

B3 does not include:

- automatically running Dossier V2 after Research Gap handoff;
- changing Research Gap web-research execution;
- changing Research Gap claim/lease semantics;
- changing Research Gap evidence acquisition;
- changing canonical research ingestion/handoff;
- changing Story reasoning;
- changing A3 Story reevaluation;
- changing Regime persistence;
- exposing Research Gap `research_outcome`, verdict, findings, confidence or evidence conclusions in Hybrid;
- migrating or deleting historical `market_motion` cases;
- closing historical cases merely because the new Dossier no longer emits direct Motion work;
- adding a new Research Gap source kind;
- database migrations.

## Existing architecture B3 must reuse

### Dossier-native Research Gap work sources

`lib/research-gap-worker.ts` already derives candidates from:

#### Canonical Dossier research gaps

```text
dossier.research_gaps
→ sourceKind = research_gap
→ persistentResearchGapKey(...)
```

#### Research Now

```text
payload.analytical_output.research_now
→ sourceKind = research_now
→ persistentResearchGapKey(...)
```

#### Investigations

```text
payload.analytical_output.investigations
→ sourceKind = investigation
→ persistentResearchGapKey(...)
```

These are the B3-authoritative source families.

### Legacy direct Motion candidate path

The same worker currently has:

```ts
marketMotionCandidates(
  dossier,
  rowsFromCurrentMarketMotionItems,
  now,
)
```

which creates:

```text
sourceKind = market_motion
```

without a Dossier Motion acceptance dependency.

B3 retires this as a producer.

### Research Gap identity

`persistentResearchGapKey(...)` already produces stable cross-Dossier identities from source-native fields.

B3 must reuse the exact same candidate construction and `gapKey` values for both lifecycle materialisation and Hybrid status lookup.

Hybrid must not reconstruct a parallel identity formula.

### Research Gap lifecycle

Existing statuses are exactly:

```text
NEW
QUEUED
CLAIMED
RESEARCHING
COMPLETED
HANDED_OFF
CLOSED
```

Existing outcomes are:

```text
CONFIRMING
CONTRADICTING
UNRESOLVED
NO_CHANGE
```

B3 exposes the status vocabulary to Hybrid but explicitly excludes the outcome vocabulary.

### Dossier persistence materialisation

The Dossier V2 persistence endpoint already calls:

```ts
syncLatestPrioritisedResearchGapCases(...)
```

after a persisted/no-change Dossier run.

The priority queue remains capped by the existing Research Gap prioritiser.

B3 does not add a second synchronisation path.

### Canonical Research Gap handoff

The scheduled Research Gap cycle already hands completed research into `/api/research-update`.

That path:

- validates and admits returned evidence through the canonical research intake;
- runs the existing intelligence engine when enabled;
- never allows caller-forced Story recalibration;
- marks the lifecycle case HANDED_OFF only after successful canonical admission.

B3 preserves this path unchanged.

## Design decision 1 — retire direct Motion → Research Gap production

### New Research Gap queue

After B3:

```text
buildResearchGapWorkQueue(dossier)
=
research_gap candidates
+ research_now candidates
+ investigation candidates
```

It must not append `market_motion` candidates.

### Runtime database reads

`loadLatestResearchGapWorkQueue(...)` must stop querying:

```text
current_market_motion_items
```

Research Gap work source loading should require only the latest valid canonical Dossier.

This is both an architectural and operational simplification:

```text
B2 Dossier decision
→ Dossier-native research work
→ Research Gap
```

rather than:

```text
B2 Dossier decision
↘
  direct Motion gate → Research Gap
```

### Historical compatibility

Keep the `ResearchGapWorkSource` union capable of representing:

```text
market_motion
```

because historical `research_gap_cases` and snapshots may contain it.

Keep lifecycle readers, claimers, handoff code and prioritiser compatibility with historical `market_motion` rows.

Do not:

- migrate them;
- delete them;
- rewrite their `source_kind`;
- automatically close them;
- block an already-materialised historical case from being claimed/researched/handed off.

B3 changes future production, not historical meaning.

### Queue contract compatibility

Keep:

```text
research-gap-work-queue/1
```

if the implementation can remain backward-compatible.

The existing diagnostic/source-count field:

```ts
sourceCounts.marketMotion
```

may remain for contract compatibility, but new queues must emit:

```text
marketMotion = 0
```

and diagnostics must no longer claim Motion can enter the queue directly.

Legacy `nativeSignals.motionAttention*` fields may remain optional/readable for old snapshots, but new Dossier-native candidates do not populate them.

## Design decision 2 — status-only Research Gap projection for Hybrid

Add a small read-only adapter, recommended file:

```text
lib/hybrid-research-gap-status.ts
```

Its job is:

1. derive the current Dossier's B3-authoritative Research Gap candidates using the canonical Research Gap worker identity helpers;
2. collect exact candidate `gapKey` values;
3. query lifecycle state only for those keys;
4. project safe lifecycle metadata to Hybrid.

It must not perform prioritisation, claims, research, handoff or reasoning.

### Safe database selection

The Hybrid status loader must select only fields needed for operational display, such as:

```ts
type HybridResearchGapLifecycleRow = {
  gap_key: string;
  status: ResearchGapCaseStatus;
  source_kind: ResearchGapWorkSource;
  source_ref: string;
  linked_investigation_ids: string[];
  linked_story_ids: string[];
  latest_dossier_id: string;
  latest_dossier_as_of: string;
  updated_at: string;
};
```

The Hybrid status adapter must use its own narrow lifecycle query/type.

It must not reuse:

- `listResearchGapCases(...)`;
- `ResearchGapCaseRow`;

because those existing lifecycle APIs intentionally load operational research fields that B3 must keep out of Hybrid's status projection.

The Hybrid status adapter must not select:

- `research_outcome`;
- `verdict`;
- `research_plan`;
- `handoff_canonical_status` if it is not required for status display;
- acquired evidence;
- finding text;
- confidence;
- live implication;
- next-test result;
- any other research conclusion payload.

This creates a structural firewall rather than relying only on UI discipline.

### Exact identity join

Hybrid status may join a lifecycle row only when:

```text
row.gap_key === currentDossierCandidate.gapKey
```

No fallback matching is allowed by:

- source_ref alone;
- question;
- action;
- Investigation title;
- Story ID;
- ticker;
- linked IDs;
- semantic similarity.

If there is no exact lifecycle row, Hybrid may simply show no lifecycle status for that Dossier work item.

It must not invent a lifecycle state such as `PENDING`.

### Projection contract

Recommended safe projection:

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
```

New current-Dossier status items never use `market_motion`.

The projection does not expose `ResearchGapOutcome`.

### Lifecycle display semantics

Hybrid may present existing statuses with operational wording only.

Suggested interpretation:

- `NEW` — materialised research item;
- `QUEUED` — waiting for research;
- `CLAIMED` — claimed by a worker;
- `RESEARCHING` — research in progress;
- `COMPLETED` — research complete; canonical handoff pending;
- `HANDED_OFF` — returned to canonical research; awaiting/subject to Dossier incorporation;
- `CLOSED` — lifecycle case closed.

These labels must not imply:

- confirming;
- contradicting;
- thesis changed;
- Regime changed;
- Dossier updated.

In particular:

```text
HANDED_OFF != incorporated into current Dossier
```

## Design decision 3 — Hybrid reasoning remains Dossier-only

B3 does not change:

```ts
buildHybridReasoningProjection(...)
```

to consume Research Gap verdicts.

Hybrid reasoning continues to derive from canonical Dossier/Story/Regime state only.

The safe separation is:

```text
Research Gap status
= operational progress

Dossier / Story / Regime
= accepted analytical meaning
```

A Research Gap case may be `COMPLETED` or `HANDED_OFF` while the current Dossier still shows the prior conclusion. Hybrid must preserve that prior canonical conclusion until a later Dossier changes it.

## Hybrid Motion UI boundary

The current Hybrid page includes a Motion-specific `marketMotionInvestigationEligibility(...)` path and wording that says the operational Research Gap worker uses the same direct Motion eligibility gate.

That becomes false after B3.

B3 must retire that presentation implication.

Hybrid may continue to show fresh Market Motion as the event/discovery layer, but:

- raw Motion must not be labelled directly Research Gap eligible;
- a Motion `next_test` may be displayed as context, not as an operational Research Gap claim;
- Motion should direct the user toward the canonical Dossier/System 2 route;
- actual Research Gap lifecycle status comes only from Dossier-derived `research_gap`, `research_now` or `investigation` identities.

No fuzzy Motion→Investigation join should be added merely to preserve the old UI.

## Current Dossier status surface

The existing Hybrid `Current handoff status` area is the preferred place to add the safe lifecycle summary.

Possible bounded display:

```text
Research Gap
2 active
1 researching
1 handed off
```

and/or a small list of exact Dossier-derived items with lifecycle badges.

The UI remains bounded and operational.

It must not display outcome badges such as:

```text
CONFIRMING
CONTRADICTING
NO_CHANGE
```

from `research_gap_cases`.

If the current Dossier has no exact materialised cases, show no Research Gap lifecycle records or a neutral “No materialised Research Gap lifecycle for this Dossier” message.

## Handoff / Dossier refresh semantics

The current scheduled `research_gap_cycle` does not run Dossier V2 after canonical handoff.

B3 intentionally does not change that.

After a successful handoff:

```text
Research Gap case = HANDED_OFF
canonical research = admitted
current Dossier = may still be older
Hybrid status = may show HANDED_OFF
Hybrid conclusion = still current Dossier
```

A later normal Dossier V2 run may incorporate the newly admitted canonical state.

This avoids turning Research Gap lifecycle machinery into an implicit Dossier reasoning trigger.

If a future roadmap item wants lower-latency Dossier refresh after handoff, that should be designed separately with its own concurrency/idempotency budget.

## Research Gap priority behavior

Removing direct Motion candidates means the priority queue scores only Dossier-authoritative candidates for new work:

- `research_gap`;
- `research_now`;
- `investigation`.

Existing prioritiser logic for `market_motion` may remain to preserve deterministic behavior for historical fixtures/snapshots or direct unit use.

No new source-weight scheme is needed for B3.

The existing maximum selected Research Gap count remains unchanged.

## Lifecycle synchronisation behavior

Dossier persistence continues to sync only the selected priority queue into `research_gap_cases`.

B3 does not require a lifecycle case for every Dossier research candidate.

Therefore:

```text
Dossier-derived candidate without exact research_gap_cases row
→ no lifecycle status in Hybrid
```

This is expected and must not be treated as an error.

Historical lifecycle cases absent from the latest Dossier remain historical operational records; B3 does not infer resolution from absence.

## Security / evidence boundary

Research Gap status is not canonical evidence.

Hybrid must not convert lifecycle status into analytical claims.

Examples:

Forbidden:

```text
COMPLETED → “the thesis is confirmed”
HANDED_OFF → “Dossier has incorporated bullish evidence”
RESEARCHING → “market uncertainty is elevated”
```

Allowed:

```text
COMPLETED → “Research complete; canonical handoff pending”
HANDED_OFF → “Returned to canonical research; current Dossier remains authoritative”
```

## Database expectation

No migration is required.

B3 reuses:

- `market_dossiers_v2`;
- existing Dossier JSON `research_gaps` and analytical output;
- `research_gap_cases.gap_key`;
- existing Research Gap lifecycle statuses;
- existing Research Gap handoff;
- existing canonical research path.

No new table, enum, foreign key, RPC or queue is added.

## Expected files

Likely modify:

- `lib/research-gap-worker.ts`
- `tests/research-gap-worker.test.ts`
- `lib/research-gap-prioritizer.ts` only if comments/tests need compatibility clarification
- `tests/research-gap-prioritizer.test.ts` only for compatibility regression
- `lib/hybrid-research-gap-status.ts` — new read-only safe status adapter
- `tests/hybrid-research-gap-status.test.ts` — new focused tests
- `app/hybrid-output/page.tsx`
- Hybrid page/workspace tests
- `docs/RESEARCH_GAP_WORKER.md`
- `docs/RESEARCH_GAP_LIFECYCLE.md`
- `docs/MACRO_PULSE_MOTION_BRIDGE.md` if the old direct Motion→Research Gap wording remains

Do not modify for B3:

- Research Brain contracts;
- A2/B2 Motion acceptance;
- A3 Story reevaluation queue;
- Regime engine/persistence;
- Research Gap database migrations;
- Research Gap claim/complete/handoff RPCs;
- canonical research-update semantics;
- Hybrid reasoning projection semantics.

## Test requirements

### Direct Motion bypass removal

Prove:

- `buildResearchGapWorkQueue(...)` emits `research_gap`, `research_now` and `investigation` candidates from the Dossier;
- it emits zero new `market_motion` candidates;
- adding current promoted Motion rows cannot create new Research Gap candidates;
- `sourceCounts.marketMotion === 0`;
- diagnostics no longer claim fresh promoted Motion enters the queue directly;
- `loadLatestResearchGapWorkQueue(...)` does not query `current_market_motion_items`.

### B2 → Research Gap authority

Prove:

- an Investigation created by B2 and persisted in Dossier analytical output can become an `investigation` Research Gap candidate;
- a Research Now item from Dossier can become a `research_now` candidate;
- raw Motion with the same next test but absent from Dossier outputs cannot independently create the case.

### Historical compatibility

Prove:

- `ResearchGapWorkSource` / lifecycle rows can still represent `market_motion`;
- historical `market_motion` cases remain readable;
- claim/research/handoff code is not gated against historical `market_motion` source kind;
- no migration or rewrite is required.

### Hybrid status safe loader

Prove:

- loader accepts current Dossier-derived gap keys;
- database query selects only the approved safe lifecycle columns;
- adapter does not reuse `listResearchGapCases(...)` or `ResearchGapCaseRow`;
- query does not select `research_outcome`, `verdict`, `research_plan` or research findings;
- exact `gap_key` match is required;
- unrelated lifecycle cases are excluded;
- historical `market_motion` case cannot appear merely through linked Story/Investigation similarity;
- missing lifecycle row produces no invented status.

### Hybrid projection

Prove:

- exact current Dossier `research_gap`, `research_now` and `investigation` rows may surface lifecycle status;
- projected type contains no outcome/verdict field;
- `COMPLETED` is rendered as operational handoff-pending state;
- `HANDED_OFF` is rendered as returned-to-canonical-research state, not Dossier-incorporated;
- `CLOSED` remains a lifecycle state, not an analytical conclusion.

### Hybrid reasoning firewall

Prove:

- `buildHybridReasoningProjection(...)` signature remains Dossier/Story/Event-based and does not take Research Gap verdicts;
- Research Gap lifecycle status does not alter Dossier headline, Story conclusion, Regime state, reasoning projection or calibration output;
- a HANDED_OFF Research Gap row plus an unchanged Dossier yields unchanged Hybrid analytical reasoning.

### Hybrid Motion UI

Prove:

- the old direct “Research Gap worker uses the same Motion eligibility gate” claim is removed;
- raw Motion is no longer labelled as directly Research Gap eligible;
- no Motion→Research Gap fuzzy link is introduced;
- user can still see Motion as event/discovery context.

### Handoff semantics

Lock the existing behavior with regression tests/documentation:

- Research Gap handoff enters canonical research;
- successful handoff may mark lifecycle `HANDED_OFF`;
- handoff does not itself claim the current Dossier was refreshed;
- B3 does not invoke Dossier V2 from Research Gap handoff.

## Acceptance criteria

B3 is complete when all of the following are true:

1. New Research Gap work is sourced only from current canonical Dossier `research_gaps`, `research_now` and `investigations`.
2. New direct `market_motion` Research Gap candidates are no longer produced.
3. Research Gap worker no longer queries `current_market_motion_items`.
4. Historical `market_motion` cases remain readable and operational.
5. Existing persistent `gapKey` identity remains the only Dossier↔Research Gap lifecycle join.
6. Hybrid may show only safe Research Gap lifecycle status for exact current-Dossier work.
7. Hybrid's Research Gap status loader never selects outcome/verdict/research findings.
8. Hybrid reasoning remains exclusively Dossier/Story/Regime-derived.
9. `COMPLETED` and `HANDED_OFF` never imply a changed Dossier conclusion.
10. Raw Motion is no longer presented as directly Research Gap eligible.
11. Canonical handoff behavior remains unchanged.
12. B3 does not trigger Dossier V2 after Research Gap handoff.
13. No new database table, migration, queue, RPC or reasoning engine is introduced.
14. Full tests, Task C, typecheck, production build and database contracts remain green.
