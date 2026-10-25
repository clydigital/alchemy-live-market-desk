import "server-only";
import {createClient} from "@supabase/supabase-js";
import {getSupabasePublicConfig} from "@/lib/supabase/config";
import type {PublicMacroPulseBrief} from "./blue-desk-macropulse-brief";

/** Public SELECT via RLS. Never use service-role on the reader. */
export async function getPublishedMacroPulseBriefs(limit=4):Promise<PublicMacroPulseBrief[]>{
 try{
  const {url,key}=getSupabasePublicConfig();
  const client=createClient(url,key,{auth:{
   autoRefreshToken:false,persistSession:false,detectSessionInUrl:false,
  }});
  const {data,error}=await client.from("blue_desk_macropulse_briefs")
   .select("id,source_page_id,source_pulse_id,source_page_url,source_published_at,source_retrieved_at,headline,standfirst,what_changed,why_it_matters,countercase,watch_next,source_links,primary_region,verification_label,published_at")
   .eq("status","published").order("published_at",{ascending:false}).limit(Math.min(Math.max(limit,0),8));
  if(error)return [];
  return (data||[]) as PublicMacroPulseBrief[];
 }catch{return [];}
}
