import { handleScheduledPostResearchDossier } from "@/lib/dossier-post-research-trigger";
import { acceptsResearchAuthorization } from "@/lib/research-auth";
import {isAutomaticReportFinalisationWindow,runAutomatedDailyPdfReport}
 from "@/lib/blue-desk-automated-report-job";
import {runPrivateEditorialSlatePdf} from "@/lib/blue-desk-private-slate-job";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

/** Existing authenticated cron only. Run the two private, separately
 * source-gated PDF products concurrently with Dossier, not after it.
 * Neither may mutate a canonical Story or change Dossier's outcome. */
export async function GET(request: Request) {
 const now=new Date();
 const authorised=Boolean(process.env.CRON_SECRET?.trim()) &&
   acceptsResearchAuthorization(request.headers.get("authorization"),[process.env.CRON_SECRET!]);
 const reportEligible=authorised && process.env.NEXT_PUBLIC_RESEARCH_SCHEDULE_ENABLED==="true" &&
   isAutomaticReportFinalisationWindow(now,"morning");
 // Start after authorisation, at the invocation timestamp, so a long Dossier
 // run cannot cause the PDF's only existing schedule slot to disappear.
 const reports=reportEligible?Promise.all([
   runAutomatedDailyPdfReport("morning",now).catch(()=>({status:"failed",reason:"daily_pdf_unavailable"})),
   runPrivateEditorialSlatePdf(now).catch(()=>({status:"failed",reason:"slate_pdf_unavailable"})),
 ]):null;
 const result=await handleScheduledPostResearchDossier(request, "morning");
 if(!reports)return result;
 const [report,slatePdf]=await reports;
 if(result.status!==200)return result;
 let payload:Record<string,unknown>;
 try{payload=await result.clone().json() as Record<string,unknown>;}
 catch{return result;}
 // A deferred Dossier is not an evidence-quality judgement on an independently
 // sourced personal PDF. The bounded compiler still fails closed on missing data.
 return Response.json({...payload,automatedDailyPdf:report,privateEditorialSlatePdf:slatePdf},{
   status:200,headers:{"Cache-Control":"private, no-store"}});
}
