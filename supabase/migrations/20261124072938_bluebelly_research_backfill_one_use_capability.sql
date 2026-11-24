create table public.bb_research_backfill_capabilities (
 token_hash text primary key check(length(token_hash)=64),
 expires_at timestamptz not null,
 consumed_at timestamptz,
 created_at timestamptz not null default now()
);
alter table public.bb_research_backfill_capabilities enable row level security;
revoke all on public.bb_research_backfill_capabilities from public,anon,authenticated;
grant select,update on public.bb_research_backfill_capabilities to service_role;
create function public.bb_consume_research_backfill_capability(token_hash_input text)
returns boolean language plpgsql volatile security invoker set search_path='' as $$
declare affected integer;
begin
 update public.bb_research_backfill_capabilities set consumed_at=clock_timestamp()
 where token_hash=token_hash_input and expires_at>clock_timestamp() and consumed_at is null;
 get diagnostics affected = row_count;
 return affected=1;
end; $$;
revoke all on function public.bb_consume_research_backfill_capability(text) from public,anon,authenticated;
grant execute on function public.bb_consume_research_backfill_capability(text) to service_role;
comment on table public.bb_research_backfill_capabilities is 'One-use short-lived capability hashes for internal bounded embedding backfill; no research data or service-role secrets.';
