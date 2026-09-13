# Temporary production automation pause

Automated production **research** cron execution is temporarily paused. Both Vercel routing and application middleware intercept `/api/cron/research/*` while preserving the declared research schedules for later review.

The two lightweight creator-video detector crons are intentionally excluded from this pause:

- `/api/cron/video/midnight` at 09:00 Asia/Kuala_Lumpur
- `/api/cron/video/late-morning` at 21:00 Asia/Kuala_Lumpur

Those video routes run independently from the main research scheduler. Discovery preserves monitored uploads for the bounded transcript worker; the worker may claim, transcribe, interpret and persist creator-lead evidence, but it cannot launch the main research engine, publish a Story, or hand anything to Hybrid.

The authenticated Vercel transcript worker runs daily at 09:30 Asia/Kuala_Lumpur with a one-video batch, the smallest automatic cadence supported by the project's Vercel plan. It uses the existing Supadata native-caption path, durable leases and checkpointed interpretation/evidence persistence. The research rewrite and middleware pause do not match `/api/cron/video/*`, so video processing remains autonomous while research stays paused.

To resume full automated production research, remove the `/api/cron/research/:path*` Vercel rewrite and the corresponding research-only middleware pause in one reviewed change, then verify the production deployment before relying on the next scheduled research slot.
