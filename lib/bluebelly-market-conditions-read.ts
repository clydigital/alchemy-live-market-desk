import type {PublicMarketObservation} from "./blue-desk-public-markets.ts";
import type {LedgerSeries} from "./treasury-ledger-reader-core.ts";
import {expectedHomeEtfSession} from "./bluebelly-home-etf-history.ts";
import {sourceDateFresh} from "./bluebelly-breadth-dated.ts";

export type ConditionKind="ai"|"energy"|"bonds"|"breadth";
const ids:Record<ConditionKind,readonly string[]>={ai:["smh","soxx"],energy:["brent","wti"],bonds:["us10y-fred","us10y"],breadth:["breadth:S5FI"]};
const types={ai:"AI / Semis",energy:"Energy",bonds:"Rates",breadth:"Breadth"} as const;

export function conditionHasLevel(row:PublicMarketObservation|null,now:Date):boolean{
 if(!row||row.frequency!=="daily"||typeof row.last!=="number"||!Number.isFinite(row.last)||!row.asOf)return false;
 const stamp=Date.parse(row.asOf);
 return Number.isFinite(stamp)&&stamp<=+now;
}
export function conditionIsCurrent(row:PublicMarketObservation|null,kind:ConditionKind,now:Date):boolean{
 if(!conditionHasLevel(row,now)||!row||row.dataStatus==="UNAVAILABLE_OR_STALE")return false;
 const day=row.asOf!.slice(0,10);
 if(kind==="ai"){const expected=expectedHomeEtfSession(now);return expected!==null&&day===expected;}
 return sourceDateFresh(day,now);
}
/** Consume existing shared rows only. Never substitute an unrelated asset or
 * promote a dated but stale reading into a current directional signal. */
export function selectConditionRow(rows:readonly PublicMarketObservation[],kind:ConditionKind,now:Date):PublicMarketObservation|null{
 const eligible=rows.filter(r=>r.type===types[kind]&&ids[kind].includes(r.id)&&conditionHasLevel(r,now));
 return eligible.sort((a,b)=>{
  const current=Number(conditionIsCurrent(b,kind,now))-Number(conditionIsCurrent(a,kind,now));
  const date=b.asOf!.localeCompare(a.asOf!);
  const delta=Number(Number.isFinite(b.change))-Number(Number.isFinite(a.change));
  const official=kind==="bonds"?Number(b.sourceName==="U.S. Department of the Treasury")-Number(a.sourceName==="U.S. Department of the Treasury"):0;
  return current||date||delta||official||ids[kind].indexOf(a.id)-ids[kind].indexOf(b.id);
 })[0]??null;
}
/** Reuse the exact existing official ledger. One-day differences of percent
 * levels are basis points, as in publicMarketObservations. No new provider. */
export function conditionTreasuryRow(series:readonly LedgerSeries[]):PublicMarketObservation|null{
 const item=series.find(s=>s.id==="us10y-fred");
 if(!item||item.points.length<2)return null;
 const last=item.points.at(-1)!,prior=item.points.at(-2)!;
 if(!Number.isFinite(last.close)||!Number.isFinite(prior.close)||!Number.isFinite(last.time)||last.time<=prior.time)return null;
 return {id:item.id,label:"US 10Y Yield · Treasury",symbol:"US10Y",type:"Rates",last:last.close,
  change:(last.close-prior.close)*100,change3d:null,change5d:null,changeUnit:"bp",frequency:"daily",
  asOf:new Date(last.time*1000).toISOString().slice(0,10),sourceName:"U.S. Department of the Treasury",sourceUrl:item.sourceUrl};
}
