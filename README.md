# Alchemy Live Market Desk

Canonical research layer for Alchemy Markets. It owns source ingestion, transcript studies, evidence validation, chart requirements, thesis updates and append-only research memory.

See [Research Architecture and Rollout](docs/RESEARCH_ROLLOUT.md).

See the [Editorial-Brain Design Pack](docs/editorial-brain/README.md) for the Original release ledger, story command desk, macro operating system, History Cabinet and judge-panel recommendation.

## Four-slot research engine

The Asia/Kuala_Lumpur research workflow uses four slots:

- 00:40 video intake
- 08:30 full desk update
- 11:30 video refresh
- 22:00 evening delta update

Research publishing runs through `/api/research-update`, while YouTube discovery and transcript intake run through `/api/video-intake`.

Configure these server-only Vercel environment variables:

- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEARCH_UPDATE_TOKEN`
- `YOUTUBE_DATA_API_KEY`
- `TRANSCRIPT_API_KEY`

The publisher contract and runbook live in [`docs/RESEARCH_UPDATE_ENGINE.md`](docs/RESEARCH_UPDATE_ENGINE.md).
