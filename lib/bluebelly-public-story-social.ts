import "server-only";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {matchPublicStoryXPosts,type Topic,type Row} from "./bluebelly-story-social-match";

/** Same persisted public-post discovery ledger as /api/x-wire/discovery.
 * No new provider request, cron, evidence promotion, or privileged fields. */
export async function getPublicStoryXPosts(topics:readonly Topic[],now=new Date()){
 if(!topics.length)return {};
 const from=new Date(+now-48*3_600_000).toISOString();
 const {data,error}=await createSupabaseAdminClient().from("x_wire_posts")
  .select("post_id,handle,original_url,published_at,body,intake_status")
  .eq("intake_status","discovery").gte("published_at",from)
  .lte("published_at",now.toISOString())
  .order("published_at",{ascending:false}).limit(120);
 if(error)throw new Error("Dated X discovery read unavailable");
 return matchPublicStoryXPosts(topics,(data||[]) as Row[],now);
}
