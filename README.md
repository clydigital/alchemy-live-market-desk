# Alchemy Live Market Desk

Canonical research layer for Alchemy Markets. It owns source ingestion, transcript studies, evidence validation, chart requirements, thesis updates and append-only research memory.

See [Research Architecture and Rollout](docs/RESEARCH_ROLLOUT.md).

See the [Editorial-Brain Design Pack](docs/editorial-brain/README.md) for the Original release ledger, story command desk, macro operating system, History Cabinet and judge-panel recommendation.

## Four-slot research engine

The Asia/Kuala_Lumpur research workflow uses four slots:

- 00:40 video intake (`video_midnight`)
- 08:30 full desk update (`morning`)
- 11:30 video refresh (`video_late_morning`)
- 23:00 evening delta update (`evening`)

Research publishing runs through `/api/research-update`. The `/api/video-intake` route owns both YouTube discovery and durable transcript intake.

## TranscriptAPI pipeline

Transcript intake is database-first and uses TranscriptAPI v2 as the only transcript provider:

1. Read `research_intake_items` for a completed transcript cache entry.
2. Call the free `/youtube/info` endpoint to validate the video and discover languages.
3. Call `/youtube/transcript` with the selected language priority and timestamps enabled.
4. Persist the flattened text, canonical timestamped segments, language, duration, provider metadata and retrieval time.
5. On a required-video failure, preserve the error taxonomy on the intake row and upsert one open `research_debt` record.

Successful rows are protected from later failure writes. Network failures, timeouts, rate limits and provider 5xx responses use at most three attempts with exponential backoff and `Retry-After` support.

A targeted retry for an existing intake row is available to authenticated operators:

```bash
curl -H "Authorization: Bearer $RESEARCH_UPDATE_TOKEN" \
  "https://<deployment>/api/video-intake?videoId=yNiWeHGBl98"
```

The response contains operational metadata, never transcript text or credentials.

## Environment

Copy `.env.example` and configure these server-side Vercel values:

- `SUPABASE_SERVICE_ROLE_KEY`
- `RESEARCH_UPDATE_TOKEN`
- `YOUTUBE_DATA_API_KEY`
- `TRANSCRIPT_API_KEY`

`CRON_SECRET` is accepted for scheduled calls. `VERCEL_AUTOMATION_BYPASS_SECRET` is preview-only and exists solely for protected deployment verification.

The publisher contract and runbook live in [Research Update Engine](docs/RESEARCH_UPDATE_ENGINE.md).

## Verification

`npm test` runs the TranscriptAPI error-taxonomy and cache/debt tests. `npm run build` runs those tests before the Next.js production build. The SQL contract at `supabase/tests/transcriptapi_persistence_contract.sql` validates the production persistence fields, provider constraint, cache index, schedule slots and view security.
