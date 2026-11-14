import type {CrashSignal,CrashWatchView} from "./bluebelly-crash-opportunity.ts";
import type {MarketCompassSummary} from "./bluebelly-market-compass.ts";
import {emptyCrashTranscriptScore,type CrashTranscriptScore} from "./bluebelly-crash-transcript-score.ts";

/**
 * The position of this seesaw is a fixed, transparent research heuristic:
 * credit 2.0 units; five-session breadth 1.5; one-day tape 1.0.
 * Reviewed transcript claims may add up to 1.0 *secondary* corroboration
 * unit once they agree with the already qualified market measurement.
 * It is NOT a calibrated crash probability, trading position or canonical
 * Regime score. Unknown readings carry no directional weight.
 */
export type EvidenceSide="OPPORTUNITY"|"CRASH_RISK"|"NEUTRAL"|"UNKNOWN";
export type EvidenceWeight=Readonly<{
 id:"credit"|"breadth"|"tape";label:string;
 maximum:number;side:EvidenceSide;observedAt:string|null;
 observation:string;
}>;
export type CrashEvidenceBalance=Readonly<{
 weights:readonly EvidenceWeight[];
 transcript:CrashTranscriptScore;
 marketOpportunityUnits:number;marketCrashUnits:number;
 opportunityUnits:number;crashUnits:number;neutralUnits:number;unknownUnits:number;
 eligibleCount:number;maximumUnits:4.5;
 angle:number;lean:"OPPORTUNITY"|"CRASH_RISK"|"BALANCED"|"UNMEASURED";
 verdict:string;
 latestSession:string|null;
}>;
const PRIORITIES=[
 {id:"credit",label:"HY credit spreads",maximum:2},
 {id:"breadth",label:"5-session market breadth",maximum:1.5},
 {id:"tape",label:"1-day equity tape",maximum:1}
] as const;

function side(signal:CrashSignal):EvidenceSide{
 return signal==="BULL"?"OPPORTUNITY":signal==="BEAR"?"CRASH_RISK":
  signal==="MIXED"?"NEUTRAL":"UNKNOWN";
}
function pillarSignal(view:CrashWatchView,id:string):CrashSignal{
 return view.pillars.find(p=>p.id===id)?.signal??"UNKNOWN";
}
export function buildCrashEvidenceBalance(
 view:CrashWatchView,compass:MarketCompassSummary,
 transcript:CrashTranscriptScore=emptyCrashTranscriptScore(),
):CrashEvidenceBalance{
 const b=view.pillars.find(p=>p.id==="breadth"),c=view.pillars.find(p=>p.id==="credit");
 const cr=view.readings.find(r=>r.id==="hy-oas");
 const tape:CrashSignal=compass.sourceSession===null?"UNKNOWN":
  compass.state==="RISK_ON"?"BULL":compass.state==="RISK_OFF"?"BEAR":
  compass.state==="MIXED"?"MIXED":"UNKNOWN";
 const breadth:CrashSignal=b?.observedAt?pillarSignal(view,"breadth"):"UNKNOWN";
 const credit:CrashSignal=c?.observedAt&&cr?.status==="DATED"&&cr.asOf===c.observedAt?
  pillarSignal(view,"credit"):"UNKNOWN";
 const signals={credit,breadth,tape};
 const dates={credit:credit==="UNKNOWN"?null:c!.observedAt,
  breadth:breadth==="UNKNOWN"?null:b!.observedAt,
  tape:tape==="UNKNOWN"?null:compass.sourceSession};
 const descriptions={
  credit:credit==="UNKNOWN"?"Qualified five-observation HY OAS unavailable":
   c!.basis,
  breadth:breadth==="UNKNOWN"?"Matched RSP/SPX five-session participation unavailable":
   b!.basis,
  tape:tape==="UNKNOWN"?"Four matched 1D ETF observations unavailable":
   "Completed four-ETF tape: "+compass.title
 };
 const weights:EvidenceWeight[]=PRIORITIES.map(p=>({
  id:p.id,label:p.label,maximum:p.maximum,side:side(signals[p.id]),
  observedAt:dates[p.id],observation:descriptions[p.id]
 }));
 const sum=(type:EvidenceSide)=>Number(weights.filter(w=>w.side===type)
   .reduce((n,w)=>n+w.maximum,0).toFixed(1));
 const marketOpportunityUnits=sum("OPPORTUNITY"),marketCrashUnits=sum("CRASH_RISK");
 const opportunityUnits=Number((marketOpportunityUnits+transcript.opportunityUnits).toFixed(2));
 const crashUnits=Number((marketCrashUnits+transcript.crashUnits).toFixed(2));
 const neutralUnits=sum("NEUTRAL"),unknownUnits=sum("UNKNOWN");
 const eligibleCount=weights.filter(w=>w.side!=="UNKNOWN").length;
 const difference=crashUnits-opportunityUnits;
 // Right-hand crash pan goes DOWN when crash-side evidence is heavier.
 // Maximum ±13° even when all three observations agree.
 const angle=eligibleCount===0?0:Number(Math.max(-13,Math.min(13,13*difference/4.5)).toFixed(2));
 const lean:CrashEvidenceBalance["lean"]=eligibleCount===0?"UNMEASURED":
  difference>0?"CRASH_RISK":difference<0?"OPPORTUNITY":"BALANCED";
 const verdict=lean==="CRASH_RISK"?"Crash-risk evidence weighs more":
  lean==="OPPORTUNITY"?"Opportunity evidence weighs more":
  lean==="BALANCED"?"Directional evidence is evenly balanced":
  "Insufficient dated inputs to tilt the balance";
 const latestSession=[...weights.map(w=>w.observedAt).filter((x):x is string=>x!==null)]
  .sort().at(-1)??null;
 return {weights,transcript,marketOpportunityUnits,marketCrashUnits,
  opportunityUnits,crashUnits,neutralUnits,unknownUnits,
  eligibleCount,maximumUnits:4.5,angle,lean,verdict,latestSession};
}
