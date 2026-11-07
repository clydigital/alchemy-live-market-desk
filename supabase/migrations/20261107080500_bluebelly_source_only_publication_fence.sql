-- 7 November 2026: preserve canonical source receipts while retiring routine
-- model/editorial generation. Reversible by restoring the previous function
-- definitions from the August/September migrations; existing history unchanged.
-- No new tables, RLS grants, exposure surface, schedules, or source collectors.
begin;

create or replace function public.sync_research_slot_run()
returns trigger
language plpgsql
as $$
declare
  mapped_health text;
  mapped_stage text;
  source_only boolean;
begin
  if new.schedule_slot not in ('morning','evening') then return new; end if;
  source_only := array_position(new.warnings,'BLUEBELLY_SOURCE_ONLY_V1') is not null;
  mapped_health := case
    when new.status = 'completed' and source_only
      and (new.accuracy_gate <> 'open' or not new.required_sources_complete or not new.evidence_gate_passed)
      then 'degraded'
    when new.status = 'completed' then 'healthy'
    when new.status in ('blocked','failed') then 'blocked'
    else 'unknown' end;
  mapped_stage := case when new.status = 'completed' then 'complete' when new.status = 'blocked' then 'blocked' when new.status = 'failed' then 'failed' when new.status = 'running' then 'running' else 'pending' end;

  insert into public.research_slot_runs (
    research_run_id,slot_key,scheduled_for,started_at,completed_at,last_heartbeat_at,status,health_state,
    ingestion_status,transcript_status,verification_status,live_publication_status,hybrid_handoff_status,
    videos_detected,transcripts_saved,stories_changed,live_desk_publications,warnings,stage_summary,updated_at
  ) values (
    new.id,new.schedule_slot,new.scheduled_for,new.started_at,new.completed_at,now(),new.status,mapped_health,
    mapped_stage,mapped_stage,
    case when source_only and new.status='completed'
      and (not new.required_sources_complete or not new.evidence_gate_passed)
      then 'partial' else mapped_stage end,
    case when source_only then 'not_required' else mapped_stage end,
    case when source_only then 'not_required'
      when new.status = 'completed' then 'complete' else mapped_stage end,
    new.videos_found,new.transcripts_ready,new.updates_published,new.updates_published,new.warnings,
    jsonb_build_object(
      'accuracy_gate',new.accuracy_gate,
      'required_sources_complete',new.required_sources_complete,
      'evidence_gate_passed',new.evidence_gate_passed,
      'source_only',source_only,
      'source_only_contract',case when source_only then 'BLUEBELLY_SOURCE_ONLY_V1' else null end
    ),now()
  )
  on conflict (research_run_id) do update set
    completed_at=excluded.completed_at,last_heartbeat_at=now(),status=excluded.status,health_state=excluded.health_state,
    ingestion_status=excluded.ingestion_status,transcript_status=excluded.transcript_status,
    verification_status=excluded.verification_status,live_publication_status=excluded.live_publication_status,
    hybrid_handoff_status=excluded.hybrid_handoff_status,videos_detected=excluded.videos_detected,
    transcripts_saved=excluded.transcripts_saved,stories_changed=excluded.stories_changed,
    live_desk_publications=excluded.live_desk_publications,warnings=excluded.warnings,
    stage_summary=excluded.stage_summary,updated_at=now();
  return new;
end;
$$;

create or replace function public.publish_hybrid_snapshots_for_run()
returns trigger
language plpgsql
as $$
declare
  slot_run uuid;
  avg_conf integer;
  canonical_edition_exists boolean;
begin
  -- Source-only evidence collection must never manufacture an editorial
  -- daily_brief or freeze unrelated historical Stories as newly published.
  -- Legacy and manual/editorial flows preserve the existing trigger contract.
  if array_position(new.warnings,'BLUEBELLY_SOURCE_ONLY_V1') is not null then return new; end if;
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

comment on function public.sync_research_slot_run() is
  'Scheduled source-only mode reports completed intake but marks automatic Live/Hybrid publication not_required; legacy run mapping remains intact.';
comment on function public.publish_hybrid_snapshots_for_run() is
  'Legacy Story/Hybrid completion trigger; skips only BLUEBELLY_SOURCE_ONLY_V1 intake completions and preserves previous behaviour for non-marked runs.';

commit;
