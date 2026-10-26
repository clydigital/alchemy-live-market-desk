-- Automated, source-qualified Bluebelly PDF editions. Separate from human-reviewed editorial_publications. These files are private to the approved owner.
-- No Story/Dossier mutation. Service-role writes only. No browser-role access to completed editions; service-role-only reads after owner authorisation.
create table if not exists public.blue_desk_automated_reports (
  id uuid primary key default gen_random_uuid(),
  report_day date not null,
  slot text not null check (slot in ('morning','evening')),
  status text not null default 'building' check (status in ('building','ready','blocked','failed')),
  title text not null default '' check (char_length(title)<=110),
  deck text not null default '' check (char_length(deck)<=450),
  summary text not null default '' check (char_length(summary)<=1800),
  pdf_path text unique check (pdf_path is null or pdf_path ~ '^automated-daily/[0-9]{4}-[0-9]{2}-[0-9]{2}/(morning|evening)/[0-9a-f-]{36}[.]pdf$'),
  pdf_sha256 text check (pdf_sha256 is null or pdf_sha256 ~ '^[0-9a-f]{64}$'),
  source_urls jsonb not null default '[]'::jsonb check(jsonb_typeof(source_urls)='array' and jsonb_array_length(source_urls)<=20),
  source_count integer not null default 0 check (source_count>=0 and source_count<=25),
  coverage_note text not null default '' check (char_length(coverage_note)<=1500),
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  error_code text,
  constraint report_slot_unique unique(report_day,slot),
  constraint completed_pdf_required check(status<>'ready' or
    (pdf_path is not null and pdf_sha256 is not null and ready_at is not null
     and source_count>=2 and char_length(summary)>40))
);
create index if not exists blue_desk_automated_reports_ready_idx
  on public.blue_desk_automated_reports (ready_at desc)
  where status='ready';
alter table public.blue_desk_automated_reports enable row level security;
drop policy if exists blue_desk_automated_reports_public_read on public.blue_desk_automated_reports;
drop policy if exists blue_desk_automated_reports_no_browser_read on public.blue_desk_automated_reports;
-- RLS fail-closed: no anon or authenticated SELECT policies for private editions.
-- A validated owner-only server reader may use the existing service-role client.
revoke all on public.blue_desk_automated_reports from anon,authenticated;
