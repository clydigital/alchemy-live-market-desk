# Hormuz crossing monitor

Prepared implementation: `feat/hormuz-crossing-monitor`.

## Behaviour

- Free, keyless upstream: https://hormuz.data-tracking.net/api/summary?hours=24 and https://hormuz.data-tracking.net/api/crossings/daily?days=30.
- Shared Supabase singleton cache and atomic service-role lease. Each eligible refresh requests each endpoint once. At least 30 minutes between attempts, including errors, across instances. Storage failure fails closed without direct upstream fallback.
- Preserves provider `last_poll` as `observedAt`, `retrievedAt`, UTC daily dates, and rolling 24-hour measurement window. Flags stale observations/retrievals at 90 minutes and on failed refresh; retains last valid snapshot. Client timer only ages the display, never fetches.
- Daily inbound/outbound counts; excludes in-strait vessels. Missing directions stay unknown. First window-boundary day and source-current day excluded from comparisons. Weekly change requires 14 consecutive complete days, with zero-baseline percentages unavailable.
- Bluebelly Markets All/Energy and existing Global oil flow & demand terminal show the monitor. Server-side rendering uses the shared cache function. Machine GET /api/oil/hormuz requires existing research/cron bearer on the operational Live hostname; Bluebelly API host restrictions remain intact.
- Attributed AIS discovery observation, not canonical evidence or measured oil volumes. No Story/Dossier writes or additional paid services/tasks/cron.

## Existing MacroPulse

Updated only the prompt of existing task 6a59c6cad9ac8191ac5f2393e29e6c64, preserving enabled state and its two-hour schedule. It checks the deployed panel or authenticated cached route, preserves provenance, flags stale data, independently verifies supply interpretations, and uses the existing Notion/evidence/Gap workflow. Until the panel is actually deployed it must report UNAVAILABLE, not invent ingestion or poll upstream around the cache.

## Verification and release status

- TypeScript check: passed.
- Full test suite: 2,566 passed, one skipped, zero failed.
- Next production build: passed; existing unrelated CSS autoprefixer warnings.
- Supabase migration applied to the existing Live Market Desk project. Transactional, rolled-back checks passed: duplicate claims rejected; failed refresh retained snapshot; stale lease could not overwrite; 30-minute cooldown maintained; anon/authenticated privileges denied.
- No new snapshot seeded: first eligible deployed read will fill the cache.
- Git push blocked by automatic approval review because the existing destination repository is public and the reviewer required explicit disclosure approval. No PR/deployment or deployed browser QA completed. Code committed locally; do not claim live integration until authorised push, deployment and runtime verification succeed.

Release: authorise push to clydigital/alchemy-live-market-desk, open/review PR, verify preview and existing host/auth boundary, merge/deploy, then verify source timestamps and unchanged cache across repeated reads. Do not add a scheduled task.
