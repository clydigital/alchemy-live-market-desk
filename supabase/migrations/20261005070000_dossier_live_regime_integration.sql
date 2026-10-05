-- Dossier → Live Desk semantic integration.
-- Extends the existing Regime/Story taxonomy only; it does not create a
-- second reasoning path and it does not promote Dossier prose to evidence.

update public.market_regimes
set short_title='US Rate Regime',
    core_question='Can the US and global system absorb sovereign issuance and private capital demand without long yields, credit spreads and refinancing stress becoming self-reinforcing?',
    why_it_matters='Long-term yields and funding conditions transmit into mortgages, CRE, private credit, AI financing, equity valuations, currencies and the government''s own interest burden.',
    mechanism='Treasury / fiscal supply + inflation / oil + foreign allocation + private duration demand → term premium / long yields → mortgages + credit + project finance → refinancing / forced selling → earnings and policy response.',
    affected_markets=array['US02Y','US05Y','US10Y','US20Y','US30Y','DXY','USDJPY','JGB10Y','JGB30Y','BUND10Y','OAT10Y','GILT30Y','XAUUSD','IG','HY','CMBS','KRE','Housing'],
    updated_at=now()
where slug='global-cost-of-capital';

update public.market_regimes
set title='AI Capital Cycle & US–China Competition',
    short_title='AI Capital Cycle',
    core_question='Can AI revenue and utilisation compound fast enough to outrun financing, physical and control constraints while the US and China compete for strategic compute capacity?',
    why_it_matters='The AI cycle now links model economics to chips, power, debt, SPVs, private capital, regulation and the return earned on a rapidly expanding infrastructure base.',
    mechanism='AI demand → compute / power / capex → debt / SPVs / private capital → physical inflation → monetisation requirement → safety / regulatory constraint → utilisation / cash flow → credit quality / valuation.',
    affected_markets=array['NVDA','MU','AVGO','CRWV','ORCL','META','AMZN','GOOGL','MSFT','BABA','SMIC','CXMT','Semis','Cloud','Power','IG','HY'],
    updated_at=now()
where slug='us-china-ai';

with rows(regime_slug, subgroup_key, label, accent, why_it_matters, mechanism, ordinal) as (
  values
    ('global-cost-of-capital','treasury-fiscal','Treasury / Fiscal','purple','Borrowing needs matter through the clearing yield required to attract marginal domestic and foreign buyers.','Deficits / financing mix → Treasury supply → marginal-buyer absorption → term premium / funding pressure.',2),
    ('global-cost-of-capital','long-end','Long End / Term Premium','orange','The 10Y/30Y can stay restrictive even when the expected Fed path turns less hawkish.','Inflation + supply + real yields + term premium → 10Y/30Y → economy-wide cost of capital.',3),
    ('global-cost-of-capital','global-rates','Global Sovereign / Japan','green','JGB, OAT, gilt and global-duration moves can change repatriation, fragmentation and carry economics.','Global sovereign repricing → hedging / repatriation / fragmentation / carry → US duration and FX.',4),
    ('global-cost-of-capital','credit-financing','Credit / CRE / Private Credit','yellow','Credit shows when high yields stop being a valuation problem and become a refinancing, collateral or forced-selling problem.','Funding cost + spreads + collateral values → refinancing / non-accruals / redemptions → bank and private-credit stress → broad credit / equity risk.',5),
    ('us-china-ai','power','Power / Data Centres','yellow','Power, cooling, grid equipment and construction can become the physical limit to AI deployment.','Compute buildout → data centres → electricity / grid / equipment → project timing and physical inflation.',5),
    ('us-china-ai','financing','Financing / Monetisation','red','The buildout only works if revenue, utilisation and cash generation can outrun binding infrastructure costs and financing expense.','Capex + debt / leases + borrowing cost → utilisation / revenue → cash conversion / coverage → project pace and valuation.',6),
    ('us-china-ai','private-capital','Private AI Capital','gold','Companies staying private longer shifts early upside, liquidity risk and delayed price discovery into institutional private capital.','Late-stage funding → private valuation / tender liquidity → IPO timing → institutional marks → compute and hiring capacity.',7),
    ('us-china-ai','control-governance','AI Control / Governance','teal','Safety incidents, liability and regulation can slow deployment while long-lived infrastructure obligations remain outstanding.','Capability growth → control failure / liability → safety gating / regulation → deployment timing → utilisation and monetisation.',8),
    ('us-china-ai','policy','Export Controls / Industrial Policy','teal','Industrial policy can reshape access to chips, equipment and strategic inputs.','Export controls / subsidies → supply access → localisation → competitive position.',9)
)
insert into public.market_regime_subgroups(regime_id,subgroup_key,label,accent,why_it_matters,mechanism,ordinal)
select r.id,rows.subgroup_key,rows.label,rows.accent,rows.why_it_matters,rows.mechanism,rows.ordinal
from rows join public.market_regimes r on r.slug=rows.regime_slug
on conflict(regime_id,subgroup_key) do update set
  label=excluded.label,accent=excluded.accent,why_it_matters=excluded.why_it_matters,
  mechanism=excluded.mechanism,ordinal=excluded.ordinal,status='active',updated_at=now();

