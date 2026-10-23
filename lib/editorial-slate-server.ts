import "server-only";
import { createSupabaseAdminClient } from "./supabase/admin.ts";
import { parseEditorialSlate, type EditorialSlate } from "./editorial-slate-core.ts";

export async function getLatestEditorialSlate():Promise<{
  slate:EditorialSlate|null;status:"available"|"empty"|"storage_unavailable";
}> {
  try{
    const {data,error}=await createSupabaseAdminClient()
      .from("blue_desk_editorial_slates")
      .select("day_myt,produced_at,verification_status,ideas,sources,notes")
      .order("day_myt",{ascending:false}).limit(1).maybeSingle();
    if(error)throw error;
    const slate=parseEditorialSlate(data,new Date().toISOString());
    return {slate,status:slate?"available":"empty"};
  }catch {
    // Missing table, unavailable connection and invalid permissions fail closed.
    return {slate:null,status:"storage_unavailable"};
  }
}
