import type {PrivateCreatorReview} from "./bluebelly-private-creator-reviews.ts";
import type {CrashWatchView,CrashSignal} from "./bluebelly-crash-opportunity.ts";
import type {MarketCompassSummary} from "./bluebelly-market-compass.ts";

/** Deterministic, *secondary* agreement reading of reviewed creator claims.
 * This never interprets raw transcripts in a public request, asserts that a
 * creator is an independent market-data source, or verifies the causal thesis.
 * Only observational, clearly directional claims matched to an admitted
 * same-topic market proxy are counted; each publisher can count at most once.
 */
export type CrashTranscriptTopic="credit"|"breadth"|"tape";
export type CrashTranscriptSide="CRASH_RISK"|"OPPORTUNITY";
export type CrashTranscriptStatus="AVAILABLE"|"EMPTY"|"UNAVAILABLE";
export type CrashTranscriptScore=Readonly<{
 status:CrashTranscriptStatus;
 reviewedVideos:number;
 reviewedPublishers:number;
 observationalClaims:number;
 eligibleClaims:number;
 confirmingMarketGates:number;
 corroboratedPublishers:number;
 researchThemes:readonly Readonly<{id:"AI_CREDIT"|"FLOWS"|"ISSUER_CASH"|"PRICE_ACTION";label:string;publishers:number}>[];
 crashUnits:number;
 opportunityUnits:number;
 maximumUnits:1;
 lastVideoPublished:string|null;
 dataAsOf:string|null;
 topics:readonly Readonly<{
  id:CrashTranscriptTopic;side:CrashTranscriptSide;units:number;
  sourceDate:string;publishers:number;
 }>[];
 note:string;
}>;

const DAY=86400000;
const MAX_AGE=7*DAY;
const MATCH_WINDOW=4*DAY;
const ALLOWED_CREATORS=new Set([
 "stockedup","wall street truthbombs","wall street truth bombs",
 "wall street truth bombs mark malek","wall street truthbombs mark malek",
 "fx evolution","fxevolution","tradernick",
 "traders reality","meetkevin","meet kevin"
]);
const DOMAIN_PATTERNS:Readonly<Record<CrashTranscriptTopic,Readonly<Record<CrashTranscriptSide,readonly RegExp[]>>>>={
 credit:{
  CRASH_RISK:[
   /\b(?:high[- ]yield|corporate|credit|bond)\s+(?:spreads?|o(?:ption[- ]adjusted)?a?\.?s\.?)\s+(?:are\s+|have\s+)?(?:widening|widened|spiking|surging|rising)\b/i,
   /\b(?:o\.?a\.?s\.?|credit spreads?)\s+(?:are\s+|have\s+)?(?:widening|widened|spiking|rising)\b/i
  ],
  OPPORTUNITY:[
   /\b(?:high[- ]yield|corporate|credit|bond)\s+(?:spreads?|o(?:ption[- ]adjusted)?a?\.?s\.?)\s+(?:are\s+|have\s+)?(?:narrowing|narrowed|compressing|compressed|tightening|tightened)\b/i,
   /\b(?:o\.?a\.?s\.?|credit spreads?)\s+(?:are\s+|have\s+)?(?:narrowing|narrowed|compressing|compressed|tightening|tightened)\b/i
  ]
 },
 breadth:{
  CRASH_RISK:[
   /\b(?:market breadth|breadth|participation|equal[- ]weight(?:ed)?)\s+(?:is\s+|has\s+)?(?:weakening|weakened|deteriorating|deteriorated|narrowing|narrowed|falling)\b/i,
   /\b(?:rsp|equal[- ]weight(?:ed)?)\s+(?:has\s+|is\s+)?underperform(?:ed|ing)?\b/i
  ],
  OPPORTUNITY:[
   /\b(?:market breadth|breadth|participation|equal[- ]weight(?:ed)?)\s+(?:is\s+|has\s+)?(?:strengthening|strengthened|improving|improved|broadening|broadened|rising)\b/i,
   /\b(?:rsp|equal[- ]weight(?:ed)?)\s+(?:has\s+|is\s+)?outperform(?:ed|ing)?\b/i
  ]
 },
 tape:{
  CRASH_RISK:[
   /\b(?:smh|qqq|equities|stocks|equity market|stock market)\s+(?:have\s+|are\s+|is\s+)?(?:selling off|sold off|declining|declined|falling|fell|sliding|slid)\b/i,
   /\b(?:equity|stock|market)\s+risk[- ]off\b/i
  ],
  OPPORTUNITY:[
   /\b(?:smh|qqq|equities|stocks|equity market|stock market)\s+(?:have\s+|are\s+|is\s+)?(?:rising|rose|rallied|rallying|recovering|recovered|gaining|gained)\b/i,
   /\b(?:equity|stock|market)\s+risk[- ]on\b/i
  ]
 }
};
const EMPTY_NOTE="Reviewed creator research is distinct from verified market corroboration. Candidate claims and research themes are leads, not independently confirmed facts or votes. Only source-dated strong market gates may add to the seesaw.";
const RESEARCH_THEMES=[
 {id:"AI_CREDIT",label:"AI / corporate credit",pattern:/\b(?:cds|credit[- ]default swaps?|credit spreads?|hyperscalers?\s+debt|corporate spreads?)\b/i},
 {id:"FLOWS",label:"ETF / positioning flows",pattern:/\b(?:etf\s+(?:flows?|inflows?|outflows?)|fund\s+(?:flows?|inflows?|outflows?)|short[- ]covering|positioning|forced selling)\b/i},
 {id:"ISSUER_CASH",label:"AI capex / issuer cash",pattern:/\b(?:capex|cash[- ]flow|free cash|fcf|capital expenditure|interest expense|customer prepayments?)\b/i},
 {id:"PRICE_ACTION",label:"Price action / sell-off",pattern:/\b(?:correction|drawdown|sell[- ]off|selling pressure|rall(?:y|ied|ying)|rebound|nasdaq|nvidia|qqq|smh|200[- ]day)\b/i}
] as const;

