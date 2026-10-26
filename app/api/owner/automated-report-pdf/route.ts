import "server-only";
import {NextResponse,type NextRequest} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {blueDeskHostAccess} from "@/lib/blue-desk-host";
import {validPublicationId} from "@/lib/editorial-publications";

export const dynamic="force-dynamic";
export const runtime="nodejs";
const headers={"Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff","Vary":"Cookie"};
const denied=(code:number)=>new NextResponse(null,{status:code,headers});

/** The generated PDF is personal research. No anonymous path, public host,
 * cached response, guessed storage key or merely client-claimed identity. */
export async function GET(request:NextRequest){
 const host=request.headers.get("host")||request.nextUrl.hostname;
 if(blueDeskHostAccess("/api/owner/automated-report-pdf",host)!=="private")return denied(404);
 const session=await createSupabaseServerClient().catch(()=>null);
 if(!session)return denied(503);
 const {data:{user},error:authError}=await session.auth.getUser();
 if(authError||!user?.email)return denied(401);
 const {data:allowed,error:accessError}=await session.from("app_access_allowlist")
   .select("email").eq("email",user.email.toLowerCase().trim()).eq("active",true).maybeSingle();
 if(accessError||!allowed)return denied(403);
 const id=request.nextUrl.searchParams.get("edition");
 if(!validPublicationId(id))return denied(404);
 try{
  const db=createSupabaseAdminClient();
  const {data,error}=await db.from("blue_desk_automated_reports")
   .select("pdf_path,report_day,slot,status").eq("id",id).eq("status","ready").maybeSingle();
  if(error||!data||!data.pdf_path)return denied(404);
  const exact=`automated-daily/${data.report_day}/${data.slot}/${id}.pdf`;
  if(data.pdf_path!==exact)return denied(404);
  const {data:blob,error:storageError}=await db.storage.from("editorial-pdfs").download(exact);
  if(storageError||!blob)return denied(404);
  const bytes=await blob.arrayBuffer();
  if(bytes.byteLength<1500||bytes.byteLength>3145728)return denied(502);
  const mode=request.nextUrl.searchParams.get("download")==="1"?"attachment":"inline";
  return new NextResponse(bytes,{headers:{
   ...headers,"Content-Type":"application/pdf",
   "Content-Disposition":`${mode}; filename="Bluebelly-Private-Market-Report-${data.report_day}-${data.slot}.pdf"`,
   "Content-Length":String(bytes.byteLength),
  }});
 }catch{return denied(503);}
}
