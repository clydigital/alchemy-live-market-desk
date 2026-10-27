/**
 * Bluebelly Branch 05: private Today's Talk, read-only composition of three
 * DIFFERENT source classes. This is not a reasoning engine or evidence writer.
 *
 * 1) A source-verified NewsBrief is factual reporting, never a Story mutation.
 * 2) Dossier context is accepted only from the exact CURRENT healthy snapshot.
 * 3) Market prices are separately dated completed sessions, never a measured
 *    event reaction unless an event-window observation exists (none here).
 */
import type { NewsBriefV1 } from "./market-brief-news.ts";
import type { MarketMotionRecord } from "./market-motion.ts";
import { marketMotionAttention } from "./market-motion.ts";
import type { EditorialPriceCard, EditorialWindow } from "./editorial-price-context.ts";
import type { DossierPresentationSelection } from "./dossier-v2/presentation-reader.ts";

export const TODAY_TALK_CONTRACT="bluebelly-todays-talk/1" as const;
const MAX_DOSSIER_AGE_MS=36*60*60*1000;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_SOURCE_ITEMS=5;
const PRICE_KEYS=["brent","wti","dxy","us10y-fred","spx","gold-proxy","us2y","jxy"] as const;

export type TalkSource={
 id:string;headline:string;summary:string;sourceName:string;
 sourceUrl:string;occurredAt:string;observedAt:string;
 attentionScore:number;priority:"LEAD"|"WATCH";
 label:"SOURCE_VERIFIED_NOT_CANONICAL";
 spokenCue:string;
};
export type TalkPrice={
 id:string;label:string;symbol:string;status:"OBSERVED"|"STALE"|"UNKNOWN";
 asOf:string|null;sourceName:string;sourceUrl:string|null;
 level:string;
 windows:Array<{sessions:1|3|5;text:string}>;
};
export type TalkDossier={
 status:"CURRENT_HEALTHY"|"UNAVAILABLE";
 dossierId:string|null;asOf:string|null;
 headline:string|null;answer:string|null;whatWouldChangeMind:string|null;
 evidenceRefs:string[];
 reason:string;
};
export type TodayTalk={
 contractVersion:typeof TODAY_TALK_CONTRACT;
 asOf:string;
 coverage:"SOURCE_NEWS_AND_DOSSIER"|"SOURCE_NEWS_ONLY"|"DOSSIER_ONLY"|"INSUFFICIENT";
 news:TalkSource[];dossier:TalkDossier;prices:TalkPrice[];
 questions:string[];readAloud:string;
};

