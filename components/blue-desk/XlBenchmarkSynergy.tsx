"use client";
import {useState} from "react";
import type {XlBenchmarkSynergy} from "@/lib/bluebelly-xl-benchmark-synergy";
import ui from "./XlBenchmarkSynergy.module.css";
const PERIODS=[1,3,5,20,60] as const;
type Period=typeof PERIODS[number];
export default function XlBenchmarkSynergyPanel({data}:{data:XlBenchmarkSynergy}){
 const [period,setPeriod]=useState<Period>(5);
 const [lookback,setLookback]=useState<20|60>(20);
 const [sort,setSort]=useState("sector");
 const rows=[...data.sectors].sort((a,b)=>{
  if(sort==="sector")return a.symbol.localeCompare(b.symbol);
  const x=a.relative.find(r=>r.id===sort)?.changes[period],y=b.relative.find(r=>r.id===sort)?.changes[period];
  return x==null?(y==null?a.symbol.localeCompare(b.symbol):1):y==null?-1:y-x||a.symbol.localeCompare(b.symbol);
 });
 return <section id="xl-benchmark-synergy" className={ui.root} data-xl-benchmark-synergy="source-matched">
 <header><div><small>SECTOR LEADERSHIP / RELATIVE PERFORMANCE</small><h2>XL sectors vs major indices</h2><p>Which sectors lead each benchmark, and which index do they move with most closely?</p></div></header>
 <div className={ui.controls}>
  <div><span>Relative performance</span><div role="group" aria-label="Relative performance window">{PERIODS.map(n=><button type="button" key={n} aria-pressed={period===n} onClick={()=>setPeriod(n)}>{n}D</button>)}</div></div>
  <div><span>Synergy lookback</span><div role="group" aria-label="Correlation lookback">{([20,60] as const).map(n=><button type="button" key={n} aria-pressed={lookback===n} onClick={()=>setLookback(n)}>{n} sessions</button>)}</div></div>
  <label>Rank relative to <select value={sort} onChange={e=>setSort(e.target.value)}><option value="sector">Sector ticker</option>{data.benchmarks.map(b=><option key={b.id} value={b.id}>{b.label}</option>)}</select></label>
 </div>
 <div className={ui.scroll}><table className={ui.table}>
  <thead><tr><th scope="col">Sector</th>{data.benchmarks.map(b=><th key={b.id} scope="col">{b.label}<small>{b.detail}</small><small>{b.asOf??"No recent data"}</small></th>)}<th scope="col">Strongest synergy<small>{lookback} daily returns</small></th></tr></thead>
  <tbody>{rows.map(s=>{
   const c=lookback===20?s.correlation20:s.correlation60;const best=c.values.find(v=>v.id===c.best);const name=data.benchmarks.find(b=>b.id===c.best)?.label;
   return <tr key={s.symbol}><th scope="row"><strong>{s.symbol}</strong><small>{s.label.replace(s.symbol,"").trim()}</small><small>{s.asOf??"Unavailable"}</small></th>
   {data.benchmarks.map(b=>{
    const relative=s.relative.find(r=>r.id===b.id);
    const delta=relative?.changes[period]??null;
    const corr=c.values.find(v=>v.id===b.id)?.correlation??null;
    const strongest=c.best===b.id;
    return <td key={b.id} data-best={strongest?"true":undefined} data-direction={delta===null?"unknown":delta>0?"up":delta<0?"down":"flat"}>
     <strong>{delta===null?"—":(delta>0?"+":"")+delta.toFixed(2)+" pp"}</strong><small>{corr===null?"r —":"r "+corr.toFixed(2)}{strongest?" · BEST":""}</small>{delta!==null?<small>{relative?.asOf}</small>:null}
    </td>;
   })}
   <td><strong>{name??"—"}</strong><small>{best?.correlation!=null?"r "+best.correlation.toFixed(2)+(c.tied?" · close tie":""):c.count<lookback?"Insufficient history":"No positive comparable ranking"}</small><small>{c.count}/{lookback} matched · {c.asOf??"—"}</small><small>{c.coverage}/4 benchmarks{c.coverage<4&&best?" · provisional":""}</small></td>
   </tr>;
  })}</tbody>
 </table></div>
 <p className={ui.note}>Relative return = sector price return minus benchmark price return, in percentage points over identical sessions. Synergy = Pearson correlation of daily returns (−1 to +1), not relative strength or causation. Highest positive correlation is highlighted among at least two benchmarks on the same sample; rankings with fewer than four are labelled provisional. Relative returns use each pair’s latest shared fresh session, shown in the cell. Within 0.02 of the runner-up is a close tie. Missing or mismatched observations remain unavailable. Cash index and ETF proxies are identified above.</p>
 </section>;
}
