import "server-only";
import {randomUUID} from "node:crypto";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {HTML_TABLE,HTML_BUCKET,archivePath,validArchiveId} from "./bluebelly-private-html-archive-contract";
import {parseExistingHtmlEdition} from "./bluebelly-html-archive-import-contract";

/** Store an owner-supplied static artifact without silently pretending the
 * source manifest was independently reviewed. The DB/Storage commit pattern
 * matches the existing append-only owner archive. */
export async function importExistingHtmlEdition(ownerId:string,raw:unknown){
 if(!validArchiveId(ownerId))throw Error("INVALID_HTML_IMPORT_OWNER");
 const {input,edition}=parseExistingHtmlEdition(raw);
 const db=createSupabaseAdminClient();
 if(input.supersedesId){
  const {data:parent,error}=await db.from(HTML_TABLE)
   .select("id,report_day").eq("owner_user_id",ownerId)
   .eq("id",input.supersedesId).maybeSingle();
  if(error||!parent)throw Error("HTML_IMPORT_PARENT_NOT_FOUND");
  if(parent.report_day!==edition.reportDay)throw Error("HTML_IMPORT_CORRECTION_DAY_MISMATCH");
 }
 const {data:existing,error:lookupError}=await db.from(HTML_TABLE)
  .select("id,report_day,html_sha256").eq("owner_user_id",ownerId)
  .eq("content_sha256",edition.contentSha256).maybeSingle();
 if(lookupError)throw Error("HTML_IMPORT_LOOKUP_FAILED");
 if(existing)return {id:existing.id,reportDay:existing.report_day,
  htmlSha256:existing.html_sha256,created:false,imported:true};
 const id=randomUUID();
 const path=archivePath(ownerId,edition.reportDay,id);
 const {error:uploadError}=await db.storage.from(HTML_BUCKET)
  .upload(path,new TextEncoder().encode(edition.html),{
   contentType:"text/html",cacheControl:"0",upsert:false,
  });
 if(uploadError)throw Error("HTML_IMPORT_STORAGE_FAILED");
 const {data:saved,error:insertError}=await db.from(HTML_TABLE).insert({
  id,owner_user_id:ownerId,report_day:edition.reportDay,
  title:edition.title,content_sha256:edition.contentSha256,
  html_sha256:edition.htmlSha256,html_path:path,
  source_manifest:[],supersedes_id:input.supersedesId,
  review_status:"PRIVATE_DRAFT",
 }).select("id").single();
 if(insertError||!saved){
  await db.storage.from(HTML_BUCKET).remove([path]).catch(()=>null);
  if(insertError?.code==="23505"){
   const {data:duplicate}=await db.from(HTML_TABLE)
    .select("id,report_day,html_sha256").eq("owner_user_id",ownerId)
    .eq("content_sha256",edition.contentSha256).maybeSingle();
   if(duplicate)return {id:duplicate.id,reportDay:duplicate.report_day,
    htmlSha256:duplicate.html_sha256,created:false,imported:true};
  }
  throw Error("HTML_IMPORT_COMMIT_FAILED");
 }
 return {id,reportDay:edition.reportDay,htmlSha256:edition.htmlSha256,
  created:true,imported:true};
}
