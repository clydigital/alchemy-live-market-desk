import "server-only";
import {randomUUID} from "node:crypto";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import type {ReaderEdition} from "@/lib/bluebelly-editorial-reader";
import {
 HTML_BUCKET,HTML_TABLE,archivePath,digest,validArchiveId,
} from "@/lib/bluebelly-private-html-archive-contract";

type ArchiveResult={id:string;created:boolean;reportDay:string;htmlSha256:string;html:string};
type ExistingReceipt={id:string;report_day:string;html_path:string;html_sha256:string};

/** Persist the exact HTML already rendered from independently matched source
 * receipts. A preview that cannot be archived must never claim success. */
export async function archiveRenderedOwnerReader(
 ownerId:string,reader:ReaderEdition,renderedHtml:string,
):Promise<ArchiveResult>{
 if(!validArchiveId(ownerId)||reader.status!=="PRIVATE_DRAFT"||
    !/^\d{4}-\d\d-\d\d$/.test(reader.reportDay)||
    !/^[0-9a-f]{64}$/.test(reader.snapshotSha256)||
    !renderedHtml.includes('data-private-reader-v4="true"'))
   throw new Error("AUTOSAVE_INVALID_READER");
 const bytes=new TextEncoder().encode(renderedHtml);
 if(bytes.length<1000||bytes.length>950000)throw new Error("AUTOSAVE_HTML_TOO_LARGE");
 const sourceManifest=reader.sources.map(src=>({
  url:src.url,publisher:src.publisher,title:src.title,
  publishedAt:src.publishedAt,status:src.status,
 }));
 if(sourceManifest.length>24)throw new Error("AUTOSAVE_TOO_MANY_RECEIPTS");
 // Exclude the preview clock from idempotence. Preserve the first snapshot as
 // immutable: a retry of unchanged article/evidence returns the actual saved
 // HTML bytes, not a fresh preview posing as the original archive.
 const contentSha256=digest(JSON.stringify({
  kind:"BLUEBELLY_AUTOSAVED_READER_V1",reportDay:reader.reportDay,
  title:reader.title,deck:reader.deck,sections:reader.sections,
  executiveSummary:reader.executiveSummary,sources:sourceManifest,
 }));
 const db=createSupabaseAdminClient();
 async function existing(saved:ExistingReceipt):Promise<ArchiveResult>{
  const expected=archivePath(ownerId,saved.report_day,saved.id);
  if(saved.html_path!==expected)throw new Error("AUTOSAVE_ARCHIVE_PATH_MISMATCH");
  const {data:blob,error:downloadError}=await db.storage.from(HTML_BUCKET).download(expected);
  if(downloadError||!blob)throw new Error("AUTOSAVE_STORED_HTML_MISSING");
  const buffer=new Uint8Array(await blob.arrayBuffer());
  if(digest(buffer)!==saved.html_sha256)throw new Error("AUTOSAVE_STORED_HTML_HASH_MISMATCH");
  return {id:saved.id,created:false,reportDay:saved.report_day,
   htmlSha256:saved.html_sha256,html:new TextDecoder().decode(buffer)};
 }
 const {data:prior,error:lookupError}=await db.from(HTML_TABLE)
  .select("id,report_day,html_path,html_sha256").eq("owner_user_id",ownerId)
  .eq("content_sha256",contentSha256).maybeSingle();
 if(lookupError)throw new Error("AUTOSAVE_LOOKUP_FAILED");
 if(prior)return existing(prior);
 const id=randomUUID();
 const objectPath=archivePath(ownerId,reader.reportDay,id);
 const htmlSha256=digest(bytes);
 const {error:uploadError}=await db.storage.from(HTML_BUCKET).upload(objectPath,bytes,{
  contentType:"text/html",cacheControl:"0",upsert:false,
 });
 if(uploadError)throw new Error("AUTOSAVE_UPLOAD_FAILED");
 const {data:saved,error:saveError}=await db.from(HTML_TABLE).insert({
  id,owner_user_id:ownerId,report_day:reader.reportDay,title:reader.title,
  content_sha256:contentSha256,html_sha256:htmlSha256,html_path:objectPath,
  source_manifest:sourceManifest,supersedes_id:null,review_status:"PRIVATE_DRAFT",
 }).select("id").single();
 if(saveError||!saved){
  await db.storage.from(HTML_BUCKET).remove([objectPath]).catch(()=>null);
  if(saveError?.code==="23505"){
   const {data:duplicate}=await db.from(HTML_TABLE)
    .select("id,report_day,html_path,html_sha256")
    .eq("owner_user_id",ownerId)
    .eq("content_sha256",contentSha256).maybeSingle();
   if(duplicate)return existing(duplicate);
  }
  throw new Error("AUTOSAVE_LEDGER_FAILED");
 }
 return {id,created:true,reportDay:reader.reportDay,htmlSha256,html:renderedHtml};
}
