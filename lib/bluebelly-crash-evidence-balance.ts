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
 maximum:number;side:EvidenceSide;signal:CrashSignal;
 units:number;neutralUnits:number;observedAt:string|null;
 observation:string;
}>;
export type CrashEvidenceBalance=Readonly<{
 weights:readonly EvidenceWeight[];
 transcript:CrashTranscriptScore;
 marketOpportunityUnits:number;marketCrashUnits:number;
 opportunityUnits:number;crashUnits:number;neutralUnits:number;unknownUnits:number;
 eligibleCount:number;maximumUnits:4.5;
 angle:number;lean:"OPPORTUNITY"|"CRASH_RISK"|"BALANCED"|"NEUTRAL"|"UNMEASURED";
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
function clamp(value:number):number{
 return Math.max(-1,Math.min(1,value));
}
/**
 * Signed early directional pressure: negative = opportunity, positive = crash
 * risk. This never changes the higher-confidence BULL/BEAR/MIXED pillar gate.
 * Only independently dated, source-qualified values may generate a partial
 * weight; MIXED ETF tape remains neutral without a comparable four-ETF
 * directional magnitude.
 */
function gradedPressure(
 id:"credit"|"breadth"|"tape",signal:CrashSignal,
 view:CrashWatchView,observedAt:string|null,
):number{
 if(signal==="UNKNOWN")return 0;
 if(signal==="BULL")return -1;
 if(signal==="BEAR")return 1;
 if(!observedAt)return 0;
 if(id==="credit"){
  const hy=view.readings.find(r=>r.id==="hy-oas");
  if(hy?.status!=="DATED"||hy.asOf!==observedAt||
     hy.fiveSessionChange===null||!Number.isFinite(hy.fiveSessionChange))return 0;
  const bp=hy.fiveSessionChange;
  // Threshold remains +30bp for stress and -20bp for relief.
  return clamp(bp>=0?bp/30:bp/20);
 }
 if(id==="breadth"){
  const spx=view.readings.find(r=>r.id==="spx");
  const rsp=view.readings.find(r=>r.id==="rsp");
  if(!spx||!rsp||spx.status!=="DATED"||rsp.status!=="DATED"||
     spx.asOf!==observedAt||rsp.asOf!==observedAt||
     spx.fiveSessionChange===null||rsp.fiveSessionChange===null||
     !Number.isFinite(spx.fiveSessionChange)||!Number.isFinite(rsp.fiveSessionChange))return 0;
  // Underperformance of RSP raises risk; +/-1pp remains the strong signal.
  return clamp(spx.fiveSessionChange-rsp.fiveSessionChange);
 }
 return 0;
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
 const weights:EvidenceWeight[]=PRIORITIES.map(p=>{
  const signal=signals[p.id];
  const pressure=gradedPressure(p.id,signal,view,dates[p.id]);
  const units=Number((p.maximum*Math.abs(pressure)).toFixed(2));
  const direction:EvidenceSide=pressure>0&&units>0?"CRASH_RISK":
   pressure<0&&units>0?"OPPORTUNITY":side(signal)==="UNKNOWN"?"UNKNOWN":"NEUTRAL";
  return {id:p.id,label:p.label,maximum:p.maximum,signal,side:direction,units,
   neutralUnits:signal==="UNKNOWN"?0:Number((p.maximum-units).toFixed(2)),
   observedAt:dates[p.id],observation:descriptions[p.id]};
 });
 const sum=(type:EvidenceSide)=>Number(weights.filter(w=>w.side===type)
   .reduce((n,w)=>n+w.units,0).toFixed(2));
 const marketOpportunityUnits=sum("OPPORTUNITY"),marketCrashUnits=sum("CRASH_RISK");
 const opportunityUnits=Number((marketOpportunityUnits+transcript.opportunityUnits).toFixed(2));
 const crashUnits=Number((marketCrashUnits+transcript.crashUnits).toFixed(2));
 const neutralUnits=Number(weights.reduce((n,w)=>n+w.neutralUnits,0).toFixed(2));
 const unknownUnits=Number(weights.filter(w=>w.signal==="UNKNOWN")
   .reduce((n,w)=>n+w.maximum,0).toFixed(2));
 const eligibleCount=weights.filter(w=>w.signal!=="UNKNOWN").length;
 const difference=crashUnits-opportunityUnits;
 // Right-hand crash pan goes DOWN when crash-side evidence is heavier.
 // Maximum ±13° even when all three observations agree.
 const angle=eligibleCount===0?0:Number(Math.max(-13,Math.min(13,13*difference/4.5)).toFixed(2));
 const lean:CrashEvidenceBalance["lean"]=eligibleCount===0?"UNMEASURED":
  crashUnits===0&&opportunityUnits===0?"NEUTRAL":
  difference>0?"CRASH_RISK":difference<0?"OPPORTUNITY":"BALANCED";
 const confirmedDirections=weights.filter(w=>w.signal==="BULL"||w.signal==="BEAR").length;
 const verdict=lean==="CRASH_RISK"?
  confirmedDirections?"Crash-risk evidence weighs more":"Early crash-risk tilt; confirmation thresholds not crossed":
  lean==="OPPORTUNITY"?
  confirmedDirections?"Opportunity evidence weighs more":"Early opportunity tilt; confirmation thresholds not crossed":
  lean==="BALANCED"?"Opposing directional evidence is evenly balanced":
  lean==="NEUTRAL"?"All measured indicators are neutral with no measurable directional pressure":
  "Insufficient dated inputs to tilt the balance";
 const latestSession=[...weights.map(w=>w.observedAt).filter((x):x is string=>x!==null)]
  .sort().at(-1)??null;
 return {weights,transcript,marketOpportunityUnits,marketCrashUnits,
  opportunityUnits,crashUnits,neutralUnits,unknownUnits,
  eligibleCount,maximumUnits:4.5,angle,lean,verdict,latestSession};
}
