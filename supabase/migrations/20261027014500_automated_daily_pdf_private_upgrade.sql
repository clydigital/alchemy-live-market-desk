-- Upgrade any previously applied public automated-PDF schema to private-owner-only.
-- Safe for an empty table or existing source-gated completed editions: no rows deleted.
alter table public.blue_desk_automated_reports enable row level security;
drop policy if exists blue_desk_automated_reports_public_read on public.blue_desk_automated_reports;
drop policy if exists blue_desk_automated_reports_no_browser_read on public.blue_desk_automated_reports;
revoke all privileges on table public.blue_desk_automated_reports from anon,authenticated;
revoke select (id,report_day,slot,status,title,deck,summary,source_urls,source_count,coverage_note)
  on public.blue_desk_automated_reports from anon,authenticated;

alter table public.blue_desk_automated_reports
  drop constraint if exists blue_desk_automated_reports_status_check;
update public.blue_desk_automated_reports set status='ready' where status='published';
alter table public.blue_desk_automated_reports
  add constraint blue_desk_automated_reports_status_check
    check (status in ('building','ready','blocked','failed'));

alter table public.blue_desk_automated_reports drop constraint if exists completed_pdf_required;
alter table public.blue_desk_automated_reports add column if not exists ready_at timestamptz;
do $$
begin
 if exists (
   select 1 from information_schema.columns
    where table_schema='public' and table_name='blue_desk_automated_reports' and column_name='published_at'
 ) then
   update public.blue_desk_automated_reports
     set ready_at=coalesce(ready_at,published_at) where ready_at is null;
   alter table public.blue_desk_automated_reports drop column published_at;
 end if;
end $$;
alter table public.blue_desk_automated_reports
  add constraint completed_pdf_required
  check(status<>'ready' or
    (pdf_path is not null and pdf_sha256 is not null and ready_at is not null
     and source_count>=2 and char_length(summary)>40));

drop index if exists public.blue_desk_automated_reports_published_idx;
create index if not exists blue_desk_automated_reports_ready_idx
  on public.blue_desk_automated_reports (ready_at desc) where status='ready';
-- Table/column SELECT remains denied to anon/authenticated. All presentation
-- reads use a separately authenticated owner server request and service-role.
