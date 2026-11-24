import type {PublicMarketObservation} from "@/lib/blue-desk-public-markets";
import {buildMarketDivergenceWatch} from "@/lib/bluebelly-market-divergence-watch";
import {selectMeasuredMarketSignals} from "@/lib/bluebelly-measured-market-signals";
import SignalTags from "./SignalTags";
import type {MarketChangeWindow} from "@/lib/blue-desk-market-filters";
import type {RadarRead,RadarLead,RadarCheck} from "@/lib/bluebelly-divergence-radar";
import css from "./MarketDivergenceWatch.module.css";

const number=(value:number|null,unit:string)=>value===null?"—":`${value>0?"+":""}${value.toFixed(2)} ${unit}`;
const direction=(n:number|null)=>n===null?"unknown":n>0?"up":n<0?"down":"flat";
const pairKeys:Record<string,string>={"semis-vs-nasdaq":"chips","financials-vs-tech":"financial-tech","equal-vs-cap":"broad","software-vs-chips":"software","energy-vs-consumer":"energy-consumer"};
const leadKey=(r:RadarLead)=>r.kind==="CORRELATION"?r.id.replace(/-corr$/,""):r.id;
type Metric=RadarLead["metrics"][number];
const keyMetrics=["Latest 5","Prior 5","5-session acceleration","Acceleration","Prior 20D correlation","Latest 20D correlation","Correlation change"];
function MetricGrid({metrics}:{metrics:Metric[]}){
 if(!metrics.length)return null;
 return <div className={css.readings} style={{gridTemplateColumns:"repeat(auto-fit,minmax(min(115px,100%),1fr))"}}>
  {metrics.map(m=><div key={m.label}><small>{m.label}</small><strong data-direction={m.unit==="r"?"flat":direction(m.value)}>{number(m.value,m.unit)}</strong></div>)}
 </div>;
}
function ThreeValues({leftLabel,rightLabel,left,right,gap,window}:{leftLabel:string;rightLabel:string;left:number|null;right:number|null;gap:number|null;window:MarketChangeWindow}){
 return <div className={css.readings}>
  <div><small>{leftLabel} · {window}</small><strong data-direction={direction(left)}>{number(left,"%")}</strong></div>
  <div><small>{rightLabel} · {window}</small><strong data-direction={direction(right)}>{number(right,"%")}</strong></div>
  <div><small>Return gap</small><strong data-direction={direction(gap)}>{number(gap,"pp")}</strong></div>
 </div>;
}
function CheckEvidence({check,leads,window,showPair=true}:{check:RadarCheck;leads:RadarLead[];window:MarketChangeWindow;showPair?:boolean}){
 const w=check.windows.find(x=>x.window===window);
 const isPair=!!check.leftLabel&&!!check.rightLabel;
 const chosen=window==="1D"?"1 session":window==="3D"?"3 sessions":"Latest 5";
 const primary=isPair?check.metrics.filter(m=>keyMetrics.includes(m.label)):
  check.metrics.filter(m=>[chosen,"Level","Spread","Spread level",...keyMetrics,"2Y latest 5","30Y latest 5","SPY latest 5"].includes(m.label));
 const extra=check.metrics.filter(m=>!primary.some(p=>p.label===m.label));
 return <>
  {showPair&&isPair?<ThreeValues leftLabel={check.leftLabel!} rightLabel={check.rightLabel!} left={w?.left??null} right={w?.right??null} gap={w?.gap??null} window={window}/>:null}
  {isPair&&!w?<p>{window} matched return unavailable; no substitute inferred.</p>:null}
  {!check.historyAvailable?<p>Historical acceleration unavailable: insufficient matched observations.</p>:null}
  <MetricGrid metrics={primary}/>
  {leads.map(r=><p key={r.id} data-divergence-lead={r.id}>{r.summary}</p>)}
  <p><small>Source session {check.asOf??"unavailable"} · {leads.length?"Research lead":"No screening threshold met"}</small></p>
  <details><summary>Full historical metrics, chart &amp; next test</summary>
   <MetricGrid metrics={extra}/>
   <p><b>{check.chart}</b> — {check.nextTest}</p>
   {leads.filter(r=>r.kind==="CORRELATION").map(r=><p key={r.id}>{r.nextTest}</p>)}
   <div className={css.sources}>{check.sources.map((s,i)=><a key={i} href={s.url} target="_blank" rel="noreferrer">{s.label} ↗</a>)}</div>
  </details>
 </>;
}
export default function MarketDivergenceWatch({observations,window,windowHrefs,radar}:{
 observations:PublicMarketObservation[];window:MarketChangeWindow;windowHrefs:Record<MarketChangeWindow,string>;radar?:RadarRead|null;
}){
 const reads=buildMarketDivergenceWatch(observations,window);
 const measured=reads.filter(r=>r.status!=="NOT_COMPARABLE");
 const qualified=selectMeasuredMarketSignals(reads,window,new Date(),5);
 const qualifiedById=new Map(qualified.map(read=>[read.id,read]));
 const missing=reads.filter(r=>r.status==="NOT_COMPARABLE");
 const leads=radar?.leads??[],checks=radar?.checks??[];
 const groups=new Map<string,RadarLead[]>();
 for(const lead of leads){const k=leadKey(lead);groups.set(k,[...(groups.get(k)??[]),lead]);}
 const attached=new Set(measured.map(r=>pairKeys[r.id]).filter(Boolean));
 const rank=(key:string)=>{const i=leads.findIndex(r=>leadKey(r)===key);return i<0?Number.MAX_SAFE_INTEGER:i;};
 const baseline=measured.map(read=>{
  const check=checks.find(c=>c.id===pairKeys[read.id]);
  const matching=check?.windows.find(w=>w.window===window);
  // Keep original pair values, and show independent history only with its own date.
  const same=!!matching&&matching.asOf===read.sourceSession&&Math.abs(matching.left-(read.leftChange??Infinity))<0.02&&Math.abs(matching.right-(read.rightChange??Infinity))<0.02;
  return {key:"pair:"+read.id,rank:rank(pairKeys[read.id]),card:<article key={read.id} className={css.card} data-status={read.status}>
   {qualifiedById.has(read.id)?<SignalTags tags={[qualifiedById.get(read.id)!.tag]}/>:null}
   <span className={css.tag}>{read.status==="OPPOSITE_MOVE"?"Opposite directions":"Relative performance"}</span>
   <h3>{read.title}</h3><p>{read.question}</p>
   <ThreeValues leftLabel={read.left} rightLabel={read.right} left={read.leftChange} right={read.rightChange} gap={read.gapPp} window={window}/>
   <p><small>Matched session {read.sourceSession}</small></p>
   {check?<CheckEvidence check={check} leads={groups.get(check.id)??[]} window={window} showPair={!same}/>:<details><summary>What should we check next?</summary><p>{read.nextTest}</p>
    <div className={css.sources}>
     {read.leftSourceUrl?<a href={read.leftSourceUrl} target="_blank" rel="noreferrer">{read.left} original data</a>:null}
     {read.rightSourceUrl?<a href={read.rightSourceUrl} target="_blank" rel="noreferrer">{read.right} original data</a>:null}
    </div></details>}
  </article>};
 });
 const additional=checks.filter(c=>!attached.has(c.id)&&(c.historyAvailable||c.windows.some(w=>w.window===window))).map(check=>({key:"check:"+check.id,rank:rank(check.id),card:<article key={check.id} className={css.card} data-status={groups.has(check.id)?"RESEARCH_LEAD":"OBSERVED"}>
  <span className={css.tag}>{check.family} · {groups.has(check.id)?"Research lead":"Observed comparison"}</span>
  <h3>{check.title}</h3>
  <CheckEvidence check={check} leads={groups.get(check.id)??[]} window={window}/>
 </article>}));
 const active=[...baseline,...additional.filter(c=>c.rank!==Number.MAX_SAFE_INTEGER)].sort((a,b)=>a.rank-b.rank);
 const quiet=additional.filter(c=>c.rank===Number.MAX_SAFE_INTEGER);
 const queue=leads.filter((r,i)=>leads.findIndex(x=>x.chart===r.chart)===i).slice(0,6);
 return <section id="divergence-watch" data-market-divergence-watch="read-only" aria-labelledby="divergence-watch-heading">
  <span id="divergence-radar" aria-hidden="true"/>
  <p className={css.intro}>Compare observed market relationships before assigning a cause. Ranked divergences appear first; a return gap by itself does not prove that a historical relationship has broken.</p>
  <nav className={css.windows} aria-label="Divergence comparison window">
   <span className={css.tag}>Source sessions</span>
   {(["1D","3D","5D"] as const).map(w=><a key={w} href={windowHrefs[w]} aria-current={window===w?"page":undefined}>{w}</a>)}
  </nav>
  <p className={css.intro}>{active.length} displayed relationships · {quiet.length} additional measured relationships · <strong>{leads.length} research leads</strong>{radar?` · ${radar.coverage.eligible}/${radar.coverage.checked} history checks available`:""}. One relationship can generate multiple leads.</p>
  {active.length?<div className={css.grid}>{active.map(x=>x.card)}</div>:<p className={css.empty}>No ranked comparisons available from current observations.</p>}
  {quiet.length?<details className={css.missingDisclosure}><summary>Other measured relationships ({quiet.length}) · below screening thresholds</summary><div className={css.grid}>{quiet.map(x=>x.card)}</div></details>:null}
  {queue.length?<details className={css.missingDisclosure}><summary>Prioritised chart queue</summary><ol>{queue.map(r=><li key={r.id}><b>{r.chart}</b> — {r.nextTest}</li>)}</ol></details>:null}
  {missing.length||radar?.coverage.missing.length?<details className={css.missingDisclosure}><summary>Data coverage &amp; unavailable comparisons</summary><ul>{missing.map(r=><li key={r.id}><strong>{r.title}</strong> — {r.reason}</li>)}{radar?.coverage.missing.map((s,i)=><li key={"history:"+i}>{s}</li>)}</ul></details>:null}
  {radar?<details className={css.missingDisclosure}><summary>Method and limitations</summary><ul>{radar.limitations.map(s=><li key={s}>{s}</li>)}</ul></details>:null}
  <p className={css.foot}>Research watch only. Same-session ETF price returns are not adjusted total returns. Historical metrics use their own dated sessions, independent of the selected comparison window. No automatic Regime/Dossier changes, statistical significance claim, or trading signal.</p>
 </section>;
}
