import "server-only";
import {createHash} from "node:crypto";
import {GoogleGenAI,ThinkingLevel} from "@google/genai";
import {acceptsResearchAuthorization} from "./research-auth";
import {createSupabaseAdminClient} from "./supabase/admin";
import {expectedCompletedUsWeekdaySessionDay} from "./bluebelly-daily-report-session";
import {getCurrentVerifiedMarketMotion} from "./market-motion";
import {selectVerifiedNewsBriefs} from "./market-brief-news";
import {getOriginalPressNews} from "./blue-desk-original-press-news-server";
import {combineQualifiedNews} from "./blue-desk-qualified-news";
import {getPublicSourceObservations} from "./blue-desk-source-observations";
import {getMarketMonitor} from "./market-monitor-public";
import {getEconomicCalendar} from "./calendar";
import {getForwardEarningsEvents} from "./forward-earnings-sources";
import {buildPresenterCalendar} from "./presenter-calendar";
import {selectBlueDeskUpcoming} from "./blue-desk-calendar";
import {assembleAutomaticReportEvidence,buildAutomaticReportModelPrompt,
 parseAutomatedReportNarrative,reportEvidenceReady,type AutomaticReportEvidence,
 type AutomatedReportNarrative} from "./blue-desk-automated-report-contract";
import {renderScheduledDailyHtml} from "./bluebelly-scheduled-daily-html";

type Result={status:"ready"|"reused"|"withheld"|"locked"|"failed";
 reportDay?:string;id?:string;mode?:string;reason?:string;qualified?:number};
const hash=(s:string)=>createHash("sha256").update(s).digest("hex");
const timeGate=(d:Date)=>Number.isFinite(d.getTime())&&d.getUTCHours()===3
 &&(d.getUTCMinutes()>=30&&d.getUTCMinutes()<59);
const boundedText=(s:string)=>s.slice(0,100);

/** Server-authorised daily archive fallback: never auto-approves a public
 * Story/Regime, and never treats a Notion/creator URL as a factual receipt.
 * Uses EXISTING 03:30/03:45 UTC Research Gap handoff calls. */
