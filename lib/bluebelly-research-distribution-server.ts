import "server-only";
import {createSupabaseAdminClient} from "./supabase/admin.ts";
import type {CreatorDigest} from "./bluebelly-creator-signals.ts";
import {routeResearchDistribution,type DistributionRow} from "./bluebelly-research-distribution.ts";

/** Only call after the existing owner allowlist guard. Bounded independent read:
 * an unavailable routing lane must not block the other daily packet lanes. */
export async function getOwnerResearchDistribution(digest:CreatorDigest|null,now=new Date()){
 try{
  const cutoff=new Date(now.getTime()-48*3600000).toISOString();
  const {data,error}=await createSupabaseAdminClient().from("research_intake_items")
   .select("id,publisher,external_id,title,url,published_at,updated_at,transcript_interpreted_at,transcript_status,video_review_status,summary,recontextualized_summary,affected_story_slugs,transcript_metadata,transcript_evidence_id")
   .eq("item_type","video").in("status",["accepted","published"])
   .gte("updated_at",cutoff).lte("updated_at",now.toISOString())
   .order("updated_at",{ascending:false}).limit(101);
  if(error)throw error;
  const rows=(data??[]) as DistributionRow[];
  return {status:"AVAILABLE" as const,...routeResearchDistribution(rows.slice(0,100),digest,now,rows.length>100)};
 }catch{
  return {status:"UNAVAILABLE" as const,...routeResearchDistribution([],digest,now),coverage:"UNAVAILABLE" as const};
 }
}
