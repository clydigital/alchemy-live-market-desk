# Story Synthesis Optional Evidence Lineage Repair — 2026-08-28

## Incident

The 2026-08-28 morning Live run acquired evidence successfully but Story Synthesis failed before publication because an optional `overlookedVariable` annotation referenced evidence IDs outside that Story's canonical evidence set.

## Repair boundary

Optional Story Synthesis narrative annotations (`acceptedExplanationEvidenceIds` and `overlookedVariableEvidenceIds`) are filtered to the canonical Story evidence set before canonical reasoning is built. Unknown optional IDs are discarded and never enter canonical lineage.

If an overlooked-variable annotation has no surviving canonical evidence IDs, its evidence state is demoted to `speculative` rather than allowing an unsupported observed/strongly-supported label.

Decisive evidence and stage-owned provenance remain fail-closed: primary hypothesis thesis evidence, causal edges, Challenger/countercase evidence, Scenario evidence, and decisive Story evidence still reject unknown canonical IDs.

## Verification

A regression test reproduces the optional-ID failure class and proves it no longer aborts an otherwise valid Story. A companion regression proves unknown decisive evidence still fails closed.

The repair branch passed the focused Story reasoning tests, the full repository test suite, and the Next.js production build in GitHub Actions run `33149233676`.

No Hybrid, provider, scheduling, schema, migration, or production-data changes are included.
