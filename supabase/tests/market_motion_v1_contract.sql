-- Market Motion v1 database contract and lifecycle proof.

begin;

do $$
declare
  missing_columns text[];
  trigger_count integer;
  rls_enabled boolean;
  client_write_policy_count integer;
  first_id uuid;
  second_id uuid;
  first_version integer;
  first_observed_at timestamptz;
  first_expires_at timestamptz;
  second_version integer;
  second_previous uuid;
  update_failed boolean := false;
  delete_failed boolean := false;
  expired_effective_state text;
begin
  if to_regclass('public.market_motion_items') is null then
    raise exception 'public.market_motion_items table does not exist';
  end if;

  if to_regclass('public.current_market_motion_items') is null then
    raise exception 'public.current_market_motion_items view does not exist';
  end if;

  select array_agg(required.col order by required.col)
  into missing_columns
  from (
    values
      ('id'),('motion_key'),('version_number'),('previous_version_id'),('contract_version'),
      ('research_run_id'),('source_id'),('evidence_id'),('primary_story_id'),('primary_regime_slug'),
      ('lifecycle_state'),('category'),('verification_state'),('headline'),('what_happened'),
      ('market_reaction'),('why_interesting'),('big_picture_bridge'),('next_test'),('promotion_reason'),
      ('tickers'),('source_name'),('source_url'),('source_kind'),('materiality'),('relevance'),('novelty'),
      ('occurred_at'),('observed_at'),('expires_at'),('metadata'),('created_at')
  ) as required(col)
  where not exists (
    select 1
    from information_schema.columns
    where table_schema='public'
      and table_name='market_motion_items'
      and column_name=required.col
  );

  if missing_columns is not null then
    raise exception 'Missing Market Motion columns: %', array_to_string(missing_columns, ', ');
  end if;

  select count(*) into trigger_count
  from pg_trigger
  where tgrelid='public.market_motion_items'::regclass
    and tgname='market_motion_items_append_only'
    and not tgisinternal;
  if trigger_count <> 1 then
    raise exception 'market_motion_items_append_only trigger missing';
  end if;

  select relrowsecurity into rls_enabled
  from pg_class where oid='public.market_motion_items'::regclass;
  if not rls_enabled then
    raise exception 'RLS is not enabled for market_motion_items';
  end if;

  select count(*) into client_write_policy_count
  from pg_policies
  where schemaname='public'
    and tablename='market_motion_items'
    and cmd in ('INSERT','UPDATE','DELETE','ALL')
    and (roles @> array['anon']::name[] or roles @> array['authenticated']::name[] or roles @> array['public']::name[]);
  if client_write_policy_count > 0 then
    raise exception 'Client write policy detected on market_motion_items';
  end if;

  insert into public.market_motion_items (
    motion_key,
    lifecycle_state,
    category,
    verification_state,
    headline,
    what_happened,
    why_interesting,
    big_picture_bridge,
    next_test,
    tickers,
    source_name,
    source_url,
    source_kind,
    materiality,
    relevance,
    novelty,
    occurred_at,
    observed_at,
    expires_at
  ) values (
    'contract:market-motion',
    'MOTION',
    'COMPANY',
    'REPORTED',
    'Initial motion item',
    'A current company event occurred.',
    'It creates a testable narrative hook.',
    'Company event → existing market Story → next test.',
    'Watch the linked asset reaction.',
    array['TEST'],
    'Contract test',
    'https://example.com/market-motion',
    'reporting',
    70,
    80,
    75,
    now() - interval '1 hour',
    now(),
    null
  ) returning id, version_number, observed_at, expires_at
    into first_id, first_version, first_observed_at, first_expires_at;

  if first_version <> 1 then
    raise exception 'First Market Motion version expected 1, got %', first_version;
  end if;

  if first_expires_at <> first_observed_at + interval '48 hours' then
    raise exception '48h Market Motion default expiry failed: observed %, expires %', first_observed_at, first_expires_at;
  end if;

  insert into public.market_motion_items (
    motion_key,
    lifecycle_state,
    category,
    verification_state,
    headline,
    what_happened,
    why_interesting,
    big_picture_bridge,
    tickers,
    source_name,
    source_url,
    source_kind,
    materiality,
    relevance,
    novelty,
    occurred_at,
    observed_at,
    expires_at
  ) values (
    'contract:market-motion',
    'PROMOTED',
    'COMPANY',
    'VERIFIED',
    'Promoted motion item',
    'The same event gained stronger verification.',
    'The hook is now material enough to promote.',
    'Verified event → canonical Story/Regime bridge.',
    array['TEST'],
    'Contract test',
    'https://example.com/market-motion',
    'primary',
    90,
    90,
    80,
    now() - interval '30 minutes',
    now(),
    null
  ) returning id, version_number, previous_version_id
    into second_id, second_version, second_previous;

  if second_version <> 2 or second_previous is distinct from first_id then
    raise exception 'Market Motion version lineage failed: version %, previous %', second_version, second_previous;
  end if;

  if not exists (
    select 1
    from public.current_market_motion_items
    where motion_key='contract:market-motion'
      and id=second_id
      and current_market_motion_items.effective_state='PROMOTED'
  ) then
    raise exception 'Current Market Motion view did not select latest promoted version';
  end if;

  insert into public.market_motion_items (
    motion_key,
    lifecycle_state,
    category,
    verification_state,
    headline,
    what_happened,
    why_interesting,
    big_picture_bridge,
    tickers,
    source_name,
    source_url,
    source_kind,
    materiality,
    relevance,
    novelty,
    occurred_at,
    observed_at,
    expires_at
  ) values (
    'contract:expired-motion',
    'MOTION',
    'MACRO',
    'REPORTED',
    'Expired motion item',
    'This item is intentionally older than the freshness window.',
    'Expiry should be derived without mutating history.',
    'Old event → archive context.',
    array[]::text[],
    'Contract test',
    'https://example.com/expired-motion',
    'reporting',
    50,
    50,
    50,
    now() - interval '4 days',
    now() - interval '4 days',
    null
  );

  select current_market_motion_items.effective_state into expired_effective_state
  from public.current_market_motion_items
  where motion_key='contract:expired-motion';

  if expired_effective_state <> 'EXPIRED' then
    raise exception '48h Market Motion expiry failed, got %', expired_effective_state;
  end if;

  begin
    update public.market_motion_items set headline='mutated' where id=second_id;
  exception when others then
    update_failed := true;
  end;
  if not update_failed then
    raise exception 'Market Motion UPDATE was not rejected';
  end if;

  begin
    delete from public.market_motion_items where id=second_id;
  exception when others then
    delete_failed := true;
  end;
  if not delete_failed then
    raise exception 'Market Motion DELETE was not rejected';
  end if;
end
$$;

rollback;
