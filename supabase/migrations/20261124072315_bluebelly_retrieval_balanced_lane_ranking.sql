create or replace function public.bb_research_search(query_text text, lanes text[] default null, since_at timestamptz default null, as_of timestamptz default now(), match_count integer default 20, query_embedding extensions.vector(384) default null)
returns table(lane text,record_id text,kind text,source_name text,source_url text,event_at timestamptz,published_at timestamptz,available_at timestamptz,status text,ancestry_id text,title text,snippet text,lexical_rank bigint,semantic_rank bigint,fusion_score double precision)
language sql stable security invoker set search_path='' as $$
with params as (select websearch_to_tsquery('english',left(coalesce(query_text,''),500)) q,greatest(1,least(coalesce(match_count,20),50)) n),
eligible as not materialized (select d.* from public.bb_research_documents d where (lanes is null or d.lane=any(lanes)) and d.available_at<=as_of and (since_at is null or coalesce(d.event_at,d.published_at,d.available_at)>=since_at)),
kw0 as (select d.lane,d.record_id,(
  4.0*ts_rank_cd(to_tsvector('english',coalesce(d.title,'')),p.q,32)
  +2.0*ts_rank_cd(to_tsvector('english',coalesce(d.embedding_text,'')),p.q,34)
  +0.5*ts_rank_cd(to_tsvector('english',coalesce(d.search_text,'')),p.q,34)
  )*(0.55+0.45*exp(-greatest(0,extract(epoch from (as_of-coalesce(d.event_at,d.published_at,d.available_at)))/86400)/21)) score,
  d.available_at from eligible d cross join params p where numnode(p.q)>0 and to_tsvector('english',coalesce(d.search_text,''))@@p.q),
kw1 as (select k.lane,k.record_id,row_number() over(partition by k.lane order by k.score desc,k.available_at desc,k.record_id) r from kw0 k),
kw as (select * from kw1 where r<=(select n*2 from params)),
sem0 as (select c.lane,c.record_id,c.embedding OPERATOR(extensions.<=>) query_embedding distance from public.bb_research_vector_cache c join eligible d on d.lane=c.lane and d.record_id=c.record_id and c.content_hash=md5(coalesce(d.embedding_text,'')) where query_embedding is not null and c.model='gte-small-v1'),
sem1 as (select s.lane,s.record_id,row_number() over(partition by s.lane order by s.distance,s.record_id) r from sem0 s where s.distance<=0.65),
sem as (select * from sem1 where r<=(select n*2 from params)),
fused as (select coalesce(k.lane,s.lane) lane,coalesce(k.record_id,s.record_id) record_id,k.r kr,s.r sr,coalesce(1.0/(50+k.r),0)+coalesce(1.0/(50+s.r),0) score from kw k full join sem s on k.lane=s.lane and k.record_id=s.record_id),
ranked as (select f.*,row_number() over(partition by f.lane order by f.score desc,f.record_id) lane_rank from fused f),
selected as (select r.* from ranked r join eligible d on d.lane=r.lane and d.record_id=r.record_id order by r.lane_rank,r.score desc,d.available_at desc,r.lane,r.record_id limit (select n from params))
select d.lane,d.record_id,d.kind,d.source_name,d.source_url,d.event_at,d.published_at,d.available_at,d.status,d.ancestry_id,left(d.title,300),
 case when f.kr is not null then left(ts_headline('english',coalesce(d.search_text,''),p.q,'MaxWords=65, MinWords=20, MaxFragments=2, StartSel=[, StopSel=]'),1200) else left(d.embedding_text,1200) end,
 f.kr,f.sr,f.score::double precision from selected f join eligible d on d.lane=f.lane and d.record_id=f.record_id cross join params p
order by f.lane_rank,f.score desc,d.available_at desc,d.lane,d.record_id;
$$;
