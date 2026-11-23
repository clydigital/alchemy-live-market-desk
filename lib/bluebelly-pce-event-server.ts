import "server-only";
import {createSupabaseAdminClient} from "./supabase/admin";
import {projectOctoberPceReadout,OCTOBER_PCE_AT,OCTOBER_PCE_PERIOD} from "./bluebelly-pce-event-readout.ts";

/** Public, read-only projection from the established macro release tables.
 * Never fetch owner-specific signals, creator transcripts or portfolio rows.
 */
export async function getOctoberPceEventReadout(now=new Date()){
 try{
  const db=createSupabaseAdminClient();
  const releases=await db.from("macro_releases")
   .select("id,release_name,reference_period,agency,release_date,status,source_url,source_classification,actual,released_at,actual_retrieved_at,ingestion_attempt_status")
   .eq("release_name","Personal Income and Outlays")
   .eq("reference_period",OCTOBER_PCE_PERIOD)
   .order("release_date",{ascending:false}).limit(5);
  if(releases.error)return projectOctoberPceReadout(null,null,now,true);
  const matching=(releases.data??[]).filter(row=>Date.parse(row.release_date??"")===Date.parse(OCTOBER_PCE_AT));
  if(matching.length>1)return projectOctoberPceReadout(
   {...matching[0],status:"source_conflict"},null,now);
  const release=matching[0]??null;
  if(!release)return projectOctoberPceReadout(null,[],now);
  const metrics=await db.from("macro_release_metrics")
   .select("metric_key,actual,consensus,consensus_source,consensus_captured_at,previous,revised_previous,source_url,retrieved_at,metadata")
   .eq("release_id",release.id).limit(12);
  if(metrics.error)return projectOctoberPceReadout(release,null,now,true);
  return projectOctoberPceReadout(release,metrics.data??[],now);
 }catch{return projectOctoberPceReadout(null,null,now,true);}
}
