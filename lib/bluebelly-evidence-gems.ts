import type {NewsBriefV1} from "./market-brief-news.ts";
import type {NotionResearchBundle} from "./notion-market-research.ts";
import type {PublicMarketObservation} from "./blue-desk-public-markets.ts";
import type {PrivateCreatorReview} from "./bluebelly-private-creator-reviews.ts";
import type {DailyResearchCalendarItem} from "./daily-report-research-packet.ts";

/** Private candidate pool, not causal admission or an automatic hypothesis verdict.
 * Reuses already retrieved records; no I/O or new collectors. Exact origin groups
 * are deduplication hints, not proof that distinct URLs are independent. */
export type EvidenceGemCandidate={
 id:string; kind:"NEWS"|"STATISTIC"|"TRANSCRIPT_ARGUMENT"|"RESEARCH_NOTE"|"SCHEDULED_EVENT";
 state:"SOURCE_VERIFIED_REPORT"|"SOURCE_DATED_NOT_FRESHNESS_VERIFIED"|"ATTRIBUTED"|"RESEARCH_ONLY"|"SCHEDULED_NOT_ACTUAL";
 originGroup:string|null; sourceUrl:string|null; sourceName:string; sourceDate:string|null;
 label:string; text:string; metric?:{symbol:string;value:number|null;changeUnit:"%"|"bp"|"pp";change1d:number|null;change3d:number|null;change5d:number|null;frequency:string;currency:string|null};
 originalLinkCandidates?:string[]; verificationTarget?:string|null;
};
function url(value:unknown):string|null{
 if(typeof value!=="string"||value.length>2048)return null;
 try{const u=new URL(value);if(u.protocol!=="https:"||u.username||u.password||u.hostname==="localhost"||u.hostname.endsWith(".local")||u.hostname.endsWith(".internal"))return null;
 u.hash="";for(const k of [...u.searchParams.keys()])if(/^(utm_.+|fbclid|gclid)$/i.test(k))u.searchParams.delete(k);
 return u.href;}catch{return null;}
}
const cut=(v:unknown,n=500)=>typeof v==="string"?v.trim().slice(0,n):"";
const num=(v:unknown)=>typeof v==="number"&&Number.isFinite(v)?v:null;
const dated=(v:unknown,now:Date)=>typeof v==="string"&&Number.isFinite(Date.parse(v))&&Date.parse(v)<=now.getTime()?v:null;
export function buildEvidenceGemCandidates(input:{now:Date;notion:NotionResearchBundle;news:readonly NewsBriefV1[];marketObservations:readonly PublicMarketObservation[];creatorReviews:readonly PrivateCreatorReview[];creatorCoverage:"AVAILABLE"|"UNAVAILABLE";calendar:readonly DailyResearchCalendarItem[]}){
 const {now}=input;
 const candidates:EvidenceGemCandidate[]=[];
 const seen=new Set<string>();
 const add=(c:EvidenceGemCandidate)=>{if(!seen.has(c.id)){seen.add(c.id);candidates.push(c);}};
 // Exact original document dedupe across news receipts only. Creator/research
 // notes remain separate attributed leads, never independent votes.
 const newsOrigins=new Set<string>();
 for(const n of input.news.slice(0,16)){
  const u=url(n.sourceUrl),d=dated(n.occurredAt,now);
  if(n.verification!=="SOURCE_VERIFIED"||!u||!d||newsOrigins.has(u))continue;
  newsOrigins.add(u);add({id:"news:"+n.id,kind:"NEWS",state:"SOURCE_VERIFIED_REPORT",originGroup:u,sourceUrl:u,sourceName:cut(n.sourceName,120),sourceDate:d,label:cut(n.headline,200),text:cut(n.summary,700)});
 }
 // Balance across economic/market categories rather than exhaust the equity list.
 const quotas:Record<string,number>={"Rates":8,"Bond ETF":5,"Credit / Risk":8,"Energy":4,"FX":4,"Metal":3,"Breadth":8,"Sector":11,"Major Index":5,"AI / Semis":5};
 const counts=new Map<string,number>();
 for(const r of input.marketObservations){
  const cap=quotas[r.type]??0,u=url(r.sourceUrl),d=dated(r.asOf,now);
  if(!cap||!u||!d||r.dataStatus==="UNAVAILABLE_OR_STALE"||num(r.last)===null||(counts.get(r.type)??0)>=cap)continue;
  const id="stat:"+r.symbol+":"+d+":"+u;
  if(seen.has(id))continue;
  counts.set(r.type,(counts.get(r.type)??0)+1);
  add({id,kind:"STATISTIC",state:"SOURCE_DATED_NOT_FRESHNESS_VERIFIED",originGroup:u,sourceUrl:u,sourceName:cut(r.sourceName,120),sourceDate:d,label:cut(r.label,140),text:"Dated provider observation; verify session, units, series identity and comparability before causal use.",
   metric:{symbol:r.symbol,value:num(r.last),changeUnit:r.changeUnit,change1d:num(r.change),change3d:num(r.change3d),change5d:num(r.change5d),frequency:r.frequency,currency:r.currency??null}});
 }
 for(const v of input.creatorReviews.slice(0,9)){
  const u=url(v.url),d=dated(v.publishedAt,now);
  if(!u||!d||!/^[-\w]{11}$/.test(v.videoId))continue;
  add({id:"creator:"+v.videoId,kind:"TRANSCRIPT_ARGUMENT",state:"ATTRIBUTED",originGroup:u,sourceUrl:u,sourceName:cut(v.publisher,80),sourceDate:d,label:cut(v.title,160),text:cut(v.logic||v.summary,900)});
  for(const [i,c] of v.claimChecks.slice(0,3).entries()){
   // Claim index identifies this candidate within its bounded receipt, not a
   // stable cross-revision forecast ID. Agents use original event/metric IDs.
   add({id:"creator:"+v.videoId+":claim:"+i,kind:"TRANSCRIPT_ARGUMENT",state:"ATTRIBUTED",originGroup:u,sourceUrl:u,sourceName:cut(v.publisher,80),sourceDate:d,label:cut(v.title,160),text:cut(c.claim,600),verificationTarget:cut(c.verificationTarget,300)||null});
  }
 }
 for(const n of input.notion.sources.slice(0,3)){
  const u=url(n.url);if(!u)continue;
  add({id:"note:"+n.pageId,kind:"RESEARCH_NOTE",state:"RESEARCH_ONLY",originGroup:u,sourceUrl:u,sourceName:n.kind,sourceDate:n.editionDay&&dated(n.editionDay,now)||null,label:cut(n.title,180),text:cut(n.text,1200),originalLinkCandidates:[...new Set(n.originalLinks.map(url).filter((x):x is string=>x!==null))].slice(0,12)});
 }
 for(const e of input.calendar.slice(0,14)){
  const u=url(e.sourceUrl),d=e.scheduledAt;
  if(!u||!d||!Number.isFinite(Date.parse(d)))continue;
  add({id:"event:"+d+":"+u+":"+e.title,kind:"SCHEDULED_EVENT",state:"SCHEDULED_NOT_ACTUAL",originGroup:u,sourceUrl:u,sourceName:cut(e.sourceName,100),sourceDate:d,label:cut(e.title,180),text:cut(e.decidingQuestion,500)||"Upcoming checkpoint; obtain actual result before attaching as confirmation."});
 }
 return {contractVersion:"bluebelly/evidence-gem-candidates/1" as const,assembledAt:now.toISOString(),candidates,
 coverage:{notion:input.notion.status,creator:input.creatorCoverage,news:input.news.length,statistics:input.marketObservations.length,calendar:input.calendar.length},
 caveat:"Bounded owner-only candidate pool. Not exhaustive; no independent source claims from transcripts or research notes, no inferred actuals from scheduled events, no causal matching, weights, admission or publication. Agent checks original receipts, exact session, revisions, dependencies and competing explanations before attaching to hypothesis."};
}
