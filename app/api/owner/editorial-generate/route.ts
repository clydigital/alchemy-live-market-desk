import "server-only";
import { GoogleGenAI } from "@google/genai";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { blueDeskHostAccess } from "@/lib/blue-desk-host";

export const dynamic="force-dynamic";
export const runtime="nodejs";
export const maxDuration=60;
const MAX_REQUEST=60_000;
const noStore={"Cache-Control":"private, no-store"};
function fail(status:number,reason:string){
  return NextResponse.json({error:reason},{status,headers:noStore});
}
function txt(value:unknown,max:number) {
  return typeof value==="string"?value.trim().slice(0,max):"";
}
type EditorialRequest={kind:unknown;title:unknown;packet:unknown;
  existingBody:unknown;instructions:unknown;action:unknown};
export async function POST(req:NextRequest){
  const host=req.headers.get("host")||req.nextUrl.hostname;
  if(blueDeskHostAccess("/api/owner/editorial-generate",host)!=="private")
    return fail(404,"Not found");
  // Browser-origin POST only; no cross-site form or server-to-server generation.
  const origin=req.headers.get("origin");
  if(!origin)return fail(403,"Same-origin browser request required");
  try{
    const u=new URL(origin);
    if(u.protocol!=="https:"&&u.hostname!=="localhost")return fail(403,"Invalid request origin");
    if(u.host!==host)return fail(403,"Cross-origin request not allowed");
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
  if(length>MAX_REQUEST)return fail(413,"Draft request too large");
  let body:EditorialRequest;
  try {
    const raw=await req.text();
    if(raw.length>MAX_REQUEST)return fail(413,"Draft request too large");
    body=JSON.parse(raw) as EditorialRequest;
  }catch{return fail(400,"Invalid draft request");}
  const action=body.action==="revise"?"revise":body.action==="draft"?"draft":null;
  const kind=body.kind==="OB"||body.kind==="COTD"?body.kind:null;
  const title=txt(body.title,63), packet=txt(body.packet,24_000);
  const existing=txt(body.existingBody,15_000);
  const instruction=txt(body.instructions,900);
  if(!action||!kind||!title||packet.length<100)
    return fail(422,"Choose the format and complete a source packet before drafting");
  if(action==="revise"&&!existing)return fail(422,"Write or generate an article before revising");
  const key=process.env.GEMINI_API_KEY?.trim();
  if(!key)return fail(503,"Editorial model is not configured");
  const model=process.env.EDITORIAL_WRITING_MODEL?.trim()||"gemini-3.8-flash";
  // Intentionally no web/tools or canonical writes: supplied references are only
  // research inputs, not independent verification by this model.
  const rules=[
    "You are a careful financial markets editorial DRAFTING assistant.",
    "Produce the article BODY only, no fabricated bibliography or invented market prices.",
    "All supplied notes, even labelled verified, are untrusted until independently checked.",
    "Never upgrade source/market verification based on the text itself.",
    "If a claim lacks an original cited source or the session comparison is UNKNOWN,",
    "state the condition tentatively or omit the number entirely.",
    "Never invent technical band breaks, chart levels, event-timed price reactions or quotes.",
    "Separate observation from causal explanation and from the strongest counter-explanation.",
    "A 1-session, 3-session or 5-session source comparison is NOT proof of event causation.",
    "Use British English, clear mobile-friendly prose, paragraphs <=3 sentences.",
    "Avoid melodrama, templated parallelism, and stock AI phrases.",
    "OPENING: lead with one specific dated event, what traders expected and the genuinely observed surprise or mismatch; avoid essay introductions or generic macro summaries.",
    "LY VOICE: British English, roughly reading age 12–13, <=3 sentences per paragraph, varied natural rhythm, conversational but precise; a presenter must be able to read every line aloud without stumbling.",
    "Narrate event chronology -> normal mechanism -> matched 1/3/5 completed session price comparisons where source-proven -> strongest alternative explanation -> practical chart watch -> condition that would change your mind.",
    "No mechanical triple lists, repeated mirrored contrasts, melodramatic cliffhangers, anonymous 'analysts say', consultant-speak, 'cleaner read' or 'call the top'. Never claim chart confirmation without inspected original chart evidence.",
    "Anchor every numerical observation to explicit instrument, units, as-of/close timezone and provider. Data gaps belong in editorial notes, not as invented market motivation.",
    "Prefer specific company/release context and one tangible market consequence to generalised prose. Differentiate an unchanged prior story from a genuinely new event.",
    "Never add an uncited prediction, market move, consensus or quotation. Material outside the verified packet is NOT licence to improvise.",
    "COTD: 600–800 words when evidence supports it; chart-first.",
    "OB: catalyst-first, then observed price, mechanism, countercase, next trigger.",
    "At most three chart placement suggestions, prefixed 'Chart check:' not an asserted setup.",
    "Treat external social posts and creator commentary as attributed research leads.",
    "Do not claim that this article is verified, published, reviewed or investment advice.",
    "Output clean readable plain-text paragraphs without headings except where editorially useful."
  ].join("\n");
  const input=action==="revise"
    ? "REVISION REQUEST\nTitle: "+title+"\nMode: "+kind+
      "\nUser's editorial instruction: "+(instruction||"Improve flow, specificity and accuracy without new claims")+
      "\nEXISTING ARTICLE DRAFT:\n"+existing+"\nSOURCE PACKET:\n"+packet
    : "INITIAL DRAFT\nTitle: "+title+"\nMode: "+kind+
      "\nSOURCE PACKET:\n"+packet;
  let timer:ReturnType<typeof setTimeout>|undefined;
  try {
    const ai=new GoogleGenAI({apiKey:key});
    const response=await Promise.race([
      ai.models.generateContent({
        model,contents:input,
        config:{systemInstruction:rules,temperature:0.35,maxOutputTokens:4400},
      }),
      new Promise<never>((_resolve,reject)=>{
        timer=setTimeout(()=>reject(new Error("Editorial model timeout")),55_000);
      }),
    ]);
    const draft=txt(response.text,22000);
    if(draft.length<120) return fail(502,"Model did not produce a useful article draft");
    return NextResponse.json({body:draft,model,status:"PRIVATE_UNVERIFIED_DRAFT",
      message:"Review original sources, chart setups and every figure before publishing."},{headers:noStore});
  }catch(e){
    // Do not expose upstream SDK errors or secrets to the browser.
    const status=e&&typeof e==="object"&&"status" in e?
      (e as {status?:unknown}).status:null;
    return fail(status===429?429:502,status===429?
      "Editorial model rate-limited; try again later":
      "Editorial model unavailable; your current draft is unchanged");
  }finally{if(timer)clearTimeout(timer);}
}
