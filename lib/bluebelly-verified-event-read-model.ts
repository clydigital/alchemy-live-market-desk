import {createHash} from "node:crypto";
import type {NewsBriefV1} from "./market-brief-news.ts";

/**
 * Shared, read-only, source-qualified event projection. It does not admit
 * research intake, creator commentary, unverified Motion, private Dossier
 * records or price-causality assertions. No additional events are persisted.
 */
export const VERIFIED_EVENT_CONTRACT = "bluebelly/verified-market-events/1" as const;
export type EventSource = "motion" | "originalPress" | "officialMacro";
export type SourceReadState = "READABLE" | "UNAVAILABLE";
export type VerifiedMarketEvent = {
  eventKey:string;
  sourceRecordId:string;
  title:string;
  fact:string;
  publisher:string;
  originalUrl:string;
  sourceKind:string;
  occurredAt:string;
  sourceObservedAt:string;
  fetchedAt:string;
  freshness:"CURRENT_48H" | "OLDER_7D";
  verification:"SOURCE_VERIFIED";
  evidenceStatus:"ORIGINAL_SOURCE_FACT_ONLY";
  marketReaction:{status:"NOT_VERIFIED";value:null};
  affectedAssets:null;
  researchInterpretation:null;
};
export type EventReadModel = {
  contractVersion:typeof VERIFIED_EVENT_CONTRACT;
  generatedAt:string;
  status:"SOURCE_DATED"|"NO_QUALIFIED_EVENTS"|"DEGRADED"|"UNAVAILABLE";
  sourceReads:Record<EventSource,SourceReadState>;
  windowStart:string;
  count:number;
  events:VerifiedMarketEvent[];
};
const VALID_KINDS = new Set(["official","primary","filing","reporting","market_data"]);
const SEVEN_DAYS = 7 * 86400_000;
const FORTY_EIGHT_HOURS = 48 * 3600_000;

function canonicalUrl(raw:string):string|null {
  try {
    const u=new URL(raw);
    if(u.protocol!=="https:"||u.username||u.password||!u.hostname.includes(".")||
      u.hostname==="localhost"||u.hostname.endsWith(".local")||u.hostname.endsWith(".internal")||
      u.href.length>2048)return null;
    u.hash="";
    if(u.pathname.length>1)u.pathname=u.pathname.replace(/\/$/,"");
    for(const key of [...u.searchParams.keys()])
      if(/^(utm_.+|fbclid|gclid)$/i.test(key))u.searchParams.delete(key);
    return u.toString();
  }catch{return null;}
}
function cleanText(value:unknown,min:number,max:number):value is string {
  return typeof value==="string"&&value.trim().length>=min&&value.length<=max;
}
/**
 * Since/limit are intentionally bounded. Event time is never derived from
 * ingestion/verification time, even when source processing was delayed.
 */
export function projectVerifiedMarketEvents(
  items:readonly NewsBriefV1[],
  now=new Date(),
  options:{since?:string;limit?:number;sourceReads?:Record<EventSource,SourceReadState>}={},
):EventReadModel {
  const time=now.getTime();
  if(!Number.isFinite(time))throw new Error("Invalid projection clock");
  const sourceReads=options.sourceReads??{motion:"READABLE",originalPress:"READABLE",officialMacro:"READABLE"};
  const since=options.since ? Date.parse(options.since) : time-FORTY_EIGHT_HOURS;
  if(!Number.isFinite(since)||since>time||since<time-SEVEN_DAYS)
    throw new Error("Event cursor outside the supported seven-day window");
  const limit=Math.max(1,Math.min(18,Number.isInteger(options.limit)?options.limit!:12));
  const seen=new Set<string>();
  const events=[...items].sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt))
    .flatMap((item):VerifiedMarketEvent[]=>{
      if(item.contractVersion!=="news-brief/1"||item.verification!=="SOURCE_VERIFIED"||
        !VALID_KINDS.has(item.sourceKind.toLowerCase())||
        !cleanText(item.headline,8,500)||!cleanText(item.summary,25,2000)||
        !cleanText(item.sourceName,2,150)||!cleanText(item.id,8,100))return [];
      const uri=canonicalUrl(item.sourceUrl);
      if(!uri)return [];
      const occurred=Date.parse(item.occurredAt),observed=Date.parse(item.observedAt);
      if(!Number.isFinite(occurred)||!Number.isFinite(observed)||occurred>time||
        observed>time||observed<occurred||occurred<since||time-occurred>SEVEN_DAYS)return [];
      const eventKey="event:"+createHash("sha256").update(uri).digest("hex").slice(0,24);
      if(seen.has(eventKey))return [];
      seen.add(eventKey);
      return [{
        eventKey,sourceRecordId:item.id,title:item.headline.trim(),fact:item.summary.trim(),
        publisher:item.sourceName.trim(),originalUrl:uri,sourceKind:item.sourceKind,
        occurredAt:new Date(occurred).toISOString(),
        sourceObservedAt:new Date(observed).toISOString(),
        fetchedAt:now.toISOString(),
        freshness:time-occurred<=FORTY_EIGHT_HOURS?"CURRENT_48H":"OLDER_7D",
        verification:"SOURCE_VERIFIED",evidenceStatus:"ORIGINAL_SOURCE_FACT_ONLY",
        marketReaction:{status:"NOT_VERIFIED",value:null},
        affectedAssets:null,researchInterpretation:null,
      }];
    }).slice(0,limit);
  const readable=Object.values(sourceReads).filter(v=>v==="READABLE").length;
  const status:EventReadModel["status"]=readable===0?"UNAVAILABLE":readable<3?"DEGRADED":
    events.length?"SOURCE_DATED":"NO_QUALIFIED_EVENTS";
  return {
    contractVersion:VERIFIED_EVENT_CONTRACT,generatedAt:now.toISOString(),
    status,sourceReads,windowStart:new Date(since).toISOString(),
    count:events.length,events,
  };
}
