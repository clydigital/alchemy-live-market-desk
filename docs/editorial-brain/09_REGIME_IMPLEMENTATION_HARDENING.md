# Regime Implementation Hardening & Failure Modes

## Purpose

This document hardens the [Regime / Story Operating Framework](08_REGIME_STORY_OPERATING_FRAMEWORK.md) before production implementation.

The goal is not to add more product surface. It is to prevent the new Regime layer from creating duplicate truth, stale interpretation, noisy updates, historical corruption, recursive feedback loops or a second research brain.

The rules below are binding implementation constraints.

## 1. Canonical ownership matrix

Every output must have one owner.

| Object / decision | Canonical owner | May consume | Must not do |
|---|---|---|---|
| Raw acquisition | existing source adapters | provider payloads | infer market meaning |
| Canonical evidence | existing evidence normalisation | raw acquisition | invent missing observations |
| System 1 telemetry | deterministic sensor contracts | canonical evidence | write Story thesis |
| What's New | delta/event projection | canonical evidence + accepted interpretation state | become a second thesis store |
| Hypothesis / Challenger | existing intelligence runtime | canonical evidence | bypass provenance |
| Story thesis/version | existing Story persistence path | accepted System 2 reasoning | be rewritten by Regime UI |
| Regime current projection | Regime projector | pinned Story versions + System 1 sensor snapshots | reread raw news independently |
| Regime version | Regime projector materiality gate | current Regime projection | version routine noise |
| Hybrid | presentation snapshot | exact canonical Live snapshots | re-reason claims |
| Dossier / Journey / Power Stack | downstream consumers | canonical Live state | mutate Story or Regime |

There must remain one write path for analytical truth: Live.

## 2. Single canonical System 1 sensor layer

### Current risk

Dossier V2 already owns a deterministic `rate-regime/1` computation and System 1 dollar-liquidity logic. Building a separate Rates Regime calculator would create two competing answers for the same market state.

### Required design

The new Regime layer must not implement a second rate calculator.

Initial implementation:

1. Treat the existing Dossier V2 `rate-regime/1`, policy-outlook and dollar-liquidity outputs as canonical System 1 sensor contracts.
2. The Regime projector consumes those outputs or the same exact functions.
3. The Regime UI never recomputes them independently.

Target refactor:

```text
canonical evidence
      ↓
shared System 1 sensor library
      ↓
 ┌──────────────┬──────────────┬──────────────┐
 ↓              ↓              ↓              ↓
Regime UI     Dossier       Research Brain   Hybrid
```

Move deterministic sensor code to a shared domain layer only after parity tests prove byte-equivalent output to the existing Dossier contracts.

Every sensor must have:

- contract version;
- exact canonical inputs;
- thresholds/rules;
- missing-data semantics;
- freshness limits;
- evidence references;
- deterministic tests.

No LLM call is allowed inside a System 1 sensor.

## 3. Regime state is not a blended score

### Current risk

Combining sub-regime confidence, Story confidence, source count and direction into one opaque number would create false precision and make debugging impossible.

### Required design

Keep these separate:

- observed System 1 telemetry;
- subgroup interpreted state;
- subgroup confidence;
- evidence coverage;
- source-verification state;
- Story confidence;
- momentum;
- parent Regime interpretation.

Do not calculate parent Regime confidence by averaging child confidence.

The parent Regime should expose the reasoning vector that supports its state:

```text
Rates Regime
- Fed / Front End: restrictive, high coverage
- Treasury / Fiscal: stress rising, medium coverage
- Long End: restrictive, high coverage
- Global Rates / Japan: stress rising, medium coverage
- Credit: tightening, partial coverage
- Housing: restrictive, medium coverage
```

System 2 may synthesize that vector into a parent interpretation, but the UI must preserve the component states.

If a future numeric aggregate is introduced, its formula must be deterministic, versioned and independently testable. Until then, prefer explicit vectors over one blended score.

## 4. Snapshot consistency and concurrency

### Current risk

System 1 telemetry can update while System 2 is reasoning. Several Stories can also update during one Regime projection. Without a pinned input manifest, one Regime page could combine incompatible vintages.

### Required design

Every Regime projection must pin an immutable input manifest:

- Regime ID;
- projector contract version;
- Story IDs;
- exact Story thesis-version IDs;
- exact System 1 sensor contract versions;
- exact sensor snapshot/as-of values;
- evidence IDs used for contribution nodes;
- projection generated-at timestamp.

