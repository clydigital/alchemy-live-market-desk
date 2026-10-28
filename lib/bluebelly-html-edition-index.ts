import "server-only";
import {createSupabaseAdminClient} from "./supabase/admin.ts";

export type PrivateHtmlEdition={
 id:string;kind:"market"|"angles"|"creators"|"audits";edition:string;
 title:string;description:string;sourceState:string;readyAt:string;
};
const ID=/^[a-zA-Z0-9_-]{20,100}$/;
const VALID=new Set(["market","angles","creators","audits"]);
type Row={html_drive_id:string|null;html_category:string|null;report_day:string;
 title:string;deck:string;coverage_note:string;ready_at:string|null;source_count:number;
 file_format:string;status:string};
/** Private server-only HTML Drive file index. Neither contents nor credentials
 * are served from Vercel. The owner page inherits session+allowlist middleware.
 * A complete receipt is inserted only after the Google Drive file upload AND
 * metadata readback; the database receipt never establishes market evidence. */
export async function getPrivateHtmlEditions(limit=80):Promise<{
 editions:PrivateHtmlEdition[];status:"available"|"empty"|"unavailable";
}>{
 try{
  const db=createSupabaseAdminClient();
  const {data,error}=await db.from("blue_desk_automated_reports")
   .select("html_drive_id,html_category,report_day,title,deck,coverage_note,ready_at,source_count,file_format,status")
   .eq("file_format","html").eq("status","ready")
   .order("ready_at",{ascending:false}).limit(Math.max(1,Math.min(100,limit)));
  if(error)throw error;
  const editions=(data as Row[]||[]).flatMap(row=>{
   if(!row.html_drive_id||!ID.test(row.html_drive_id)||!VALID.has(row.html_category||"")||
    !row.ready_at||row.source_count<1)return [];
   return [{id:row.html_drive_id,kind:row.html_category as PrivateHtmlEdition["kind"],
    edition:row.report_day,title:row.title,description:row.deck,
    sourceState:row.coverage_note,readyAt:row.ready_at}];
  });
  return {editions,status:editions.length?"available":"empty"};
 }catch{
  return {editions:[],status:"unavailable"};
 }
}
