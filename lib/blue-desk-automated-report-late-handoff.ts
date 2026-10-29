import "server-only";
import {acceptsResearchAuthorization} from "@/lib/research-auth";
import {isAutomaticReportFallbackWindow,type AutomaticReportSlot}
 from "@/lib/blue-desk-automated-report-contract";
import {runAutomatedDailyPdfReport} from "@/lib/blue-desk-automated-report-job";
import {runPrivateEditorialSlatePdf} from "@/lib/blue-desk-private-slate-job";

/** Reuse the already-authorised late Research Gap handoff. The personal PDF
 * applies its OWN dated-source admission contract and idempotent claim:
 * this is not a Dossier judgement and cannot mutate canonical reasoning. */
export async function attemptPrivateDailyPdfInExistingHandoff(
 request:Request,slot:AutomaticReportSlot,now=new Date(),
){
 if(!process.env.CRON_SECRET?.trim()
  ||!acceptsResearchAuthorization(request.headers.get("authorization"),[process.env.CRON_SECRET]))
  return {status:"unauthorized" as const};
 if(process.env.NEXT_PUBLIC_RESEARCH_SCHEDULE_ENABLED!=="true")
  return {status:"locked" as const,reason:"research_schedule_disabled"};
 if(process.env.BLUEBELLY_ENABLE_LEGACY_PDF!=="true")
  return {status:"locked" as const,reason:"legacy_pdf_disabled"};
 if(!isAutomaticReportFallbackWindow(now,slot))
  return {status:"locked" as const,reason:"outside_existing_handoff_window"};
 // Keep product failures independent of one another and of Research Gap.
 const dailyTask=runAutomatedDailyPdfReport(slot,now).catch(()=>({
  status:"failed" as const,reason:"daily_pdf_unavailable"
 }));
 if(slot!=="morning")return dailyTask;
 const [daily,slatePdf]=await Promise.all([
  dailyTask,
  runPrivateEditorialSlatePdf(now).catch(()=>({
   status:"failed" as const,reason:"slate_pdf_unavailable"
  })),
 ]);
 return {...daily,privateEditorialSlatePdf:slatePdf};
}
