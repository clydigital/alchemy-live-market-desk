import "server-only";
import {createHash} from "node:crypto";
import {GoogleGenAI} from "@google/genai";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {getCurrentVerifiedMarketMotion} from "@/lib/market-motion";
import {selectVerifiedNewsBriefs} from "@/lib/market-brief-news";
import {getOriginalPressNews} from "@/lib/blue-desk-original-press-news-server";
import {combineQualifiedNews} from "@/lib/blue-desk-qualified-news";
import {getPublicSourceObservations} from "@/lib/blue-desk-source-observations";
import {getMarketMonitor} from "@/lib/market-monitor-public";
import {getEconomicCalendar} from "@/lib/calendar";
import {getForwardEarningsEvents} from "@/lib/forward-earnings-sources";
import {buildPresenterCalendar} from "@/lib/presenter-calendar";
import {selectBlueDeskUpcoming} from "@/lib/blue-desk-calendar";
import {assembleAutomaticReportEvidence,buildAutomaticReportModelPrompt,
 parseAutomatedReportNarrative,reportEvidenceReady,isAutomaticReportFinalisationWindow,isAutomaticReportFallbackWindow,type AutomaticReportSlot}
 from "@/lib/blue-desk-automated-report-contract";
import {renderAutomatedReportPdf} from "@/lib/blue-desk-automated-report-pdf";

type ClaimResult={status:"ready"|"already_ready"|"locked"|"coverage_blocked"|"failed";id?:string;reason?:string};
const MYT_HOURS=8;
const yyyyMmDd=(now:Date)=>new Date(now.getTime()+MYT_HOURS*3600000).toISOString().slice(0,10);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Record a source-gate refusal, without creating a PDF or overwriting a
 * completed edition. The unique (report_day,slot) claim is the write fence.
 * Owner-only RLS makes this durable diagnostic invisible to public readers. */
async function noteWithheldEdition(
 db:ReturnType<typeof createSupabaseAdminClient>,reportDay:string,
 slot:AutomaticReportSlot,now:Date,sourceCount:number,coverageNote:string,code:string,
){
 const {error}=await db.from("blue_desk_automated_reports").insert({
  report_day:reportDay,slot,status:"blocked",created_at:now.toISOString(),
  source_count:Math.min(25,Math.max(0,sourceCount)),coverage_note:coverageNote,
  error_code:code,
 });
 // Never mutate a previous building/failed/ready edition when a new source
 // check is insufficient. A later healthy attempt can reclaim after 12 min.
 if(error&&error.code!=="23505")
  console.warn(JSON.stringify({event:"private_pdf_attempt_receipt_failed",slot,
   reason:"write_unavailable"}));
}

/** Pure cron window selector. The 2nd existing Dossier invocation runs this:
 * 02:40 UTC / 10:40 MYT, 15:20 UTC / 23:20 MYT. NO new cron entries. */
