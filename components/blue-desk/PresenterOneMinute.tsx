"use client";
import {useState} from "react";
import Link from "next/link";
import type {buildPresenterOneMinute} from "@/lib/bluebelly-presenter-one-minute";
import s from "./PresenterOneMinute.module.css";
type Brief=ReturnType<typeof buildPresenterOneMinute>;
const why:Record<string,string>={
 "US02Y":"Front-end yield: is the expected Fed path repricing?",
 "US10Y":"Longer yields: are inflation and growth assumptions moving?",
 "USD":"Dollar: check for a time-matched FX response.",
 "DXY":"Dollar index: check trend and release timestamp.",
 "SPX":"Equities: did the reaction persist beyond the first few minutes?",
 "GOLD":"Gold: compare the move with yields and the dollar.",
 "GOOGL":"Alphabet: check reported guidance and capex versus expectations.",
 "NVDA":"NVIDIA: verify cash conversion, capex and guidance.",
};
export default function PresenterOneMinute({brief,marketsHref}:{brief:Brief;marketsHref:string}){
 const [notice,setNotice]=useState("");
 const copy=async()=>{
  try{await navigator.clipboard.writeText("BLUEBELLY · 60-SECOND PRESENTATION BRIEF\n\n"+brief.script+
   "\n\nScreen checks: "+(brief.watch.length?brief.watch.join(", "):"No instrument-specific checks verified")+
   "\nEvent source: "+(brief.eventUrl||"unavailable")+
   "\nRead at (UTC): "+brief.readAt);
   setNotice("Copied the briefing and evidence limits.");
  }catch{setNotice("Clipboard unavailable. Select the script to copy it.");}
 };
 return <section className={s.panel} data-bluebelly-presenter-one-minute="source-only" aria-label="Ready-to-present market brief">
  <div className={s.top}><div><p className={s.eyebrow}>PRESENT THIS IN 60 SECONDS · {brief.state}</p>
   <h2>What I'd say live</h2></div><button type="button" onClick={()=>void copy()}>Copy on-air brief</button></div>
  <p className={s.script}>{brief.opening} <span>{brief.evidence}</span></p>
  <div className={s.below}>
   <div><strong>What I would check next</strong><p>{brief.next}</p></div>
   <div><strong>Show these instruments</strong>
    {brief.watch.length?<ul>{brief.watch.map(t=><li key={t}><b>{t}</b> — {why[t]||"Verify the timestamped chart and transmission before asserting a reaction."}</li>)}</ul>:
      <p>No verified instrument list; do not invent a trade level.</p>}
    <Link href={marketsHref}>Open source-dated markets →</Link>
   </div>
  </div>
  <details className={s.limits}><summary>Before going live: what is still unknown?</summary>
   <p>{brief.stop}</p>
   <p>Confirmed issuer figures are not the same as an analyst-consensus beat; a scheduled event is not a released outcome.</p>
   {brief.eventUrl?<a href={brief.eventUrl} target="_blank" rel="noreferrer">Next event's primary source ↗</a>:null}
   {brief.releasedUrl?<a href={brief.releasedUrl} target="_blank" rel="noreferrer">Original earnings results ↗</a>:null}
  </details>
  <p className={s.feedback} role="status" aria-live="polite">{notice}</p>
 </section>;
}
