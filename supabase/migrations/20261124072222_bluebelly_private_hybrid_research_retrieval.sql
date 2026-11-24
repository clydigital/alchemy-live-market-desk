create extension if not exists vector with schema extensions;
create table public.bb_research_vector_cache (
 lane text not null, record_id text not null, content_hash text not null,
 model text not null default 'gte-small-v1', embedding extensions.vector(384) not null,
 embedded_at timestamptz not null default now(),
 primary key(lane,record_id,model),
 constraint bb_vector_model check(model='gte-small-v1'),
 constraint bb_vector_nonzero check(extensions.vector_norm(embedding)>0)
);
alter table public.bb_research_vector_cache enable row level security;
revoke all on public.bb_research_vector_cache from public,anon,authenticated;
grant select,insert,update,delete on public.bb_research_vector_cache to service_role;
create index bb_research_vector_hnsw on public.bb_research_vector_cache using hnsw(embedding extensions.vector_cosine_ops);
create view public.bb_research_documents with (security_invoker=true) as
select 'evidence'::text lane,e.id::text record_id,e.evidence_class kind,
 coalesce(s.source_name,'canonical evidence') source_name,coalesce(e.provenance_urls[1],s.source_url) source_url,
 e.event_at event_at,e.published_at published_at,e.received_at available_at,
 e.support_direction status,s.ancestry_group_id::text ancestry_id,
 coalesce(e.claim_text,'') title,
 concat_ws(' ',e.claim_text,e.summary,array_to_string(e.affected_assets,' '),array_to_string(e.affected_topics,' ')) search_text,
 concat_ws(' ',e.claim_text,e.summary,array_to_string(e.affected_assets,' '),array_to_string(e.affected_topics,' ')) embedding_text
from public.intelligence_evidence e left join public.intelligence_evidence_sources s on s.id=e.source_id
union all
select case when i.item_type='video' then 'creator' else 'intake' end,i.id::text,i.item_type,i.publisher,i.url,
 null::timestamptz,i.published_at,i.created_at,case when i.item_type='video' then i.transcript_status else i.status end,
 null::text,i.title,concat_ws(' ',i.title,i.summary,i.creator_logic,i.recontextualized_summary,case when i.transcript_status='ready' then i.transcript_text end),
 concat_ws(' ',i.title,i.summary,i.creator_logic,i.recontextualized_summary)
from public.research_intake_items i
union all
select 'x_wire',x.post_id,'social_lead',x.handle,x.original_url,null::timestamptz,x.published_at,x.retrieved_at,
 case when x.original_verified then 'original_post_verified_not_claim' else 'unverified_lead' end,null::text,left(x.body,180),x.body,x.body
from public.x_wire_posts x
union all
select 'thesis',t.id::text,'historical_thesis','Bluebelly Story',null::text,t.effective_at,null::timestamptz,t.created_at,t.status,t.story_id::text,t.title,
 concat_ws(' ',t.title,t.thesis,t.market_question,t.dominant_narrative,t.best_explanation,t.strongest_support,t.strongest_contradiction,t.confirmation_trigger,t.invalidation_trigger),
 concat_ws(' ',t.title,t.thesis,t.best_explanation,t.strongest_support,t.strongest_contradiction,t.invalidation_trigger)
from public.story_thesis_versions t
union all
select 'motion',m.id::text,m.category,m.source_name,m.source_url,m.occurred_at,null::timestamptz,m.observed_at,m.verification_state,m.evidence_id::text,m.headline,
 concat_ws(' ',m.headline,m.what_happened,m.market_reaction,m.why_interesting,m.big_picture_bridge,m.next_test,array_to_string(m.tickers,' ')),
 concat_ws(' ',m.headline,m.what_happened,m.market_reaction,m.why_interesting,m.next_test,array_to_string(m.tickers,' '))
