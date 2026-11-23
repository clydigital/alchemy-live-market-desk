import {parseOfficialBeaPceMetricRows} from "./macro/bea-pce-actual.ts";

export type EconFamily="PCE"|"CPI"|"PPI"|"JOBS"|"JOLTS"|"GDP"|"RETAIL"|"ISM";
export type EconStatus="SCHEDULED"|"AWAITING_ACTUAL"|"VERIFIED_ACTUAL"|"PARTIAL_METRICS"|"SOURCE_CONFLICT";
export type EconInput={
 id:unknown;release_name:unknown;release_date:unknown;agency:unknown;
 reference_period?:unknown;source_url:unknown;source_classification?:unknown;
 actual?:unknown;released_at?:unknown;actual_retrieved_at?:unknown;
 status?:unknown;ingestion_attempt_status?:unknown;
};
export type EconMetricInput={
 release_id:unknown;metric_key:unknown;label?:unknown;unit?:unknown;
 actual?:unknown;previous?:unknown;revised_previous?:unknown;
 consensus?:unknown;consensus_source?:unknown;consensus_captured_at?:unknown;
 source_url?:unknown;retrieved_at?:unknown;metadata?:unknown;
};
export type EconScheduleInput={
 id:string;event:string;date:string;timeLabel:string;country:string;
 referencePeriod:string|null;sourceName:string;sourceUrl:string;sourceKind:string;
};
export type EconMetric={
 key:string;label:string;unit:string;actual:number|null;previous:number|null;
 revisedPrevious:number|null;forecast:number|null;forecastSource:string|null;
 forecastCapturedAt:string|null;forecastUrl:string|null;surprise:number|null;
};
export type EconEvent={
 id:string;name:string;family:EconFamily;referencePeriod:string|null;
 releaseAt:string;sourceUrl:string;agency:string;sourceClock:string|null;
 status:EconStatus;actualText:string|null;metrics:EconMetric[];
};
export type UsEconStatWatch={
 status:"OK"|"SOURCE_UNAVAILABLE"|"NO_COVERAGE";generatedAt:string;
 latest:EconEvent[];upcoming:EconEvent[];countVerified:number;countPending:number;
 nextTest:string;researchOnly:true;sourceStatus:string;
};

