import "server-only";
import {createSupabaseAdminClient} from "./supabase/admin.ts";
import {getLatestEditorialSlate} from "./editorial-slate-server.ts";
import {computeMaterialEditorialRecall,type RecallCandidate,type RecallSource} from "./bluebelly-material-editorial-recall.ts";

export async function getOwnerMaterialRecall(now=new Date()):Promise<{
 status:"available"|"partial"|"unavailable";candidates:RecallCandidate[];
 editorialDate:string|null;sourceCounts:{reported:number;creator:number};
}>{
 try{
  const db=createSupabaseAdminClient();
  const from=new Date(now.getTime()-72*3_600_000).toISOString();
  const [news,motion,slateRead]=await Promise.all([
   db.from("research_intake_items")
    .select("item_key,item_type,title,url,published_at,source_quality,materiality,publisher")
    .eq("item_type","news").gte("published_at",from)
    .lte("published_at",now.toISOString())
    .gte("materiality",68).order("published_at",{ascending:false}).limit(180),
   db.from("current_market_motion_items")
    .select("headline,source_url,occurred_at,materiality,source_kind,verification_state")
    .eq("source_kind","creator").gte("occurred_at",from)
    .gte("materiality",72).order("occurred_at",{ascending:false}).limit(80),
   getLatestEditorialSlate(),
  ]);
  if(news.error||motion.error)throw new Error("Material event read unavailable");
  const sources:RecallSource[]=[
   ...(news.data||[]).map(x=>({title:x.title,url:x.url,
    publishedAt:x.published_at,itemKey:x.item_key,
    sourceQuality:x.source_quality,materiality:x.materiality,publisher:x.publisher,
    sourceKind:"reported"})),
   ...(motion.data||[]).filter(x=>x.verification_state==="LEAD").map(x=>({
    title:x.headline,url:x.source_url,publishedAt:x.occurred_at,
    materiality:x.materiality,sourceKind:"creator",
   })),
  ];
  const s=slateRead.slate;
  const candidates=computeMaterialEditorialRecall(sources,s?{
   dayMyt:s.dayMyt,producedAt:s.producedAt,ideas:s.ideas,notes:s.notes
  }:null,now,12);
  return {status:slateRead.status==="available"?"available":"partial",candidates,
   editorialDate:s?.dayMyt||null,
   sourceCounts:{reported:news.data?.length||0,creator:motion.data?.length||0}};
 }catch{return {status:"unavailable",candidates:[],editorialDate:null,
  sourceCounts:{reported:0,creator:0}};}
}
