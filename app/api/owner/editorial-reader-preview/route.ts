import "server-only";
import {NextResponse,type NextRequest} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {blueDeskHostAccess} from "@/lib/blue-desk-host";
import {getCurrentVerifiedMarketMotion} from "@/lib/market-motion";
import {selectVerifiedNewsBriefs} from "@/lib/market-brief-news";
import {getOriginalPressNews} from "@/lib/blue-desk-original-press-news-server";
import {combineQualifiedNews} from "@/lib/blue-desk-qualified-news";
import {buildPrivateDailyReaderDraft} from "@/lib/bluebelly-editorial-draft-preview";
import {renderPrivateEditorialReaderHtml} from "@/lib/bluebelly-editorial-reader";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export const maxDuration=60;
const headers={
 "Cache-Control":"private, no-store, max-age=0",
 "Vary":"Cookie",
 "X-Content-Type-Options":"nosniff",
 "Referrer-Policy":"no-referrer",
};
const fail=(status:number,error:string)=>NextResponse.json({error},{status,headers});
/** Authenticated on-demand draft layout only. NEVER published or stored.
 * Claims in the editor body are unverified; the server builds the original
 * source ledger independently of any URLs supplied by the browser.
 */
export async function POST(req:NextRequest){
 const host=req.headers.get("host")||req.nextUrl.hostname;
 const path="/api/owner/editorial-reader-preview";
 if(blueDeskHostAccess(path,host)!=="private")return fail(404,"Not found");
 const origin=req.headers.get("origin");
 if(!origin)return fail(403,"Same-origin browser action required");
 try{
  const o=new URL(origin);
  if(!["https:","http:"].includes(o.protocol)||o.host!==host||
     (o.protocol==="http:"&&o.hostname!=="localhost"))return fail(403,"Cross-origin request denied");
 }catch{return fail(403,"Invalid origin");}
 const session=await createSupabaseServerClient().catch(()=>null);
 if(!session)return fail(503,"Owner authentication unavailable");
 const {data:{user},error:authError}=await session.auth.getUser();
 if(authError||!user?.email)return fail(401,"Owner sign-in required");
 const {data:access,error:accessError}=await session.from("app_access_allowlist")
  .select("email").eq("email",user.email.toLowerCase().trim()).eq("active",true).maybeSingle();
 if(accessError||!access)return fail(403,"Owner account not authorised");
 if(Number(req.headers.get("content-length")||0)>85000)return fail(413,"Draft exceeds preview capacity");
 let body:unknown;
 try{
  const raw=await req.text();
  if(raw.length>85000)return fail(413,"Draft exceeds preview capacity");
  body=JSON.parse(raw);
 }catch{return fail(400,"Invalid JSON body");}
 const input=body&&typeof body==="object"&&!Array.isArray(body)
  ?body as Record<string,unknown>:{};
 const title=typeof input.title==="string"?input.title:"";
 const narrative=typeof input.body==="string"?input.body:"";
 if(title.trim().length<8||narrative.trim().length<250||narrative.length>75000)
  return fail(422,"A substantial title and longform draft are required");
 const now=new Date();
 try{
  const [raw,press]=await Promise.all([
   getCurrentVerifiedMarketMotion({limit:24}).catch(()=>[]),
   getOriginalPressNews(now,12).catch(()=>[]),
  ]);
  const news=combineQualifiedNews(selectVerifiedNewsBriefs(raw,now,12),press,12);
  const edition=buildPrivateDailyReaderDraft({
    title,body:narrative,asOf:now.toISOString(),news,
  });
  const html=renderPrivateEditorialReaderHtml(edition);
  return new NextResponse(html,{status:200,headers:{
   ...headers,"Content-Type":"text/html; charset=utf-8",
   "Content-Disposition":'inline; filename="Bluebelly-Private-Reader-PREVIEW.html"',
  }});
 }catch(e){
  if(e instanceof Error&&e.message==="NO_RECENT_INDEPENDENT_SOURCE_RECEIPTS")
   return fail(422,"No recent source-qualified news receipt available. Preview withheld rather than inventing an original-source ledger.");
  if(e instanceof Error&&(/INVALID_PRIVATE_READER_DRAFT|EMPTY_NARRATIVE|Unsafe URL|Invalid source receipt/.test(e.message)))
   return fail(422,"Invalid source-frozen preview input");
  return fail(503,"Private reader preview unavailable; existing draft unchanged");
 }
}
