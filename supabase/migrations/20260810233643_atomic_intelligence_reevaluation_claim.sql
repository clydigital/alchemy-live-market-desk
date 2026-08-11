-- Claim one queued Story re-evaluation atomically so overlapping scheduled or
-- API workers do not select the same row or block one another.

create or replace function public.claim_intelligence_story_reevaluation(
  p_queue_id uuid default null
)
returns setof public.intelligence_reevaluation_queue
language sql
security invoker
set search_path = ''
as $$
  update public.intelligence_reevaluation_queue as queue
  set status = 'processing',
      started_at = now(),
      attempts = queue.attempts + 1,
      updated_at = now()
  where queue.id = (
    select pending.id
    from public.intelligence_reevaluation_queue as pending
    where pending.target_kind = 'story'
      and pending.status = 'pending'
      and pending.available_at <= now()
      and (p_queue_id is null or pending.id = p_queue_id)
    order by pending.priority desc, pending.created_at
    for update skip locked
    limit 1
  )
  returning queue.*;
$$;

revoke all on function public.claim_intelligence_story_reevaluation(uuid) from public, anon, authenticated;
grant execute on function public.claim_intelligence_story_reevaluation(uuid) to service_role;

comment on function public.claim_intelligence_story_reevaluation(uuid) is
  'Atomically claims one available Story lifecycle re-evaluation for a service-role worker.';
