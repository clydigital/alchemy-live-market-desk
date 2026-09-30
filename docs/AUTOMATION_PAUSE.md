# Production research automation routing

Full Live Desk research has two canonical slots: **09:30** and **21:30 Asia/Kuala_Lumpur**.

## Primary clock — Vercel Cron

Vercel owns the exact slot clock:

- morning acquisition: **01:30 UTC / 09:30 MYT**
- evening acquisition: **13:30 UTC / 21:30 MYT**
- acquisition watchdogs: five minutes after each slot
- intelligence continuation: every two minutes from :32 through :58

The intelligence route advances at most one durable model stage per invocation. Repeated cron calls therefore resume from persisted checkpoints rather than running a long multi-stage model chain inside one serverless request. Once the canonical run is complete, later continuation calls no-op.

All research cron routes resolve the same stable identity:

```text
cron-v1:<morning|evening>:<Malaysia date>
```

## Recovery transport — GitHub Actions

GitHub Actions no longer owns the exact 09:30 / 21:30 clock. Its scheduled recovery runs occur at:

- **10:05 MYT / 02:05 UTC**
- **22:05 MYT / 14:05 UTC**

The GitHub OIDC bridge sends the audited marker `github-scheduled`, but the Live admin bridge deliberately strips that marker from the canonical run key. Vercel and GitHub therefore converge on the same row.

If Vercel completed the slot, GitHub exits or finalises a harmless no-op. If Vercel acquisition or intelligence is still resumable, GitHub continues the same run. Terminal failed/blocked runs are not silently replaced; they still require an explicit audited retry key.

## Why this is safe

- acquisition is protected by the unique canonical `run_key`
- continuation claims use compare-and-set persistence and an active-claim lease
- one model stage runs per continuation invocation
- publication checkpoints are durable and replayable
- the later GitHub transport does not mint a second scheduled run
- the middleware pause guard remains available for rollback through `PRODUCTION_RESEARCH_AUTOMATION_PAUSED`

Video discovery remains separate:

- `/api/cron/video/midnight` at 09:00 MYT
- `/api/cron/video/transcript-worker` at 09:30 MYT
- `/api/cron/video/late-morning` at 21:00 MYT

Video discovery and transcript processing can create creator-lead evidence, but they do not replace the 09:30 / 21:30 full Live research cycles and cannot independently publish a Story to Hybrid.
