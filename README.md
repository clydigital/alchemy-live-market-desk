# Alchemy Live Market Desk

Canonical research layer for Alchemy Markets. It owns source ingestion, transcript studies, evidence validation, chart requirements, thesis updates and append-only research memory.

See [Research Architecture and Rollout](docs/RESEARCH_ROLLOUT.md).

## Four-slot research engine

The 00:40 and 11:30 Asia/Kuala_Lumpur slots prepare creator-video research. The
08:30 and 22:00 slots validate and publish canonical Desk 1 changes through
`/api/research-update`. Desk 2 consumes only validated Desk 1 state from
`/api/hybrid-feed` contract version 2.

The live Supabase project already contains the research-pipeline schema. Inspect
its migration history before adding any migration. Configure
`SUPABASE_SERVICE_ROLE_KEY` and `RESEARCH_UPDATE_TOKEN` as server-only Vercel
environment variables. The publisher contract, source assignments and runbook live in
[`docs/RESEARCH_UPDATE_ENGINE.md`](docs/RESEARCH_UPDATE_ENGINE.md).
