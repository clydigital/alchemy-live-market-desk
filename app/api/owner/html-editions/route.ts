import "server-only";
import {NextResponse,type NextRequest} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {blueDeskHostAccess} from "@/lib/blue-desk-host";
import {
 HTML_BUCKET,HTML_TABLE,archivePath,digest,parseArchiveInput,validArchiveId
} from "@/lib/bluebelly-private-html-archive-contract";
import {saveHtmlArchive} from "@/lib/bluebelly-private-html-archive";
import {importExistingHtmlEdition} from "@/lib/bluebelly-private-html-import";
import {parseExistingHtmlEdition} from "@/lib/bluebelly-html-archive-import-contract";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const headers={
 "Cache-Control":"private, no-store, max-age=0",
 "Vary":"Cookie","X-Content-Type-Options":"nosniff",
 "Referrer-Policy":"no-referrer",
};
const error=(code:number,message:string)=>NextResponse.json({error:message},{status:code,headers});
async function owner(req:NextRequest){
 const host=req.headers.get("host")||req.nextUrl.hostname;
 if(blueDeskHostAccess("/api/owner/html-editions",host)!=="private")
  return {code:404 as const,userId:null};
 const session=await createSupabaseServerClient().catch(()=>null);
 if(!session)return {code:503 as const,userId:null};
 const {data:{user},error:authError}=await session.auth.getUser();
 if(authError||!user?.email)return {code:401 as const,userId:null};
 const {data:access,error:accessError}=await session.from("app_access_allowlist")
  .select("email").eq("email",user.email.toLowerCase().trim())
  .eq("active",true).maybeSingle();
 if(accessError||!access)return {code:403 as const,userId:null};
 return {code:200 as const,userId:user.id};
}
/** Private append-only edition receipt list; no HTML blobs or raw credentials. */
export async function GET(req:NextRequest){
 const identity=await owner(req);
 if(!identity.userId)return error(identity.code,"Private HTML archive unavailable");
 const db=createSupabaseAdminClient();
 const id=req.nextUrl.searchParams.get("edition");
 if(id!==null){
  if(!validArchiveId(id))return error(404,"Edition not found");
  const {data:edition,error:findError}=await db.from(HTML_TABLE)
   .select("id,report_day,html_path,html_sha256")
   .eq("owner_user_id",identity.userId).eq("id",id).maybeSingle();
  if(findError)return error(503,"Private HTML history unavailable");
  if(!edition){
   // Work-generated complete HTML is deposited by the authorised Supabase
   // connector: read only after the same owner session/allowlist gate.
   const {data:work,error:workError}=await db.from("blue_desk_work_html_editions")
    .select("id,report_day,html_content,html_sha256")
    .eq("owner_user_id",identity.userId).eq("id",id).maybeSingle();
   if(workError||!work)return error(404,"Edition not found");
   try{
    const checked=parseExistingHtmlEdition({
     filename:"Bluebelly_"+work.report_day+".html",html:work.html_content,
    });
    const workBytes=new TextEncoder().encode(work.html_content);
    if(workBytes.length>950000||workBytes.length<1000||
       checked.edition.reportDay!==work.report_day||
       digest(workBytes)!==work.html_sha256||
       checked.edition.htmlSha256!==work.html_sha256)
      return error(502,"Delivered Work HTML failed integrity verification");
    const disposition=req.nextUrl.searchParams.get("download")==="1"?"attachment":"inline";
    return new NextResponse(workBytes,{status:200,headers:{
     ...headers,"Content-Type":"text/html; charset=utf-8",
     "Content-Disposition":disposition+'; filename="Bluebelly-Work-'+work.report_day+'-'+id+'.html"',
     "Content-Length":String(workBytes.length),
     "Content-Security-Policy":"sandbox allow-popups; default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
     "X-Frame-Options":"DENY",
    }});
   }catch{return error(502,"Delivered Work HTML failed static-content validation");}
  }
  const expected=archivePath(identity.userId,edition.report_day,id);
  if(edition.html_path!==expected)return error(404,"Edition path not valid");
  const {data:blob,error:blobError}=await db.storage.from(HTML_BUCKET).download(expected);
  if(blobError||!blob)return error(404,"Edition file missing");
  const bytes=await blob.arrayBuffer();
  if(bytes.byteLength<1000||bytes.byteLength>1048576||
     digest(new Uint8Array(bytes))!==edition.html_sha256)
   return error(502,"Archived HTML failed integrity verification");
  const disposition=req.nextUrl.searchParams.get("download")==="1"?"attachment":"inline";
  return new NextResponse(bytes,{status:200,headers:{
   ...headers,
   "Content-Type":"text/html; charset=utf-8",
   "Content-Disposition":disposition+'; filename="Bluebelly-Private-'+edition.report_day+'-'+id+'.html"',
   "Content-Length":String(bytes.byteLength),
   // Inline replay is inert; links may open only with explicit clicks, and
   // no scripts may execute in the first-party application origin.
   "Content-Security-Policy":"sandbox allow-popups; default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
   "X-Frame-Options":"DENY",
  }});
 }
 const [stored,fromWork]=await Promise.all([
  db.from(HTML_TABLE)
   .select("id,report_day,title,created_at,html_sha256,content_sha256,supersedes_id,review_status,source_manifest")
   .eq("owner_user_id",identity.userId).order("created_at",{ascending:false}).limit(40),
  db.from("blue_desk_work_html_editions")
   .select("id,report_day,title,created_at,html_sha256,content_sha256,review_status,source_manifest,delivery_type")
   .eq("owner_user_id",identity.userId).order("created_at",{ascending:false}).limit(40),
 ]);
 if(stored.error||fromWork.error)return error(503,"Private HTML edition index unavailable");
 const entries=[
  ...(stored.data||[]).map(v=>({...v,delivery_type:"OWNER"})),
  ...(fromWork.data||[]).map(v=>({...v,supersedes_id:null})),
 ].sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,40);
 return NextResponse.json({editions:entries,status:"PRIVATE_ARCHIVE"},{headers});
}
/** No browser HTML upload: the server reconstructs a private reader using
 * the original draft, independently qualified sources and matched X receipts. */