The projector must calculate an idempotency key from that manifest.

Requirements:

1. Replaying the same manifest must not create another Regime version.
2. Concurrent projection attempts for the same Regime must serialize or resolve by idempotency key.
3. A newer projection must not be overwritten by a late worker using an older manifest.
4. The persisted Regime version must retain the input manifest for audit.
5. UI reads one accepted projection atomically rather than assembling a page from live tables with independent timestamps.

## 5. Event time, arrival time and revisions

Markets regularly receive late, revised or corrected data.

Store and distinguish:

- `event_at`: when the event occurred;
- `published_at`: when the source published it;
- `available_at`: when the system could have known it;
- `received_at`: when Live received it;
- `supersedes_evidence_id`: when a later record revises an earlier observation.

Current-state mutation order follows accepted evidence availability/revision lineage, not merely the oldest or newest `event_at`.

A late-arriving historical article may be useful context but must not overwrite a newer accepted Story solely because its event date is earlier.

A revision creates an append-only correction/supersession path. Never silently edit the prior What's New record.

## 6. What's New lifecycle and noise control

### Current risk

A raw chronological feed can become spammy, while an `INTERPRETATION PENDING` item can remain unresolved forever.

### Required states

A material delta can be:

- `observed_pending`;
- `interpreted_material`;
- `interpreted_context`;
- `superseded`;
- `corrected`;
- `retracted`;
- `failed_interpretation`.

### Delta identity

Use a deterministic fingerprint from canonical evidence/event identity, not headline text.

Repeated reports from the same ancestry group should collapse into one delta cluster.

### Pending interpretation

Every `observed_pending` item must carry:

- queued-at;
- reason for System 2 escalation;
- target Story/Regime candidates if known;
- interpretation status;
- retry count;
- last error;
- next retry / expiry.

If the interpretation queue exceeds its freshness SLA, show **Interpretation delayed** rather than leaving the item looking live but unexplained.

### Feed limits

What's New should prefer material deltas, not every ingestion event.

Reader-facing feed should collapse:

- duplicate reporting;
- repeated unchanged monitor readings;
- article rewrites with no new fact;
- source echoes from the same ancestry group.

## 7. Story headline churn guard

### Current risk

Allowing visible Story titles to update can make the page feel current, but a model could rephrase the same thesis every run and destroy continuity.

### Required rule

A Story headline can change only when a material accepted Story version is created.

No headline-only thesis version is allowed.

The accepted update must include at least one material change to:

- current thesis;
- central question;
- accepted explanation;
- causal mechanism;
- lifecycle;
- confirmation/invalidation;
- decisive next test;
- dominant current state.

Persist:

- prior headline;
- new headline;
- headline-change reason;
- Story thesis-version ID that authorised it.

Routine reinforcement should normally keep the current headline.

Historical drawers always render the headline stored on that exact version.

## 8. Story identity drift and split/merge rules

A Story should not remain the same object forever merely because the slug already exists.

System 2 must compare:

- unresolved question;
- causal mechanism;
- affected asset set;
- decisive evidence lineage;
- confirmation/invalidation;
- horizon.

If the new thesis no longer shares the durable causal question, create a distinct Story and relate it using the existing Story-relation system rather than mutating identity beyond recognition.

Story merge/supersession must preserve redirects and prior history.

## 9. Cross-Regime fan-out and cycle guard

### Current risk

A bridge Story such as AI Financing Stress can legitimately affect AI and Cost of Capital. If Regime changes recursively trigger more Story reasoning, the system can create feedback storms.

### Required rule

Regime projection is one-way:

```text
Evidence → Story reasoning → Regime projection
```

A Regime projection is **not canonical evidence** and must not automatically trigger Story synthesis.

A Regime may create a research suggestion or reevaluation request, but it cannot recursively mutate another Regime.

Automatic Story-to-Regime fan-out should be bounded:

- one primary/core Regime;
- up to two automatic supporting/bridge Regimes;
- additional links require manual/governed approval.

This prevents every important Story from appearing everywhere.

## 10. Regime, subgroup and Concept lifecycle

The framework needs lifecycle rules, not only creation rules.

### Regime

Statuses:

- active;
- dormant;
- retired.

A Regime is retired, never deleted, when the structural question is no longer useful.

### Sub-regime

Statuses:

- active;
- dormant;
- retired.

Sub-regimes can be renamed without changing identity. Splits and merges require aliases/redirects and effective dates.

