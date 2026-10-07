begin;

create or replace view public.story_evidence_coverage as
with source_counts as (
  select
    link.story_id,
    count(distinct evidence.source_id)::integer as source_count,
    count(distinct evidence.source_id)
      filter (where source.source_tier = 1)::integer as tier1_source_count
  from public.intelligence_story_evidence link
  join public.intelligence_evidence evidence
    on evidence.id = link.evidence_id
  join public.intelligence_evidence_sources source
    on source.id = evidence.source_id
  group by link.story_id
),
evidence_counts as (
  select
    link.story_id,
    count(distinct link.evidence_id)::integer as evidence_count,
    count(distinct link.evidence_id)
      filter (where evidence.source_id is not null)::integer as linked_evidence_count,
    count(distinct link.evidence_id)
      filter (where link.evidence_role in ('contradicting', 'invalidation'))::integer as contradiction_count
  from public.intelligence_story_evidence link
  join public.intelligence_evidence evidence
    on evidence.id = link.evidence_id
  group by link.story_id
),
open_debt_counts as (
  select
    debt.story_id,
    count(*)::integer as open_debt_count
  from public.research_debt debt
  where debt.status = 'open'
    and debt.story_id is not null
  group by debt.story_id
),
unresolved_counts as (
  select
    story.id as story_id,
    (
      coalesce(debt.open_debt_count, 0)
      + case
          when version.snapshot -> 'reasoning' ->> 'contractVersion' = 'canonical-story-reasoning/v1'
            and jsonb_typeof(version.snapshot #> '{reasoning,nextTest}') = 'object'
            and nullif(btrim(version.snapshot #>> '{reasoning,nextTest,label}'), '') is not null
            then 1
          else 0
        end
    )::integer as unresolved_count
  from public.stories story
  left join public.story_thesis_versions version
    on version.id = story.current_thesis_version_id
  left join open_debt_counts debt
    on debt.story_id = story.id
),
chart_counts as (
  select
    request.story_id,
    count(*)::integer as chart_count
  from public.chart_requests request
  group by request.story_id
),
event_counts as (
  select
    event.story_id,
    count(*)::integer as update_count
  from public.story_events event
  group by event.story_id
),
coverage as (
  select
    story.id as story_id,
    story.slug,
    story.title,
    story.status,
    story.rank,
    coalesce(source_count.source_count, 0)::integer as source_count,
    coalesce(source_count.tier1_source_count, 0)::integer as tier1_source_count,
    coalesce(evidence_count.evidence_count, 0)::integer as evidence_count,
    coalesce(evidence_count.linked_evidence_count, 0)::integer as linked_evidence_count,
    coalesce(evidence_count.contradiction_count, 0)::integer as contradiction_count,
    coalesce(unresolved_count.unresolved_count, 0)::integer as unresolved_count,
    coalesce(chart_count.chart_count, 0)::integer as chart_count,
    coalesce(event_count.update_count, 0)::integer as update_count
  from public.stories story
  left join source_counts source_count
    on source_count.story_id = story.id
  left join evidence_counts evidence_count
    on evidence_count.story_id = story.id
  left join unresolved_counts unresolved_count
    on unresolved_count.story_id = story.id
  left join chart_counts chart_count
    on chart_count.story_id = story.id
  left join event_counts event_count
    on event_count.story_id = story.id
  where story.status <> all (array['archived'::text, 'retired'::text])
)
select
  story_id,
  slug,
  title,
  status,
  rank,
  source_count,
  tier1_source_count,
  evidence_count,
  linked_evidence_count,
  contradiction_count,
  unresolved_count,
  chart_count,
  update_count,
  (
    (source_count >= 3)::integer
    + (tier1_source_count >= 1)::integer
    + (evidence_count >= 6)::integer
    + (linked_evidence_count >= 4)::integer
    + (contradiction_count >= 1)::integer
    + (unresolved_count >= 1)::integer
    + (chart_count >= 2)::integer
    + (update_count >= 1)::integer
  ) as gate_score,
  case
    when source_count >= 3
      and tier1_source_count >= 1
      and evidence_count >= 6
      and linked_evidence_count >= 4
      and contradiction_count >= 1
      and unresolved_count >= 1
      and chart_count >= 2
      and update_count >= 1
      then 'ready'::text
    when (
      (source_count >= 3)::integer
      + (tier1_source_count >= 1)::integer
      + (evidence_count >= 6)::integer
      + (linked_evidence_count >= 4)::integer
      + (contradiction_count >= 1)::integer
      + (unresolved_count >= 1)::integer
      + (chart_count >= 2)::integer
      + (update_count >= 1)::integer
    ) >= 6
      then 'close'::text
    else 'thin'::text
  end as room_status
from coverage;

comment on view public.story_evidence_coverage is
  'Read-only Story evidence-room projection over canonical intelligence evidence links/sources, V1 next-test/open research debt, chart requests, and append-only Story events. Gate thresholds are unchanged from the legacy evidence-room contract.';

commit;
