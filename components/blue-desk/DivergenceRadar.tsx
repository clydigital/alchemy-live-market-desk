import type {RadarRead} from "@/lib/bluebelly-divergence-radar";
import css from "./MarketDivergenceWatch.module.css";
const fmt=(v:number,unit:string)=>`${v>0&&unit!=="%"?"+":""}${v.toFixed(2)} ${unit}`;
export default function DivergenceRadar({read,compact=false,href="/markets?mode=compare#divergence-radar"}:{read:RadarRead;compact?:boolean;href?:string}){
 const leads=read.leads.slice(0,compact?3:6),remaining=read.leads.slice(6);
 const card=(r:RadarRead["leads"][number])=><article key={r.id} className={css.card} data-divergence-lead={r.id}>
  <span className={css.tag}>{r.family} · {r.kind==="BREADTH"?"Breadth":r.kind==="CORRELATION"?"Correlation":"Relative return"}</span>
  <h3>{r.title}</h3><p>{r.summary}</p>
  <div className={css.readings}>{r.metrics.map(m=><div key={m.label}><small>{m.label}</small><strong>{fmt(m.value,m.unit)}</strong></div>)}</div>
  <p><small>Observed {r.asOf} · research lead, not a trade signal</small></p>
  <details><summary>Chart &amp; what to check next</summary><p><b>{r.chart}</b></p><p>{r.nextTest}</p>
   <div className={css.sources}>{r.sources.map((s,i)=><a key={i} href={s.url} target="_blank" rel="noreferrer">{s.label} ↗</a>)}</div>
  </details>
 </article>;
 return <section id="divergence-radar" data-divergence-radar="matched-session-v2" aria-label="Divergence radar" className={css.card}>
  <span className={css.tag}>RESEARCH RADAR · ranked by screening thresholds</span>
  <h2>What is changing beneath the market?</h2>
  <p>{read.coverage.eligible}/{read.coverage.checked} primary checks have sufficient dated history. {read.leads.length} leads passed screening. No inference from missing prices.</p>
  {leads.length?<div className={css.grid}>{leads.map(card)}</div>:<p role="status">No qualified leads on available observations. This is not evidence that all markets are normal.</p>}
  {compact?<p><a href={href}>Open full divergence radar &amp; chart queue →</a></p>:<>
    {remaining.length?<details><summary>Other qualified leads ({remaining.length})</summary><div className={css.grid}>{remaining.map(card)}</div></details>:null}
    {read.leads.length?<details><summary>Prioritised chart queue</summary><ol>{[...new Map(read.leads.map(r=>[r.chart,r])).values()].slice(0,6).map(r=><li key={r.id}><b>{r.chart}</b> — {r.nextTest}</li>)}</ol></details>:null}
    {read.coverage.missing.length?<details><summary>Data and history gaps ({read.coverage.missing.length})</summary><ul>{read.coverage.missing.map(s=><li key={s}>{s}</li>)}</ul></details>:null}
    <details><summary>Method and limitations</summary><ul>{read.limitations.map(s=><li key={s}>{s}</li>)}</ul></details>
  </>}
 </section>;
}
