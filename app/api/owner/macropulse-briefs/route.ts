import "server-only";
import {NextResponse,type NextRequest} from "next/server";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {blueDeskHostAccess} from "@/lib/blue-desk-host";
import {parseDigestApproval,dispatchIsReviewable} from "@/lib/blue-desk-macropulse-publication";
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
  // Database receipt health is independent of the Vercel server-to-server
  // tokens. ChatGPT Work may deliver through the authorised connected
  // Supabase tool even when both server-side token routes are absent.
  const [queued,latest]=await Promise.all([
   admin.from("blue_desk_macropulse_briefs")
    .select("id,source_page_id,source_pulse_id,source_page_url,source_published_at,source_retrieved_at,headline,standfirst,what_changed,why_it_matters,countercase,watch_next,source_links,primary_region,verification_label,received_at,digest_sha256")
    .eq("status","review").order("received_at",{ascending:false}).limit(15),
   admin.from("blue_desk_macropulse_briefs")
    .select("id,status,received_at,source_published_at,source_pulse_id")
    .order("received_at",{ascending:false}).limit(1).maybeSingle(),
  ]);
  if(queued.error||latest.error)return fail(503,"Brief review queue unavailable");
  return NextResponse.json({status:"REVIEW_REQUIRED",briefs:queued.data||[],deliveryHealth:{
    notionReaderConfigured:Boolean(process.env.NOTION_API_TOKEN?.trim()||process.env.NOTION_MARKET_RESEARCH_TOKEN?.trim()),
    macroPulseIngestConfigured:Boolean(process.env.BLUEBELLY_MACROPULSE_INGEST_TOKEN?.trim()),
    latestDraftAt:latest.data?.received_at||null,
    latestSourceAt:latest.data?.source_published_at||null,
    latestStoredStatus:latest.data?.status||null,
    // This is a receipt, NOT proof that a particular scheduled Work run
    // completed, that the Notion backlog was fully processed, or that
    // the public website received the research.
    automaticWorkBridgeVerified:false,
   }},{headers:HEADERS});
 }catch{return fail(503,"Brief review queue unavailable");}
}
/**
 * Only an authenticated, active owner may explicitly publish one already
 * delivered, bounded research digest. This is a publication attestation,
 * NOT the verification of a price reaction or a canonical Story mutation.
 * Same-origin check prevents cross-site cookie-driven approval.
 */
export async function POST(req:NextRequest){
 const auth=await authenticated(req);if(auth.error)return auth.error;
 const origin=req.headers.get("origin");
 const host=req.headers.get("host")||req.nextUrl.hostname;
 let originHost:string;
 try{originHost=origin?new URL(origin).host:"";}catch{return fail(403,"Same-origin review required");}
 if(!originHost||originHost!==host)return fail(403,"Same-origin review required");
 if(!req.headers.get("content-type")?.startsWith("application/json"))return fail(415,"Expected JSON");
 const len=Number(req.headers.get("content-length")||0);
 if(!Number.isFinite(len)||len>1200||len<0)return fail(413,"Review request too large");
 let input:unknown;
 try{
  const raw=await req.text();
  if(raw.length>1200)return fail(413,"Review request too large");
  input=JSON.parse(raw);
 }catch{return fail(400,"Invalid review request");}
 const approval=parseDigestApproval(input);
 if(!approval)return fail(422,"All source, clock, countercase and public-label checks required");
 try{
  const admin=createSupabaseAdminClient();
  const {data:row,error:readError}=await admin.from("blue_desk_macropulse_briefs")
   .select("id,status,digest_sha256,source_published_at,source_retrieved_at,verification_label,source_links")
   .eq("id",approval.id).maybeSingle();
  if(readError)return fail(503,"Review record unavailable");
  if(!row)return fail(404,"Review item not found");
  if(row.digest_sha256!==approval.digestSha256)return fail(409,"Digest changed; reload and review again");
  const now=new Date();
  if(!dispatchIsReviewable(row,now))return fail(409,"Digest is stale, incomplete or no longer reviewable");
  const {data:updated,error:writeError}=await admin.from("blue_desk_macropulse_briefs")
   .update({status:"published",published_at:now.toISOString(),reviewed_by:auth.email})
   .eq("id",approval.id).eq("digest_sha256",approval.digestSha256)
   .eq("status","review")
   .select("id,status,digest_sha256,published_at").maybeSingle();
  if(writeError)return fail(503,"Approval storage failed");
  if(!updated)return fail(409,"Concurrent review: reload queue");
  if(updated.status!=="published"||updated.digest_sha256!==approval.digestSha256||
     !updated.published_at)return fail(503,"Publication readback failed");
  return NextResponse.json({
   status:"published",id:updated.id,digestSha256:updated.digest_sha256,
   publishedAt:updated.published_at,label:"RESEARCH_DERIVED_UNADJUDICATED",
  },{headers:HEADERS});
 }catch{return fail(503,"Publication unavailable");}
}
