import "server-only";
import {GoogleGenAI} from "@google/genai";
import {NextResponse,type NextRequest} from "next/server";
import {blueDeskHostAccess} from "@/lib/blue-desk-host";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {parseDailyArticlePlan,DESK_CHARTS} from "@/lib/blue-desk-daily-article-plan";
export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=60;
const headers={"Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"};
const fail=(status:number,error:string)=>NextResponse.json({error},{status,headers});
export async function POST(req:NextRequest){
 const host=req.headers.get("host")||req.nextUrl.hostname;
 if(blueDeskHostAccess("/api/owner/daily-article-plan",host)!=="private")
   return fail(404,"Not found");
 const origin=req.headers.get("origin");
 try{const o=new URL(origin||"");if(o.host!==host||
  (o.protocol!=="https:"&&o.hostname!=="localhost"))return fail(403,"Invalid origin");
 }catch{return fail(403,"Same-origin request required");}
 const client=await createSupabaseServerClient().catch(()=>null);
 if(!client)return fail(503,"Sign-in unavailable");
 const {data:{user},error}=await client.auth.getUser();
 if(error||!user?.email)return fail(401,"Owner sign-in required");
 const {data:allowed,error:accessError}=await client.from("app_access_allowlist")
  .select("email").eq("email",user.email.trim().toLowerCase())
  .eq("active",true).maybeSingle();
 if(accessError||!allowed)return fail(403,"Account not approved");
 const size=Number(req.headers.get("content-length")||"0");
 if(size>30000)return fail(413,"Research packet too large");
 let input:Record<string,unknown>;
 try{const raw=await req.text();if(raw.length>30000)return fail(413,"Research packet too large");
  const value=JSON.parse(raw);if(!value||typeof value!=="object"||Array.isArray(value))
   return fail(400,"Invalid packet");input=value;
 }catch{return fail(400,"Invalid packet");}
 const packet=typeof input.packet==="string"?input.packet.trim().slice(0,24000):"";
 const asOf=typeof input.assembledAt==="string"?input.assembledAt:"";
 const stamp=Date.parse(asOf);
 if(packet.length<250||!Number.isFinite(stamp)||stamp>Date.now()+120000||
    Date.now()-stamp>48*3600_000)return fail(422,"A fresh, dated research packet is required");
 const key=process.env.GEMINI_API_KEY?.trim();
 if(!key)return fail(503,"Private editorial model unavailable");
 const charts=Object.entries(DESK_CHARTS).map(([code,x])=>code+": "+x.prompt).join("\n");
 const system=[
 "You are preparing private ORIGINAL market article pitches in Lee Yang's British English style.",
 "Return ONLY strict JSON with key ideas, containing EXACTLY FOUR distinct article ideas.",
 "Use three only if the supplied research cannot substantiate four distinct angles.",
 "Include at least one COTD and one OB; favour 2 COTD and 2 OB.",
 "Titles must be max 63 characters, vivid but not sensational.",
 "For every idea: title, kind, angle (70-400 chars), whyItMatters (65-400 chars),",
 "whatToVerify (55-430 chars), chartSymbols array (1-3 codes), chartChecks array (1-3 descriptive checks).",
 "Start from a specific event actually present in the source packet; explain the step-by-step",
 "transmission to rates, FX, oil, equities or earnings. Explicitly distinguish conditional",
 "effects from observed reactions. No invented earnings, prices, breakout signals, sources or events.",
 "Do not copy sentences from the research notes, transcripts, media or previous articles.",
 "Rephrase from verified facts and write fresh commentary; direct quotes require approval.",
 "Never treat author commentary, creator leads or Notion notes as independent verification.",
 "If data are partial, explain that plainly and focus pitches on questions not unsupported claims.",
 "Select ONLY from the following chart codes, and never claim a chart signal is confirmed:",
 charts,
 ].join("\n");
 try{
  const ai=new GoogleGenAI({apiKey:key});
  const reply=await ai.models.generateContent({model:process.env.EDITORIAL_WRITING_MODEL?.trim()||"gemini-3.8-flash",
   contents:"Research assembled at "+asOf+"\n"+packet,
   config:{systemInstruction:system,temperature:0.35,maxOutputTokens:2700,
    responseMimeType:"application/json"}});
  const txt=reply.text||"";
  let parsed:unknown;
  try{parsed=JSON.parse(txt);}catch{return fail(502,"Model returned an invalid article plan");}
  const ideas=parseDailyArticlePlan(parsed);
  if(!ideas)return fail(502,"Model plan needs clearer distinct ideas and chart/source checks");
  return NextResponse.json({status:"PRIVATE_PLAN_REVIEW_REQUIRED",assembledAt:asOf,ideas},
    {status:200,headers});
 }catch{return fail(502,"Private editorial planning failed; research packet unchanged");}
}
