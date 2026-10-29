import type {NewsBriefV1} from "./market-brief-news.ts";
import {recentBankDecisions,type BankDecisionSnapshot} from "./bluebelly-bank-decision-snapshots.ts";
import {getRecentVerifiedEarningsScorecards,type VerifiedEarningsScorecard} from "./blue-desk-earnings-results.ts";
import {OCTOBER_FED_DEPTH} from "./bluebelly-key-story-depth.ts";

/**
 * A public presentation of ALREADY verified source receipts. Selecting a
 * candidate is not permission to publish a new canonical research verdict.
 * A creator/tweet/article perspective never becomes proof of a price reaction.
 */
export type PostEventSource={label:string;url:string;role:"official"|"market_data"|"reporting"};
export type PostEventRecap={
 id:string;kind:"bank"|"earnings"|"source_only";releaseAt:string;headline:string;standfirst:string;
 eventName:string;whatHappened:string;marketEffects:string;marketEffectStatus:"DATED_SECONDARY_AND_DAILY_DATA"|"MECHANISM_ONLY";
 whatNext:string;countercase:string;sourceUrls:readonly PostEventSource[];
 evidenceNote:string;detailsHref:string;weight:number;featuredStatus:"REVIEWED"|"SOURCE_ONLY";
};

const SEVEN_DAYS=7*86400000;
function ageOk(date:string,now:Date){
 const at=Date.parse(date);return Number.isFinite(at)&&+now>=at&&+now-at<=SEVEN_DAYS;
}
function fromBank(bank:BankDecisionSnapshot):PostEventRecap{
 const fed=bank.id==="fed-2026-10-28";
 return {
  id:bank.id,kind:"bank",releaseAt:bank.releaseAt,headline:fed?OCTOBER_FED_DEPTH.title:bank.headline,
  standfirst:fed?OCTOBER_FED_DEPTH.hook:bank.countryCode==="NZ"?"A narrow vote left rates unchanged. The real question is whether the bank can wait while inflation stays elevated.":"The policy rate changed. Whether it changes the currency or bond market depends on what investors had priced in beforehand.",eventName:bank.bank,
  whatHappened:bank.observedStatement+" "+bank.expectedStatus,
  marketEffects:fed?OCTOBER_FED_DEPTH.marketTape.slice(0,2).join(" "):bank.financialMechanism,
  marketEffectStatus:fed?"DATED_SECONDARY_AND_DAILY_DATA":"MECHANISM_ONLY",
  whatNext:bank.nextTest,countercase:bank.alternative,
  sourceUrls:fed?OCTOBER_FED_DEPTH.sources.map(s=>({label:s.label,url:s.url,role:s.url.includes("treasury.gov")?"market_data" as const:s.url.includes("reuters.com")?"reporting" as const:"official" as const})):
   [{label:bank.sourceName,url:bank.sourceUrl,role:"official" as const}],
  evidenceNote:fed?"Treasury observations are daily closes; Reuters reactions are attributed secondary accounts. Neither proves an intraday Fed-caused move.":"No matching pre/post-event market-price window or pre-release rate probability is available; mechanism is not an observed reaction.",
  detailsHref:"?post-event="+encodeURIComponent(bank.id),
  weight:bank.countryCode==="US"?100:bank.countryCode==="CA"?85:80,featuredStatus:"REVIEWED"
 };
}
function fromEarnings(r:VerifiedEarningsScorecard):PostEventRecap{
 const observed=r.metrics.filter(x=>x.state==="measured").map(m=>m.name+": "+m.value+(m.comparison?" ("+m.comparison+")":"")).join("; ");
 return {
  id:r.id,kind:"earnings",releaseAt:r.releaseDay,headline:r.company+": "+r.headline,standfirst:r.conclusion,eventName:r.company,
  whatHappened:r.fiscalPeriod+" · "+observed+". "+r.beatMiss,
  marketEffects:r.conclusion+" No timestamp-matched share-price reaction is established by this scorecard.",
  marketEffectStatus:"MECHANISM_ONLY",whatNext:r.nextTest+" "+r.outlook,
  countercase:"The next financial statement may change the cash-conversion assessment. Guidance is not realised cash flow.",
  sourceUrls:[{label:r.sourceName,url:r.sourceUrl,role:"official" as const},
   ...(r.additionalSourceUrl?[{label:r.company+" investor presentation",url:r.additionalSourceUrl,role:"official" as const}]:[])],
  evidenceNote:"Issuer data and matched guidance are distinguished from analyst consensus. Equity price reactions require separately verified, event-timed market data.",
  detailsHref:"?post-event="+encodeURIComponent(r.id),weight:75,featuredStatus:"REVIEWED"
 };
}
const EVENT=/\b(?:FOMC|federal reserve|fed (?:rates?|decision)|bank of canada|RBNZ|reserve bank of new zealand|bank of england|ECB|central bank|monetary policy|quarterly (?:earnings|results)|(?:Q[1-4]|fourth|third|second|first)[ -]?quarter (?:earnings|results)|earnings release|reports? (?:Q[1-4]|quarterly) (?:earnings|results))\b/i;
const ORIGINAL=/\b(?:reports?|announces?|announced|releases?|released|raises?|raised|cuts?|cut|holds?|held|maintains?|maintained|earnings|results|decision|statement)\b/i;
function fromNews(n:NewsBriefV1):PostEventRecap|null {
 // This is only a SOURCE-ONLY short recap until a human-reviewed research
 // pack supplies consensus, commentary, market tape and countercases.
 if(n.verification!=="SOURCE_VERIFIED"||!EVENT.test(n.headline)||!ORIGINAL.test(n.headline))return null;
 if(!["official","primary","filing"].includes(n.sourceKind.toLowerCase()))return null;
 const kindName=/bank|FOMC|ECB|fed|policy/i.test(n.headline)?"Central-bank decision":"Company results";
 return {
  id:"receipt-"+n.id,kind:"source_only",releaseAt:n.occurredAt,headline:n.headline,standfirst:"The original announcement is verified; the market impact and competing interpretations still require research.",eventName:kindName,
  whatHappened:n.summary,marketEffects:"Market transmission and any observed price reaction remain unverified; source-only announcement coverage.",
  marketEffectStatus:"MECHANISM_ONLY",whatNext:"Research Gap: collect the previous comparable, frozen pre-release expectations, matched market tape, issuer or central-bank remarks and the next dated catalyst.",
  countercase:"The announcement alone cannot establish a surprise, a causal price reaction or a lasting change to the outlook.",
  sourceUrls:[{label:n.sourceName,url:n.sourceUrl,role:"official"}],
  evidenceNote:"Primary event verified. Post-event analysis not yet accepted by the editorial reviewer.",
  detailsHref:"?news="+encodeURIComponent(n.id),weight:20,featuredStatus:"SOURCE_ONLY"
 };
}
/** Priority: reviewed major decisions, reviewed earnings, then recent source-only discoveries. */
export function selectPostEventRecaps(news:readonly NewsBriefV1[],now=new Date(),limit=4):PostEventRecap[]{
 if(!Number.isFinite(+now))return [];
 const bank=recentBankDecisions(now,168).map(fromBank);
 // Issuer results without an exact release clock wait until the next UTC day,
 // rather than appearing at midnight before the earnings announcement.
 const earnings=getRecentVerifiedEarningsScorecards(now,7)
  .filter(x=>+now>Date.parse(x.releaseDay+"T23:59:59Z")).map(fromEarnings);
 const verified=news.filter(n=>ageOk(n.occurredAt,now)).map(fromNews)
  .filter((x):x is PostEventRecap=>x!==null);
 const curated=[...bank,...earnings];
 const noDuplicates=verified.filter(receipt=>!curated.some(item=>
    item.sourceUrls.some(s=>s.url===receipt.sourceUrls[0].url) ||
    (item.kind==="bank"&&Math.abs(Date.parse(item.releaseAt)-Date.parse(receipt.releaseAt))<86400000&&
       ((item.id.startsWith("fed")&&/Fed|FOMC|Federal Reserve/i.test(receipt.headline))||
        (item.id.startsWith("boc")&&/Bank of Canada/i.test(receipt.headline))||
        (item.id.startsWith("rbnz")&&/RBNZ|New Zealand/i.test(receipt.headline))))
 ));
 return [...curated,...noDuplicates]
  .filter(x=>ageOk(x.releaseAt,now))
  .sort((a,b)=>{
   const band=(x:PostEventRecap)=>{const age=+now-Date.parse(x.releaseAt);return age<=48*3600000?2:age<=96*3600000?1:0;};
   return band(b)-band(a) ||
    Number(b.featuredStatus==="REVIEWED")-Number(a.featuredStatus==="REVIEWED") ||
    b.weight-a.weight || Date.parse(b.releaseAt)-Date.parse(a.releaseAt);
  })
  .slice(0,Math.max(0,Math.min(8,limit)));
}
export function findPostEventRecap(id:string,news:readonly NewsBriefV1[],now=new Date()){
 if(!/^[a-z0-9_-]{1,150}$/i.test(id))return null;
 return selectPostEventRecaps(news,now,8).find(x=>x.id===id)||null;
}