export function family(name:string):EconFamily|null{
 if(/personal income and outlays|personal consumption expenditure|(?:\b)pce(?:\b)/i.test(name))return "PCE";
 if(/consumer price index|\bcpi\b/i.test(name))return "CPI";
 if(/producer price index|\bppi\b/i.test(name))return "PPI";
 if(/employment situation|nonfarm payroll/i.test(name))return "JOBS";
 if(/job openings|jolts/i.test(name))return "JOLTS";
 if(/gross domestic product|\bgdp\b/i.test(name))return "GDP";
 if(/advance monthly (?:retail|sales)|retail sales/i.test(name))return "RETAIL";
 if(/\bism\b.*(?:manufacturing|services)|manufacturing pmi|services pmi/i.test(name))return "ISM";
 return null;
}
const officialHosts=["bls.gov","bea.gov","census.gov","ismworld.org"];
function originalUrl(value:unknown):string|null{
 if(typeof value!=="string")return null;
 try{
  const url=new URL(value);
  if(url.protocol!=="https:"||url.username||url.password||!officialHosts.some(
   host=>url.hostname===host||url.hostname.endsWith("."+host)))return null;
  return url.toString();
 }catch{return null;}
}
function sourceForecastUrl(row:EconMetricInput):string|null{
 const meta=row.metadata&&typeof row.metadata==="object"&&!Array.isArray(row.metadata)
  ?row.metadata as Record<string,unknown>:{};
 const val=[meta.consensus_source_url,meta.consensusSourceUrl,row.consensus_source]
  .find(x=>typeof x==="string"&&x.startsWith("https://"));
 if(typeof val!=="string")return null;
 try{const url=new URL(val);return url.protocol==="https:"&&
  url.hostname.includes(".")&&!url.username&&!url.password?url.toString():null;}
 catch{return null;}
}
function num(value:unknown):number|null{
 const valid=typeof value==="number"||typeof value==="string"&&/^[+-]?\d+(?:\.\d+)?$/.test(value.trim());
 const n=valid?Number(value):NaN;
 return Number.isFinite(n)&&Math.abs(n)<1000000000?n:null;
}
function instant(value:unknown):number|null{
 if(typeof value!=="string")return null;
 const n=Date.parse(value);return Number.isFinite(n)?n:null;
}
function verifiedRelease(row:EconInput,now:number):boolean{
 const date=instant(row.release_date),published=instant(row.released_at),retrieved=instant(row.actual_retrieved_at);
 if(date===null||published===null||retrieved===null||
  date>now||published>now||retrieved>now||
  Math.abs(date-published)>3*3600000||retrieved<published)return false;
 if(row.status!=="completed"&&row.status!=="revision_detected")return false;
 if(row.ingestion_attempt_status!=="completed"||row.source_classification!=="official_government")return false;
 if(!originalUrl(row.source_url)||typeof row.actual!=="string"||!row.actual.trim()||
   row.actual.length>500||/[<>\u0000-\u001f]/.test(row.actual))return false;
 if(family(String(row.release_name))==="PCE"&&parseOfficialBeaPceMetricRows(row.actual).length!==4)return false;
 return true;
}
function metricOf(row:EconMetricInput,release:EconInput,verified:boolean,now:number):EconMetric|null{
 if(typeof row.metric_key!=="string"||!/^[a-z0-9_]{3,72}$/.test(row.metric_key))return null;
 const releaseAt=instant(release.release_date)??0;
 const captured=instant(row.consensus_captured_at);
 const source=typeof row.consensus_source==="string"&&row.consensus_source.trim()?row.consensus_source.trim():null;
 const forecastUrl=sourceForecastUrl(row);
 const sourceQualified=captured!==null&&captured<releaseAt&&captured<=now&&source!==null&&forecastUrl!==null;
 const forecast=sourceQualified?num(row.consensus):null;
 const observedAt=instant(row.retrieved_at);
 const actual=verified&&originalUrl(row.source_url)!==null&&
  observedAt!==null&&observedAt>=releaseAt&&observedAt<=now?num(row.actual):null;
 const unit=typeof row.unit==="string"&&row.unit.length<16?row.unit:"";
 return {key:row.metric_key,label:typeof row.label==="string"&&row.label.trim()?row.label.slice(0,88):row.metric_key,
  unit,actual,previous:num(row.previous),revisedPrevious:num(row.revised_previous),
  forecast,forecastSource:forecast!==null?source:null,
  forecastUrl:forecast!==null?forecastUrl:null,
  forecastCapturedAt:forecast!==null?new Date(captured!).toISOString():null,
  surprise:actual!==null&&forecast!==null?Number((actual-forecast).toFixed(4)):null};
}
/**
 * A date-only schedule is not a reliable intraday clock. For original 08:30
 * Eastern releases, derive the real UTC instant with IANA DST offset. Unknown
 * publication times remain date-only rather than using a guessed time.
 */
export function originalUsReleaseClock(row:EconScheduleInput):string|null{
 if(!/^\d{4}-\d{2}-\d{2}$/.test(row.date)||row.timeLabel!=="08:30 ET")return null;
 const mid=Date.parse(row.date+"T12:00:00Z");
 if(!Number.isFinite(mid))return null;
 const zone=new Intl.DateTimeFormat("en-US",{
  timeZone:"America/New_York",timeZoneName:"shortOffset",
 }).formatToParts(new Date(mid)).find(p=>p.type==="timeZoneName")?.value??"";
 const m=/^GMT([+-])(\d{1,2})(?::(\d{2}))?$/.exec(zone);
 if(!m)return null;
 const offset=(m[1]==="+"?1:-1)*(Number(m[2])*60+Number(m[3]??0));
 const t=Date.parse(row.date+"T08:30:00Z")-offset*60_000;
 const d=new Date(t);
 return Number.isFinite(d.getTime())?d.toISOString():null;
}

