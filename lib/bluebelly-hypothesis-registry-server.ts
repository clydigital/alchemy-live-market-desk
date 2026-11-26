import "server-only";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {projectRegistryRows,readFirstSnapshot,canonicalGemIds,projectCanonicalGemReceipts,type RegistryRead} from "./bluebelly-hypothesis-registry";
const SOURCE="7daf2da3-4f2e-4746-8fa8-fc957e293ded";
const empty=(status:RegistryRead["status"]):RegistryRead=>({status,rows:[],truncated:false,retrievedAt:null});
/** Only owner-initiated Research Library requests. No public reader, new collector or cache. */
export async function getOwnerHypothesisRegistry(now=new Date()):Promise<RegistryRead>{
 try{
  const session=await createSupabaseServerClient();
  const {data:{user},error}=await session.auth.getUser();
  if(error||!user?.id||!user.email)return empty("UNAUTHORISED");
  const {data:access,error:accessError}=await session.from("app_access_allowlist").select("email").eq("email",user.email.toLowerCase().trim()).eq("active",true).maybeSingle();
  if(accessError||!access)return empty("UNAUTHORISED");
 }catch{return empty("UNAUTHORISED");}
 const token=process.env.NOTION_API_TOKEN?.trim()||process.env.NOTION_MARKET_RESEARCH_TOKEN?.trim();
 if(!token)return empty("NOT_CONFIGURED");
 const read=async(path:string,body?:object)=>{
 const r=await fetch("https://api.notion.com/v1"+path,{method:body?"POST":"GET",headers:{Authorization:"Bearer "+token,"Notion-Version":"2025-09-03",...(body?{"Content-Type":"application/json"}:{})},body:body?JSON.stringify(body):undefined,cache:"no-store",signal:AbortSignal.timeout(6500)});
 if(!r.ok)throw Error("Registry read unavailable");return await r.json() as {results?:unknown[];has_more?:boolean};
 };
 try{
 const raw=await read("/data_sources/"+SOURCE+"/query",{page_size:8,filter:{and:[{or:[{property:"Status",select:{equals:"ACTIVE"}},{property:"Status",select:{equals:"STALE"}}]},{property:"Investigation ID",rich_text:{is_not_empty:true}}]},sorts:[{timestamp:"last_edited_time",direction:"descending"}]});
 if(!Array.isArray(raw.results))return empty("UNAVAILABLE");
 const rows=projectRegistryRows(raw,now);
 // One bounded registry query plus at most four first-block requests; do not scan old page bodies.
 let failed=false;
 await Promise.all(rows.slice(0,4).map(async row=>{
 try{row.snapshot=readFirstSnapshot(await read("/blocks/"+row.pageId+"/children?page_size=1"),row,now);}catch{failed=true;}
 }));
 // Bounded owner-only receipt and latest Dossier readback; no promotion or mutation.
 const ids=canonicalGemIds(rows);let receipts:unknown[]|null=null;
 if(ids.length)try{
 const {data,error}=await createSupabaseAdminClient().from("intelligence_evidence").select("id,external_evidence_id,provenance_urls,event_at,published_at,received_at").in("id",ids).limit(32);
 if(!error&&Array.isArray(data))receipts=data;
 }catch{/* Preserve saved snapshots; mark canonical readback unavailable. */}
 let dossier:unknown=null;
 if(receipts?.length)try{
 const {data,error}=await createSupabaseAdminClient().from("market_dossiers_v2").select("id,as_of,payload").lte("as_of",now.toISOString()).order("as_of",{ascending:false}).limit(1).maybeSingle();
 if(!error&&data)dossier=data;
 }catch{/* Missing Dossier is not proof of non-consumption. */}
 return {status:failed?"PARTIAL":"AVAILABLE",rows:projectCanonicalGemReceipts(rows,receipts,now,dossier),truncated:raw.has_more===true||rows.length>4,retrievedAt:new Date().toISOString()};
 }catch{return empty("UNAVAILABLE");}
}
