# Bluebelly scheduled research: source-only completion cutover (7 November 2026)

## What changes
The **existing** authorised morning/evening Vercel scheduled acquisition remains the provider/source collector. ChatGPT Work MacroPulse, Research Investigation, Creator Market Intelligence and the 16-company AI evidence task are unaffected. This cutover removes the **automatic model/Story/Dossier publisher dependency** from those two Vercel acquisition runs, without adding a new task, engine or scheduler.

The previous flow: `/api/cron/research/(morning|evening)` → source intake `/api/research-update` persists `research_runs` and original-source rows → returns `intelligence_pending` → one of 16 continuation slots calls the intelligence model, completes canonical base/composed edition → post-research Dossier cron may write a report. The database also contains a legacy trigger that would generate a `daily_brief` automatically on a plain `research_runs.status=completed` transition even if no application model was called.

The replacement flow (source only): authenticated Vercel acquisition → source and primary-event receipts, source checks, verified/reported Motion, macro/calendar checks, and source-ledger persistence → a compare-and-set update to `research_runs.status=completed` (or `blocked` if structural gate/source checks fail) with marker `BLUEBELLY_SOURCE_ONLY_V1` and `updates_published=0`. For this marked run only, the database trigger publishes **no** Story/daily-brief snapshot and sets `research_slot_runs.live_publication_status` and `hybrid_handoff_status` to **`not_required`**. Research Gap no longer mistakes an otherwise healthy source-only run for a perpetually running intelligence stage. Source checks are **not** the same as verified statements or verified price reactions; reported leads retain their provenance.

## Rollout and rollback
- **Default enabled** for authenticated scheduled acquisition on the new release. Explicit emergency rollback: set `BLUEBELLY_SOURCE_ONLY_RESEARCH_DISABLED=true` and redeploy/reinvoke the existing Vercel scheduled path. The old `x-alchemy-defer-intelligence` continuation remains functional for non-source-only runs.
- The database migration must be applied **before** deploying the source-only application code. Its two replaced trigger functions preserve exact legacy behaviour for any run **without** the marker. No RLS/schema grants, new public routes, data deletion or cron changes.
- Only requests authenticated by the existing `CRON_SECRET` and explicitly marked `x-alchemy-scheduled-research:1` plus `x-alchemy-source-only:1` can use source-only completion. Requests authenticated with a generic research update token cannot select this mode. User-initiated manual research and Research Gap handoff continue through existing independent paths.
- This intentionally does **not** retroactively mutate old `research_runs`, Story versions, published `daily_brief` snapshots or historical HTML/PDF editions.
- The original 16 continuation and four Dossier cron entries remain scheduled during the acceptance window. They should find the new intake runs terminal and **must not invoke OpenAI stages** or create reports. Remove them only after morning **and** evening live comparisons prove source freshness, intake counts, slot-state termination, no new engine/daily-brief, Research Gap unblocked and historical replay unchanged.

## Readback/acceptance
For each observed new `cron-v1:morning:YYYY-MM-DD` and `cron-v1:evening:YYYY-MM-DD`:
1. Verify source receipt count/URLs and their original publisher dates, no provider/source gaps hidden by a `completed` status.
2. Verify `research_runs.status=completed` or source-blocked, `updates_published=0`, marker present in `warnings`, and terminal `completed_at`.
3. Verify `research_slot_runs.status=completed`, `live_publication_status=not_required`, `hybrid_handoff_status=not_required`, `stage_summary.source_only=true` (for source-complete runs).
4. Verify **zero** `intelligence_engine_runs` and **zero** `hybrid_publication_snapshots` rows associated with the new source-only research_run_id. Old runs stay unchanged.
5. Verify original-source Newsroom and the public market reader still expose only qualified facts and time-stamped prices; private Notion/ChatGPT reader can pull the underlying proof.
6. Verify Research Gap cycle/handoff does not defer due to a stale running morning/evening slot. Verify creator video/transcript and company intake still persist.
7. Validate a real market source with independently dated price reaction where possible; otherwise mark reaction UNKNOWN.

## SQL readback (read-only; inspect run IDs without revealing owner/private values)

```sql
select run_key,status,updates_published,completed_at, 
  'BLUEBELLY_SOURCE_ONLY_V1'=any(warnings) as source_only 
from public.research_runs 
where run_key like 'cron-v1:%' order by scheduled_for desc limit 6;

select r.run_key,s.status,s.health_state,s.live_publication_status,s.hybrid_handoff_status,s.stage_summary
from public.research_runs r join public.research_slot_runs s on s.research_run_id=r.id
where r.run_key like 'cron-v1:%'
order by r.scheduled_for desc limit 6;

select r.run_key,
  (select count(*) from public.intelligence_engine_runs e where e.research_run_id=r.id) as model_stages,
  (select count(*) from public.hybrid_publication_snapshots p where p.research_run_id=r.id) as generated_snapshots,
  (select count(*) from public.research_intake_items i where i.run_id=r.id) as intake_receipts
from public.research_runs r where r.run_key like 'cron-v1:%'
order by r.scheduled_for desc limit 6;
```

## Do not do
- Do not remove automatic continuation cron entries before source-only terminal status is verified in both slots.
- Do not mark all accepted intake as independently verified factual evidence.
- Do not reenable the 3-idea Writing Brain, daily intelligence HTML/PDF or mandatory story publishing.
- Do not widen private endpoints, publish personal portfolio information or overwrite historical edition IDs.
