import "server-only";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {projectMacroLog,projectGapRun,projectAiMatrix,workReceiptReadIssue,annotateWorkReceiptRead,receiptReadTokens,readReceiptWithScopedFallback,type ReceiptReadResult} from "./my-desk-work-receipt-core";
import {lane,type HealthLane} from "./my-desk-health-core";
import {parseOperationalBlocks,applyOperationalReceipt,type WorkOperationalReceipt} from "./my-desk-operational-receipt";
const AUDIT="423519b6-7a94-811f-8452-d736356546bb";
const LOG="5ef147a1-7a79-4e48-95c0-54869e14dafc",RUNS="b76f7ce0-ad59-49a1-8aac-61271f310493",AI="3f4519b6-7a94-8163-9302-eee63384c180";
type WorkLanes=Record<"MacroPulse"|"AI16"|"Material Events"|"Research Investigation",HealthLane>&{creatorReceipt?:WorkOperationalReceipt};
const unknown=(reason:string):WorkLanes=>({
 "MacroPulse":lane("MacroPulse",{gaps:reason}),AI16:lane("AI16",{gaps:reason}),
 "Material Events":lane("Material Events",{gaps:reason}),"Research Investigation":lane("Research Investigation",{gaps:reason})
});
/** Owner-scoped metadata-only reads of existing durable handoffs. No new acquisition, writes or scheduler. */
export async function getOwnerWorkReceiptLanes(now=new Date()):Promise<WorkLanes>{
 try{
  const session=await createSupabaseServerClient();
  const {data:{user},error}=await session.auth.getUser();
  if(error||!user?.id||!user.email)return unknown("Owner authorization unavailable");
  const {data:access,error:accessError}=await session.from("app_access_allowlist").select("email").eq("email",user.email.toLowerCase().trim()).eq("active",true).maybeSingle();
  if(accessError||!access)return unknown("Owner authorization unavailable");
 }catch{return unknown("Owner authorization unavailable");}
 const tokens=receiptReadTokens(process.env.NOTION_API_TOKEN,process.env.NOTION_MARKET_RESEARCH_TOKEN,process.env.NOTION_API_KEY);
 if(!tokens.length)return unknown("Existing Notion receipt reader not configured");
 const read=async(path:string,body?:object):Promise<ReceiptReadResult>=>readReceiptWithScopedFallback(tokens,async token=>{
  try{const r=await fetch("https://api.notion.com/v1"+path,{method:body?"POST":"GET",headers:{Authorization:"Bearer "+token,"Notion-Version":"2025-09-03",...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined,cache:"no-store",signal:AbortSignal.timeout(6500)});
   return r.ok?{raw:await r.json(),issue:null,status:200}:{raw:null,issue:workReceiptReadIssue(r.status),status:r.status};
  }catch{return {raw:null,issue:workReceiptReadIssue(null),status:null};}
 });
 // Bounded current metadata; no historical bodies or duplicate research fetch.
 const [log,runs,ai,ops]=await Promise.all([
  read("/data_sources/"+LOG+"/query",{page_size:24,sorts:[{property:"Created",direction:"descending"}]}),
  read("/data_sources/"+RUNS+"/query",{page_size:24,sorts:[{property:"Run At",direction:"descending"}]}),
  read("/blocks/"+AI+"/children?page_size=2"),
  read("/blocks/"+AUDIT+"/children?page_size=8")]);
 const r=parseOperationalBlocks(ops.raw,now);
 const project=(base:HealthLane,receipt:WorkOperationalReceipt|undefined,issue:string|null)=>annotateWorkReceiptRead(applyOperationalReceipt(base,receipt,now),issue,ops.issue);
 return {"MacroPulse":project(projectMacroLog(log.raw,now),r.macropulse,log.issue),AI16:project(projectAiMatrix(ai.raw,now),r.ai16,ai.issue),"Material Events":project(projectGapRun(runs.raw,"Material Events",now),r.material,runs.issue),"Research Investigation":project(projectGapRun(runs.raw,"Research Investigation",now),r.investigation,runs.issue),creatorReceipt:r.creator};
}
