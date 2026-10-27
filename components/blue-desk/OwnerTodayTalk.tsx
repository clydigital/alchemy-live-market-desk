"use client";

import {useState} from "react";
import type {TodayTalk} from "@/lib/bluebelly-todays-talk";
import styles from "./owner-todays-talk.module.css";
import { EntityMark } from "./EntityIdentity";
import { entityForAsset } from "@/lib/bluebelly-entity-identity";

/**
 * Display a server-selected read-only packet. Only the explicit Copy action
 * touches the clipboard. There is no publication or canonical mutation path.
 */
export default function OwnerTodayTalk({brief}:{brief:TodayTalk}){
 const [copyState,setCopyState]=useState("");
 async function copyBrief(){
  try{await navigator.clipboard.writeText(brief.readAloud);setCopyState("Copied for rehearsal");}
  catch{setCopyState("Clipboard unavailable; select the script below.");}
 }
 return <section id="todays-talk" className={styles.wrap} data-todays-talk="source-ranked-read-only">
  <header className={styles.head}>
   <div>
    <p className={styles.kicker}>TODAY'S TALK V2 / READ-ONLY SOURCE BRIEF</p>
    <h2>What can I actually say on air?</h2>
    <p>Verified reporting first. Canonical macro interpretation second.
     Completed-session market prices separately. None proves an event-driven price reaction.</p>
   </div>
   <div className={styles.actions}>
    <a href="#technical-checks">Review 14 chart checks</a>
    <button type="button" onClick={copyBrief}>Copy running order</button>
    <span role="status" aria-live="polite">{copyState}</span>
   </div>
  </header>
  <p className={styles.provenance}>Generated from currently eligible saved sources at <time dateTime={brief.asOf}>{brief.asOf}</time>.
   {" "}Coverage: {brief.coverage.replaceAll("_"," ").toLowerCase()}.</p>
  <div className={styles.columns}>
   <div>
    <section className={styles.panel} aria-labelledby="today-news-title">
     <p className={styles.kicker}>01 · VERIFIED SOURCE REPORTING</p>
     <h3 id="today-news-title">What actually changed?</h3>
     {brief.news.length?<ol className={styles.stories}>
      {brief.news.map(item=><li key={item.id}>
       <p className={styles.priority}>{item.priority==="LEAD"?"Lead candidate":"Secondary watch"} · Event <time dateTime={item.occurredAt}>{item.occurredAt}</time></p>
       <h4>{item.headline}</h4>
       <p>{item.summary}</p>
       <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
        {item.sourceName} · original report</a>
       <p className={styles.caveat}>Source-verified news; not an accepted canonical Story or a measured price reaction.</p>
      </li>)}
     </ol>:<p className={styles.empty}>No source-qualified developments in the current 48-hour window.
      No synthetic or older headline is inserted as today's lead.</p>}
    </section>
    <section className={styles.panel} aria-labelledby="today-dossier-title">
     <p className={styles.kicker}>02 · CANONICAL MACRO INTERPRETATION</p>
     <h3 id="today-dossier-title">Does the broad thesis still hold?</h3>
     {brief.dossier.status==="CURRENT_HEALTHY"?<>
      <h4>{brief.dossier.headline}</h4><p>{brief.dossier.answer}</p>
      {brief.dossier.whatWouldChangeMind?<p><strong>What would change the view:</strong> {brief.dossier.whatWouldChangeMind}</p>:null}
      <p className={styles.caveat}>Immutable Dossier {brief.dossier.dossierId} · as of {brief.dossier.asOf}.
       Evidence UUIDs: {brief.dossier.evidenceRefs.join(", ")}.
       Macro context is not verification of an instrument's EMA or chart pattern.</p>
     </>:<p className={styles.empty}>{brief.dossier.reason} No old healthy Dossier is passed off as current.</p>}
    </section>
   </div>
   <div>
    <section className={styles.panel} aria-labelledby="today-prices-title">
     <p className={styles.kicker}>03 · DATED MARKET OBSERVATIONS</p>
     <h3 id="today-prices-title">What did the completed sessions show?</h3>
     <p className={styles.caveat}>These are standalone daily source comparisons, not
       event-timed reactions or independently verified technical breakouts.</p>
     {brief.prices.length?<div className={styles.scroller}>
      <table className={styles.prices}>
       <thead><tr><th scope="col">Asset / source</th><th scope="col">Latest level</th>
        <th scope="col">1 / 3 / 5 sessions</th></tr></thead>
       <tbody>{brief.prices.map(p=><tr key={p.id}>
        <td><EntityMark kind={(entityForAsset(p.symbol)||{kind:"asset",code:p.symbol}).kind} code={(entityForAsset(p.symbol)||{kind:"asset",code:p.symbol}).code} size="xs" /> <strong>{p.label}</strong><small>{p.status} · {p.asOf||"No valid date"}</small>
         {p.sourceUrl?<a href={p.sourceUrl} rel="noopener noreferrer" target="_blank">{p.sourceName}</a>:<small>{p.sourceName}</small>}
        </td>
        <td>{p.level}</td>
        <td>{p.windows.map(w=><small key={w.sessions}>{w.sessions}: {w.text}</small>)}</td>
       </tr>)}</tbody>
      </table>
     </div>:<p className={styles.empty}>No trustworthy completed-session observations are available.</p>}
    </section>
    <section className={styles.panel} aria-labelledby="today-next-title">
     <p className={styles.kicker}>04 · ON-AIR NEXT TESTS</p>
     <h3 id="today-next-title">What would settle it?</h3>
     <ol className={styles.tests}>{brief.questions.map((q,i)=><li key={i}>{q}</li>)}</ol>
    </section>
   </div>
  </div>
  <details className={styles.script}>
   <summary>Read-aloud running order and exact source references</summary>
   <pre>{brief.readAloud}</pre>
  </details>
 </section>;
}
