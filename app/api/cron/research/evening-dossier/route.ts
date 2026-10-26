import { handleScheduledPostResearchDossier } from "@/lib/dossier-post-research-trigger";
import {isAutomaticReportFinalisationWindow,runAutomatedDailyPdfReport}
 from "@/lib/blue-desk-automated-report-job";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/** Keep canonical Dossier outcome independent of an optional automatic PDF.
 * The existing final retry window runs a separate, bounded report stage.
 * No extra scheduled cron or ChatGPT task is introduced. */
export async function GET(request: Request) {
 const result=await handleScheduledPostResearchDossier(request, "evening");
 const now=new Date();
 if(result.status!==200||!isAutomaticReportFinalisationWindow(now,"evening"))return result;
 let payload:Record<string,unknown>;
 try{payload=await result.clone().json() as Record<string,unknown>;}
 catch{return result;}
 const ready=payload.status==="completed"||
  (payload.status==="deferred"&&payload.reason==="dossier_decision_recorded");
 if(!ready)return result;
 try{
  const report=await runAutomatedDailyPdfReport("evening",now);
  return Response.json({...payload,automatedDailyPdf:report},{
   status:200,headers:{"Cache-Control":"private, no-store"}});
 }catch{
  // Never falsify or roll back a finished canonical Dossier because an editorial
  // PDF model, source gate or storage dependency is unavailable.
  return Response.json({...payload,automatedDailyPdf:{status:"failed",reason:"unavailable"}},{
   status:200,headers:{"Cache-Control":"private, no-store"}});
 }
}