export {isAutomaticReportFinalisationWindow} from "@/lib/blue-desk-automated-report-contract";
export async function runAutomatedDailyPdfReport(
 slot:AutomaticReportSlot, now=new Date(),
):Promise<ClaimResult>{
 const db=createSupabaseAdminClient();
 const reportDay=yyyyMmDd(now);
 // Only exact scheduled slot writes are allowed, even if a cron path is manually hit.
 if(!isAutomaticReportFinalisationWindow(now,slot)&&!isAutomaticReportFallbackWindow(now,slot))
  return {status:"locked",reason:"outside_finalisation_window"};
 const [rawNews,press,observations,economic,earnings,market]=await Promise.all([
  getCurrentVerifiedMarketMotion({limit:24}).catch(()=>[]),
  getOriginalPressNews(now,12).catch(()=>[]),
  getPublicSourceObservations(now,12).catch(()=>[]),
  getEconomicCalendar().catch(()=>[]),
  getForwardEarningsEvents({now}).catch(()=>({
   events:[],coverage:"unavailable" as const,warning:"Earnings unavailable",
  })),
  getMarketMonitor().catch(()=>null),
 ]);
 const news=combineQualifiedNews(selectVerifiedNewsBriefs(rawNews,now,12),press,12);
 const calendar=buildPresenterCalendar(economic,earnings,now);
 const upcoming=selectBlueDeskUpcoming(calendar,now,14).slice(0,12);
 const evidence=assembleAutomaticReportEvidence({
  now,slot,news,observations,
  calendar:upcoming.map(e=>({
   title:e.title,when:e.scheduledAt||e.localDate||null,
   sourceName:e.sourceName,sourceUrl:e.sourceUrl||null,
   question:e.decidingQuestion||"What could change investors' expectations?",
  })),
  market:(market?.rows||[])
   .filter(r=>r.last!==null&&r.asOf&&r.frequency==="daily"
    &&["Rates","Major Index","Energy","Metal","FX","Credit / Risk"].includes(r.type))
   .sort((a,b)=>{
    const order=["Rates","Major Index","Energy","Metal","FX","Credit / Risk"];
    return order.indexOf(a.type)-order.indexOf(b.type);
   }).slice(0,10).map(r=>({
    label:r.label,level:r.last,previousClose:r.previousClose,
    asOf:r.asOf,sourceName:r.sourceName,sourceUrl:r.sourceUrl,frequency:r.frequency,
   })),
 });
 if(!reportEvidenceReady(evidence)){
  // The existing public edition is retained. Notion/X speculation is not a fallback.
  console.warn(JSON.stringify({event:"automated_daily_pdf_withheld",slot,reason:"insufficient_source_qualified_facts",
   qualified:evidence.sources.filter(s=>s.type!=="CALENDAR").length}));
  await noteWithheldEdition(db,reportDay,slot,now,
   evidence.sources.filter(s=>s.type!=="CALENDAR").length,evidence.coverageNote,
   "insufficient_source_qualified_facts");
  return {status:"coverage_blocked",reason:"insufficient_source_qualified_facts"};
 }
 // Bound the ledger while retaining forward catalysts when observations are plentiful.
 // An all-data report must retain its original dated calendar tests.
 evidence.sources=[
  ...evidence.sources.filter(s=>s.type==="NEWS").slice(0,6),
  ...evidence.sources.filter(s=>s.type==="OBSERVATION").slice(0,8),
  ...evidence.sources.filter(s=>s.type==="CALENDAR").slice(0,6),
 ].slice(0,20);
 if(!reportEvidenceReady(evidence)){
  await noteWithheldEdition(db,reportDay,slot,now,
   evidence.sources.filter(s=>s.type!=="CALENDAR").length,evidence.coverageNote,
   "bounded_source_coverage_incomplete");
  return {status:"coverage_blocked",reason:"bounded_source_coverage_incomplete"};
 }
 const {data:prior,error:priorError}=await db.from("blue_desk_automated_reports")
  .select("id,status,created_at").eq("report_day",reportDay).eq("slot",slot).maybeSingle();
 if(priorError)throw new Error("Automated report table unavailable (migration required)");
 if(prior?.status==="ready")return {status:"already_ready",id:prior.id};
 let id:string|null=null;
 if(prior){
  const elapsed=now.getTime()-Date.parse(prior.created_at);
  if(!Number.isFinite(elapsed)||elapsed<12*60_000)return {status:"locked",reason:"existing_report_claim"};
  const {data:claimed,error}=await db.from("blue_desk_automated_reports")
   .update({status:"building",created_at:now.toISOString(),error_code:null})
   .eq("id",prior.id).eq("status",prior.status).eq("created_at",prior.created_at)
   .neq("status","ready").select("id").maybeSingle();
  if(error||!claimed)return {status:"locked",reason:"claim_not_acquired"};
  id=claimed.id;
 }else{
  const {data:claimed,error}=await db.from("blue_desk_automated_reports")
   .insert({report_day:reportDay,slot,status:"building",
    created_at:now.toISOString(),coverage_note:evidence.coverageNote})
   .select("id").single();
  if(error?.code==="23505")return {status:"locked",reason:"parallel_generation_claim"};
  if(error||!claimed)throw new Error("Could not claim automated edition");
  id=claimed.id;
 }
 if(!id||!UUID.test(id))throw new Error("Invalid automated edition ID");
 let path:string|null=null;
 try{
  const key=process.env.GEMINI_API_KEY?.trim();
  if(!key)throw new Error("MODEL_UNCONFIGURED");
  const model=process.env.EDITORIAL_WRITING_MODEL?.trim()||"gemini-3.8-flash";
  const ai=new GoogleGenAI({apiKey:key});
  const request=buildAutomaticReportModelPrompt(evidence);
  let timer:ReturnType<typeof setTimeout>|undefined;
  let generated;
  try{
   generated=await Promise.race([
    ai.models.generateContent({model,contents:request,config:{
     responseMimeType:"application/json",temperature:0.22,maxOutputTokens:9000,
     systemInstruction:"Write the source-qualified Bluebelly market report in strict English JSON. Never introduce a new numerical fact; do not turn calendar questions into realised outcomes, or research uncertainty into verified claims. No links not supplied in the research packet. Cite every story and watchpoint with exact source IDs. Output client-ready narrative, not a research-process log.",
    }}),
    new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error("MODEL_TIMEOUT")),85_000);}),
   ]);
  }finally{if(timer)clearTimeout(timer);}
  let data:unknown;
  try{data=JSON.parse(generated.text||"");}catch{throw new Error("INVALID_MODEL_JSON");}
  const report=parseAutomatedReportNarrative(data,evidence);
  if(!report)throw new Error("NARRATIVE_EVIDENCE_GATE_REJECTED");
  const bytes=renderAutomatedReportPdf(evidence,report);
  if(bytes.length<2000||bytes.length>3_145_728||
    !Buffer.from(bytes.subarray(0,5)).equals(Buffer.from("%PDF-"))||
    !Buffer.from(bytes.subarray(-120)).toString("latin1").includes("%%EOF"))
   throw new Error("PDF_VALIDATION_FAILED");
  const sha=createHash("sha256").update(bytes).digest("hex");
  path=`automated-daily/${reportDay}/${slot}/${id}.pdf`;
  const upload=await db.storage.from("editorial-pdfs")
   .upload(path,bytes,{contentType:"application/pdf",upsert:false,cacheControl:"86400"});
  if(upload.error)throw new Error("PDF_STORAGE_UNAVAILABLE");
  const sources=evidence.sources.map(s=>s.url);
  const completion=await db.from("blue_desk_automated_reports").update({
   status:"ready",title:report.title,deck:report.deck,
   summary:report.executiveSummary,source_urls:sources,
   source_count:evidence.sources.filter(s=>s.type!=="CALENDAR").length,
   coverage_note:evidence.coverageNote,pdf_path:path,pdf_sha256:sha,
   ready_at:new Date().toISOString(),error_code:null,
  }).eq("id",id).eq("status","building").select("id").maybeSingle();
  if(completion.error||!completion.data)throw new Error("PDF_PRIVATE_COMPLETION_FAILED");
  console.info(JSON.stringify({event:"automated_daily_pdf_ready",slot,reportDay,id,
   sourceCount:evidence.sources.length,pdfBytes:bytes.length}));
  return {status:"ready",id};
 }catch(error){
  const code=error instanceof Error?error.message:"UNEXPECTED";
  console.error(JSON.stringify({event:"automated_daily_pdf_failed",slot,reportDay,
   reason:code.slice(0,96)}));
  if(path)await db.storage.from("editorial-pdfs").remove([path]).catch(()=>null);
  await db.from("blue_desk_automated_reports")
   .update({status:"failed",error_code:code.slice(0,96)})
   .eq("id",id).eq("status","building");
  return {status:"failed",reason:code.slice(0,96)};
 }
}
