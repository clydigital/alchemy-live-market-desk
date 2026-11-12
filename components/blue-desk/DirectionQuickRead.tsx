import Link from "next/link";
import type {DirectionQuickRead,DirectionTrend} from "@/lib/bluebelly-direction-quick-read";
import s from "./DirectionQuickRead.module.css";
import AcceleratorDial from "./AcceleratorDial";

type Props={
 question:string;summary:string;read:DirectionQuickRead;
 eyebrow?:string;meaning?:string;supportingTerm?:string;opposingTerm?:string;
 followUpHref?:string;followUpLabel?:string;
};
const WORDING:Record<DirectionTrend,string>={
 better:"IMPROVING SIGNALS",mixed:"MIXED / CONTESTED",worse:"DETERIORATING SIGNALS",unknown:"INSUFFICIENT / STALE"
};
/** Three compact, explicit evidence windows. Source-vetted observations, not a statistical probability. */
export default function DirectionQuickRead({
 question,summary,read,eyebrow="PEACE DIRECTION / SOURCE-DATED RESEARCH",
 meaning="not the probability of peace. Signals do not establish a signed agreement, safe transit, or a canonical Regime change.",
 supportingTerm="easing",opposingTerm="adverse",
 followUpHref="#shipping",followUpLabel="Check actual vessel movements",
}:Props){
 return <section className={s.wrap} id="quick-direction" aria-label={question}
   data-direction-quick-read="evidence-window-v1">
  <div className={s.heading}>
   <div><span className={s.eyebrow}>{eyebrow}</span>
    <h3>{question}</h3><p>{summary}</p></div>
   <span className={s.asOf}>SOURCED THROUGH {read.sourceDay||"UNKNOWN"} UTC{read.stale?" · STALE":""}</span>
  </div>
  <div className={s.windows} role="list" aria-label="Recent research direction">
   {read.windows.map(window=><div key={window.days} role="listitem" className={s.window}
      data-direction-window={window.label} data-direction-trend={window.trend}>
    <div className={s.top}><strong>{window.label}</strong><span className={s.dot} aria-hidden="true"/></div>
    <AcceleratorDial compact label={window.label+" evidence direction"}
     direction={window.trend==="unknown"?null:window.trend==="better"?1:window.trend==="worse"?-1:0}
     leftLabel={opposingTerm} rightLabel={supportingTerm}/>
    <span className={s.state}>{WORDING[window.trend]}</span>
    <small>{window.better} {supportingTerm} · {window.worse} {opposingTerm}{window.mixed?" · "+window.mixed+" mixed":""}</small>
    <small>{window.count} dated signal{window.count===1?"":"s"} · {window.from} to {window.to}</small>
   </div>)}
  </div>
  <details className={s.sources}>
   <summary>Which sourced developments drive this reading? <span>Open evidence</span></summary>
   {read.evidence.length?<ul>{read.evidence.slice(0,6).map(item=><li key={item.id} data-signal-direction={item.direction}>
    <span className={s.signal}>{item.direction==="better"?"EASING":item.direction==="worse"?"RISK":"MIXED"}</span>
    <div className={s.sourceContent}>
     <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.title}</a>
     {item.comparisonSourceUrl?<a className={s.comparison} href={item.comparisonSourceUrl}
       target="_blank" rel="noopener noreferrer">Comparison source ↗</a>:null}
     <small>{item.date} · {item.sourceName} · {item.limitation}</small>
    </div>
   </li>)}</ul>:<p className={s.noSource}>No admissible dated direction evidence available.</p>}
  </details>
  <p className={s.foot}>Colours describe the balance of a limited, dated set of attributed developments — {meaning}
   Both easing and deterioration in a window produce yellow. No qualifying recent item produces neutral grey.
   Windows follow source-publication days, not rolling market returns. Human-reviewed records expire to neutral when stale.
   <Link href={followUpHref}>{followUpLabel} ↓</Link></p>
 </section>;
}
