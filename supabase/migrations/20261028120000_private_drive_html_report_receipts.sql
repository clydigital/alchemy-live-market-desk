-- Extend EXISTING private report ledger for Drive HTML receipts.
-- No new table, schedule, public reader, Story writer or PDF storage mutation.
alter table public.blue_desk_automated_reports
 add column if not exists file_format text not null default 'pdf',
 add column if not exists html_drive_id text,
 add column if not exists html_category text,
 add column if not exists edition_key text not null default 'default';

alter table public.blue_desk_automated_reports
 drop constraint if exists blue_desk_automated_reports_file_format_check,
 drop constraint if exists blue_desk_automated_reports_html_drive_id_check,
 drop constraint if exists blue_desk_automated_reports_html_category_check,
 drop constraint if exists blue_desk_automated_reports_edition_key_check;
alter table public.blue_desk_automated_reports
 add constraint blue_desk_automated_reports_file_format_check
  check(file_format in ('pdf','html')),
 add constraint blue_desk_automated_reports_html_drive_id_check
  check(html_drive_id is null or html_drive_id ~ '^[a-zA-Z0-9_-]{20,100}$'),
 add constraint blue_desk_automated_reports_html_category_check
  check(html_category is null or html_category in ('market','angles','creators','audits')),
 add constraint blue_desk_automated_reports_edition_key_check
  check(edition_key ~ '^[a-z0-9][a-z0-9_-]{0,99}$');

alter table public.blue_desk_automated_reports
 drop constraint if exists blue_desk_automated_reports_report_kind_check;
alter table public.blue_desk_automated_reports
 add constraint blue_desk_automated_reports_report_kind_check check (
 report_kind in ('DAILY_MACRO','COTD_OB_RESEARCH','PRESENTER_PREP',
 'REGIME_DEEP_DIVE','RESEARCH_GAP_PACK','CREATOR_BATCH','SOURCE_AUDIT'));

-- Keep original PDF proof mandatory for all legacy PDF 'ready' records.
-- For HTML, require actual verified Drive file ID, exact category, ready timestamp
-- and source receipt count, but no PDF bytes in Vercel/Supabase.
alter table public.blue_desk_automated_reports
 drop constraint if exists completed_pdf_required;
alter table public.blue_desk_automated_reports
 add constraint completed_pdf_required check(
  status <> 'ready' or (
   ready_at is not null and char_length(summary)>40 and
   ((file_format='pdf' and pdf_path is not null and pdf_sha256 is not null
       and source_count>=2 and html_drive_id is null)
     or (file_format='html' and html_drive_id is not null and
       html_category is not null and source_count>=1
       and pdf_path is null and pdf_sha256 is null))
  )
 );

-- Preserve old uniqueness for default PDF editions, permit multiple creator
-- batches in the same slot/day by namespaced edition_key.
alter table public.blue_desk_automated_reports
 drop constraint if exists report_day_slot_kind_unique;
alter table public.blue_desk_automated_reports
 add constraint report_day_slot_kind_unique
 unique(report_day,slot,report_kind,edition_key);
create index if not exists blue_desk_html_editions_ready_idx
 on public.blue_desk_automated_reports(ready_at desc)
 where file_format='html' and status='ready';

-- Neither browser roles nor public Bluebelly may read/write the ledger directly.
alter table public.blue_desk_automated_reports enable row level security;
revoke all on public.blue_desk_automated_reports from anon,authenticated;
