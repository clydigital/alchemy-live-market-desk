-- Persistent Market Theme taxonomy and Story-state extension.
-- This is additive: stories, immutable thesis versions and the existing
-- intelligence runtime remain the sole canonical reasoning path.

alter table public.intelligence_story_states
  add column if not exists momentum text not null default 'unknown'
    check (momentum in ('accelerating','stable','decelerating','reversing','unknown')),
  add column if not exists source_verification_state text not null default 'unverified'
    check (source_verification_state in ('unverified','discovery_only','partially_corroborated','corroborated')),
  add column if not exists source_verification_score numeric(5,2) not null default 0
    check (source_verification_score between 0 and 100),
  add column if not exists last_material_update_at timestamptz;

create table if not exists public.intelligence_story_theme_links (
  story_id uuid not null references public.stories(id) on delete cascade,
  theme_id uuid not null references public.intelligence_themes(id) on delete cascade,
  assignment_origin text not null default 'deterministic_runtime'
    check (assignment_origin in ('seed','deterministic_runtime','reasoning','manual')),
  confidence numeric(5,2) not null default 50 check (confidence between 0 and 100),
  assigned_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (story_id, theme_id)
);
alter table public.intelligence_story_theme_links enable row level security;
create index if not exists intelligence_story_theme_links_theme_idx
  on public.intelligence_story_theme_links(theme_id, story_id);

-- Parent categories are navigation only; leaf themes carry Story assignments.
with taxonomy(theme_key,name,description,parent_key) as (
  values
    ('macro-regime','Macro Regime','Policy, sovereign balance-sheet, inflation and liquidity regime. ',null),
    ('rates-monetary-policy','Rates & Monetary Policy','Policy rates, reaction functions and curve transmission.','macro-regime'),
    ('fiscal-sovereign-risk','Fiscal/Sovereign Risk','Debt supply, fiscal sustainability and term-premium risk.','macro-regime'),
    ('inflation-commodities','Inflation & Commodities','Inflation dynamics and commodity-price transmission.','macro-regime'),
    ('global-liquidity','Global Liquidity','Funding conditions, balance sheets and cross-border liquidity.','macro-regime'),
    ('financial-system','Financial System','Credit creation, housing, banking and market plumbing.',null),
    ('credit-leverage','Credit & Leverage','Credit conditions, leverage and refinancing risk.','financial-system'),
    ('housing','Housing','Housing finance and rate transmission.','financial-system'),
    ('banking-financial-plumbing','Banking/Financial Plumbing','Deposits, funding, settlement and financial-system resilience.','financial-system'),
    ('market-structure-positioning','Market Structure/Positioning','Positioning, liquidity and market microstructure.','financial-system'),
    ('real-assets-monetary-alternatives','Real Assets & Monetary Alternatives','Real assets and alternatives to fiat monetary exposure.',null),
    ('gold','Gold','Gold as a real asset and monetary alternative.','real-assets-monetary-alternatives'),
    ('bitcoin','Bitcoin','Bitcoin as a monetary alternative and risk asset.','real-assets-monetary-alternatives'),
    ('commodities','Commodities','Broad commodity cycle and physical-market transmission.','real-assets-monetary-alternatives'),
    ('energy','Energy','Oil, gas and energy-security transmission.','real-assets-monetary-alternatives'),
    ('geopolitics','Geopolitics','Security, trade and strategic-resource risks.',null),
    ('war-security','War/Security','Conflict and security-risk transmission.','geopolitics'),
    ('trade-sanctions','Trade/Sanctions','Trade policy, sanctions and export controls.','geopolitics'),
    ('multipolarity-de-dollarisation','Multipolarity/De-dollarisation','Reserve diversification and monetary-order changes.','geopolitics'),
    ('strategic-resources','Strategic Resources','Critical resources and supply security.','geopolitics'),
    ('technology-capex','Technology & Capex','AI investment, infrastructure and economics.',null),
    ('ai-demand','AI Demand','Demand for AI products and services.','technology-capex'),
    ('ai-infrastructure','AI Infrastructure','Compute, data-centre, power and network build-out.','technology-capex'),
    ('ai-financing','AI Financing','Funding, leverage and cash-flow support for AI capex.','technology-capex'),
    ('ai-economics','AI Economics','Returns, monetisation and cash conversion.','technology-capex'),
    ('structural-risks','Structural Risks','Slow-moving vulnerabilities and tail-risk indicators.',null),
    ('demographics','Demographics','Population, ageing and labour-force structure.','structural-risks'),
    ('political-institutional-risk','Political/Institutional Risk','Institutional capacity, legitimacy and policy risk.','structural-risks'),
    ('supply-chain-vulnerability','Supply-Chain Vulnerability','Chokepoints, dependencies and supply resilience.','structural-risks'),
    ('contrarian-tail-risk-signals','Contrarian/Tail-Risk Signals','Crowding, fragility and non-consensus risk indicators.','structural-risks')
), inserted as (
  insert into public.intelligence_themes(theme_key,name,description,status,metadata)
  select theme_key,name,description,'active',jsonb_build_object('taxonomyVersion','market-theme-taxonomy/v1') from taxonomy
  on conflict(theme_key) do update set name=excluded.name, description=excluded.description, updated_at=now()
  returning id,theme_key
)
update public.intelligence_themes child
set parent_theme_id=parent.id, updated_at=now()
from taxonomy, public.intelligence_themes parent
where child.theme_key=taxonomy.theme_key and parent.theme_key=taxonomy.parent_key;

