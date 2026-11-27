import {dailyBandCell,fourHBandCells,matchesScannerGroup,type ScanAsset,type BandCell} from "./technical-market-scanner.ts";
import type {FourHRead} from "./bluebelly-4h-levels.ts";
import type {EmaObservation} from "./bluebelly-equity-ema.ts";
import {EMA_PERIODS} from "./ema-sd-levels.ts";

export type InvestmentFrame="D"|"W"|"M";
export type ReviewState="Review downside"|"Review recovery"|"Watch boundary"|"Monitor / retest"|"Context only"|"Unassessed"|"Valuation only";
export type PeriodReview={period:number;frames:Record<InvestmentFrame,BandCell|null>;execution:BandCell|null;state:ReviewState;reason:string;alignment:string;levels:Record<InvestmentFrame,EmaObservation|null>};
export type AssetReview={asset:ScanAsset;periods:PeriodReview[];state:ReviewState;focus:PeriodReview|null};
const priority:Record<ReviewState,number>={"Review downside":0,"Review recovery":1,"Watch boundary":2,"Monitor / retest":3,"Context only":4,"Unassessed":5,"Valuation only":6};
const dir=(c:BandCell|null):"up"|"down"|null=>!c||c.quality!=="Verified sessions"?null:c.position==="Above"?"up":c.position==="Below"?"down":c.lastExit?.direction??null;
const verified=(c:BandCell|null)=>c?.quality==="Verified sessions";
const label=(c:BandCell)=>c.position==="Inside"?"Inside ("+(c.lastExit?.direction==="up"?"↑":c.lastExit?.direction==="down"?"↓":"unknown")+")"+(c.state.startsWith("Approaching")?" · "+c.state:""):c.state+(c.held?" · held":"");
export const bandReviewLabel=label;
export function assessPeriod(period:number,frames:PeriodReview["frames"],levels:PeriodReview["levels"],execution:BandCell|null):PeriodReview{
 const {D,W,M}=frames;
 const observed=[["D",D],["W",W],["M",M]] as const;
 const active=observed.filter(([,c])=>verified(c));
 const wd=dir(W),md=dir(M),dd=dir(D);
 const alignment=wd&&md?(wd===md?(wd==="up"?"W/M upside context":"W/M downside context"):"W/M conflict"):"W/M context incomplete";
 const context=dd&&wd&&dd!==wd?alignment+" · daily conflicts with weekly":alignment;
 const result=(state:ReviewState,reason:string):PeriodReview=>({period,frames,levels,execution,state,reason,alignment:context});
 if(!active.length)return result("Unassessed","No verified ready D/W/M observation. Repair source coverage; no technical conclusion.");
 // Actual completed-close transitions and holds outrank approach and history.
 const down=active.filter(([,c])=>c!.state==="Exiting ↓"||c!.position==="Below"&&c!.held);
 const up=active.filter(([,c])=>c!.state==="Exiting ↑"||c!.position==="Above"&&c!.held);
 const events=(xs:typeof active)=>xs.map(([f,c])=>f+" "+label(c!)).join("; ");
 const respect=verified(D)?levels.D?.bandRespect:null;
 if(down.length||respect?.status==="RESET"&&respect.lastRetest?.direction==="support"||respect?.status==="BREAK_PENDING"&&respect.lastRetest?.direction==="support")return result("Review downside", [down.length?events(down):"",respect?.lastRetest?.direction==="support"&&(respect.status==="RESET"||respect.status==="BREAK_PENDING")?"Daily respected support "+(respect.status==="RESET"?"invalidated":"at risk"):"",up.length?"Opposing upside event: "+events(up):""].filter(Boolean).join(" · ")+". Review exposure and thesis; do not auto-sell.");
 if(up.length)return result("Review recovery",events(up)+(wd==="down"||md==="down"?". Higher-timeframe downside context: treat as recovery, not confirmed reversal.":". Check hold/retest and value before adding."));
 const approaches=active.filter(([,c])=>c!.state.startsWith("Approaching"));
 if(approaches.length)return result("Watch boundary",events(approaches)+". Prepare trigger and invalidation; approach is not a break.");
 if(respect?.status==="RESPECTED"&&respect.lastRetest)return result("Monitor / retest","Daily "+respect.lastRetest.direction+" respected at "+respect.lastRetest.boundary+" SD on "+respect.lastRetest.session+". Preserve that edge until invalidated.");
 if(respect?.status==="RESET"&&respect.lastRetest?.direction==="resistance")return result("Review recovery","Prior daily resistance invalidated. Require reclaim/hold and valuation confirmation.");
 if(active.some(([,c])=>c!.position==="Inside"&&c!.lastExit))return result("Monitor / retest","Inside-band history: "+events(active.filter(([,c])=>c!.position==="Inside"&&!!c!.lastExit))+". Last exit is context, not a new entry.");
 return result("Context only","Ready position without a qualifying new transition or respected-band evidence.");
}
export function projectPowerStackBandReviews(assets:readonly ScanAsset[],reads:readonly FourHRead[]):AssetReview[]{
 const timing=new Map(reads.map(r=>[r.symbol,fourHBandCells(r)]));
 return assets.map(asset=>{
  if(matchesScannerGroup(asset,"Real estate"))return {asset,periods:[],state:"Valuation only" as const,focus:null};
  const periods=EMA_PERIODS.map(period=>{
   const levels=Object.fromEntries((["D","W","M"] as const).map(f=>[f,asset.observations.find(o=>o.frame===f&&o.period===period)??null])) as PeriodReview["levels"];
   const frames=Object.fromEntries((["D","W","M"] as const).map(f=>[f,levels[f]?dailyBandCell(asset,levels[f]!):null])) as PeriodReview["frames"];
   return assessPeriod(period,frames,levels,timing.get(asset.ticker)?.find(c=>c.period===period)??null);
  });
  // Choose a display focus, not a trend vote or a replacement for the other periods.
  const focus=[...periods].sort((a,b)=>priority[a.state]-priority[b.state]||b.period-a.period)[0];
  return {asset,periods,state:focus.state,focus};
 }).sort((a,b)=>priority[a.state]-priority[b.state]||Number(b.asset.memberships.includes("Holding"))-Number(a.asset.memberships.includes("Holding"))||a.asset.ticker.localeCompare(b.asset.ticker));
}
