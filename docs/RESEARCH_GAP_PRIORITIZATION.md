# Research Gap Prioritisation

This stage converts the Dossier work queue into a bounded research set.

## Endpoint

`GET /api/research-gap/priorities`

Returns `research-gap-priority-queue/1`.

## Policy

The policy is deterministic and auditable.

Priority components:

- MATERIAL + BLOCKER: strongest weight;
- MATERIAL without BLOCKER: strong weight;
- expected information gain: High > Medium > Low;
- Research Now rank: 1 > 2 > 3;
- investigation state: MATERIAL/PARTIAL/UNRESOLVED divergence plus open/strengthened state;
- links to persistent Stories / investigations;
- explicit MAIN_THREAD / REGIME:CURRENT blocking refs;
- specific missing evidence.

The prioritizer selects at most three items per Dossier.

## Same-Dossier duplicate suppression

If a selected item already covers an investigation ID, a lower-scoring candidate linked to the same investigation is suppressed for this Dossier.

Example:

```text
Research Now #1
  linked_investigations: [inv:duration-transmission]

Investigation
  investigation_id: inv:duration-transmission

→ select the higher-scoring Research Now work
→ suppress the lower-scoring duplicate
```

This is deliberately local deduplication only. Persistent cross-Dossier lifecycle/deduplication remains a later task.

## Boundary

This stage still does not:

- claim/persist work;
- run external research;
- create research plans;
- close/reopen gaps;
- modify Live Stories.

It only decides which current Dossier work should receive the scarce research budget first.
