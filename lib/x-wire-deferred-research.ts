import "server-only";
import {createSupabaseAdminClient} from "./supabase/admin.ts";
import {X_CORE_ROSTER,isExcludedXWireHandle} from "./x-sweep-core.ts";
import type {XWireDurable} from "./x-wire-durable.ts";

/** Bounded opportunity to rescue older relevant *unverified* leads.
 * A deferred row is only queued for independent research; it is not
 * "reviewed", source verified or admitted into a canonical market thesis.
 * The previous research-intake URLs prevent repeated handoff every run. */
export async function getDeferredXWireResearchPosts(now=new Date()):Promise<XWireDurable["posts"]>{
 try {
  const db=createSupabaseAdminClient();
  const oldest=new Date(now.getTime()-7*24*60*60_000).toISOString();
  const [backlog,previous]=await Promise.all([
   db.from("x_wire_posts")
    .select("post_id,handle,original_url,published_at,body,media_urls,quote_url")
    .eq("intake_status","deferred").gte("published_at",oldest)
    .order("published_at",{ascending:false}).limit(250),
   db.from("research_intake_items").select("url")
    .ilike("publisher","X/@%").order("created_at",{ascending:false}).limit(1000),
  ]);
  if(backlog.error||previous.error){
   console.warn(JSON.stringify({event:"x_wire_deferred_read_unavailable"}));
   return [];
  }
  const prior=new Set((previous.data||[]).map(p=>p.url).filter(Boolean));
  const roster=new Set(X_CORE_ROSTER.map(x=>x.handle.toLowerCase()));
  return (backlog.data||[])
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