export async function POST(req:NextRequest){
 const identity=await owner(req);
 if(!identity.userId)return error(identity.code,"Private HTML archive unavailable");
 const origin=req.headers.get("origin");
 const host=req.headers.get("host")||req.nextUrl.hostname;
 if(!origin)return error(403,"Same-origin browser action required");
 try{
  const url=new URL(origin);
  if(url.host!==host||!(url.protocol==="https:"||
     (url.protocol==="http:"&&url.hostname==="localhost")))
    return error(403,"Cross-origin request denied");
 }catch{return error(403,"Invalid request origin");}
 // Existing fully laid-out HTML editions may be larger than a text draft.
 // Imported HTML is statically validated and stripped of scripts before upload.
 if(Number(req.headers.get("content-length")||"0")>1100000)
  return error(413,"Archive request too large");
 let payload:unknown;
 try{
  const raw=await req.text();
  if(Buffer.byteLength(raw,"utf8")>1100000)return error(413,"Archive request too large");
  payload=JSON.parse(raw) as unknown;
 }catch{return error(400,"Invalid archive request");}
 if(payload&&typeof payload==="object"&&!Array.isArray(payload)&&
    (payload as Record<string,unknown>).mode==="existing_html"){
  try{
   const result=await importExistingHtmlEdition(identity.userId,payload);
   return NextResponse.json({...result,status:"PRIVATE_DRAFT",
    note:"Imported original links remain attributed, not independently verified."},
    {status:result.created?201:200,headers});
  }catch(e){
   if(e instanceof Error&&["INVALID_HTML_FILE","NOT_BLUEBELLY_HTML",
     "ACTIVE_HTML_NOT_ALLOWED","HTML_TITLE_MISSING","HTML_REPORT_DAY_MISSING"].includes(e.message))
    return error(422,"Import rejected: expected a dated, static Bluebelly HTML reader without active content");
   if(e instanceof Error&&e.message==="HTML_IMPORT_PARENT_NOT_FOUND")
    return error(404,"Correction target not found");
   if(e instanceof Error&&e.message==="HTML_IMPORT_CORRECTION_DAY_MISMATCH")
    return error(422,"Correction and original edition have different report dates");
   return error(503,"Private HTML import unavailable; existing editions unchanged");
  }
 }
 let input:ReturnType<typeof parseArchiveInput>;
 try{input=parseArchiveInput(payload);}
 catch{return error(422,"Invalid HTML edition draft");}
 try{
  const result=await saveHtmlArchive(identity.userId,input);
  return NextResponse.json({
   ...result,status:"PRIVATE_DRAFT",
   message:result.created?"Immutable private HTML edition archived":"Identical edition already archived",
  },{status:result.created?201:200,headers});
 }catch(e){
  if(e instanceof Error&&e.message==="ARCHIVE_PARENT_NOT_OWNED")
   return error(404,"Correction target not found");
  if(e instanceof Error&&e.message==="INVALID_ARCHIVE_INPUT")
   return error(422,"Invalid HTML edition draft");
  return error(503,"HTML edition archive unavailable; existing editions unchanged");
 }
}
