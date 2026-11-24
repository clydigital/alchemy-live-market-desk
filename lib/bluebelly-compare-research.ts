import type { MarketMonitorRow } from "./market-monitor.ts";
import type { PublicMarketObservation } from "./blue-desk-public-markets.ts";
import { buildEtfComparisonUniverse, XL_COMPARISON_SYMBOLS } from "./bluebelly-etf-comparison-universe.ts";
import { projectEtfRotationVisual } from "./bluebelly-etf-rotation-visuals.ts";
import { buildXlBenchmarkSynergy } from "./bluebelly-xl-benchmark-synergy.ts";
import { buildMarketDivergenceWatch } from "./bluebelly-market-divergence-watch.ts";
import { calculateBreadthRow, marketParticipationResearch, sourceDateFresh, type BreadthSeries } from "./bluebelly-breadth-dated.ts";

export const COMPARE_WINDOWS = ["1D","3D","5D"] as const;
export const COMPARE_BREADTH_SYMBOLS = [["S5TW","S&P 500 above 20D"],["S5FI","S&P 500 above 50D"],["S5OH","S&P 500 above 100D"],["S5TH","S&P 500 above 200D"],["NDFI","Nasdaq 100 above 50D"],["NDTH","Nasdaq 100 above 200D"],["R2FI","Russell 2000 above 50D"],["R2TH","Russell 2000 above 200D"]] as const;
export function compareBreadthObservations(series:readonly BreadthSeries[],now:Date){return COMPARE_BREADTH_SYMBOLS.map(([symbol,label])=>calculateBreadthRow(symbol,label,series.find(s=>s.symbol===symbol),now));}

/** Read-only research projection of the exact Markets Compare calculations.
 * No new requests, fabricated prices, causal inference or canonical admission. */
export function buildCompareResearch(rows: readonly MarketMonitorRow[], observations: readonly PublicMarketObservation[], now: Date) {
 const universe=buildEtfComparisonUniverse(observations);
 const sectors=universe.filter(r=>(XL_COMPARISON_SYMBOLS as readonly string[]).includes(r.symbol));
 const rotation=COMPARE_WINDOWS.map(window=>{
  const visual=projectEtfRotationVisual(universe,XL_COMPARISON_SYMBOLS,window);
  const eligible=visual&&sourceDateFresh(visual.asOf,now)?visual:null;
  const bars=(eligible?.bars??[]).map(b=>{
   const row=sectors.find(r=>r.symbol===b.symbol);
   return {symbol:b.symbol,label:b.label,changePercent:b.value,sourceUrl:row?.sourceUrl??null,sourceName:row?.sourceName??null};
  });
  return {window,asOf:eligible?.asOf??null,coverage:bars.length,expected:11,
   status:bars.length===11?"COMPLETE":bars.length?"PARTIAL":"UNAVAILABLE",
   advancing:bars.filter(b=>b.changePercent>0).length,
   leader:bars[0]??null,laggard:bars.at(-1)??null,
   spreadPp:bars.length>=2?Number((bars[0].changePercent-bars.at(-1)!.changePercent).toFixed(2)):null,
   bars,missing:XL_COMPARISON_SYMBOLS.filter(symbol=>!bars.some(b=>b.symbol===symbol))};
 });
 const divergences=COMPARE_WINDOWS.map(window=>({window,pairs:buildMarketDivergenceWatch(observations,window).map(pair=>
  pair.sourceSession&&!sourceDateFresh(pair.sourceSession,now)?{...pair,status:"NOT_COMPARABLE" as const,reason:"Source session stale",leftChange:null,rightChange:null,gapPp:null}:pair)}));
 const benchmark=buildXlBenchmarkSynergy(rows,now);
 const breadth=observations.filter(r=>COMPARE_BREADTH_SYMBOLS.some(([symbol])=>symbol===r.symbol)).map(r=>({
  symbol:r.symbol,label:r.label,level:r.last,asOf:r.asOf,change1dPp:r.change,change3dPp:r.change3d,change5dPp:r.change5d,
  status:r.dataStatus,sourceUrl:r.sourceUrl,sourceName:r.sourceName,
 }));
 return {contractVersion:"bluebelly/markets-compare/1" as const,generatedAt:now.toISOString(),
  status:rotation.some(r=>r.coverage>0)||divergences.some(d=>d.pairs.some(p=>p.gapPp!==null))||breadth.some(b=>b.level!==null)||benchmark.sectors.some(s=>s.relative.some(r=>Object.values(r.changes).some(v=>v!==null)))?"SOURCE_DATED_PARTIAL_OR_COMPLETE":"UNAVAILABLE",
  rotation,divergences,benchmark,breadth,participation:marketParticipationResearch(observations),
  limitations:["Use source session, not retrieval clock. Different holding periods must not be compared.",
   "XL bars are price returns, not fund flows. Relative performance is percentage points; correlations are aligned return correlations, not causation.",
   "Benchmarks include explicit ETF proxies; correlation sample counts and unavailable cells must be retained.",
   "Breadth level is percentage of members, changes are percentage points. Proxy series are not interchangeable.",
   "Research leads only; independent evidence is required for causal claims, trade or canonical regime changes."]};
}
export type CompareResearch=ReturnType<typeof buildCompareResearch>;

/** Compact model-readable digest; full matrix is retained in structured response. */
export function compareResearchLines(data:CompareResearch):string[]{
 const num=(v:number|null)=>v===null?"UNKNOWN":v.toFixed(2);
 const out=["## MARKETS COMPARE — SOURCE-DATED ROTATION AND DIVERGENCES",
  "Price returns (%) and relative gaps (pp) are not flows or causal evidence. Compare all eleven XL sectors with matched sessions.",
  "Coverage: "+data.status];
 for(const window of data.rotation){
  out.push(window.window+" session "+(window.asOf??"UNKNOWN")+" | "+window.coverage+"/11 | "+window.advancing+" advancing | spread "+num(window.spreadPp)+" pp",
    "Sector returns: "+(window.bars.map(b=>b.symbol+" "+num(b.changePercent)+"%").join("; ")||"UNKNOWN")+" | missing: "+(window.missing.join(", ")||"none"));
 }
 for(const horizon of data.divergences){
  out.push(horizon.window+" divergence checks:");
  for(const p of horizon.pairs)out.push(p.left+"/"+p.right+" "+p.status+" | "+(p.sourceSession??"UNKNOWN")+" | "+num(p.gapPp)+" pp"+(p.reason?" | "+p.reason:""));
 }
 for(const b of data.breadth)out.push(b.symbol+" "+b.status+" | "+(b.asOf??"UNKNOWN")+" | level "+num(b.level)+"% | 1D/3D/5D "+[b.change1dPp,b.change3dPp,b.change5dPp].map(num).join("/")+" pp");
 out.push("Benchmark matrix: sector minus benchmark returns, not correlation. 5D relative (pp), source sessions and 20-session correlation sample counts:");
 for(const s of data.benchmark.sectors){
  out.push(s.symbol+" "+s.relative.map(r=>r.id+" "+num(r.changes[5])+"@"+(r.asOf??"UNKNOWN")).join("; ")+" | corr20 n="+s.correlation20.count+"; best="+(s.correlation20.best??"UNKNOWN")+(s.correlation20.tied?" (near tie)":""));
 }
 out.push("Use full structured benchmark matrix for other windows and correlation values; never turn a missing cell into zero.");
 return out;
}
