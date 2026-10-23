-- Private presentation handoff for the existing 09:00 Blue Desk Content Slate.
-- This is not a replacement for MacroPulse, the Research Gap Gate or canonical evidence.
create table if not exists public.blue_desk_editorial_slates (
  day_myt date primary key,
  produced_at timestamptz not null,
  producer text not null default 'Blue Desk OB/COTD Writing Brain'
    check (producer='Blue Desk OB/COTD Writing Brain'),
  ideas jsonb not null check (jsonb_typeof(ideas)='array' and jsonb_array_length(ideas)=3),
  sources jsonb not null default '[]'::jsonb check (jsonb_typeof(sources)='array'),
  verification_status text not null check (verification_status in ('partial','source_checked')),
  notes text not null default '' check (char_length(notes)<=6000),
  updated_at timestamptz not null default now(),
  check (octet_length(ideas::text)<=45000),
  check (octet_length(sources::text)<=15000)
);
create index if not exists blue_desk_editorial_slates_produced_idx
  on public.blue_desk_editorial_slates (produced_at desc);
alter table public.blue_desk_editorial_slates enable row level security;
revoke all on table public.blue_desk_editorial_slates from public,anon,authenticated;
grant select,insert,update on table public.blue_desk_editorial_slates to service_role;
comment on table public.blue_desk_editorial_slates is
'Owner-only editorial slate projection. Written by the existing 09:00 ChatGPT scheduled research task via authorised Supabase; not canonical evidence or client publication.';
