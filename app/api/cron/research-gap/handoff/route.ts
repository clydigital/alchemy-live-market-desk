import {handleScheduledResearchGapHandoff} from "@/lib/research-gap-cron";
import {isAutomaticReportFallbackWindow,type AutomaticReportSlot}
 from "@/lib/blue-desk-automated-report-contract";
import {attemptPrivateDailyPdfAfterLateDossier}
 from "@/lib/blue-desk-automated-report-late-handoff";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=300;

/** Preserve the Research Gap handoff's canonical response. Only the existing
 * authorised 03:30/03:45, 15:30/15:45 UTC invocations can retry a completed
 * private PDF after a finalised Dossier; a PDF failure cannot undo research. */
export async function GET(request:Request){
 const result=await handleScheduledResearchGapHandoff(request);
 const now=new Date();
 const slot:AutomaticReportSlot=now.getUTCHours()<12?"morning":"evening";
 if(result.status!==200||!isAutomaticReportFallbackWindow(now,slot))return result;
 let payload:Record<string,unknown>;
 try{payload=await result.clone().json() as Record<string,unknown>;}
 catch{return result;}
 if(payload.status!=="completed")return result;
 try{
  const report=await attemptPrivateDailyPdfAfterLateDossier(request,slot,now);
  return Response.json({...payload,automatedDailyPdf:report},{
   status:200,headers:{"Cache-Control":"private, no-store"}});
 }catch{
  return Response.json({...payload,automatedDailyPdf:{status:"failed",reason:"private_pdf_retry_unavailable"}},{
   status:200,headers:{"Cache-Control":"private, no-store"}});
 }
}
