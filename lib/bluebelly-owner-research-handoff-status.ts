import "server-only";
import {createSupabaseAdminClient} from "./supabase/admin.ts";

export type OwnerResearchHandoffStatus={
 lastRunAt:string|null;lastRunStatus:string|null;lastRunPublications:number;
 pendingReview:number;publishedBriefs:number;lastReasonedAt:string|null;
};
/** Private owner-only overview. Never used on the public Bluebelly origin.
 * Reads independently verified database receipts, not live-model or Notion guesses.
 */
export async function getOwnerResearchHandoffStatus():Promise<OwnerResearchHandoffStatus|null>{
 try{
  const db=createSupabaseAdminClient();
  const [runs,pending,published,reasoning]=await Promise.all([
   db.from("research_runs").select("completed_at,status,updates_published")
    .in("schedule_slot",["morning","evening"]).order("started_at",{ascending:false}).limit(1),
   db.from("blue_desk_macropulse_briefs").select("id",{head:true,count:"exact"}).eq("status","review"),
   db.from("blue_desk_macropulse_briefs").select("id",{head:true,count:"exact"}).eq("status","published"),
   db.from("intelligence_engine_runs").select("completed_at").eq("status","completed")
    .order("completed_at",{ascending:false}).limit(1),
  ]);
  if(runs.error||pending.error||published.error||reasoning.error)return null;
  const run=runs.data?.[0],engine=reasoning.data?.[0];
  return {
   lastRunAt:run?.completed_at||null,
   lastRunStatus:run?.status||null,
   lastRunPublications:Number(run?.updates_published)||0,
   pendingReview:pending.count??0,
   publishedBriefs:published.count??0,
   lastReasonedAt:engine?.completed_at||null,
  };
 }catch{return null;}
}
