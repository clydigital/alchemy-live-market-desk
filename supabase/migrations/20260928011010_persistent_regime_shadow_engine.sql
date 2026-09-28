-- Persistent Regime shadow engine.
-- Additive only: existing Story/Dossier truth remains canonical.
-- Production migration version: 20260928011010.

create table public.market_regimes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  short_title text not null,
  core_question text not null,
  why_it_matters text not null,
  mechanism text not null,
  affected_markets text[] not null default '{}',
  status text not null default 'active' check (status in ('active','dormant','retired')),
  importance_rank smallint not null default 50 check (importance_rank between 0 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.market_regime_subgroups (
  id uuid primary key default gen_random_uuid(),
  regime_id uuid not null references public.market_regimes(id) on delete cascade,
  subgroup_key text not null,
  label text not null,
  accent text not null check (accent in ('blue','purple','orange','green','yellow','red','gold','teal')),
  why_it_matters text not null,
  mechanism text not null,
  status text not null default 'active' check (status in ('active','dormant','retired')),
  ordinal smallint not null check (ordinal > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(regime_id, subgroup_key),
  unique(regime_id, id)
);

create table public.market_regime_projection_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  projection_mode text not null default 'shadow' check (projection_mode in ('shadow','accepted')),
  trigger_kind text not null check (trigger_kind in ('story_engine','dossier','manual','bootstrap')),
  trigger_ref text,
  contract_version text not null,
  status text not null default 'started' check (status in ('started','completed','failed')),
  input_manifest jsonb not null default '{}'::jsonb,
  input_hash text not null,
  version_ids uuid[] not null default '{}',
  warnings text[] not null default '{}',
  error_detail text,
  started_at timestamptz not null default now(),
  completed_at timestamptz
);

create index market_regime_projection_runs_started_idx
  on public.market_regime_projection_runs(started_at desc);
create index market_regime_projection_runs_status_idx
  on public.market_regime_projection_runs(projection_mode, status, started_at desc);

create table public.market_regime_versions (
  id uuid primary key default gen_random_uuid(),
  regime_id uuid not null references public.market_regimes(id) on delete restrict,
  projection_run_id uuid not null references public.market_regime_projection_runs(id) on delete restrict,
  version_number integer not null check (version_number > 0),
  projection_mode text not null default 'shadow' check (projection_mode in ('shadow','accepted')),
  state text not null,
  state_kind text not null check (state_kind in ('system1','interpreted','unresolved')),
  confidence_label text not null,
  as_of timestamptz,
  input_manifest jsonb not null default '{}'::jsonb,
  snapshot jsonb not null,
  snapshot_hash text not null,
  materiality_reason text not null,
  supersedes_version_id uuid references public.market_regime_versions(id) on delete restrict,
  created_at timestamptz not null default now(),
  unique(regime_id, projection_mode, version_number),
  unique(projection_run_id, regime_id)
);

create index market_regime_versions_regime_idx
  on public.market_regime_versions(regime_id, projection_mode, version_number desc);
create index market_regime_versions_created_idx
  on public.market_regime_versions(created_at desc);

create table public.market_regime_current (
  regime_id uuid not null references public.market_regimes(id) on delete cascade,
  projection_mode text not null default 'shadow' check (projection_mode in ('shadow','accepted')),
  version_id uuid not null references public.market_regime_versions(id) on delete restrict,
  projection_run_id uuid not null references public.market_regime_projection_runs(id) on delete restrict,
  state text not null,
  state_kind text not null check (state_kind in ('system1','interpreted','unresolved')),
  confidence_label text not null,
  as_of timestamptz,
  input_manifest jsonb not null default '{}'::jsonb,
  snapshot jsonb not null,
  snapshot_hash text not null,
  updated_at timestamptz not null default now(),
  primary key(regime_id, projection_mode)
);

create index market_regime_current_run_idx
  on public.market_regime_current(projection_run_id);

create table public.market_regime_story_links (
  id uuid primary key default gen_random_uuid(),
  regime_id uuid not null references public.market_regimes(id) on delete cascade,
  subgroup_id uuid not null,
  story_id uuid not null references public.stories(id) on delete cascade,
  role text not null check (role in ('core','supporting','bridge','countercase')),
  confidence numeric(5,2) not null default 50 check (confidence between 0 and 100),
  assignment_origin text not null default 'deterministic_runtime',
  last_projection_run_id uuid references public.market_regime_projection_runs(id) on delete set null,
  effective_from timestamptz not null default now(),
  effective_to timestamptz,
  locked boolean not null default false,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint market_regime_story_links_subgroup_fk
    foreign key (regime_id, subgroup_id)
    references public.market_regime_subgroups(regime_id, id)
    on delete cascade,
  check (effective_to is null or effective_to >= effective_from)
);

create unique index market_regime_story_links_active_uidx
  on public.market_regime_story_links(story_id, regime_id, subgroup_id, role)
  where effective_to is null;
create index market_regime_story_links_regime_idx
  on public.market_regime_story_links(regime_id, subgroup_id, effective_to, story_id);
create index market_regime_story_links_story_idx
  on public.market_regime_story_links(story_id, effective_to);

create trigger market_regime_versions_append_only
before update or delete on public.market_regime_versions
for each row execute function public.prevent_immutable_research_mutation();

create trigger market_regimes_updated_at
before update on public.market_regimes
for each row execute function public.intelligence_set_updated_at();

create trigger market_regime_subgroups_updated_at
before update on public.market_regime_subgroups
for each row execute function public.intelligence_set_updated_at();

create trigger market_regime_story_links_updated_at
before update on public.market_regime_story_links
for each row execute function public.intelligence_set_updated_at();

alter table public.market_regimes enable row level security;
alter table public.market_regime_subgroups enable row level security;
alter table public.market_regime_projection_runs enable row level security;
alter table public.market_regime_versions enable row level security;
alter table public.market_regime_current enable row level security;
alter table public.market_regime_story_links enable row level security;

revoke all on public.market_regimes from public, anon, authenticated;
revoke all on public.market_regime_subgroups from public, anon, authenticated;
revoke all on public.market_regime_projection_runs from public, anon, authenticated;
revoke all on public.market_regime_versions from public, anon, authenticated;
revoke all on public.market_regime_current from public, anon, authenticated;
revoke all on public.market_regime_story_links from public, anon, authenticated;

grant select, insert, update, delete on public.market_regimes to service_role;
grant select, insert, update, delete on public.market_regime_subgroups to service_role;
grant select, insert, update, delete on public.market_regime_projection_runs to service_role;
grant select, insert on public.market_regime_versions to service_role;
grant select, insert, update, delete on public.market_regime_current to service_role;
grant select, insert, update, delete on public.market_regime_story_links to service_role;

insert into public.market_regimes
  (slug,title,short_title,core_question,why_it_matters,mechanism,affected_markets,importance_rank)
values
  ('global-cost-of-capital','Sovereign Funding & Global Cost of Capital','Cost of Capital','Can governments and companies finance large capital needs cheaply while inflation, sovereign issuance and private investment demand keep required returns elevated?','Long-term yields and funding conditions transmit into mortgages, corporate borrowing, AI financing, equity valuations, currencies and the government''s own interest burden.','Debt supply / inflation / policy pressure → required yields → borrowing costs → investment, housing and valuation pressure.',array['US02Y','US10Y','US30Y','DXY','XAUUSD','QQQ','Credit','Housing'],100),
  ('us-china-ai','US–China AI Industrial Competition','US–China AI','Which ecosystem captures the economics and physical infrastructure of AI as intelligence becomes cheaper and compute becomes strategically important?','Model pricing, chips, memory, power and financing determine where value migrates as AI usage scales and margins are pressured.','AI price ↓ → adoption / inference ↑ → compute, memory and power demand ↑, while monetisation pressure can lower returns on capex.',array['NVDA','MU','BABA','SMIC','CXMT','Semis','Cloud','Power','Credit'],95),
  ('energy-security-inflation','Global Energy Security & Inflation','Energy Security','Is marginal energy supply becoming structurally more expensive, fragile or politically constrained, and is that feeding inflation and rates?','Crude, products, LNG, shipping and power can transmit physical disruption into inflation, margins and central-bank policy.','Physical disruption → energy / freight cost → inflation and margins → central-bank room → yields / equities.',array['WTI','Brent','ULSD','LNG','US02Y','US10Y','XLE','Industrials'],90),
  ('gold-reserve-diversification','Gold & Global Reserve Diversification','Gold / Reserves','Is gold gaining a durable monetary and reserve role even when cyclical real-yield and dollar forces move against it?','Gold sits at the intersection of real yields, the dollar, geopolitical risk and central-bank reserve allocation.','Reserve diversification / geopolitical risk supports structural demand while real yields and USD drive cyclical opportunity cost.',array['XAUUSD','DXY','US10Y Real Yield','Gold ETFs','Central-bank reserves'],85),
  ('equity-rally-quality','Equity Rally Quality & Earnings Breadth','Equity Rally Quality','Is the equity advance becoming economically broader, or does it remain dependent on a narrow set of AI and large-cap earnings leaders?','A rally supported by earnings, breadth and credit is more robust than one carried by a narrow group of long-duration winners.','Earnings + breadth + financial conditions → participation and leadership → durability of equity risk appetite.',array['SPY','QQQ','RSP','IWM','SMH','KRE','XLF','Earnings'],80);

with seed(regime_slug, subgroup_key, label, accent, why_it_matters, mechanism, ordinal) as (
  values
    ('global-cost-of-capital','fed-front-end','Fed / Front End','blue','The front end shows how markets price the near-term policy path.','Macro surprise → Fed path → 2Y / policy pricing → USD and rate-sensitive assets.',1),
    ('global-cost-of-capital','treasury-fiscal','Treasury / Fiscal','purple','Borrowing needs and maturity choices affect supply, refinancing risk and the term premium.','Deficits / financing mix → Treasury supply → investor absorption → funding pressure.',2),
    ('global-cost-of-capital','long-end','Long End / Term Premium','orange','The 10Y/30Y anchor mortgages, corporate finance and discount rates.','Inflation + supply + real yields + term premium → 10Y/30Y → economy-wide cost of capital.',3),
    ('global-cost-of-capital','global-rates','Global Rates / Japan','green','JGB and global duration moves can change cross-border capital and carry economics.','Global yield repricing → hedging / repatriation / carry → US duration and FX.',4),
    ('global-cost-of-capital','credit-financing','Credit / Financing','yellow','Credit reveals whether high rates are becoming an actual financing constraint.','Funding cost / spreads → issuance and refinancing → capex / defaults / equity risk.',5),
    ('global-cost-of-capital','housing','Housing / Real Economy','red','Housing is one of the clearest channels through which long yields reach households.','Treasury yields → mortgage rates → affordability / activity → growth and inflation.',6),
    ('us-china-ai','models','Models / Price War','blue','Cheaper intelligence can expand usage while compressing model economics.','Model price / quality → adoption → inference volume → monetisation.',1),
    ('us-china-ai','chips','Chips / Accelerators','purple','Accelerator access remains a strategic compute bottleneck.','Model demand → accelerator demand → supply / export controls → compute capacity.',2),
    ('us-china-ai','memory','Memory / HBM','orange','Memory bandwidth can constrain useful AI compute even when accelerators are available.','Inference / training → bandwidth demand → HBM capacity / pricing → system throughput.',3),
    ('us-china-ai','cloud-inference','Cloud / Inference','green','Inference economics determine whether falling model prices create profitable volume.','Usage → inference load → cloud utilisation → unit economics.',4),
    ('us-china-ai','power','Power / Data Centres','yellow','Power, cooling and grid access can become the physical limit to AI deployment.','Compute buildout → data centres → electricity / grid / cooling → project timing.',5),
    ('us-china-ai','financing','Financing / ROIC','red','The buildout depends on the return earned on very large, increasingly financed capex.','Capex + borrowing cost → cash conversion / ROIC → project pace and equity valuation.',6),
    ('us-china-ai','policy','Export Controls / Policy','teal','Industrial policy can reshape access to chips, equipment and strategic inputs.','Export controls / subsidies → supply access → localisation → competitive position.',7),
    ('energy-security-inflation','crude','Crude','orange','Crude is the first-order global energy risk price, but it does not capture every product bottleneck.','Supply / geopolitics → crude balance → benchmark price → inflation impulse.',1),
    ('energy-security-inflation','products','Refining / Products','yellow','Diesel and gasoline can stay tight even when crude eases.','Refinery throughput + inventories → cracks / product prices → transport inflation.',2),
    ('energy-security-inflation','lng','LNG / Gas','blue','LNG disruption can force Europe and Asia to compete for Atlantic supply.','LNG flows → regional competition → gas / electricity → industrial margins.',3),
    ('energy-security-inflation','shipping','Shipping / Chokepoints','purple','Chokepoints and insurance determine whether physical supply can reach buyers.','Security risk → transit / insurance / freight → delivered energy cost.',4),
    ('energy-security-inflation','power','Power','green','Electricity is the final input linking gas, grids, industry and AI infrastructure.','Fuel + grid constraints → power price / availability → industrial and data-centre economics.',5),
    ('energy-security-inflation','inflation','Inflation Transmission','red','The market consequence depends on whether energy becomes broad, persistent inflation.','Energy / freight → CPI/PPI / expectations → policy pricing → rates.',6),
    ('gold-reserve-diversification','central-banks','Central Banks','gold','Official-sector demand can create a structural bid independent of short-term investor flows.','Reserve allocation → official purchases → structural gold demand.',1),
    ('gold-reserve-diversification','reserve-system','USD / Reserve System','blue','Reserve diversification affects gold''s monetary role relative to dollar assets.','Reserve preferences / sanctions risk → diversification → gold allocation.',2),
    ('gold-reserve-diversification','real-yields','Real Yields','orange','Real yields are a major cyclical opportunity-cost input for non-yielding gold.','Real yields ↑ → opportunity cost ↑ → cyclical gold headwind, all else equal.',3),
    ('gold-reserve-diversification','geopolitics','Geopolitics','purple','Sanctions and geopolitical fragmentation can alter reserve-management preferences.','Geopolitical / sanctions risk → reserve-security demand → gold.',4),
    ('gold-reserve-diversification','investor-flows','ETF / Investor Demand','green','Private flows determine whether structural official demand is being joined by investors.','Macro expectations / momentum → ETF and futures flows → marginal gold demand.',5),
    ('equity-rally-quality','ai-leadership','AI Leadership','purple','AI leadership can support indices while concealing weakness underneath.','AI earnings / capex → megacap leadership → index performance.',1),
    ('equity-rally-quality','breadth','Breadth','blue','Breadth tests whether participation is expanding beyond the leaders.','Participation → equal-weight / small-cap / sector confirmation → rally quality.',2),
    ('equity-rally-quality','earnings','Earnings','green','Forward earnings determine whether price gains have fundamental support.','Guidance / revisions → forward EPS → valuation support.',3),
    ('equity-rally-quality','consumer','Consumer','yellow','Household demand determines whether aggregate earnings can broaden beyond AI.','Income / spending → revenues / margins → earnings breadth.',4),
    ('equity-rally-quality','financials','Financials','teal','Banks and financials connect the curve, credit creation and domestic growth.','Curve / credit / loan demand → financial earnings → cyclical confirmation.',5),
    ('equity-rally-quality','valuation-rates','Valuation / Rates','red','High real yields can cap long-duration equity multiples even when earnings remain strong.','Real yields / cost of capital → discount rate → equity valuation.',6)
)
insert into public.market_regime_subgroups
  (regime_id, subgroup_key, label, accent, why_it_matters, mechanism, ordinal)
select r.id, seed.subgroup_key, seed.label, seed.accent, seed.why_it_matters, seed.mechanism, seed.ordinal
from seed
join public.market_regimes r on r.slug = seed.regime_slug;

create or replace function public.sync_market_regime_story_links_v1(
  p_projection_run_id uuid,
  p_links jsonb
)
returns table(active_count integer, inserted_count integer, expired_count integer)
language plpgsql
set search_path = public
as $$
declare
  v_active integer := 0;
  v_inserted integer := 0;
  v_expired integer := 0;
  v_expected integer := 0;
  v_resolved integer := 0;
begin
  if not exists (
    select 1 from public.market_regime_projection_runs
    where id = p_projection_run_id and projection_mode = 'shadow'
  ) then
    raise exception 'Unknown or non-shadow Regime projection run %', p_projection_run_id;
  end if;

  if jsonb_typeof(coalesce(p_links, '[]'::jsonb)) <> 'array' then
    raise exception 'p_links must be a JSON array';
  end if;

  create temporary table tmp_market_regime_links (
    story_id uuid not null,
    regime_id uuid not null,
    subgroup_id uuid not null,
    role text not null,
    confidence numeric(5,2) not null
  ) on commit drop;

  select jsonb_array_length(coalesce(p_links, '[]'::jsonb)) into v_expected;

  insert into tmp_market_regime_links(story_id, regime_id, subgroup_id, role, confidence)
  select x.story_id, r.id, sg.id, x.role, greatest(0, least(100, x.confidence))
  from jsonb_to_recordset(coalesce(p_links, '[]'::jsonb))
    as x(story_id uuid, regime_slug text, subgroup_key text, role text, confidence numeric)
  join public.stories s on s.id = x.story_id
  join public.market_regimes r on r.slug = x.regime_slug and r.status = 'active'
  join public.market_regime_subgroups sg
    on sg.regime_id = r.id
   and sg.subgroup_key = x.subgroup_key
   and sg.status = 'active'
  where x.role in ('core','supporting','bridge','countercase');

  select count(*) into v_resolved from tmp_market_regime_links;
  if v_resolved <> v_expected then
    raise exception 'Regime Story link resolution mismatch: expected %, resolved %', v_expected, v_resolved;
  end if;

  update public.market_regime_story_links link
  set effective_to = now(),
      last_projection_run_id = p_projection_run_id,
      metadata = link.metadata || jsonb_build_object('expiredByProjectionRunId', p_projection_run_id),
      updated_at = now()
  where link.effective_to is null
    and link.assignment_origin = 'deterministic_runtime'
    and not link.locked
    and not exists (
      select 1 from tmp_market_regime_links desired
      where desired.story_id = link.story_id
        and desired.regime_id = link.regime_id
        and desired.subgroup_id = link.subgroup_id
        and desired.role = link.role
    );
  get diagnostics v_expired = row_count;

  update public.market_regime_story_links link
  set confidence = desired.confidence,
      last_projection_run_id = p_projection_run_id,
      updated_at = now()
  from tmp_market_regime_links desired
  where link.effective_to is null
    and link.story_id = desired.story_id
    and link.regime_id = desired.regime_id
    and link.subgroup_id = desired.subgroup_id
    and link.role = desired.role;

  insert into public.market_regime_story_links(
    regime_id, subgroup_id, story_id, role, confidence,
    assignment_origin, last_projection_run_id, effective_from, metadata
  )
  select desired.regime_id, desired.subgroup_id, desired.story_id, desired.role,
         desired.confidence, 'deterministic_runtime', p_projection_run_id, now(),
         jsonb_build_object('origin','regime-projector/1')
  from tmp_market_regime_links desired
  where not exists (
    select 1 from public.market_regime_story_links link
    where link.effective_to is null
      and link.story_id = desired.story_id
      and link.regime_id = desired.regime_id
      and link.subgroup_id = desired.subgroup_id
      and link.role = desired.role
  );
  get diagnostics v_inserted = row_count;

  select count(*) into v_active
  from public.market_regime_story_links
  where effective_to is null;

  return query select v_active, v_inserted, v_expired;
end;
$$;

create or replace function public.persist_market_regime_projection_v1(
  p_projection_run_id uuid,
  p_regime_slug text,
  p_snapshot jsonb,
  p_snapshot_hash text,
  p_input_manifest jsonb,
  p_as_of timestamptz,
  p_state text,
  p_state_kind text,
  p_confidence_label text,
  p_materiality_reason text
)
returns table(version_id uuid, version_number integer, created boolean)
language plpgsql
set search_path = public
as $$
declare
  v_regime_id uuid;
  v_run_mode text;
  v_existing_id uuid;
  v_existing_number integer;
  v_current public.market_regime_current%rowtype;
  v_new_id uuid;
  v_new_number integer;
  v_reason text;
begin
  select projection_mode into v_run_mode
  from public.market_regime_projection_runs
  where id = p_projection_run_id;

  if v_run_mode is null then
    raise exception 'Unknown Regime projection run %', p_projection_run_id;
  end if;
  if v_run_mode <> 'shadow' then
    raise exception 'persist_market_regime_projection_v1 only accepts shadow runs';
  end if;
  if p_state_kind not in ('system1','interpreted','unresolved') then
    raise exception 'Invalid Regime state_kind %', p_state_kind;
  end if;
  if coalesce(length(trim(p_snapshot_hash)),0) < 16 then
    raise exception 'Regime snapshot hash is missing or too short';
  end if;

  select id into v_regime_id
  from public.market_regimes
  where slug = p_regime_slug and status = 'active';

  if v_regime_id is null then
    raise exception 'Unknown active Regime %', p_regime_slug;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_regime_slug || ':shadow', 0));

  select id, market_regime_versions.version_number
  into v_existing_id, v_existing_number
  from public.market_regime_versions
  where projection_run_id = p_projection_run_id
    and regime_id = v_regime_id
  limit 1;

  if v_existing_id is not null then
    return query select v_existing_id, v_existing_number, false;
    return;
  end if;

  select *
  into v_current
  from public.market_regime_current
  where regime_id = v_regime_id
    and projection_mode = 'shadow'
  for update;

  if v_current.regime_id is not null and v_current.snapshot_hash = p_snapshot_hash then
    update public.market_regime_current
    set projection_run_id = p_projection_run_id,
        state = p_state,
        state_kind = p_state_kind,
        confidence_label = p_confidence_label,
        as_of = p_as_of,
        input_manifest = coalesce(p_input_manifest, '{}'::jsonb),
        snapshot = p_snapshot,
        updated_at = now()
    where regime_id = v_regime_id
      and projection_mode = 'shadow';

    select market_regime_versions.version_number
    into v_existing_number
    from public.market_regime_versions
    where id = v_current.version_id;

    return query select v_current.version_id, v_existing_number, false;
    return;
  end if;

  select coalesce(max(market_regime_versions.version_number), 0) + 1
  into v_new_number
  from public.market_regime_versions
  where regime_id = v_regime_id
    and projection_mode = 'shadow';

  v_reason := case
    when v_new_number = 1 then 'bootstrap_current_state'
    else coalesce(nullif(trim(p_materiality_reason),''),'shadow_change')
  end;

  insert into public.market_regime_versions(
    regime_id, projection_run_id, version_number, projection_mode,
    state, state_kind, confidence_label, as_of, input_manifest, snapshot,
    snapshot_hash, materiality_reason, supersedes_version_id
  ) values (
    v_regime_id, p_projection_run_id, v_new_number, 'shadow',
    p_state, p_state_kind, p_confidence_label, p_as_of,
    coalesce(p_input_manifest, '{}'::jsonb), p_snapshot,
    p_snapshot_hash, v_reason,
    case when v_current.regime_id is null then null else v_current.version_id end
  )
  returning id into v_new_id;

  insert into public.market_regime_current(
    regime_id, projection_mode, version_id, projection_run_id,
    state, state_kind, confidence_label, as_of, input_manifest,
    snapshot, snapshot_hash, updated_at
  ) values (
    v_regime_id, 'shadow', v_new_id, p_projection_run_id,
    p_state, p_state_kind, p_confidence_label, p_as_of,
    coalesce(p_input_manifest, '{}'::jsonb), p_snapshot, p_snapshot_hash, now()
  )
  on conflict (regime_id, projection_mode)
  do update set
    version_id = excluded.version_id,
    projection_run_id = excluded.projection_run_id,
    state = excluded.state,
    state_kind = excluded.state_kind,
    confidence_label = excluded.confidence_label,
    as_of = excluded.as_of,
    input_manifest = excluded.input_manifest,
    snapshot = excluded.snapshot,
    snapshot_hash = excluded.snapshot_hash,
    updated_at = excluded.updated_at;

  return query select v_new_id, v_new_number, true;
end;
$$;

revoke all on function public.sync_market_regime_story_links_v1(uuid,jsonb) from public, anon, authenticated;
revoke all on function public.persist_market_regime_projection_v1(uuid,text,jsonb,text,jsonb,timestamptz,text,text,text,text) from public, anon, authenticated;
grant execute on function public.sync_market_regime_story_links_v1(uuid,jsonb) to service_role;
grant execute on function public.persist_market_regime_projection_v1(uuid,text,jsonb,text,jsonb,timestamptz,text,text,text,text) to service_role;
