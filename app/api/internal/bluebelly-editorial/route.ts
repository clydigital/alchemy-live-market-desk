import "server-only";
import {createHash} from "node:crypto";
import {NextResponse,type NextRequest} from "next/server";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {blueDeskHostAccess,isBlueDeskPublicReaderHost} from "@/lib/blue-desk-host";
import {acceptsMacroPulseIngest,scopedMacroPulseToken} from "@/lib/blue-desk-macropulse-ingest-auth";
import {parseMacroPulseDigest} from "@/lib/blue-desk-macropulse-brief";
import {attestMacroPulseNotionSource} from "@/lib/blue-desk-macropulse-notion-attestation";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=30;
const HEADERS={"Cache-Control":"private, no-store","Vary":"Authorization","X-Content-Type-Options":"nosniff"};
const fail=(status:number,message:string)=>NextResponse.json({error:message},{status,headers:HEADERS});

/**
 * Transport only: Composio/ChatGPT editorial output -> owner REVIEW queue.
 * Does not claim independent verification, revise a thesis or publish a PDF.
 */
export async function POST(req:NextRequest){
 const host=req.headers.get("host")||req.nextUrl.hostname;
 if(isBlueDeskPublicReaderHost(host)||
    blueDeskHostAccess("/api/internal/bluebelly-editorial",host)!=="private")
   return fail(404,"Not found");
 const token=process.env.BLUEBELLY_MACROPULSE_INGEST_TOKEN;
 if(!scopedMacroPulseToken(token))return fail(503,"Editorial ingest is not configured");
 if(!acceptsMacroPulseIngest(req.headers.get("authorization"),token))
   return fail(401,"Unauthorised");
 if(!req.headers.get("content-type")?.startsWith("application/json"))
   return fail(415,"Expected application/json");
 const bytes=Number(req.headers.get("content-length")||"0");
 if(bytes>18000||bytes<0)return fail(413,"Digest too large");
 let raw:string;
 try{raw=await req.text();}catch{return fail(400,"Invalid body");}
 if(raw.length>18000)return fail(413,"Digest too large");
 let input:unknown;try{input=JSON.parse(raw);}catch{return fail(400,"Invalid JSON");}
 const mode=input&&typeof input==="object"&&!Array.isArray(input)
  ?(input as Record<string,unknown>).proofMode:undefined;
 if(mode!==undefined&&mode!=="NOTION_SOURCE_ATTESTED")
  return fail(422,"Unknown source proof mode");
 if(process.env.BLUEBELLY_REQUIRE_NOTION_ATTESTATION==="true"&&
    mode!=="NOTION_SOURCE_ATTESTED")
  return fail(422,"Notion source attestation required");
 const parsed=parseMacroPulseDigest(input,new Date());
 if(!parsed)return fail(422,"Invalid MacroPulse editorial digest");
 let digest=parsed;
 if(mode==="NOTION_SOURCE_ATTESTED"){
  // ChatGPT-side OAuth cannot be reused in this runtime. This requires a
  // separately authorised, READ-ONLY Notion integration scoped to MacroPulse.
  const readToken=process.env.BLUEBELLY_NOTION_RESEARCH_TOKEN?.trim();
  if(!readToken)return fail(503,"Notion source verification unavailable");
  try{
   const attested=await attestMacroPulseNotionSource(parsed,readToken);
   if(!attested)return fail(422,"Original Notion source proof failed");
   // Replace schedule-supplied clocks with native page creation (proxy)
   // and this independent Notion retrieval time. Claim facts still research-only.
   const verified=parseMacroPulseDigest({
    ...(input as Record<string,unknown>),
    sourcePublishedAt:attested.sourceCreatedAt,
    sourceRetrievedAt:attested.retrievedAt,
   },new Date());
   if(!verified)return fail(422,"Invalid attested source clocks");
   digest=verified;
  }catch{return fail(503,"Original Notion source could not be read");}
 }
 const stable={pulse:digest.sourcePulseId,headline:digest.headline,
  standfirst:digest.standfirst,whatChanged:digest.whatChanged,
  whyItMatters:digest.whyItMatters,countercase:digest.countercase,
  watchNext:digest.watchNext,primaryRegion:digest.primaryRegion,
  sourceLinks:digest.sourceLinks};
 const sha=createHash("sha256").update(JSON.stringify(stable)).digest("hex");
 try{
  const admin=createSupabaseAdminClient();
  const {data,error}=await admin.from("blue_desk_macropulse_briefs").insert({
   source_page_id:digest.sourcePageId,source_pulse_id:digest.sourcePulseId,
   source_page_url:digest.sourcePageUrl,
   source_published_at:digest.sourcePublishedAt,source_retrieved_at:digest.sourceRetrievedAt,
   digest_sha256:sha,
   headline:digest.headline,standfirst:digest.standfirst,
   what_changed:digest.whatChanged,why_it_matters:digest.whyItMatters,
   countercase:digest.countercase,watch_next:digest.watchNext,
   source_links:digest.sourceLinks,primary_region:digest.primaryRegion,
   editorial_model:digest.editorialModel,status:"review",
   verification_label:"RESEARCH_DERIVED_UNADJUDICATED",
  }).select("id,status").single();
  if(error?.code==="23505"){
   const {data:existing}=await admin.from("blue_desk_macropulse_briefs")
    .select("id,status").eq("source_page_id",digest.sourcePageId)
    .eq("digest_sha256",sha).maybeSingle();
   return existing?NextResponse.json({status:existing.status,id:existing.id,duplicate:true},
    {status:200,headers:HEADERS}):fail(503,"Existing draft lookup unavailable");
  }
  if(error||!data)return fail(503,"Digest storage unavailable");
  return NextResponse.json({status:"review",id:data.id,duplicate:false},
   {status:202,headers:HEADERS});
 }catch{return fail(503,"Digest intake unavailable");}
}
