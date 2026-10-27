/**
 * Owner-only immutable archive successor read. A missing or failed response is
 * NOT equivalent to "no superseders": callers must fail closed on null.
 */
import { createSupabaseAdminClient } from "./supabase/admin.ts";
import type { PublicationSnapshot } from "./hybrid-publication.ts";

const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function getPresenterDirectDailyBriefSuperseders(
  editionId:string,
):Promise<PublicationSnapshot[]|null>{
  if(!UUID.test(editionId))return null;
  try {
    const client=createSupabaseAdminClient();
    const {data,error}=await client.from("hybrid_publication_snapshots")
      .select("id,research_run_id,supersedes_snapshot_id,snapshot_type,payload,source_record_refs,published_at")
      .eq("snapshot_type","daily_brief")
      .eq("supersedes_snapshot_id",editionId)
      .order("published_at",{ascending:false})
      .order("id",{ascending:false})
      .limit(25).abortSignal(AbortSignal.timeout(5000));
    if(error||!data||data.length>=25)return null;
    if(data.some(row=>row.snapshot_type!=="daily_brief"||
       row.supersedes_snapshot_id!==editionId||!UUID.test(row.id)))return null;
    return data as PublicationSnapshot[];
  }catch{return null;}
}
