-- Phase 1.5: activate the durable Live -> Hybrid handoff on the production schema.
-- This migration intentionally activates only the V8 objects used by the current product.
-- Canonical cadence: 08:30 and 23:00 Asia/Kuala_Lumpur.

begin;

create or replace function public.prevent_immutable_research_mutation()
returns trigger
language plpgsql
as $$
begin
  raise exception '% is append-only; add a superseding record or revision instead', tg_table_name
    using errcode = '55000';
end;
$$;

create table if not exists public.story_events (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete restrict,
  source_id uuid references public.sources(id) on delete set null,
  evidence_id uuid references public.evidence(id) on delete set null,
  observation_id uuid,
  research_run_id uuid references public.research_runs(id) on delete set null,
  legacy_update_id uuid unique references public.story_updates(id) on delete set null,
  event_type text not null check (event_type in (
    'headline_update','evidence_update','contradiction','confirmation','invalidation',
    'catalyst','thesis_revision','archive','reopen','correction','source_update'
  )),
  headline text not null,
  detail text,
  impact text check (impact is null or impact in ('supports','contradicts','amplifies','neutral','stale')),
  confidence_delta integer check (confidence_delta is null or confidence_delta between -100 and 100),
  event_at timestamptz not null,
  recorded_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid default auth.uid()
);

create table if not exists public.story_thesis_versions (
  id uuid primary key default gen_random_uuid(),
  story_id uuid not null references public.stories(id) on delete restrict,
  event_id uuid references public.story_events(id) on delete set null,
  version_number integer not null check (version_number > 0),
  title text not null,
  thesis text not null,
  status text not null,
  confidence integer not null check (confidence between 0 and 100),
  market_question text,
  dominant_narrative text,
  best_explanation text,
  strongest_support text,
  strongest_contradiction text,
  priced_assessment text,
  confirmation_trigger text,
  invalidation_trigger text,
  next_catalyst text,
  article_angle text,
  provisional_title text,
  article_verdict text,
  assets text[] not null default '{}'::text[],
  portfolio_map jsonb not null default '{}'::jsonb,
  snapshot jsonb not null default '{}'::jsonb,
  change_reason text not null,
  effective_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  constraint story_thesis_versions_story_version_key unique (story_id, version_number)
);

alter table public.stories add column if not exists current_thesis_version_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'stories_current_thesis_version_id_fkey'
      and conrelid = 'public.stories'::regclass
  ) then
    alter table public.stories
      add constraint stories_current_thesis_version_id_fkey
      foreign key (current_thesis_version_id)
      references public.story_thesis_versions(id)
      on delete set null;
  end if;
end
$$;

