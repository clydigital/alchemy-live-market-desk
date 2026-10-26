import "server-only";
import {NextResponse,type NextRequest} from "next/server";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {blueDeskHostAccess} from "@/lib/blue-desk-host";
export const dynamic="force-dynamic";
export const runtime="nodejs";
const HEADERS={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
const fail=(status:number,error:string)=>NextResponse.json({error},{status,headers:HEADERS});
async function authenticated(req:NextRequest){
 const host=req.headers.get("host")||req.nextUrl.hostname;
 if(blueDeskHostAccess("/api/owner/macropulse-briefs",host)!=="private")
  return {error:fail(404,"Not found")};
 const session=await createSupabaseServerClient().catch(()=>null);
 if(!session)return {error:fail(503,"Owner login unavailable")};
 const {data:{user},error}=await session.auth.getUser();
 if(error||!user?.email)return {error:fail(401,"Sign in to owner workspace")};
 const email=user.email.trim().toLowerCase();
 const {data:allowed,error:accessError}=await session.from("app_access_allowlist")
  .select("email").eq("email",email).eq("active",true).maybeSingle();
 if(accessError||!allowed)return {error:fail(403,"Account not authorised")};
 return {email};
}
export async function GET(req:NextRequest){
 const auth=await authenticated(req);if(auth.error)return auth.error;
 try{
  const admin=createSupabaseAdminClient();
  const {data,error}=await admin.from("blue_desk_macropulse_briefs")
   .select("id,source_page_id,source_pulse_id,source_page_url,source_published_at,source_retrieved_at,headline,standfirst,what_changed,why_it_matters,countercase,watch_next,source_links,primary_region,verification_label,received_at,digest_sha256")
   .eq("status","review").order("received_at",{ascending:false}).limit(15);
  return error?fail(503,"Brief review queue unavailable"):
   NextResponse.json({status:"REVIEW_REQUIRED",briefs:data||[]},{headers:HEADERS});
 }catch{return fail(503,"Brief review queue unavailable");}
}
// Owner receives and reads research; no action publishes it publicly.
export async function POST(){
 return fail(410,"Public digest publication is disabled. MacroPulse remains private research.");
}
