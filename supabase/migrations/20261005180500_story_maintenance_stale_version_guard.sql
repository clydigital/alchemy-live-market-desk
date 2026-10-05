-- B4i: prevent a frozen Story-maintenance assessment from mutating a Story
-- after a newer canonical thesis version has already been created.
--
-- Exact historical/frozen inputs remain replayable for audit, but a stale
-- maintenance continuation cannot overwrite the newer current Story state.

begin;

create or replace function public.guard_stale_story_maintenance_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  maintenance_context jsonb;
  engine_run_id_value uuid;
  assessment_id_value uuid;
  assessment_selected_at timestamptz;
  current_version_created_at timestamptz;
begin
  begin
    maintenance_context := nullif(
      current_setting('alchemy.story_maintenance_context', true),
      ''
    )::jsonb;
  exception when others then
    maintenance_context := null;
  end;

  if maintenance_context is null then
    return new;
  end if;

  if jsonb_typeof(maintenance_context) <> 'object'
    or nullif(btrim(maintenance_context ->> 'engineRunId'), '') is null then
    raise exception 'Story maintenance context is invalid';
  end if;

  engine_run_id_value := (maintenance_context ->> 'engineRunId')::uuid;

  select assessment.id, assessment.selected_at
  into assessment_id_value, assessment_selected_at
  from public.intelligence_story_assessments assessment
  where assessment.engine_run_id = engine_run_id_value
    and assessment.story_id = old.id
    and assessment.applied_at is null
  order by assessment.created_at desc, assessment.id
  limit 1;

  -- Compatibility boundary: only canonical assessment-backed maintenance is
  -- governed here. Other legacy callers without a live assessment are left to
  -- their existing path rather than being reinterpreted by this migration.
  if assessment_id_value is null then
    return new;
  end if;

  select version.created_at
  into current_version_created_at
  from public.story_thesis_versions version
  where version.id = old.current_thesis_version_id;

  if current_version_created_at is not null
    and current_version_created_at > assessment_selected_at then
    raise exception
      'Stale Story maintenance assessment % was selected before current canonical thesis version %',
      assessment_id_value,
      old.current_thesis_version_id;
  end if;

  return new;
end;
$$;

revoke all on function public.guard_stale_story_maintenance_mutation()
  from public, anon, authenticated;

drop trigger if exists stories_guard_stale_story_maintenance
  on public.stories;

create trigger stories_guard_stale_story_maintenance
before update of
  title,
  thesis,
  status,
  confidence,
  market_question,
  confirmation_trigger,
  invalidation_trigger,
  next_catalyst
on public.stories
for each row
execute function public.guard_stale_story_maintenance_mutation();

commit;
