import {handleScheduledResearchGapHandoff} from "@/lib/research-gap-cron";
import {isAutomaticReportFallbackWindow,type AutomaticReportSlot}
 from "@/lib/blue-desk-automated-report-contract";
import {attemptPrivateDailyPdfInExistingHandoff}
 from "@/lib/blue-desk-automated-report-late-handoff";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/** Existing authorised Research Gap cron is an independent private-PDF retry.
 * No new schedule or Dossier precondition. No effect on canonical outcomes. */
export async function GET(request:Request){
 const now=new Date();
 const result=await handleScheduledResearchGapHandoff(request);
 const slot:AutomaticReportSlot=now.getUTCHours()<12?"morning":"evening";
 if(result.status!==200||!isAutomaticReportFallbackWindow(now,slot))return result;
 let payload:Record<string,unknown>;
 try{payload=await result.clone().json() as Record<string,unknown>;}
 catch{return result;}
 if(payload.status!=="completed")return result;
 try{
  const report=await attemptPrivateDailyPdfInExistingHandoff(request,slot,now);
  return Response.json({...payload,automatedDailyPdf:report},{
   status:200,headers:{"Cache-Control":"private, no-store"}});
 }catch{
  return Response.json({...payload,automatedDailyPdf:{status:"failed",reason:"private_pdf_retry_unavailable"}},{
   status:200,headers:{"Cache-Control":"private, no-store"}});
 }
}
