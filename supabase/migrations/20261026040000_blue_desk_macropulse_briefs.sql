-- Lightweight research/editorial delivery, NOT a Motion, Story, Regime or Dossier writer.
-- Composio/ChatGPT may submit versioned DRAFTS, but only owner review publishes.
create table if not exists public.blue_desk_macropulse_briefs (
 id uuid primary key default gen_random_uuid(),
 source_page_id uuid not null,
 source_pulse_id text not null check (char_length(source_pulse_id) between 12 and 180),
 source_page_url text not null check (char_length(source_page_url) between 30 and 500),
 source_published_at timestamptz not null,
 source_retrieved_at timestamptz not null,
 digest_sha256 text not null check (digest_sha256 ~ '^[0-9a-f]{64}$'),
 headline text not null check (char_length(headline) between 20 and 140),
 standfirst text not null check (char_length(standfirst) between 55 and 550),
 what_changed text not null check (char_length(what_changed) between 60 and 1500),
 why_it_matters text not null check (char_length(why_it_matters) between 70 and 1500),
 countercase text not null check (char_length(countercase) between 50 and 1000),
 watch_next text not null check (char_length(watch_next) between 40 and 950),
 source_links jsonb not null check (jsonb_typeof(source_links)='array'
   and jsonb_array_length(source_links) between 1 and 8),
 primary_region text not null check (primary_region in ('US','Europe','Asia','Other')),
 editorial_model text not null default 'ChatGPT' check (char_length(editorial_model) between 2 and 50),
 verification_label text not null default 'RESEARCH_DERIVED_UNADJUDICATED'
   check (verification_label='RESEARCH_DERIVED_UNADJUDICATED'),
 status text not null default 'review' check (status in ('review','published')),
 received_at timestamptz not null default now(),
 published_at timestamptz,
 reviewed_by text,
 unique(source_page_id,digest_sha256),
 constraint macropulse_brief_publication_gate check(
   (status='review' and published_at is null and reviewed_by is null) or
   (status='published' and published_at is not null and char_length(reviewed_by)>2)
 )
);
create index if not exists blue_desk_macropulse_briefs_published_idx
 on public.blue_desk_macropulse_briefs(published_at desc,id desc)
 where status='published';
create index if not exists blue_desk_macropulse_briefs_review_idx
 on public.blue_desk_macropulse_briefs(received_at desc)
 where status='review';
alter table public.blue_desk_macropulse_briefs enable row level security;
drop policy if exists blue_desk_macropulse_briefs_public_read
 on public.blue_desk_macropulse_briefs;
create policy blue_desk_macropulse_briefs_public_read
 on public.blue_desk_macropulse_briefs
 for select to anon,authenticated using(status='published');
revoke all on public.blue_desk_macropulse_briefs from anon,authenticated;
grant select(id,source_page_id,source_pulse_id,source_page_url,
 source_published_at,source_retrieved_at,headline,standfirst,what_changed,
 why_it_matters,countercase,watch_next,source_links,primary_region,
 verification_label,status,published_at)
 on public.blue_desk_macropulse_briefs to anon,authenticated;
-- All creation/promotion uses existing owner-checked or scoped private
-- server-only service role. No browser client can mutate this table.
