begin;

alter table public.research_intake_items
  add column if not exists transcript_job_status text not null default 'blocked',
  add column if not exists transcript_claim_token uuid,
  add column if not exists transcript_claimed_by text,
  add column if not exists transcript_claimed_at timestamptz,
  add column if not exists transcript_lease_expires_at timestamptz,
  add column if not exists transcript_job_attempt_count integer not null default 0,
  add column if not exists transcript_job_last_error text,
  add column if not exists transcript_next_attempt_at timestamptz,
  add column if not exists transcript_interpreted_at timestamptz,
  add column if not exists transcript_evidence_id uuid,
  add column if not exists transcript_job_completed_at timestamptz;

alter table public.research_intake_items
  drop constraint if exists research_intake_items_transcript_job_status_check,
  drop constraint if exists research_intake_items_transcript_job_attempt_count_check,
  drop constraint if exists research_intake_items_transcript_evidence_id_fkey;

alter table public.research_intake_items
  add constraint research_intake_items_transcript_job_status_check
  check (transcript_job_status = any (array[
    'pending'::text,
    'running'::text,
    'retryable'::text,
    'blocked'::text,
    'completed'::text,
    'failed'::text
  ])),
  add constraint research_intake_items_transcript_job_attempt_count_check
  check (transcript_job_attempt_count >= 0),
  add constraint research_intake_items_transcript_evidence_id_fkey
  foreign key (transcript_evidence_id)
  references public.intelligence_evidence(id)
  on delete set null;

create index if not exists research_intake_items_transcript_worker_claim_idx
  on public.research_intake_items (
    transcript_job_status,
    transcript_next_attempt_at,
    transcript_lease_expires_at,
    published_at
  )
  where item_type = 'video'
    and transcript_job_status in ('pending', 'running', 'retryable', 'blocked');

-- Claiming also performs the one-time application transition for the retained
-- queue-only placeholders created before this worker existed. The predicate is
-- intentionally narrow: a valid monitored creator video, the exact discovery
-- placeholder, no provider conclusion and no prior extraction attempt.
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
          and intake.publisher = any (array[
            'StockedUp'::text,
            'Wall Street Truthbombs'::text,
            'Traders Reality'::text,
            'Kevin Gerrity'::text,
            'ClearValue Tax'::text,
            'FX Evolution'::text
          ])
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

-- Worker claim churn is operational state, not new source material. Keep it
-- out of immutable provenance snapshots while transcript and interpretation
-- content remain versioned normally.
create or replace function public.research_intake_provenance_snapshot(
  p_item public.research_intake_items
)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select to_jsonb(p_item)
    - array[
        'created_at',
        'updated_at',
        'transcript_attempted_at',
        'transcript_attempt_count',
        'transcript_error_code',
        'transcript_error_message',
        'transcript_http_status',
        'transcript_retryable',
        'transcript_job_status',
        'transcript_claim_token',
        'transcript_claimed_by',
        'transcript_claimed_at',
        'transcript_lease_expires_at',
        'transcript_job_attempt_count',
        'transcript_job_last_error',
        'transcript_next_attempt_at',
        'transcript_interpreted_at',
        'transcript_evidence_id',
        'transcript_job_completed_at'
      ]::text[];
$$;

revoke all on function public.research_intake_provenance_snapshot(public.research_intake_items)
  from public, anon, authenticated;

create or replace view public.research_intake_queue
with (security_invoker = true)
as
select
  id,
  run_id,
  item_key,
  item_type,
  publisher,
  title,
  url,
  published_at,
  article_position,
  transcript_status,
  transcript_provider,
  video_review_status,
  case
    when transcript_text is null then 0
    else array_length(regexp_split_to_array(trim(transcript_text), '\\s+'), 1)
  end as transcript_word_count,
  summary,
  creator_logic,
  recontextualized_summary,
  terms_detected,
  jargon_research,
  claim_checks,
  expert_notes,
  affected_story_slugs,
  source_quality,
  relevance,
  novelty,
  materiality,
  freshness_score,
  candidate_score,
  recommended_action,
  status,
  stats_signal,
  news_signal,
  divergence_kind,
  divergence_note,
  evidence_links,
  review_reason,
  updated_at,
  transcript_language,
  transcript_retrieved_at,
  transcript_error_code,
  transcript_error_message,
  transcript_http_status,
  transcript_retryable,
  transcript_attempted_at,
  transcript_attempt_count,
  transcript_duration_seconds,
  transcript_metadata,
  jsonb_array_length(transcript_segments) as transcript_segment_count,
  transcript_job_status,
  transcript_claimed_by,
  transcript_claimed_at,
  transcript_lease_expires_at,
  transcript_job_attempt_count,
  transcript_job_last_error,
  transcript_next_attempt_at,
  transcript_interpreted_at,
  transcript_evidence_id,
  transcript_job_completed_at
from public.research_intake_items;

revoke all on public.research_intake_queue from anon, authenticated;
grant select on public.research_intake_queue to service_role;

comment on function public.claim_transcript_jobs(text, integer, integer) is
  'Atomically claims bounded transcript work with SKIP LOCKED, active leases and stale-lease recovery.';
comment on column public.research_intake_items.transcript_job_status is
  'Worker lifecycle state. pending means immediately claimable; blocked rows require an explicit normal transition or a narrowly recognised legacy placeholder.';

commit;
