"use client";

import { useEffect,useState } from "react";
import type { InvestigationMode,InvestigationResult } from "@/lib/editorial-investigation";
import styles from "./editorial-studio.module.css";

export default function InvestigationWorkbench({
 initialQuestion,packet,selectedAssetId,onUse,
}:{
 initialQuestion:string;packet:string;selectedAssetId:string|null;
 onUse:(result:InvestigationResult|null)=>void;
}){
 const [mode,setMode]=useState<InvestigationMode>("IMPACT");
 const [question,setQuestion]=useState(initialQuestion);
 const [eventAt,setEventAt]=useState("");
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState("");
 const [result,setResult]=useState<InvestigationResult|null>(null);
 const [used,setUsed]=useState(false);
 useEffect(()=>{setQuestion(initialQuestion);setResult(null);setUsed(false);onUse(null);
 // Reset researched conclusions when a new article idea is selected.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[initialQuestion]);
 useEffect(()=>{setResult(null);setUsed(false);onUse(null);
 // Any substantive change to the article packet invalidates prior research.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[packet]);
 async function investigate(){
  if(busy)return;
  setError("");setResult(null);setUsed(false);onUse(null);setBusy(true);
  try{
   const res=await fetch("/api/owner/editorial-investigate",{
    method:"POST",credentials:"same-origin",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({mode,question,packet:packet.slice(0,12_800),selectedAssetId,eventAt}),
   });
   const data=await res.json() as InvestigationResult&{error?:string};
   if(!res.ok||data.status!=="RESEARCH_LEADS_UNVERIFIED")throw Error(data.error||"Research unavailable");
   setResult(data);
  }catch(e){setError(e instanceof Error?e.message:"Research unavailable");}
  finally{setBusy(false)}
 }
 function useForDraft(){
  if(!result)return;
  onUse(result);setUsed(true);
 }
 return <section className={styles.panel} aria-label="Research investigation"
   data-owner-investigation="research-leads-only">
  <header className={styles.panelHead}>
   <h2>Investigate the market question</h2>
   <small>Manual · Google Search grounding · noncanonical</small>
  </header>
  <p className={styles.help}>Ask a fresh question before writing. This searches beyond the saved
   Dossier packet, challenges the explanation and identifies missing market measurements.
   Results are <strong>research leads, not independently verified Evidence</strong>.
   This explicit action may incur Gemini grounding usage charges.</p>
  <div className={styles.kind} role="group" aria-label="Investigation output">
   {(["IMPACT","COTD","OB"] as const).map(value=>
    <button key={value} type="button" aria-pressed={mode===value}
      onClick={()=>{setMode(value);setResult(null);setUsed(false);onUse(null)}}>
      {value==="IMPACT"?"Immediate impact":value==="COTD"?"Chart-led COTD":"Opening Bell"}
    </button>)}
  </div>
  <label className={styles.field}><span>Deciding market question</span>
   <textarea value={question} maxLength={850} rows={2}
    onChange={e=>{setQuestion(e.target.value);setResult(null);setUsed(false);onUse(null)}}
    placeholder="Why are Treasury yields falling while oil rises? What would disprove a flight to safety?"/>
  </label>
  <label className={styles.field}><span>Original event timestamp (optional, include timezone)</span>
   <input type="text" maxLength={40} value={eventAt}
    placeholder="2026-10-21T08:30:00-04:00"
    onChange={e=>{setEventAt(e.target.value);setResult(null);setUsed(false);onUse(null)}}/>
   <small>Example uses a timezone offset. This is a research locator,
     not a verified event clock. An omitted time leaves event-window returns UNKNOWN.</small>
  </label>
  <div className={styles.actions}>
   <button type="button" disabled={busy||question.trim().length<12||packet.trim().length<100}
     onClick={investigate}>{busy?"Researching original sources…":"Investigate sources and countercase"}</button>
  </div>
  {error?<p role="alert" className={styles.investigationWarning}>{error}</p>:null}
  {result?<div className={styles.investigationResult}>
   <p className={styles.kicker}>RESEARCH LEADS · UNVERIFIED · NOT A STORY UPDATE</p>
   <pre className={styles.investigationNarrative}>{result.narrative}</pre>
   {result.reactionLedger?<section aria-label="Server-derived market comparisons"
     className={styles.reactionLedger}>
    <h3>Observed price context · matched daily sessions</h3>
    <p className={styles.help}>Source data reconstructed by the authenticated server,
      not taken from the owner-entered packet. These are completed daily bars,
      <strong> not event-window reactions or causal evidence</strong>.</p>
    {result.reactionLedger.windows.map(w=><div className={styles.reactionWindow} key={w.sessions}>
      <strong>{w.sessions} completed session(s): {w.status==="MATCHED_DAILY_OBSERVATION"?
        w.from+" → "+w.to:"UNKNOWN"}</strong>
      {w.observations.map(o=><p key={o.id}>{o.symbol}:{" "}
       {(o.change>0?"+":"")+o.change} {o.unit}
       {o.percent!==null?" ("+(o.percent>0?"+":"")+o.percent+"%)":""}
       {" · "}<a href={o.sourceUrl} target="_blank" rel="noopener noreferrer">
        {o.source} · original source</a></p>)}
      <small>{w.reason}</small>
    </div>)}
    <p><strong>5m / 30m / 4h event-window reactions:</strong> UNKNOWN
      — no timestamped intraday provider bars were admitted.</p>
    {result.reactionLedger.warnings.map((message,i)=>
      <p key={i} className={styles.help}>{message}</p>)}
   </section>:null}
   <h3>Grounding references ({result.sources.length})</h3>
   <p className={styles.help}>{result.groundedSupportCount} supported passage(s) reported
    by the search provider. Individual sources still require direct checking.</p>
   {result.sources.length?<ul className={styles.investigationSources}>
     {result.sources.map(s=><li key={s.url}><a href={s.url} rel="noopener noreferrer"
       target="_blank">{s.title}</a> <small>· {s.domain}
       · {s.supportCount ? s.supportCount+" search-linked passage(s)":"No passage attribution"}</small></li>)}
   </ul>:<p className={styles.investigationWarning}>No machine-readable sources were returned.</p>}
   {result.claimSupports.length?<div>
     <h3>Passages with search-provider source links</h3>
     <p className={styles.help}>These attributions show which search results the model used.
       They do not constitute independent confirmation of the quoted claim.</p>
     <ul className={styles.investigationSources}>
       {result.claimSupports.map((claim,i)=><li key={i}>
         <p>{claim.excerpt}</p>
         <small>{claim.urls.map((url,j)=><span key={url}>
           {j>0?" · ":""}<a href={url} target="_blank" rel="noopener noreferrer">
             Search reference {j+1}</a>
         </span>)}</small>
       </li>)}
     </ul>
   </div>:null}
   <h3>Limitations</h3>
   <ul className={styles.investigationSources}>
    {result.limitations.map(x=><li key={x}>{x}</li>)}
   </ul>
   <div className={styles.actions}>
    <button type="button" onClick={useForDraft}
      disabled={used}>{used?"Included in next writer packet":"Use as unverified research in next draft"}</button>
   </div>
  </div>:null}
 </section>;
}
