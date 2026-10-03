# Research Gap Durable Lifecycle

This layer makes prioritised Research Gap work persistent across Market Dossiers without creating a second analytical authority.

## Boundary

Research Gap lifecycle owns operational work state only:

```text
Dossier work + eligible promoted Market Motion
  + Dossier-assessed UNRESOLVED Motion with a concrete next test
  -> stable gap identity
  -> one shared priority queue / claim / lease
  -> research execution
  -> completed result
  -> canonical Live handoff
```

It does not decide Story or Regime truth.

Canonical Live remains responsible for interpreting admitted evidence and deciding whether a thesis, Story, Regime or investigation changes.

A Research Gap handoff is explicitly excluded from Market Motion ingestion, including the later transcript-review path. This prevents `Motion → Gap → Live handoff → Motion → Gap` recursion.

## Stable identity

Every normalised work candidate now has two IDs. Sources may be Dossier-native (`research_gap`, `research_now`, `investigation`), a fresh promoted `market_motion`, or a Dossier-assessed `UNRESOLVED` Motion carrying a concrete `investigation_next`. An unresolved Motion does not need promotion to become research work because promotion would falsely imply analytical acceptance.

- `workId` — identifies the exact work item in one Dossier;
- `gapKey` — identifies the durable research case across Dossiers.

Identity policy:

1. canonical investigation IDs are preferred;
2. Research Now work linked to one investigation keeps a branch hash so distinct evidence tests are not collapsed;
3. explicit top-level `gap_id` values are preserved;
4. promoted Market Motion uses the stable `motion_key` plus a hash of its unresolved research branch; pre-promotion `UNRESOLVED` Motion uses the exact immutable Motion row ID plus the research branch, so it cannot be fuzzy-matched into another Motion;
5. only when canonical IDs are unavailable does the system use a conservative normalised-text fingerprint.

The fallback is intentionally not fuzzy. The lifecycle layer must not invent semantic equivalence that canonical research has not established.

## Operational states

```text
NEW
 -> QUEUED
 -> CLAIMED
 -> RESEARCHING
 -> COMPLETED
 -> HANDED_OFF
 -> CLOSED
```

The lifecycle now actively uses `QUEUED`, `CLAIMED`, `RESEARCHING` and `COMPLETED`. `HANDED_OFF` and `CLOSED` remain reserved for the canonical handoff / feedback stage.

Analytical research outcomes are separate:

- `CONFIRMING`
- `CONTRADICTING`
- `UNRESOLVED`
- `NO_CHANGE`

A case being operationally complete does not mean canonical Live has accepted an analytical conclusion.

## Carry-forward

`research_gap_cases` stores the current operational case.

`research_gap_case_occurrences` is append-only and records every selected Dossier occurrence.

If a stable case appears again:

- the existing case is refreshed with the latest Dossier metadata;
- a new immutable occurrence is appended;
- the case's `occurrence_count` increases once;
- replaying the same Dossier/work occurrence is idempotent;
- active/completed/handoff/closed state is not reset.

Older unresolved queued cases therefore remain claimable even when a later Dossier no longer emits the exact work card.

For Motion-origin work, the occurrence keeps the exact immutable Motion row ID while the durable gap key uses the Motion key + research branch. The current canonical Dossier still anchors the case; Motion is frozen into the plan as `context_only`, never as a second analytical authority.

## Claiming

Claims use the database function:

`claim_research_gap_cases(worker_id, batch_size, lease_seconds)`

Rules:

- maximum batch: 3;
- `FOR UPDATE SKIP LOCKED`;
- default lease: 10 minutes;
- lease range: 60–1,800 seconds;
- stale `CLAIMED` / `RESEARCHING` leases may be reclaimed;
- every claim gets a new claim token;
- attempt count increments on claim.

Release requires the exact case ID + claim token. A worker cannot release another worker's claim.

## Machine endpoint

`/api/research-gap/lifecycle`

Authenticated with the same machine credentials as the existing Research Gap endpoints.

### GET

Returns non-closed persistent cases.

### POST — sync

```json
{ "action": "sync" }
```

Reads the latest Dossier priority queue and persists the selected maximum-three cases.

### POST — claim

```json
{
  "action": "claim",
  "workerId": "gap-worker-1",
  "batchSize": 1,
  "leaseSeconds": 600
}
```

### POST — release

```json
{
  "action": "release",
  "caseId": "<uuid>",
  "claimToken": "<uuid>"
}
```

## Research execution boundary

`POST /api/research-gap/execution` now owns two deterministic operational transitions:

- `start` — builds and persists a bounded `research-gap-plan/1`, then moves an owned claim to `RESEARCHING`;
- `evaluate` — evaluates structured evidence assessments against the persisted plan. Research stays open until deterministic stop conditions are met; only then does the case move to `COMPLETED`.

The plan is intentionally conservative. It preserves the canonical question/action, turns explicit missing evidence into bounded requirements, recommends broad source classes, and never invents a prior expectation when none is persisted.

The verdict contract is also conservative:

- every required branch needs traceable coverage before a directional verdict;
- one authoritative direct source or two independent strong direct sources can establish one-sided support;
- strong evidence on both sides returns `UNRESOLVED`;
- complete strong neutral evidence may return `NO_CHANGE`;
- exhausted source/branch budgets stop as `UNRESOLVED`;
- otherwise research continues.

## Still deliberately not included

This lifecycle does not yet:

- execute external research by itself;
- route every gap type to provider-specific source adapters;
- send a `COMPLETED` lifecycle case through the already-existing automatic handoff without an executor supplying the underlying evidence packet;
- close or reopen a case from canonical Live feedback;
- schedule the 08:10 / 20:10 Gap runs.

Those remain later stages because scheduling before an actual research executor would merely claim work without resolving it.


## Canonical handoff acknowledgement

A completed lifecycle case may now be tied to the existing automatic Live handoff by supplying its `caseId` with the completed result.

Before publishing evidence to canonical Live, the handoff bridge verifies:

- the lifecycle case exists;
- its state is `COMPLETED` or an idempotent replay of `HANDED_OFF`;
- the submitted outcome exactly matches the persisted deterministic verdict;
- a previously handed-off case is not being rebound to a different deterministic run key.

Only after `/api/research-update` returns a 2xx acknowledgement does the case transition:

`COMPLETED → HANDED_OFF`

The lifecycle stores the deterministic handoff run key and canonical HTTP status. A failed canonical handoff leaves the case `COMPLETED`.

`HANDED_OFF` still does not mean the Story changed. It means the evidence packet was admitted into the canonical Live research path. Closing/reopening remains a later feedback step.
