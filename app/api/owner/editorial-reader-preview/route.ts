import "server-only";
import {NextResponse,type NextRequest} from "next/server";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {blueDeskHostAccess} from "@/lib/blue-desk-host";
import {getCurrentVerifiedMarketMotion} from "@/lib/market-motion";
import {selectVerifiedNewsBriefs} from "@/lib/market-brief-news";
import {getOriginalPressNews} from "@/lib/blue-desk-original-press-news-server";
import {combineQualifiedNews} from "@/lib/blue-desk-qualified-news";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
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
 const selected=typeof input.selectedSources==="string"?input.selectedSources:"";
 const selectedX=typeof input.selectedX==="string"?input.selectedX:"";
 if(selectedX.length>3500)return fail(413,"X post selection too large");
 if(selected.length>6000)return fail(413,"Source selection too large");
 const selectedSourceUrls=[...new Set(selected.split(/\s+/).map(v=>v.trim()).filter(Boolean))].slice(0,12);
 const selectedXUrls=[...new Set(selectedX.split(/\s+/).map(v=>v.trim()).filter(Boolean))].slice(0,5)
  .filter(raw=>{
   try{const u=new URL(raw);return u.protocol==="https:"&&!u.username&&!u.password&&
    ["x.com","www.x.com","twitter.com","www.twitter.com"].includes(u.hostname)&&
    /^\/[A-Za-z0-9_]{1,15}\/status\/\d+\/?$/.test(u.pathname);}
   catch{return false;}
  });
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
    title,body:narrative,asOf:now.toISOString(),news,selectedSourceUrls,
  });
  if(selectedXUrls.length){
   const {data:posts,error:postError}=await createSupabaseAdminClient()
    .from("x_wire_posts")
    .select("handle,post_id,original_url,published_at,body,original_verified")
    .in("original_url",selectedXUrls).limit(5);
   if(postError)return fail(503,"Private original X wire unavailable");
   const matched=new Map((posts||[]).map(p=>[p.original_url,p]));
   let card=0;
   for(const url of selectedXUrls){
    const p=matched.get(url);if(!p||!p.published_at||!p.handle||!p.body)continue;
    const parsed=new URL(url);
    if(parsed.pathname.split("/")[1].toLowerCase()!==String(p.handle).toLowerCase())continue;
    const time=Date.parse(p.published_at);
    if(!Number.isFinite(time)||time>now.getTime())continue;
    const verified=p.original_verified===true;
    const sourceId="x-post-"+(card+1);
    edition.sources.push({
     id:sourceId,title:"Dated X post by @"+p.handle,
     publisher:"X / @"+p.handle,url,publishedAt:new Date(time).toISOString(),
     status:verified?"ORIGINAL_VERIFIED":"ATTRIBUTED",
     period:"Attributed social commentary; assertions are not independently verified",
    });
    const sectionIndex=Math.min(edition.sections.length-1,
     Math.floor((card+1)*edition.sections.length/(selectedXUrls.length+1)));
    const section=edition.sections[sectionIndex];
    section.blocks.splice(Math.floor(section.blocks.length/2),0,{
     kind:"x-post",url,handle:String(p.handle),publishedAt:new Date(time).toISOString(),
     summary:String(p.body).slice(0,700),originalVerified:verified,sourceIds:[sourceId],
    });
    card++;
   }
  }
  const html=renderPrivateEditorialReaderHtml(edition);
  return new NextResponse(html,{status:200,headers:{
   ...headers,"Content-Type":"text/html; charset=utf-8",
   "Content-Disposition":'inline; filename="Bluebelly-Private-Reader-PREVIEW.html"',
  }});
 }catch(e){
  if(e instanceof Error&&(/INVALID_PRIVATE_READER_DRAFT|EMPTY_NARRATIVE|Unsafe URL|Invalid source receipt/.test(e.message)))
   return fail(422,"Invalid source-frozen preview input");
  return fail(503,"Private reader preview unavailable; existing draft unchanged");
 }
}