export function projectUsEconStatWatch(input:{
 releases:readonly EconInput[];metrics:readonly EconMetricInput[];
 schedule?:readonly EconScheduleInput[];now:Date;sourceUnavailable?:boolean;
}):UsEconStatWatch{
 const {releases,metrics,now,sourceUnavailable=false}=input;
 const t=now.getTime();
 const upcomingMax=t+21*86400000,recentMin=t-35*86400000;
 const dedup=new Set<string>();
 const accepted:EconEvent[]=[];
 for(const row of releases){
  const at=instant(row.release_date),id=typeof row.id==="string"?row.id:"";
  const name=typeof row.release_name==="string"?row.release_name:"";
  const f=family(name),url=originalUrl(row.source_url);
  if(!id.startsWith("us-")||!f||!url||at===null||at<recentMin||at>upcomingMax||
    !["U.S. Bureau of Labor Statistics","U.S. Bureau of Economic Analysis","U.S. Census Bureau"].includes(String(row.agency))||
    row.source_classification!=="official_government"||dedup.has(id))continue;
  dedup.add(id);
  const verified=verifiedRelease(row,t),complete=at<=t&&row.status==="completed"||row.status==="revision_detected";
  const relevant=metrics.filter(m=>m.release_id===id);
  const metricKeys=new Set(relevant.map(m=>m.metric_key));
  const conflict=metricKeys.size!==relevant.length;
  const parsed=relevant.slice(0,24).map(m=>metricOf(m,row,verified,t)).filter((m):m is EconMetric=>m!==null);
  const items=parsed.slice(0,8);
  const actualText=verified?String(row.actual).trim():null;
  const published=verified?new Date(instant(row.actual_retrieved_at)!).toISOString():null;
  const pceComponents=verified&&f==="PCE"?parseOfficialBeaPceMetricRows(String(row.actual)):[];
  const pceMismatch=pceComponents.some(item=>{
   const matches=parsed.filter(metric=>metric.key===item.metric_key&&metric.actual!==null);
   return matches.length>0&&matches.some(metric=>Math.abs(metric.actual!-item.actual)>0.000001);
  });
  const pceIncomplete=pceComponents.some(item=>!parsed.some(metric=>
   metric.key===item.metric_key&&metric.actual!==null));
  const status:EconStatus=at>t?"SCHEDULED":verified
   ? conflict||pceMismatch?"SOURCE_CONFLICT":
     pceIncomplete||relevant.length&&parsed.every(m=>m.actual===null)?"PARTIAL_METRICS":"VERIFIED_ACTUAL"
   :complete?"SOURCE_CONFLICT":"AWAITING_ACTUAL";
  accepted.push({id,name,family:f,referencePeriod:typeof row.reference_period==="string"?row.reference_period:null,
   releaseAt:new Date(at).toISOString(),sourceUrl:url,agency:String(row.agency),
   sourceClock:published,status,actualText,metrics:items});
 }
 for(const row of input.schedule??[]){
  if(row.country!=="United States"||!["official-live","official-schedule"].includes(row.sourceKind)||
   !row.id.startsWith("us-")||dedup.has(row.id))continue;
  const f=family(row.event),url=originalUrl(row.sourceUrl);
  if(!f||!url||!/^20\d{2}-\d\d-\d\d$/.test(row.date))continue;
  // Scheduled-only entries can name a date without pretending the exact intraday
  // publication clock is known. On the due date, the actual must still be ingested.
  const day=Date.parse(row.date+"T00:00:00Z");
  if(!Number.isFinite(day)||day<recentMin||day>upcomingMax)continue;
  const verifiedClock=originalUsReleaseClock(row);
  const eventDue=verifiedClock!==null&&Date.parse(verifiedClock)<=t;
  accepted.push({id:row.id,name:row.event,family:f,referencePeriod:row.referencePeriod,
   releaseAt:verifiedClock??row.date+"T00:00:00Z",sourceUrl:url,agency:row.sourceName,
   sourceClock:null,status:eventDue?"AWAITING_ACTUAL":"SCHEDULED",actualText:null,metrics:[]});
  dedup.add(row.id);
 }
 const latest=accepted.filter(e=>Date.parse(e.releaseAt)<=t&&e.status!=="SCHEDULED")
  .sort((a,b)=>b.releaseAt.localeCompare(a.releaseAt)).slice(0,7);
 const upcoming=accepted.filter(e=>Date.parse(e.releaseAt)>t||e.status==="SCHEDULED")
  .sort((a,b)=>a.releaseAt.localeCompare(b.releaseAt)).slice(0,8);
 const countVerified=latest.filter(e=>e.status==="VERIFIED_ACTUAL").length;
 const countPending=latest.length-countVerified;
 const status=sourceUnavailable?"SOURCE_UNAVAILABLE":accepted.length?"OK":"NO_COVERAGE";
 const next=upcoming[0];
 return {status,generatedAt:Number.isFinite(t)?now.toISOString():"",
  latest,upcoming,countVerified,countPending,
  nextTest:next?next.name+" · "+next.referencePeriod+" · "+next.releaseAt.slice(0,10):
   "No source-confirmed upcoming US release in the current 21-day window.",
  researchOnly:true,
  sourceStatus:sourceUnavailable?
   "Canonical release/metric read unavailable: scheduled-only discovery is not a verified actual.":
   "Server reads existing scheduled macro ingestion and original government release records on each page refresh; source clocks are not page clocks."};
}
