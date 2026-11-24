import "server-only";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {createHash} from "node:crypto";
import {parseCreatorDigest,parseCreatorDigestHtml,CREATOR_DIGEST_TITLE,type CreatorDigest} from "./bluebelly-creator-signals";

const PAGE_ID="41d519b6-7a94-8185-9652-f2b986a75b66";
export const CREATOR_DIGEST_URL="https://app.notion.com/p/41d519b67a9481859652f2b986a75b66";
export type CreatorDigestRead={status:"available"|"unauthorised"|"unavailable"|"not_configured"|"invalid";digest:CreatorDigest|null};
// Public routes can bypass middleware authentication; this guard is required
// before any read of a shared private creator source, including fallback.
async function creatorDigestOwner():Promise<string|null>{
 try{const session=await createSupabaseServerClient();const {data:{user},error}=await session.auth.getUser();
  if(error||!user?.id||!user.email)return null;
  const {data:access,error:accessError}=await session.from("app_access_allowlist").select("email").eq("email",user.email.toLowerCase().trim()).eq("active",true).maybeSingle();
  return !accessError&&access?user.id:null;
 }catch{return null;}
}
export async function getOwnerCreatorSignalDigest(now=new Date()):Promise<CreatorDigestRead>{
 const ownerId=await creatorDigestOwner();if(!ownerId)return {status:"unauthorised",digest:null};
 let best:CreatorDigest|null=null;
 // Use the established immutable private Work delivery, exact title and owner.
 // No new credentials or tables; never let a digest count as a daily report.
 try{const {data,error}=await createSupabaseAdminClient().from("blue_desk_work_html_editions")
  .select("html_content,html_sha256").eq("owner_user_id",ownerId).eq("title",CREATOR_DIGEST_TITLE)
  .eq("delivery_type","CHATGPT_WORK").order("created_at",{ascending:false}).limit(4);
  if(!error)for(const row of data??[]){if(typeof row.html_content!=="string"||row.html_content.length>400_000||createHash("sha256").update(row.html_content).digest("hex")!==row.html_sha256)continue;
   const digest=parseCreatorDigestHtml(row.html_content,now);if(digest&&(!best||Date.parse(digest.generatedAt)>Date.parse(best.generatedAt)))best=digest;}
 }catch{/* Optional Notion read or reviewed-source fallback below. */}
 const token=process.env.NOTION_API_TOKEN?.trim()||process.env.NOTION_MARKET_RESEARCH_TOKEN?.trim();
 if(!token)return best?{status:"available",digest:best}:{status:"not_configured",digest:null};
 try{const res=await fetch(`https://api.notion.com/v1/blocks/${PAGE_ID}/children?page_size=100`,{headers:{Authorization:`Bearer ${token}`,"Notion-Version":"2025-09-03"},cache:"no-store",signal:AbortSignal.timeout(8000)});
  if(!res.ok)return best?{status:"available",digest:best}:{status:"unavailable",digest:null};
  const data=await res.json() as {has_more?:boolean;results?:Array<{type?:string;code?:{language?:string;rich_text?:Array<{plain_text?:string;text?:{content?:string}}>}}>};
  if(data.has_more||!Array.isArray(data.results))return best?{status:"available",digest:best}:{status:"invalid",digest:null};
  const blocks=data.results.filter(b=>b.type==="code"&&b.code?.language==="json");
  if(blocks.length!==1)return best?{status:"available",digest:best}:{status:"invalid",digest:null};
  const raw=blocks[0].code?.rich_text?.map(t=>t.plain_text??t.text?.content??"").join("")??"";
  if(!raw||raw.length>100_000)return best?{status:"available",digest:best}:{status:"invalid",digest:null};
  const digest=parseCreatorDigest(JSON.parse(raw),now);
  if(digest&&(!best||Date.parse(digest.generatedAt)>Date.parse(best.generatedAt)))best=digest;
  return best?{status:"available",digest:best}:{status:"invalid",digest:null};
 }catch{return best?{status:"available",digest:best}:{status:"unavailable",digest:null};}
}