const trim=(value:unknown,max:number)=>typeof value==="string"?value.trim().slice(0,max):"";
function validDate(value:unknown):number|null{
 if(typeof value!=="string")return null;
 const t=Date.parse(value);return Number.isFinite(t)?t:null;
}
function projectDossier(
 selection:DossierPresentationSelection|null,now:number,
):TalkDossier{
 const unavailable=(reason:string):TalkDossier=>({
  status:"UNAVAILABLE",dossierId:null,asOf:null,headline:null,answer:null,
  whatWouldChangeMind:null,evidenceRefs:[],reason,
 });
 if(!selection||!selection.presentation)return unavailable("No selected Dossier is available.");
 if(selection.status!=="current")return unavailable(
   "The Dossier selection is historical, degraded or an older healthy fallback; do not present it as today's accepted view.");
 const p=selection.presentation,at=validDate(p.asOf);
 if(p.health.degraded||p.dossierId!==selection.selectedDossierId||
  p.asOf!==selection.selectedAsOf||!UUID.test(p.dossierId)||
  at===null||at>now||now-at>MAX_DOSSIER_AGE_MS)
  return unavailable("The selected Dossier has invalid identity, degraded health, future clock or expired 36-hour freshness.");
 const evidence=[...new Set(p.regimeStrip.flatMap(lens=>
   lens.observed&&Array.isArray(lens.evidenceRefs)
   ? lens.evidenceRefs.filter(id=>typeof id==="string"&&UUID.test(id)) : []))].slice(0,12);
 if(!evidence.length)return unavailable("No canonical evidence UUID in observed Regime lenses; thesis withheld.");
 const headline=trim(p.header.headline,200);
 const answer=trim(p.header.answer,700);
 if(!headline||!answer)return unavailable("Canonical Dossier summary is incomplete.");
 return {status:"CURRENT_HEALTHY",dossierId:p.dossierId,asOf:p.asOf,
  headline,answer,whatWouldChangeMind:trim(p.header.whatWouldChangeMind,450)||null,
  evidenceRefs:evidence,reason:"Current healthy Dossier; broad macro interpretation, not instrument-level proof."};
}
function priceWindow(w:EditorialWindow):string{
 if(w.referenceDate===null||w.change===null) return "UNKNOWN";
 const value=(w.change>0?"+":"")+w.change+(w.unit==="bp"?" bp":" source units");
 const percent=w.percent===null?"":" ("+(w.percent>0?"+":"")+w.percent+"%)";
 return value+percent+" vs "+w.referenceDate;
}
function projectPrices(cards:readonly EditorialPriceCard[]):TalkPrice[]{
 const byId=new Map(cards.map(card=>[card.id,card]));
 return PRICE_KEYS.flatMap(id=>{
  const c=byId.get(id);
  if(!c)return [];
  const safeStatus=c.status==="OBSERVED"||c.status==="STALE"?c.status:"UNKNOWN";
  const level=c.lastClose!==null&&Number.isFinite(c.lastClose)
   ?c.lastClose.toFixed(c.type==="Rates"?3:2)+(c.levelUnit==="%"?"%":" source units"):"UNKNOWN";
  return [{id:c.id,label:c.label,symbol:c.symbol,status:safeStatus,
   asOf:c.lastDate,sourceName:c.source,sourceUrl:c.sourceUrl,
   level:safeStatus==="UNKNOWN"?"UNKNOWN":level,
   windows:([1,3,5] as const).map(sessions=>{
    const w=c.comparisons.find(window=>window.sessions===sessions);
    return {sessions,text:safeStatus!=="OBSERVED"?"UNKNOWN":
     w?priceWindow(w):"UNKNOWN"};
   }),
  }];
 }).slice(0,6);
}
export function buildOwnerTodayTalk(input:{
 news:readonly NewsBriefV1[];
 motionRecords:readonly MarketMotionRecord[];
 dossierSelection:DossierPresentationSelection|null;
 priceCards:readonly EditorialPriceCard[];
 nowIso:string;
}):TodayTalk{
 const now=validDate(input.nowIso);
 const currentNow=now??0;
 const dossier=projectDossier(input.dossierSelection,currentNow);
 // NewsBrief is already source/expiry/admission gated by selectVerifiedNewsBriefs.
 // Defence in depth rejects future and >48h news and duplicate IDs.
 const motionById=new Map(input.motionRecords.map(m=>[m.id,m]));
 const seen=new Set<string>();
 const ranked=input.news.flatMap(n=>{
  if(n.verification!=="SOURCE_VERIFIED"||n.contentType!=="NEWS_BRIEF"||seen.has(n.id))return [];
  const occured=validDate(n.occurredAt),observed=validDate(n.observedAt);
  if(!now||occured===null||observed===null||occured>now||
     observed>now||observed<occured||now-occured>48*60*60*1000)return [];
  let source:URL;try{source=new URL(n.sourceUrl);}catch{return [];}
  if(source.protocol!=="https:"||source.username||source.password||source.pathname==="/")return [];
  const raw=motionById.get(n.id);
  if(!raw||raw.verification_state!=="VERIFIED"||
   raw.lifecycle_state==="EXPIRED"||raw.effective_state==="EXPIRED"||
   raw.source_url!==n.sourceUrl||raw.occurred_at!==n.occurredAt)return [];
  seen.add(n.id);
  const attention=marketMotionAttention(raw);
  const summary=trim(n.summary,480);
  const headline=trim(n.headline,200);
  if(!summary||!headline)return [];
  return [{
   id:n.id,headline,summary,sourceName:trim(n.sourceName,100),sourceUrl:n.sourceUrl,
   occurredAt:n.occurredAt,observedAt:n.observedAt,
   attentionScore:attention.score,
   priority:attention.tier==="PRIMARY"?"LEAD" as const:"WATCH" as const,
   label:"SOURCE_VERIFIED_NOT_CANONICAL" as const,
   spokenCue:"According to "+trim(n.sourceName,100)+", "+summary+
    " This is independently source-verified reporting, not evidence of a market reaction.",
  }];
 });
 const news=ranked.sort((a,b)=>b.attentionScore-a.attentionScore||
  b.occurredAt.localeCompare(a.occurredAt)||a.id.localeCompare(b.id)).slice(0,MAX_SOURCE_ITEMS);
 const prices=projectPrices(input.priceCards);
 const coverage=news.length
  ?(dossier.status==="CURRENT_HEALTHY"?"SOURCE_NEWS_AND_DOSSIER":"SOURCE_NEWS_ONLY")
  :(dossier.status==="CURRENT_HEALTHY"?"DOSSIER_ONLY":"INSUFFICIENT");
 const questions=[
  "Check whether the next completed price session confirms any claimed reaction; these daily changes are not event-window measurements.",
  dossier.status==="CURRENT_HEALTHY" && dossier.whatWouldChangeMind
   ?"Dossier invalidation: "+dossier.whatWouldChangeMind
   :"What verified observation would change today's macro view?",
  "Review the 14 saved technical checks against matched instrument and chart timestamps before describing chart confirmation.",
 ];
 const readAloud=[
  "BLUEBELLY TODAY'S TALK — "+input.nowIso,
  "SOURCE-VERIFIED NEWS — reporting, not canonical evidence:",
  ...(news.length?news.map((n,i)=>(i+1)+". "+n.spokenCue+
   " Original source: "+n.sourceUrl+"; event "+n.occurredAt)
   :["No eligible source-verified fresh market developments. Do not invent an overnight lead."]),
  "SEPARATE DOSSIER INTERPRETATION:",
  dossier.status==="CURRENT_HEALTHY"
   ?dossier.headline+". "+dossier.answer+" Dossier dated "+dossier.asOf+"; evidence UUIDs "+
    dossier.evidenceRefs.join(", ")+". This is broad macro analysis, not a price chart confirmation."
   :dossier.reason,
  "SEPARATE COMPLETED-SESSION PRICE CHECKS — NOT EVENT REACTION:",
  ...(prices.length?prices.map(p=>p.label+" ("+p.symbol+") "+
   p.status+" "+(p.asOf||"UNKNOWN")+" "+p.level+"; "+
   p.windows.map(w=>w.sessions+" session(s): "+w.text).join("; "))
   :["No source-dated completed-session price cards available."]),
  "NEXT TESTS:",...questions,
 ].join("\n\n");
 return {contractVersion:TODAY_TALK_CONTRACT,asOf:input.nowIso,coverage,news,dossier,prices,questions,readAloud};
}
