import "server-only";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {selectEventSocialContext,type CapturedSocialLead} from "./bluebelly-event-social";

/**
 * Automatic public social-context read from an EXISTING scheduled research
 * intake. No new X crawler, cron, or public database permission.
 * The whitelist and topic/time gates are applied after the bounded query.
 */
export async function getEventSocialContext(eventId:string,eventAt:string,now=new Date()){
 const stamp=Date.parse(eventAt);
 if(!Number.isFinite(stamp)||!Number.isFinite(+now)||+now<stamp)return [];
 const start=new Date(stamp-36*3600000).toISOString();
 const end=new Date(Math.min(+now,stamp+12*3600000)).toISOString();
 const {data,error}=await createSupabaseAdminClient().from("research_intake_items")
  .select("publisher,title,url,published_at,status,item_type,source_quality")
  .eq("status","accepted").eq("item_type","news")
  .eq("source_quality",35).like("publisher","X/@%")
  .gte("published_at",start).lte("published_at",end)
  .order("published_at",{ascending:false}).limit(120);
 if(error)throw new Error("Source-labelled social context read unavailable");
 return selectEventSocialContext((data||[]) as CapturedSocialLead[],eventId,eventAt,now,2);
}
