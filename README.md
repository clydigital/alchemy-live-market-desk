# Alchemy Live Market Desk

Canonical research layer for Alchemy Markets. It owns source ingestion, transcript studies, evidence validation, chart requirements, thesis updates and append-only research memory.

See [Research Architecture and Rollout](docs/RESEARCH_ROLLOUT.md).

See the [Editorial-Brain Design Pack](docs/editorial-brain/README.md) for the Original release ledger, story command desk, macro operating system, History Cabinet and judge-panel recommendation.

See the [Live Market Desk V8 Reference Pack](docs/live-desk-v8/README.md) for the approved production adaptation target, design philosophy, route structure, current-state audit and staged migration plan.

## Twice-daily research engine

The 08:30 and 22:00 Asia/Kuala_Lumpur research cycles publish through
`/api/research-update`. Apply the latest Supabase migration, then configure
`SUPABASE_SERVICE_ROLE_KEY` and `RESEARCH_UPDATE_TOKEN` as server-only Vercel
environment variables. The publisher contract and runbook live in
[`docs/RESEARCH_UPDATE_ENGINE.md`](docs/RESEARCH_UPDATE_ENGINE.md).
