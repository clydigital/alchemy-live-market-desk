begin;

do $contract$
declare
  missing_columns text[];
  provider_check text;
  cache_index text;
  schedule_count integer;
  view_is_invoker boolean;
begin
  select array_agg(required.column_name order by required.column_name)
  into missing_columns
  from (
    values
      ('transcript_language'),
      ('transcript_segments'),
      ('transcript_retrieved_at'),
      ('transcript_error_code'),
      ('transcript_error_message'),
      ('transcript_http_status'),
      ('transcript_retryable'),
      ('transcript_attempted_at'),
      ('transcript_attempt_count'),
      ('transcript_duration_seconds'),
      ('transcript_metadata')
  ) as required(column_name)
  where not exists (
    select 1
    from information_schema.columns actual
    where actual.table_schema = 'public'
      and actual.table_name = 'research_intake_items'
      and actual.column_name = required.column_name
  );

  if missing_columns is not null then
    raise exception 'Missing TranscriptAPI persistence columns: %', missing_columns;
  end if;

  select pg_get_constraintdef(oid)
  into provider_check
  from pg_constraint
  where conrelid = 'public.research_intake_items'::regclass
    and conname = 'research_intake_items_transcript_provider_check';

  if provider_check is null or position('transcriptapi' in provider_check) = 0 then
    raise exception 'TranscriptAPI is not an allowed transcript_provider';
  end if;

  if provider_check is null or position('supadata' in provider_check) = 0 then
    raise exception 'Supadata is not an allowed transcript_provider';
  end if;

  select indexdef
  into cache_index
  from pg_indexes
  where schemaname = 'public'
    and indexname = 'research_intake_items_ready_video_cache_idx';

  if cache_index is null
    or position('transcript_status' in cache_index) = 0
    or position('ready' in cache_index) = 0 then
    raise exception 'Ready transcript cache index is missing or incomplete';
  end if;

  select count(*)
  into schedule_count
  from public.research_schedule_slots
  where (slot_key, local_time) in (
    ('video_midnight', '00:40:00'::time),
    ('video_late_morning', '11:30:00'::time)
  )
    and timezone = 'Asia/Kuala_Lumpur'
    and is_enabled;

  if schedule_count <> 2 then
    raise exception 'Expected two enabled Asia/Kuala_Lumpur video schedule slots, found %', schedule_count;
  end if;

  select coalesce(reloptions @> array['security_invoker=true'], false)
  into view_is_invoker
  from pg_class
  where oid = 'public.research_intake_queue'::regclass;

  if not view_is_invoker then
    raise exception 'research_intake_queue must remain security_invoker';
  end if;

  if has_table_privilege('anon', 'public.research_intake_queue', 'select')
    or has_table_privilege('authenticated', 'public.research_intake_queue', 'select') then
    raise exception 'research_intake_queue must remain private';
  end if;
end
$contract$;

rollback;
