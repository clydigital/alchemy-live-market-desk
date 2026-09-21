-- Repair historical creator Evidence that was canonicalised before archived Story
-- routing was restored. Explicit affected_topics slugs are authoritative in the
-- canonical recruitment contract, so this backfill mirrors that route exactly.
--
-- Inserting the missing links intentionally reuses the existing
-- intelligence_story_evidence_revaluate trigger. That creates one idempotent
-- reevaluation request per newly linked Story/Evidence pair; creator-only
-- evidence still cannot authorise a material Story mutation.

insert into public.intelligence_story_evidence (
  story_id,
  evidence_id,
  evidence_role,
  weight,
  rationale
)
select
  story.id,
  evidence.id,
  'context',
  100,
  'Backfilled from canonical creator Evidence affected_topics after archived Story routing repair.'
from public.intelligence_evidence evidence
cross join lateral unnest(coalesce(evidence.affected_topics, '{}'::text[])) as topic(slug)
join public.stories story
  on story.slug = topic.slug
where evidence.evidence_class = 'transcript'
  and evidence.structured_payload ->> 'evidenceNature' = 'creator_lead'
  and story.status = 'archived'
on conflict (story_id, evidence_id, evidence_role) do nothing;
