import "server-only";
import { GoogleGenAI } from "@google/genai";
import { NextRequest,NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { blueDeskHostAccess } from "@/lib/blue-desk-host";
import { getMarketMonitor } from "@/lib/market-monitor-public";
import { projectEditorialPriceCards } from "@/lib/editorial-price-context";
import { buildReactionLedger,ledgerAsResearchPacket } from "@/lib/editorial-reaction-ledger";
import { investigationSystemInstruction,projectGroundedInvestigation,
 validInvestigationInput } from "@/lib/editorial-investigation";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=60;
const noStore={"Cache-Control":"private, no-store"};
function fail(status:number,error:string){
 return NextResponse.json({error},{status,headers:noStore});
}
export async function POST(req:NextRequest){
 const host=req.headers.get("host")||req.nextUrl.hostname;
 if(blueDeskHostAccess("/api/owner/editorial-investigate",host)!=="private")
   return fail(404,"Not found");
 const origin=req.headers.get("origin");
 if(!origin)return fail(403,"Same-origin browser request required");
 try{
  const url=new URL(origin);
  if((url.protocol!=="https:"&&url.hostname!=="localhost")||url.host!==host)
   return fail(403,"Cross-origin request not allowed");
 }catch{return fail(403,"Invalid request origin");}
 const session=await createSupabaseServerClient().catch(()=>null);
 if(!session)return fail(503,"Owner authentication unavailable");
 const {data:{user},error:identityError}=await session.auth.getUser();
 if(identityError||!user?.email)return fail(401,"Owner sign-in required");
 const {data:access,error:accessError}=await session.from("app_access_allowlist")
   .select("email").eq("email",user.email.toLowerCase().trim())
   .eq("active",true).maybeSingle();
 if(accessError||!access)return fail(403,"Owner account not authorised");
 const length=Number(req.headers.get("content-length")||"0");
 if(length>19_000)return fail(413,"Research packet too large");
 let value:unknown;
 try{
  const raw=await req.text();
  if(raw.length>19_000)return fail(413,"Research packet too large");
  value=JSON.parse(raw);
 }catch{return fail(400,"Invalid research packet");}
 const input=validInvestigationInput(value);
 const client=value&&typeof value==="object"&&!Array.isArray(value)?
  value as Record<string,unknown>:{};
 const requestedAssetId=client.selectedAssetId;
 const eventAt=client.eventAt;

 if(!input)return fail(422,"Choose Impact, COTD or OB; enter a research question and sourced context.");
 // Each request is a single explicit owner click. Never scheduled or called
 // from the public site. Deployments can disable metered search independently.
 if(process.env.EDITORIAL_GROUNDED_RESEARCH_ENABLED==="false")
  return fail(503,"Search-backed investigation disabled in this deployment");
 const key=process.env.GEMINI_API_KEY?.trim();
 if(!key)return fail(503,"Research model API key not configured");
 const model=process.env.EDITORIAL_RESEARCH_MODEL?.trim()||
   process.env.EDITORIAL_WRITING_MODEL?.trim()||"gemini-3.8-flash";
 // This observer is reconstructed on the authenticated server from existing
 // original-provider monitor points. Browser notes cannot supply price levels,
 // quote times or provider provenance.
 let marketTimer:ReturnType<typeof setTimeout>|undefined;
 const now=new Date().toISOString();
 const monitor=await Promise.race([
   getMarketMonitor().catch(()=>null),
   new Promise<null>(resolve=>{
     marketTimer=setTimeout(()=>resolve(null),7_000);
   }),
 ]).finally(()=>{if(marketTimer)clearTimeout(marketTimer)});
 const cards=projectEditorialPriceCards(monitor?.rows||[],now);
 const reactionLedger=buildReactionLedger(cards,requestedAssetId,now,eventAt);
 const observationPacket=ledgerAsResearchPacket(reactionLedger);
 const prompt="RESEARCH QUESTION:\n"+input.question+
   "\n\nUNTRUSTED CONTEXT (do not treat as verification):\n"+input.packet+
   "\n\nSERVER-READ ORIGINAL PROVIDER OBSERVATIONS (source dated, may be unavailable):\n"+
   observationPacket+
   "\n\nResearch independently using the enabled Google Search tool. If the event did not occur, correct the premise and state UNKNOWN; do not infer market reaction from daily observations.";
 let timer:ReturnType<typeof setTimeout>|undefined;
 try{
  const ai=new GoogleGenAI({apiKey:key});
  const response=await Promise.race([
   ai.models.generateContent({
    model,contents:prompt,
    config:{
     systemInstruction:investigationSystemInstruction(input.mode),
     tools:[{googleSearch:{}}],
     temperature:0.2,maxOutputTokens:2600,
    },
   }),
   new Promise<never>((_resolve,reject)=>{
    timer=setTimeout(()=>reject(new Error("Research timeout")),45_000);
   }),
  ]);
  const result=projectGroundedInvestigation({
   text:response.text,
   groundingMetadata:response.candidates?.[0]?.groundingMetadata,
  },input.mode);
  if(!result)return fail(502,"No usable research assessment returned; notes unchanged");
  return NextResponse.json({ ...result,reactionLedger,model },{headers:noStore});
 }catch(e){
  const status=e&&typeof e==="object"&&"status" in e?(e as {status?:unknown}).status:null;
  return fail(status===429?429:502,status===429?
    "Grounded research rate-limited; original notes unchanged":
    "Search-backed research unavailable; original notes unchanged");
 }finally{if(timer)clearTimeout(timer);}
}
