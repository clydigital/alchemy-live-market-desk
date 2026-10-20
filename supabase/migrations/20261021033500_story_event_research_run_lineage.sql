-- Preserve the existing immutable canonical Story-thesis version writer.
-- Scope: attach the EXACT originating intelligence engine's research_run_id
-- to NEW Story events when canonical Story maintenance supplies engineRunId.
-- No backfill: prior story_events are append-only, and their historical lineage
-- must be resolved read-only through event.metadata.engineRunId.
-- No new tables, new reasoning engines, new Story writer or trigger paths.
-- Source: exact live capture_story_thesis_version() definition, with one
-- declared UUID and one bounded lookup before the existing event insertion.

CREATE OR REPLACE FUNCTION public.capture_story_thesis_version()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
  next_version integer;
  new_version_id uuid;
  revision_event_id uuid;
  origin_research_run_id uuid;
  maintenance_context jsonb;
  reasoning_context jsonb;
  event_metadata jsonb;
  version_snapshot jsonb;
  prior_reasoning jsonb;
  carried_reasoning jsonb;
  reasoning_patch jsonb;
  event_type_value text := 'thesis_revision';
  event_headline text;
  event_detail text;
  event_at_value timestamptz := now();
  confidence_delta_value integer;
  change_reason_value text := 'story_updated';
begin
  begin
    maintenance_context := nullif(current_setting('alchemy.story_maintenance_context', true), '')::jsonb;
  exception when others then
    maintenance_context := null;
  end;

  begin
    reasoning_context := nullif(current_setting('alchemy.story_reasoning_context', true), '')::jsonb;
  exception when others then
    reasoning_context := null;
  end;

  if maintenance_context is not null and reasoning_context is not null then
    raise exception 'Story maintenance and canonical reasoning contexts cannot be active together';
  end if;
  if maintenance_context is not null and jsonb_typeof(maintenance_context) <> 'object' then
    raise exception 'Story maintenance context is invalid';
  end if;

  if reasoning_context is not null and (
    jsonb_typeof(reasoning_context) <> 'object'
    or nullif(btrim(reasoning_context ->> 'mutationKey'), '') is null
    or reasoning_context ->> 'mutationKind' <> 'existing_story_update'
    or jsonb_typeof(reasoning_context -> 'reasoning') <> 'object'
    or reasoning_context -> 'reasoning' ->> 'contractVersion' <> 'canonical-story-reasoning/v1'
    or jsonb_typeof(coalesce(reasoning_context -> 'eventMetadata', '{}'::jsonb)) <> 'object'
  ) then
    raise exception 'Canonical Story reasoning context is invalid';
  end if;

  if row(
    new.title,new.thesis,new.status,new.confidence,new.market_question,new.dominant_narrative,
    new.best_explanation,new.strongest_support,new.strongest_contradiction,new.priced_assessment,
    new.confirmation_trigger,new.invalidation_trigger,new.next_catalyst,new.article_angle,
    new.provisional_title,new.article_verdict,new.assets
  ) is not distinct from row(
    old.title,old.thesis,old.status,old.confidence,old.market_question,old.dominant_narrative,
    old.best_explanation,old.strongest_support,old.strongest_contradiction,old.priced_assessment,
    old.confirmation_trigger,old.invalidation_trigger,old.next_catalyst,old.article_angle,
    old.provisional_title,old.article_verdict,old.assets
  ) and reasoning_context is null then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.id::text, 0));
  select coalesce(max(version.version_number), 0) + 1
  into next_version
  from public.story_thesis_versions version
  where version.story_id = new.id;

  event_metadata := jsonb_build_object(
    'automatic', true,
    'previous_version_id', old.current_thesis_version_id
  );
  version_snapshot := to_jsonb(new);
  event_headline := format('Story thesis version %s recorded', next_version);
  event_detail := 'A thesis-bearing Story field changed. The complete prior version remains preserved.';

  if reasoning_context is not null then
    event_metadata := coalesce(reasoning_context -> 'eventMetadata', '{}'::jsonb) || jsonb_build_object(
      'automatic', true,
      'origin', 'alchemy_research_engine',
      'canonicalMutationKey', reasoning_context ->> 'mutationKey',
      'previous_version_id', old.current_thesis_version_id
    );
    version_snapshot := version_snapshot || jsonb_build_object(
      'origin', 'alchemy_research_engine',
      'canonicalMutationKey', reasoning_context ->> 'mutationKey',
      'canonicalMutationKind', 'existing_story_update',
      'priorVersion', next_version - 1,
      'reasoning', reasoning_context -> 'reasoning'
    );
    event_headline := left(reasoning_context ->> 'eventHeadline', 180);
    event_detail := reasoning_context ->> 'eventDetail';
    event_at_value := (reasoning_context ->> 'eventAt')::timestamptz;
    confidence_delta_value := new.confidence - old.confidence;
    change_reason_value := 'material_evidence_recalibration';
  elsif maintenance_context is not null then
    reasoning_patch := coalesce(maintenance_context -> 'reasoningPatch', '{}'::jsonb);
    if jsonb_typeof(reasoning_patch) <> 'object' then
      raise exception 'Story maintenance reasoning patch must be an object';
    end if;

    if old.current_thesis_version_id is not null then
      select version.snapshot -> 'reasoning'
      into prior_reasoning
      from public.story_thesis_versions version
      where version.id = old.current_thesis_version_id
        and version.story_id = new.id;
    end if;

    carried_reasoning := public.story_maintenance_reasoning_for_version(prior_reasoning, reasoning_patch);
    if carried_reasoning is not null then
      version_snapshot := version_snapshot || jsonb_build_object(
        'reasoning', carried_reasoning
      );
    end if;

    event_metadata := event_metadata || jsonb_build_object('origin', 'existing_story_maintenance') || maintenance_context;
    version_snapshot := version_snapshot || jsonb_build_object('maintenanceContext', maintenance_context);
    change_reason_value := 'material_evidence_recalibration';
    confidence_delta_value := new.confidence - old.confidence;
    event_type_value := case
      when maintenance_context ->> 'disposition' = 'invalidated' then 'invalidation'
      when maintenance_context ->> 'disposition' = 'reinforced' then 'confirmation'
      else 'thesis_revision'
    end;
    event_headline := left(format(
      'Existing Story %s: %s',
      maintenance_context ->> 'disposition',
      coalesce(maintenance_context ->> 'rationale', 'material evidence recalibration')
    ), 180);
    event_detail := coalesce(
      maintenance_context ->> 'rationale',
      'Existing Story was recalibrated against fresh evidence.'
    );
  end if;

  if nullif(btrim(event_headline), '') is null then
    raise exception 'Story thesis event headline is required';
  end if;

  -- Event-to-research lineage uses the *same* canonical engine-run identity
  -- already recorded by existing Story maintenance. Do not infer from time.
  -- Historical immutable events are intentionally left unchanged.
  if maintenance_context is not null
    and coalesce(maintenance_context ->> 'engineRunId','')
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}

  insert into public.story_thesis_versions (
    story_id,event_id,version_number,title,thesis,status,confidence,market_question,
    dominant_narrative,best_explanation,strongest_support,strongest_contradiction,
    priced_assessment,confirmation_trigger,invalidation_trigger,next_catalyst,
    article_angle,provisional_title,article_verdict,assets,snapshot,change_reason,effective_at
  ) values (
    new.id,revision_event_id,next_version,new.title,new.thesis,new.status,new.confidence,new.market_question,
    new.dominant_narrative,new.best_explanation,new.strongest_support,new.strongest_contradiction,
    new.priced_assessment,new.confirmation_trigger,new.invalidation_trigger,new.next_catalyst,
    new.article_angle,new.provisional_title,new.article_verdict,new.assets,version_snapshot,change_reason_value,event_at_value
  ) returning id into new_version_id;

  if reasoning_context is not null then
    perform set_config('alchemy.story_reasoning_context', '', true);
  end if;
  if maintenance_context is not null then
    perform set_config('alchemy.story_maintenance_context', '', true);
  end if;

  update public.stories story
  set current_thesis_version_id = new_version_id
  where story.id = new.id
    and story.current_thesis_version_id is distinct from new_version_id;

  return new;
