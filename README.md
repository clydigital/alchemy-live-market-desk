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

## OpenAI market-intelligence runtime

When `OPENAI_API_KEY` is configured, the canonical research publisher hands validated evidence to the server-only OpenAI intelligence runtime. Caller-supplied Story recalibrations are no longer authoritative while this runtime is active.

The runtime follows the persisted intelligence contract:

```text
validated research intake
→ canonical evidence + source ancestry
→ market belief
→ material divergence
→ competing hypotheses
→ Challenger audit
→ asset scenarios
→ original Story synthesis
→ semantic deduplication
→ Story lifecycle
→ canonical Live Story
→ Hybrid feed
```

The model never writes directly to `stories`. Every stage uses strict structured output and is recorded in `intelligence_stage_runs` with model, provider request ID and token usage. A Story cannot be created or recalibrated unless it passes the deterministic publication gate: at least three decisive evidence records, three independent source groups, at least one Tier 1-2 source, Challenger promotion, qualification of at least 70 and confidence of at least 60.

A single article is therefore insufficient to create a Story. When the event, thesis and mechanism substantially match an existing Story, semantic deduplication prefers updating that Story rather than creating another one. Original Alchemy Stories do not require an external canonical article URL.

The authenticated `/api/intelligence-run` route can run the engine directly or expose sanitized operational status. It never returns stage payloads, transcript text or credentials.

Default model routing is cost-aware:

- GPT-5.6 Terra for hypotheses, Challenger, scenarios and Story synthesis.
- GPT-5.6 Luna for market-belief extraction, divergence detection, semantic deduplication and lifecycle classification.
- Medium reasoning for complex stages and low reasoning for fast stages.

All model choices and reasoning effort can be overridden with the server-only environment variables documented in `.env.example`.

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
- `OPENAI_API_KEY`

`OPENAI_INTELLIGENCE_ENABLED=false` is the kill switch for the model reasoning layer. If no OpenAI key is configured, the existing legacy recalibration path remains available rather than breaking research ingestion.

`CRON_SECRET` is accepted for scheduled calls. `VERCEL_AUTOMATION_BYPASS_SECRET` is preview-only and exists solely for protected deployment verification.

The publisher contract and runbook live in [Research Update Engine](docs/RESEARCH_UPDATE_ENGINE.md).

## Verification

`npm test` runs the TranscriptAPI error-taxonomy and cache/debt tests. `npm run build` runs those tests before the Next.js production build. The SQL contract at `supabase/tests/transcriptapi_persistence_contract.sql` validates the production persistence fields, provider constraint, cache index, schedule slots and view security.