function creatorKey(name:string):string{
 return name.toLowerCase().replace(/[’']/g,"").replace(/[^a-z0-9]+/g," ").trim();
}
function dayMillis(value:string|null|undefined):number|null{
 if(!value||!/^20\d{2}-\d{2}-\d{2}/.test(value))return null;
 const millis=Date.parse(value);
 return Number.isFinite(millis)?millis:null;
}
function marketSide(signal:CrashSignal):CrashTranscriptSide|null{
 return signal==="BULL"?"OPPORTUNITY":signal==="BEAR"?"CRASH_RISK":null;
}
function trendFromObservation(text:string):{topic:CrashTranscriptTopic;side:CrashTranscriptSide}|null{
 // A counterfactual, negation, unqualified forecast or mixed statement is not
 // a completed market observation. Do not guess which half is being endorsed.
 const clause=text.replace(/\s+/g," ").trim();
 if(!clause||/\b(?:could|might|may|would|should|if|unless|expect|forecast|predicted|possibly|perhaps|not|never|isn't|aren't|didn't)\b/i.test(clause))return null;
 const matched:({topic:CrashTranscriptTopic;side:CrashTranscriptSide})[]=[];
 for(const topic of ["credit","breadth","tape"] as const)
  for(const side of ["CRASH_RISK","OPPORTUNITY"] as const)
   if(DOMAIN_PATTERNS[topic][side].some(re=>re.test(clause)))
    matched.push({topic,side});
 return matched.length===1?matched[0]:null;
}
function matchingClaim(review:PrivateCreatorReview):{topic:CrashTranscriptTopic;side:CrashTranscriptSide}[]{
 const signals:{topic:CrashTranscriptTopic;side:CrashTranscriptSide}[]=[];
 for(const claim of review.claimChecks.slice(0,8)){
  if(!["market_observation","cited_fact"].includes(claim.kind))continue;
  // A verification target is a follow-up instruction, not evidence.
  for(const clause of claim.claim.split(/[.;!?]/).slice(0,6)){
   const matched=trendFromObservation(clause);
   if(matched)signals.push(matched);
  }
 }
 // A video presenting both directions for one topic is a legitimate
 // countercase, not two separate votes. Discard that topic.
 return signals.filter(s=>!signals.some(other=>other.topic===s.topic&&other.side!==s.side))
  .filter((s,i,a)=>a.findIndex(other=>other.topic===s.topic)===i);
}
type MarketGate={side:CrashTranscriptSide|null;sourceDate:string|null};
function marketGates(view:CrashWatchView,compass:MarketCompassSummary):Record<CrashTranscriptTopic,MarketGate>{
 const breadth=view.pillars.find(p=>p.id==="breadth");
 const credit=view.pillars.find(p=>p.id==="credit");
 const hy=view.readings.find(p=>p.id==="hy-oas");
 return {
  breadth:{side:breadth?.observedAt?marketSide(breadth.signal):null,
   sourceDate:breadth?.observedAt??null},
  credit:{side:credit?.observedAt&&hy?.status==="DATED"&&hy.asOf===credit.observedAt?
    marketSide(credit.signal):null,
   sourceDate:credit?.observedAt&&hy?.status==="DATED"&&hy.asOf===credit.observedAt?
    credit.observedAt:null},
  tape:{side:compass.sourceSession?
   compass.state==="RISK_ON"?"OPPORTUNITY":compass.state==="RISK_OFF"?"CRASH_RISK":null:null,
   sourceDate:compass.sourceSession}
 };
}
export function emptyCrashTranscriptScore(status:CrashTranscriptStatus="EMPTY"):CrashTranscriptScore{
 return {status,reviewedVideos:0,reviewedPublishers:0,observationalClaims:0,
  eligibleClaims:0,confirmingMarketGates:0,corroboratedPublishers:0,researchThemes:[],
  crashUnits:0,opportunityUnits:0,maximumUnits:1,
  lastVideoPublished:null,dataAsOf:null,topics:[],note:EMPTY_NOTE};
}
export function scoreReviewedCrashTranscripts(
 reviews:readonly PrivateCreatorReview[],view:CrashWatchView,
 compass:MarketCompassSummary,now:Date,
):CrashTranscriptScore{
 if(!Number.isFinite(now.getTime()))return emptyCrashTranscriptScore("UNAVAILABLE");
 const gates=marketGates(view,compass);
 const sorted=reviews.filter(r=>{
  const t=dayMillis(r.publishedAt);
  return t!==null&&t<=now.getTime()&&now.getTime()-t<=MAX_AGE&&
   ALLOWED_CREATORS.has(creatorKey(r.publisher))&&/^[A-Za-z0-9_-]{11}$/.test(r.videoId);
 }).sort((a,b)=>Date.parse(b.publishedAt)-Date.parse(a.publishedAt));
 const reviewedPublishers=new Set(sorted.map(v=>creatorKey(v.publisher)));
 const creditedPublishers=new Set<string>();
 const themes=new Map<string,Set<string>>();
 const topics=new Map<CrashTranscriptTopic,{side:CrashTranscriptSide;publishers:Set<string>;sourceDate:string}>();
 const confirmingMarketGates=Object.values(gates).filter(g=>g.side!==null).length;
 let eligibleClaims=0,observationalClaims=0;
 for(const video of sorted){
  const author=creatorKey(video.publisher);
  observationalClaims+=video.claimChecks.slice(0,8).filter(
   c=>c.kind==="market_observation"||c.kind==="cited_fact").length;
  for(const theme of RESEARCH_THEMES){
   // Private claim text becomes only a bounded aggregate topic count.
   if(video.claimChecks.slice(0,8).some(c=>theme.pattern.test(c.claim))){
    const authors=themes.get(theme.id)??new Set<string>();
    authors.add(author);themes.set(theme.id,authors);
   }
  }
  const matches=matchingClaim(video);
  eligibleClaims+=matches.length;
  // Inspect up to two reviewed videos per publisher, while allowing no
  // more than one confirmed contribution from that publisher in total.
  if(creditedPublishers.has(author))continue;
  // A creator may cover several topics, but contributes to only ONE of
  // them. Otherwise a single transcript could be mistaken for multiple
  // independent corroborating perspectives.
  const matching=matches.filter(m=>{
   const gate=gates[m.topic];
   const sourceTime=dayMillis(gate.sourceDate),videoTime=dayMillis(video.publishedAt);
   return gate.side===m.side&&sourceTime!==null&&videoTime!==null&&
     Math.abs(videoTime-sourceTime)<=MATCH_WINDOW;
  }).sort((a,b)=>(["credit","breadth","tape"].indexOf(a.topic)-
                  ["credit","breadth","tape"].indexOf(b.topic)));
  const chosen=matching[0];
  if(chosen){
   const gate=gates[chosen.topic];
   const existing=topics.get(chosen.topic);
   if(!existing||existing.side===chosen.side){
    if(existing)existing.publishers.add(author);
    else topics.set(chosen.topic,{side:chosen.side,publishers:new Set([author]),sourceDate:gate.sourceDate!});
    creditedPublishers.add(author);
   }
  }
 }
 const candidateTopics=[...topics.entries()].map(([id,entry])=>({
  id,side:entry.side,sourceDate:entry.sourceDate,
  publishers:entry.publishers.size,
  units:Math.min(0.5,entry.publishers.size*0.25)
 }));
 // Capped at 1.0 total across independent matched domains; adding videos
 // from one author or one topic cannot manufacture stronger market evidence.
 const selected=candidateTopics.sort((a,b)=>b.units-a.units||a.id.localeCompare(b.id))
  .slice(0,2);
 const riskUnits=selected.filter(x=>x.side==="CRASH_RISK").reduce((n,x)=>n+x.units,0);
 const opportunityUnits=selected.filter(x=>x.side==="OPPORTUNITY").reduce((n,x)=>n+x.units,0);
 const publishers=new Set<string>();
 for(const t of topics.values())for(const name of t.publishers)publishers.add(name);
 const researchThemes=RESEARCH_THEMES.map(theme=>({
  id:theme.id,label:theme.label,publishers:themes.get(theme.id)?.size??0
 })).filter(t=>t.publishers>0).sort((a,b)=>b.publishers-a.publishers).slice(0,3);
 return {status:sorted.length?"AVAILABLE":"EMPTY",reviewedVideos:sorted.length,
  reviewedPublishers:reviewedPublishers.size,observationalClaims,eligibleClaims,
  confirmingMarketGates,corroboratedPublishers:publishers.size,researchThemes,
  crashUnits:Number(riskUnits.toFixed(2)),opportunityUnits:Number(opportunityUnits.toFixed(2)),
  maximumUnits:1,lastVideoPublished:sorted[0]?.publishedAt??null,
  dataAsOf:selected.map(x=>x.sourceDate).sort().at(-1)??null,
  topics:selected,
  note:EMPTY_NOTE};
}