create table if not exists public.causal_edges (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references public.stories(id) on delete set null,
  claim_id uuid,
  supersedes_edge_id uuid references public.causal_edges(id) on delete restrict,
  from_node text not null,
  relationship text not null,
  to_node text not null,
  direction text not null check (direction in ('positive','negative','mixed','conditional')),
  evidence_state text not null check (evidence_state in ('observed','strongly_supported','inferred','speculative')),
  confidence integer not null default 50 check (confidence between 0 and 100),
  time_horizon text,
  expected_lag text,
  mechanism text not null,
  verification_ids uuid[] not null default '{}'::uuid[],
  observation_ids uuid[] not null default '{}'::uuid[],
  evidence_ids uuid[] not null default '{}'::uuid[],
  confirmation_condition text,
  invalidation_condition text,
  effective_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table if not exists public.asset_impacts (
  id uuid primary key default gen_random_uuid(),
  story_id uuid references public.stories(id) on delete set null,
  causal_edge_id uuid references public.causal_edges(id) on delete set null,
  supersedes_asset_impact_id uuid references public.asset_impacts(id) on delete restrict,
  asset_key text not null,
  asset_class text,
  direction text not null check (direction in ('bullish','bearish','mixed','neutral','conditional')),
  time_horizon text not null,
  mechanism text not null,
  confidence integer not null default 50 check (confidence between 0 and 100),
  evidence_state text not null check (evidence_state in ('observed','strongly_supported','inferred','speculative')),
  observation_ids uuid[] not null default '{}'::uuid[],
  evidence_ids uuid[] not null default '{}'::uuid[],
  confirmation_condition text,
  invalidation_condition text,
  as_of timestamptz not null,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create table if not exists public.research_schedule_slots (
  slot_key text primary key check (slot_key in ('morning','evening')),
  local_time time not null,
  timezone text not null default 'Asia/Kuala_Lumpur',
  purpose text not null,
  is_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.research_schedule_slots (slot_key, local_time, timezone, purpose, is_enabled)
values
  ('morning', '08:30', 'Asia/Kuala_Lumpur', 'Full source verification, Story recalibration and Live/Hybrid publication', true),
  ('evening', '23:00', 'Asia/Kuala_Lumpur', 'Evening delta, catalyst review, stale-state check and Live/Hybrid publication', true)
on conflict (slot_key) do update
set local_time = excluded.local_time,
    timezone = excluded.timezone,
    purpose = excluded.purpose,
    is_enabled = true,
    updated_at = now();

create table if not exists public.research_slot_runs (
  id uuid primary key default gen_random_uuid(),
  research_run_id uuid unique references public.research_runs(id) on delete set null,
  slot_key text not null references public.research_schedule_slots(slot_key) on delete restrict,
  scheduled_for timestamptz not null,
  started_at timestamptz,
  completed_at timestamptz,
  last_heartbeat_at timestamptz,
  status text not null default 'scheduled' check (status in ('scheduled','running','completed','partial','failed','blocked','skipped')),
  health_state text not null default 'unknown' check (health_state in ('healthy','degraded','blocked','unknown')),
  ingestion_status text not null default 'pending' check (ingestion_status in ('pending','running','complete','partial','failed','blocked','not_required')),
  transcript_status text not null default 'pending' check (transcript_status in ('pending','running','complete','partial','failed','blocked','not_required')),
  verification_status text not null default 'pending' check (verification_status in ('pending','running','complete','partial','failed','blocked','not_required')),
  live_publication_status text not null default 'pending' check (live_publication_status in ('pending','running','complete','partial','failed','blocked','not_required')),
  hybrid_handoff_status text not null default 'pending' check (hybrid_handoff_status in ('pending','running','complete','partial','failed','blocked','not_required')),
  videos_detected integer not null default 0 check (videos_detected >= 0),
  transcripts_saved integer not null default 0 check (transcripts_saved >= 0),
  claims_extracted integer not null default 0 check (claims_extracted >= 0),
  claims_verified integer not null default 0 check (claims_verified >= 0),
  causal_edges_updated integer not null default 0 check (causal_edges_updated >= 0),
  asset_impacts_calculated integer not null default 0 check (asset_impacts_calculated >= 0),
  stories_changed integer not null default 0 check (stories_changed >= 0),
  live_desk_publications integer not null default 0 check (live_desk_publications >= 0),
  hybrid_snapshots_sent integer not null default 0 check (hybrid_snapshots_sent >= 0),
  stage_summary jsonb not null default '{}'::jsonb,
  warnings text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.hybrid_publication_snapshots (
  id uuid primary key default gen_random_uuid(),
  research_run_id uuid references public.research_runs(id) on delete set null,
  slot_run_id uuid references public.research_slot_runs(id) on delete set null,
  story_id uuid references public.stories(id) on delete set null,
  story_thesis_version_id uuid references public.story_thesis_versions(id) on delete set null,
  supersedes_snapshot_id uuid references public.hybrid_publication_snapshots(id) on delete restrict,
  snapshot_type text not null check (snapshot_type in ('story','fiscal_supply','market_state','article_review','daily_brief')),
  public_summary text not null,
  payload jsonb not null,
  source_record_refs jsonb not null default '[]'::jsonb,
  redaction_log jsonb not null default '[]'::jsonb,
  confidence integer not null default 50 check (confidence between 0 and 100),
  published_at timestamptz not null default now(),
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid()
);

create unique index if not exists hybrid_daily_brief_run_unique
  on public.hybrid_publication_snapshots (research_run_id)
  where snapshot_type = 'daily_brief' and research_run_id is not null;
create unique index if not exists hybrid_story_snapshot_run_unique
  on public.hybrid_publication_snapshots (research_run_id, story_id)
  where snapshot_type = 'story' and research_run_id is not null and story_id is not null;
create index if not exists story_events_story_time_idx on public.story_events (story_id, event_at desc, recorded_at desc);
create index if not exists story_thesis_versions_story_time_idx on public.story_thesis_versions (story_id, version_number desc, effective_at desc);
create index if not exists causal_edges_story_time_idx on public.causal_edges (story_id, effective_at desc) where story_id is not null;
create index if not exists asset_impacts_story_time_idx on public.asset_impacts (story_id, as_of desc) where story_id is not null;
create index if not exists hybrid_publication_snapshots_type_time_idx on public.hybrid_publication_snapshots (snapshot_type, published_at desc);
create index if not exists research_slot_runs_slot_time_idx on public.research_slot_runs (slot_key, scheduled_for desc);

-- Existing story updates become immutable Story events.
insert into public.story_events (
  story_id, legacy_update_id, event_type, headline, detail, event_at, recorded_at, metadata
)
select
  su.story_id,
  su.id,
  case
    when su.update_type = 'contradiction' then 'contradiction'
    when su.update_type = 'confirmation' then 'confirmation'
    when su.update_type = 'invalidation' then 'invalidation'
    else 'headline_update'
  end,
  su.headline,
  su.detail,
  coalesce(su.observed_at, su.published_at, su.created_at),
  su.created_at,
  jsonb_build_object('legacy_update_type', su.update_type, 'backfilled', true)
from public.story_updates su
on conflict (legacy_update_id) do nothing;

-- Existing Stories become thesis version 1.
insert into public.story_thesis_versions (
  story_id, version_number, title, thesis, status, confidence, market_question,
  dominant_narrative, best_explanation, strongest_support, strongest_contradiction,
  priced_assessment, confirmation_trigger, invalidation_trigger, next_catalyst,
  article_angle, provisional_title, article_verdict, assets, snapshot, change_reason,
  effective_at, created_at
)
select
  s.id, 1, s.title, s.thesis, s.status, s.confidence, s.market_question,
  s.dominant_narrative, s.best_explanation, s.strongest_support, s.strongest_contradiction,
  s.priced_assessment, s.confirmation_trigger, s.invalidation_trigger, s.next_catalyst,
  s.article_angle, s.provisional_title, s.article_verdict, s.assets, to_jsonb(s),
  'baseline_from_existing_story', coalesce(s.updated_at, s.created_at), s.created_at
from public.stories s
on conflict (story_id, version_number) do nothing;

update public.stories s
set current_thesis_version_id = v.id
from public.story_thesis_versions v
where v.story_id = s.id and v.version_number = 1 and s.current_thesis_version_id is null;

create or replace function public.capture_story_thesis_version()
returns trigger
language plpgsql
as $$
declare
  next_version integer;
  new_version_id uuid;
  revision_event_id uuid;
begin
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
  ) then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.id::text, 0));
  select coalesce(max(version_number), 0) + 1 into next_version
  from public.story_thesis_versions where story_id = new.id;

  insert into public.story_events (
    story_id,event_type,headline,detail,event_at,metadata
  ) values (
    new.id,'thesis_revision',format('Story thesis version %s recorded', next_version),
    'A thesis-bearing Story field changed. The complete prior version remains preserved.',
    now(),jsonb_build_object('automatic',true,'previous_version_id',old.current_thesis_version_id)
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
    new.article_angle,new.provisional_title,new.article_verdict,new.assets,to_jsonb(new),'story_updated',now()
  ) returning id into new_version_id;

  update public.stories set current_thesis_version_id = new_version_id
  where id = new.id and current_thesis_version_id is distinct from new_version_id;
  return new;
end;
$$;

drop trigger if exists stories_capture_thesis_version on public.stories;
create trigger stories_capture_thesis_version
after update on public.stories
for each row execute function public.capture_story_thesis_version();

create or replace function public.capture_story_update_event()
returns trigger
language plpgsql
as $$
begin
  insert into public.story_events (
    story_id,legacy_update_id,event_type,headline,detail,event_at,recorded_at,metadata
  ) values (
    new.story_id,new.id,
    case
      when new.update_type = 'contradiction' then 'contradiction'
      when new.update_type = 'confirmation' then 'confirmation'
      when new.update_type = 'invalidation' then 'invalidation'
      else 'headline_update'
    end,
    new.headline,new.detail,coalesce(new.observed_at,new.published_at,new.created_at),new.created_at,
    jsonb_build_object('legacy_update_type',new.update_type,'mirrored',true)
  ) on conflict (legacy_update_id) do nothing;
  return new;
end;
$$;

drop trigger if exists story_updates_capture_event on public.story_updates;
create trigger story_updates_capture_event
after insert on public.story_updates
for each row execute function public.capture_story_update_event();

create or replace function public.sync_research_slot_run()
returns trigger
language plpgsql
as $$
declare
  mapped_health text;
  mapped_stage text;
begin
  if new.schedule_slot not in ('morning','evening') then return new; end if;
  mapped_health := case when new.status = 'completed' then 'healthy' when new.status in ('blocked','failed') then 'blocked' else 'unknown' end;
  mapped_stage := case when new.status = 'completed' then 'complete' when new.status = 'blocked' then 'blocked' when new.status = 'failed' then 'failed' when new.status = 'running' then 'running' else 'pending' end;

  insert into public.research_slot_runs (
    research_run_id,slot_key,scheduled_for,started_at,completed_at,last_heartbeat_at,status,health_state,
    ingestion_status,transcript_status,verification_status,live_publication_status,hybrid_handoff_status,
    videos_detected,transcripts_saved,stories_changed,live_desk_publications,warnings,stage_summary,updated_at
  ) values (
    new.id,new.schedule_slot,new.scheduled_for,new.started_at,new.completed_at,now(),new.status,mapped_health,
    mapped_stage,mapped_stage,mapped_stage,mapped_stage,
    case when new.status = 'completed' then 'complete' else mapped_stage end,
    new.videos_found,new.transcripts_ready,new.updates_published,new.updates_published,new.warnings,
    jsonb_build_object('accuracy_gate',new.accuracy_gate,'required_sources_complete',new.required_sources_complete,'evidence_gate_passed',new.evidence_gate_passed),now()
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

drop trigger if exists research_runs_sync_slot_run on public.research_runs;
create trigger research_runs_sync_slot_run
after insert or update on public.research_runs
for each row execute function public.sync_research_slot_run();

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

  insert into public.hybrid_publication_snapshots (
    research_run_id,slot_run_id,snapshot_type,public_summary,payload,confidence,published_at
  ) values (
    new.id,slot_run,'daily_brief',coalesce(new.summary,format('%s research edition completed',new.schedule_slot)),
    jsonb_build_object(
      'contractVersion',2,'scheduleSlot',new.schedule_slot,'scheduledFor',new.scheduled_for,
      'completedAt',new.completed_at,'updatesPublished',new.updates_published,'warnings',new.warnings,
      'timezone','Asia/Kuala_Lumpur'
    ),avg_conf,coalesce(new.completed_at,now())
  ) on conflict do nothing;

  insert into public.hybrid_publication_snapshots (
    research_run_id,slot_run_id,story_id,story_thesis_version_id,snapshot_type,public_summary,payload,confidence,published_at
  )
  select
    new.id,slot_run,s.id,s.current_thesis_version_id,'story',s.title,
    jsonb_build_object(
      'slug',s.slug,'title',s.title,'thesis',s.thesis,'status',s.status,'confidence',s.confidence,
      'marketQuestion',s.market_question,'dominantNarrative',s.dominant_narrative,
      'bestExplanation',s.best_explanation,'strongestSupport',s.strongest_support,
      'strongestContradiction',s.strongest_contradiction,'pricedAssessment',s.priced_assessment,
      'confirmationCondition',s.confirmation_trigger,'invalidationCondition',s.invalidation_trigger,
      'nextCatalyst',s.next_catalyst,'assets',s.assets
    ),s.confidence,coalesce(new.completed_at,now())
  from public.stories s
  where s.status <> 'archived'
  on conflict do nothing;

  update public.research_slot_runs
  set hybrid_handoff_status='complete',hybrid_snapshots_sent=(
    select count(*) from public.hybrid_publication_snapshots where research_run_id=new.id
  ),updated_at=now()
  where research_run_id=new.id;
  return new;
end;
$$;

drop trigger if exists research_runs_publish_hybrid_snapshot on public.research_runs;
create trigger research_runs_publish_hybrid_snapshot
after insert or update on public.research_runs
for each row execute function public.publish_hybrid_snapshots_for_run();

create or replace view public.current_story_thesis_versions
with (security_invoker = true) as
select distinct on (story_id) *
from public.story_thesis_versions
order by story_id, version_number desc, effective_at desc;

create or replace view public.current_causal_edges
with (security_invoker = true) as
select edge.* from public.causal_edges edge
where not exists (select 1 from public.causal_edges replacement where replacement.supersedes_edge_id=edge.id);

create or replace view public.current_asset_impacts
with (security_invoker = true) as
select impact.* from public.asset_impacts impact
where not exists (select 1 from public.asset_impacts replacement where replacement.supersedes_asset_impact_id=impact.id);

-- Append-only research history.
drop trigger if exists story_events_append_only on public.story_events;
create trigger story_events_append_only before update or delete on public.story_events
for each row execute function public.prevent_immutable_research_mutation();
drop trigger if exists story_thesis_versions_append_only on public.story_thesis_versions;
create trigger story_thesis_versions_append_only before update or delete on public.story_thesis_versions
for each row execute function public.prevent_immutable_research_mutation();
drop trigger if exists causal_edges_append_only on public.causal_edges;
create trigger causal_edges_append_only before update or delete on public.causal_edges
for each row execute function public.prevent_immutable_research_mutation();
drop trigger if exists asset_impacts_append_only on public.asset_impacts;
create trigger asset_impacts_append_only before update or delete on public.asset_impacts
for each row execute function public.prevent_immutable_research_mutation();
drop trigger if exists hybrid_publication_snapshots_append_only on public.hybrid_publication_snapshots;
create trigger hybrid_publication_snapshots_append_only before update or delete on public.hybrid_publication_snapshots
for each row execute function public.prevent_immutable_research_mutation();

alter table public.story_events enable row level security;
alter table public.story_thesis_versions enable row level security;
alter table public.causal_edges enable row level security;
alter table public.asset_impacts enable row level security;
alter table public.research_schedule_slots enable row level security;
alter table public.research_slot_runs enable row level security;
alter table public.hybrid_publication_snapshots enable row level security;

create policy public_read_story_events on public.story_events for select to public using (true);
create policy public_read_story_thesis_versions on public.story_thesis_versions for select to public using (true);
create policy public_read_causal_edges on public.causal_edges for select to public using (true);
create policy public_read_asset_impacts on public.asset_impacts for select to public using (true);
create policy public_read_research_schedule_slots on public.research_schedule_slots for select to public using (true);
create policy authenticated_read_research_slot_runs on public.research_slot_runs for select to authenticated using (true);
create policy public_read_hybrid_publication_snapshots on public.hybrid_publication_snapshots for select to public using (true);

grant select on public.story_events to anon,authenticated;
grant select on public.story_thesis_versions to anon,authenticated;
grant select on public.current_story_thesis_versions to anon,authenticated;
grant select on public.causal_edges to anon,authenticated;
grant select on public.current_causal_edges to anon,authenticated;
grant select on public.asset_impacts to anon,authenticated;
grant select on public.current_asset_impacts to anon,authenticated;
grant select on public.research_schedule_slots to anon,authenticated;
grant select on public.research_slot_runs to authenticated;
grant select on public.hybrid_publication_snapshots to anon,authenticated;

-- Establish one transparent immutable baseline edition. Future editions are created only by completed morning/evening runs.
insert into public.hybrid_publication_snapshots (
  snapshot_type,public_summary,payload,confidence,published_at
)
select
  'daily_brief','Phase 1.5 persistence baseline',
  jsonb_build_object('contractVersion',2,'baseline',true,'schedule',jsonb_build_array('08:30','23:00'),'timezone','Asia/Kuala_Lumpur'),
  coalesce(round(avg(confidence))::integer,50),now()
from public.stories
where status <> 'archived'
and not exists (
  select 1 from public.hybrid_publication_snapshots where snapshot_type='daily_brief'
);

comment on table public.story_events is 'Append-only material event history for persistent Stories.';
comment on table public.story_thesis_versions is 'Immutable Story thesis snapshots; current state remains traceable to prior versions.';
comment on table public.causal_edges is 'Versioned Live-owned causal links exposed to Hybrid as presentation data.';
comment on table public.asset_impacts is 'Versioned Live-owned asset conclusions derived from causal paths.';
comment on table public.research_schedule_slots is 'Canonical two-slot Asia/Kuala_Lumpur research schedule: 08:30 and 23:00.';
comment on table public.hybrid_publication_snapshots is 'Immutable redacted Live-to-Hybrid editions and Story snapshots.';

commit;
