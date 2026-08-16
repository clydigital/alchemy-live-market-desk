-- Canonical edition replay contract: a daily_brief owns its ordered immutable
-- Story-snapshot manifest. Existing briefs are intentionally not backfilled:
-- their membership/order is only replayed when already provable from records.

begin;

create or replace function public.publish_hybrid_snapshots_for_run()
returns trigger
language plpgsql
as $$
declare
  slot_run uuid;
  avg_conf integer;
begin
  if new.status <> 'completed' or (tg_op = 'UPDATE' and old.status = 'completed') then return new; end if;
  if new.schedule_slot not in ('morning','evening') then return new; end if;

  select id into slot_run from public.research_slot_runs where research_run_id = new.id;
  select coalesce(round(avg(confidence))::integer,50) into avg_conf from public.stories where status <> 'archived';

  -- Store every presentation field used by the public canonical feed before
  -- publishing the parent edition. The daily manifest below is the sole source
  -- of historical Story membership/order during replay.
  insert into public.hybrid_publication_snapshots (
    research_run_id,slot_run_id,story_id,story_thesis_version_id,snapshot_type,public_summary,payload,confidence,published_at
  )
  select
    new.id,slot_run,s.id,s.current_thesis_version_id,'story',s.title,
    jsonb_build_object(
      'id',s.id,'slug',s.slug,'title',s.title,'thesis',s.thesis,'status',s.status,'confidence',s.confidence,
      'rank',s.rank,'marketQuestion',s.market_question,'dominantNarrative',s.dominant_narrative,
      'bestExplanation',s.best_explanation,'strongestSupport',s.strongest_support,
      'strongestContradiction',s.strongest_contradiction,'pricedAssessment',s.priced_assessment,
      'confirmationCondition',s.confirmation_trigger,'invalidationCondition',s.invalidation_trigger,
      'nextCatalyst',s.next_catalyst,'assets',s.assets,'featuredRank',null
    ),s.confidence,coalesce(new.completed_at,now())
  from public.stories s
  where s.status <> 'archived'
  on conflict do nothing;

  insert into public.hybrid_publication_snapshots (
    research_run_id,slot_run_id,snapshot_type,public_summary,payload,confidence,published_at
  ) values (
    new.id,slot_run,'daily_brief',coalesce(new.summary,format('%s research edition completed',new.schedule_slot)),
    jsonb_build_object(
      'contractVersion',2,'scheduleSlot',new.schedule_slot,'scheduledFor',new.scheduled_for,
      'runKey',new.run_key,'completedAt',new.completed_at,'updatesPublished',new.updates_published,
      'warnings',new.warnings,'timezone','Asia/Kuala_Lumpur',
      'canonicalStoryManifest',coalesce((
        select jsonb_agg(jsonb_build_object(
          'position', ranked.position,
          'snapshotId', ranked.id,
          'storyId', ranked.story_id,
          'state', ranked.payload
        ) order by ranked.position)
        from (
          select snapshot.id,snapshot.story_id,snapshot.payload,
            row_number() over (order by (snapshot.payload->>'rank')::integer nulls last, snapshot.id) as position
          from public.hybrid_publication_snapshots snapshot
          where snapshot.research_run_id = new.id and snapshot.snapshot_type = 'story'
        ) ranked
      ), '[]'::jsonb)
    ),avg_conf,coalesce(new.completed_at,now())
  ) on conflict do nothing;

  update public.research_slot_runs
  set hybrid_handoff_status='complete',hybrid_snapshots_sent=(
    select count(*) from public.hybrid_publication_snapshots where research_run_id=new.id
  ),updated_at=now()
  where research_run_id=new.id;
  return new;
end;
$$;

comment on column public.hybrid_publication_snapshots.payload is
  'For future daily_brief rows, canonicalStoryManifest is an ordered immutable Story-snapshot manifest for exact edition replay.';

commit;
