# Research Gap Durable Lifecycle

This layer makes prioritised Research Gap work persistent across Market Dossiers without creating a second analytical authority.

## Boundary

Research Gap lifecycle owns operational work state only:

```text
Dossier work
  -> stable gap identity
  -> queue / claim / lease
  -> research execution
  -> completed result
  -> canonical Live handoff
```

It does not decide Story or Regime truth.

Canonical Live remains responsible for interpreting admitted evidence and deciding whether a thesis, Story, Regime or investigation changes.

## Stable identity

Every normalised work candidate now has two IDs:

- `workId` — identifies the exact work item in one Dossier;
- `gapKey` — identifies the durable research case across Dossiers.

Identity policy:

1. canonical investigation IDs are preferred;
2. Research Now work linked to one investigation keeps a branch hash so distinct evidence tests are not collapsed;
3. explicit top-level `gap_id` values are preserved;
4. only when canonical IDs are unavailable does the system use a conservative normalised-text fingerprint.

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
