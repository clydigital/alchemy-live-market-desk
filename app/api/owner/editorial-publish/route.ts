import "server-only";
import {createHash,randomUUID} from "node:crypto";
import {NextResponse,type NextRequest} from "next/server";
import {blueDeskHostAccess} from "@/lib/blue-desk-host";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {isLikelyPdf,parseReviewedSubmission} from "@/lib/editorial-publications";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
const noStore={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
function fail(status:number,message:string){
 return NextResponse.json({error:message},{status,headers:noStore});
}
export async function POST(req:NextRequest){
 const host=req.headers.get("host")||req.nextUrl.hostname;
 if(blueDeskHostAccess("/api/owner/editorial-publish",host)!=="private")
  return fail(404,"Not found");
 const origin=req.headers.get("origin");
 if(!origin)return fail(403,"Same-origin browser request required");
 try{
  const u=new URL(origin);
  if((u.protocol!=="https:"&&u.hostname!=="localhost")||u.host!==host)
   return fail(403,"Cross-origin request denied");
 }catch{return fail(403,"Invalid origin");}
 const size=Number(req.headers.get("content-length")||"0");
 if(!Number.isFinite(size)||size>3_750_000)
  return fail(413,"Publication request too large (PDF maximum 3 MB)");
 const session=await createSupabaseServerClient().catch(()=>null);
 if(!session)return fail(503,"Owner authentication unavailable");
 const {data:{user},error:authError}=await session.auth.getUser();
 if(authError||!user?.email)return fail(401,"Owner sign-in required");
 const {data:approved,error:accessError}=await session.from("app_access_allowlist")
  .select("email").eq("email",user.email.trim().toLowerCase()).eq("active",true)
  .maybeSingle();
 if(accessError||!approved)return fail(403,"Owner account not approved");

 if(!process.env.SUPABASE_SERVICE_ROLE_KEY)
  return fail(503,"Publication storage is not configured");
 let form:FormData;
 try{form=await req.formData();}catch{return fail(400,"Invalid multipart request");}
 const raw=form.get("publication");
 const file=form.get("pdf");
 if(typeof raw!=="string"||raw.length>20_000||!(file instanceof File))
  return fail(422,"Provide the complete reviewed article metadata and a PDF");
 const checks=["sourcesChecked","chartsChecked","copyApproved","publicRightsConfirmed"];
 if(!checks.every(x=>form.get(x)==="yes"))
  return fail(422,"Original sources, charts, editorial copy and public PDF rights must be reviewed");
 let draft:unknown;
 try{draft=JSON.parse(raw);}catch{return fail(400,"Invalid publication JSON");}
 const article=parseReviewedSubmission(draft);
 if(!article)return fail(422,"Invalid title, body, excerpt or original HTTPS source URLs");
 if(file.size>3145728||file.size<400||file.type!=="application/pdf")
  return fail(422,"PDF must be a real application/pdf file smaller than 3 MB");
 const bytes=new Uint8Array(await file.arrayBuffer());
 if(!isLikelyPdf(bytes))return fail(422,"File content is not a valid PDF signature");
 const id=randomUUID(),fileId=randomUUID();
 const path="reports/"+id+"/"+fileId+".pdf";
 const sha=createHash("sha256").update(bytes).digest("hex");
 const admin=createSupabaseAdminClient();
 const {error:storageError}=await admin.storage.from("editorial-pdfs").upload(path,bytes,{
  contentType:"application/pdf",upsert:false,cacheControl:"31536000",
 });
 if(storageError)return fail(503,"PDF storage unavailable; nothing published");
 const {error:dbError}=await admin.from("editorial_publications").insert({
  id,kind:article.kind,title:article.title,meta_description:article.meta_description,
  body:article.body,excerpt:article.excerpt,source_urls:article.source_urls,
  status:"published",pdf_path:path,pdf_sha256:sha,
 });
 if(dbError){
  await admin.storage.from("editorial-pdfs").remove([path]).catch(()=>null);
  return fail(503,"Publication record could not be saved; nothing is publicly listed");
 }
 return NextResponse.json({
  status:"PUBLISHED",id,
  articleUrl:"/reports/"+id,pdfUrl:"/reports/"+id+"/pdf",
 },{status:201,headers:noStore});
}
