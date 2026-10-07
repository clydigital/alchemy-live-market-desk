# Production research automation routing

Full Live Desk research has two canonical slots: **09:30** and **21:30 Asia/Kuala_Lumpur**.

## Primary clock — Vercel Cron

Vercel owns the exact slot start:

- morning acquisition: 01:30 UTC / 09:30 MYT
- evening acquisition: 13:30 UTC / 21:30 MYT
- acquisition watchdog: five minutes after each primary start
- stale-acquisition recovery watchdog: +13 minutes; it may reclaim the same canonical row only when the row is still running, has no persisted source checks, and has been untouched for at least seven minutes
- durable intelligence continuations: every five minutes from +10 to +45 minutes

The intelligence route advances the existing persisted run one durable model stage at a time. Every continuation resolves the same canonical `cron-v1:<slot>:<date>` run identity. If a previous invocation is still running, already completed, or won the optimistic claim, the later invocation safely waits/no-ops instead of starting duplicate model work.

## Delayed fallback — GitHub Actions

The audited workflow `.github/workflows/run-live-research.yml` remains enabled as a transport fallback, but no longer owns the exact 09:30 / 21:30 clock.

Fallback triggers run roughly one hour later:

- morning: 02:30 and 02:45 UTC / 10:30 and 10:45 MYT
- evening: 14:30 and 14:45 UTC / 22:30 and 22:45 MYT

Scheduled GitHub runs use the `github-scheduled` marker, which the manual Live trigger deliberately strips before calling the canonical handlers. Vercel and GitHub therefore converge on the same daily slot run key. If Vercel completed the slot, GitHub exits without repeating provider, model, Dossier or publication work. If the slot is resumable, GitHub continues it.

Terminal failed/blocked rows remain terminal and require an explicit audited manual retry key.

## Why both transports exist

GitHub scheduled workflows can be delayed. Vercel previously stayed paused to avoid duplicate execution, but the runtime now has canonical run-key deduplication, optimistic continuation claims, and one-model-stage invocation guards. That makes a primary-plus-fallback design safe while removing GitHub scheduling delay as the single point of failure.

Video discovery remains separate:

- `/api/cron/video/midnight` at 09:00 MYT
- `/api/cron/video/transcript-worker` at 09:30 MYT
- bounded transcript retry at 10:45 MYT for retryable provider-capacity failures
- `/api/cron/video/late-morning` at 21:00 MYT
- `/api/cron/video/transcript-worker` at 21:30 MYT
- bounded transcript retry at 22:45 MYT for retryable provider-capacity failures

The retry slots reuse the same leased transcript worker and claim only rows whose persisted `transcript_next_attempt_at` is due. A completed or not-yet-due row is a safe no-op, so the retry does not duplicate transcript evidence.

Video discovery and transcript processing can create creator-lead evidence, but they do not replace the 09:30 / 21:30 full Live research cycles and cannot independently publish a Story to Hybrid.

System health should report `scheduling.mode = vercel_primary_github_fallback` while this routing is active.


A stale acquisition reclaim is compare-and-swap guarded on the canonical row's id, running status and exact updated_at value. It never creates a second run key. Once source checks exist, acquisition reclaim is disabled and the intelligence continuation path owns recovery.