end;
$function$
 then
    select run.research_run_id into origin_research_run_id
    from public.intelligence_engine_runs run
    where run.id = (maintenance_context ->> 'engineRunId')::uuid;
  end if;

  insert into public.story_events (
    story_id,event_type,headline,detail,confidence_delta,event_at,metadata,research_run_id
  ) values (
    new.id,event_type_value,event_headline,event_detail,confidence_delta_value,event_at_value,event_metadata,origin_research_run_id
  ) returning id into revision_event_id;

  insert into public.story_thesis_versions (
    story_id,event_id,version_number,title,thesis,status,confidence,market_question,
    dominant_narrative,best_explanation,strongest_support,strongest_contradiction,
    priced_assessment,confirmation_trigger,invalidation_trigger,next_catalyst,
    article_angle,provisional_title,article_verdict,assets,snapshot,change_reason,effective_at
  ) values (
    new.id,revision_event_id,next_version,new.title,new.thesis,new.status,new.confidence,new.market_question,
    new.dominant_narrative,new.best_explanation,new.strongest_support,new.strongest_contradiction,
    new.priced_assessment,new.confirmation_trigger,new.invalidation_trigger,new.next_catalyst,
    new.article_angle,new.provisional_title,new.article_verdict,new.assets,version_snapshot,change_reason_value,event_at_value
  ) returning id into new_version_id;

  if reasoning_context is not null then
    perform set_config('alchemy.story_reasoning_context', '', true);
  end if;
  if maintenance_context is not null then
    perform set_config('alchemy.story_maintenance_context', '', true);
  end if;

  update public.stories story
  set current_thesis_version_id = new_version_id
  where story.id = new.id
    and story.current_thesis_version_id is distinct from new_version_id;

  return new;
end;
$function$
