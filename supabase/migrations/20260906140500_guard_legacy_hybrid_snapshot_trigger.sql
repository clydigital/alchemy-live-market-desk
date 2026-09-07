-- The application-owned canonical publisher persists immutable Story snapshots
-- and the parent daily_brief before a scheduled research run is marked complete.
-- Keep the old database trigger only as a legacy fallback for runs that reached
-- completion without any canonical daily brief. If a canonical edition already
-- exists, the trigger must not append current mutable Story state after the
-- edition manifest has been frozen.

begin;

create or replace function public.publish_hybrid_snapshots_for_run()
returns trigger
language plpgsql
as $$
declare
  slot_run uuid;
  avg_conf integer;
  canonical_edition_exists boolean;
begin
  if new.status <> 'completed' or (tg_op = 'UPDATE' and old.status = 'completed') then return new; end if;
  if new.schedule_slot not in ('morning','evening') then return new; end if;

  select id into slot_run
  from public.research_slot_runs
  where research_run_id = new.id;

  select exists (
    select 1
    from public.hybrid_publication_snapshots
    where research_run_id = new.id
      and snapshot_type = 'daily_brief'
  ) into canonical_edition_exists;

  -- A Live-owned canonical edition is authoritative. At this point its ordered
  -- Story manifest is already frozen, so legacy completion handling may update
  -- handoff bookkeeping only. Inserting another current Story snapshot here
  -- would create run-level state that the immutable edition never published.
  if canonical_edition_exists then
    update public.research_slot_runs
    set hybrid_handoff_status = 'complete',
        hybrid_snapshots_sent = (
          select count(*)
          from public.hybrid_publication_snapshots
          where research_run_id = new.id
        ),
        updated_at = now()
    where research_run_id = new.id;
    return new;
  end if;

  -- Legacy fallback only: preserve the historical trigger behaviour when a
  -- completed scheduled run genuinely has no application-owned daily brief.
  select coalesce(round(avg(confidence))::integer,50)
  into avg_conf
  from public.stories
  where status <> 'archived';

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
      'replayStatus','legacy_unproven'
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

comment on function public.publish_hybrid_snapshots_for_run() is
  'Legacy scheduled-run Hybrid fallback. If a canonical daily_brief already exists for the run, it updates handoff bookkeeping only and never appends Story snapshots after the immutable manifest was frozen.';

commit;
