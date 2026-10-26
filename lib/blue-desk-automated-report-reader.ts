import "server-only";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";

/** Private owner reader. Never import into public Blue Desk pages or expose
 * through RLS: the calling component must authenticate an approved owner. */
export type ReadyAutomaticReport={
 id:string;report_day:string;slot:"morning"|"evening";title:string;deck:string;
 summary:string;source_count:number;coverage_note:string;ready_at:string;
 status:"ready";
};
export async function getOwnerAutomaticDailyReports(limit=8):Promise<ReadyAutomaticReport[]>{
 const db=createSupabaseAdminClient();
 const {data,error}=await db.from("blue_desk_automated_reports")
   .select("id,report_day,slot,title,deck,summary,source_count,coverage_note,ready_at,status")
   .eq("status","ready").eq("report_kind","DAILY_MACRO").order("ready_at",{ascending:false})
   .limit(Math.min(15,Math.max(1,limit)));
 if(error)throw new Error("Owner PDF editions unavailable");
 return (data||[]) as ReadyAutomaticReport[];
}

/** A minimal owner-only health receipt. Blocked attempts contain no PDF and
 * no public article; they are evidence of a scheduled check, not completion. */
export type PrivateDailyPdfAttempt={
 report_day:string;slot:"morning"|"evening";
 status:"building"|"blocked"|"failed"|"ready";
 created_at:string;error_code:string|null;source_count:number;coverage_note:string;
};
export async function getOwnerLatestDailyPdfAttempt():Promise<PrivateDailyPdfAttempt|null>{
 const db=createSupabaseAdminClient();
 const {data,error}=await db.from("blue_desk_automated_reports")
  .select("report_day,slot,status,created_at,error_code,source_count,coverage_note")
  .eq("report_kind","DAILY_MACRO").order("created_at",{ascending:false}).limit(1).maybeSingle();
 if(error)throw new Error("Private PDF attempt receipt unavailable");
 return (data||null) as PrivateDailyPdfAttempt|null;
}
