import type {EditorialPriceCard,EditorialWindow} from "./editorial-price-context.ts";

/**
 * R2 read model, not a new provider or a canonical Story/evidence pathway.
 * Only dated, completed, source-labelled daily observations may enter.
 * Even matched daily observations are NOT a verified event-window response.
 */
export const REACTION_ASSET_IDS=[
 "brent","wti","spx","ndx","dxy","usdjpy","us2y","us5y-fred",
 "us10y-fred","us20y-fred","us30y-fred","gold-proxy","smh","qqq","nvda","meta",
] as const;
export type R2AssetId=typeof REACTION_ASSET_IDS[number];
const known=new Set<string>(REACTION_ASSET_IDS);
export type ReactionSourceRow={
 id:string;symbol:string;label:string;source:string;sourceUrl:string;
 lastDate:string;lastLevel:number;levelUnit:string;
 comparisons: {sessions:1|3|5;referenceDate:string;reference:number;change:number;unit:"%"|"bp";percent:number|null}[];
};
export type MatchedWindow={
 sessions:1|3|5;
 status:"MATCHED_DAILY_OBSERVATION"|"UNKNOWN";
 from:string|null;to:string|null;observations:{
  id:string;symbol:string;source:string;sourceUrl:string;
  change:number;unit:"%"|"bp";percent:number|null;
 }[];
 reason:string;
};
export type ReactionLedger={
 contractVersion:"editorial-reaction-ledger/1";
 status:"DAILY_SOURCE_COMPARISON_NOT_EVENT_REACTION";
 requestedAssetId:string|null;
 anchorId:string|null;
 eventAt:string|null;
 builtAt:string;
 assets:ReactionSourceRow[];
 windows:MatchedWindow[];
 eventWindows:{label:"5m"|"30m"|"4h";status:"UNKNOWN";reason:string}[];
 warnings:string[];
};
const WINDOWS=[1,3,5] as const;
const DEFAULT=["brent","wti","us10y-fred","us2y","spx","dxy","gold-proxy"] as const;
const BASKET:Record<string,string[]>={
 brent:["brent","wti","us10y-fred","spx","dxy","gold-proxy"],
 wti:["wti","brent","us10y-fred","spx","dxy"],
 spx:["spx","ndx","us10y-fred","dxy","brent","gold-proxy"],
 ndx:["ndx","spx","us10y-fred","dxy","brent"],
 dxy:["dxy","usdjpy","us2y","us10y-fred","spx","gold-proxy"],
 usdjpy:["usdjpy","dxy","us2y","us10y-fred","spx"],
 "us10y-fred":["us10y-fred","us2y","us30y-fred","spx","dxy","brent"],
 "us2y":["us2y","us10y-fred","us30y-fred","dxy","spx"],
 "gold-proxy":["gold-proxy","dxy","us10y-fred","spx","brent"],
 meta:["meta","qqq","smh","us10y-fred","spx"],
 nvda:["nvda","smh","qqq","us10y-fred","spx"],
};
function validEventAt(v:unknown,now:string):string|null {
 if(typeof v!=="string"||!v.trim())return null;
 // The owner must give an explicit timezone offset. Date-only strings must
 // not be silently interpreted in the Vercel server's timezone.
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d{1,3})?)?(?:Z|[+-]\d{2}:\d{2})$/.test(v))return null;
 const t=Date.parse(v),n=Date.parse(now);
 return Number.isFinite(t)&&Number.isFinite(n)&&t<=n&&t>Date.UTC(2020,0,1)
  ?new Date(t).toISOString():null;
}
function eligibleCard(c:EditorialPriceCard):boolean {
 return known.has(c.id)&&c.status==="OBSERVED"
  &&typeof c.lastDate==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(c.lastDate)
  &&typeof c.lastClose==="number"&&Number.isFinite(c.lastClose)&&c.lastClose>0
  &&typeof c.source==="string"&&c.source.trim().length>0
  &&typeof c.sourceUrl==="string"&&c.sourceUrl.startsWith("https://");
}
function eligibleComparison(x:EditorialWindow){
 return x.reason===null&&x.referenceDate!==null&&x.reference!==null
   &&Number.isFinite(x.reference)&&x.reference>0
   &&x.change!==null&&Number.isFinite(x.change)
   &&(x.unit==="bp"||x.unit==="%")
   &&(x.percent===null||Number.isFinite(x.percent));
}
/** Match the exact same date pair; never compare staggered closes as a joint move. */
export function buildReactionLedger(
 cards:readonly EditorialPriceCard[],selected:unknown,nowIso:string,eventAt?:unknown,
):ReactionLedger{
 const request=typeof selected==="string"&&known.has(selected)?selected:null;
 const list=(request?[request,...(BASKET[request]||DEFAULT)]:[...DEFAULT])
  .filter((v,i,all)=>known.has(v)&&all.indexOf(v)===i).slice(0,8);
 const sourceMap=new Map(cards.filter(eligibleCard).map(c=>[c.id,c]));
 const eligible=list.map(id=>sourceMap.get(id)).filter((c):c is EditorialPriceCard=>!!c);
 const anchor=eligible[0]||null;
 const assets:ReactionSourceRow[]=eligible.map(c=>({
  id:c.id,symbol:c.symbol,label:c.label,source:c.source,
  sourceUrl:c.sourceUrl!,lastDate:c.lastDate!,lastLevel:c.lastClose!,
  levelUnit:c.levelUnit,
  comparisons:c.comparisons.filter(eligibleComparison).map(x=>({
   sessions:x.sessions,referenceDate:x.referenceDate!,reference:x.reference!,
   change:x.change!,unit:x.unit,percent:x.percent,
  })),
 }));
 const windows:MatchedWindow[]=WINDOWS.map(sessions=>{
  if(!anchor)return {sessions,status:"UNKNOWN",from:null,to:null,observations:[],
   reason:"No completed, fresh, source-linked daily observation available."};
  const window=anchor.comparisons.find(x=>x.sessions===sessions);
  if(!window||!eligibleComparison(window))return {
   sessions,status:"UNKNOWN",from:null,to:anchor.lastDate,observations:[],
   reason:"Anchor has insufficient completed sessions for this comparison.",
  };
  const from=window.referenceDate!,to=anchor.lastDate!;
  const aligned=eligible.flatMap(c=>{
   const value=c.comparisons.find(x=>x.sessions===sessions);
   if(c.lastDate!==to||!value||!eligibleComparison(value)||value.referenceDate!==from)return [];
   return [{id:c.id,symbol:c.symbol,source:c.source,sourceUrl:c.sourceUrl!,
     change:value.change!,unit:value.unit,percent:value.percent}];
  });
  return aligned.length>=2?{
   sessions,status:"MATCHED_DAILY_OBSERVATION",from,to,observations:aligned,
   reason:"Matched completed daily-source dates. This is NOT a measured event-window reaction.",
  }:{
   sessions,status:"UNKNOWN",from,to,observations:[],
   reason:"Fewer than two eligible assets share exactly the same completed start and end dates.",
  };
 });
 const event=validEventAt(eventAt,nowIso);
 const reason="No original-source, timestamped intraday bars are admitted in this ledger. "+
  "Completed daily observations cannot establish event-time price causality.";
 return {
  contractVersion:"editorial-reaction-ledger/1",
  status:"DAILY_SOURCE_COMPARISON_NOT_EVENT_REACTION",
  requestedAssetId:request,anchorId:anchor?.id||null,
  eventAt:event,builtAt:nowIso,assets,windows,
  eventWindows:(["5m","30m","4h"] as const).map(label=>({label,status:"UNKNOWN" as const,reason})),
  warnings:[
   "Observed prices are existing monitor-source readings, not newly admitted canonical Evidence.",
   "The 1/3/5-session comparisons are daily, not intraday release-window reactions.",
   "Mixed instruments differ in units, exchange hours, fixings, contract rolls and holidays.",
   "UNKNOWN windows must remain UNKNOWN; do not interpolate, infer or manufacture ticks.",
   !eventAt?"No explicit event clock provided.":event?
    "Owner-specified event time is a research locator, not independent event-time verification.":
    "Event time missing timezone, invalid, future-dated or otherwise inadmissible.",
  ],
 };
}
export function ledgerAsResearchPacket(ledger:ReactionLedger):string{
 const rows=ledger.windows.map(w=>w.status==="UNKNOWN"?
  w.sessions+" session(s): UNKNOWN — "+w.reason:
  w.sessions+" session(s) "+w.from+" → "+w.to+"; "+
  w.observations.map(o=>o.symbol+": "+
    (o.change>0?"+":"")+o.change+" "+o.unit+
    (o.percent===null?"":" ("+(o.percent>0?"+":"")+o.percent+"%)")+
    " source "+o.source+" ("+o.sourceUrl+")").join(" | "));
 return [
  "ORIGINAL PROVIDER DAILY OBSERVATIONS — NOT EVENT REACTION",
  "Server-computed only; not supplied or verified by owner-authored text.",
  "Built "+ledger.builtAt+"; event-clock locator "+(ledger.eventAt||"UNKNOWN")+".",
  ...rows,
  ...ledger.eventWindows.map(w=>w.label+" post-event: UNKNOWN — "+w.reason),
  "CAUTION: "+ledger.warnings.join(" "),
 ].join("\n").slice(0,8300);
}
