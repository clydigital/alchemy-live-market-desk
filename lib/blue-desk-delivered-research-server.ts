import "server-only";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import type {DeliveredMacroPulseBrief} from "./blue-desk-delivered-research";

/** Only call AFTER owner identity and allowlist checks. No public route imports this. */
export async function getOwnerDeliveredResearchBriefs(limit=4):Promise<DeliveredMacroPulseBrief[]>{
 const max=Math.min(Math.max(Math.floor(limit),1),6);
 const end=new Date(),start=new Date(end.getTime()-7*24*3600_000);
 const admin=createSupabaseAdminClient();
 const {data,error}=await admin.from("blue_desk_macropulse_briefs")
  .select("id,source_page_id,source_pulse_id,source_page_url,source_published_at,source_retrieved_at,headline,standfirst,what_changed,why_it_matters,countercase,watch_next,source_links,status,verification_label")
  .in("status",["review","published"])
  .gte("source_published_at",start.toISOString())
  .lte("source_published_at",end.toISOString())
  .order("source_published_at",{ascending:false})
  .order("received_at",{ascending:false})
  .limit(max);
 if(error)throw new Error("Private delivered research queue unavailable");
 return (data||[]) as DeliveredMacroPulseBrief[];
}
