import type {MarketMonitorRow} from "./market-monitor.ts";
import type {BreadthSeries} from "./bluebelly-breadth-dated.ts";
import {calculateBreadthRow,marketParticipationResearch} from "./bluebelly-breadth-dated.ts";
import {publicMarketObservations} from "./blue-desk-public-markets.ts";
import {buildXlBenchmarkSynergy} from "./bluebelly-xl-benchmark-synergy.ts";
export type MarketInternalsDiagnostic={status:"ready"|"insufficient";headline:string;interpretation:string;nextTest:string;asOf:string|null;sourceUrls:string[]};
const symbols=["S5FI","S5TH","NDFI","NDTH","R2FI","R2TH","S5OH"] as const;
const pp=(n:number|null)=>n===null?"unavailable":(n>0?"+":"")+n.toFixed(2)+" pp";
export function buildMarketInternalsResearch(rows:readonly MarketMonitorRow[],series:readonly BreadthSeries[],now:Date){
 const breadth=symbols.map(symbol=>calculateBreadthRow(symbol,symbol,series.find(s=>s.symbol===symbol),now));
 const eligible=breadth.filter(r=>r.dataStatus==="SOURCE_DATED_SECONDARY"&&r.last!==null);
 const dates=[...new Set(eligible.map(r=>r.asOf!))].sort().reverse();
 const session=dates[0]??null;
 const matched=eligible.filter(r=>r.asOf===session);
 const breadthDiagnostic:MarketInternalsDiagnostic={...marketParticipationResearch([...publicMarketObservations(rows,"all"),...breadth]),
  sourceUrls:[...new Set(matched.flatMap(r=>r.sourceUrl?[r.sourceUrl]:[]))]};
 const crossBreadth:MarketInternalsDiagnostic={
  status:matched.length>=2?"ready":"insufficient",asOf:session,
  headline:matched.length>=2?"Cross-index breadth participation ("+matched.length+"/7 series)":"Cross-index breadth coverage insufficient",
  interpretation:matched.length?matched.map(r=>r.symbol+" "+r.last!.toFixed(2)+"% (1D "+pp(r.change)+", 3D "+pp(r.change3d)+", 5D "+pp(r.change5d)+")").join("; ")+". Provider-specific participation measures; Russell-style is a proxy, not the official index.":"No fresh comparable breadth levels.",
  nextTest:"Separate short-term participation improvement from sustained breadth; compare 50D and 200D changes, equal weight and credit. Do not fill missing periods or equate proxy and official histories.",
  sourceUrls:breadthDiagnostic.sourceUrls,
 };
 const matrix=buildXlBenchmarkSynergy(rows,now);
 const rsp=matrix.sectors.flatMap(s=>{const r=s.relative.find(x=>x.id==="rsp");return r?.asOf&&r.changes[5]!==null?[{symbol:s.symbol,value:r.changes[5],asOf:r.asOf}]:[]});
 const latest=[...new Set(rsp.map(r=>r.asOf))].sort().at(-1)??null;
 const ranked=rsp.filter(r=>r.asOf===latest).sort((a,b)=>b.value-a.value);
 const links=[...new Set([...matrix.benchmarks,...matrix.sectors].flatMap(r=>r.sourceUrl?[r.sourceUrl]:[]))];
 const correlation=matrix.sectors.flatMap(s=>{const c=s.correlation20;const best=c.values.find(v=>v.id===c.best);return c.asOf===latest&&best?.correlation!=null?[s.symbol+"→"+(matrix.benchmarks.find(b=>b.id===c.best)?.label??c.best)+" r="+best.correlation.toFixed(2)+(c.coverage<4?" (provisional "+c.coverage+"/4)":c.tied?" (close tie)":"")]:[]});
 const leaders=ranked.slice(0,3).map(s=>s.symbol+" "+pp(s.value)).join(", ");
 const laggards=ranked.slice(-3).reverse().map(s=>s.symbol+" "+pp(s.value)).join(", ");
 const sectorDiagnostic:MarketInternalsDiagnostic={
  status:ranked.length>=8?"ready":"insufficient",asOf:latest,
  headline:ranked.length>=8?"Sector leadership vs RSP: "+ranked.filter(s=>s.value>0).length+"/"+ranked.length+" outperforming":"Sector leadership coverage insufficient",
  interpretation:(ranked.length>=8?"Matched 5D relative returns. Leaders: "+leaders+"; laggards: "+laggards+". ":"Too few matched sectors for a broad rotation claim. ")+(correlation.length?"20-session benchmark affinity: "+correlation.join("; ")+". ":"No same-session benchmark affinity ranking. ")+"Correlation is not causation or outperformance.",
  nextTest:"Check the 1D/3D/5D matrix against S&P 500, RSP, Nasdaq 100 and Dow. Test whether defensive or cyclical leadership persists; confirm with breadth, credit, rates and independent catalysts before changing regime.",
  sourceUrls:links,
 };
 return {breadth, matrix, diagnostics:[breadthDiagnostic,crossBreadth,sectorDiagnostic] as MarketInternalsDiagnostic[]};
}
