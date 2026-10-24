import "server-only";
import { createSupabaseAdminClient } from "./supabase/admin";
import type { TrackedStoriesRead } from "./blue-desk-tracked-stories";

type EvidenceSource={source_name?:string|null;source_url?:string|null;source_tier?:number|null};
type EvidenceRow={
 id:string;evidence_class:string|null;
 available_at:string|null;created_at:string|null;
 source:EvidenceSource|EvidenceSource[]|null;
};
export type TrackedOriginalSource={
 evidenceId:string;sourceName:string;sourceUrl:string;availableAt:string;
};
const CLASSES=new Set([
 "official_release","company_primary","official_statistic",
 "official_measurement","verified_macro","official_document",
 "filing","regulatory_filing",
]);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function validSourceUrl(raw:string|null|undefined):string|null{
 if(!raw||raw.length>2048)return null;
 try{
  const u=new URL(raw);
  if(u.protocol!=="https:"||u.username||u.password||u.pathname==="/")return null;
  // Tier alone does not permit publicly exposing an arbitrary private link.
  const allowed=["sec.gov","bls.gov","bea.gov","eia.gov","federalreserve.gov",
    "treasury.gov","treasurydirect.gov","census.gov","dol.gov",
    "cmegroup.com","theice.com","ice.com","opec.org","ecb.europa.eu",
    "bankofengland.co.uk","boj.or.jp","fred.stlouisfed.org"];
  if(!allowed.some(host=>u.hostname===host||u.hostname.endsWith("."+host)))return null;
  return u.href;
 }catch{return null}
}
export function selectTrackedOriginalSources(
 tracker:TrackedStoriesRead,
 rows:readonly EvidenceRow[],
):Map<string,TrackedOriginalSource[]>{
 const out=new Map<string,TrackedOriginalSource[]>();
 const asOf=Date.parse(tracker.dossierAsOf||"");
 if(!Number.isFinite(asOf))return out;
 const known=new Map(rows.map(row=>[row.id.toLowerCase(),row]));
 for(const t of tracker.tracks){
  const result:TrackedOriginalSource[]=[];
  for(const id of t.evidenceIds){
   const v=known.get(id.toLowerCase());
   if(!v||!CLASSES.has((v.evidence_class||"").toLowerCase()))continue;
   const src=Array.isArray(v.source)?v.source[0]:v.source;
   const url=validSourceUrl(src?.source_url);
   const created=Date.parse(v.created_at||""),available=Date.parse(v.available_at||"");
   if(!url||!src?.source_tier||src.source_tier>2||!Number.isFinite(created)
    ||!Number.isFinite(available)||created>asOf||available>asOf)continue;
   // Public display links only to an original source; canonical raw claim
   // text remains in the protected evidence store.
   result.push({evidenceId:id,
    sourceName:src.source_name?.trim()||new URL(url).hostname,sourceUrl:url,
    availableAt:v.available_at!});
   if(result.length>=3)break;
  }
  out.set(t.storyId,result);
 }
 return out;
}

/** Read-only, exact UUID and frozen Dossier clock. No new Story decisions. */
export async function getTrackedOriginalSources(tracker:TrackedStoriesRead|null){
 if(!tracker||!tracker.dossierAsOf||!tracker.tracks.length)
  return new Map<string,TrackedOriginalSource[]>();
 const ids=[...new Set(tracker.tracks.flatMap(t=>t.evidenceIds)
  .filter(id=>UUID.test(id)))].slice(0,100);
 if(!ids.length)return new Map<string,TrackedOriginalSource[]>();
 try{
  const db=createSupabaseAdminClient();
  const {data,error}=await db.from("intelligence_evidence")
   .select("id,evidence_class,available_at,created_at,source:intelligence_evidence_sources(source_name,source_url,source_tier)")
   .in("id",ids).limit(100);
  if(error)return new Map<string,TrackedOriginalSource[]>();
  return selectTrackedOriginalSources(tracker,(data||[]) as EvidenceRow[]);
 }catch{return new Map<string,TrackedOriginalSource[]>()}
}
