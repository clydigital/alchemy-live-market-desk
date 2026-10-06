-- Contract proof for Story headline churn guard.
-- Runs in a transaction and leaves no persistent fixture rows.

begin;

do $$
declare
  prior public.story_thesis_versions%rowtype;
  next_version integer;
  created_id uuid;
  created_snapshot jsonb;
  legal_title text;
  failed_as_expected boolean := false;
begin
  select version.*
  into prior
  from public.story_thesis_versions version
  where version.version_number = (
    select max(candidate.version_number)
    from public.story_thesis_versions candidate
    where candidate.story_id = version.story_id
  )
  order by version.created_at, version.story_id
  limit 1;

  if prior.id is null then
    raise exception 'Headline churn contract requires at least one existing Story thesis version fixture';
  end if;

  select coalesce(max(version.version_number), 0) + 1
  into next_version
  from public.story_thesis_versions version
  where version.story_id = prior.story_id;

  begin
    insert into public.story_thesis_versions(
      story_id,event_id,version_number,title,thesis,status,confidence,
      market_question,dominant_narrative,best_explanation,strongest_support,
      strongest_contradiction,priced_assessment,confirmation_trigger,
      invalidation_trigger,next_catalyst,article_angle,provisional_title,
      article_verdict,assets,portfolio_map,snapshot,change_reason,effective_at
    ) values (
      prior.story_id,prior.event_id,next_version,prior.title || ' · cosmetic rewrite',
      prior.thesis,prior.status,prior.confidence,prior.market_question,
      prior.dominant_narrative,prior.best_explanation,prior.strongest_support,
      prior.strongest_contradiction,prior.priced_assessment,
      prior.confirmation_trigger,prior.invalidation_trigger,prior.next_catalyst,
      prior.article_angle,prior.provisional_title,prior.article_verdict,
      prior.assets,prior.portfolio_map,prior.snapshot,'headline_only_test',now()
    );

    raise exception 'Headline-only thesis version unexpectedly succeeded';
  exception
    when check_violation then
      failed_as_expected := true;
  end;

  if not failed_as_expected then
    raise exception 'Headline-only Story change did not fail closed';
  end if;

  legal_title := prior.title || ' · material reframe';

  insert into public.story_thesis_versions(
    story_id,event_id,version_number,title,thesis,status,confidence,
    market_question,dominant_narrative,best_explanation,strongest_support,
    strongest_contradiction,priced_assessment,confirmation_trigger,
    invalidation_trigger,next_catalyst,article_angle,provisional_title,
    article_verdict,assets,portfolio_map,snapshot,change_reason,effective_at
  ) values (
    prior.story_id,prior.event_id,next_version,legal_title,
    prior.thesis || ' Material transmission changed in this accepted version.',
    prior.status,prior.confidence,prior.market_question,
    prior.dominant_narrative,prior.best_explanation,prior.strongest_support,
    prior.strongest_contradiction,prior.priced_assessment,
    prior.confirmation_trigger,prior.invalidation_trigger,prior.next_catalyst,
    prior.article_angle,prior.provisional_title,prior.article_verdict,
    prior.assets,prior.portfolio_map,prior.snapshot,'headline_hygiene_contract_test',now()
  )
  returning id,snapshot into created_id,created_snapshot;

  if created_snapshot #>> '{headlineChange,contractVersion}' <> 'story-headline-change/v1' then
    raise exception 'Headline-change contract version was not persisted';
  end if;
  if created_snapshot #>> '{headlineChange,priorHeadline}' <> prior.title then
    raise exception 'Prior Story headline was not persisted';
  end if;
  if created_snapshot #>> '{headlineChange,newHeadline}' <> legal_title then
    raise exception 'New Story headline was not persisted';
  end if;
  if created_snapshot #>> '{headlineChange,reason}' <> 'headline_hygiene_contract_test' then
    raise exception 'Headline-change reason was not persisted';
  end if;
  if created_snapshot #>> '{headlineChange,authorizingStoryThesisVersionId}' <> created_id::text then
    raise exception 'Authorising Story thesis-version ID was not persisted';
  end if;
  if created_snapshot #>> '{headlineChange,priorStoryThesisVersionId}' <> prior.id::text then
    raise exception 'Prior Story thesis-version ID was not persisted';
  end if;
end;
$$;

rollback;
