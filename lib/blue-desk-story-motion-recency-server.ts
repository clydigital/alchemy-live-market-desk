import "server-only";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import type {StoryMotionRecency} from "./blue-desk-thesis-ledger";

/** Only the event date, verification state and exact Story UUID of Motion.
 * No private Motion headlines, source notes or hypotheses are disclosed.
 * Motion remains bounded context, never a canonical Story judgement. */
export async function getStoryMotionRecency(
  storyIds:readonly string[],now=new Date(),
):Promise<StoryMotionRecency[]>{
  const ids=[...new Set(storyIds)].filter(id=>/^[0-9a-f-]{36}$/i.test(id)).slice(0,38);
  if(!ids.length)return [];
  const {data,error}=await createSupabaseAdminClient()
    .from("current_market_motion_items")
    .select("primary_story_id,occurred_at,verification_state")
    .in("primary_story_id",ids)
    .lte("occurred_at",now.toISOString())
    .order("occurred_at",{ascending:false}).limit(1000);
  if(error)throw new Error("Story-linked Motion chronology unavailable");
  const seen=new Set<string>();
  return ((data||[]) as StoryMotionRecency[]).filter(item=>{
    if(!item.primary_story_id||seen.has(item.primary_story_id))return false;
    seen.add(item.primary_story_id);return true;
  });
}
