import "server-only";
import {createClient} from "@supabase/supabase-js";
import {getSupabasePublicConfig} from "@/lib/supabase/config";
import {projectPublicTheses,type PublicThesis} from "./blue-desk-thesis-ledger";

/** Uses the same anonymous SELECT RLS as the public Stories library;
 * no privileged access to thesis-version histories, Evidence or Dossier. */
export async function getPublicThesisLedger(now=new Date(),limit=24):Promise<PublicThesis[]>{
 const {url,key}=getSupabasePublicConfig();
 const client=createClient(url,key,{auth:{
  autoRefreshToken:false,persistSession:false,detectSessionInUrl:false,
 }});
 const {data,error}=await client.from("stories")
 .select("id,slug,title,market_question,thesis,strongest_support,strongest_contradiction,confirmation_trigger,invalidation_trigger,next_catalyst,priced_assessment,updated_at,status,rank")
 .in("status",["publish","monitor","develop"])
 .order("updated_at",{ascending:false}).limit(38);
 if(error)throw new Error("Public tracked-thesis read unavailable");
 return projectPublicTheses((data||[]) as Record<string,unknown>[],now,limit);
}
