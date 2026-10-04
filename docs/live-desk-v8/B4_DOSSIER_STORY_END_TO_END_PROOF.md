# B4 Dossier → Story End-to-End Proof

B4 proves one bounded architecture:

```
Dossier System 2
  -> ACCEPT / REFINE only
  -> exact Story reassessment request
  -> exact canonical evidence UUID resolution
  -> immutable-base reassessment proposal
  -> canonical writer handoff
  -> canonical-story-reasoning/v1 materialisation
  -> final Story mutation plan
  -> existing persist_canonical_story_reasoning transaction
  -> exact current thesis-version pointer
  -> immutable publication snapshot
  -> historical edition manifest
  -> snapshot-only historical replay
```

## Authority boundaries

- Motion is context, not evidence.
- ACCEPT/REFINE require the exact cited packet evidence.
- The packet evidence must resolve to a canonical evidence UUID.
- The required canonical evidence must remain decisive and support the reassessed thesis.
- UNRESOLVED/REJECT cannot enter the Story mutation chain.
- REFINE carries corrected framing as context only; it does not become canonical evidence.

## Story mutation boundary

The Dossier-specific modules are pure adapters/planners.

They do not:
- insert into `story_thesis_versions`
- call the legacy Story-assessment maintenance writer
- create another reasoning engine
- create another reasoning table
- publish directly

The single Dossier mutation sink is the existing runtime wrapper around:

`rpc/persist_canonical_story_reasoning`

That transaction remains responsible for the reasoning-bearing thesis version and the matching `stories.current_thesis_version_id` pointer.

The B4.5 expected-base guard rejects a mutation when the Story has moved since the reassessment baseline.

## Publication boundary

Canonical publication follows `stories.current_thesis_version_id` exactly.

The publication trigger independently verifies that version and materialises
`canonicalStoryReasoning` from the immutable thesis-version snapshot.

Publication does not rebuild reasoning from current Motion, Dossier, or mutable Story prose.

## Historical replay boundary

The canonical edition manifest freezes:
- Story ID
- thesis version ID
- Story presentation state
- canonical Story reasoning

Historical replay validates the Story/version identity and returns the frozen
reasoning from the selected edition.

It does not query current `stories`, current `story_thesis_versions`, Motion,
or Dossier state.

Therefore a later Story version cannot rewrite an older edition's reasoning.

## B4.8 executable proof

`tests/dossier-story-end-to-end-b4-8.test.ts` proves:

1. ACCEPT traverses the full pure B4 chain with one exact canonical evidence UUID.
2. REFINE preserves corrected context while canonical evidence remains authoritative.
3. Motion prose is absent from canonical reasoning and the final Story payload.
4. The canonical writer output materialises as the exact reasoning-bearing thesis version.
5. Publication/replay remain pinned to that version after the current Story advances.
6. UNRESOLVED and REJECT stop before Story wake.
7. No Dossier module introduces a third thesis-version writer.
8. The existing atomic writer, stale-base guard, publication trigger, and replay contract remain linked by source-level invariants.
