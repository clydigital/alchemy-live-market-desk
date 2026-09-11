# Temporary production automation pause

Automated production **research** cron execution is temporarily paused. Both Vercel routing and application middleware intercept `/api/cron/research/*` while preserving the declared research schedules for later review.

The two lightweight creator-video detector crons are intentionally excluded from this pause:

- `/api/cron/video/midnight` at 09:00 Asia/Kuala_Lumpur
- `/api/cron/video/late-morning` at 21:00 Asia/Kuala_Lumpur

Those video routes run in discovery/queue-only mode. They may discover monitored YouTube uploads and persist pending transcript items, but they do not invoke the legacy external Chrome transcript operator and they do not resume Live Desk reasoning, publication, or intelligence stages.

The intended transcript worker is a separately scheduled ChatGPT cloud-browser task. It consumes pending video rows, retrieves genuine timestamped transcripts when available, and persists them through the connected research data plane. Missing or browser-blocked transcripts remain pending/retryable; no generated or paid transcript fallback is allowed.

To resume full automated production research, remove the `/api/cron/research/:path*` Vercel rewrite and the corresponding research-only middleware pause in one reviewed change, then verify the production deployment before relying on the next scheduled research slot.
