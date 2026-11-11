import Link from "next/link";
import type {DirectionQuickRead,DirectionTrend} from "@/lib/bluebelly-direction-quick-read";
import s from "./DirectionQuickRead.module.css";

type Props={question:string;summary:string;read:DirectionQuickRead;};
const WORDING:Record<DirectionTrend,string>={
 better:"IMPROVING SIGNALS",mixed:"MIXED / CONTESTED",worse:"DETERIORATING SIGNALS",unknown:"INSUFFICIENT / STALE"
};
/** Three compact, explicit evidence windows. Not an automatically updated geopolitical forecast. */
export default function DirectionQuickRead({question,summary,read}:Props){
 return <section className={s.wrap} aria-label={question} data-direction-quick-read="evidence-window-v1">
  <div className={s.heading}>
   <div><span className={s.eyebrow}>PEACE DIRECTION / SOURCE-DATED RESEARCH</span>
    <h3>{question}</h3><p>{summary}</p></div>
   <span className={s.asOf}>SOURCED THROUGH {read.sourceDay||"UNKNOWN"} UTC{read.stale?" · STALE":""}</span>
  </div>
  <div className={s.windows} role="list" aria-label="Recent diplomatic direction">
   {read.windows.map(window=><div key={window.days} role="listitem" className={s.window}
      data-direction-window={window.label} data-direction-trend={window.trend}>
    <div className={s.top}><strong>{window.label}</strong><span className={s.dot} aria-hidden="true"/></div>
    <span className={s.state}>{WORDING[window.trend]}</span>
    <small>{window.count} dated signal{window.count===1?"":"s"} · {window.from} to {window.to}</small>
   </div>)}
  </div>
  <details className={s.sources}>
   <summary>Which sourced developments drive this reading? <span>Open evidence</span></summary>
   <ul>{read.evidence.slice(0,5).map(item=><li key={item.id} data-signal-direction={item.direction}>
    <span className={s.signal}>{item.direction==="better"?"EASING":item.direction==="worse"?"RISK":"MIXED"}</span>
    <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.title}</a>
    <small>{item.date} · {item.sourceName} · {item.limitation}</small>
   </li>)}</ul>
  </details>
  <p className={s.foot}>Colours describe the balance of a limited, dated set of attributed developments — not the probability of peace.
   Both easing and deterioration in a window produce yellow. No admissible recent item produces neutral grey.
   Signals do not establish a signed agreement, safe transit, or a canonical Regime change.
   <Link href="#shipping"> Check actual vessel movements ↓</Link></p>
 </section>;
}
