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

Every newly evaluated verdict also embeds a sanitised evidence packet under:

- `evidenceSnapshotVersion: "research-gap-evidence-snapshot/1"`
- `evidenceSnapshot`

This preserves the exact source URL, source class, independence key, requirement mapping, direction, directness, quality, traceability and claim that produced the verdict. Older persisted v1 verdicts without this snapshot remain readable; new executor work must use the embedded packet so a failed handoff can be retried without reconstructing research from memory.

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


## Scheduled one-case cycle

Research Gap scheduled ownership is Vercel-primary because GitHub Actions scheduled events were observed starting roughly 4–7 hours after their configured cron times on 6–7 October 2026. GitHub retains the audited `research_gap_cycle` workflow-dispatch mode for manual recovery, but it no longer owns Research Gap cron scheduling.

Current Vercel schedule:

- `03:15 UTC` — 11:15 MYT: retry/close one completed case first, then research at most one queued case.
- `03:30 UTC` and `03:45 UTC`: handoff-only retries.
- `15:15 UTC` — 23:15 MYT: retry/close one completed case first, then research at most one queued case.
- `15:30 UTC` and `15:45 UTC`: handoff-only retries.

Before either cycle or handoff work begins, the cron checks the existing `research_slot_runs` ledger. A recent unfinished morning/evening Live sweep causes Research Gap to return `deferred` instead of overlapping canonical Live work.

The Vercel cycle is intentionally one-case maximum:

1. Attempt one persisted `COMPLETED` → canonical handoff first.
2. If a completed case was handed off, stop.
3. If the completed case was closed as superseded, or no completed case awaits admission, claim and research one queued case.
4. If no queued case is available, exit successfully with no work.
5. Persist the researched case as `COMPLETED`.
6. Stop. A later handoff-only cron admits the durable snapshot.

Separating web research from final handoff keeps the web-search invocation inside the existing bounded function duration while preserving the durable retry boundary. If canonical Live is unavailable, the case stays `COMPLETED`; later handoff-only cron invocations retry it before another scheduled web cycle.

Legacy Dossier→Story D7 synchronization rows are not valid web-research obligations. Completed legacy rows close through the exact Story-review preflight, and queued legacy rows are closed before ordinary web claims. Dossier→Story synchronization remains owned by A3 Story review.

The scheduler does not change Research Gap authority. Canonical Live still decides what admitted evidence does to Stories, Regimes, Journey and Dossier state.

