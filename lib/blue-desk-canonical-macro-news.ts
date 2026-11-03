import type {NewsBriefV1} from "./market-brief-news.ts";
import {officialActualSourceUrl,type OfficialMacroRelease} from "./macro/official-actuals.ts";
import {parseOfficialBeaPceMetricRows} from "./macro/bea-pce-actual.ts";

/** Existing official macro_releases completed actuals are one ORIGINAL-source
 * factual news tier, not a new publisher, Newsroom approval or market verdict.
 * Underlying status must be successfully ingested from a deterministic
 * original official source and remain within the dated public reader window.
 */
export type CompletedMacroRow={
 id:unknown;release_name:unknown;agency:unknown;release_date:unknown;
 reference_period:unknown;status:unknown;source_url:unknown;
 source_classification:unknown;actual:unknown;actual_retrieved_at:unknown;
 ingestion_attempt_status:unknown;released_at:unknown;
};
const agencyNames=new Set([
 "U.S. Bureau of Labor Statistics","U.S. Bureau of Economic Analysis",
]);
function validActual(name:string,actual:string):boolean{
 if(!actual||actual.length>450||/[<>\u0000-\u001f]/.test(actual))return false;
 if(name==="Personal Income and Outlays")
  return parseOfficialBeaPceMetricRows(actual).length===4;
 if(/jolts|job openings/i.test(name))return /^Job openings (?:[0-9]|[12][0-9])(?:\.\d)?M$/.test(actual);
 if(/consumer price index/i.test(name))
  return /^Headline CPI [+-]?\d+(?:\.\d+)?% m\/m(?:; (?:\+?\d+(?:\.\d+)?% y\/y|Core [+-]?\d+(?:\.\d+)?% m\/m))*$/.test(actual);
 if(/producer price index/i.test(name))
  return /^Final demand PPI [+-]?\d+(?:\.\d+)?% m\/m(?:; \+?\d+(?:\.\d+)?% y\/y)?$/.test(actual);
 if(/employment situation|nonfarm payroll/i.test(name))
  return /^Nonfarm payrolls [+-]?\d+k; unemployment \d+(?:\.\d+)?%; participation \d+(?:\.\d+)?%; AHE [+-]?\d+(?:\.\d+)?% y\/y$/.test(actual);
 if(/ism manufacturing/i.test(name))return /^Manufacturing PMI \d+(?:\.\d+)?$/.test(actual);
 if(/ism services/i.test(name))return /^Services PMI \d+(?:\.\d+)?$/.test(actual);
 return false;
}
export function projectCompletedOfficialMacroNews(
 rows:readonly CompletedMacroRow[],now:Date,limit=12,lookbackDays=7,
):NewsBriefV1[]{
 const at=+now,seen=new Set<string>();
 if(!Number.isFinite(at)||!Number.isInteger(limit)||limit<1||limit>18||
  !Number.isInteger(lookbackDays)||lookbackDays<1||lookbackDays>7)return [];
 const accepted:NewsBriefV1[]=[];
 for(const row of rows){
  const id=typeof row.id==="string"?row.id:"";
  const name=typeof row.release_name==="string"?row.release_name.trim():"";
  const agency=typeof row.agency==="string"?row.agency:"";
  const period=typeof row.reference_period==="string"?row.reference_period.trim():"";
  const source=typeof row.source_url==="string"?row.source_url:"";
  const actual=typeof row.actual==="string"?row.actual.trim():"";
  const release=typeof row.release_date==="string"?row.release_date:"";
  const retrieved=typeof row.actual_retrieved_at==="string"?row.actual_retrieved_at:"";
  const released=typeof row.released_at==="string"?row.released_at:"";
  if(!/^[a-z0-9-]{12,130}$/.test(id)||!/^\w+ 20\d{2}$/.test(period)||
    !agencyNames.has(agency)||row.status!=="completed"||
    row.ingestion_attempt_status!=="completed"||
    row.source_classification!=="official_government"||!validActual(name,actual))continue;
  if(agency==="U.S. Bureau of Economic Analysis"&&name!=="Personal Income and Outlays")continue;
  if(agency==="U.S. Bureau of Labor Statistics"&&name==="Personal Income and Outlays")continue;
  const eventAt=Date.parse(release),obtainedAt=Date.parse(retrieved),officialAt=Date.parse(released);
  if(!Number.isFinite(eventAt)||!Number.isFinite(obtainedAt)||!Number.isFinite(officialAt)||
    eventAt!==officialAt||eventAt>at||at-eventAt>lookbackDays*86400000||
    obtainedAt<eventAt||obtainedAt>at)continue;
  const releaseInfo={id,release_name:name,agency,reference_period:period,release_date:release,
   actual,status:"completed",source_url:source} satisfies OfficialMacroRelease;
  const canonical=officialActualSourceUrl(releaseInfo);
  if(!canonical||source!==canonical||seen.has(source))continue;
  seen.add(source);
  accepted.push({
   contractVersion:"news-brief/1",contentType:"NEWS_BRIEF",id:"official-macro-"+id,
   headline:name+" — "+period+" official result",
   summary:name+" ("+period+"): "+actual+". Original government actual; expectations and market reactions are not established by this record.",
   sourceName:agency+" · official result",sourceUrl:canonical,sourceKind:"official",
   occurredAt:new Date(eventAt).toISOString(),
   observedAt:new Date(obtainedAt).toISOString(),
   verification:"SOURCE_VERIFIED",
  });
 }
 return accepted.sort((a,b)=>Date.parse(b.occurredAt)-Date.parse(a.occurredAt))
  .slice(0,limit);
}
