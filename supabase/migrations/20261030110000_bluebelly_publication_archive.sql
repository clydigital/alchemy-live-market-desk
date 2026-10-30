-- Bluebelly: durable backend archive for previously rendered, source-reviewed public snapshots.
-- This does not confer an owner approval receipt or a canonical regime verdict.
-- Private table: server-only approved projections; no public direct SQL or Data API grants.
create table if not exists public.bluebelly_publication_archive (
  record_key text primary key check (record_key ~ '^[a-z0-9][a-z0-9._-]{2,119}$'),
  event_type text not null check (event_type in ('EARNINGS','ECONOMIC_RELEASE','POLICY_DECISION','COMPANY_DISCLOSURE','CORPORATE_ACTION','REGULATORY_CHANGE','SUPPLY_DISRUPTION','GEOPOLITICAL_DEVELOPMENT','MARKET_OBSERVATION','OTHER')),
  headline text not null check (char_length(headline) between 8 and 300),
  event_at timestamptz,
  event_day date,
  source_url text not null check (source_url like 'https://%' and length(source_url)<=2048),
  source_name text not null,
  reader_href text not null check (reader_href ~ '^/key-stories\\?(postEvent|brief)=[a-z0-9_-]{3,150}$'),
  source_module text not null,
  topics jsonb not null default '[]'::jsonb check (jsonb_typeof(topics)='array'),
  entity_keys jsonb not null default '[]'::jsonb check (jsonb_typeof(entity_keys)='array'),
  publication_basis text not null default 'OBSERVED_PUBLIC_READER'
    check (publication_basis in ('OBSERVED_PUBLIC_READER','APPROVED_WITH_RECEIPT')),
  approved_publication_id uuid references public.editorial_publications(id),
  source_review_notes text not null default 'Existing reviewed public reader snapshot; publication approval receipt not established.',
  captured_at timestamptz not null default now(),
  constraint bluebelly_archive_exact_time check ((event_at is not null) <> (event_day is not null)),
  constraint bluebelly_archive_approval check (publication_basis <> 'APPROVED_WITH_RECEIPT' or approved_publication_id is not null)
);
create index if not exists bluebelly_publication_archive_event_idx on public.bluebelly_publication_archive (coalesce(event_at,(event_day::timestamp at time zone 'UTC')) desc,record_key);
alter table public.bluebelly_publication_archive enable row level security;
-- This is an owner/server archival store. Do not grant browser clients table SELECT.
revoke all on public.bluebelly_publication_archive from anon,authenticated;
-- Initial observed-public seed: 3 official bank decisions, 5 reviewed issuer
-- snapshots and 1 original BEA release. No fabricated publication timestamps,
-- review receipt IDs or midnight times for date-only earnings reports.
insert into public.bluebelly_publication_archive
 (record_key,event_type,headline,event_at,event_day,source_url,source_name,
 reader_href,source_module,topics,entity_keys)
values
('fed-2026-10-28','POLICY_DECISION','Fed holds at 3.75–4.00%; two officials wanted a hike','2026-10-28T18:00:00Z',NULL,'https://www.federalreserve.gov/newsevents/pressreleases/monetary20261028a.htm','Federal Reserve','/key-stories?postEvent=fed-2026-10-28','lib/bluebelly-bank-decision-snapshots.ts','["RATES_BONDS","ECONOMY"]'::jsonb,'["FED"]'::jsonb),
('boc-2026-10-28','POLICY_DECISION','Bank of Canada raises rates 25bp to 2.50%','2026-10-28T13:45:00Z',NULL,'https://www.bankofcanada.ca/2026/10/fad-press-release-2026-10-28/','Bank of Canada','/key-stories?postEvent=boc-2026-10-28','lib/bluebelly-bank-decision-snapshots.ts','["RATES_BONDS","FX"]'::jsonb,'["BOC"]'::jsonb),
('rbnz-2026-10-28','POLICY_DECISION','RBNZ holds at 2.75% in a narrow 4–3 vote','2026-10-28T01:00:00Z',NULL,'https://www.rbnz.govt.nz/news-and-events/news/2026/10/ocr-held-at-2-75-percent','Reserve Bank of New Zealand','/key-stories?postEvent=rbnz-2026-10-28','lib/bluebelly-bank-decision-snapshots.ts','["RATES_BONDS","FX"]'::jsonb,'["RBNZ"]'::jsonb),
('bea-pce-september-2026','ECONOMIC_RELEASE','US PCE inflation reaches 3.6% as real spending stalls','2026-10-29T12:30:00Z',NULL,'https://www.bea.gov/news/2026/personal-income-and-outlays-september-2026','US Bureau of Economic Analysis','/key-stories?brief=bea-pce-september-2026','lib/blue-desk-official-macro-results.ts','["ECONOMY","RATES_BONDS"]'::jsonb,'["US-PCE"]'::jsonb),
('amazon-2026q3','EARNINGS','Amazon''s AWS accelerates, but its infrastructure bill overwhelms trailing cash.',NULL,'2026-10-29','https://ir.aboutamazon.com/news-release/news-release-details/2026/Amazon-com-Announces-Third-Quarter-Results/default.aspx','Amazon Investor Relations','/key-stories?postEvent=amazon-2026q3','lib/blue-desk-earnings-results.ts','["EQUITIES","AI_TECHNOLOGY"]'::jsonb,'["AMZN"]'::jsonb),
('intel-2026q3','EARNINGS','Intel''s quarter improved, but a weaker PC outlook challenges the recovery.',NULL,'2026-10-29','https://www.intc.com/filings-reports/all-sec-filings/content/0000050863-26-000188/q326earningsrelease.htm','Intel','/key-stories?postEvent=intel-2026q3','lib/blue-desk-earnings-results.ts','["EQUITIES","AI_TECHNOLOGY"]'::jsonb,'["INTC"]'::jsonb),
('sandisk-fy2027q1','EARNINGS','Sandisk data-centre revenue jumps 61% sequentially, a different chip-market story.',NULL,'2026-10-29','https://investor.sandisk.com/news-releases/news-release-details/sandisk-reports-fiscal-first-quarter-2027-financial-results','Sandisk Investor Relations','/key-stories?postEvent=sandisk-fy2027q1','lib/blue-desk-earnings-results.ts','["EQUITIES","AI_TECHNOLOGY"]'::jsonb,'["SNDK"]'::jsonb),
('sk-hynix-2026q3','EARNINGS','Memory-chip earnings jumped; the cash-spending test is still open.',NULL,'2026-10-28','https://news.skhynix.com/en/q3-2026-business-results/','SK hynix','/key-stories?postEvent=sk-hynix-2026q3','lib/blue-desk-earnings-results.ts','["EQUITIES","AI_TECHNOLOGY"]'::jsonb,'["000660.KS"]'::jsonb),
('tsmc-2026q3','EARNINGS','Revenue beat management''s range; an analyst-consensus beat is not established here.',NULL,'2026-10-15','https://investor.tsmc.com/english/quarterly-results/2026/q3','TSMC','/key-stories?postEvent=tsmc-2026q3','lib/blue-desk-earnings-results.ts','["EQUITIES","AI_TECHNOLOGY"]'::jsonb,'["TSM"]'::jsonb)
on conflict (record_key) do nothing;
