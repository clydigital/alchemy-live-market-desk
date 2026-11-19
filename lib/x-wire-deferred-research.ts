import "server-only";
import {createSupabaseAdminClient} from "./supabase/admin.ts";
import {X_CORE_ROSTER,isExcludedXWireHandle} from "./x-sweep-core.ts";
import type {XWireDurable} from "./x-wire-durable.ts";
import {readXWireResearchPool} from "./x-wire-research-pool.ts";
import {X_ANALYST_HANDLES} from "./x-wire-source-policy.ts";

/** Bounded opportunity to rescue older relevant *unverified* leads.
 * A deferred row is only queued for independent research; it is not
 * "reviewed", source verified or admitted into a canonical market thesis.
 * The previous research-intake URLs prevent repeated handoff every run. */
export async function getPreviouslyHandedXWireUrls():Promise<Set<string>>{
 const db=createSupabaseAdminClient();
 const {data,error}=await db.from("research_intake_items").select("url")
  .ilike("publisher","X/@%").order("created_at",{ascending:false}).limit(1000);
 if(error)throw Error("X Wire prior handoff unavailable");
 return new Set((data||[]).map(p=>p.url).filter(Boolean));
}
export async function getDeferredXWireResearchPosts(now=new Date(),priorUrls?:Set<string>):Promise<XWireDurable["posts"]>{
 try {
  const db=createSupabaseAdminClient();
  const oldest=new Date(now.getTime()-7*24*60*60_000).toISOString();
  const [backlog,prior,analysts]=await Promise.all([
   readXWireResearchPool(db,now,"deferred"),
   priorUrls?Promise.resolve(priorUrls):getPreviouslyHandedXWireUrls(),
   db.from("x_wire_posts").select("post_id,handle,original_url,published_at,retrieved_at,body,media_urls,quote_url,intake_status")
    .eq("intake_status","discovery").gte("published_at",oldest)
    .lt("published_at",new Date(now.getTime()-48*3600000).toISOString())
    .in("handle",X_CORE_ROSTER.filter(x=>X_ANALYST_HANDLES.has(x.handle.toLowerCase())).map(x=>x.handle))
    .order("published_at",{ascending:false}).limit(100),
  ]);
  if(analysts.error){
   console.warn(JSON.stringify({event:"x_wire_deferred_read_unavailable"}));
   return [];
  }
  const roster=new Set(X_CORE_ROSTER.map(x=>x.handle.toLowerCase()));
  return [...backlog,...(analysts.data||[])]
    .filter(p=>roster.has(p.handle.toLowerCase())&&!isExcludedXWireHandle(p.handle)&&
      !prior.has(p.original_url))
    .map(p=>({
      id:p.post_id,handle:p.handle,url:p.original_url,
      publishedAt:p.published_at,text:p.body,
      images:Array.isArray(p.media_urls)?p.media_urls:[],quoteUrl:p.quote_url,
      attribution:"THIRD_PARTY_ONLY" as const,intakeStatus:"deferred",
    }));
 }catch {
  console.warn(JSON.stringify({event:"x_wire_deferred_read_unavailable"}));
  return [];
 }
}

