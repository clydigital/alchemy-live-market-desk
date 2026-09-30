-- Market Motion v1: fast, evidence-gated narrative motion owned by Live Desk.
-- Motion is not a Persistent Story. It is a versioned, expiring event layer that
-- can link to one canonical Story and one canonical Regime without mutating either.

begin;

create table if not exists public.market_motion_items (
  id uuid primary key default gen_random_uuid(),
  motion_key text not null,
  version_number integer not null check (version_number > 0),
  previous_version_id uuid null references public.market_motion_items(id) on delete restrict,
  contract_version text not null default 'market-motion/v1',
  research_run_id uuid null,
  source_id uuid null,
  evidence_id uuid null,
  primary_story_id uuid null references public.stories(id) on delete restrict,
  primary_regime_slug text null references public.market_regimes(slug) on delete restrict,
  lifecycle_state text not null check (lifecycle_state in ('MOTION','PROMOTED','EXPIRED')),
  category text not null check (category in (
    'COMPANY',
    'EARNINGS',
    'GEOPOLITICS',
    'MACRO',
    'POLICY',
    'ENERGY',
    'COMMODITY',
    'MARKET_STRUCTURE',
    'SECTOR',
    'OTHER'
  )),
  verification_state text not null default 'LEAD' check (verification_state in (
    'LEAD',
    'REPORTED',
    'VERIFIED',
    'PARTIAL',
    'CONTRADICTED',
    'UNRESOLVED'
  )),
  headline text not null,
  what_happened text not null,
  market_reaction text,
  why_interesting text not null,
  big_picture_bridge text not null,
  next_test text,
  promotion_reason text,
  tickers text[] not null default '{}',
  source_name text not null,
  source_url text not null,
  source_kind text not null default 'reporting' check (source_kind in (
    'primary',
    'official',
    'filing',
    'reporting',
    'market_data',
    'creator',
    'other'
  )),
  materiality smallint not null default 50 check (materiality between 0 and 100),
  relevance smallint not null default 50 check (relevance between 0 and 100),
  novelty smallint not null default 50 check (novelty between 0 and 100),
  occurred_at timestamptz not null,
  observed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  unique (motion_key, version_number),
  check (expires_at >= occurred_at)
);

do $
begin
  if to_regclass('public.research_runs') is not null
    and not exists (
      select 1 from pg_constraint
      where conname='market_motion_items_research_run_id_fkey'
        and conrelid='public.market_motion_items'::regclass
    ) then
    alter table public.market_motion_items
      add constraint market_motion_items_research_run_id_fkey
      foreign key (research_run_id) references public.research_runs(id) on delete set null;
  end if;

  if to_regclass('public.sources') is not null
    and not exists (
      select 1 from pg_constraint
      where conname='market_motion_items_source_id_fkey'
        and conrelid='public.market_motion_items'::regclass
    ) then
    alter table public.market_motion_items
      add constraint market_motion_items_source_id_fkey
      foreign key (source_id) references public.sources(id) on delete set null;
  end if;

  if to_regclass('public.evidence') is not null
    and not exists (
      select 1 from pg_constraint
      where conname='market_motion_items_evidence_id_fkey'
        and conrelid='public.market_motion_items'::regclass
    ) then
    alter table public.market_motion_items
      add constraint market_motion_items_evidence_id_fkey
      foreign key (evidence_id) references public.evidence(id) on delete set null;
  end if;
end
$;

create index if not exists market_motion_items_key_version_idx
  on public.market_motion_items(motion_key, version_number desc);

create index if not exists market_motion_items_recency_idx
  on public.market_motion_items(occurred_at desc, materiality desc, relevance desc);

create index if not exists market_motion_items_story_idx
  on public.market_motion_items(primary_story_id, occurred_at desc)
  where primary_story_id is not null;

create index if not exists market_motion_items_regime_idx
  on public.market_motion_items(primary_regime_slug, occurred_at desc)
  where primary_regime_slug is not null;

create or replace function public.assign_market_motion_version()
returns trigger
language plpgsql
as $$
declare
  prior_id uuid;
  prior_version integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.motion_key, 0));

  select id, version_number
  into prior_id, prior_version
  from public.market_motion_items
  where motion_key = new.motion_key
  order by version_number desc, created_at desc
  limit 1;

  new.version_number := coalesce(prior_version, 0) + 1;
  new.previous_version_id := prior_id;
  new.contract_version := coalesce(nullif(new.contract_version, ''), 'market-motion/v1');
  new.expires_at := coalesce(
    new.expires_at,
    greatest(new.occurred_at, coalesce(new.observed_at, now())) + interval '72 hours'
  );

  return new;
end;
$$;

drop trigger if exists market_motion_items_assign_version on public.market_motion_items;
create trigger market_motion_items_assign_version
before insert on public.market_motion_items
for each row execute function public.assign_market_motion_version();

drop trigger if exists market_motion_items_append_only on public.market_motion_items;
create trigger market_motion_items_append_only
before update or delete on public.market_motion_items
for each row execute function public.prevent_immutable_research_mutation();

alter table public.market_motion_items enable row level security;

drop policy if exists public_read_market_motion_items on public.market_motion_items;
create policy public_read_market_motion_items
  on public.market_motion_items for select to public using (true);

revoke all on public.market_motion_items from public, anon, authenticated;
grant select on public.market_motion_items to anon, authenticated;
grant select, insert on public.market_motion_items to service_role;

create or replace view public.current_market_motion_items
with (security_invoker = true)
as
select distinct on (motion_key)
  id,
  motion_key,
  version_number,
  previous_version_id,
  contract_version,
  research_run_id,
  source_id,
  evidence_id,
  primary_story_id,
  primary_regime_slug,
  lifecycle_state,
  case
    when lifecycle_state = 'EXPIRED' or expires_at <= now() then 'EXPIRED'
    else lifecycle_state
  end as effective_state,
  category,
  verification_state,
  headline,
  what_happened,
  market_reaction,
  why_interesting,
  big_picture_bridge,
  next_test,
  promotion_reason,
  tickers,
  source_name,
  source_url,
  source_kind,
  materiality,
  relevance,
  novelty,
  occurred_at,
  observed_at,
  expires_at,
  metadata,
  created_at
from public.market_motion_items
order by motion_key, version_number desc, created_at desc;

grant select on public.current_market_motion_items to anon, authenticated, service_role;

commit;
