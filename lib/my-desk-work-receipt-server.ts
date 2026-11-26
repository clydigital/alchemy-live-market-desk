import "server-only";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {projectMacroLog,projectGapRun,projectAiMatrix} from "./my-desk-work-receipt-core";
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
 const token=process.env.NOTION_API_TOKEN?.trim()||process.env.NOTION_MARKET_RESEARCH_TOKEN?.trim();
 if(!token)return unknown("Existing Notion receipt reader not configured");
 const read=async(path:string,body?:object):Promise<unknown>=>{
  try{const r=await fetch("https://api.notion.com/v1"+path,{method:body?"POST":"GET",headers:{Authorization:"Bearer "+token,"Notion-Version":"2025-09-03",...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined,cache:"no-store",signal:AbortSignal.timeout(6500)});
   return r.ok?await r.json():null;
  }catch{return null;}
 };
 // Bounded current metadata; no historical bodies or duplicate research fetch.
 const [log,runs,ai,ops]=await Promise.all([
  read("/data_sources/"+LOG+"/query",{page_size:24,sorts:[{property:"Created",direction:"descending"}]}),
  read("/data_sources/"+RUNS+"/query",{page_size:24,sorts:[{property:"Run At",direction:"descending"}]}),
  read("/blocks/"+AI+"/children?page_size=2"),
  read("/blocks/"+AUDIT+"/children?page_size=8")]);
 const r=parseOperationalBlocks(ops,now);
 return {"MacroPulse":applyOperationalReceipt(projectMacroLog(log,now),r.macropulse,now),AI16:applyOperationalReceipt(projectAiMatrix(ai,now),r.ai16,now),"Material Events":applyOperationalReceipt(projectGapRun(runs,"Material Events",now),r.material,now),"Research Investigation":applyOperationalReceipt(projectGapRun(runs,"Research Investigation",now),r.investigation,now),creatorReceipt:r.creator};
}
