begin;

alter table public.research_intake_items
  add column if not exists transcript_language text,
  add column if not exists transcript_segments jsonb not null default '[]'::jsonb,
  add column if not exists transcript_retrieved_at timestamptz,
  add column if not exists transcript_error_code text,
  add column if not exists transcript_error_message text,
  add column if not exists transcript_http_status integer,
  add column if not exists transcript_retryable boolean,
  add column if not exists transcript_attempted_at timestamptz,
  add column if not exists transcript_attempt_count integer not null default 0,
  add column if not exists transcript_duration_seconds integer,
  add column if not exists transcript_metadata jsonb not null default '{}'::jsonb;

update public.research_intake_items
set transcript_retrieved_at = coalesce(transcript_retrieved_at, updated_at, created_at),
    transcript_attempt_count = greatest(transcript_attempt_count, 1)
where transcript_status = 'ready'
  and transcript_text is not null;

alter table public.research_intake_items
  drop constraint if exists research_intake_items_transcript_provider_check;

alter table public.research_intake_items
  add constraint research_intake_items_transcript_provider_check
  check (
    transcript_provider is null
    or transcript_provider = any (
      array['transcriptapi'::text, 'youtubetotranscript.com'::text, 'official'::text, 'other'::text]
    )
  ),
  add constraint research_intake_items_transcript_segments_check
  check (jsonb_typeof(transcript_segments) = 'array'),
  add constraint research_intake_items_transcript_metadata_check
  check (jsonb_typeof(transcript_metadata) = 'object'),
  add constraint research_intake_items_transcript_http_status_check
  check (transcript_http_status is null or transcript_http_status between 100 and 599),
  add constraint research_intake_items_transcript_attempt_count_check
  check (transcript_attempt_count >= 0),
  add constraint research_intake_items_transcript_duration_seconds_check
  check (transcript_duration_seconds is null or transcript_duration_seconds >= 0),
  add constraint research_intake_items_transcript_error_code_check
  check (
    transcript_error_code is null
    or transcript_error_code = any (
      array[
        'invalid_video_url'::text,
        'video_not_found'::text,
        'video_private'::text,
        'video_deleted'::text,
        'transcript_missing'::text,
        'language_unavailable'::text,
        'provider_auth_error'::text,
        'provider_payment_required'::text,
        'provider_rate_limit'::text,
        'provider_server_error'::text,
        'network_error'::text,
        'timeout'::text,
        'malformed_provider_response'::text,
        'unknown'::text
      ]
    )
  );

create index if not exists research_intake_items_ready_video_cache_idx
  on public.research_intake_items (external_id, transcript_retrieved_at desc)
  where item_type = 'video'
    and transcript_status = 'ready'
    and transcript_text is not null;

alter table public.research_schedule_slots
  drop constraint if exists research_schedule_slots_slot_key_check;

alter table public.research_schedule_slots
  add constraint research_schedule_slots_slot_key_check
  check (
    slot_key = any (
      array['video_midnight'::text, 'morning'::text, 'video_late_morning'::text, 'evening'::text]
    )
  );

insert into public.research_schedule_slots (
  slot_key,
  local_time,
  timezone,
  purpose,
  is_enabled,
  updated_at
)
values
  (
    'video_midnight',
    '00:40:00'::time,
    'Asia/Kuala_Lumpur',
    'Discover monitored creator uploads and persist TranscriptAPI transcripts before the morning desk run',
    true,
    now()
  ),
  (
    'video_late_morning',
    '11:30:00'::time,
    'Asia/Kuala_Lumpur',
    'Refresh monitored creator uploads and persist TranscriptAPI transcripts before the evening desk run',
    true,
    now()
  )
on conflict (slot_key) do update set
  local_time = excluded.local_time,
  timezone = excluded.timezone,
  purpose = excluded.purpose,
  is_enabled = excluded.is_enabled,
  updated_at = excluded.updated_at;

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
  jsonb_array_length(transcript_segments) as transcript_segment_count
from public.research_intake_items;

revoke all on public.research_intake_queue from anon, authenticated;
grant select on public.research_intake_queue to service_role;

comment on column public.research_intake_items.transcript_segments is
  'Canonical TranscriptAPI segments with startSeconds, durationSeconds, endSeconds, and text.';
comment on column public.research_intake_items.transcript_error_code is
  'Stable pipeline error taxonomy; provider text is preserved separately in transcript_error_message.';
comment on column public.research_intake_items.transcript_metadata is
  'Operational TranscriptAPI metadata; never contains the provider credential.';

commit;
