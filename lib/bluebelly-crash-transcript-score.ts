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
 eligibleClaims:number;
 corroboratedPublishers:number;
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
const EMPTY_NOTE="The transcript ledger contributes only clearly dated, independently market-corroborated observations. Creator conviction, repetition and unverified causal explanations receive zero weight.";

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
 return {status,reviewedVideos:0,eligibleClaims:0,corroboratedPublishers:0,
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
 const uniques=new Set<string>(),topics=new Map<CrashTranscriptTopic,{side:CrashTranscriptSide;publishers:Set<string>;sourceDate:string}>();
 let eligibleClaims=0;
 for(const video of sorted){
  const author=creatorKey(video.publisher);
  if(uniques.has(author))continue;
  const matches=matchingClaim(video);
  eligibleClaims+=matches.length;
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
   }
  }
  uniques.add(author);
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
 return {status:sorted.length?"AVAILABLE":"EMPTY",reviewedVideos:sorted.length,
  eligibleClaims,corroboratedPublishers:publishers.size,
  crashUnits:Number(riskUnits.toFixed(2)),opportunityUnits:Number(opportunityUnits.toFixed(2)),
  maximumUnits:1,lastVideoPublished:sorted[0]?.publishedAt??null,
  dataAsOf:selected.map(x=>x.sourceDate).sort().at(-1)??null,
  topics:selected,
  note:EMPTY_NOTE};
}
