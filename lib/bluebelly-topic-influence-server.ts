import "server-only";
import {createSupabaseAdminClient} from "./supabase/admin.ts";
import {
 projectTopicInfluence,type InfluenceTopic,type TopicInfluenceRead,
 type CreatorInfluenceRow,type XInfluenceRow,
} from "./bluebelly-topic-influence.ts";

/**
 * Two bounded reads of existing ledgers, once per request. No provider polling,
 * no raw transcript output, no private health/notes and no evidence/Story writes.
 * An interpreted video is still commentary, even if its transcript was reviewed.
 */
export async function getTopicInfluences(topics:readonly InfluenceTopic[],now=new Date()):Promise<TopicInfluenceRead[]>{
 let db:ReturnType<typeof createSupabaseAdminClient>;
 try{db=createSupabaseAdminClient();}
 catch{return topics.map(topic=>projectTopicInfluence(topic,[],[],now,"UNAVAILABLE","UNAVAILABLE"));}
 const sinceX=new Date(now.getTime()-48*3600000).toISOString();
 const sinceCreator=new Date(now.getTime()-14*86400000).toISOString();
 const [posts,videos]=await Promise.allSettled([
  db.from("x_wire_posts")
   .select("post_id,handle,original_url,published_at,retrieved_at,body,intake_status")
   .eq("intake_status","discovery").gte("published_at",sinceX)
   .lte("published_at",now.toISOString())
   .order("published_at",{ascending:false}).limit(700),
  db.from("research_intake_items")
   .select("external_id,publisher,title,url,published_at,transcript_interpreted_at,transcript_status,video_review_status,recontextualized_summary,summary,claim_checks")
   .eq("item_type","video").eq("transcript_status","ready")
   .eq("video_review_status","reviewed").not("transcript_interpreted_at","is",null)
   .gte("published_at",sinceCreator).lte("published_at",now.toISOString())
   .order("published_at",{ascending:false}).limit(160),
 ]);
 const xOk=posts.status==="fulfilled"&&!posts.value.error;
 const creatorOk=videos.status==="fulfilled"&&!videos.value.error;
 return topics.map(topic=>projectTopicInfluence(topic,
  xOk?(posts.value.data||[]) as XInfluenceRow[]:[],
  creatorOk?(videos.value.data||[]) as CreatorInfluenceRow[]:[],
  now,xOk?"AVAILABLE":"UNAVAILABLE",creatorOk?"AVAILABLE":"UNAVAILABLE"));
}
export async function getTopicInfluence(topic:InfluenceTopic,now=new Date()):Promise<TopicInfluenceRead>{
 const [read]=await getTopicInfluences([topic],now);
 return read;
}
