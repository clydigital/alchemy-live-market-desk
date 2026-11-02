import "server-only";
import {randomUUID} from "node:crypto";
import {NextResponse,type NextRequest} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {blueDeskHostAccess} from "@/lib/blue-desk-host";
import {
 REPORT_ATTACHMENT_BUCKET,REPORT_ATTACHMENT_MAX_BYTES,attachmentOwnerPrefix,
 attachmentObjectName,looksLikePdf,validAttachmentName,
} from "@/lib/bluebelly-owner-report-attachment-contract";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const privateHeaders={"Cache-Control":"private, no-store, max-age=0","Vary":"Cookie",
 "X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer"};
const fail=(status:number)=>NextResponse.json({error:"Private Daily Report attachment unavailable"},{status,headers:privateHeaders});
async function approvedOwner(req:NextRequest):Promise<{status:number;id:string|null}>{
 const host=req.headers.get("host")||req.nextUrl.hostname;
 if(blueDeskHostAccess("/api/owner/report-attachments",host)!=="private")return {status:404,id:null};
 const session=await createSupabaseServerClient().catch(()=>null);
 if(!session)return {status:503,id:null};
 const {data:{user},error}=await session.auth.getUser();
 if(error||!user?.id||!user.email)return {status:401,id:null};
 const {data:allowed,error:allowedError}=await session.from("app_access_allowlist")
  .select("email").eq("email",user.email.toLowerCase().trim()).eq("active",true).maybeSingle();
 if(allowedError||!allowed)return {status:403,id:null};
 return {status:200,id:user.id};
}
/** File listing or attachment-only download. Storage is NEVER public; the
 * exact owner prefix is independently computed on every request. */
export async function GET(req:NextRequest){
 const who=await approvedOwner(req);if(!who.id)return fail(who.status);
 const prefix=attachmentOwnerPrefix(who.id);
 const db=createSupabaseAdminClient();
 const name=req.nextUrl.searchParams.get("name");
 if(name!==null){
  if(!validAttachmentName(name))return fail(404);
  const exact=prefix+"/"+name;
  const {data,error}=await db.storage.from(REPORT_ATTACHMENT_BUCKET).download(exact);
  if(error||!data)return fail(404);
  const bytes=await data.arrayBuffer();
  if(!looksLikePdf(new Uint8Array(bytes)))return fail(502);
  return new NextResponse(bytes,{status:200,headers:{...privateHeaders,
   "Content-Type":"application/pdf","Content-Length":String(bytes.byteLength),
   "Content-Disposition":'attachment; filename="'+name+'"',
   "Content-Security-Policy":"default-src 'none'; sandbox",
  }});
 }
 const {data,error}=await db.storage.from(REPORT_ATTACHMENT_BUCKET)
  .list(prefix,{limit:100,sortBy:{column:"created_at",order:"desc"}});
 if(error)return fail(503);
 const files=(data||[]).filter(f=>validAttachmentName(f.name)).map(f=>({
  name:f.name,day:f.name.slice(0,10),createdAt:f.created_at,
  sizeBytes:typeof f.metadata?.size==="number"?f.metadata.size:null,
 }));
 return NextResponse.json({files,status:"PRIVATE_RESEARCH_ATTACHMENTS"},{headers:privateHeaders});
}
/** One explicit owner upload, no new scheduler or mutation of published
 * / immutable Daily Intelligence editions. Binary PDF stays download-only. */
export async function POST(req:NextRequest){
 const who=await approvedOwner(req);if(!who.id)return fail(who.status);
 const origin=req.headers.get("origin");
 if(!origin)return fail(403);
 try{
  const url=new URL(origin),host=req.headers.get("host")||req.nextUrl.host;
  if(url.host!==host||!(url.protocol==="https:"||(url.protocol==="http:"&&url.hostname==="localhost")))return fail(403);
 }catch{return fail(403);}
 const length=Number(req.headers.get("content-length")||"0");
 if(length>REPORT_ATTACHMENT_MAX_BYTES+200000)return fail(413);
 try{
  const form=await req.formData();
  const file=form.get("file");
  if(!(file instanceof File)||!/\.pdf$/i.test(file.name)||file.size>REPORT_ATTACHMENT_MAX_BYTES)return fail(422);
  const bytes=new Uint8Array(await file.arrayBuffer());
  if(!looksLikePdf(bytes))return fail(422);
  const suppliedDay=form.get("reportDay");
  const day=typeof suppliedDay==="string"?suppliedDay:
    new Intl.DateTimeFormat("en-CA",{timeZone:"Asia/Kuala_Lumpur",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
  const name=attachmentObjectName(day,file.name,randomUUID());
  const exact=attachmentOwnerPrefix(who.id)+"/"+name;
  const {error}=await createSupabaseAdminClient().storage.from(REPORT_ATTACHMENT_BUCKET)
   .upload(exact,bytes,{contentType:"application/pdf",cacheControl:"0",upsert:false});
  if(error)return fail(503);
  return NextResponse.json({created:true,name,day,status:"PRIVATE_DRAFT_NOT_SOURCE_VERIFIED"},
   {status:201,headers:privateHeaders});
 }catch{return fail(422);}
}
