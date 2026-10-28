import { handleScheduledPostResearchDossier } from "@/lib/dossier-post-research-trigger";
import { acceptsResearchAuthorization } from "@/lib/research-auth";
import {isAutomaticReportFinalisationWindow,runAutomatedDailyPdfReport}
 from "@/lib/blue-desk-automated-report-job";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/** Reuse the existing evening cron and independent, dated source gate.
 * The canonical Dossier owns reasoning; this stage owns a personal PDF. */
export async function GET(request: Request) {
 const now=new Date();
 const authorised=Boolean(process.env.CRON_SECRET?.trim()) &&
   acceptsResearchAuthorization(request.headers.get("authorization"),[process.env.CRON_SECRET!]);
 const reportWindow=isAutomaticReportFinalisationWindow(now,"evening");
 const scheduleEnabled=process.env.NEXT_PUBLIC_RESEARCH_SCHEDULE_ENABLED==="true";
 const reportEligible=authorised && scheduleEnabled && reportWindow;
 // Status-only, no secrets, response bodies or private report contents.
 // A 0-row report table alone cannot distinguish a skipped gate from a failed
 // generator. This runs at the invocation boundary (not after slow Dossier).
 if(reportWindow){
  console.info(JSON.stringify({event:"bluebelly_pdf_cron_gate",slot:"evening",
   asOf:now.toISOString(),authorised,scheduleEnabled,reportEligible}));
 }
 const reportTask=reportEligible
  ?runAutomatedDailyPdfReport("evening",now).catch(()=>({status:"failed",reason:"daily_pdf_unavailable"}))
  :null;
 const result=await handleScheduledPostResearchDossier(request, "evening");
 if(!reportTask)return result;
 const report=await reportTask;
 console.info(JSON.stringify({event:"bluebelly_pdf_cron_outcome",slot:"evening",
  marketPdfStatus:report.status,
  marketPdfReason:("reason" in report?report.reason:null)||null}));
 if(result.status!==200)return result;
 let payload:Record<string,unknown>;
 try{payload=await result.clone().json() as Record<string,unknown>;}
 catch{return result;}
 return Response.json({...payload,automatedDailyPdf:report},{
   status:200,headers:{"Cache-Control":"private, no-store"}});
}
