-- Add a bounded, idempotent server-authored private daily HTML fallback.
-- The existing ChatGPT Work origin and immutable private reader remain intact.
-- No public RLS grants, canonical research changes, or new schedules.
alter table public.blue_desk_work_html_editions
 drop constraint if exists blue_desk_work_html_editions_delivery_type_check;
alter table public.blue_desk_work_html_editions
 add constraint blue_desk_work_html_editions_delivery_type_check
 check (delivery_type in ('CHATGPT_WORK','SCHEDULED_RESEARCH'));
create unique index if not exists blue_desk_work_html_one_scheduled_session
 on public.blue_desk_work_html_editions(owner_user_id,report_day)
 where delivery_type='SCHEDULED_RESEARCH';
