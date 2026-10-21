import "server-only";
import { createHash } from "node:crypto";
import { createSupabaseAdminClient } from "./supabase/admin.ts";
import type { EditorialCandidate, EditorialSourcePassage } from "./market-editorial-v1.ts";
import { captureVerifiedIssuerPassages } from "./dossier-v2/issuer-source-passages.ts";

const PREFIX="issuer-editorial-source:";
const PROVIDER="issuer_editorial_source_snapshot_v1";
type Issuer="TSM"|"CRWV"|"GS"|"C";
type Evidence = {
  id:string;
  observed_value:number|string|null;
  structured_payload:Record<string,unknown>|null;
};
type ArchiveRow={
  ingestion_key:string|null;
  observed_at:string|null;
  payload:Record<string,unknown>|null;
};
function sourceKey(id:string){return PREFIX+id.toLowerCase();}
function getIssuer(v:unknown):Issuer|null {
  return v==="TSM"||v==="CRWV"||v==="GS"||v==="C"?v:null;
}
function archivedPassages(row:ArchiveRow):EditorialSourcePassage[] {
  const p=row.payload?.editorialSourcePassages;
  if(!Array.isArray(p))return[];
  return p.filter((x):x is EditorialSourcePassage=>x!==null
    && typeof x==="object" && typeof x.text==="string"
    && typeof x.sourceUrl==="string" && typeof x.capturedAt==="string"
    && typeof x.matchedMetric==="string").slice(0,3);
}

/**
 * Read previously captured issuer originals. Per-claim provenance/as-of
 * checks are still applied by factSet; this layer only attaches candidates.
 */
export async function loadArchivedIssuerPassages(
  evidenceIds:readonly string[],
):Promise<Map<string,EditorialSourcePassage[]>> {
  const map=new Map<string,EditorialSourcePassage[]>();
  const ids=[...new Set(evidenceIds.map(x=>x.toLowerCase())
    .filter(x=>/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(x)))].slice(0,75);
  if(!ids.length)return map;
  const db=createSupabaseAdminClient();
  const {data,error}=await db.from("raw_source_records")
    .select("ingestion_key,observed_at,payload")
    .in("ingestion_key",ids.map(sourceKey))
    .eq("provider",PROVIDER).limit(ids.length)
    .abortSignal(AbortSignal.timeout(3_000));
  if(error)throw new Error("Previously captured issuer source archives could not be read.");
  for(const raw of (data||[]) as ArchiveRow[]){
    const key=raw.ingestion_key;
    if(!key?.startsWith(PREFIX))continue;
    const id=key.slice(PREFIX.length);
    const fragments=archivedPassages(raw);
    if(!fragments.length||!raw.observed_at)continue;
    // Never silently replace the archived first-seen time with a value
    // supplied from the source text or an unrelated story publication.
    map.set(id,fragments.filter(p=>Date.parse(p.capturedAt)===Date.parse(raw.observed_at)));
  }
  return map;
}

/**
 * Automatic forward-only repair during normal canonical Dossier composition.
 * At most two first-tier issuer original URLs per run; 5-second source
 * timeout each, run concurrently, no new claim IDs, no model work. Captures
 * made AFTER a frozen base are eligible only for subsequent editions.
 * If the publisher is unreachable, ordinary Dossier/v1 brief still run.
 */
export async function archiveMissingIssuerPassages(
  candidates:readonly EditorialCandidate[],
  options:{fetchImpl?:typeof fetch;now?:()=>Date}={},
):Promise<{archived:number;attempted:number;warnings:string[]}> {
  const facts=[...new Map(candidates.flatMap(c=>c.facts)
    .filter(f=>/^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(f.factId))
    .map(f=>[f.factId,f])).values()];
  if(!facts.length)return{archived:0,attempted:0,warnings:[]};
  const db=createSupabaseAdminClient();
  const ids=facts.map(f=>f.factId);
  const [{data:rows,error:lookupError},{data:prior,error:archiveError}]=await Promise.all([
    db.from("intelligence_evidence").select("id,observed_value,structured_payload")
      .in("id",ids).limit(30).abortSignal(AbortSignal.timeout(3_000)),
    db.from("raw_source_records").select("ingestion_key")
      .in("ingestion_key",ids.map(sourceKey)).eq("provider",PROVIDER)
      .limit(30).abortSignal(AbortSignal.timeout(3_000)),
  ]);
  if(lookupError||archiveError)return{archived:0,attempted:0,warnings:["Issuer source archive preflight unavailable."]};
  const existing=new Set((prior||[]).map((x:{ingestion_key:string|null})=>x.ingestion_key));
  const byFact=new Map(facts.map(f=>[f.factId.toLowerCase(),f]));
  const chosen=(rows||[] as Evidence[]).flatMap(raw=>{
    const row=raw as Evidence;
    const fact=byFact.get(row.id.toLowerCase());
    const issuer=getIssuer(row.structured_payload?.issuer);
    if(!fact||!issuer||row.structured_payload?.evidenceNature!=="verified_issuer_result"
      ||existing.has(sourceKey(row.id))
      ||fact.sourcePassages?.length)return[];
    if(row.observed_value===null)return[];
    const value=Number(row.observed_value);
    if(!Number.isFinite(value))return[];
    return [{id:row.id.toLowerCase(),issuer,value,sourceUrl:fact.sourceUrl}];
  }).slice(0,2);
  const outcomes=await Promise.all(chosen.map(async item=>{
    // Actual acquisition clock comes from the completed fetch; never reuse
    // the old issuer published/available_at clock.
    const passages=await captureVerifiedIssuerPassages({
      issuer:item.issuer,sourceUrl:item.sourceUrl,metricValue:item.value,
      capturedAt:(options.now?.()??new Date()).toISOString(),
      fetchImpl:options.fetchImpl,now:options.now,
    });
    if(!passages.length)return false;
    const capturedAt=passages[0].capturedAt;
    const payload={evidenceId:item.id,evidenceNature:"issuer_original_excerpt_only",
      editorialSourcePassages:passages};
    const contentHash=createHash("sha256")
      .update(JSON.stringify({evidenceId:item.id,passages})).digest("hex");
    const {error}=await db.from("raw_source_records").insert({
      ingestion_key:sourceKey(item.id),provider:PROVIDER,
      source_url:item.sourceUrl,source_type:"issuer_release",
      content_type:"application/json",content_hash:contentHash,
      // No full HTML or other primary source body is redistributed.
      content_text:null,payload,observed_at:capturedAt,fetched_at:capturedAt,
      published_at:null,
    });
    // Unique-index race is idempotent: never mutate archived first receipt.
    return !error||error.code==="23505";
  }));
  return {archived:outcomes.filter(Boolean).length,attempted:chosen.length,
    warnings:chosen.length&&outcomes.every(x=>!x)?["Issuer original-source capture produced no admissible receipts."]:[]};
}
