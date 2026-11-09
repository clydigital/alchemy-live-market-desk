# Power Stack quote scheduler — Supabase Free

**Production:** Supabase project `qdtlrfgxpsnxajiptrno` stores owner-scoped quote observations and runs the scheduler. Vercel continues to host the existing Bluebelly Next.js quote collection route; it is **not** the scheduler.

## Schedule / contract
- `pg_cron` / `pg_net`, weekdays **23:15 UTC** (07:15 MYT next day, after regular US trading close).
- Job name `power_stack_owner_quotes_weekdays`.
- HTTP GET `https://alchemy-live-market-desk-rogue-magazine.vercel.app/api/cron/power-stack/quotes`.
- Header `Authorization: Bearer <dedicated token>` read *at runtime* from Supabase Vault secret `power_stack_refresh_token`.
- On Vercel, the same token is configured in the server-only **production** environment variable `POWER_STACK_REFRESH_TOKEN`. It is never committed or passed in the URL.
- `/api/cron/power-stack/quotes` upserts **dated, owner-scoped observations** into `public.power_stack_quote_observations`, sourced only from the existing monitored symbols with source/provenance. It does not update brokerage quantities or manufacture analyst estimates.
- The Power Stack page is authenticated. No public portfolio API is introduced.
- `vercel.json` has no Power Stack quote schedule; all other Vercel scheduled jobs are unchanged.

## SQL operations performed via privileged connection
Install extensions idempotently (included in the checked-in migration):
```sql
create extension if not exists pg_cron with schema pg_catalog;
create extension if not exists pg_net;
```
Generate the token via cryptographic PostgreSQL UUIDs and store using `vault.create_secret`; configure Vercel env separately. Never paste the token into GitHub.

After both ends share the token, create the job using privileged SQL:
```sql
select cron.schedule(
 'power_stack_owner_quotes_weekdays', '15 23 * * 1-5',
 $job$
 select net.http_get(
   url := 'https://alchemy-live-market-desk-rogue-magazine.vercel.app/api/cron/power-stack/quotes',
   headers := jsonb_build_object('Authorization', 'Bearer ' ||
      (select decrypted_secret from vault.decrypted_secrets where name='power_stack_refresh_token')),
   timeout_milliseconds := 180000
 );
 $job$
);
```
Inspect with `select jobid, jobname, schedule, active from cron.job where jobname='power_stack_owner_quotes_weekdays'` and later monitor `cron.job_run_details`, `net._http_response` (short retention), and the owner-scoped quote table's dated counts. A pg_cron 'succeeded' status only verifies the HTTP request was queued, **not** that the target returned 200 or wrote data.

## Limits and rollback
Supabase organisation was verified **Free** on 10 Nov 2026; no plan upgrade was requested. This single daily job is far below normal scheduling limits; project limits and inactivity pausing still apply. Deployment and provider pricing are separate.
To stop: `select cron.unschedule('power_stack_owner_quotes_weekdays')`. Leave quote history intact. If the HTTP response fails, don't retry in a tight loop or silently fabricate data. Rotate both Vault and Vercel secret if compromised.

## First verified production smoke test — 10 Nov 2026 MYT
- Deployment SHA `15fff00eda57caf2de3ec2497c8e709767632d52` was READY.
- Authenticated request to the private operation hostname via `pg_net` returned HTTP **200**, `ownerCount:1`, `observationsUpserted:3`, `symbolsWithoutSupportedQuotes:51`.
- The three stored provider observation dates were **2026-11-06**; provider cache fetch time is not confused with quote date.
- `cron.job` name, `15 23 * * 1-5`, active state and private hostname were verified. Automatic future execution is not yet proven by a scheduled run.
- Operational limitation: the pre-existing market monitor has sparse coverage for the private watchlist. An independent quotes provider is still needed for complete Power Stack prices; no invented quotes or analyst forecasts are emitted.
