import { createSupabaseAdminClient } from "./supabase/admin.ts";
import {
  assessScheduledMarketMeasurements, allQuantifiedMarketInputsCurrent,
  SCHEDULED_MARKET_MEASUREMENT_CONTRACT,
  type ExistingMarketEvidence,
  type MarketMeasurementCheck,
} from "./scheduled-market-measurement-quality.ts";

export type ScheduledQuantifiedMarketIntake = {
  contractVersion: typeof SCHEDULED_MARKET_MEASUREMENT_CONTRACT;
  collectedAt: string;
  acquisition: "SKIPPED_UNCHANGED" | "CANONICAL_WRITER_RAN" | "PROVIDER_ERROR";
  checks: MarketMeasurementCheck[];
  evidenceIds: string[];
  unresolved: string[];
};
type IntakeDependencies = {
  readEvidence?: () => Promise<ExistingMarketEvidence[]>;
  fetchMonitor?: () => Promise<{rows: import("./dossier-v2/market-crack-observations.ts").MarketCrackSeries[]}>;
  writeMeasurements?: (rows: import("./dossier-v2/market-crack-observations.ts").MarketCrackSeries[],asOf:string,now:string)
    => Promise<{persisted:Array<{id:string;evidenceId:string;observationId:string}>;gaps:string[]}>;
};
async function readCanonicalEvidence():Promise<ExistingMarketEvidence[]> {
  const client=createSupabaseAdminClient();
  const {data,error}=await client.from("intelligence_evidence")
    .select("id,external_evidence_id,event_at,measurement_unit")
    .like("external_evidence_id","market-crack:%")
    .order("event_at",{ascending:false})
    .limit(80);
  if(error)throw new Error("canonical source query failed: "+error.message);
  return (data??[]) as ExistingMarketEvidence[];
}
/**
 * Runs within the EXISTING authenticated scheduled Live acquisition slot,
 * not an additional cron or AI pass. If a source is missing, the retained
 * dated canonical reading is NOT promoted to a new session by implication.
 */
export async function collectScheduledMarketMeasurements(
  now: Date,
  dependencies:IntakeDependencies={},
):Promise<ScheduledQuantifiedMarketIntake> {
  const at=now.toISOString();
  let prior:ExistingMarketEvidence[]=[];
  try{
    prior=await (dependencies.readEvidence??readCanonicalEvidence)();
    const checks=assessScheduledMarketMeasurements(now,prior);
    if(allQuantifiedMarketInputsCurrent(checks))return {
      contractVersion:SCHEDULED_MARKET_MEASUREMENT_CONTRACT,
      collectedAt:at,acquisition:"SKIPPED_UNCHANGED",
      checks,evidenceIds:checks.map(x=>x.canonicalEvidenceUuid).filter((x):x is string=>Boolean(x)),
      unresolved:[],
    };
    const rows=await (dependencies.fetchMonitor??(async()=>{
      const {getMarketMonitor}=await import("./market-monitor.ts");
      const monitor=await getMarketMonitor();
      return {rows:monitor.rows};
    }))();
    const result=await (dependencies.writeMeasurements??(async(m,a,n)=>{
      const {persistCanonicalMarketMeasurements}=await import("./dossier-v2/canonical-market-crack-evidence.ts");
      return persistCanonicalMarketMeasurements(m,a,n);
    }))(rows.rows,at,at);
    const refreshed=await (dependencies.readEvidence??readCanonicalEvidence)();
    const newChecks=assessScheduledMarketMeasurements(now,refreshed);
    return {
      contractVersion:SCHEDULED_MARKET_MEASUREMENT_CONTRACT,
      collectedAt:at,acquisition:"CANONICAL_WRITER_RAN",
      checks:newChecks,
      evidenceIds:[...new Set(result.persisted.map(x=>x.evidenceId))],
      unresolved:[...result.gaps,...newChecks.filter(x=>!["CURRENT","UNCHANGED_EXPECTED"].includes(x.status)).map(x=>x.key+":"+x.status)],
    };
  }catch(error){
    const checks=assessScheduledMarketMeasurements(now,prior).map(x=>(
      x.status==="CURRENT"||x.status==="UNCHANGED_EXPECTED" ? x
      : {...x,status:"PROVIDER_ERROR" as const,reason:"Scheduled provider/DB collection failed; do not advance the dated observation."}
    ));
    return {
      contractVersion:SCHEDULED_MARKET_MEASUREMENT_CONTRACT,collectedAt:at,
      acquisition:"PROVIDER_ERROR",checks,evidenceIds:[],
      unresolved:["SOURCE_OR_CANONICAL_COLLECTION_FAILED:"+(error instanceof Error?error.message:"Unknown provider error").slice(0,200)],
    };
  }
}
