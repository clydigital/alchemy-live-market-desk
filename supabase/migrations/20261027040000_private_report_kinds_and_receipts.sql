-- Presentation-only private PDF report kinds; original DAILY_MACRO editions remain intact.
-- No canonical Dossier/Story tables, schedules, accounts, or public publishing are changed.
alter table public.blue_desk_automated_reports
 add column if not exists report_kind text not null default 'DAILY_MACRO',
 add column if not exists source_receipts jsonb not null default '[]'::jsonb;

alter table public.blue_desk_automated_reports
 drop constraint if exists blue_desk_automated_reports_report_kind_check;
alter table public.blue_desk_automated_reports
 add constraint blue_desk_automated_reports_report_kind_check
 check(report_kind in ('DAILY_MACRO','COTD_OB_RESEARCH','PRESENTER_PREP','REGIME_DEEP_DIVE','RESEARCH_GAP_PACK'));
alter table public.blue_desk_automated_reports
 drop constraint if exists blue_desk_automated_reports_source_receipts_check;
alter table public.blue_desk_automated_reports
 add constraint blue_desk_automated_reports_source_receipts_check
 check(jsonb_typeof(source_receipts)='array' and jsonb_array_length(source_receipts)<=25);
alter table public.blue_desk_automated_reports
 drop constraint if exists blue_desk_automated_reports_pdf_path_check;
alter table public.blue_desk_automated_reports
 add constraint blue_desk_automated_reports_pdf_path_check check (
 pdf_path is null or
 pdf_path ~ '^automated-daily/[0-9]{4}-[0-9]{2}-[0-9]{2}/(morning|evening)/[0-9a-f-]{36}[.]pdf$' or
 pdf_path ~ '^private-packs/(editorial-slate|presenter-prep|regime-deep-dive|research-gap)/[0-9]{4}-[0-9]{2}-[0-9]{2}/(morning|evening)/[0-9a-f-]{36}[.]pdf$'
);
alter table public.blue_desk_automated_reports
 drop constraint if exists report_slot_unique;
alter table public.blue_desk_automated_reports
 drop constraint if exists report_day_slot_kind_unique;
alter table public.blue_desk_automated_reports
 add constraint report_day_slot_kind_unique unique(report_day,slot,report_kind);
create index if not exists blue_desk_private_pdfs_kind_ready_idx
 on public.blue_desk_automated_reports(report_kind,ready_at desc) where status='ready';
-- Fail closed, including column grants: never expose private research source receipts.
alter table public.blue_desk_automated_reports enable row level security;
drop policy if exists blue_desk_automated_reports_public_read on public.blue_desk_automated_reports;
revoke all privileges on table public.blue_desk_automated_reports from anon,authenticated;
revoke all privileges (report_kind,source_receipts) on public.blue_desk_automated_reports from anon,authenticated;
