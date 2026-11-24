import type {PublicMarketObservation} from "@/lib/blue-desk-public-markets";
import {buildMarketDivergenceWatch} from "@/lib/bluebelly-market-divergence-watch";
import {selectMeasuredMarketSignals} from "@/lib/bluebelly-measured-market-signals";
import SignalTags from "./SignalTags";
import type {MarketChangeWindow} from "@/lib/blue-desk-market-filters";
import type {RadarRead,RadarLead} from "@/lib/bluebelly-divergence-radar";
import css from "./MarketDivergenceWatch.module.css";

const number=(value:number|null,unit:string)=>value===null?"—":`${value>0?"+":""}${value.toFixed(2)} ${unit}`;
const direction=(n:number|null)=>n===null?"unknown":n>0?"up":n<0?"down":"flat";
// Exact relationships only; never merge a different proxy or benchmark by similar title.
const pairKeys:Record<string,string>={"semis-vs-nasdaq":"chips","financials-vs-tech":"financial-tech","equal-vs-cap":"broad","software-vs-chips":"software"};
const leadKey=(r:RadarLead)=>r.kind==="CORRELATION"?r.id.replace(/-corr$/,""):r.id;
function LeadEvidence({lead}:{lead:RadarLead}){
 return <div data-divergence-lead={lead.id}>
  <p><strong>{lead.kind==="CORRELATION"?"Correlation shift":lead.kind==="BREADTH"?"Breadth change":lead.kind==="CREDIT"?"Credit spreads":lead.kind==="RATES"?"Yield curve":"Relative leadership"}:</strong> {lead.summary}</p>
  <p><small>History through {lead.asOf} · research lead, not a trade signal</small></p>
  <details><summary>Historical metrics, chart &amp; next test</summary>
   <div className={css.readings} style={{gridTemplateColumns:"repeat(auto-fit,minmax(100px,1fr))"}}>{lead.metrics.map(m=><div key={m.label}><small>{m.label}</small><strong>{number(m.value,m.unit)}</strong></div>)}</div>
   <p><b>{lead.chart}</b> — {lead.nextTest}</p>
   <div className={css.sources}>{lead.sources.map((s,i)=><a key={i} href={s.url} target="_blank" rel="noreferrer">{s.label} ↗</a>)}</div>
  </details>
 </div>;
}
export default function MarketDivergenceWatch({observations,window,windowHrefs,radar}:{
 observations:PublicMarketObservation[];window:MarketChangeWindow;windowHrefs:Record<MarketChangeWindow,string>;radar?:RadarRead|null;
}){
 const reads=buildMarketDivergenceWatch(observations,window);
 const measured=reads.filter(r=>r.status!=="NOT_COMPARABLE");
 const qualified=selectMeasuredMarketSignals(reads,window,new Date(),5);
 const qualifiedById=new Map(qualified.map(read=>[read.id,read]));
 const missing=reads.filter(r=>r.status==="NOT_COMPARABLE");
 const leads=radar?.leads??[];
 const groups=new Map<string,RadarLead[]>();
 for(const lead of leads){const k=leadKey(lead);groups.set(k,[...(groups.get(k)??[]),lead]);}
 const attached=new Set(measured.map(r=>pairKeys[r.id]).filter(Boolean));
 const rank=(key:string)=>{const i=leads.findIndex(r=>leadKey(r)===key);return i<0?Number.MAX_SAFE_INTEGER:i;};
 const baseline=measured.map(read=>({key:"pair:"+read.id,rank:rank(pairKeys[read.id]),card:<article key={read.id} className={css.card} data-status={read.status}>
  {qualifiedById.has(read.id)?<SignalTags tags={[qualifiedById.get(read.id)!.tag]}/>:null}
  <span className={css.tag}>{read.status==="OPPOSITE_MOVE"?"Opposite directions":"Relative performance"}</span>
  <h3>{read.title}</h3><p>{read.question}</p>
  <div className={css.readings}>
   <div><small>{read.left} · {window}</small><strong data-direction={direction(read.leftChange)}>{number(read.leftChange,"%")}</strong></div>
   <div><small>{read.right} · {window}</small><strong data-direction={direction(read.rightChange)}>{number(read.rightChange,"%")}</strong></div>
   <div><small>{read.left} − {read.right}</small><strong>{number(read.gapPp,"pp")}</strong></div>
  </div>
  <p>{read.reason??`Both observations end ${read.sourceSession}. This is a measured price-return difference, not a verified causal explanation.`}</p>
  {(groups.get(pairKeys[read.id])??[]).map(lead=><LeadEvidence key={lead.id} lead={lead}/>)}
  <details><summary>What should we check next?</summary><p>{read.nextTest}</p>
   <div className={css.sources}>
    {read.leftSourceUrl?<a href={read.leftSourceUrl} target="_blank" rel="noreferrer">{read.left} original data</a>:null}
    {read.rightSourceUrl?<a href={read.rightSourceUrl} target="_blank" rel="noreferrer">{read.right} original data</a>:null}
   </div>
  </details>
 </article>}));
 const additional=[...groups].filter(([key])=>!attached.has(key)).map(([key,items])=>({key:"lead:"+key,rank:rank(key),card:<article key={key} className={css.card} data-status="RESEARCH_LEAD">
  <span className={css.tag}>{items[0].family} · Research lead</span>
  <h3>{items[0].title.replace(/ · correlation shift$/,"")}</h3>
  {items.map(lead=><LeadEvidence key={lead.id} lead={lead}/>)}
 </article>}));
 const visible=[...baseline,...additional.slice(0,3)].sort((a,b)=>a.rank-b.rank);
 const more=additional.slice(3);
 const queue=leads.filter((r,i)=>leads.findIndex(x=>x.chart===r.chart)===i).slice(0,6);
 return <section id="divergence-watch" data-market-divergence-watch="read-only" aria-labelledby="divergence-watch-heading">
  <span id="divergence-radar" aria-hidden="true"/>
  <p className={css.intro}>Compare observed market relationships before assigning a cause. Opposite moves appear first; a return gap by itself does not prove that a historical relationship has broken.</p>
  <nav className={css.windows} aria-label="Divergence comparison window">
   <span className={css.tag}>Source sessions</span>
   {(["1D","3D","5D"] as const).map(w=><a key={w} href={windowHrefs[w]} aria-current={window===w?"page":undefined}>{w}</a>)}
  </nav>
  <p className={css.intro}>{measured.length} of {reads.length} comparisons have matched, recorded {window} percentage-return data.{radar?<> · <strong>{leads.length} research leads</strong> · {radar.coverage.eligible}/{radar.coverage.checked} history checks available.</>:null} No inferred source sessions or prices.</p>
  {visible.length?<div className={css.grid}>{visible.map(x=>x.card)}</div>:<div className={css.empty} role="status"><strong>No matched comparisons or qualified research leads available.</strong><p>This is a coverage gap, not evidence that markets are moving normally.</p></div>}
  {more.length?<details className={css.missingDisclosure}><summary>More research relationships ({more.length})</summary><div className={css.grid}>{more.map(x=>x.card)}</div></details>:null}
  {queue.length?<details className={css.missingDisclosure}><summary>Prioritised chart queue</summary><ol>{queue.map(r=><li key={r.id}><b>{r.chart}</b> — {r.nextTest}</li>)}</ol></details>:null}
  {missing.length||radar?.coverage.missing.length?<details className={css.missingDisclosure}><summary>Data coverage &amp; unavailable comparisons</summary><ul>{missing.map(r=><li key={r.id}><strong>{r.title}</strong> — {r.reason}</li>)}{radar?.coverage.missing.map((s,i)=><li key={"history:"+i}>{s}</li>)}</ul></details>:null}
  {radar?<details className={css.missingDisclosure}><summary>Method and limitations</summary><ul>{radar.limitations.map(s=><li key={s}>{s}</li>)}</ul></details>:null}
  <p className={css.foot}>Research watch only. Same-session ETF price returns are not adjusted total returns. Historical metrics use their own dated sessions, independent of the selected comparison window. No automatic Regime/Dossier changes, statistical significance claim, or trading signal.</p>
 </section>;
}
