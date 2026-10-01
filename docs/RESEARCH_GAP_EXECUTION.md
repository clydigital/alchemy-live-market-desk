# Research Gap Plan + Verdict Gate

This stage sits between durable Gap claiming and the existing automatic Live handoff.

```text
Dossier
  -> priority queue
  -> durable case
  -> claim
  -> deterministic Research Plan
  -> external evidence collection
  -> deterministic verdict gate
  -> COMPLETED
  -> existing /api/research-gap/handoff
  -> canonical /api/research-update
```

## Contract

The plan contract is:

`research-gap-plan/1`

It preserves:

- canonical Gap identity;
- research question / action;
- linked Story and Investigation IDs;
- explicit missing-evidence branches;
- frozen source provenance for new plans;
- a bounded source budget;
- a bounded branch budget.

New plans load the exact persisted Gap occurrence and the current Dossier named by the case. They may also retain up to two exact predecessors reached through `previous_dossier_id`. Only the current Dossier is analytical authority: exact linked investigations may supply the question, prior expectation, missing evidence and next research. Older Dossiers and MacroPulse are context-only and cannot override those fields.

The optional plan `context` contains the work ID, authoritative Dossier ID, ordered Dossier lineage IDs and source provenance. Existing persisted `research-gap-plan/1` records without `context` remain valid and replayable.

MacroPulse has a validated context adapter boundary, but no live reader yet because this repository has no canonical machine-readable MacroPulse storage contract. MacroPulse prose is not scraped or treated as evidence.

## Default research budget

- max sources: 8
- max branches: 3
- max evidence requirements: 6
- minimum admissible source quality: 65
- strong direct source threshold: 80
- authoritative direct source threshold: 90
- two independent strong sources can establish one-sided support

These are stop-policy thresholds, not source-quality facts. The executor must still provide the assessment and provenance.

## Verdicts

The verdict contract is:

`research-gap-verdict/1`

Allowed outcomes reuse the existing Live vocabulary:

- `CONFIRMING`
- `CONTRADICTING`
- `UNRESOLVED`
- `NO_CHANGE`

The evaluator does not choose a causal explanation. It only decides whether the supplied, traceable evidence is sufficient to stop bounded research and which existing outcome label the evidence relationship supports.

## Machine endpoint

`POST /api/research-gap/execution`

### Start

```json
{
  "action": "start",
  "caseId": "<uuid>",
  "claimToken": "<uuid>"
}
```

Requires an owned, unexpired `CLAIMED` case. The route freezes the exact context, builds the deterministic plan and transitions the case to `RESEARCHING`.

The transition is fenced in the database: a context-aware plan starts only when its case, gap, work and authoritative Dossier identities still match the current durable case. If a newer Dossier refreshes the case while the plan is being built, the transition returns no row and the route reports a conflict instead of persisting stale work.

### Evaluate

```json
{
  "action": "evaluate",
  "caseId": "<uuid>",
  "claimToken": "<uuid>",
  "branchCount": 2,
  "evidence": [
    {
      "evidenceId": "source:ust-curve",
      "independenceKey": "us-treasury",
      "sourceClass": "official",
      "sourceUrl": "https://example.com/source",
      "requirementIds": ["req:1:..."],
      "direction": "CONFIRMING",
      "directness": "DIRECT",
      "quality": 95,
      "traceable": true,
      "claim": "Observed evidence relevant to the research requirement."
    }
  ]
}
```

If the stop gate is not met, the case remains `RESEARCHING` and the response names the missing evidence branches.

If the stop gate is met, the case becomes `COMPLETED`, claim ownership is cleared, and the verdict is persisted.

## Boundary

This stage is not a research model and not a second analytical brain.

It does not:

- browse the web;
- invent source-quality scores;
- decide Story or Regime truth;
- mutate Stories;
- call `recalibrate_story`;
- send evidence to Live by itself.

The existing automatic Gap handoff remains the only admission route from completed Gap evidence into canonical Live.
