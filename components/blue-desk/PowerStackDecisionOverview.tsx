import "server-only";
import Link from "next/link";
import {marketInternalsDiagnostics,type CompareResearch} from "@/lib/bluebelly-compare-research";
import type {PublicMarketObservation} from "@/lib/blue-desk-public-markets";
import styles from "@/app/power-stack/private-power-stack.module.css";

const pct=(v:number|null)=>v===null?"Unavailable":(v>0?"+":"")+v.toFixed(2)+"%";
const pp=(v:number|null)=>v===null?"—":(v>0?"+":"")+v.toFixed(2)+" pp";
const record="https://app.notion.com/p/423519b67a9481329abac98e3c97297c";
/** Manual decision surface, not another scoring engine. Reuse the same Compare
 * inputs; never score market conditions from incomplete evidence or re-label a
 * previous manual judgment as current. No write or background collection. */
export default function PowerStackDecisionOverview({compare,tape,now,breadthStatus}:{compare:CompareResearch;tape:readonly PublicMarketObservation[];now:Date;breadthStatus:string}){
 const diagnostics=marketInternalsDiagnostics(compare);
 const windows=compare.rotation;
 const five=windows.find(r=>r.window==="5D");
 const sectorSession=five?.asOf??null;
 const bench=compare.benchmark;
 const rel=(symbol:string,id:string,window:1|3|5)=>{const r=bench.sectors.find(s=>s.symbol===symbol)?.relative.find(x=>x.id===id);return r?.asOf===sectorSession?r.changes[window]:null};
 const observed=tape.filter(r=>r.asOf&&r.last!==null&&r.sourceUrl&&r.dataStatus!=="UNAVAILABLE_OR_STALE"&&Number.isFinite(Date.parse(r.asOf))&&+now-Date.parse(r.asOf)>=0&&+now-Date.parse(r.asOf)<=6*86400000);
 const macroIds=["us2y","us10y-fred","us30y-fred","us10y-real","ig-oas","hy-oas","ccc-oas","dxy","vix","sgov"];
 const macro=macroIds.flatMap(id=>{const r=observed.find(x=>x.id===id);return r?[r]:[]});
 const leadership=five?.coverage===11?five.advancing>=8?"Broad positive sector tape":five.advancing<=3?"Broad negative sector tape":"Mixed sector tape":"Insufficient matched sector coverage";
 return <>
 <section className={styles.section} id="power-stack-macro-watch" data-ps-decision-section="macro">
  <h2>01 / Is it a good time to buy? (Macros)</h2>
  <p><strong>CURRENT: UNASSESSED · score unavailable</strong> — manual review required. An incomplete research packet is not a neutral score.</p>
  <div role="img" aria-label="Buy conditions scale, no current score. Previous provisional manual judgment 5 of 10." style={{position:"relative",height:12,background:"linear-gradient(90deg,#9a4545,#be9b62,#4b9870)",borderRadius:8,margin:"18px 0"}}><span aria-hidden="true" style={{position:"absolute",left:"50%",top:-5,height:22,width:2,background:"#fff"}}/></div>
  <p>0–2 avoid · &gt;2–4 lean wait · &gt;4–6 neutral · &gt;6–8 lean buy · &gt;8–10 favourable. White marker = previous manual assessment only.</p>
  <p>Last recorded private manual assessment: <strong>5/10 neutral, low confidence, 26 Nov 2026 MYT</strong>. This is a dated analyst judgment, not a calibrated probability or a comparable measured prior. No automatic update; change unavailable. <a href={record}>Private decision history ↗</a></p>
  <p>Cash and short bills retain optionality but waiting can miss upside. Until current jobs, inflation, recession, credit, valuation, earnings and matched breadth are reviewed together, assess each proposed tranche against cash yield and downside; no system-directed allocation change.</p>
  <details><summary>Dated macro evidence and next checks</summary>{macro.length?macro.map(r=><p key={r.id}>{r.label} · {r.last?.toLocaleString()} · {r.asOf} · 1D {r.change===null?"—":r.change+" "+r.changeUnit} · <a href={r.sourceUrl!}>source</a></p>):<p>No eligible macro tape rows.</p>}<p>Read <Link href="/regime-watch/recession">employment, real activity and recession</Link>, <Link href="/regime-watch/fed">inflation / Fed</Link>, <Link href="/regime-watch/bonds">credit and cost of capital</Link>, <Link href="/calendar">upcoming catalysts</Link>, and <Link href="/industry-intel">issuer and earnings changes</Link>. Historical seasonality requires a validated sample; no holiday buy signal is inferred.</p></details>
 </section>
 <section className={styles.section} id="power-stack-rotation-watch" data-ps-decision-section="rotation">
  <h2>02 / Risk-on, risk-off or mixed rotation?</h2><p>{leadership}. {sectorSession??"Session unavailable"}. This describes measured sector direction, not a macro risk-on/off verdict.</p>
  <p>{windows.map(w=>w.window+": "+w.coverage+"/11 · "+(w.asOf??"unavailable")).join(" | ")} · Breadth retrieval: {breadthStatus}.</p>
  <div className={styles.tableScroll}><table className={styles.holdingsTable}><thead><tr><th>XL sector</th><th>1D</th><th>3D</th><th>5D</th><th>5D vs SPX / RSP / NDX / Dow</th></tr></thead><tbody>{bench.sectors.map(s=><tr key={s.symbol}><td>{s.symbol}</td>{windows.map(w=><td key={w.window}>{pct(w.bars.find(b=>b.symbol===s.symbol)?.changePercent??null)}</td>)}<td>{["spx","rsp","ndx","dow"].map(id=>pp(rel(s.symbol,id,5))).join(" / ")}</td></tr>)}</tbody></table></div>
  {diagnostics.map(d=><details key={d.headline}><summary>{d.headline} · {d.asOf??"unavailable"}</summary><p>{d.interpretation}</p><p>{d.nextTest}</p>{d.sourceUrls.slice(0,4).map((url,i)=><p key={url}><a href={url}>Source {i+1}</a></p>)}</details>)}
  <Link href="/markets?mode=compare">Full matched 1D/3D/5D benchmark and breadth matrix →</Link>
 </section>
 <section className={styles.section} id="power-stack-divergence-watch" data-ps-decision-section="divergence">
  <h2>03 / Major divergences</h2><p>{compare.radar.coverage.eligible}/{compare.radar.coverage.checked} checks eligible · {compare.radar.leads.length} qualified research leads. Missing is not normal.</p>
  {compare.radar.leads.length?compare.radar.leads.map(r=><details key={r.id}><summary>{r.title} · {r.asOf}</summary><p>{r.summary}</p><p>{r.metrics.map(m=>m.label+" "+m.value+" "+m.unit).join(" · ")}</p><p><strong>Resolution / confirmation:</strong> {r.nextTest}</p>{r.sources.map((source,i)=><p key={source.url+"-"+i}><a href={source.url}>{source.label}</a></p>)}</details>):<p>No qualifying lead in available data; no conclusion about absent series.</p>}
  <details><summary>Missing comparisons ({compare.radar.coverage.missing.length})</summary>{compare.radar.coverage.missing.map((m,i)=><p key={i}>{m}</p>)}</details>
  <Link href="/markets?mode=watch#divergence-radar">Open BB divergence evidence →</Link>
 </section>
 </>;
}
