-- Live-owned X/Twitter discovery intake. Social is attributed discovery by default;
-- canonical fact promotion remains the responsibility of the existing evidence verifier.

alter table public.research_source_registry
  drop constraint if exists research_source_registry_source_kind_check;
alter table public.research_source_registry
  add constraint research_source_registry_source_kind_check
  check (source_kind = any (array[
    'creator_transcript'::text,
    'official_transcript'::text,
    'livestream_benchmark'::text,
    'data_connector'::text,
    'reporting_connector'::text,
    'social_monitor'::text
  ]));

alter table public.research_source_registry
  add column if not exists x_handle text,
  add column if not exists source_classification text,
  add column if not exists monitored boolean not null default false,
  add column if not exists health_state text,
  add column if not exists ingestion_provider text,
  add column if not exists last_successful_check_at timestamptz,
  add column if not exists last_post_seen_at timestamptz,
  add column if not exists provider_metadata jsonb not null default '{}'::jsonb;

alter table public.research_source_registry
  drop constraint if exists research_source_registry_source_classification_check;
alter table public.research_source_registry
  add constraint research_source_registry_source_classification_check
  check (source_classification is null or source_classification = any (array[
    'unverified'::text,
    'official'::text,
    'reporting'::text,
    'research'::text,
    'commentary'::text,
    'discovery'::text
  ]));

alter table public.research_source_registry
  drop constraint if exists research_source_registry_health_state_check;
alter table public.research_source_registry
  add constraint research_source_registry_health_state_check
  check (health_state is null or health_state = any (array[
    'unconfigured'::text,
    'healthy'::text,
    'no_new_posts'::text,
    'degraded'::text,
    'blocked'::text,
    'rate_limited'::text,
    'unavailable'::text,
    'renamed_unresolved'::text,
    'stale'::text
  ]));

alter table public.research_source_registry
  drop constraint if exists research_source_registry_provider_metadata_check;
alter table public.research_source_registry
  add constraint research_source_registry_provider_metadata_check
  check (jsonb_typeof(provider_metadata) = 'object'::text);

alter table public.research_intake_items
  drop constraint if exists research_intake_items_item_type_check;
alter table public.research_intake_items
  add constraint research_intake_items_item_type_check
  check (item_type = any (array['video'::text, 'news'::text, 'social_post'::text, 'alchemy_article'::text]));

create table if not exists public.research_social_posts (
  id uuid primary key default gen_random_uuid(),
  source_registry_id uuid not null references public.research_source_registry(id) on delete restrict,
  provider text not null,
  post_id text not null,
  account_handle text not null,
  account_display_name text,
  canonical_url text not null,
  posted_at timestamptz not null,
  post_text text not null,
  content_hash text not null,
  media jsonb not null default '[]'::jsonb check (jsonb_typeof(media) = 'array'::text),
  links jsonb not null default '[]'::jsonb check (jsonb_typeof(links) = 'array'::text),
  thread_context jsonb not null default '{}'::jsonb check (jsonb_typeof(thread_context) = 'object'::text),
  raw_payload jsonb not null default '{}'::jsonb check (jsonb_typeof(raw_payload) = 'object'::text),
  verification_state text not null default 'attributed' check (verification_state = any (array[
    'discovery'::text,
    'attributed'::text,
    'corroborated'::text,
    'primary'::text,
    'canonical'::text,
    'contradicted'::text,
    'stale'::text,
    'rejected'::text
  ])),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique (provider, post_id, content_hash)
);

create index if not exists research_social_posts_posted_idx
  on public.research_social_posts (posted_at desc);
create index if not exists research_social_posts_source_idx
  on public.research_social_posts (source_registry_id, posted_at desc);

alter table public.research_social_posts enable row level security;
revoke all privileges on table public.research_social_posts from anon, authenticated;
grant select, insert, update, delete on table public.research_social_posts to service_role;

with monitored(handle, slug) as (
  values
    ('Bluekurtic', 'x-bluekurtic'),
    ('HFI_Research', 'x-hfi-research'),
    ('OilandEnergy', 'x-oilandenergy'),
    ('TheStudyofWar', 'x-thestudyofwar'),
    ('Currentreport1', 'x-currentreport1'),
    ('arena', 'x-arena'),
    ('KobeissiLetter', 'x-kobeissiletter'),
    ('FirstSquawk', 'x-firstsquawk'),
    ('zerohedge', 'x-zerohedge'),
    ('GordianKnotDev', 'x-gordianknotdev')
)
insert into public.research_source_registry (
  slug,
  name,
  source_kind,
  source_tier,
  status,
  url,
  corpus_note,
  method_strengths,
  operational_use,
  safeguards,
  owner_app,
  last_reviewed_at,
  x_handle,
  source_classification,
  monitored,
  health_state,
  ingestion_provider,
  provider_metadata
)
select
  monitored.slug,
  'X @' || monitored.handle,
  'social_monitor',
  4,
  'active',
  'https://x.com/' || monitored.handle,
  'Approved monitored X account. Account ownership/classification is not inferred from the handle alone.',
  array['fast discovery', 'attributed statements', 'contradiction and chart leads'],
  'Collect recent attributed posts into the existing Live research intake for Story/topic/asset routing.',
  'Discovery-only by default. A post proves that the account published the statement, not that the underlying claim is true. Require independent canonical corroboration before Story mutation or fact promotion.',
  'original_desk',
  now(),
  monitored.handle,
  'unverified',
  true,
  'unconfigured',
  'x_syndication_embed',
  jsonb_build_object('verificationRole','discovery_only','provider','x_syndication_embed')
from monitored
on conflict (slug) do update set
  source_kind = excluded.source_kind,
  source_tier = excluded.source_tier,
  status = excluded.status,
  url = excluded.url,
  corpus_note = excluded.corpus_note,
  method_strengths = excluded.method_strengths,
  operational_use = excluded.operational_use,
  safeguards = excluded.safeguards,
  owner_app = excluded.owner_app,
  last_reviewed_at = excluded.last_reviewed_at,
  x_handle = excluded.x_handle,
  source_classification = coalesce(public.research_source_registry.source_classification, excluded.source_classification),
  monitored = true,
  ingestion_provider = excluded.ingestion_provider,
  provider_metadata = coalesce(public.research_source_registry.provider_metadata, '{}'::jsonb) || excluded.provider_metadata,
  updated_at = now();

comment on table public.research_social_posts is
  'Private immutable raw X/social post versions acquired by Live. Canonical evidence promotion occurs downstream and never from raw social content alone.';
