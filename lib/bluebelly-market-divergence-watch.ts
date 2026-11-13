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
  // Some instruments have both core-market and independently sourced ETF histories.
  // Choose a genuinely matched date, prioritising the newest comparable session.
  // This does not backfill missing prices or substitute an index for an ETF.
  const bySymbol=new Map<string,PublicMarketObservation[]>();
  for(const row of observations){
    // The legacy ^GSPC-labelled "spx-proxy" is actually a Nasdaq SPY ETF
    // history in the existing core market feed. Only that exact original
    // issuer/source may serve the SPY side of RSP/SPY; cash index feeds cannot.
    const isSpyUnderlying=row.id==="spx-proxy"&&row.symbol==="^GSPC"&&
      row.sourceName==="Nasdaq official etf history"&&
      row.sourceUrl==="https://www.nasdaq.com/market-activity/etf/spy/historical";
    for(const key of (isSpyUnderlying?[row.symbol,"SPY"]:[row.symbol])){
      const rows=bySymbol.get(key)??[];
      rows.push(row);
      bySymbol.set(key,rows);
    }
  }
  return MARKET_DIVERGENCE_PAIRS.map(pair=>{
    const leftRows=bySymbol.get(pair.left)??[];
    const rightRows=bySymbol.get(pair.right)??[];
    const leftEligible=leftRows.filter(row=>usable(row,window));
    const rightEligible=rightRows.filter(row=>usable(row,window));
    const matched=leftEligible.flatMap(a=>rightEligible
      .filter(b=>a.asOf===b.asOf)
      .map(b=>({a,b})))
      .sort((x,y)=>{
        // Latest matching close first; among identical dates prefer one provider.
        const dateCompare=(y.a.asOf??"").localeCompare(x.a.asOf??"");
        if(dateCompare)return dateCompare;
        const same=(p:typeof x)=>Number(p.a.sourceName===p.b.sourceName);
        return same(y)-same(x);
      });
    const selection=matched[0];
    const a=selection?.a??leftEligible[0]??leftRows[0];
    const b=selection?.b??rightEligible[0]??rightRows[0];
    const base={...pair,leftChange:null,rightChange:null,gapPp:null,sourceSession:null,
      leftSourceUrl:a?.sourceUrl??null,rightSourceUrl:b?.sourceUrl??null};
    if(!selection){
      const noLeft=leftEligible.length===0,noRight=rightEligible.length===0;
      const reason=noLeft||noRight
        ? "Missing eligible "+[noLeft?pair.left:null,noRight?pair.right:null].filter(Boolean).join(" / ")+" daily ETF returns for "+window+"."
        : "Unmatched source sessions: "+pair.left+" "+leftEligible.map(row=>row.asOf).join(", ")+" vs "+pair.right+" "+rightEligible.map(row=>row.asOf).join(", ")+".";
      return {...base,status:"NOT_COMPARABLE" as const,reason};
    }
    const leftChange=publicMarketWindowChange(selection.a,window)!;
    const rightChange=publicMarketWindowChange(selection.b,window)!;
    const gapPp=Number((leftChange-rightChange).toFixed(2));
    const opposite=leftChange*rightChange<0;
    return {...base,leftChange,rightChange,gapPp,sourceSession:selection.a.asOf,
      status:opposite?"OPPOSITE_MOVE" as const:"RELATIVE_MOVE" as const,reason:null};
  }).sort((a,b)=>{
    const priority=(r:MarketDivergenceRead)=>r.status==="OPPOSITE_MOVE"?0:r.status==="RELATIVE_MOVE"?1:2;
    return priority(a)-priority(b)
      || Math.abs(b.gapPp??0)-Math.abs(a.gapPp??0)
      || a.title.localeCompare(b.title);
  });
}