with seed(slug,title,thesis,assets,theme_keys) as (
 values
 ('ai-control-risk','AI control risk','Frontier-agent capability, security incidents, liability or regulation could slow AI deployment while long-lived infrastructure commitments remain outstanding; require verified incidents and policy actions before escalating the thesis.',array['NVDA','MSFT','GOOGL','META','AMZN','ORCL','CRWV','IG'],array['ai-economics','ai-financing','political-institutional-risk']),
 ('private-ai-capital','Private AI capital','AI companies staying private longer could concentrate valuation and liquidity risk in late-stage private capital and delay price discovery; track actual tender, secondary, funding-round and IPO evidence.',array['NVDA','MSFT','GOOGL','META','AMZN','IG'],array['ai-economics','ai-financing','market-structure-positioning']),
 ('global-credit-transmission','Global credit transmission','CRE, private-credit or project-finance stress could migrate into banks and broad corporate credit when refinancing, collateral, funding or redemption pressure creates forced balance-sheet adjustment.',array['IG','HY','KRE','XLF','CMBS'],array['credit-leverage','banking-financial-plumbing','contrarian-tail-risk-signals']),
 ('global-sovereign-stress','Global sovereign stress','Japan repatriation, European fragmentation or other sovereign repricing could alter global duration and FX demand; distinguish observed flow and spread evidence from narrative.',array['US10Y','US30Y','USDJPY','DXY','XAUUSD'],array['fiscal-sovereign-risk','global-liquidity','market-structure-positioning'])
), inserted as (
 insert into public.stories(slug,title,thesis,status,confidence,assets,created_by,source_quality,novelty,persistence,trader_relevance,article_potential,article_verdict,updated_at)
 select slug,title,thesis,'develop',25,assets,'alchemy_research_engine',0,0,80,60,0,'theme_seed_unverified',now() from seed
 on conflict(slug) do nothing
 returning id,slug,title,thesis,status,confidence,assets
), events as (
 insert into public.story_events(story_id,event_type,headline,detail,event_at,metadata)
 select id,'thesis_revision','Unverified dossier-derived Story seed recorded','Persistent identity only. No canonical evidence or fact claim is attached.',now(),jsonb_build_object('origin','dossier_live_integration_seed','verificationState','unverified') from inserted
 returning id,story_id
), versions as (
 insert into public.story_thesis_versions(story_id,event_id,version_number,title,thesis,status,confidence,assets,snapshot,change_reason,effective_at)
 select inserted.id,events.id,1,inserted.title,inserted.thesis,inserted.status,inserted.confidence,inserted.assets,jsonb_build_object('origin','dossier_live_integration_seed','verificationState','unverified'),'original_story_created',now()
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
