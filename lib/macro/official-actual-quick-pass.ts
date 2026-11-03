import {acceptsResearchAuthorization} from "../research-auth.ts";
import {ingestOfficialMacroActuals} from "./official-actuals.ts";

type ActualIngestor=typeof ingestOfficialMacroActuals;
export type OfficialActualQuickPassDeps={
 ingest?:ActualIngestor;
 now?:()=>Date;
 cronSecret?:string;
 scheduleEnabled?:boolean;
 logger?:(message:string)=>void;
};
/** Thin, authenticated reuse of the SAME deterministic existing macro collector.
 * This does not write another ledger, create a Story or run a research model.
 * Every actual is written only by ingestOfficialMacroActuals' original source
 * and reference-period guards. Request inputs are not trusted as event IDs.
 */
export async function officialActualQuickPass(
 request:Request,deps:OfficialActualQuickPassDeps={},
):Promise<Response>{
 const secret=deps.cronSecret??process.env.CRON_SECRET;
 if(!secret?.trim()||!acceptsResearchAuthorization(request.headers.get("authorization"),[secret])){
  return Response.json({error:"unauthorized"},{status:401,headers:{"Cache-Control":"no-store"}});
 }
 if(!(deps.scheduleEnabled??process.env.NEXT_PUBLIC_RESEARCH_SCHEDULE_ENABLED==="true"))
  return Response.json({status:"disabled"},{status:503,headers:{"Cache-Control":"no-store"}});
 const now=(deps.now??(()=>new Date()))();
 if(!Number.isFinite(now.getTime()))return Response.json({status:"clock_unavailable"},{status:503});
 try{
  const outcome=await (deps.ingest??ingestOfficialMacroActuals)({now});
  const status=outcome.failed>0?"partial":outcome.completed>0?"completed":"no_due";
  const receipt={
   kind:"official_macro_actual_quick_pass",status,checkedAt:now.toISOString(),
   attempted:outcome.attempted,completed:outcome.completed,
   failed:outcome.failed,skipped:outcome.skipped,
   completedReleaseIds:outcome.completedReleaseIds,
   failedReleaseIds:outcome.failedReleaseIds,
   // Actuals and identifiers come from the existing source-checked collector.
   // Never return unreconciled metric estimates or publish public research here.
  };
  (deps.logger??console.info)(JSON.stringify(receipt));
  return Response.json(receipt,{
   // Retryable failure means a scheduled check did run, but the actual did not
   // qualify; surface this via logs/HTTP, not a green empty-result response.
   status:outcome.failed>0?502:200,
   headers:{"Cache-Control":"no-store"},
  });
 }catch(err){
  const errorCode=err instanceof Error&&/Could not seed official/.test(err.message)
   ?"schedule_seed_failed":"collector_unavailable";
  (deps.logger??console.warn)(JSON.stringify({
   event:"official_macro_actual_quick_pass_failed",
   checkedAt:now.toISOString(),errorCode,
  }));
  return Response.json({status:"collector_unavailable",errorCode},
   {status:503,headers:{"Cache-Control":"no-store"}});
 }
}
