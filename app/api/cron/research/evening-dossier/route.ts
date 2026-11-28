import { manualOnlyDossierResponse } from "@/lib/dossier-manual-only";
import { withResearchEmbeddingRefresh } from "@/lib/bluebelly-research-embedding-refresh";
import { acceptsResearchAuthorization } from "@/lib/research-auth";
import { scheduledSourceOnlyEnabled } from "@/lib/bluebelly-source-only-research";
import {isAutomaticReportFinalisationWindow,runAutomatedDailyPdfReport}
 from "@/lib/blue-desk-automated-report-job";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/** Reuse the existing evening cron and independent, dated source gate.
 * Dossiers are manual-only; this stage retains the separately opt-in PDF. */
export async function GET(request: Request) {
 const now=new Date();
 const authorised=Boolean(process.env.CRON_SECRET?.trim()) &&
   acceptsResearchAuthorization(request.headers.get("authorization"),[process.env.CRON_SECRET!]);
 if(scheduledSourceOnlyEnabled(process.env)){
   if(!authorised)return Response.json({status:"unauthorized"},{status:401,headers:{"Cache-Control":"private, no-store"}});
   // Owner policy: the existing slots refresh derived search embeddings only.
   // No scheduled Dossier reasoning, persistence or Research Gap sync.
   return withResearchEmbeddingRefresh(Promise.resolve(manualOnlyDossierResponse(authorised,process.env.NEXT_PUBLIC_RESEARCH_SCHEDULE_ENABLED==="true")),now);
 }
 const reportWindow=isAutomaticReportFinalisationWindow(now,"evening");
 const scheduleEnabled=process.env.NEXT_PUBLIC_RESEARCH_SCHEDULE_ENABLED==="true";
 // No new PDF attempts by default; preserve existing PDFs and manual Dossiers.
 const reportEligible=authorised && scheduleEnabled && reportWindow
  && process.env.BLUEBELLY_ENABLE_LEGACY_PDF==="true";
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
 const result=manualOnlyDossierResponse(authorised,process.env.NEXT_PUBLIC_RESEARCH_SCHEDULE_ENABLED==="true");
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
