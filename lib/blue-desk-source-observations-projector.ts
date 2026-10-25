/**
 * Narrow, read-only public projection of already stored original-source
 * observations. No creator transcripts, opinions, research summaries, thesis
 * creation or canonical admissions. Data publication is NOT inference.
 */
export type PublicSourceObservation = {
  id:string;
  kind:"MARKET_OBSERVATION"|"ORIGINAL_RELEASE";
  description:string;
  eventAt:string;
  recordedAt:string;
  sourceName:string;
  sourceUrl:string;
  sourceTier:number;
};

export type SourceObservationInput = {
  id:unknown; evidence_class:unknown; claim_text:unknown;
  event_at:unknown; received_at:unknown; available_at?:unknown;
  provenance_urls:unknown; freshness_status:unknown;
  source:unknown;
};
const ELIGIBLE=new Set(["market_observation","official_release","company_primary"]);
export const SOURCE_OBSERVATION_MAX_AGE_MS=48*60*60*1000;
const PROCESS=/\b(?:canonical evidence|ingestion pipeline|provider health|retry slot|research gap|system 2|transcript|rumour|speculation)\b/i;

function validOriginalUrl(input:unknown):string|null{
 if(typeof input!=="string")return null;
 try{
  const u=new URL(input);
  if(u.protocol!=="https:"||u.username||u.password||u.href.length>2048||
     (u.pathname==="/"&&!u.search))return null;
  return u.href;
 }catch{return null;}
}
function sourceRecord(raw:unknown):Record<string,unknown>{
 const item=Array.isArray(raw)?raw[0]:raw;
 return item&&typeof item==="object"?item as Record<string,unknown>:{};
}

/**
 * Tier 1/2 independently sourced measurements or official releases only.
 * A stored research lead does not qualify merely because it has a URL.
 */
export function projectSourceObservations(
 rows:readonly SourceObservationInput[],now=new Date(),limit=8,
):PublicSourceObservation[]{
 const ms=now.getTime(),seen=new Set<string>();
 if(!Number.isFinite(ms))return [];
 const result:PublicSourceObservation[]=[];
 for(const row of [...rows].sort((a,b)=>Date.parse(String(b.event_at))-Date.parse(String(a.event_at)))){
  if(!ELIGIBLE.has(String(row.evidence_class)))continue;
  if(row.freshness_status!=="current")continue;
  const source=sourceRecord(row.source);
  const tier=Number(source.source_tier);
  if(!Number.isInteger(tier)||tier<1||tier>2)continue;
  if(source.source_type!=="data_provider" &&
     row.evidence_class==="market_observation")continue;
  if(!["official_release","company_primary","market_observation"].includes(String(row.evidence_class)))continue;
  const eventAt=Date.parse(String(row.event_at||""));
  const recordedAt=Date.parse(String(row.received_at||row.available_at||""));
  if(!Number.isFinite(eventAt)||!Number.isFinite(recordedAt)||
     eventAt>ms||recordedAt>ms||recordedAt<eventAt||
     ms-eventAt>SOURCE_OBSERVATION_MAX_AGE_MS)continue;
  const description=String(row.claim_text||"").trim().replace(/\s+/g," ");
  if(description.length<35||description.length>2400||PROCESS.test(description))continue;
  const name=String(source.source_name||"").trim();
  if(!name||name.length>150)continue;
  const urls=Array.isArray(row.provenance_urls)?row.provenance_urls:[];
  const url=urls.map(validOriginalUrl).find(Boolean)||validOriginalUrl(source.source_url);
  if(!url)continue;
  const key=String(row.id);
  if(!/^[0-9a-f-]{36}$/i.test(key)||seen.has(url+"|"+description))continue;
  seen.add(url+"|"+description);
  result.push({
   id:key,
   kind:row.evidence_class==="market_observation"?"MARKET_OBSERVATION":"ORIGINAL_RELEASE",
   description:description.slice(0,700),
   eventAt:new Date(eventAt).toISOString(),
   recordedAt:new Date(recordedAt).toISOString(),
   sourceName:name,sourceUrl:url,sourceTier:tier,
  });
  if(result.length>=Math.max(0,Math.min(limit,12)))break;
 }
 return result;
}

