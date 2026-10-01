# Research Gap Context Envelope Design

**Date:** 2026-10-01

**Status:** Approved follow-up to merged PRs #346 and #347

## Purpose

Extend the existing `research-gap-plan/1` pipeline so a new plan is not built from the mutable case row alone. Each start freezes provenance for the exact persisted Research Gap occurrence, the authoritative current Dossier V2, and up to two exact predecessors. MacroPulse uses the same context adapter boundary when a canonical reader exists, but remains context-only and cannot become evidence or analytical authority.

## Authority

- `research_gap_cases` and its exact occurrence are operational authority.
- The Dossier referenced by `latest_dossier_id` is the only canonical analytical source.
- Up to two records reached through exact `previous_dossier_id` links are context-only.
- MacroPulse inputs are context-only.
- Context-only sources cannot override the current research question, prior expectation, requirements, Story links, or verdict.

## Contract

`research-gap-plan/1` remains backward compatible and gains optional `context` metadata:

- `frozenAt`;
- `sourceWorkId`;
- `authoritativeDossierId`;
- ordered `dossierLineageIds` (maximum three);
- source provenance records with source type, stable ID, contract version, as-of time, and authority.

New plans created by the execution endpoint must include this context. Existing persisted plans without it remain replayable.

The pure plan builder may use the exact linked investigation in the authoritative Dossier for the question, prior expectation, and missing-evidence requirements. Older Dossiers and MacroPulse are never consulted for those fields.

## Start fencing

The existing `start_research_gap_case` signature remains stable. When `plan.context` is present, the function must require its `sourceWorkId` and `authoritativeDossierId` to match the current case row. A concurrent case refresh therefore returns no row instead of persisting a stale plan.

## MacroPulse boundary

This change defines and validates `adaptMacroPulseContext`. It does not add a reader because the repository has no canonical machine-readable MacroPulse storage contract. Adding a page scraper or treating MacroPulse prose as evidence is out of scope.

## Acceptance

- Exact newest-three predecessor lineage is loaded; unrelated recent Dossiers are ignored.
- Missing or cyclic linked predecessors fail closed.
- New plan starts persist provenance and reject stale case identity.
- Context-only sources cannot override authoritative plan fields.
- Existing v1 plans remain replayable.
- Full Node, Task C, typecheck, build, and disposable PostgreSQL contracts pass.