-- Discovery policy is durable metadata on the canonical source record. It is
-- enforced in the application before fact/mutation promotion; it does not
-- delete or hide discovery leads from analyst review.
update public.intelligence_evidence_sources
set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('verificationRole','discovery_only'),
    updated_at=now()
where lower(source_name) like '%zerohedge%'
   or lower(coalesce(source_url,'')) like '%zerohedge%';

-- ZeroHedge Reads is a discovery ecosystem, not only the zerohedge.com domain.
-- Keep every requested member available for lead generation while preventing it
-- from independently proving a canonical fact or Story mutation.
update public.intelligence_evidence_sources
set metadata = coalesce(metadata,'{}'::jsonb) || jsonb_build_object('verificationRole','discovery_only'),
    updated_at=now()
where lower(coalesce(source_name,'')) ~ '(alt[- ]?market|antiwar|bitcoin[ ]*magazine|bombthrower|bullionstar|capitalist[ ]*exploits|christophe[ ]*barraud|dollar[ ]*collapse|dr\.?[ ]*housing[ ]*bubble|financial[ ]*revolutionist|forex[ ]*live|forum[ ]*geopolitica|gains[ ]*pains|gefira|gmg[ ]*research|gold[ ]*core|implode[- ]?explode|insider[ ]*paper|libertarian[ ]*institute|liberty[ ]*blitzkrieg|max[ ]*keiser|mises[ ]*institute|mish[ ]*talk|monetary[ ]*metals)'
   or lower(coalesce(source_url,'')) ~ '(alt-market\.us|antiwar\.com|bitcoinmagazine\.com|bombthrower\.com|bullionstar|capitalistexploits|christophe-barraud|dollarcollapse|doctorhousingbubble|financialrevolutionist|forexlive|forumgeopolitica|gainspains|gefira|gmgresearch|goldcore|implode-explode|insiderpaper|libertarianinstitute|libertyblitzkrieg|maxkeiser|mises\.org|mishtalk|monetary-metals)';

