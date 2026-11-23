import {beaPceReleaseUrl,parseOfficialBeaPceMetricRows} from "./macro/bea-pce-actual.ts";

/**
 * A public, read-only PCE event receipt. Original BEA actuals and attributed
 * pre-release forecasts retain separate provenance and clocks. This is not a
 * forecast producer, a live rates feed or a canonical Regime decision.
 */
export const OCTOBER_PCE_AT="2026-11-25T13:30:00Z";
export const OCTOBER_PCE_PERIOD="October 2026";
export const OCTOBER_PCE_SOURCE=beaPceReleaseUrl("Personal Income and Outlays",OCTOBER_PCE_PERIOD,OCTOBER_PCE_AT)!;

const SPECS=[
 {key:"pce_headline_mom",label:"Headline PCE · monthly"},
 {key:"pce_headline_yoy",label:"Headline PCE · annual"},
 {key:"pce_core_mom",label:"Core PCE · monthly"},
 {key:"pce_core_yoy",label:"Core PCE · annual"},
] as const;
type Key=typeof SPECS[number]["key"];

export type PceReleaseInput={
 id?:unknown;release_name?:unknown;reference_period?:unknown;agency?:unknown;
 release_date?:unknown;status?:unknown;source_url?:unknown;
 source_classification?:unknown;actual?:unknown;released_at?:unknown;
 actual_retrieved_at?:unknown;ingestion_attempt_status?:unknown;
};
export type PceMetricInput={
 metric_key?:unknown;actual?:unknown;consensus?:unknown;consensus_source?:unknown;
 consensus_captured_at?:unknown;previous?:unknown;revised_previous?:unknown;
 source_url?:unknown;retrieved_at?:unknown;metadata?:unknown;
};
export type PceReadoutState=
 "PRE_RELEASE"|"AWAITING_VERIFIED_ACTUAL"|"SOURCE_UNAVAILABLE"|
 "OFFICIAL_SOURCE_CONFLICT"|"AWAITING_VERIFIED_METRICS"|
 "AWAITING_MARKET_CONFIRMATION";
