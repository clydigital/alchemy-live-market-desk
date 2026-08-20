-- Harden the append-only specialist sensor memory after production verification.
-- Runtime service_role needs SELECT + INSERT only. Row UPDATE/DELETE and TRUNCATE
-- are forbidden at both privilege and trigger layers.

revoke update, delete, truncate, references, trigger
  on table public.raw_source_records
  from service_role;
revoke update, delete, truncate, references, trigger
  on table public.normalised_observations
  from service_role;

grant select, insert on table public.raw_source_records to service_role;
grant select, insert on table public.normalised_observations to service_role;

drop trigger if exists raw_source_records_no_truncate on public.raw_source_records;
create trigger raw_source_records_no_truncate
before truncate on public.raw_source_records
for each statement execute function public.prevent_sensor_memory_mutation();

drop trigger if exists normalised_observations_no_truncate on public.normalised_observations;
create trigger normalised_observations_no_truncate
before truncate on public.normalised_observations
for each statement execute function public.prevent_sensor_memory_mutation();

-- Cover the foreign-key lookup paths introduced by sensor memory.
create index if not exists raw_source_records_intake_item_idx
  on public.raw_source_records(intake_item_id)
  where intake_item_id is not null;
create index if not exists raw_source_records_supersedes_idx
  on public.raw_source_records(supersedes_record_id)
  where supersedes_record_id is not null;
create index if not exists normalised_observations_source_idx
  on public.normalised_observations(source_id)
  where source_id is not null;
create index if not exists normalised_observations_supersedes_idx
  on public.normalised_observations(supersedes_observation_id)
  where supersedes_observation_id is not null;
create index if not exists intelligence_evidence_raw_source_record_idx
  on public.intelligence_evidence(raw_source_record_id)
  where raw_source_record_id is not null;
create index if not exists story_events_observation_idx
  on public.story_events(observation_id)
  where observation_id is not null;
