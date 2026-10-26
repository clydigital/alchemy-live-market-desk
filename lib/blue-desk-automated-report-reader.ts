import "server-only";
import {createClient} from "@supabase/supabase-js";
import {getSupabasePublicConfig} from "@/lib/supabase/config";
export type PublishedAutomaticReport={
 id:string;report_day:string;slot:"morning"|"evening";title:string;deck:string;
 summary:string;source_count:number;coverage_note:string;published_at:string;
 status:"published";
};
export async function getAutomaticDailyReports(limit=8):Promise<PublishedAutomaticReport[]>{
 try{
  const {url,key}=getSupabasePublicConfig();
  const reader=createClient(url,key,{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});
  const {data,error}=await reader.from("blue_desk_automated_reports")
   .select("id,report_day,slot,title,deck,summary,source_count,coverage_note,published_at,status")
   .eq("status","published").order("published_at",{ascending:false}).limit(Math.min(15,Math.max(1,limit)));
  if(error)return [];
  return (data||[]) as PublishedAutomaticReport[];
 }catch{return [];}
}
