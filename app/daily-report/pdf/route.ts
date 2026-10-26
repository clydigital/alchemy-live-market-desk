import "server-only";
import {NextResponse,type NextRequest} from "next/server";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {isBlueDeskPublicReaderHost} from "@/lib/blue-desk-host";
import {validPublicationId} from "@/lib/editorial-publications";
export const dynamic="force-dynamic";
export const runtime="nodejs";
/** Public only after metadata publication; storage bucket remains private. */
export async function GET(request:NextRequest){
 const host=request.headers.get("host")||request.nextUrl.hostname;
 if(!isBlueDeskPublicReaderHost(host))return new NextResponse(null,{status:404});
 const id=request.nextUrl.searchParams.get("edition");
 if(!validPublicationId(id))return new NextResponse(null,{status:404});
 try{
  const db=createSupabaseAdminClient();
  const {data,error}=await db.from("blue_desk_automated_reports")
   .select("pdf_path,report_day,slot,status")
   .eq("id",id).eq("status","published").maybeSingle();
  if(error||!data||!data.pdf_path)return new NextResponse(null,{status:404});
  const exact=`automated-daily/${data.report_day}/${data.slot}/${id}.pdf`;
  if(data.pdf_path!==exact)return new NextResponse(null,{status:404});
  const {data:blob,error:storageError}=await db.storage.from("editorial-pdfs").download(exact);
  if(storageError||!blob)return new NextResponse(null,{status:404});
  const bytes=await blob.arrayBuffer();
  if(bytes.byteLength<1500||bytes.byteLength>3145728)return new NextResponse(null,{status:502});
  const mode=request.nextUrl.searchParams.get("download")==="1"?"attachment":"inline";
  return new NextResponse(bytes,{headers:{
   "Content-Type":"application/pdf",
   "Content-Disposition":`${mode}; filename="Bluebelly-Market-Intelligence-${data.report_day}-${data.slot}.pdf"`,
   "Content-Length":String(bytes.byteLength),
   "X-Content-Type-Options":"nosniff",
   "Cache-Control":"public, max-age=3600, s-maxage=3600",
  }});
 }catch{return new NextResponse(null,{status:503});}
}
