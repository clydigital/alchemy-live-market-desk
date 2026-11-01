import {handleScheduledResearchGapHandoff} from "@/lib/research-gap-cron";
import {runPrivateDailyHtmlFallback} from "@/lib/bluebelly-scheduled-daily-html-job";
import {isAutomaticReportFallbackWindow,type AutomaticReportSlot}
 from "@/lib/blue-desk-automated-report-contract";
import {attemptPrivateDailyPdfInExistingHandoff}
 from "@/lib/blue-desk-automated-report-late-handoff";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/** The existing Research Gap handoff and the private-PDF retry are independent.
 * Start each at the authorised invocation time; neither can convert a source
 * gap into fabricated evidence or alter canonical Dossier outcomes.
 * The PDF helper enforces its own CRON_SECRET, schedule flag and exact window. */
export async function GET(request:Request){
 const now=new Date();
 const slot:AutomaticReportSlot=now.getUTCHours()<12?"morning":"evening";
 const reportTask=process.env.BLUEBELLY_ENABLE_LEGACY_PDF==="true" && isAutomaticReportFallbackWindow(now,slot)
  ?attemptPrivateDailyPdfInExistingHandoff(request,slot,now).catch(()=>({
    status:"failed" as const,reason:"private_pdf_retry_unavailable"
   }))
  :null;
 const htmlTask=slot==="morning"&&now.getUTCHours()===3
  ?runPrivateDailyHtmlFallback(request,now).catch(()=>({status:"failed" as const,reason:"daily_html_fallback_unavailable"}))
  :null;
 // Start all independent private work concurrently. A slow/partial Research Gap result must not make
 // the PDF miss the same pre-existing Vercel cron window.
 const result=await handleScheduledResearchGapHandoff(request);
 const html=htmlTask?await htmlTask:null;
 if(!reportTask&&!html)return result;
 if(!reportTask){
  if(result.status!==200)return result;
  let payload:Record<string,unknown>;
  try{payload=await result.clone().json() as Record<string,unknown>;}
  catch{return result;}
  return Response.json({...payload,privateDailyHtml:html},{
   status:200,headers:{"Cache-Control":"private, no-store"}});
 }
 const report=await reportTask;
 if(result.status!==200)return result;
 let payload:Record<string,unknown>;
 try{payload=await result.clone().json() as Record<string,unknown>;}
 catch{return result;}
 // Even when the Research Gap status is partial, independent source-qualified
 // PDF attempts and their blocked/ready status remain visible on the private
 // cron response. Public or unauthorised callers never get an accessible PDF.
 console.info(JSON.stringify({
  event:"bluebelly_private_pdf_handoff_observed",slot,
  reportStatus:report.status,
  reportReason:("reason" in report?report.reason:null)||null,
 }));
 return Response.json({...payload,automatedDailyPdf:report,privateDailyHtml:html},{
  status:200,headers:{"Cache-Control":"private, no-store"}});
}
