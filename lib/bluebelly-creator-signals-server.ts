import "server-only";
import {createSupabaseServerClient} from "@/lib/supabase/server";
import {parseCreatorDigest,type CreatorDigest} from "./bluebelly-creator-signals";

const PAGE_ID="41d519b6-7a94-8185-9652-f2b986a75b66";
export const CREATOR_DIGEST_URL="https://app.notion.com/p/41d519b67a9481859652f2b986a75b66";
export type CreatorDigestRead={status:"available"|"unauthorised"|"unavailable"|"not_configured"|"invalid";digest:CreatorDigest|null};
// Public routes can bypass middleware authentication; this guard is required
// before any read of a shared private creator source, including fallback.
export async function isCreatorDigestOwner():Promise<boolean>{
 try{const session=await createSupabaseServerClient();const {data:{user},error}=await session.auth.getUser();
  if(error||!user?.id||!user.email)return false;
  const {data:access,error:accessError}=await session.from("app_access_allowlist").select("email").eq("email",user.email.toLowerCase().trim()).eq("active",true).maybeSingle();
  return !accessError&&Boolean(access);
 }catch{return false;}
}
export async function getOwnerCreatorSignalDigest(now=new Date()):Promise<CreatorDigestRead>{
 if(!await isCreatorDigestOwner())return {status:"unauthorised",digest:null};
 const token=process.env.NOTION_API_TOKEN?.trim()||process.env.NOTION_MARKET_RESEARCH_TOKEN?.trim();
 if(!token)return {status:"not_configured",digest:null};
 try{const res=await fetch(`https://api.notion.com/v1/blocks/${PAGE_ID}/children?page_size=100`,{headers:{Authorization:`Bearer ${token}`,"Notion-Version":"2025-09-03"},cache:"no-store",signal:AbortSignal.timeout(8000)});
  if(!res.ok)return {status:"unavailable",digest:null};
  const data=await res.json() as {has_more?:boolean;results?:Array<{type?:string;code?:{language?:string;rich_text?:Array<{plain_text?:string;text?:{content?:string}}>}}>};
  if(data.has_more||!Array.isArray(data.results))return {status:"invalid",digest:null};
  const blocks=data.results.filter(b=>b.type==="code"&&b.code?.language==="json");
  if(blocks.length!==1)return {status:"invalid",digest:null};
  const raw=blocks[0].code?.rich_text?.map(t=>t.plain_text??t.text?.content??"").join("")??"";
  if(!raw||raw.length>100_000)return {status:"invalid",digest:null};
  const digest=parseCreatorDigest(JSON.parse(raw),now);
  return digest?{status:"available",digest}:{status:"invalid",digest:null};
 }catch{return {status:"unavailable",digest:null};}
}
