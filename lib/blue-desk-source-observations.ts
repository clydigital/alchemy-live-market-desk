import "server-only";
import {createSupabaseAdminClient} from "@/lib/supabase/admin";
import {projectSourceObservations,type PublicSourceObservation,type SourceObservationInput,SOURCE_OBSERVATION_MAX_AGE_MS}
  from "./blue-desk-source-observations-projector";

export type {PublicSourceObservation} from "./blue-desk-source-observations-projector";

/** Admin client stays server-only; expose only conservative original-source fields. */
export async function getPublicSourceObservations(now=new Date(),limit=8):Promise<PublicSourceObservation[]>{
 if(!Number.isFinite(now.getTime()))return [];
 const db=createSupabaseAdminClient();
 const earliest=new Date(now.getTime()-SOURCE_OBSERVATION_MAX_AGE_MS).toISOString();
 const {data,error}=await db.from("intelligence_evidence")
  .select("id,evidence_class,claim_text,event_at,available_at,received_at,provenance_urls,freshness_status,source:intelligence_evidence_sources!inner(source_name,source_type,source_tier,source_url)")
  .in("evidence_class",["market_observation","official_release","company_primary"])
  .eq("freshness_status","current")
  .gte("event_at",earliest).lte("event_at",now.toISOString())
  .lte("received_at",now.toISOString())
  .order("event_at",{ascending:false}).limit(60);
 if(error)throw new Error("Public source-observation read unavailable");
 return projectSourceObservations((data||[]) as unknown as SourceObservationInput[],now,limit);
}