### Concept

Statuses:

- active;
- deprecated.

Concept definitions should be versioned when materially changed. Aliases remain stable so causal nodes do not fragment.

Never reuse a retired ID or slug for a new semantic object.

## 11. Unmapped and ambiguous Stories

No Story should disappear because routing failed.

If no Regime clears the routing threshold:

- keep the Story visible in Stories;
- mark it `unassigned`;
- add routing debt;
- do not force a weak Regime mapping.

If two Regimes are plausible and the routing evidence is insufficient:

- mark the secondary relation unresolved;
- do not duplicate the Story;
- queue System 2 or manual review only if material.

Track the count and age of unassigned active Stories as a health metric.

## 12. Telemetry / interpretation time skew

### Current risk

System 1 may be current to 06:00 while System 2's accepted interpretation is from 21:00 the previous day.

The UI must show both timestamps.

Example:

```text
Observed telemetry: 06:01
Interpreted state: 22:14 yesterday
Status: NEW TELEMETRY — INTERPRETATION PENDING
```

Never present the older interpretation as though it incorporates the newest telemetry.

If the skew exceeds the Regime's configured limit, mark the interpreted state stale/degraded.

## 13. Materiality and version-churn control

Routine sensor movement may update the live projection without creating another immutable Regime version.

A new Regime version requires a reason code:

- `state_changed`;
- `dominant_driver_changed`;
- `core_story_reframed`;
- `core_story_invalidated`;
- `bridge_story_added_materially`;
- `support_contradiction_balance_changed`;
- `confirmation_state_changed`;
- `next_decisive_test_changed`;
- `manual_governance_revision`.

Persist the reason code and changed fields.

Do not create a version merely because:

- a timestamp changed;
- confidence moved trivially;
- another duplicate source arrived;
- the same monitor printed an unchanged value;
- a headline was reworded.

## 14. Contribution-node ranking and visual limits

Without limits, mechanism pages become unreadable.

Default per subgroup:

- maximum 6 visible contribution nodes;
- maximum 4 current Story cards before "show more";
- maximum 3 strongest causal paths highlighted at once.

Rank contribution nodes by:

1. materiality to the current subgroup state;
2. evidence independence;
3. freshness;
4. verification quality;
5. whether the node resolves/changes a current test.

Older or context-only nodes remain accessible in history/evidence views.

## 15. Bootstrap and historical reconstruction

### Current risk

The first Regime rollout will happen after years/months of Story history. Inferring old Regime states retroactively would create false historical certainty.

### Required bootstrap

On first production migration:

1. create governed Regime/sub-regime identities;
2. map current active Stories;
3. create one baseline Regime version labelled `bootstrap_current_state`;
4. pin the exact current Story versions used;
5. do not claim this baseline existed historically.

Any later historical reconstruction must be an explicit backfill job and versions must be labelled `reconstructed`, never indistinguishable from contemporaneously generated state.

## 16. Manual governance and overrides

The system needs a controlled human-governance path for taxonomy, not a hidden manual rewrite of analytical truth.

Manual actions may:

- create/retire Regimes;
- create/retire/rename sub-regimes;
- approve additional Story-to-Regime links;
- lock a mapping;
- define Concept aliases;
- correct taxonomy mistakes.

Manual actions must record:

- actor;
- timestamp;
- reason;
- before/after state.

Manual taxonomy governance must not directly fabricate evidence, Story confidence or thesis conclusions.

## 17. Public/private data boundary

Regime pages and Hybrid must follow the existing redacted publication model.

Public Regime projections may expose:

- approved Story summaries;
- approved causal explanations;
- public evidence references;
- public monitors;
- public provenance URLs where allowed.

They must not expose:

- raw creator transcripts;
- private analyst notes;
- private prompt/stage payloads;
- internal source-access credentials;
- private-only evidence metadata.

New Regime tables/views require RLS and policy tests before public use.

## 18. Read-model and performance contract

Do not build Regime pages by joining the entire evidence graph at request time.

Persist a bounded current Regime projection/read model containing the data needed for initial render:

- Regime summary;
- subgroup states;
- current Story refs;
- top contribution nodes;
- next tests;
- timestamps;
- health/degradation state;
- exact version IDs.

Load detailed evidence, history and Concepts lazily.

Requirements:

- no N+1 Story/evidence requests;
- bounded initial payload;
- version-keyed cacheability;
- one accepted projection per Regime for current read;
- full evidence remains available on drill-down.

