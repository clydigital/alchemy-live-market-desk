import "server-only";
import {createHash} from "node:crypto";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {getLatestEditorialSlate} from "@/lib/editorial-slate-server";
import {isAutomaticReportFinalisationWindow,isAutomaticReportFallbackWindow} from "@/lib/blue-desk-automated-report-contract";
import {renderPrivateEditorialSlatePdf} from "@/lib/blue-desk-private-slate-pdf";

type Outcome={status:"ready"|"already_ready"|"blocked"|"locked"|"failed";reason?:string;id?:string};
const DAY=(now:Date)=>new Date(now.getTime()+8*3600_000).toISOString().slice(0,10);
const KIND="COTD_OB_RESEARCH";
function validUrl(s:string):boolean{
 try{const u=new URL(s);return u.protocol==="https:"&&!u.username&&!u.password
  &&u.href.length<=1500&&!!u.hostname;}
 catch{return false;}
}
/** Reuses *existing* 10:40 and 11:30/11:45 MYT post-Dossier slots.
 * It does not trigger a ChatGPT run or read a plugin's private OAuth token;
 * it typesets only a fresh, already-persisted three-idea research slate. */
export async function runPrivateEditorialSlatePdf(now=new Date()):Promise<Outcome>{
 if(!isAutomaticReportFinalisationWindow(now,"morning")&&
    !isAutomaticReportFallbackWindow(now,"morning"))
  return {status:"locked",reason:"outside_existing_schedule"};
 const db=createSupabaseAdminClient(),day=DAY(now);
 const {data:prior,error:readError}=await db.from("blue_desk_automated_reports")
  .select("id,status,created_at").eq("report_day",day).eq("slot","morning")
  .eq("report_kind",KIND).maybeSingle();
 if(readError) return {status:"failed",reason:"private_report_table_unavailable"};
 if(prior?.status==="ready")return {status:"already_ready",id:prior.id};
 const {slate}=await getLatestEditorialSlate();
 const produced=Date.parse(slate?.producedAt||"");
 const urls=[...new Set((slate?.ideas.flatMap(i=>i.sourceUrls)||[])
  .concat(slate?.sources||[]).filter(validUrl))].slice(0,20);
 const valid=slate?.dayMyt===day&&Number.isFinite(produced)&&produced<=now.getTime()
  &&now.getTime()-produced<18*3600_000&&slate.ideas.length===3
  &&slate.ideas.every(i=>i.title&&i.hook&&i.mechanism&&i.countercase)
  &&urls.length>=2;
 const evidenceNote="Private editorial research from a scheduled ChatGPT Writing Brain slate. Original links are attributed but NOT independently reverified by this PDF renderer; market reactions, figures and technical levels require their own source checks. No plugin call or canonical evidence admission is implied.";
 if(!valid){
  if(!prior)await db.from("blue_desk_automated_reports").insert({
   report_day:day,slot:"morning",report_kind:KIND,status:"blocked",
   source_count:urls.length,coverage_note:evidenceNote,
   error_code:slate?.dayMyt===day?"editorial_source_gap":"editorial_slate_missing_or_stale",
   source_receipts:slate?[{producer:"Blue Desk OB/COTD Writing Brain",
    producedAt:slate.producedAt,verification:"RESEARCH_ONLY",
    originalLinks:urls,pluginCallsVerified:[]}]:[],
  }).then(({error})=>{
   if(error&&error.code!=="23505")console.warn(JSON.stringify({
    event:"private_slate_pdf_attempt_receipt_unavailable",reason:"db_write_failed"}));
  });
  return {status:"blocked",reason:slate?.dayMyt===day?"editorial_source_gap":"editorial_slate_missing_or_stale"};
 }
 if(!slate)return {status:"blocked",reason:"editorial_slate_missing"};
 let id:string;
 if(prior){
  const elapsed=now.getTime()-Date.parse(prior.created_at);
  if(!Number.isFinite(elapsed)||elapsed<12*60_000)return {status:"locked",reason:"retry_backoff"};
  const {data,error}=await db.from("blue_desk_automated_reports")
   .update({status:"building",created_at:now.toISOString(),error_code:null})
   .eq("id",prior.id).eq("status",prior.status).eq("created_at",prior.created_at)
   .neq("status","ready").select("id").maybeSingle();
  if(error||!data)return {status:"locked",reason:"claim_not_acquired"};
  id=data.id;
 }else{
  const {data,error}=await db.from("blue_desk_automated_reports")
   .insert({report_day:day,slot:"morning",report_kind:KIND,status:"building",
    coverage_note:evidenceNote,source_count:urls.length})
   .select("id").maybeSingle();
  if(error?.code==="23505")return {status:"locked",reason:"parallel_claim"};
  if(error||!data)return {status:"failed",reason:"claim_unavailable"};
  id=data.id;
 }
 let path:string|null=null;
 try{
  const pdf=renderPrivateEditorialSlatePdf(slate);
  const b=Buffer.from(pdf);
  if(b.length<2000||b.length>3_145_728||!b.subarray(0,5).equals(Buffer.from("%PDF-"))
     ||!b.subarray(-120).toString("latin1").includes("%%EOF"))
   throw Error("PDF_INVALID");
  path=`private-packs/editorial-slate/${day}/morning/${id}.pdf`;
  const upload=await db.storage.from("editorial-pdfs")
   .upload(path,pdf,{contentType:"application/pdf",cacheControl:"0",upsert:false});
  if(upload.error)throw Error("PDF_STORAGE_FAILED");
  const receipt={producer:"Blue Desk OB/COTD Writing Brain",producedAt:slate.producedAt,
   slateDay:slate.dayMyt,verification:"RESEARCH_ONLY",upstreamStatus:slate.verificationStatus,
   originalLinks:urls,pluginCallsVerified:[],recheckedByRenderer:false};
  const summary="Three proposed OB/COTD market angles with the upstream research hooks, source-dated price claims or gaps, countercases, chart checks and original-source links. Private research only; not an approved article.";
  const {data,error}=await db.from("blue_desk_automated_reports").update({
   status:"ready",title:"OB / COTD Research Slate - "+day,
   deck:"The Writing Brain's three proposed market angles, preserved without rewriting research claims.",
   summary,pdf_path:path,pdf_sha256:createHash("sha256").update(pdf).digest("hex"),
   source_urls:urls,source_count:urls.length,source_receipts:[receipt],
   ready_at:new Date().toISOString(),coverage_note:evidenceNote,error_code:null,
  }).eq("id",id).eq("status","building").select("id").maybeSingle();
  if(error||!data)throw Error("EDITION_COMPLETION_FAILED");
  console.info(JSON.stringify({event:"private_editorial_slate_pdf_ready",day,id,sourceCount:urls.length}));
  return {status:"ready",id};
 }catch(error){
  if(path)await db.storage.from("editorial-pdfs").remove([path]).catch(()=>null);
  await db.from("blue_desk_automated_reports")
   .update({status:"failed",error_code:"private_editorial_slate_pdf_failed"})
   .eq("id",id).eq("status","building");
  console.error(JSON.stringify({event:"private_editorial_slate_pdf_failed",day,
   class:error instanceof Error?error.message.slice(0,60):"unknown"}));
  return {status:"failed",reason:"private_editorial_slate_pdf_failed"};
 }
}
