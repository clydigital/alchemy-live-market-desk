import {fetchJinaReader} from "../acquisition/jina-reader.ts";

/** Original RBA Monetary Policy Board decisions only. No forecast, market
 * reaction or secondary commentary can qualify an actual cash-rate receipt.
 */
export const RBA_DECISION_INDEX = "https://www.rba.gov.au/monetary-policy/int-rate-decisions/";
export const RBA_BOARD_SCHEDULE = "https://www.rba.gov.au/schedules-events/board-meeting-schedules.html";
const RBA_HOST = "www.rba.gov.au";

export type RbaReleaseCandidate = {
  id:string; agency:string; release_name:string; release_date:string; source_url:string;
};
export type VerifiedRbaActual = {
  actual:string; previous:string|null; sourceUrl:string; releasedAt:string;
};

function releaseDay(value:string) {
  const instant=new Date(value);
  if (!Number.isFinite(instant.getTime())) return null;
  const parts=new Intl.DateTimeFormat("en-GB",{
    timeZone:"Australia/Sydney",year:"numeric",month:"2-digit",day:"2-digit",
  }).formatToParts(instant);
  const find=(type:string)=>parts.find(part=>part.type===type)?.value;
  const year=find("year"),month=find("month"),day=find("day");
  return year&&month&&day ? year+"-"+month+"-"+day : null;
}
export function rbaScheduledReleaseTimestamp(date:string,timeLabel:string) {
  const match=timeLabel.match(/^(\d{1,2}):(\d{2})\s+(AEDT|AEST)$/i);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(date)||!match)return null;
  const [year,month,day]=date.split("-").map(Number);
  const hour=Number(match[1]),minute=Number(match[2]);
  if(![year,month,day,hour,minute].every(Number.isFinite)||hour>23||minute>59)return null;
  const offset=match[3].toUpperCase()==="AEDT"?11:10;
  const instant=new Date(Date.UTC(year,month-1,day,hour-offset,minute));
  if(!Number.isFinite(instant.getTime())||releaseDay(instant.toISOString())!==date)return null;
  const local=new Intl.DateTimeFormat("en-GB",{
    timeZone:"Australia/Sydney",hour:"2-digit",minute:"2-digit",hour12:false,
  }).format(instant);
  if(local!==String(hour).padStart(2,"0")+":"+String(minute).padStart(2,"0"))return null;
  return instant.toISOString();
}
function dayText(day:string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return null;
  const parsed=new Date(day+"T12:00:00Z");
  if (!Number.isFinite(parsed.getTime())) return null;
  return new Intl.DateTimeFormat("en-GB",{
    timeZone:"UTC",day:"numeric",month:"long",year:"numeric",
  }).format(parsed);
}
function clean(value:string) {
  return value.replace(/<script[\s\S]*?<\/script>/gi," ")
    .replace(/<style[\s\S]*?<\/style>/gi," ")
    .replace(/<[^>]+>/g," ")
    .replace(/&nbsp;|&#160;|&#xA0;/gi," ")
    .replace(/&amp;/gi,"&").replace(/\u00a0/g," ").replace(/\s+/g," ").trim();
}
function trustedUrl(value:string, day:string) {
  try {
    const url=new URL(value,RBA_DECISION_INDEX);
    const match=url.pathname.match(/^\/media-releases\/(\d{4})\/mr-(\d{2})-(\d{2})\.html$/);
    if(url.protocol!=="https:"||url.host!==RBA_HOST||url.username||url.password||url.search||url.hash
      ||!match||match[1]!==day.slice(0,4)||match[2]!==day.slice(2,4))return null;
    return url.toString();
  }catch{return null;}
}
/** This qualification is narrower than a country or bank keyword. */
export function isRbaDecision(release:RbaReleaseCandidate) {
  const day=releaseDay(release.release_date);
  if(!day||release.id!=="au-rba-"+day
    ||release.agency!=="Reserve Bank of Australia"
    ||!/monetary.policy decision/i.test(release.release_name))return false;
  return release.source_url===RBA_BOARD_SCHEDULE
    ||release.source_url===RBA_DECISION_INDEX
    ||Boolean(trustedUrl(release.source_url,day));
}
export function sourceForRbaDecision(release:RbaReleaseCandidate) {
  if(!isRbaDecision(release))return null;
  const day=releaseDay(release.release_date)!;
  return trustedUrl(release.source_url,day)||RBA_DECISION_INDEX;
}

/** The official decision-date index is the authority for the permalink. */
export function parseRbaDecisionIndex(body:string,day:string) {
  const label=dayText(day);
  if(!label)return null;
  const htmlLinks=[...body.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  for(const link of htmlLinks){
    if(clean(link[2])!==label)continue;
    const url=trustedUrl(link[1],day);
    if(url)return url;
  }
  // Source-preserving reader markdown fallback, not a free-text web search.
  const markdown=new RegExp("\\["+label.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")+"\\]\\((https:\\/\\/[^)]+)\\)","i");
  const match=body.match(markdown);
  return match?trustedUrl(match[1],day):null;
}

/** Reject wrong issue numbers, dates, missing policy verbs and values.
 * The RBA publishes a date/time in the original HTML; for a verified reader
 * rendering without HTML metadata use the official fixed 14:30 local clock
 * already supplied by the exact meeting schedule.
 */
export function parseOfficialRbaDecision(body:string,sourceUrl:string,scheduledAt:string):VerifiedRbaActual|null {
  const day=releaseDay(scheduledAt);
  if(!day||!trustedUrl(sourceUrl,day))return null;
  const issue=sourceUrl.match(/\/mr-(\d{2})-(\d{2})\.html$/);
  const expectedIssue=day.slice(0,4)+"-"+issue?.[2];
  const text=clean(body);
  if(!issue||!/monetary policy (?:board|decision)|cash rate target/i.test(text))return null;
  const sourceIssue=body.match(/itemprop=["']issueNumber["'][^>]*>\s*(\d{4}-\d{2})/i)
    ||text.match(/\b(?:Number|Media Release)\s*(\d{4}-\d{2})\b/i);
  if(sourceIssue?.[1]!==expectedIssue)return null;
  const stamp=body.match(/<time\b[^>]*datetime=["']([^"']+)["'][^>]*>/i)?.[1];
  const clock=stamp?new Date(stamp):new Date(scheduledAt);
  if(!Number.isFinite(clock.getTime())||clock.toISOString()!==new Date(scheduledAt).toISOString())return null;
  if(!stamp){
    const label=dayText(day);
    if(!label||!text.includes(label)||!/^14:30$/.test(new Intl.DateTimeFormat("en-GB",{
      timeZone:"Australia/Sydney",hour:"2-digit",minute:"2-digit",hour12:false,
    }).format(clock)))return null;
  }
  const change=text.match(/At its meeting today, the Board decided to\s+(increase|raise|decrease|reduce|lower) the cash rate target by\s+(\d{1,3})\s+basis points to\s+(\d{1,2}(?:\.\d{1,2})?)\s+per cent/i);
  const hold=text.match(/At its meeting today, the Board decided to\s+(?:leave|keep|maintain) the cash rate target\s+(?:unchanged\s+)?at\s+(\d{1,2}(?:\.\d{1,2})?)\s+per cent/i);
  if(!change&&!hold)return null;
  const target=Number(change?.[3]??hold?.[1]);
  const bp=change?Number(change[2]):0;
  if(!Number.isFinite(target)||target<0||target>30||bp<0||bp>300)return null;
  const delta=change?(/increase|raise/i.test(change[1])?bp:-bp):0;
  const previous=change?(target-delta/100):target;
  if(previous<0||previous>30)return null;
  const direction=delta>0?"raised":delta<0?"lowered":"held";
  const actual="RBA cash rate target "+target.toFixed(2)+"% ("+(delta>0?"+":"")+delta+"bp, "+direction+")";
  return {actual,previous:previous.toFixed(2)+"%",sourceUrl,releasedAt:clock.toISOString()};
}
async function loadOfficial(url:string,fetcher:typeof fetch){
  const response=await fetcher(url,{
    headers:{accept:"text/html,application/xhtml+xml","user-agent":"Alchemy Live Desk official RBA decision collector"},
    cache:"no-store",signal:AbortSignal.timeout(10_000),
  });
  if(!response.ok)throw new Error("RBA_ORIGINAL_HTTP_"+response.status);
  if(response.url&&response.url.replace(/\/$/,"")!==url.replace(/\/$/,""))
    throw new Error("RBA_ORIGINAL_REDIRECT_MISMATCH");
  return response.text();
}
async function loadWithApprovedReader(url:string,fetcher:typeof fetch) {
  try{return await loadOfficial(url,fetcher);}
  catch(direct){
    const reader=await fetchJinaReader({sourceUrl:url,apiKey:process.env.JINA_API_KEY,
      fetchImpl:fetcher,timeoutMs:12_000});
    if(reader.ok)return reader.text;
    throw new Error("RBA_ORIGINAL_UNAVAILABLE:"+((direct instanceof Error)?direct.message:"direct_failed")
      +":"+String(reader.errorCode||"reader_unavailable"));
  }
}
export async function resolveOfficialRbaDecision(
 release:RbaReleaseCandidate,fetcher:typeof fetch=fetch,
):Promise<VerifiedRbaActual>{
  if(!isRbaDecision(release))throw new Error("RBA_RELEASE_IDENTITY_UNQUALIFIED");
  const day=releaseDay(release.release_date)!;
  const direct=trustedUrl(release.source_url,day);
  const link=direct||parseRbaDecisionIndex(
    await loadWithApprovedReader(RBA_DECISION_INDEX,fetcher),day);
  if(!link)throw new Error("RBA_ORIGINAL_LINK_NOT_PUBLISHED_FOR_DATE");
  const body=await loadWithApprovedReader(link,fetcher);
  const result=parseOfficialRbaDecision(body,link,release.release_date);
  if(!result)throw new Error("RBA_ORIGINAL_DATE_RATE_OR_ISSUE_UNVERIFIED");
  return result;
}