export async function runPrivateDailyHtmlFallback(
 request:Request,now=new Date(),
):Promise<Result>{
 const secret=process.env.CRON_SECRET?.trim();
 if(!secret||!acceptsResearchAuthorization(request.headers.get("authorization"),[secret]))
  return {status:"locked",reason:"unauthorised"};
 if(process.env.NEXT_PUBLIC_RESEARCH_SCHEDULE_ENABLED!=="true"
   ||process.env.BLUEBELLY_DAILY_HTML_FALLBACK_DISABLED==="true")
  return {status:"locked",reason:"schedule_disabled"};
 if(!timeGate(now))return {status:"locked",reason:"outside_existing_morning_handoff"};
 const day=expectedCompletedUsWeekdaySessionDay(now);
 if(!day)return {status:"failed",reason:"session_day_invalid"};
 const db=createSupabaseAdminClient();
 try{
  const {data:allowed,error:allowError}=await db.from("app_access_allowlist")
   .select("email").eq("active",true).limit(3);
  if(allowError||allowed?.length!==1||!allowed[0].email)
   return {status:"withheld",reportDay:day,reason:"unique_owner_not_proven"};
  const {data:users,error:usersError}=await db.auth.admin.listUsers({page:1,perPage:1000});
  if(usersError||!users?.users||users.users.length>=1000)
   return {status:"withheld",reportDay:day,reason:"owner_identity_not_proven"};
  const eligible=users.users.filter(u=>u.email?.toLowerCase()===allowed[0].email.toLowerCase());
  if(eligible.length!==1)return {status:"withheld",reportDay:day,reason:"owner_identity_not_unique"};
  const ownerId=eligible[0].id;
  const [work,owner]=await Promise.all([
   db.from("blue_desk_work_html_editions").select("id,delivery_type")
    .eq("owner_user_id",ownerId).eq("report_day",day).limit(2),
   db.from("blue_desk_private_html_editions").select("id")
    .eq("owner_user_id",ownerId).eq("report_day",day).limit(1),
  ]);
  if(work.error||owner.error)return {status:"failed",reportDay:day,reason:"archive_read_unavailable"};
  // Work-authored complete editions and owner revisions outrank the fallback.
  const complete=(work.data||[]).find(x=>x.delivery_type==="CHATGPT_WORK");
  if(complete||owner.data?.length)return {status:"reused",reportDay:day,id:complete?.id||owner.data?.[0]?.id};
  if(work.data?.length)return {status:"reused",reportDay:day,id:work.data[0].id,mode:"SOURCE_LED_FALLBACK"};

  // Every adapter below already projects verified original-source inputs.
  const [motion,press,observations,economic,earnings,monitor]=await Promise.all([
   getCurrentVerifiedMarketMotion({limit:24}).catch(()=>[]),
   getOriginalPressNews(now,12,2).catch(()=>[]),
   getPublicSourceObservations(now,12).catch(()=>[]),
   getEconomicCalendar().catch(()=>[]),
   getForwardEarningsEvents({now}).catch(()=>({
    events:[],coverage:"unavailable" as const,warning:"Earnings unavailable",
   })),
   getMarketMonitor().catch(()=>null),
  ]);
  const news=combineQualifiedNews(selectVerifiedNewsBriefs(motion,now,12),press,12);
  const upcoming=selectBlueDeskUpcoming(buildPresenterCalendar(economic,earnings,now),now,14).slice(0,12);
  const market=(monitor?.rows||[])
   .filter(r=>r.last!==null&&r.asOf&&r.frequency==="daily"
     &&["Rates","Major Index","Energy","Metal","FX","Credit / Risk"].includes(r.type))
   .slice(0,10).map(r=>({
    label:r.label,level:r.last,previousClose:r.previousClose,asOf:r.asOf,
    sourceName:r.sourceName,sourceUrl:r.sourceUrl,frequency:r.frequency,
   }));
  const evidence=assembleAutomaticReportEvidence({now,slot:"morning",news,observations,
   calendar:upcoming.map(e=>({
    title:e.title,when:e.scheduledAt||e.localDate||null,
    sourceName:e.sourceName,sourceUrl:e.sourceUrl||null,
    question:e.decidingQuestion||"What would change expectations?",
   })),market});
  // Only admitted original facts qualify; no unsupported weekend holiday reports.
  if(!reportEvidenceReady(evidence)){
   console.warn(JSON.stringify({event:"private_daily_html_withheld",reportDay:day,
    reason:"source_coverage_gap",qualified:evidence.sources.filter(s=>s.type!=="CALENDAR").length}));
   return {status:"withheld",reportDay:day,reason:"source_coverage_gap",
    qualified:evidence.sources.filter(s=>s.type!=="CALENDAR").length};
  }
  evidence.sources=[
   ...evidence.sources.filter(s=>s.type==="NEWS").slice(0,6),
   ...evidence.sources.filter(s=>s.type==="OBSERVATION").slice(0,8),
   ...evidence.sources.filter(s=>s.type==="CALENDAR").slice(0,6),
  ].slice(0,20);
  if(!reportEvidenceReady(evidence))
   return {status:"withheld",reportDay:day,reason:"bounded_source_coverage_gap"};

  const narrative=await tryNarrative(evidence);
  const rendered=renderScheduledDailyHtml({day,now,evidence,narrative});
  const htmlSha=hash(rendered.html),contentSha=hash("BLUEBELLY_SCHEDULED_HTML_V1|"+day+"|"+rendered.html);
  const manifest=evidence.sources.slice(0,20).map(s=>({
   sourceId:s.id,sourceType:s.type,sourceName:s.sourceName,
   originalUrl:s.url,eventAt:s.eventAt,
   inputStage:"admitted_original_source_projection",
   independentlyRecheckedByRenderer:false,
  }));
  const {data:saved,error:saveError}=await db.from("blue_desk_work_html_editions")
   .insert({owner_user_id:ownerId,report_day:day,title:rendered.title,
    html_content:rendered.html,html_sha256:htmlSha,content_sha256:contentSha,
    source_manifest:manifest,delivery_type:"SCHEDULED_RESEARCH",review_status:"PRIVATE_DRAFT"})
   .select("id,report_day,html_sha256,delivery_type").single();
  if(saveError?.code==="23505"){
   const {data:already}=await db.from("blue_desk_work_html_editions")
    .select("id").eq("owner_user_id",ownerId).eq("report_day",day)
    .eq("delivery_type","SCHEDULED_RESEARCH").maybeSingle();
   return already?{status:"reused",reportDay:day,id:already.id,mode:"SOURCE_LED_FALLBACK"}:
    {status:"failed",reportDay:day,reason:"claim_conflict_no_readback"};
  }
  if(saveError||!saved||saved.report_day!==day||saved.html_sha256!==htmlSha)
   return {status:"failed",reportDay:day,reason:"private_archive_insert_failed"};
  console.info(JSON.stringify({event:"private_daily_html_archived",reportDay:day,
   id:saved.id,mode:rendered.mode,sourceCount:manifest.length}));
  return {status:"ready",reportDay:day,id:saved.id,mode:rendered.mode,
   qualified:evidence.sources.filter(s=>s.type!=="CALENDAR").length};
 }catch(err){
  const reason=err instanceof Error?boundedText(err.message):"unhandled_error";
  console.warn(JSON.stringify({event:"private_daily_html_failed",reportDay:day,reason}));
  return {status:"failed",reportDay:day,reason:"private_daily_generator_failed"};
 }
}

/** Optional model writing pass. Failure is non-blocking: source-led HTML still
 * archives. The existing conservative numeric/source-ID narrative gate applies. */
async function tryNarrative(evidence:AutomaticReportEvidence):Promise<AutomatedReportNarrative|null>{
 const key=process.env.GEMINI_API_KEY?.trim();
 if(!key)return null;
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  const ai=new GoogleGenAI({apiKey:key});
  const generated=await Promise.race([
   ai.models.generateContent({
    model:process.env.EDITORIAL_WRITING_MODEL?.trim()||"gemini-3.8-flash",
    contents:buildAutomaticReportModelPrompt(evidence),
    config:{responseMimeType:"application/json",
     thinkingConfig:{thinkingLevel:ThinkingLevel.LOW},maxOutputTokens:7500,
     systemInstruction:"Write Bluebelly's original-source-led private market narrative in British English. Use ONLY the supplied source facts and IDs. Do not invent prices, consensus, causation or future outcomes. Label uncertainties and countercases. Output strict JSON."},
   }),
   new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error("model_timeout")),50000);}),
  ]);
  let raw:unknown;try{raw=JSON.parse(generated.text||"");}catch{return null;}
  return parseAutomatedReportNarrative(raw,evidence);
 }catch{return null;}
 finally{if(timer)clearTimeout(timer);}
}
