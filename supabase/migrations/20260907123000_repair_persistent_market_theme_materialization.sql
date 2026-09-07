-- Forward repair for the initial Market Theme taxonomy migration.
-- Data-modifying CTE writes are not visible through sibling table scans in the
-- same statement, so the initial seed transaction created rows but did not
-- materialise parent pointers, Story current-version pointers, Story states or
-- Story-theme links. Keep this migration idempotent and preserve immutable
-- Story history already written by the initial migration.

with taxonomy(theme_key,parent_key) as (
  values
    ('rates-monetary-policy','macro-regime'),
    ('fiscal-sovereign-risk','macro-regime'),
    ('inflation-commodities','macro-regime'),
    ('global-liquidity','macro-regime'),
    ('credit-leverage','financial-system'),
    ('housing','financial-system'),
    ('banking-financial-plumbing','financial-system'),
    ('market-structure-positioning','financial-system'),
    ('gold','real-assets-monetary-alternatives'),
    ('bitcoin','real-assets-monetary-alternatives'),
    ('commodities','real-assets-monetary-alternatives'),
    ('energy','real-assets-monetary-alternatives'),
    ('war-security','geopolitics'),
    ('trade-sanctions','geopolitics'),
    ('multipolarity-de-dollarisation','geopolitics'),
    ('strategic-resources','geopolitics'),
    ('ai-demand','technology-capex'),
    ('ai-infrastructure','technology-capex'),
    ('ai-financing','technology-capex'),
    ('ai-economics','technology-capex'),
    ('demographics','structural-risks'),
    ('political-institutional-risk','structural-risks'),
    ('supply-chain-vulnerability','structural-risks'),
    ('contrarian-tail-risk-signals','structural-risks')
)
update public.intelligence_themes child
set parent_theme_id=parent.id,
    updated_at=now()
from taxonomy
join public.intelligence_themes parent on parent.theme_key=taxonomy.parent_key
where child.theme_key=taxonomy.theme_key
  and child.parent_theme_id is distinct from parent.id;

-- The seed event and immutable version were already created successfully.
-- Point each seeded Story at that exact version without creating another
-- thesis version; current_thesis_version_id is not a thesis-bearing field in
-- the capture trigger.
update public.stories story
set current_thesis_version_id=version.id,
    updated_at=now()
from public.story_thesis_versions version
where story.id=version.story_id
  and story.article_verdict='theme_seed_unverified'
  and version.snapshot->>'origin'='market_theme_taxonomy_seed'
  and story.current_thesis_version_id is distinct from version.id;

insert into public.intelligence_story_states(
  story_id,lifecycle_status,publication_eligible,qualification_score,affected_assets,
  source_verification_state,source_verification_score,momentum,last_material_update_at,last_evaluated_at
)
select story.id,'developing',false,0,story.assets,'unverified',0,'unknown',now(),now()
from public.stories story
where story.article_verdict='theme_seed_unverified'
on conflict(story_id) do nothing;

with seed(slug,theme_keys) as (
  values
    ('iran-oil-inflation-rates',array['war-security','energy','inflation-commodities','rates-monetary-policy']),
    ('sovereign-term-premium-stress',array['fiscal-sovereign-risk','rates-monetary-policy','market-structure-positioning']),
    ('fed-hold-versus-hikes',array['rates-monetary-policy','inflation-commodities']),
    ('gold-bitcoin-monetary-alternatives',array['gold','bitcoin','global-liquidity','multipolarity-de-dollarisation']),
    ('ai-financing-stress',array['ai-financing','ai-economics','credit-leverage']),
    ('housing-rates-transmission',array['housing','rates-monetary-policy','credit-leverage']),
    ('japan-jgb-yen',array['rates-monetary-policy','market-structure-positioning','global-liquidity']),
    ('geopolitical-commodity-security-premium',array['war-security','energy','commodities','strategic-resources']),
    ('foreign-demand-de-dollarisation',array['multipolarity-de-dollarisation','fiscal-sovereign-risk','global-liquidity']),
    ('credit-cracks',array['credit-leverage','banking-financial-plumbing','contrarian-tail-risk-signals']),
    ('fiscal-dominance',array['fiscal-sovereign-risk','rates-monetary-policy','political-institutional-risk'])
)
insert into public.intelligence_story_theme_links(story_id,theme_id,assignment_origin,confidence)
select story.id,theme.id,'seed',100
from seed
join public.stories story on story.slug=seed.slug and story.article_verdict='theme_seed_unverified'
join public.intelligence_themes theme on theme.theme_key=any(seed.theme_keys)
on conflict(story_id,theme_id) do nothing;
