"use client";
import {useState} from "react";
import Link from "next/link";
import SignalTags from "./SignalTags";
import {SIGNAL_TAGS,type SignalTagId} from "@/lib/bluebelly-signal-tags";
import type {SignalRadarEntry} from "@/lib/bluebelly-signal-radar";
import s from "./RegimeSignalRadar.module.css";
export default function RegimeSignalRadar({entries}:{entries:readonly SignalRadarEntry[]}){
 const [tag,setTag]=useState<SignalTagId|"all">("all");
 const visible=entries.filter(item=>tag==="all"||item.tags.some(t=>t.id===tag));
 return <section id="signal-radar" className={s.wrap} data-signal-radar="read-only-question-leads">
  <header className={s.head}>
   <div><span>RESEARCH RADAR / SOMETHING DOESN'T ADD UP?</span>
    <h2>What is worth investigating?</h2>
    <p>Tagged anomalies and catalysts from existing source-review notes, X discovery and reviewed creator metadata.
      A tag marks a research question, not a measured mispricing or canonical Regime change.</p></div>
   <small>{entries.length} bounded leads · source and event dates below</small>
  </header>
  <div className={s.filters} role="group" aria-label="Filter market signal type">
   <button type="button" aria-pressed={tag==="all"} onClick={()=>setTag("all")}>All <small>{entries.length}</small></button>
   {SIGNAL_TAGS.map(t=><button key={t.id} type="button" aria-pressed={tag===t.id}
    title={t.question} onClick={()=>setTag(t.id)}>{t.label}
    <small>{entries.filter(item=>item.tags.some(tag=>tag.id===t.id)).length}</small></button>)}
  </div>
  <div className={s.cards} aria-live="polite">
   {visible.length?visible.map(item=><article key={item.id} className={s.card} data-radar-item={item.id}>
    <div className={s.meta}><strong>{item.topic.toUpperCase()} · {item.verification}</strong>
     <time dateTime={item.sourceAt}>Source {item.sourceAt.slice(0,10)}</time></div>
    <SignalTags tags={item.tags}/>
    <h3><Link href={item.href}>{item.title}</Link></h3>
    <p>{item.reason}</p>
    <small><b>Deciding test:</b> {item.nextTest||"Check original sources and a matched market observation."}</small>
    <div className={s.links}><Link href={item.href}>Open Regime evidence →</Link>
     <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.sourceName} ↗</a></div>
   </article>):<p className={s.empty}>No source-qualified candidates for this tag in the current bounded window. This does not prove that no such opportunity exists.</p>}
  </div>
 </section>;
}
