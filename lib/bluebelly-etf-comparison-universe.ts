import type {PublicMarketObservation as Row} from "./blue-desk-public-markets.ts";
export const XL_COMPARISON_SYMBOLS=["XLB","XLC","XLE","XLF","XLI","XLK","XLP","XLRE","XLU","XLV","XLY"] as const;
export const ETF_COMPARISON_SYMBOLS=[...XL_COMPARISON_SYMBOLS,"RSP","SPY","QQQ","SMH","SOXX"] as const;
const labels:Record<string,string>={XLB:"Materials",XLC:"Communication services",XLE:"Energy",XLF:"Financials",XLI:"Industrials",XLK:"Technology",XLP:"Consumer staples",XLRE:"Real estate",XLU:"Utilities",XLV:"Healthcare",XLY:"Consumer discretionary",RSP:"Equal-weight S&P 500",SPY:"S&P 500 ETF",QQQ:"Nasdaq 100 ETF",SMH:"Semiconductor ETF",SOXX:"Semiconductor ETF"};
export function buildEtfComparisonUniverse(rows:readonly Row[]):Row[]{
 return ETF_COMPARISON_SYMBOLS.map(symbol=>{
  const candidates=rows.filter(r=>r.symbol.toUpperCase()===symbol&&r.frequency==="daily"&&r.changeUnit==="%"&&r.dataStatus!=="UNAVAILABLE_OR_STALE"&&r.asOf)
   .sort((a,b)=>b.asOf!.localeCompare(a.asOf!)||Number(b.change!==null)-Number(a.change!==null));
  const r=candidates[0];
  if(r)return {...r,symbol,change:Number.isFinite(r.change)?r.change:null,change3d:Number.isFinite(r.change3d)?r.change3d:null,change5d:Number.isFinite(r.change5d)?r.change5d:null};
  return {id:"comparison-"+symbol,symbol,label:labels[symbol],type:(XL_COMPARISON_SYMBOLS as readonly string[]).includes(symbol)?"Sector":"Major Index",last:null,change:null,change3d:null,change5d:null,changeUnit:"%",frequency:"daily",asOf:null,sourceName:"Unavailable",sourceUrl:null,dataStatus:"UNAVAILABLE_OR_STALE"};
 });
}