export type PceReadoutMetric={
 key:Key;label:string;actual:number|null;consensus:number|null;
 consensusVerified:boolean;consensusCapturedAt:string|null;consensusSource:string|null;
 consensusUrl:string|null;previous:number|null;revisedPrevious:number|null;
 surprisePp:number|null;
};
export type PceReadout={
 state:PceReadoutState;releaseAt:string;referencePeriod:string;releaseSource:string;
 actualVerified:boolean;actualRetrievedAt:string|null;
 metrics:PceReadoutMetric[];validConsensusCount:number;note:string;
 marketReaction:"INTRADAY_NOT_INTEGRATED";canonicalRegimeUnchanged:true;
};
function number(value:unknown):number|null{
 if(typeof value!=="number"&&!(typeof value==="string"&&value.trim()&&/^-?\d+(?:\.\d+)?$/.test(value.trim())))return null;
 const n=Number(value);
 return Number.isFinite(n)&&Math.abs(n)<=30?n:null;
}
function validTime(value:unknown,lo:number,hi:number):string|null{
 if(typeof value!=="string")return null;
 const t=Date.parse(value);
 return Number.isFinite(t)&&t>=lo&&t<=hi?new Date(t).toISOString():null;
}
function forecastUrl(row:PceMetricInput):string|null{
 const meta=row.metadata&&typeof row.metadata==="object"&&!Array.isArray(row.metadata)
  ?row.metadata as Record<string,unknown>:{};
 const raw=[meta.consensus_source_url,meta.consensusSourceUrl,row.consensus_source].find(
  item=>typeof item==="string"&&item.startsWith("https://")
 );
 if(typeof raw!=="string")return null;
 try{const url=new URL(raw);return url.protocol==="https:"&&url.hostname.includes(".")&&
  !url.username&&!url.password?url.toString():null;}catch{return null;}
}
function officialRelease(row:PceReleaseInput|null,now:number):boolean{
 if(!row)return false;
 if(row.id!=="us-bea-2026-11-25-personal-income-outlays-oct-2026"||
  row.release_name!=="Personal Income and Outlays"||
  row.reference_period!==OCTOBER_PCE_PERIOD||
  row.agency!=="U.S. Bureau of Economic Analysis"||
  row.source_classification!=="official_government"||
  row.source_url!==OCTOBER_PCE_SOURCE||
  row.status!=="completed"&&row.status!=="revision_detected"||
  row.ingestion_attempt_status!=="completed"||
  Date.parse(String(row.release_date??""))!==Date.parse(OCTOBER_PCE_AT)||
  Date.parse(String(row.released_at??""))!==Date.parse(OCTOBER_PCE_AT)||
  typeof row.actual!=="string"||
  !validTime(row.actual_retrieved_at,Date.parse(OCTOBER_PCE_AT),now))return false;
 return parseOfficialBeaPceMetricRows(row.actual).length===4;
}
export function projectOctoberPceReadout(
 release:PceReleaseInput|null,
 rows:readonly PceMetricInput[]|null,
 now:Date,
 sourceUnavailable=false,
):PceReadout{
 const t=now.getTime(),start=Date.parse(OCTOBER_PCE_AT);
 const actualVerified=!sourceUnavailable&&Number.isFinite(t)&&t>=start&&officialRelease(release,t);
 const official=actualVerified?parseOfficialBeaPceMetricRows(release!.actual as string):[];
 const covered=new Set<string>();
 let conflict=false;
 const metrics=PceReadoutMetric[]=SPECS.map(spec=>{
  const matches=rows?.filter(row=>row.metric_key===spec.key)??[];
  if(matches.length>1)conflict=true;
  const row=matches.length===1?matches[0]:{};
  const recordedActual=number(row.actual);
  const fromRelease=official.find(item=>item.metric_key===spec.key)?.actual??null;
  const isOfficialMetric=actualVerified&&row.source_url===OCTOBER_PCE_SOURCE&&
   validTime(row.retrieved_at,start,t)!==null&&recordedActual!==null&&
   fromRelease!==null&&Math.abs(recordedActual-fromRelease)<0.000001;
  if(actualVerified&&matches.length&&(!isOfficialMetric||matches.length!==1))conflict=true;
  if(isOfficialMetric)covered.add(spec.key);
  const captured=validTime(row.consensus_captured_at,0,start-1);
  const source=typeof row.consensus_source==="string"&&row.consensus_source.trim().length>=3
   ?row.consensus_source.trim():null;
  const url=forecastUrl(row);
  const consensus=number(row.consensus);
  const verified=consensus!==null&&captured!==null&&source!==null&&url!==null;
  const actual=isOfficialMetric?recordedActual:null;
  const estimate=verified?consensus:null;
  return {key:spec.key,label:spec.label,actual,consensus:estimate,
   consensusVerified:verified,consensusCapturedAt:captured,consensusSource:verified?source:null,
   consensusUrl:verified?url:null,
   previous:number(row.previous),revisedPrevious:number(row.revised_previous),
   surprisePp:actual!==null&&estimate!==null?Number((actual-estimate).toFixed(3)):null};
 });
 let state:PceReadoutState="PRE_RELEASE";
 if(sourceUnavailable)state="SOURCE_UNAVAILABLE";
 else if(!Number.isFinite(t)||t<start)state="PRE_RELEASE";
 else if(release&&(release.status==="completed"||release.status==="revision_detected")&&!actualVerified)
  state="OFFICIAL_SOURCE_CONFLICT";
 else if(!actualVerified)state="AWAITING_VERIFIED_ACTUAL";
 else if(conflict)state="OFFICIAL_SOURCE_CONFLICT";
 else if(covered.size!==4)state="AWAITING_VERIFIED_METRICS";
 else state="AWAITING_MARKET_CONFIRMATION";
 const messages:Record<PceReadoutState,string>={
  PRE_RELEASE:"BEA event is scheduled. Pre-release forecasts are shown only when their original capture time and source URL are recorded.",
  SOURCE_UNAVAILABLE:"The canonical source lookup failed. A missing database read is not evidence that the release or forecast does not exist.",
  AWAITING_VERIFIED_ACTUAL:"The scheduled release time has passed, but an original BEA actual has not been verified in the existing ingestion store.",
  OFFICIAL_SOURCE_CONFLICT:"Release identity, clock, original-source provenance or component values failed verification. No surprise or regime change is inferred.",
  AWAITING_VERIFIED_METRICS:"The original release has been ingested, but all four independently checked component metrics are not yet available.",
  AWAITING_MARKET_CONFIRMATION:"Four official PCE metrics are verified. Compare them with sourced pre-release forecasts and then a separately dated FX/rates/credit reaction; no regime verdict is automatic.",
 };
 return {state,releaseAt:OCTOBER_PCE_AT,referencePeriod:OCTOBER_PCE_PERIOD,
  releaseSource:OCTOBER_PCE_SOURCE,actualVerified,
  actualRetrievedAt:actualVerified?String(release!.actual_retrieved_at):null,
  metrics,validConsensusCount:metrics.filter(m=>m.consensusVerified).length,
  note:messages[state],marketReaction:"INTRADAY_NOT_INTEGRATED",
  canonicalRegimeUnchanged:true};
}
