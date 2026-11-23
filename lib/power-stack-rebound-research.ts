import "server-only";
import { createSupabaseAdminClient } from "./supabase/admin.ts";
import { isReboundCapitalArticleUrl } from "./rebound-capital-feed.ts";

export type ReboundCapitalResearchLead={title:string;url:string;publishedAt:string};
/** Private owner dashboard projection of already-persisted RSS leads. No new acquisition or publishing side effect. */
export async function getReboundCapitalResearchLeads(now=new Date()):Promise<ReboundCapitalResearchLead[]|null>{
 try{
  const db=createSupabaseAdminClient();
  const since=new Date(now.getTime()-30*86400000).toISOString();
  const {data,error}=await db.from("research_intake_items")
   .select("title,url,published_at,publisher,item_type")
   .eq("publisher","Rebound Capital").eq("item_type","news")
   .gte("published_at",since).lte("published_at",now.toISOString())
   .order("published_at",{ascending:false}).limit(20);
  if(error)return null;
  const seen=new Set<string>();
  return (data??[]).flatMap(row=>{
   if(typeof row.url!=="string"||!isReboundCapitalArticleUrl(row.url)||
      typeof row.title!=="string"||!row.title.trim()||
      typeof row.published_at!=="string"||!Number.isFinite(Date.parse(row.published_at)))return [];
   const url=new URL(row.url);for(const key of [...url.searchParams.keys()])if(/^(?:utm_.+|fbclid|gclid)$/i.test(key))url.searchParams.delete(key);
   url.hash="";const canonical=url.toString();
   if(seen.has(canonical))return [];
   seen.add(canonical);
   return [{title:row.title.slice(0,220),url:canonical,publishedAt:row.published_at}];
  }).slice(0,10);
 }catch{return null;}
}
