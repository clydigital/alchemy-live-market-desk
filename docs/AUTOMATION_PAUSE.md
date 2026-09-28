# Production research automation routing

Full Live Desk research has two canonical slots: **09:30** and **21:30 Asia/Kuala_Lumpur**, owned by the audited GitHub Actions workflow `.github/workflows/run-live-research.yml`. Primary triggers run at **01:30 UTC** and **13:30 UTC**. Safety triggers run 15 minutes later at **01:45 UTC** and **13:45 UTC** to recover a missed or delayed primary trigger.

Primary and safety triggers use the same daily `github-scheduled` retry identity inside the canonical slot key. If the primary already completed, the safety trigger exits without repeating provider, model or Dossier work. If the slot is still running, it may continue the same resumable pipeline. Terminal failures remain terminal and require an explicit audited manual retry key.

The legacy Vercel research routes under `/api/cron/research/*` remain deliberately paused in both routing and middleware. They are not the active scheduler and must stay paused while GitHub Actions owns the two full-desk slots; this prevents duplicate acquisition/intelligence work and avoids the prior Vercel cron fan-out.

Video discovery remains separate:

- `/api/cron/video/midnight` at 09:00 Asia/Kuala_Lumpur
- `/api/cron/video/transcript-worker` at 09:30 Asia/Kuala_Lumpur
- `/api/cron/video/late-morning` at 21:00 Asia/Kuala_Lumpur

Video discovery and transcript processing can create creator-lead evidence, but they do not replace the 09:30 / 21:30 full Live research cycles and cannot independently publish a Story to Hybrid.

System health should report `scheduling.mode = github_actions` while this routing is active. The 15-minute safety triggers are not additional canonical slots; they share the same persisted slot identity. If ownership is ever moved back to Vercel Cron, disable all GitHub primary/safety triggers and remove the Vercel research pause in the same reviewed change so only one scheduler can own a canonical slot.
