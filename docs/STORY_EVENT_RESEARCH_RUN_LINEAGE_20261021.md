# Story-event research-run lineage — 21 October 2026

Status: staged migration. Existing canonical Story reasoning and thesis-version write path remain unchanged.

## Reproduced production defect

The oil thesis version 0db8a548-8319-4b83-a508-017762c798fa was created at 2026-10-20T16:19:00.087556Z. Its immutable Story event 9c3c852d-bee6-4a4d-8c4d-15dadd762670 has research_run_id NULL even though existing metadata records engineRunId ddd6a3f6-7657-478b-8a46-627ae5bebad2. That engine run identifies research_run_id 440d7ff6-78dc-4d5e-9da4-d8bf65987372, a manual Research Gap run. It is NOT scheduled-run proof.

## Minimal change

Migration 20261021033500 preserves the existing capture_story_thesis_version() function and exactly one existing Story event and thesis-version insertion. It adds an exact engineRunId lookup for a new Story maintenance event and stores the resolved ResearchRun UUID in the existing story_events.research_run_id column.

No new trigger, table, reasoning engine, Story writer, inference from timestamps or historical event backfill. Historical immutable events can continue to resolve the relationship from existing event metadata in read-only queries.

## Required acceptance

1. CI tests, TypeScript, build and database contracts.
2. Apply via controlled Supabase migration only after reviewing the one-function diff and deploy readiness.
3. Verify one NEW event carries research_run_id equal to intelligence_engine_runs.research_run_id for its exact engineRunId.
4. Verify that an eligible naturally scheduled engine run links to a Story revision and pinned edition, or clearly records no material change. A manual run must not count.
5. Keep provider/FXStreet health and public/private access gates separate; this patch fixes provenance, not upstream HTTP 403.