-- Seed the requested priority questions as explicitly unverified, non-public
-- monitoring hypotheses. These contain no evidence links and cannot be treated
-- as canonical facts or publication-ready Stories until the normal engine adds
-- corroborated evidence and a versioned recalibration.
with seed(slug,title,thesis,assets,theme_keys) as (
 values
 ('iran-oil-inflation-rates','Iran → oil → inflation → rates','A disruption-related oil shock could raise inflation pressure and constrain rate-cut expectations; this is a monitored transmission hypothesis, not a confirmed outcome.',array['BRENT','WTI','US02Y','US10Y','XAUUSD'],array['war-security','energy','inflation-commodities','rates-monetary-policy']),
 ('sovereign-term-premium-stress','Sovereign and term-premium stress','Higher term premium could tighten financial conditions independently of policy rates; confirm the drivers before attributing a move to fiscal risk.',array['US10Y','US30Y','DXY'],array['fiscal-sovereign-risk','rates-monetary-policy','market-structure-positioning']),
 ('fed-hold-versus-hikes','Fed hold versus hikes','The balance between holding policy steady and renewed tightening depends on verified inflation, labour and financial-condition evidence.',array['US02Y','DXY','SPX'],array['rates-monetary-policy','inflation-commodities']),
 ('gold-bitcoin-monetary-alternatives','Gold and Bitcoin monetary alternatives','Gold and Bitcoin may respond differently to confidence in money, liquidity and real yields; the relationship remains a monitored hypothesis.',array['XAUUSD','BTCUSD','DXY'],array['gold','bitcoin','global-liquidity','multipolarity-de-dollarisation']),
 ('ai-financing-stress','AI financing stress','AI capex could face funding and cash-conversion pressure if financing conditions tighten; company and funding evidence is required.',array['NVDA','SOXX','IG','HY'],array['ai-financing','ai-economics','credit-leverage']),
 ('housing-rates-transmission','Housing and rates transmission','Higher or persistent mortgage rates could transmit restrictive conditions into housing activity; track verified housing and lending data.',array['US10Y','XHB','VNQ'],array['housing','rates-monetary-policy','credit-leverage']),
 ('japan-jgb-yen','Japan, JGBs and yen','Changes in Japanese yields or the yen could alter global duration and carry dynamics; distinguish observed flows from narrative.',array['USDJPY','JXY','US10Y'],array['rates-monetary-policy','market-structure-positioning','global-liquidity']),
 ('geopolitical-commodity-security-premium','Geopolitical commodity-security premium','Security risks could add a commodity-risk premium; require physical-market and official corroboration for any causal claim.',array['BRENT','WTI','XAUUSD'],array['war-security','energy','commodities','strategic-resources']),
 ('foreign-demand-de-dollarisation','Foreign demand and de-dollarisation','Reserve diversification or weaker foreign demand for sovereign debt could affect funding and term premium; monitor primary flow and reserve data.',array['US10Y','US30Y','DXY'],array['multipolarity-de-dollarisation','fiscal-sovereign-risk','global-liquidity']),
 ('credit-cracks','Credit cracks','Credit deterioration could expose leverage and refinancing vulnerabilities; monitor spreads, defaults and bank funding rather than headlines alone.',array['HY','IG','XLF'],array['credit-leverage','banking-financial-plumbing','contrarian-tail-risk-signals']),
 ('fiscal-dominance','Fiscal dominance','Fiscal financing needs could constrain perceived policy independence or term-premium dynamics; this remains a testable hypothesis, not an asserted regime.',array['US10Y','US30Y','XAUUSD'],array['fiscal-sovereign-risk','rates-monetary-policy','political-institutional-risk'])
), inserted as (
 insert into public.stories(slug,title,thesis,status,confidence,assets,created_by,source_quality,novelty,persistence,trader_relevance,article_potential,article_verdict,updated_at)
 select slug,title,thesis,'develop',25,assets,'market_theme_seed',0,0,80,60,0,'theme_seed_unverified',now() from seed
 on conflict(slug) do nothing
 returning id,slug,title,thesis,status,confidence,assets
), events as (
 insert into public.story_events(story_id,event_type,headline,detail,event_at,metadata)
 select id,'thesis_revision','Unverified Market Theme seed recorded','Seeded monitoring hypothesis. No canonical evidence or fact claim is attached.',now(),jsonb_build_object('origin','market_theme_taxonomy_seed','verificationState','unverified') from inserted
 returning id,story_id
), versions as (
 insert into public.story_thesis_versions(story_id,event_id,version_number,title,thesis,status,confidence,assets,snapshot,change_reason,effective_at)
 select inserted.id,events.id,1,inserted.title,inserted.thesis,inserted.status,inserted.confidence,inserted.assets,jsonb_build_object('origin','market_theme_taxonomy_seed','verificationState','unverified'),'original_story_created',now()
 from inserted join events on events.story_id=inserted.id
 returning id,story_id
), pointer as (
 update public.stories story set current_thesis_version_id=versions.id
 from versions where story.id=versions.story_id returning story.id,story.slug
), states as (
 insert into public.intelligence_story_states(story_id,lifecycle_status,publication_eligible,qualification_score,affected_assets,source_verification_state,source_verification_score,momentum,last_material_update_at,last_evaluated_at)
 select pointer.id,'developing',false,0,seed.assets,'unverified',0,'unknown',now(),now() from pointer join seed on seed.slug=pointer.slug
 on conflict(story_id) do nothing returning story_id
)
insert into public.intelligence_story_theme_links(story_id,theme_id,assignment_origin,confidence)
select pointer.id,theme.id,'seed',100
from pointer join seed on seed.slug=pointer.slug
join public.intelligence_themes theme on theme.theme_key=any(seed.theme_keys)
on conflict(story_id,theme_id) do nothing;