## 19. Observability and health

The Regime system must expose at least:

- System 1 sensor age by Regime/subgroup;
- last successful projector run;
- projector lag;
- pending interpretation count and oldest age;
- failed interpretation count;
- failed projection count;
- unmapped active Story count;
- stale subgroup count;
- evidence-dedup collapse count;
- Story-to-Regime fan-out distribution;
- Regime-version churn rate;
- Hybrid snapshot lag/parity state;
- current projector/sensor contract versions.

A green page with stale interpretation is a failure.

## 20. Shadow rollout, feature flags and rollback

Do not turn automatic Regime mutation on at the same time the UI launches.

Recommended rollout:

### Stage A — shadow projection

- projector computes candidate Regime state;
- nothing reader-facing changes;
- compare against analyst expectations and Dossier's existing Rate Regime.

### Stage B — read-only Regime UI

- display governed manual mappings and current Story state;
- System 1 telemetry visible;
- no automatic Regime version creation.

### Stage C — automatic projection, manual version gate

- projector proposes state changes;
- versions require approval or a temporary explicit gate.

### Stage D — automatic versioning

- enable only after idempotency, race, parity and churn tests remain stable.

Provide independent kill switches for:

- Regime UI;
- automatic Story-to-Regime routing;
- automatic Regime version persistence;
- Hybrid Regime deep links.

Disabling Regimes must leave the current Story/Dossier/Journey path operational.

## 21. Hybrid deep-link version pinning

A link from the current page may use a stable slug.

A link from history/audit must pin the immutable version/snapshot.

Examples:

```text
/hybrid-output?story=ai-financing-stress
/hybrid-output?story=ai-financing-stress&version=<story-version-id>
/hybrid-output?regime=global-cost-of-capital&version=<regime-version-id>
/hybrid-output?event=<event-id>
```

Hybrid must show when it is rendering historical versus current state.

## 22. Required failure behaviour

When a dependency fails, degrade explicitly.

Examples:

- System 1 sensor missing → subgroup telemetry `UNRESOLVED`;
- System 2 failed → keep last accepted interpretation and show `INTERPRETATION DELAYED`;
- projector failed → keep last accepted Regime projection and show stale timestamp;
- Hybrid snapshot failed → Live remains canonical and the Hybrid link shows unavailable/stale;
- routing failed → Story remains visible as unassigned;
- evidence correction arrives → append correction/supersession, do not erase history.

Never manufacture a state to make the interface look complete.

## 23. Additional acceptance tests

Implementation is not complete until these pass.

### Single-sensor-source test

Rates shown in Regime UI and Dossier derive from the same `rate-regime/1` sensor output or a byte-equivalent shared successor contract.

### Idempotency test

Replaying the same Story versions and sensor snapshots produces no duplicate Regime version.

### Concurrency test

Two workers projecting the same Regime cannot create conflicting accepted versions.

### Late-evidence test

Late historical evidence cannot overwrite newer accepted state merely because its `event_at` is older.

### Revision test

A corrected official release supersedes the prior evidence and creates a visible correction path.

### Pending-interpretation test

A verified What's New item remains visible when System 2 fails and clearly shows delayed interpretation rather than false completion.

### Headline-churn test

Repeated reinforcement of the same thesis does not keep changing the Story headline.

### Identity-drift test

A fundamentally different causal question creates a related distinct Story rather than mutating the old Story beyond recognition.

### Cycle test

A Regime projection cannot recursively become evidence and trigger itself or another Regime.

### Fan-out test

Automatic routing cannot attach one Story to an unbounded number of Regimes.

### Bootstrap test

Initial Regime baselines are labelled bootstrap and are not presented as historical states.

### Security test

Public Regime/Hybrid reads cannot expose private transcript, prompt, analyst-note or private-evidence payloads.

### Degraded-state test

System 1 freshness, System 2 interpretation age and Regime projector age are independently visible.

### Performance test

Initial Regime render uses the bounded current projection and does not fan out into unbounded evidence joins.

### Rollback test

All Regime feature flags can be disabled without breaking existing Stories, What's New, Dossier or Journey.

## Final hardening principle

The Regime layer is an **organising and state-projection layer**, not a new source of truth.

If an implementation choice makes the Regime system capable of inventing evidence, bypassing Story reasoning, recursively influencing itself, or silently replacing stale interpretation with fresh-looking prose, the implementation is wrong.
