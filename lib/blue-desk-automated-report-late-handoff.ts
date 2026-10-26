import "server-only";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {acceptsResearchAuthorization} from "@/lib/research-auth";
import {isAutomaticReportFallbackWindow,isCompletedDossierForAutomaticReport,
 type AutomaticReportSlot} from "@/lib/blue-desk-automated-report-contract";
import {runAutomatedDailyPdfReport} from "@/lib/blue-desk-automated-report-job";

/** Called only from the already-scheduled, authorised Research Gap handoff.
 * A late Dossier can finish after the earlier PDF window; the handoff slot
 * supplies a final idempotent retry without another cron or research run. */
export async function attemptPrivateDailyPdfAfterLateDossier(
 request:Request,slot:AutomaticReportSlot,now=new Date(),
){
 if(!process.env.CRON_SECRET?.trim()
  ||!acceptsResearchAuthorization(request.headers.get("authorization"),[process.env.CRON_SECRET]))
  return {status:"unauthorized" as const};
 if(!isAutomaticReportFallbackWindow(now,slot))
  return {status:"locked" as const,reason:"outside_existing_handoff_window"};
 const db=createSupabaseAdminClient();
 const from=new Date(now.getTime()-5*3600_000).toISOString();
 const {data:run,error:runError}=await db.from("research_runs")
  .select("id,schedule_slot,scheduled_for,completed_at,status")
  .eq("schedule_slot",slot).eq("status","completed")
  .gte("scheduled_for",from).lte("scheduled_for",now.toISOString())
  .order("scheduled_for",{ascending:false}).limit(1).maybeSingle();
 if(runError)return {status:"deferred" as const,reason:"canonical_research_unavailable"};
 if(!run)return {status:"deferred" as const,reason:"no_completed_research_slot"};
 const {data:checkpoint,error:checkpointError}=await db.from("research_slot_runs")
  .select("research_run_id,slot_key,status,health_state,live_publication_status,hybrid_handoff_status,stage_summary")
  .eq("research_run_id",run.id).eq("slot_key",slot).maybeSingle();
 if(checkpointError)return {status:"deferred" as const,reason:"dossier_checkpoint_unavailable"};
 if(!isCompletedDossierForAutomaticReport(run,checkpoint,slot,now))
  return {status:"deferred" as const,reason:"canonical_dossier_not_finalised"};
 return runAutomatedDailyPdfReport(slot,now);
}
