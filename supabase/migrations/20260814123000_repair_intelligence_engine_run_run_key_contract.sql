-- Repair environments that have the intelligence runtime tables but missed the
-- final run_key contract required by PostgREST on_conflict=run_key.

alter table public.intelligence_engine_runs
  add column if not exists run_key text;

-- Historical rows that predate the run_key contract need a deterministic value
-- before the column can be made non-null and fully unique.
update public.intelligence_engine_runs
set run_key = 'legacy:' || id::text
where run_key is null;

-- If an environment accepted duplicate historical keys before the contract was
-- enforced, preserve every row by making later duplicates explicit.
with duplicate_run_keys as (
  select
    id,
    run_key,
    row_number() over (
      partition by run_key
      order by started_at nulls first, id
    ) as duplicate_rank
  from public.intelligence_engine_runs
  where run_key is not null
)
update public.intelligence_engine_runs as engine_runs
set run_key = duplicate_run_keys.run_key || ':legacy-duplicate:' || engine_runs.id::text
from duplicate_run_keys
where engine_runs.id = duplicate_run_keys.id
  and duplicate_run_keys.duplicate_rank > 1;

alter table public.intelligence_engine_runs
  alter column run_key set not null;

drop index if exists public.intelligence_engine_runs_run_key_idx;

alter table public.intelligence_engine_runs
  drop constraint if exists intelligence_engine_runs_run_key_unique;

alter table public.intelligence_engine_runs
  add constraint intelligence_engine_runs_run_key_unique unique (run_key);
