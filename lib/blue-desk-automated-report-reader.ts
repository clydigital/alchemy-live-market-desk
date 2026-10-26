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
   .eq("status","ready").order("ready_at",{ascending:false})
   .limit(Math.min(15,Math.max(1,limit)));
 if(error)throw new Error("Owner PDF editions unavailable");
 return (data||[]) as ReadyAutomaticReport[];
}
