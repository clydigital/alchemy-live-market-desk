# Production research automation rollback

Automated production **research** cron execution is enabled. The declared acquisition, intelligence, and watchdog schedules invoke the canonical morning or evening run key so incomplete stages can be resumed without creating a second logical run.

The two lightweight creator-video detector crons are intentionally excluded from this pause:

- `/api/cron/video/midnight` at 09:00 Asia/Kuala_Lumpur
- `/api/cron/video/late-morning` at 21:00 Asia/Kuala_Lumpur

Those video routes run in discovery/queue-only mode. They may discover monitored YouTube uploads and persist pending transcript items, but they do not invoke the legacy external Chrome transcript operator and they do not resume Live Desk reasoning, publication, or intelligence stages.

The intended transcript worker is a separately scheduled ChatGPT cloud-browser task. It consumes pending video rows, retrieves genuine timestamped transcripts when available, and persists them through the connected research data plane. Missing or browser-blocked transcripts remain pending/retryable; no generated or paid transcript fallback is allowed.

To pause research automation without affecting video discovery, set `PRODUCTION_RESEARCH_AUTOMATION_PAUSED` to `true` in `lib/research-automation-routing.ts` and restore the `/api/cron/research/:path*` rewrite to `/api/automation-paused` in `vercel.json`. Verify both the routed response and `/api/system-health` after deployment.
