# Canonical publication trigger-order repair — 2026-09-06

## Production evidence

Scheduled morning run `a820db00-7552-43ec-bbd8-fb2fc008592a` (`cron-v1:morning:2026-09-06`) completed at `2026-09-06T02:40:48.880Z`.

The canonical publisher persisted the run's base immutable daily brief at `2026-09-06T02:40:03.279Z`, then Dossier composition superseded it with daily brief `405dfcf7-e8cb-474a-84e9-82be306bc804` at `2026-09-06T02:40:46.512Z`. Both manifests contained 15 Story states.

After that manifest was frozen, legacy database trigger `research_runs_publish_hybrid_snapshot` fired when the research run status became `completed`. It appended Story snapshot `d750bb05-7d52-47a7-88b2-a35374c1a6db` at `2026-09-06T02:40:48.880Z` for Story `952d443f-dbbf-4a8a-a1e4-44d4a9e72fe4`, titled `Weak jobs meet expensive oil; CPI becomes the tie-breaker`.

That Story is absent from both immutable daily-brief manifests. Hybrid therefore behaved correctly by omitting it from exact edition replay, but the persisted run-level Story surface and frozen edition had diverged.

## Repair

`publish_hybrid_snapshots_for_run()` now checks whether the completed scheduled run already owns any `daily_brief` publication snapshot. If so, the legacy trigger updates handoff bookkeeping and returns before inserting Story or daily-brief snapshots.

The historical legacy fallback remains intact for completed scheduled runs that genuinely have no application-owned canonical daily brief. It remains explicitly marked `replayStatus=legacy_unproven`.

## Safety

This repository change only defines the migration and tests it. It does not apply the migration to production and does not merge or deploy the branch.
