-- External ChatGPT Work -> private My Desk HTML delivery.
-- Work writes a finished static HTML artifact through its authorised Supabase
-- connector. No public HTTP ingestion or second browser upload is needed.
create table if not exists public.blue_desk_work_html_editions (
 id uuid primary key default gen_random_uuid(),
 owner_user_id uuid not null,
 report_day date not null,
 title text not null check (char_length(title) between 8 and 110),
 html_content text not null check (
   octet_length(html_content) between 1000 and 950000
   and html_content ~* '<html[ >]'
   and html_content !~* '<script[ >]'
 ),
 html_sha256 text not null check (html_sha256 ~ '^[0-9a-f]{64}$'),
 content_sha256 text not null check (content_sha256 ~ '^[0-9a-f]{64}$'),
 source_manifest jsonb not null default '[]'::jsonb check (
   jsonb_typeof(source_manifest)='array' and jsonb_array_length(source_manifest)<=24
 ),
 delivery_type text not null default 'CHATGPT_WORK'
   check (delivery_type='CHATGPT_WORK'),
 review_status text not null default 'PRIVATE_DRAFT'
   check (review_status='PRIVATE_DRAFT'),
 created_at timestamptz not null default now(),
 constraint blue_desk_work_html_per_owner_content unique(owner_user_id,content_sha256)
);
create index if not exists blue_desk_work_html_owner_latest
 on public.blue_desk_work_html_editions(owner_user_id,created_at desc);
alter table public.blue_desk_work_html_editions enable row level security;
revoke all on public.blue_desk_work_html_editions from public,anon,authenticated;
grant select,insert on public.blue_desk_work_html_editions to service_role;
-- No authenticated user RLS policy: only owner-authenticated server can
-- read; Work may write via privileged *connected* Supabase tool only.
drop trigger if exists blue_desk_work_html_immutable on public.blue_desk_work_html_editions;
create trigger blue_desk_work_html_immutable
 before update or delete on public.blue_desk_work_html_editions
 for each row execute function public.blue_desk_private_html_immutable_guard();
