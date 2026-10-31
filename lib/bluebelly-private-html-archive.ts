import "server-only";
import {randomUUID} from "node:crypto";
import {
 HTML_BUCKET,HTML_TABLE,digest,parseArchiveInput,archivePath,validArchiveId,effectiveArchiveDay,
 type ArchiveInput,type Receipt
} from "./bluebelly-private-html-archive-contract";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {getCurrentVerifiedMarketMotion} from "@/lib/market-motion";
import {selectVerifiedNewsBriefs} from "@/lib/market-brief-news";
import {getOriginalPressNews} from "@/lib/blue-desk-original-press-news-server";
import {combineQualifiedNews} from "@/lib/blue-desk-qualified-news";
import {buildPrivateDailyReaderDraft} from "@/lib/bluebelly-editorial-draft-preview";
import {renderPrivateEditorialReaderHtml,type ReaderSource} from "@/lib/bluebelly-editorial-reader";

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
export async function buildArchive(input:ArchiveInput,now=new Date(),correctionDay?:string|null):Promise<BuiltArchive>{
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
 const reportDay=effectiveArchiveDay(now,correctionDay);
 edition.reportDay=reportDay;
 if(input.supersedesId){
  edition.deck="Private revised draft for "+reportDay+
   "; correction of edition "+input.supersedesId.slice(0,8)+
   ", reassembled "+now.toISOString()+". Claims remain unreviewed.";
 }
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
 const contentSha256=digest(JSON.stringify({kind:"BLUEBELLY_PRIVATE_HTML_V4",reportDay,
  supersedesId:input.supersedesId,title:input.title,body:input.body,receipts:manifest}));
 edition.editionId="archived-"+contentSha256.slice(0,16);
 edition.snapshotSha256=contentSha256;
 edition.status="PRIVATE_DRAFT";
 const html=renderPrivateEditorialReaderHtml(edition);
 if(Buffer.byteLength(html,"utf8")>950000)throw Error("ARCHIVE_HTML_TOO_LARGE");
 return {id:randomUUID(),reportDay,title:input.title,
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
 const built=await buildArchive(input,now,parentDay);
 const {data:existing,error:checkError}=await db.from(HTML_TABLE)
  .select("id,report_day,html_sha256").eq("owner_user_id",ownerId)
  .eq("content_sha256",built.contentSha256).maybeSingle();
 if(checkError)throw Error("ARCHIVE_LOOKUP_FAILED");
 if(existing)return {id:existing.id,reportDay:existing.report_day,htmlSha256:existing.html_sha256,created:false};
 const day=built.reportDay;
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
