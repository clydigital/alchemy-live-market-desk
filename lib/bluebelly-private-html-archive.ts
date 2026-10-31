import "server-only";
import {createHash,randomUUID} from "node:crypto";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {getCurrentVerifiedMarketMotion} from "@/lib/market-motion";
import {selectVerifiedNewsBriefs} from "@/lib/market-brief-news";
import {getOriginalPressNews} from "@/lib/blue-desk-original-press-news-server";
import {combineQualifiedNews} from "@/lib/blue-desk-qualified-news";
import {buildPrivateDailyReaderDraft} from "@/lib/bluebelly-editorial-draft-preview";
import {renderPrivateEditorialReaderHtml,type ReaderSource} from "@/lib/bluebelly-editorial-reader";

export const HTML_BUCKET="editorial-html";
export const HTML_TABLE="blue_desk_private_html_editions";
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export type ArchiveInput={title:string;body:string;selectedSources:string;selectedX:string;supersedesId:string|null};
export type Receipt={url:string;publisher:string;publishedAt:string;title:string;status:"ORIGINAL_VERIFIED"|"CORROBORATED"|"ATTRIBUTED"};
export const digest=(s:string|Uint8Array)=>createHash("sha256").update(s).digest("hex");
export const validArchiveId=(s:unknown):s is string=>typeof s==="string"&&UUID.test(s);
export function archivePath(owner:string,day:string,id:string){
 if(!validArchiveId(owner)||!validArchiveId(id)||!/^\d{4}-\d\d-\d\d$/.test(day))
  throw Error("INVALID_ARCHIVE_PATH");
 return "private-html/"+owner.toLowerCase()+"/"+day+"/"+id.toLowerCase()+".html";
}
export function parseArchiveInput(raw:unknown):ArchiveInput{
 if(!raw||typeof raw!=="object"||Array.isArray(raw))throw Error("INVALID_ARCHIVE_INPUT");
 const r=raw as Record<string,unknown>;
 const title=typeof r.title==="string"?r.title.trim():"";
 const body=typeof r.body==="string"?r.body.trim():"";
 const selectedSources=typeof r.selectedSources==="string"?r.selectedSources.trim():"";
 const selectedX=typeof r.selectedX==="string"?r.selectedX.trim():"";
 const supersedesId=r.supersedesId==null?null:r.supersedesId;
 if(title.length<8||title.length>110||body.length<250||body.length>75000||
   selectedSources.length>6000||selectedX.length>3500||
   (supersedesId!==null&&!validArchiveId(supersedesId)))throw Error("INVALID_ARCHIVE_INPUT");
 return {title,body,selectedSources,selectedX,supersedesId};
}
function urls(text:string,limit:number,x=false):string[]{
 const out=new Set<string>();
 for(const part of text.split(/\s+/).filter(Boolean)){
  try{
   const u=new URL(part);
   if(u.protocol!=="https:"||u.username||u.password||u.href.length>2048)continue;
   if(x&&(!["x.com","www.x.com","twitter.com","www.twitter.com"].includes(u.hostname)||
     u.search||u.hash||!/^\/[A-Za-z0-9_]{1,15}\/status\/\d+\/?$/.test(u.pathname)))continue;
   out.add(u.toString());
  }catch{/* not a valid source URL */}
  if(out.size>=limit)break;
 }
 return [...out];
}
export type BuiltArchive={id:string;reportDay:string;title:string;html:string;htmlSha256:string;contentSha256:string;manifest:Receipt[]};
export async function buildArchive(input:ArchiveInput,now=new Date()):Promise<BuiltArchive>{
 const db=createSupabaseAdminClient();
 const selected=urls(input.selectedSources,12);
 const xURLs=urls(input.selectedX,5,true);
 const [raw,press,foundX]=await Promise.all([
  getCurrentVerifiedMarketMotion({limit:24}).catch(()=>[]),
  getOriginalPressNews(now,12).catch(()=>[]),
  xURLs.length?db.from("x_wire_posts").select("original_url,handle,published_at,body,original_verified")
   .in("original_url",xURLs).limit(5):Promise.resolve({data:[],error:null}),
 ]);
 if(foundX.error)throw Error("ARCHIVE_X_RECEIPT_UNAVAILABLE");
 const news=combineQualifiedNews(selectVerifiedNewsBriefs(raw,now,12),press,12);
 const edition=buildPrivateDailyReaderDraft({
  title:input.title,body:input.body,asOf:now.toISOString(),news,selectedSourceUrls:selected,
 });
 const manifest:Receipt[]=edition.sources.map(s=>({
  url:s.url,publisher:s.publisher,publishedAt:s.publishedAt,title:s.title,
  status:s.status as Receipt["status"],
 }));
 const found=new Map((foundX.data||[]).map(r=>[r.original_url,r]));
 let count=0;
 for(const url of xURLs){
  const post=found.get(url);
  if(!post||typeof post.handle!=="string"||!post.published_at||!post.body||
    !/^[A-Za-z0-9_]{1,15}$/.test(post.handle)||
    new URL(url).pathname.split("/")[1].toLowerCase()!==post.handle.toLowerCase())continue;
  const t=Date.parse(post.published_at);
  if(!Number.isFinite(t)||t>now.getTime())continue;
  const stamp=new Date(t).toISOString();
  const status=post.original_verified===true?"ORIGINAL_VERIFIED":"ATTRIBUTED";
  const sid="original-x-"+String(count+1);
  const caption=String(post.body).slice(0,700);
  const original:ReaderSource={id:sid,title:"Original linked X post by @"+post.handle,
   publisher:"X / @"+post.handle,url,publishedAt:stamp,status,
   period:"Social commentary; underlying facts not independently proven"};
  edition.sources.push(original);
  manifest.push({url,publisher:original.publisher,publishedAt:stamp,title:caption,status});
  const idx=Math.min(edition.sections.length-1,
   Math.floor((count+1)*edition.sections.length/(xURLs.length+1)));
  const section=edition.sections[idx];
  section.blocks.splice(Math.floor(section.blocks.length/2),0,{
   kind:"x-post",url,handle:post.handle,publishedAt:stamp,summary:caption,
   originalVerified:post.original_verified===true,sourceIds:[sid],
  });
  count++;
 }
 const contentSha256=digest(JSON.stringify({kind:"BLUEBELLY_PRIVATE_HTML_V4",title:input.title,
  body:input.body,receipts:manifest}));
 edition.editionId="archived-"+contentSha256.slice(0,16);
 edition.snapshotSha256=contentSha256;
 edition.status="PRIVATE_DRAFT";
 const html=renderPrivateEditorialReaderHtml(edition);
 if(Buffer.byteLength(html,"utf8")>950000)throw Error("ARCHIVE_HTML_TOO_LARGE");
 return {id:randomUUID(),reportDay:edition.reportDay,title:input.title,
  html,htmlSha256:digest(html),contentSha256,manifest};
}
/** Append-only: first snapshot wins, corrective edition links to old row. */
export async function saveHtmlArchive(ownerId:string,input:ArchiveInput,now=new Date()){
 if(!validArchiveId(ownerId))throw Error("ARCHIVE_OWNER_INVALID");
 const db=createSupabaseAdminClient();
 let parentDay:string|null=null;
 if(input.supersedesId){
  const {data:old,error}=await db.from(HTML_TABLE).select("report_day")
   .eq("id",input.supersedesId).eq("owner_user_id",ownerId).maybeSingle();
  if(error||!old)throw Error("ARCHIVE_PARENT_NOT_OWNED");
  parentDay=old.report_day;
 }
 const built=await buildArchive(input,now);
 const {data:existing,error:checkError}=await db.from(HTML_TABLE)
  .select("id,report_day,html_sha256").eq("owner_user_id",ownerId)
  .eq("content_sha256",built.contentSha256).maybeSingle();
 if(checkError)throw Error("ARCHIVE_LOOKUP_FAILED");
 if(existing)return {id:existing.id,reportDay:existing.report_day,htmlSha256:existing.html_sha256,created:false};
 const day=parentDay||built.reportDay;
 const path=archivePath(ownerId,day,built.id);
 const {error:uploadError}=await db.storage.from(HTML_BUCKET)
  .upload(path,new TextEncoder().encode(built.html),{
   contentType:"text/html",cacheControl:"0",upsert:false,
  });
 if(uploadError)throw Error("ARCHIVE_UPLOAD_FAILED");
 const {data:saved,error}=await db.from(HTML_TABLE).insert({
  id:built.id,owner_user_id:ownerId,report_day:day,title:built.title,
  content_sha256:built.contentSha256,html_sha256:built.htmlSha256,
  html_path:path,source_manifest:built.manifest,supersedes_id:input.supersedesId,
  review_status:"PRIVATE_DRAFT",
 }).select("id").single();
 if(error||!saved){
  await db.storage.from(HTML_BUCKET).remove([path]).catch(()=>null);
  if(error?.code==="23505"){
   const {data:dup}=await db.from(HTML_TABLE).select("id,report_day,html_sha256")
    .eq("owner_user_id",ownerId).eq("content_sha256",built.contentSha256).maybeSingle();
   if(dup)return {id:dup.id,reportDay:dup.report_day,htmlSha256:dup.html_sha256,created:false};
  }
  throw Error("ARCHIVE_RECEIPT_COMMIT_FAILED");
 }
 return {id:built.id,reportDay:day,htmlSha256:built.htmlSha256,created:true};
}
