import type { PublicMarketObservation } from "./blue-desk-public-markets.ts";
import { publicMarketWindowChange, type MarketChangeWindow } from "./blue-desk-market-filters.ts";

/** Read-only matched-session price comparisons; never a causal or regime verdict. */
export const MARKET_DIVERGENCE_PAIRS = [
  {id:"semis-vs-nasdaq",left:"SMH",right:"QQQ",title:"Semiconductors vs Nasdaq 100",
    question:"Are chipmakers participating in the wider technology move?",
    nextTest:"Check semiconductor earnings guidance, AI orders and software participation."},
  {id:"financials-vs-tech",left:"XLF",right:"XLK",title:"Financials vs technology",
    question:"Is market leadership changing between banks and technology?",
    nextTest:"Check Treasury yields, bank credit provisions and technology earnings revisions."},
  {id:"equal-vs-cap",left:"RSP",right:"SPY",title:"Equal-weight vs cap-weight equities",
    question:"Is the broader market keeping pace with the largest companies?",
    nextTest:"Check S5FI/S5TH breadth and the participation of small and mid-sized equities."},
  {id:"energy-vs-consumer",left:"XLE",right:"XLY",title:"Energy vs consumer discretionary",
    question:"Are energy shares and consumer-sensitive companies moving differently?",
    nextTest:"Check Brent, refined-product margins, retail volumes and consumer earnings."},
  {id:"software-vs-chips",left:"IGV",right:"SMH",title:"Software vs semiconductors",
    question:"Is AI-related leadership shifting between software and hardware?",
    nextTest:"Check software demand, memory pricing, chip orders and free-cash-flow guidance."},
] as const;

export type MarketDivergenceRead = {
  id:string; title:string; left:string; right:string; question:string; nextTest:string;
  status:"OPPOSITE_MOVE"|"RELATIVE_MOVE"|"NOT_COMPARABLE";
  leftChange:number|null; rightChange:number|null; gapPp:number|null;
  sourceSession:string|null;
  leftSourceUrl:string|null; rightSourceUrl:string|null;
  reason:string|null;
};
const usable=(row:PublicMarketObservation|undefined,window:MarketChangeWindow):row is PublicMarketObservation=>
  Boolean(row && row.frequency==="daily" && row.changeUnit==="%" && row.asOf
    && row.dataStatus!=="UNAVAILABLE_OR_STALE" && row.last!==null
    && Number.isFinite(row.last) && publicMarketWindowChange(row,window)!==null);

/** Never infer a missing quote, substitute a proxy or mix trading sessions. */
export function buildMarketDivergenceWatch(
  observations:readonly PublicMarketObservation[],window:MarketChangeWindow,
):MarketDivergenceRead[] {
  const bySymbol=new Map<string,PublicMarketObservation>();
  for(const row of observations){
    if(!bySymbol.has(row.symbol))bySymbol.set(row.symbol,row);
  }
  return MARKET_DIVERGENCE_PAIRS.map(pair=>{
    const a=bySymbol.get(pair.left),b=bySymbol.get(pair.right);
    const base={...pair,leftChange:null,rightChange:null,gapPp:null,sourceSession:null,
      leftSourceUrl:a?.sourceUrl??null,rightSourceUrl:b?.sourceUrl??null};
    if(!usable(a,window)||!usable(b,window))
      return {...base,status:"NOT_COMPARABLE" as const,
        reason:"One or both daily percentage-return observations are missing, stale or lack this window."};
    if(a.asOf!==b.asOf)
      return {...base,status:"NOT_COMPARABLE" as const,
        reason:`Unmatched source sessions: ${a.asOf} vs ${b.asOf}.`};
    const leftChange=publicMarketWindowChange(a,window)!;
    const rightChange=publicMarketWindowChange(b,window)!;
    const gapPp=Number((leftChange-rightChange).toFixed(2));
    const opposite=leftChange*rightChange<0;
    return {...base,leftChange,rightChange,gapPp,sourceSession:a.asOf,
      status:opposite?"OPPOSITE_MOVE" as const:"RELATIVE_MOVE" as const,reason:null};
  }).sort((a,b)=>{
    const priority=(r:MarketDivergenceRead)=>r.status==="OPPOSITE_MOVE"?0:r.status==="RELATIVE_MOVE"?1:2;
    return priority(a)-priority(b)
      || Math.abs(b.gapPp??0)-Math.abs(a.gapPp??0)
      || a.title.localeCompare(b.title);
  });
}
