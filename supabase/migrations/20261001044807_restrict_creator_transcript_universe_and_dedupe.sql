begin;

create unique index if not exists research_intake_items_video_external_id_uq
  on public.research_intake_items (external_id)
  where item_type = 'video' and external_id is not null;

update public.research_intake_items
set transcript_job_status = 'blocked',
    transcript_next_attempt_at = null,
    transcript_job_last_error = 'Creator is outside the fixed creator-intelligence universe.',
    updated_at = now()
where item_type = 'video'
  and publisher <> all (array[
    'StockedUp'::text,
    'Wall Street Truthbombs'::text,
    'FX Evolution'::text,
    'TraderNick'::text
  ])
  and transcript_status <> 'ready'
  and transcript_job_status in ('pending', 'retryable');

create or replace function public.claim_transcript_jobs(
  p_worker_id text,
  p_batch_size integer default 1,
  p_lease_seconds integer default 300
)
returns table (
  id uuid,
  run_id uuid,
  item_key text,
  external_id text,
  publisher text,
  title text,
  url text,
  published_at timestamptz,
  transcript_status text,
  transcript_text text,
  transcript_provider text,
  transcript_attempt_count integer,
  video_review_status text,
  transcript_job_status text,
  transcript_claim_token uuid,
  transcript_claimed_by text,
  transcript_claimed_at timestamptz,
  transcript_lease_expires_at timestamptz,
  transcript_job_attempt_count integer,
  transcript_interpreted_at timestamptz,
  transcript_evidence_id uuid
)
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if nullif(btrim(p_worker_id), '') is null then
    raise exception 'p_worker_id is required' using errcode = '22023';
  end if;

  return query
  with claimable as (
    select intake.id
    from public.research_intake_items intake
    where intake.item_type = 'video'
      and intake.publisher = any (array[
        'StockedUp'::text,
        'Wall Street Truthbombs'::text,
        'FX Evolution'::text,
        'TraderNick'::text
      ])
      and (
        (
          intake.transcript_job_status = 'pending'
          and (intake.transcript_next_attempt_at is null or intake.transcript_next_attempt_at <= now())
        )
        or (
          intake.transcript_job_status = 'retryable'
          and (intake.transcript_next_attempt_at is null or intake.transcript_next_attempt_at <= now())
        )
        or (
          intake.transcript_job_status = 'running'
          and intake.transcript_lease_expires_at <= now()
        )
        or (
          intake.transcript_job_status = 'blocked'
          and intake.status = 'blocked'
          and intake.transcript_status = 'missing'
          and intake.transcript_error_code is null
          and intake.transcript_attempt_count = 0
          and intake.video_review_status is null
          and intake.summary = 'New monitored creator video discovered; transcript collection and claim verification are pending.'
          and intake.external_id ~ '^[A-Za-z0-9_-]{11}$'
          and intake.url ~ '^https://(www\\.)?youtube\\.com/watch\\?v=[A-Za-z0-9_-]{11}([&#].*)?$'
        )
      )
    order by
      case when intake.transcript_job_status = 'running' then 0 else 1 end,
      intake.published_at desc,
      intake.id
    for update skip locked
    limit greatest(1, least(coalesce(p_batch_size, 1), 3))
  ), claimed as (
    update public.research_intake_items intake
    set transcript_job_status = 'running',
        transcript_claim_token = gen_random_uuid(),
        transcript_claimed_by = btrim(p_worker_id),
        transcript_claimed_at = now(),
        transcript_lease_expires_at = now() + make_interval(secs => greatest(60, least(coalesce(p_lease_seconds, 300), 900))),
        transcript_job_attempt_count = intake.transcript_job_attempt_count + 1,
        transcript_job_last_error = null,
        transcript_next_attempt_at = null,
        updated_at = now()
    from claimable
    where intake.id = claimable.id
    returning intake.*
  )
  select
    claimed.id,
    claimed.run_id,
    claimed.item_key,
    claimed.external_id,
    claimed.publisher,
    claimed.title,
    claimed.url,
    claimed.published_at,
    claimed.transcript_status,
    claimed.transcript_text,
    claimed.transcript_provider,
    claimed.transcript_attempt_count,
    claimed.video_review_status,
    claimed.transcript_job_status,
    claimed.transcript_claim_token,
    claimed.transcript_claimed_by,
    claimed.transcript_claimed_at,
    claimed.transcript_lease_expires_at,
    claimed.transcript_job_attempt_count,
    claimed.transcript_interpreted_at,
    claimed.transcript_evidence_id
  from claimed;
end;
$$;

revoke all on function public.claim_transcript_jobs(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.claim_transcript_jobs(text, integer, integer)
  to service_role;

comment on function public.claim_transcript_jobs(text, integer, integer) is
  'Claims transcript work only for the fixed four-creator intelligence universe, with leases and bounded retry state.';

commit;
