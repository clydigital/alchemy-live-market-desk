import "server-only";
import {createSupabaseAdminClient} from "./supabase/admin.ts";
import {projectCreatorPerspectives,type CreatorInput} from "./bluebelly-article-perspectives.ts";

/**
 * A bounded read of archived public creator videos with existing transcript
 * summaries. This never exposes raw private intake records or transcripts and
 * does not upgrade a commentary claim into market Evidence.
 */
export async function getArticleCreatorPerspectives(topic:string,nowIso:string) {
 if(!topic.trim())return [];
 const now=Date.parse(nowIso);
 if(!Number.isFinite(now))return [];
 try {
  const {data,error}=await createSupabaseAdminClient()
   .from("research_intake_items")
   .select("publisher,title,url,published_at,transcript_status,video_analysis_status,recontextualized_summary,creator_logic")
   .eq("item_type","video")
   .in("publisher",["StockedUp","Wall Street Truthbombs","FX Evolution",
     "TraderNick","Traders Reality","Kevin Gerrity"])
   .eq("transcript_status","ready")
   .gte("published_at",new Date(now-14*86400000).toISOString())
   .lte("published_at",nowIso)
   .order("published_at",{ascending:false})
   .limit(75);
  if(error)return [];
  return projectCreatorPerspectives(topic,(data||[]) as CreatorInput[],nowIso);
 }catch{return [];}
}
