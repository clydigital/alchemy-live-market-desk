-- Runtime support for the OpenAI-backed Alchemy intelligence worker.
-- Additive only: preserve the existing partial index while adding a full conflict target
-- that PostgREST can infer for idempotent source upserts.
create unique index if not exists intelligence_evidence_sources_provider_external_full_uidx
  on public.intelligence_evidence_sources(provider_key, external_source_id);

-- Keep the prompt registry operationally aligned with the GPT-5.6 runtime defaults.
update public.intelligence_prompt_versions
set model_hint = case
  when stage_key in ('market_belief', 'divergence', 'semantic_deduplication', 'lifecycle', 'normalizer', 'entity_extractor') then 'gpt-5.6-luna'
  when stage_key in ('hypothesis', 'challenger', 'scenario', 'story_synthesis', 'positioning_recommender') then 'gpt-5.6-terra'
  else model_hint
end
where is_active;
