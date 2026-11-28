import "server-only";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import type {RadarResearchLead} from "./bluebelly-home-radar-intelligence";

/** Owner-gated caller only. Read the existing accepted news ledger; never
 * verify or publish the report, mutate a Story, or invoke a provider. */
export async function getRadarResearchLeads(now:Date):Promise<RadarResearchLead[]>{
 const db=createSupabaseAdminClient();
 const {data,error}=await db.from("research_intake_items")
  .select("id,publisher,title,summary,url,published_at,source_quality,relevance,materiality,candidate_score")
  .eq("item_type","news").eq("status","accepted")
  // Issuer result receipt uses retrieval time, not exact publication time.
  .not("item_key","like","issuer-press:%")
  .gte("published_at",new Date(+now-86400000).toISOString()).lte("published_at",now.toISOString())
  .gte("source_quality",64).gte("candidate_score",72).gte("relevance",70).gte("materiality",64)
  .order("candidate_score",{ascending:false}).order("published_at",{ascending:false}).limit(24);
 if(error)throw Error("Private radar intake read unavailable");
 return (data??[]).flatMap(row=>{
  if(!row.id||!row.title||!row.publisher||!row.url||!row.published_at)return [];
  if(/^X\/@/i.test(row.publisher))return [];
  return [{id:String(row.id),publisher:row.publisher,title:row.title,summary:row.summary??"",url:row.url,publishedAt:row.published_at,score:Number(row.candidate_score)}];
 });
}
