-- Twice-daily research intake, validation and publication ledger.

create table if not exists public.research_runs (
  id uuid primary key default gen_random_uuid(),
  run_key text not null unique,
  schedule_slot text not null check (schedule_slot in ('morning', 'evening', 'manual')),
  scheduled_for timestamptz not null,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  status text not null default 'running' check (status in ('running', 'completed', 'blocked', 'failed')),
  accuracy_gate text not null default 'blocked' check (accuracy_gate in ('open', 'review', 'blocked')),
  required_sources_complete boolean not null default false,
  evidence_gate_passed boolean not null default false,
  source_checks jsonb not null default '[]'::jsonb check (jsonb_typeof(source_checks) = 'array'),
  videos_found integer not null default 0 check (videos_found >= 0),
  transcripts_ready integer not null default 0 check (transcripts_ready >= 0),
  news_scanned integer not null default 0 check (news_scanned >= 0),
  candidates_kept integer not null default 0 check (candidates_kept >= 0),
  articles_scanned integer not null default 0 check (articles_scanned between 0 and 30),
  articles_flagged integer not null default 0 check (articles_flagged >= 0),
  evidence_added integer not null default 0 check (evidence_added >= 0),
  updates_published integer not null default 0 check (updates_published >= 0),
  warnings text[] not null default '{}',
  summary text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.research_intake_items (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.research_runs(id) on delete cascade,
  item_key text not null unique,
  item_type text not null check (item_type in ('video', 'news', 'alchemy_article')),
  publisher text not null,
  external_id text,
  title text not null,
  url text not null,
  published_at timestamptz not null,
  article_position integer check (article_position between 1 and 30),
  transcript_status text check (transcript_status in ('ready', 'missing', 'unavailable', 'not_applicable')),
  transcript_text text,
  summary text not null,
  affected_story_slugs text[] not null default '{}',
  source_quality integer not null check (source_quality between 0 and 100),
  relevance integer not null check (relevance between 0 and 100),
  novelty integer not null check (novelty between 0 and 100),
  materiality integer not null check (materiality between 0 and 100),
  candidate_score integer not null check (candidate_score between 0 and 100),
  recommended_action text not null check (recommended_action in ('ignore', 'monitor', 'collect_evidence', 'review_article', 'recalibrate_story')),
  status text not null default 'candidate' check (status in ('candidate', 'accepted', 'blocked', 'published', 'rejected')),
  stats_signal text,
  news_signal text,
  divergence_kind text not null default 'none' check (divergence_kind in ('none', 'stats_lead', 'news_lead', 'contradiction')),
  divergence_note text,
  evidence_links jsonb not null default '[]'::jsonb check (jsonb_typeof(evidence_links) = 'array'),
  review_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (item_type <> 'alchemy_article' or article_position is not null),
  check (item_type <> 'video' or transcript_status is not null)
);

create index if not exists research_runs_schedule_idx
  on public.research_runs (scheduled_for desc);
create index if not exists research_intake_run_idx
  on public.research_intake_items (run_id, candidate_score desc);
create index if not exists research_intake_published_idx
  on public.research_intake_items (published_at desc);
create index if not exists research_intake_story_slugs_idx
  on public.research_intake_items using gin (affected_story_slugs);

alter table public.research_runs enable row level security;
alter table public.research_intake_items enable row level security;

create or replace view public.research_run_status as
select
  id, run_key, schedule_slot, scheduled_for, started_at, completed_at, status,
  accuracy_gate, required_sources_complete, evidence_gate_passed, source_checks,
  videos_found, transcripts_ready, news_scanned, candidates_kept,
  articles_scanned, articles_flagged, evidence_added, updates_published,
  warnings, summary, updated_at
from public.research_runs;

create or replace view public.research_intake_queue as
select
  id, run_id, item_key, item_type, publisher, title, url, published_at,
  article_position, transcript_status,
  case when transcript_text is null then 0 else array_length(regexp_split_to_array(trim(transcript_text), '\s+'), 1) end as transcript_word_count,
  summary, affected_story_slugs, source_quality, relevance, novelty, materiality,
  candidate_score, recommended_action, status, stats_signal, news_signal,
  divergence_kind, divergence_note, evidence_links, review_reason, updated_at
from public.research_intake_items;

revoke all privileges on table public.research_runs, public.research_intake_items
  from anon, authenticated;
revoke all privileges on table public.research_run_status, public.research_intake_queue
  from anon, authenticated;

grant select, insert, update, delete on table public.research_runs, public.research_intake_items
  to service_role;
grant select on table public.research_run_status, public.research_intake_queue
  to service_role;

insert into public.research_source_registry (
  slug, name, source_kind, source_tier, status, url, corpus_note,
  method_strengths, operational_use, safeguards, owner_app, last_reviewed_at
) values
  ('stockedup-youtube', 'StockedUp', 'creator_transcript', 3, 'active', 'https://www.youtube.com/@StockedUp',
    'Check for newly published videos at both scheduled runs.',
    array['retail positioning', 'equity themes', 'trade framing'],
    'Extract dated claims, tickers, catalysts and chart questions from new transcripts.',
    'Creator claims never publish alone; require primary or high-quality reporting confirmation.', 'original_desk', now()),
  ('wall-street-truth-bombs-youtube', 'Wall Street Truth Bombs', 'creator_transcript', 3, 'pending', null,
    'Exact canonical channel URL must be confirmed before automated matching is trusted.',
    array['market narrative', 'cross-asset claims'],
    'Collect new live-video transcripts after channel identity is resolved.',
    'Fail closed on ambiguous channel identity and never infer a transcript from title similarity.', 'original_desk', now()),
  ('traders-reality-youtube', 'Traders Reality', 'creator_transcript', 3, 'active', 'https://www.youtube.com/@tradersreality',
    'Check new live videos and transcript availability at both scheduled runs.',
    array['liquidity narrative', 'short-horizon positioning', 'chart levels'],
    'Extract market-maker and liquidity claims as hypotheses for chart testing.',
    'Do not treat proprietary pattern language as verified market structure.', 'original_desk', now()),
  ('zerohedge-news', 'ZeroHedge', 'reporting_connector', 3, 'active', 'https://www.zerohedge.com/',
    'Scan recent dated market stories; retain only novel, material candidates.',
    array['fast narrative discovery', 'cross-asset leads'],
    'Use as an alerting layer for claims that require independent verification.',
    'Never promote a single-source claim; trace statistics and quotes to their origin.', 'original_desk', now()),
  ('axios-news', 'Axios', 'reporting_connector', 2, 'active', 'https://www.axios.com/',
    'Scan recent dated business, policy and market reporting.',
    array['policy context', 'company news', 'concise event framing'],
    'Use verified reporting to support or challenge active desk stories.',
    'Separate reported fact from editorial inference and link the original source when available.', 'original_desk', now()),
  ('investing-com-news', 'Investing.com', 'reporting_connector', 3, 'active', 'https://www.investing.com/webmaster-tools/rss',
    'Use dated RSS and market pages for broad candidate discovery.',
    array['economic calendar', 'asset news', 'earnings headlines'],
    'Scan for material macro, FX, commodity and earnings changes.',
    'Confirm figures against official releases or company filings before recalibration.', 'original_desk', now()),
  ('fxstreet-news', 'FXStreet', 'reporting_connector', 3, 'active', 'https://www.fxstreet.com/news',
    'Scan recent dated FX, rates and macro reporting.',
    array['FX catalysts', 'central-bank narrative', 'cross-asset reaction'],
    'Compare currency reporting with official data and live desk statistics.',
    'Forecasts remain attributed opinions; hard data must reconcile to the primary release.', 'original_desk', now()),
  ('alchemy-market-insights', 'Alchemy Markets Market Insights', 'reporting_connector', 1, 'active', 'https://alchemymarkets.com/education/market-insights/',
    'Review only the 30 most recently published, date-stamped articles.',
    array['published thesis memory', 'chart context', 'editorial follow-up'],
    'Flag prior articles whose evidence, catalyst or market reaction has materially changed.',
    'Never review an undated article; preserve the original thesis and append the change.', 'original_desk', now())
on conflict (slug) do update set
  name = excluded.name,
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
  updated_at = now();

comment on table public.research_runs is
  'Append-only proof that a scheduled research cycle ran and cleared its deterministic gates.';
comment on table public.research_intake_items is
  'Private transcript and news intake. Public clients see only the redacted research_intake_queue view.';
