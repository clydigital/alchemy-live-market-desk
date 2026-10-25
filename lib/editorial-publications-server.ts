import "server-only";
import {createClient} from "@supabase/supabase-js";
import {getSupabasePublicConfig} from "@/lib/supabase/config";
import {type EditorialPublication,validPublicationId} from "./editorial-publications";

/** Anonymous RLS read; never use privileged service-role credentials on a public page. */
function reader(){
 const {url,key}=getSupabasePublicConfig();
 return createClient(url,key,{auth:{
  autoRefreshToken:false,persistSession:false,detectSessionInUrl:false,
 }});
}
const COLS="id,kind,title,meta_description,body,excerpt,source_urls,status,published_at";
export async function listPublishedReports(limit=20):Promise<EditorialPublication[]>{
 try{
  const {data,error}=await reader().from("editorial_publications").select(COLS)
   .eq("status","published").order("published_at",{ascending:false}).limit(Math.min(limit,50));
  if(error)return [];
  return (data||[]) as EditorialPublication[];
 }catch{return [];}
}
export async function getPublishedReport(id:string):Promise<EditorialPublication|null>{
 if(!validPublicationId(id))return null;
 try{
  const {data,error}=await reader().from("editorial_publications").select(COLS)
   .eq("id",id).eq("status","published").maybeSingle();
  return error?null:(data as EditorialPublication|null);
 }catch{return null;}
}
