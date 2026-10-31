-- Private, append-only HTML owner editions. Independent of legacy PDF/Drive ledger.
-- Server-only service role reads/writes after session + active owner allowlist.
create table if not exists public.blue_desk_private_html_editions (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null,
  report_day date not null,
  title text not null check (char_length(title) between 8 and 110),
  content_sha256 text not null check(content_sha256 ~ '^[0-9a-f]{64}$'),
  html_sha256 text not null check(html_sha256 ~ '^[0-9a-f]{64}$'),
  html_path text not null unique check(
    html_path ~ '^private-html/[0-9a-f-]{36}/[0-9]{4}-[0-9]{2}-[0-9]{2}/[0-9a-f-]{36}\\.html$'
  ),
  source_manifest jsonb not null default '[]'::jsonb check(
    jsonb_typeof(source_manifest)='array' and jsonb_array_length(source_manifest)<=24
  ),
  supersedes_id uuid references public.blue_desk_private_html_editions(id),
  review_status text not null default 'PRIVATE_DRAFT' check(review_status='PRIVATE_DRAFT'),
  created_at timestamptz not null default now(),
  constraint blue_desk_private_html_owner_content_unique unique(owner_user_id,content_sha256)
);
create index if not exists blue_desk_private_html_owner_latest
 on public.blue_desk_private_html_editions(owner_user_id,created_at desc);

alter table public.blue_desk_private_html_editions enable row level security;
revoke all on public.blue_desk_private_html_editions from public,anon,authenticated;
-- No anon or authenticated policies. Only the service role after explicit user
-- authentication may read a particular owner_user_id and exact object path.

create or replace function public.blue_desk_private_html_immutable_guard()
returns trigger language plpgsql security invoker
set search_path = pg_catalog,public
as $$
begin
  raise exception 'private_html_editions_are_immutable' using errcode='23514';
end;
$$;
revoke all on function public.blue_desk_private_html_immutable_guard() from public,anon,authenticated;
drop trigger if exists blue_desk_private_html_immutable on public.blue_desk_private_html_editions;
create trigger blue_desk_private_html_immutable
 before update or delete on public.blue_desk_private_html_editions
 for each row execute function public.blue_desk_private_html_immutable_guard();

-- Private bucket, zero direct browser storage policies; no public object URL.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('editorial-html','editorial-html',false,1048576,array['text/html'])
on conflict(id) do update set public=false;
