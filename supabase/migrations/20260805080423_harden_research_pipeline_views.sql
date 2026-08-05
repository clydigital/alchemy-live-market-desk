alter view public.research_run_status set (security_invoker = true);
alter view public.research_intake_queue set (security_invoker = true);
alter view public.research_focus_queue set (security_invoker = true);

revoke all on public.research_run_status from public, anon, authenticated, service_role;
revoke all on public.research_intake_queue from public, anon, authenticated, service_role;
revoke all on public.research_focus_queue from public, anon, authenticated, service_role;

grant select on public.research_run_status to service_role;
grant select on public.research_intake_queue to service_role;
grant select on public.research_focus_queue to service_role;
