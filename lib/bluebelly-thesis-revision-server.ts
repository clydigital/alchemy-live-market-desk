import "server-only";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {validateDeliveredWorkHtmlEdition} from "./bluebelly-html-archive-import-contract";
import {THESIS_PACKET_TITLE,parseThesisPacketHtml,groupThesisPacketReceipts,type PacketReceipt} from "./bluebelly-thesis-revision-packet";
const empty=(status:"UNAVAILABLE"|"UNAUTHORISED")=>({status,groups:[],invalid:0,truncated:false});
/** Independent owner guard even when invoked from a private page. No public import. */
export async function getOwnerThesisRevisionPackets(now=new Date()){
 try{
  const session=await createSupabaseServerClient();
  const {data:{user},error}=await session.auth.getUser();
  if(error||!user?.id||!user.email)return empty("UNAUTHORISED");
  const {data:access,error:ae}=await session.from("app_access_allowlist").select("email").eq("email",user.email.toLowerCase().trim()).eq("active",true).maybeSingle();
  if(ae||!access)return empty("UNAUTHORISED");
  const db=createSupabaseAdminClient();
  const {data,error:re}=await db.from("blue_desk_work_html_editions").select("id,report_day,title,html_content,html_sha256,created_at,review_status").eq("owner_user_id",user.id).eq("title",THESIS_PACKET_TITLE).eq("review_status","PRIVATE_DRAFT").order("created_at",{ascending:false}).limit(25);
  if(re)return empty("UNAVAILABLE");
  const rows=data??[];let invalid=0;
  const packets=rows.slice(0,24).flatMap(r=>{
   try{
    const saved=new Date(r.created_at);if(!Number.isFinite(+saved)||+saved>+now)throw Error("clock");
    if(validateDeliveredWorkHtmlEdition({reportDay:r.report_day,title:r.title,html:r.html_content}).htmlSha256!==r.html_sha256)throw Error("hash");
    const packet=parseThesisPacketHtml(r.html_content,saved);if(!packet)throw Error("packet");
    return [{editionId:r.id as string,storedAt:r.created_at as string,packet}];
   }catch{invalid++;return []}
  });
  const refs=packets.flatMap(p=>p.packet.references);
  const ids=[...new Set(refs.filter(r=>r.kind==="BB_RECORD").map(r=>r.id!))];
  const workIds=[...new Set(refs.filter(r=>r.kind==="WORK_EDITION").map(r=>r.id!))];
  const [records,work]=await Promise.all([
   ids.length?db.from("bb_research_documents").select("record_id,lane,source_url,event_at,published_at,available_at").in("record_id",ids).limit(400):Promise.resolve({data:[],error:null}),
   workIds.length?db.from("blue_desk_work_html_editions").select("id,created_at,review_status").eq("owner_user_id",user.id).in("id",workIds).limit(300):Promise.resolve({data:[],error:null}),
  ]);
  const receipts:PacketReceipt[]=packets.map(p=>({...p,referenceStates:p.packet.references.map(reference=>{
   const source=Date.parse(reference.sourceAt),review=Date.parse(p.packet.reviewedAt);
   const matched=reference.kind==="BB_RECORD"&&!records.error&&records.data?.some(r=>r.record_id===reference.id&&r.lane===reference.lane&&r.source_url===reference.url&&[r.event_at,r.published_at].some(d=>typeof d==="string"&&Date.parse(d)===source)&&Date.parse(r.available_at)<=review)
    ||reference.kind==="WORK_EDITION"&&!work.error&&work.data?.some(r=>r.id===reference.id&&r.review_status==="PRIVATE_DRAFT"&&Date.parse(r.created_at)===source&&source<=review);
   return {reference,state:reference.kind==="ORIGINAL_LINK"?"LINK_ONLY" as const:matched?"IDENTITY_MATCHED" as const:"UNRESOLVED" as const};
  })}));
  return {status:invalid||records.error||work.error?"PARTIAL" as const:"AVAILABLE" as const,groups:groupThesisPacketReceipts(receipts),invalid,truncated:rows.length>24};
 }catch{return empty("UNAVAILABLE")}
}
