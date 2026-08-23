-- PR #99 only: atomically persist one canonical Story reasoning mutation.
--
-- The existing thesis trigger remains authoritative for every thesis-bearing
-- UPDATE, including PR #94/#95 maintenance. The new RPC supplies a validated,
-- transaction-local reasoning context so that same trigger writes the one
-- reasoning-bearing event/version for an existing Story. Initial Story creation
-- is handled directly inside the same RPC because the production trigger is
-- intentionally UPDATE-only.

create unique index if not exists story_thesis_versions_canonical_mutation_key_uidx
  on public.story_thesis_versions ((snapshot ->> 'canonicalMutationKey'))
  where snapshot ? 'canonicalMutationKey';

create or replace function public.capture_story_thesis_version()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  next_version integer;
  new_version_id uuid;
  revision_event_id uuid;
  maintenance_context jsonb;
  reasoning_context jsonb;
  event_metadata jsonb;
  version_snapshot jsonb;
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
    event_metadata := event_metadata || jsonb_build_object('origin', 'existing_story_maintenance') || maintenance_context;
    version_snapshot := version_snapshot || jsonb_build_object('maintenanceContext', maintenance_context);
    change_reason_value := 'material_evidence_recalibration';
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

  insert into public.story_events (
    story_id,event_type,headline,detail,confidence_delta,event_at,metadata
  ) values (
    new.id,event_type_value,event_headline,event_detail,confidence_delta_value,event_at_value,event_metadata
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

  -- The trigger's pointer UPDATE fires this trigger again. Consume only the
  -- explicit reasoning context first; the nested UPDATE then follows the
  -- unchanged-field fast path without suppressing unrelated nested callers.
  if reasoning_context is not null then
    perform set_config('alchemy.story_reasoning_context', '', true);
  end if;

  update public.stories story
  set current_thesis_version_id = new_version_id
  where story.id = new.id
    and story.current_thesis_version_id is distinct from new_version_id;

  return new;
end;
$$;

create or replace function public.persist_canonical_story_reasoning(
  p_mutation_key text,
  p_story_id uuid,
  p_story jsonb,
  p_reasoning jsonb,
  p_event jsonb
)
returns table(
  story jsonb,
  version_id uuid,
  event_id uuid,
  version_number integer,
  created boolean,
  applied boolean
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  mutation_key_value text := nullif(btrim(p_mutation_key), '');
  event_at_value timestamptz;
  assets_value text[];
  story_row public.stories%rowtype;
  result_story jsonb;
  result_version_id uuid;
  result_event_id uuid;
  result_version_number integer;
  existing_story_id uuid;
  existing_reasoning jsonb;
  existing_mutation_kind text;
  reasoning_context jsonb;
begin
  if mutation_key_value is null then
    raise exception 'Canonical Story mutation key is required';
  end if;
  if jsonb_typeof(p_story) <> 'object'
    or nullif(btrim(p_story ->> 'title'), '') is null
    or nullif(btrim(p_story ->> 'thesis'), '') is null
    or nullif(btrim(p_story ->> 'status'), '') is null
    or p_story ->> 'confidence' is null
    or jsonb_typeof(p_story -> 'assets') <> 'array' then
    raise exception 'Canonical Story payload is invalid';
  end if;
  if jsonb_typeof(p_reasoning) <> 'object'
    or p_reasoning ->> 'contractVersion' <> 'canonical-story-reasoning/v1' then
    raise exception 'Canonical Story reasoning payload is invalid';
  end if;
  if jsonb_typeof(p_event) <> 'object'
    or nullif(btrim(p_event ->> 'headline'), '') is null
    or nullif(btrim(p_event ->> 'event_at'), '') is null
    or jsonb_typeof(coalesce(p_event -> 'metadata', '{}'::jsonb)) <> 'object' then
    raise exception 'Canonical Story event payload is invalid';
  end if;

  event_at_value := (p_event ->> 'event_at')::timestamptz;
  assets_value := array(select jsonb_array_elements_text(p_story -> 'assets'));

  -- One stable application mutation key serializes retries before any Story
  -- row is locked or created. The partial unique index is the final guard.
  perform pg_advisory_xact_lock(hashtextextended('canonical-story-reasoning:' || mutation_key_value, 0));

  select
    version.story_id,
    version.id,
    version.event_id,
    version.version_number,
    version.snapshot -> 'reasoning',
    version.snapshot ->> 'canonicalMutationKind'
  into
    existing_story_id,
    result_version_id,
    result_event_id,
    result_version_number,
    existing_reasoning,
    existing_mutation_kind
  from public.story_thesis_versions version
  where version.snapshot ->> 'canonicalMutationKey' = mutation_key_value
  limit 1;

  if result_version_id is not null then
    if p_story_id is not null and p_story_id is distinct from existing_story_id then
      raise exception 'Canonical Story mutation key already belongs to another Story';
    end if;
    if existing_reasoning is distinct from p_reasoning then
      raise exception 'Canonical Story mutation retry changed its reasoning payload';
    end if;
    if exists (
      select 1
      from public.story_thesis_versions version
      where version.id = result_version_id
        and row(
          version.title,version.thesis,version.status,version.confidence,version.market_question,
          version.dominant_narrative,version.best_explanation,version.strongest_support,
          version.strongest_contradiction,version.priced_assessment,version.confirmation_trigger,
          version.invalidation_trigger,version.next_catalyst,version.article_angle,
          version.provisional_title,version.article_verdict,version.assets
        ) is distinct from row(
          p_story ->> 'title',p_story ->> 'thesis',p_story ->> 'status',(p_story ->> 'confidence')::integer,
          p_story ->> 'market_question',p_story ->> 'dominant_narrative',p_story ->> 'best_explanation',
          p_story ->> 'strongest_support',p_story ->> 'strongest_contradiction',p_story ->> 'priced_assessment',
          p_story ->> 'confirmation_trigger',p_story ->> 'invalidation_trigger',p_story ->> 'next_catalyst',
          p_story ->> 'article_angle',p_story ->> 'provisional_title',p_story ->> 'article_verdict',assets_value
        )
    ) then
      raise exception 'Canonical Story mutation retry changed its Story payload';
    end if;
    if exists (
      select 1
      from public.story_events event
      where event.id = result_event_id
        and (
          event.headline is distinct from left(p_event ->> 'headline', 180)
          or event.detail is distinct from p_event ->> 'detail'
          or event.event_at is distinct from event_at_value
          or not (event.metadata @> coalesce(p_event -> 'metadata', '{}'::jsonb))
        )
    ) then
      raise exception 'Canonical Story mutation retry changed its event payload';
    end if;

    select to_jsonb(existing_story)
    into result_story
    from public.stories existing_story
    where existing_story.id = existing_story_id;

    return query select
      result_story,
      result_version_id,
      result_event_id,
      result_version_number,
      existing_mutation_kind = 'new_story',
      false;
    return;
  end if;

  if p_story_id is null then
    if nullif(btrim(p_story ->> 'slug'), '') is null then
      raise exception 'New canonical Story slug is required';
    end if;

    insert into public.stories (
      slug,title,thesis,status,confidence,market_question,dominant_narrative,
      best_explanation,strongest_support,strongest_contradiction,priced_assessment,
      confirmation_trigger,invalidation_trigger,next_catalyst,article_angle,
      provisional_title,article_verdict,assets,created_by,source_quality,novelty,
      persistence,trader_relevance,article_potential,updated_at
    ) values (
      p_story ->> 'slug',
      p_story ->> 'title',
      p_story ->> 'thesis',
      p_story ->> 'status',
      (p_story ->> 'confidence')::integer,
      p_story ->> 'market_question',
      p_story ->> 'dominant_narrative',
      p_story ->> 'best_explanation',
      p_story ->> 'strongest_support',
      p_story ->> 'strongest_contradiction',
      p_story ->> 'priced_assessment',
      p_story ->> 'confirmation_trigger',
      p_story ->> 'invalidation_trigger',
      p_story ->> 'next_catalyst',
      p_story ->> 'article_angle',
      p_story ->> 'provisional_title',
      p_story ->> 'article_verdict',
      assets_value,
      coalesce(p_story ->> 'created_by', 'alchemy_research_engine'),
      coalesce((p_story ->> 'source_quality')::integer, 75),
      coalesce((p_story ->> 'novelty')::integer, 50),
      coalesce((p_story ->> 'persistence')::integer, 50),
      coalesce((p_story ->> 'trader_relevance')::integer, 50),
      coalesce((p_story ->> 'article_potential')::integer, 50),
      event_at_value
    ) returning * into story_row;

    insert into public.story_events (
      story_id,event_type,headline,detail,event_at,metadata
    ) values (
      story_row.id,
      'thesis_revision',
      left(p_event ->> 'headline', 180),
      p_event ->> 'detail',
      event_at_value,
      coalesce(p_event -> 'metadata', '{}'::jsonb) || jsonb_build_object(
        'automatic', true,
        'origin', 'alchemy_research_engine',
        'canonicalMutationKey', mutation_key_value
      )
    ) returning id into result_event_id;

    result_version_number := 1;
    insert into public.story_thesis_versions (
      story_id,event_id,version_number,title,thesis,status,confidence,market_question,
      dominant_narrative,best_explanation,strongest_support,strongest_contradiction,
      priced_assessment,confirmation_trigger,invalidation_trigger,next_catalyst,
      article_angle,provisional_title,article_verdict,assets,snapshot,change_reason,effective_at
    ) values (
      story_row.id,result_event_id,result_version_number,story_row.title,story_row.thesis,
      story_row.status,story_row.confidence,story_row.market_question,story_row.dominant_narrative,
      story_row.best_explanation,story_row.strongest_support,story_row.strongest_contradiction,
      story_row.priced_assessment,story_row.confirmation_trigger,story_row.invalidation_trigger,
      story_row.next_catalyst,story_row.article_angle,story_row.provisional_title,
      story_row.article_verdict,story_row.assets,
      to_jsonb(story_row) || jsonb_build_object(
        'origin', 'alchemy_research_engine',
        'canonicalMutationKey', mutation_key_value,
        'canonicalMutationKind', 'new_story',
        'reasoning', p_reasoning
      ),
      'story_created',
      event_at_value
    ) returning id into result_version_id;

    update public.stories new_story
    set current_thesis_version_id = result_version_id
    where new_story.id = story_row.id;
  else
    select *
    into story_row
    from public.stories existing_story
    where existing_story.id = p_story_id
    for update;

    if story_row.id is null then
      raise exception 'Canonical Story % was not found', p_story_id;
    end if;

    reasoning_context := jsonb_build_object(
      'mutationKey', mutation_key_value,
      'mutationKind', 'existing_story_update',
      'reasoning', p_reasoning,
      'eventHeadline', p_event ->> 'headline',
      'eventDetail', p_event ->> 'detail',
      'eventAt', p_event ->> 'event_at',
      'eventMetadata', coalesce(p_event -> 'metadata', '{}'::jsonb)
    );
    perform set_config('alchemy.story_reasoning_context', reasoning_context::text, true);

    update public.stories existing_story
    set title = p_story ->> 'title',
        thesis = p_story ->> 'thesis',
        status = p_story ->> 'status',
        confidence = (p_story ->> 'confidence')::integer,
        market_question = p_story ->> 'market_question',
        dominant_narrative = p_story ->> 'dominant_narrative',
        best_explanation = p_story ->> 'best_explanation',
        strongest_support = p_story ->> 'strongest_support',
        strongest_contradiction = p_story ->> 'strongest_contradiction',
        priced_assessment = p_story ->> 'priced_assessment',
        confirmation_trigger = p_story ->> 'confirmation_trigger',
        invalidation_trigger = p_story ->> 'invalidation_trigger',
        next_catalyst = p_story ->> 'next_catalyst',
        article_angle = p_story ->> 'article_angle',
        provisional_title = p_story ->> 'provisional_title',
        article_verdict = p_story ->> 'article_verdict',
        assets = assets_value,
        updated_at = event_at_value
    where existing_story.id = p_story_id;

    -- Do not leak the explicit full-reasoning intent to later statements when
    -- this RPC is invoked inside a caller-managed transaction.
    perform set_config('alchemy.story_reasoning_context', '', true);

    select
      current_story.current_thesis_version_id,
      to_jsonb(current_story)
    into result_version_id, result_story
    from public.stories current_story
    where current_story.id = p_story_id;

    select version.event_id, version.version_number
    into result_event_id, result_version_number
    from public.story_thesis_versions version
    where version.id = result_version_id
      and version.story_id = p_story_id
      and version.snapshot ->> 'canonicalMutationKey' = mutation_key_value
      and version.snapshot -> 'reasoning' = p_reasoning;

    if result_event_id is null or result_version_number is null then
      raise exception 'Canonical Story reasoning trigger did not persist the exact version';
    end if;

    insert into public.story_updates (
      story_id,update_type,headline,detail,observed_at,suppress_event_mirror
    ) values (
      p_story_id,
      'recalibration',
      left(p_event ->> 'headline', 90),
      p_event ->> 'detail',
      event_at_value,
      true
    );
  end if;

  select to_jsonb(final_story)
  into result_story
  from public.stories final_story
  where final_story.id = coalesce(p_story_id, story_row.id);

  return query select
    result_story,
    result_version_id,
    result_event_id,
    result_version_number,
    p_story_id is null,
    true;
end;
$$;

revoke all on function public.persist_canonical_story_reasoning(text, uuid, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
grant execute on function public.persist_canonical_story_reasoning(text, uuid, jsonb, jsonb, jsonb)
  to service_role;

comment on function public.persist_canonical_story_reasoning(text, uuid, jsonb, jsonb, jsonb) is
  'PR #99 atomic persistence boundary for one validated Canonical Story Reasoning V1 mutation. Reasoning is supplied by the application and is never reconstructed here.';

-- Rollback path (not executed here): drop persist_canonical_story_reasoning and
-- story_thesis_versions_canonical_mutation_key_uidx, then restore the exact
-- deployed pre-PR99 capture_story_thesis_version() definition. That predecessor
-- matches 20260821080427_story_review_proof_hardening.sql except it also
-- contains the dead assignment:
--   event_headline := format('Story thesis version %%s recorded');
-- immediately after:
--   version_snapshot := to_jsonb(new);
-- No historical row is changed by either this migration or that rollback
-- sequence.