from public.market_motion_items m;
revoke all on public.bb_research_documents from public,anon,authenticated;
grant select on public.bb_research_documents to service_role;
create function public.bb_research_search(query_text text, lanes text[] default null, since_at timestamptz default null, as_of timestamptz default now(), match_count integer default 20, query_embedding extensions.vector(384) default null)
returns table(lane text,record_id text,kind text,source_name text,source_url text,event_at timestamptz,published_at timestamptz,available_at timestamptz,status text,ancestry_id text,title text,snippet text,lexical_rank bigint,semantic_rank bigint,fusion_score double precision)
language sql stable security invoker set search_path='' as $$
with params as (select websearch_to_tsquery('english',left(coalesce(query_text,''),500)) q,greatest(1,least(coalesce(match_count,20),50)) n),
eligible as not materialized (select d.* from public.bb_research_documents d where (lanes is null or d.lane=any(lanes)) and d.available_at<=as_of and (since_at is null or coalesce(d.event_at,d.published_at,d.available_at)>=since_at)),
kw0 as (select d.lane,d.record_id,ts_rank_cd(to_tsvector('english',coalesce(d.search_text,'')),p.q) score,d.available_at from eligible d cross join params p where numnode(p.q)>0 and to_tsvector('english',coalesce(d.search_text,''))@@p.q),
kw as (select k.lane,k.record_id,row_number() over(order by k.score desc,k.available_at desc,k.lane,k.record_id) r from kw0 k order by k.score desc,k.available_at desc,k.lane,k.record_id limit (select n*4 from params)),
sem0 as (select c.lane,c.record_id,c.embedding OPERATOR(extensions.<=>) query_embedding distance from public.bb_research_vector_cache c join eligible d on d.lane=c.lane and d.record_id=c.record_id and c.content_hash=md5(coalesce(d.embedding_text,'')) where query_embedding is not null and c.model='gte-small-v1' order by c.embedding OPERATOR(extensions.<=>) query_embedding limit (select n*4 from params)),
sem as (select s.lane,s.record_id,row_number() over(order by s.distance,s.lane,s.record_id) r from sem0 s where s.distance<=0.65),
fused as (select coalesce(k.lane,s.lane) lane,coalesce(k.record_id,s.record_id) record_id,k.r kr,s.r sr,coalesce(1.0/(50+k.r),0)+coalesce(1.0/(50+s.r),0) score from kw k full join sem s on k.lane=s.lane and k.record_id=s.record_id)
select d.lane,d.record_id,d.kind,d.source_name,d.source_url,d.event_at,d.published_at,d.available_at,d.status,d.ancestry_id,left(d.title,300),
 case when f.kr is not null then left(ts_headline('english',coalesce(d.search_text,''),p.q,'MaxWords=65, MinWords=20, MaxFragments=2, StartSel=[, StopSel=]'),1200) else left(d.embedding_text,1200) end,
 f.kr,f.sr,f.score::double precision from fused f join eligible d on d.lane=f.lane and d.record_id=f.record_id cross join params p
order by f.score desc,d.available_at desc,d.lane,d.record_id limit (select n from params);
$$;
revoke all on function public.bb_research_search(text,text[],timestamptz,timestamptz,integer,extensions.vector) from public,anon,authenticated;
grant execute on function public.bb_research_search(text,text[],timestamptz,timestamptz,integer,extensions.vector) to service_role;
create function public.bb_research_embedding_queue(batch_size integer default 10, lanes text[] default array['evidence','creator','thesis','motion']::text[])
returns table(lane text,record_id text,content_hash text,embedding_text text)
language sql stable security invoker set search_path='' as $$
select d.lane,d.record_id,md5(d.embedding_text),left(d.embedding_text,1600)
from public.bb_research_documents d left join public.bb_research_vector_cache c on c.lane=d.lane and c.record_id=d.record_id and c.model='gte-small-v1'
where d.lane=any(lanes) and length(coalesce(d.embedding_text,''))>=30 and (c.content_hash is distinct from md5(d.embedding_text))
order by d.available_at desc nulls last,d.lane,d.record_id limit greatest(1,least(coalesce(batch_size,10),50));
$$;
revoke all on function public.bb_research_embedding_queue(integer,text[]) from public,anon,authenticated;
grant execute on function public.bb_research_embedding_queue(integer,text[]) to service_role;
comment on view public.bb_research_documents is 'Private derived search projection only; source records remain canonical. Social and creator claims are not independently verified facts.';
comment on table public.bb_research_vector_cache is 'Disposable content-hash-keyed retrieval cache; no canonical claims or decisions.';

