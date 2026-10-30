/**
 * Bounded issuer-original-results pass inside the EXISTING scheduled research
 * acquisition. A calendar is discovery only: the complete original release
 * must be read from a narrowly allowed issuer host/path, carry the matching
 * reporting period and source-day, and state observed financial results.
 * No independent cron, inferred consensus, Story writer, or public approval.
 */
import {createHash} from "node:crypto";
import {getDueOfficialEarningsCandidates} from "./forward-earnings-sources.ts";
import type {ResearchRunInput,IntakeItemInput} from "./research-update.ts";
import {recoverOfficialPublisherSource} from "./official-publisher-source-recovery.ts";

type Source={host:string;listing:string;path:RegExp;publisher:string;headline:RegExp;company:RegExp;
  /** Verified original direct URL recovery only for the October 2026 incident.
   * Future quarters MUST be discovered from issuer listings, not invented.
   */
  octoberOriginal?:string;};
const SOURCES:Readonly<Record<string,Source>>={
 AMZN:{
  host:"ir.aboutamazon.com",listing:"https://ir.aboutamazon.com/overview/",
  path:/^\/news-release\/news-release-details\/20\d{2}\/[a-z0-9-]+\/(?:default\.aspx)?$/i,
  publisher:"Amazon Investor Relations",headline:/amazon(?:\.com)?\s+announces?\s+(?:first|second|third|fourth)\s+quarter\s+results/i,
  company:/amazon\.com,\s*inc|amazon\.com\s+\(nasdaq:\s*amzn/i,
  octoberOriginal:"https://ir.aboutamazon.com/news-release/news-release-details/2026/Amazon-com-Announces-Third-Quarter-Results/default.aspx",
 },
 INTC:{
  host:"www.intc.com",listing:"https://www.intc.com/news-events/press-releases",
  path:/^\/news-events\/press-releases\/detail\/\d{3,5}\/[a-z0-9-]+\/?$/i,
  publisher:"Intel Investor Relations",headline:/intel\s+reports?\s+(?:first|second|third|fourth)[-\s]+quarter\s+20\d{2}\s+financial\s+results/i,
  company:/intel\s+corporation/i,
  octoberOriginal:"https://www.intc.com/news-events/press-releases/detail/1786/intel-reports-third-quarter-2026-financial-results",
 },
 SNDK:{
  host:"investor.sandisk.com",listing:"https://investor.sandisk.com/news-events/news-releases",
  path:/^\/news-releases\/news-release-details\/[a-z0-9-]+\/?$/i,
  publisher:"Sandisk Investor Relations",headline:/sandisk\s+reports?\s+fiscal\s+(?:first|second|third|fourth)\s+quarter\s+20\d{2}\s+financial\s+results/i,
  company:/sandisk\s+corporation/i,
  octoberOriginal:"https://investor.sandisk.com/news-releases/news-release-details/sandisk-reports-fiscal-first-quarter-2027-financial-results",
 },
 MSFT:{
  host:"www.microsoft.com",listing:"https://www.microsoft.com/en-us/investor/earnings",
  path:/^\/en-us\/investor\/earnings\/fy-20\d{2}-q[1-4]\/press-release-webcast\/?$/i,
  publisher:"Microsoft Investor Relations",headline:/microsoft\s+announces?\s+(?:first|second|third|fourth)\s+quarter\s+results/i,
  company:/microsoft\s+corp(?:oration)?/i,
  octoberOriginal:"https://www.microsoft.com/en-us/investor/earnings/fy-2027-q1/press-release-webcast",
 },
 GOOGL:{
  host:"abc.xyz",listing:"https://abc.xyz/investor/",
  path:/^\/(?:investor\/[^?#]*|assets\/[^?#]*)$/i,
  publisher:"Alphabet Investor Relations",headline:/alphabet\s+announces?\s+(?:first|second|third|fourth)\s+quarter\s+20\d{2}\s+results/i,
  company:/alphabet\s+inc(?:orporated)?/i,
 },
 PLTR:{
  host:"investors.palantir.com",listing:"https://investors.palantir.com/news",
  path:/^\/news-details\/20\d{2}\/[a-z0-9-]+\/?$/i,
  publisher:"Palantir Investor Relations",headline:/palantir\s+(?:reports?|announces?)\s+(?:first|second|third|fourth)\s+quarter\s+20\d{2}\s+(?:financial\s+)?results/i,
  company:/palantir\s+technologies/i,
 },
 CRWV:{
  host:"investors.coreweave.com",listing:"https://investors.coreweave.com/news",
  path:/^\/news\/news-details\/20\d{2}\/[a-z0-9-]+\/(?:default\.aspx)?$/i,
  publisher:"CoreWeave Investor Relations",headline:/coreweave\s+(?:reports?|announces?)\s+(?:first|second|third|fourth)\s+quarter\s+20\d{2}\s+(?:financial\s+)?results/i,
  company:/coreweave,\s*inc/i,
 },
 AMD:{
  host:"ir.amd.com",listing:"https://ir.amd.com/news-events/press-releases",
  path:/^\/news-events\/press-releases\/detail\/\d{3,5}\/[a-z0-9-]+\/?$/i,
  publisher:"AMD Investor Relations",headline:/amd\s+(?:reports?|announces?)\s+(?:first|second|third|fourth)\s+quarter\s+20\d{2}\s+(?:financial\s+)?results/i,
  company:/advanced\s+micro\s+devices/i,
 },
};
type Candidate={ticker:string;quarter:string;scheduledCallAt:string;sourceDateOnly:boolean};
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
function dayLabel(day:string){
 const m=/^(20\d{2})-(\d\d)-(\d\d)$/.exec(day);
 return m&&Number(m[2])>=1&&Number(m[2])<=12
   ?MONTHS[Number(m[2])-1]+" "+Number(m[3])+", "+m[1]:"";
}
function releaseDay(event:Candidate){return event.scheduledCallAt.slice(0,10);}
function htmlText(body:string){return body
 .replace(/<(?:script|style|svg|noscript)\b[^>]*>[\s\S]*?<\/(?:script|style|svg|noscript)>/gi," ")
 .replace(/<[^>]+>/g," ").replace(/&nbsp;|&#160;/gi," ")
 .replace(/&amp;/gi,"&").replace(/&#39;|&apos;/gi,"'")
 .replace(/\s+/g," ").trim();}
export function issuerOriginalUrl(value:string,source:Source){
 try{
  const url=new URL(value,source.listing);
  if(url.protocol!=="https:"||url.hostname.toLowerCase()!==source.host||
    url.username||url.password||url.port||!source.path.test(url.pathname)||url.search)return null;
  url.hash="";
  return url.toString();
 }catch{return null;}
}
function quarterToken(q:string){
 const m=q.match(/\bQ([1-4])\b/i),year=q.match(/20\d{2}/);
 if(!m||!year)return null;
 return {word:["first","second","third","fourth"][Number(m[1])-1],year:year[0]};
}
function isResult(body:string,source:Source,event:Candidate){
 const text=htmlText(body).slice(0,105_000);
 const token=quarterToken(event.quarter);
 if(!token||text.length<250||!source.headline.test(text.slice(0,25_000))||
   !source.company.test(text)||!/revenue|net sales/i.test(text)
   ||!/\bfinancial results\b|\bresults for (?:the|its)\b|\bquarter ended\b/i.test(text)
   ||!text.includes(dayLabel(releaseDay(event))))return false;
 const lower=text.toLowerCase();
 const nearTitle=lower.search(source.headline);
 const core=nearTitle>=0?lower.slice(nearTitle,nearTitle+12_000):"";
 // A result for the wrong quarter/year, an old date announcement or a future
 // preview must never clear the current issuer-coverage obligation.
 const hasQuarter=new RegExp("\\b"+token.word+"[-\\s]+quarter\\b","i").test(core);
 const hasYear=core.includes(token.year)||core.includes(releaseDay(event).slice(0,4));
 const future=/\b(?:will report|to report|announces? date of|announces? the date|conference call to discuss)\b/i
   .test(core.slice(0,170));
 return hasQuarter&&hasYear&&!future;
}
function listingUrls(html:string,source:Source){
 const discovered:string[]=[];
 const matches=html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>[\s\S]*?<\/a>/gi);
 for(const match of matches){
  const url=issuerOriginalUrl(match[1].replace(/&amp;/g,"&"),source);
  if(url&&!discovered.includes(url))discovered.push(url);
  if(discovered.length>=6)break;
 }
 return discovered;
}
type Read=typeof recoverOfficialPublisherSource;
async function verifiedHtml(url:string,source:Source,fetchImpl:typeof fetch,recover:Read){
 let body="";
 try{
  const res=await fetchImpl(url,{cache:"no-store",signal:AbortSignal.timeout(6500),
   headers:{accept:"text/html,application/xhtml+xml","user-agent":"Alchemy Bluebelly original issuer reader"}});
  if(res.ok&&(!res.url||(url===source.listing ? res.url===url : issuerOriginalUrl(res.url,source)===url))
     &&(res.headers.get("content-type")||"text/html").toLowerCase().includes("text/html"))
   body=(await res.text()).slice(0,225_000);
 }catch{ /* Same-publisher recovery is bounded and separately validated. */ }
 if(body)return body;
 const recovery=await recover(url,{timeoutMs:12000});
 if(!recovery.ok||!recovery.rawHtml||
    (recovery.resolvedUrl&&(url===source.listing ? recovery.resolvedUrl!==url : issuerOriginalUrl(recovery.resolvedUrl,source)!==url)))return "";
 return recovery.rawHtml.slice(0,225_000);
}
function makeItem(url:string,event:Candidate,source:Source,now:Date):IntakeItemInput{
 const title="Issuer confirms "+event.quarter+" financial results — "+event.ticker;
 // Capture the VERIFIED retrieval clock rather than inventing a release minute.
 // The actual issuer press day remains explicit in the evidence claim/notes.
 const observedAt=now.toISOString(),day=releaseDay(event);
 return {
  itemKey:"issuer-press:"+createHash("sha256").update(url).digest("hex").slice(0,24),
  itemType:"news",publisher:source.publisher,title,url,publishedAt:observedAt,
  summary:source.publisher+" published its "+event.quarter+" original financial results, dated "+
   day+". Result reported; expectations, price reaction and specific figures remain unverified by this intake.",
  sourceQuality:95,relevance:86,novelty:78,materiality:90,
  recommendedAction:"collect_evidence",
  newsSignal:"First-party original issuer earnings statement read from allowed HTTPS issuer source. Original article publication day "+
   day+"; observed/retrieval timestamp "+observedAt+" (not the issuer's exact publication minute).",
  reviewReason:"Issuer-original result: date and quarter source-checked against issuer-announced earnings call, strict HTTPS same-host article verified; no third-party substitutes. Candidate for canonical reasoning only; no consensus/price reaction claimed.",
  evidence:[{title,url,publisher:source.publisher,publishedAt:observedAt,
    claim:"Original publisher page confirms "+event.ticker+" "+event.quarter+
       " financial results on "+day+". Page read at "+observedAt+"; issuer publication minute not established."}],
 };
}
export async function applyIssuerResultsPressIntake(
 input:ResearchRunInput,
 options:{now?:Date;fetchImpl?:typeof fetch;recoverImpl?:Read}={},
):Promise<ResearchRunInput>{
 const now=options.now??new Date(),fetchImpl=options.fetchImpl??fetch;
 const closed:Read=async()=>({ok:false,code:"not_configured",detail:"controlled transport",retryable:false});
 const recover=options.recoverImpl??(options.fetchImpl?closed:recoverOfficialPublisherSource);
 const due=getDueOfficialEarningsCandidates(now,72)
  .filter(x=>Boolean(SOURCES[x.ticker])).slice(0,12);
 if(!due.length)return input;
 const existing=new Set(input.items.map(x=>x.url));
 const outputs=await Promise.all(due.map(async event=>{
  const source=SOURCES[event.ticker];
  try{
   const list=await verifiedHtml(source.listing,source,fetchImpl,recover);
   const results=listingUrls(list,source);
   // Historical recovery is bounded to the October incident and an original,
   // independently verified issuer permalink. NEVER invent future release URLs.
   const direct=source.octoberOriginal&&event.scheduledCallAt.startsWith("2026-10-")
      &&now.getTime()<=Date.parse("2026-11-05T23:59:59Z")
     ?[source.octoberOriginal]:[];
   const candidates=[...new Set([...direct,...results])].slice(0,4);
   for(const url of candidates){
    const original=issuerOriginalUrl(url,source);
    if(!original)continue;
    const body=await verifiedHtml(original,source,fetchImpl,recover);
    if(!isResult(body,source,event))continue;
    return makeItem(original,event,source,now);
   }
  }catch{ /* One unavailable issuer never blocks other independent evidence. */ }
  return null;
 }));
 const items=outputs.filter((i):i is IntakeItemInput=>Boolean(i)&&!existing.has(i!.url))
  .slice(0,Math.max(0,250-input.items.length));
 for(const item of items)existing.add(item.url);
 const missing=due.filter(e=>!outputs.some(i=>i?.title.endsWith(" — "+e.ticker))).map(x=>x.ticker);
 return {...input,items:[...input.items,...items],
  summary:((input.summary||"")+" Original issuer-result intake: verified "+
    items.map(i=>i.publisher).join(", ")+(missing.length?"; missing original: "+missing.join(", "):"")+
    ". Original issuer exact release minute and consensus are NOT inferred.").slice(0,6000)};
}
