import "server-only";
import {NextResponse,type NextRequest} from "next/server";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {validPublicationId} from "@/lib/editorial-publications";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(_request:NextRequest,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 if(!validPublicationId(id))return new NextResponse(null,{status:404});
 try{
  const admin=createSupabaseAdminClient();
  const {data:entry,error}=await admin.from("editorial_publications")
   .select("pdf_path,status").eq("id",id).eq("status","published").maybeSingle();
  if(error||!entry?.pdf_path)return new NextResponse(null,{status:404});
  const expected="reports/"+id+"/";
  if(!entry.pdf_path.startsWith(expected)||
    !/^reports\/[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/.test(entry.pdf_path))
   return new NextResponse(null,{status:404});
  const {data:blob,error:fetchError}=await admin.storage.from("editorial-pdfs")
   .download(entry.pdf_path);
  if(fetchError||!blob)return new NextResponse(null,{status:404});
  const bytes=await blob.arrayBuffer();
  return new NextResponse(bytes,{headers:{
   "Content-Type":"application/pdf",
   "Content-Disposition":'inline; filename="bluebelly-'+id+'.pdf"',
   "Content-Length":String(bytes.byteLength),
   "X-Content-Type-Options":"nosniff",
   "Cache-Control":"public, max-age=3600, s-maxage=86400",
  }});
 }catch{return new NextResponse(null,{status:503});}
}
