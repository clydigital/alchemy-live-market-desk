-- Supabase's safeupdate guard rejects unqualified UPDATE statements issued
-- through the RPC endpoint. release_date is NOT NULL, so this predicate keeps
-- the lifecycle calculation unchanged while making the write explicit.
create or replace function public.refresh_macro_release_lifecycle(
  p_now timestamptz default now(),
  p_ingestion_grace interval default interval '4 hours'
)
returns table (
  evaluated_count integer,
  scheduled_count integer,
  pre_release_count integer,
  released_pending_ingestion_count integer,
  completed_count integer,
  revision_detected_count integer,
  stale_error_count integer
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  update public.macro_releases release
  set
    status = case
      when nullif(btrim(release.actual), '') is not null and release.status = 'revision_detected'
        then 'revision_detected'
      when nullif(btrim(release.actual), '') is not null
        then 'completed'
      when release.release_date > p_now + interval '24 hours'
        then 'scheduled'
      when release.release_date > p_now
        then 'pre_release'
      when release.release_date >= p_now - p_ingestion_grace
        then 'released_pending_ingestion'
      else 'stale_error'
    end,
    released_at = case
      when nullif(btrim(release.actual), '') is not null
        then coalesce(release.released_at, release.published_at)
      else release.released_at
    end,
    ingestion_gap_reason = case
      when nullif(btrim(release.actual), '') is not null
        then null
      when release.release_date > p_now
        then null
      when release.release_date >= p_now - p_ingestion_grace
        then 'Official Actual is not yet available in the ingestion store after the scheduled release time.'
      else 'Official Actual remains unavailable beyond the post-release ingestion grace window.'
    end,
    lifecycle_evaluated_at = p_now,
    updated_at = case
      when release.status is distinct from case
        when nullif(btrim(release.actual), '') is not null and release.status = 'revision_detected' then 'revision_detected'
        when nullif(btrim(release.actual), '') is not null then 'completed'
        when release.release_date > p_now + interval '24 hours' then 'scheduled'
        when release.release_date > p_now then 'pre_release'
        when release.release_date >= p_now - p_ingestion_grace then 'released_pending_ingestion'
        else 'stale_error'
      end then p_now
      else release.updated_at
    end
  where release.release_date is not null;

  get diagnostics evaluated_count = row_count;

  select
    count(*) filter (where status = 'scheduled'),
    count(*) filter (where status = 'pre_release'),
    count(*) filter (where status = 'released_pending_ingestion'),
    count(*) filter (where status = 'completed'),
    count(*) filter (where status = 'revision_detected'),
    count(*) filter (where status = 'stale_error')
  into
    scheduled_count,
    pre_release_count,
    released_pending_ingestion_count,
    completed_count,
    revision_detected_count,
    stale_error_count
  from public.macro_releases;

  return next;
end;
$$;

revoke all on function public.refresh_macro_release_lifecycle(timestamptz, interval) from public, anon, authenticated;
grant execute on function public.refresh_macro_release_lifecycle(timestamptz, interval) to service_role;

