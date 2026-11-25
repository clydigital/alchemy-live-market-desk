import Link from "next/link";
import {marketInternalsDiagnostics,type CompareResearch} from "@/lib/bluebelly-compare-research";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
const pp=(n:number|null)=>n===null?"—":(n>0?"+":"")+n.toFixed(2)+" pp";
export default function RegimeCompareEvidence({compare,host,compact=false}:{compare:CompareResearch;host:string|null;compact?:boolean}){
 const diagnostics=marketInternalsDiagnostics(compare);
 if(compact)return <section data-regime-compare-evidence="shared-source-dated" style={{border:"1px solid var(--bb-card-border)",padding:12,margin:"12px 0"}}><small>MARKET INTERNALS</small><h2 style={{margin:"6px 0"}}>Participation &amp; sector leadership</h2>{diagnostics.map(d=><details key={d.headline}><summary>{d.headline} · {d.asOf??"unavailable"}</summary><p>{d.interpretation}</p><p>{d.nextTest}</p></details>)}<Link href={blueDeskPublicHref("/blue-desk/markets?mode=compare",host)}>Inspect full Compare matrix →</Link></section>;
 const five=compare.rotation.find(r=>r.window==="5D");
 const available=compare.breadth.filter(b=>b.status==="SOURCE_DATED_SECONDARY"&&b.level!==null);
 const session=available.map(b=>b.asOf??"").sort().at(-1);
 const breadth=available.filter(b=>b.asOf===session);
 const sector=compare.benchmark.sectors.find(s=>s.symbol==="XLK");
 const affinity=sector?.correlation20;
 const best=affinity?.values.find(v=>v.id===affinity.best);
 const benchmark=compare.benchmark.benchmarks.find(b=>b.id===affinity?.best);
 return <section data-regime-compare-evidence="shared-source-dated" style={{border:"1px solid var(--bb-card-border)",background:"var(--bb-surface)",padding:16,margin:"12px 0"}}>
 <small>MARKET INTERNALS · SAME COMPARE RESEARCH FEED</small>
 <h2 style={{margin:"6px 0"}}>Participation &amp; sector leadership</h2>
 <p>{five&&five.coverage>=8?five.advancing+"/"+five.coverage+" measured sectors advanced over 5D · "+five.asOf+". Leader "+five.leader?.symbol+"; laggard "+five.laggard?.symbol+".":"Insufficient matched sector observations for a broad leadership read."}</p>
 <p>{compare.participation.headline} · {compare.participation.asOf??"unavailable"}</p>
 {diagnostics.slice(1).map(d=><details key={d.headline}><summary>{d.headline} · {d.asOf??"unavailable"}</summary><p>{d.interpretation}</p><p><strong>Next test:</strong> {d.nextTest}</p></details>)}
 <details><summary>Source-dated breadth, 1D / 3D / 5D</summary>
 {breadth.length?breadth.map(b=><p key={b.symbol}>{b.symbol} · {b.level!.toFixed(2)}% · {pp(b.change1dPp)} / {pp(b.change3dPp)} / {pp(b.change5dPp)} · {b.asOf}{b.sourceUrl?<a href={b.sourceUrl} target="_blank" rel="noreferrer"> source ↗</a>:null}</p>):<p>Recent participation readings unavailable.</p>}
 </details>
 <details><summary>Sector relative performance and benchmark affinity</summary>
 {five?.bars.length?<p>5D sector leaders: {five.bars.slice(0,3).map(b=>b.symbol+" "+b.changePercent.toFixed(2)+"%").join(", ")}. Laggards: {five.bars.slice(-3).map(b=>b.symbol+" "+b.changePercent.toFixed(2)+"%").join(", ")}.</p>:null}
 {sector?<p>XLK vs benchmarks (5D): {sector.relative.map(r=>r.id+" "+pp(r.changes[5])+" @ "+(r.asOf??"unavailable")).join(" · ")}.</p>:null}
 <p>{benchmark&&best?.correlation!=null&&affinity?"XLK tracks "+benchmark.label+" most closely among measured benchmarks (20-session r="+best.correlation.toFixed(2)+", "+affinity.count+" matched intervals, "+affinity.coverage+"/4 benchmarks"+(affinity.coverage<4?", provisional":"")+(affinity.tied?", close tie":"")+") · "+affinity.asOf+".":"XLK benchmark affinity unavailable."}</p>
 </details>
 <p><Link href={blueDeskPublicHref("/blue-desk/markets?mode=compare",host)}>Full Compare matrix ↗</Link></p>
 <small>Compare participation and relative leadership with rates, credit and original catalysts before revising a thesis. Correlation is not a causal explanation or an automatic regime classification.</small>
 </section>;
}
