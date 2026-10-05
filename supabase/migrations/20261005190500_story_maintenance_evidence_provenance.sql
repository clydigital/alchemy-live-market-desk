-- B4n: preserve authorising Evidence separately from reviewed Evidence.
--
-- Existing Story maintenance already stores assessment.evidence_ids in the
-- immutable thesis-version maintenanceContext as intelligenceEvidenceIds. That
-- list describes everything the Market Belief assessment considered and can
-- therefore include non-material context.
--
-- Material mutation is authorised by assessment.eligible_evidence_ids. Enrich
-- the existing transaction-local maintenance context immediately before the
-- Story UPDATE so the canonical thesis-version trigger records both sets without
-- creating another version writer or changing the maintenance RPC.

begin;

create or replace function public.enrich_story_maintenance_evidence_context()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  maintenance_context jsonb;
  engine_run_id_value uuid;
  eligible_ids uuid[];
begin
  begin
    maintenance_context := nullif(
      current_setting('alchemy.story_maintenance_context', true),
      ''
    )::jsonb;
  exception when others then
    maintenance_context := null;
  end;

  if maintenance_context is null
    or jsonb_typeof(maintenance_context) <> 'object'
    or nullif(btrim(maintenance_context ->> 'engineRunId'), '') is null then
    return new;
  end if;

  begin
    engine_run_id_value := (maintenance_context ->> 'engineRunId')::uuid;
  exception when others then
    return new;
  end;

  select assessment.eligible_evidence_ids
  into eligible_ids
  from public.intelligence_story_assessments assessment
  where assessment.engine_run_id = engine_run_id_value
    and assessment.story_id = new.id
  order by assessment.created_at desc, assessment.id
  limit 1;

  if not found then
    return new;
  end if;

  maintenance_context := maintenance_context || jsonb_build_object(
    'eligibleIntelligenceEvidenceIds',
    to_jsonb(coalesce(eligible_ids, '{}'::uuid[]))
  );

  perform set_config(
    'alchemy.story_maintenance_context',
    maintenance_context::text,
    true
  );

  return new;
end;
$$;

revoke all on function public.enrich_story_maintenance_evidence_context()
  from public, anon, authenticated;

drop trigger if exists stories_enrich_maintenance_evidence_context
  on public.stories;

create trigger stories_enrich_maintenance_evidence_context
before update on public.stories
for each row
execute function public.enrich_story_maintenance_evidence_context();

comment on function public.enrich_story_maintenance_evidence_context() is
  'Adds assessment.eligible_evidence_ids to existing Story maintenance context so immutable thesis versions distinguish reviewed Evidence from Evidence authorised for material mutation.';

commit;
