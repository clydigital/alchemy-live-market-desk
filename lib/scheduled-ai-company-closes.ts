import { createSupabaseAdminClient } from "./supabase/admin.ts";
import type { MarketMonitor } from "./market-monitor.ts";
import {
  AI_COMPANY_CLOSE_METHOD, AI_COMPANY_WATCH,
  buildAiCompanyCloseCandidates, type AiClose,
} from "./ai-company-canonical-closes.ts";
import { expectedMarketMeasurementDays } from "./scheduled-market-measurement-quality.ts";

export type AiCloseCollection = {
  contractVersion:typeof AI_COMPANY_CLOSE_METHOD;
  collectedAt:string;
  expectedUsSession:string;
  status:"SKIPPED_UNCHANGED"|"EVIDENCE_WRITTEN"|"DEGRADED";
  evidenceIds:string[];
  gaps:string[];
  /** 16 companies are monitored; unsupported price venues and non-listed entities never get a synthetic quote. */
  unsupported:Array<{name:string;ticker:string|null;reason:string}>;
};
type Prior={id:string;external_evidence_id:string;event_at:string;content_hash:string|null;normalised_observation_id:string|null};
type PriceIntakeDependencies={
  readExisting?:()=>Promise<Prior[]>;
  readMonitor?:()=>Promise<MarketMonitor>;
  write?: (items:AiClose[], now:string)=>Promise<{ids:string[];gaps:string[]}>;
};
const unsupported=AI_COMPANY_WATCH.filter(x=>x.monitorId===null).map(x=>({
  name:x.name,ticker:x.ticker as string|null,reason:x.priceFeed,
}));
async function readExisting():Promise<Prior[]> {
  const {data,error}=await createSupabaseAdminClient()
    .from("intelligence_evidence")
    .select("id,external_evidence_id,event_at,content_hash,normalised_observation_id")
    .like("external_evidence_id","ai-close:%")
    .order("event_at",{ascending:false})
    .limit(100);
  if(error)throw Error("AI issuer close lookup failed: "+error.message);
  return (data??[]) as Prior[];
}
function isAlreadyCovered(rows:Prior[],ticker:string,due:string) {
  return rows.some(x=>x.external_evidence_id.startsWith("ai-close:"+ticker+":")
    &&x.normalised_observation_id
    &&x.event_at?.slice(0,10)>=due);
}
async function writeCanonicalCloses(items:AiClose[],now:string):Promise<{ids:string[];gaps:string[]}>{
  const db=createSupabaseAdminClient();
  const {persistSensorMemory}=await import("./providers/sensor-memory-supabase.ts");
  const ids:string[]=[],gaps:string[]=[];
  for(const item of items){
    const {data:prior,error:priorError}=await db.from("intelligence_evidence")
      .select("id,content_hash,normalised_observation_id")
      .eq("external_evidence_id",item.externalEvidenceId)
      .limit(5);
    if(priorError)throw Error(item.symbol+" prior-price check: "+priorError.message);
    if((prior??[]).some(x=>x.content_hash!==item.contentHash)){
      gaps.push(item.symbol+":CONFLICTING_SAME_SESSION_PRICE_REVISION");continue;
    }
    if(prior?.length){
      if(!prior[0].normalised_observation_id){
        gaps.push(item.symbol+":EXISTING_PRICE_EVIDENCE_MISSING_NORMALISED_ID");continue;
      }
      ids.push(prior[0].id);continue;
    }
    const {data:source,error:sourceError}=await db.from("intelligence_evidence_sources")
      .upsert({
        provider_key:"nasdaq_ai_company_daily_close",
        external_source_id:item.symbol,
        source_name:item.sourceName,source_type:"data_provider",
        source_url:item.sourceUrl,source_tier:2,reliability_score:85,
        methodology_notes:"Nasdaq daily US share/ADS historical closes, not total returns, issuer cash flows, Korean local shares or private-market valuations. Original trading session is preserved separately from collection/availability time.",
        metadata:{verificationRole:"canonical",methodology:AI_COMPANY_CLOSE_METHOD,priceScope:"US_STOCK_OR_ADS"},
        last_seen_at:now,updated_at:now,
      },{onConflict:"provider_key,external_source_id"})
      .select("id").single<{id:string}>();
    if(sourceError||!source)throw Error(item.symbol+" source registration failed: "+(sourceError?.message??"missing"));
    const claim=item.symbol+" Nasdaq US-listed share/ADS unadjusted close $"+item.closeUsd
      +" on "+item.observationDay+" (USD)."
      +(item.priceChangePercent!==null?" Prior-close change "+item.priceChangePercent+"%.":" No comparable prior close.")
      +" Market perception only; cannot prove AI revenues, margins or Regime validity.";
    const memory=await persistSensorMemory({
      provider:"nasdaq_ai_company_daily_close",sourceUrl:item.sourceUrl,
      sourceType:"market_data",contentType:"application/json",
      rawPayload:{
        ticker:item.symbol,priceUsd:item.closeUsd,sessionDate:item.observationDay,
        priorCloseUsd:item.priorCloseUsd,priceChangePercent:item.priceChangePercent,
        closeDefinition:"NASDAQ_US_DAILY_CLOSE_NOT_TOTAL_RETURN",
      },
      contentText:claim,
      // Nasdaq's historical API here supplies only an exchange session date,
      // not a verified publication clock. Do not manufacture a release time.
      publishedAt:null,observedAt:now,ingestionKey:item.externalEvidenceId,
      observations:[{
        observationType:"issuer_stock_daily_close",subjectType:"listed_us_stock_or_ads",
        subjectKey:item.symbol,observedAt:item.observedAt,effectiveAt:now,
        value:{closeUsd:item.closeUsd,sessionDate:item.observationDay,
          priorCloseUsd:item.priorCloseUsd,changePercent:item.priceChangePercent},
        unit:"USD_per_share",confidence:85,methodologyVersion:AI_COMPANY_CLOSE_METHOD,
      }],
    });
    const {data:normalized,error:normErr}=await db.from("normalised_observations")
      .select("id")
      .eq("raw_record_id",memory.rawRecordId)
      .eq("observation_type","issuer_stock_daily_close")
      .eq("subject_type","listed_us_stock_or_ads")
      .eq("subject_key",item.symbol)
      .eq("observed_at",item.observedAt)
      .eq("methodology_version",AI_COMPANY_CLOSE_METHOD)
      .limit(1).single<{id:string}>();
    if(normErr||!normalized)throw Error(item.symbol+" normalized close missing: "+(normErr?.message??"no row"));
    const {data:evidence,error:evidErr}=await db.from("intelligence_evidence")
      .upsert({
        source_id:source.id,external_evidence_id:item.externalEvidenceId,
        evidence_class:"market_observation",support_direction:"neutral",
        claim_text:claim,summary:null,event_at:item.observedAt,
        published_at:null,available_at:now,
        affected_assets:[item.symbol],affected_topics:["us-china-ai","ai-equity-pricing"],
        measurement_unit:"USD_per_share",observed_value:item.closeUsd,
        expected_value:null,previous_value:item.priorCloseUsd,
        confidence:85,freshness_status:"current",
        content_hash:item.contentHash,provenance_urls:[item.sourceUrl],
        structured_payload:{
          title:item.symbol+" daily close "+item.observationDay,
          evidenceNature:"issuer_nasdaq_us_close",methodologyVersion:AI_COMPANY_CLOSE_METHOD,
          ticker:item.symbol,priceScope:"US_STOCK_OR_ADS",
          sessionDate:item.observationDay,windowSessions:1,
          priorCloseUsd:item.priorCloseUsd,priceChangePercent:item.priceChangePercent,
          observationUnit:"USD_per_share",
          sourceIdentity:"Nasdaq official stocks history",
          sourcePublishTime:"UNVERIFIED_DAY_ONLY",collectedAt:now,
          interpretationAuthority:"market_perception_only_not_fundamentals",
        },
        raw_payload:{},normalizer_version:AI_COMPANY_CLOSE_METHOD,
        normalised_observation_id:normalized.id,updated_at:now,
      },{onConflict:"source_id,content_hash"})
      .select("id").single<{id:string}>();
    if(evidErr||!evidence)throw Error(item.symbol+" canonical price evidence failed: "+(evidErr?.message??"missing"));
    ids.push(evidence.id);
  }
  return{ids,gaps};
}
/** Strictly read-only on weekends if all due US closes are already canonically admitted. */
export async function collectScheduledAiCompanyCloses(
  now:Date,deps:PriceIntakeDependencies={},
):Promise<AiCloseCollection>{
  const at=now.toISOString(),due=expectedMarketMeasurementDays(now).usClose;
  const base={contractVersion:AI_COMPANY_CLOSE_METHOD,collectedAt:at,expectedUsSession:due,unsupported};
  try{
    const prior=await (deps.readExisting??readExisting)();
    const tickers=AI_COMPANY_WATCH.filter(x=>x.monitorId!==null).map(x=>x.ticker).filter((x):x is string=>x!==null);
    if(tickers.every(x=>isAlreadyCovered(prior,x,due)))return{
      ...base,status:"SKIPPED_UNCHANGED",evidenceIds:[],gaps:[],
    };
    const monitor=await (deps.readMonitor??(async()=>{
      const {getMarketMonitor}=await import("./market-monitor.ts");
      return getMarketMonitor();
    }))();
    const candidates=buildAiCompanyCloseCandidates(monitor.rows,now);
    const pending=candidates.items.filter(x=>!isAlreadyCovered(prior,x.symbol,x.observationDay));
    const out=await (deps.write??writeCanonicalCloses)(pending,at);
    return{
      ...base,status:candidates.gaps.length||out.gaps.length?"DEGRADED":"EVIDENCE_WRITTEN",
      evidenceIds:out.ids,gaps:[...candidates.gaps,...out.gaps],
    };
  }catch(error){
    return{
      ...base,status:"DEGRADED",evidenceIds:[],
      gaps:["AI_PRICE_PROVIDER_OR_CANONICAL_ERROR:"+(error instanceof Error?error.message:"unknown").slice(0,200)],
    };
  }
}
