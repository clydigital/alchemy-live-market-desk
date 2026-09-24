# Production research automation routing

Full Live Desk research is automated at **09:15** and **21:15 Asia/Kuala_Lumpur** through the audited GitHub Actions workflow `.github/workflows/run-live-research.yml`. The schedule uses **01:15 UTC** and **13:15 UTC** and executes the same OIDC-authorised, resumable production pipeline as an approved manual run.

The legacy Vercel research routes under `/api/cron/research/*` remain deliberately paused in both routing and middleware. They are not the active scheduler and must stay paused while GitHub Actions owns the two full-desk slots; this prevents duplicate acquisition/intelligence work and avoids the prior Vercel cron fan-out.

Video discovery remains separate:

- `/api/cron/video/midnight` at 09:00 Asia/Kuala_Lumpur
- `/api/cron/video/transcript-worker` at 09:30 Asia/Kuala_Lumpur
- `/api/cron/video/late-morning` at 21:00 Asia/Kuala_Lumpur

Video discovery and transcript processing can create creator-lead evidence, but they do not replace the 09:15 / 21:15 full Live research cycles and cannot independently publish a Story to Hybrid.

System health should report `scheduling.mode = github_actions` while this routing is active. If ownership is ever moved back to Vercel Cron, disable the GitHub schedule and remove the Vercel research pause in the same reviewed change so only one scheduler can own a canonical slot.
