"use client";

import { useEffect,useState } from "react";
import type { InvestigationMode,InvestigationResult } from "@/lib/editorial-investigation";
import styles from "./editorial-studio.module.css";

export default function InvestigationWorkbench({
 initialQuestion,packet,selectedAssetId,onUse,previewMode=false,
}:{
 initialQuestion:string;packet:string;selectedAssetId:string|null;
 onUse:(result:InvestigationResult|null)=>void;
 previewMode?:boolean;
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
   if(previewMode){
    // Real network research and owner routes are intentionally unavailable in
    // this temporary anonymous UI lab. Never confuse this with a successful
    // Google Search-grounded live model call.
    const offline:InvestigationResult={
      contractVersion:"editorial-investigation/1",
      mode,status:"RESEARCH_LEADS_UNVERIFIED",
      narrative:[
        "DEMO ONLY — STATIC OFFLINE RESEARCH SCAFFOLD",
        "",
        "WHAT IS NEW: UNKNOWN; no original release was fetched.",
        "EXPECTED VS OBSERVED: UNKNOWN; no market data or consensus was checked.",
        "MOST PLAUSIBLE MECHANISM: Hypothesis requires independent evidence.",
        "STRONGEST COUNTERCASE: Other market drivers or changed expectations.",
        "NEXT DECIDING TEST: Inspect primary sources and time-matched bars.",
        "PRIMARY SOURCE CHECKS STILL NEEDED: Exact release URL, clock,",
        "instrument identity, data series and original charts.",
        "OUTPUT ROUTE: "+mode+" — example layout only, NOT publishable.",
      ].join("\n"),
      sources:[],claimSupports:[],searchQueries:[],
      groundedSupportCount:0,canPublish:false,
      limitations:["Public synthetic-only lab. No model, tools, API or private account used.",
        "All event reactions UNKNOWN. No original-source checks performed.",
        "Do not publish or treat this example as verified evidence."],
      reactionLedger:{
        contractVersion:"editorial-reaction-ledger/1",
        status:"DAILY_SOURCE_COMPARISON_NOT_EVENT_REACTION",
        requestedAssetId:selectedAssetId,anchorId:null,
        eventAt:null,builtAt:"2026-01-01T00:00:00.000Z",
        assets:[],warnings:["DEMO — NO LIVE DATA"],
        windows:([1,3,5] as const).map(sessions=>({
          sessions,status:"UNKNOWN" as const,from:null,to:null,observations:[],
          reason:"No live price observations are accessed in this public UI lab.",
        })),
        eventWindows:(["5m","30m","4h"] as const).map(label=>({
          label,status:"UNKNOWN" as const,
          reason:"No live event-timed price observations fetched.",
        })),
      },
    };
    setResult(offline);
    return;
   }
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
   <small>{previewMode?"Offline UI simulation · no API calls":"Manual · Google Search grounding · noncanonical"}</small>
  </header>
  <p className={styles.help}>Ask a fresh question before writing. This searches beyond the saved
   Dossier packet, challenges the explanation and identifies missing market measurements.
   Results are <strong>research leads, not independently verified Evidence</strong>.
   {previewMode?" This temporary lab uses synthetic examples only and never calls Gemini.":
     " This explicit action may incur Gemini grounding usage charges."}</p>
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
     onClick={investigate}>{previewMode?"Preview investigation layout (offline)":
    busy?"Researching original sources…":"Investigate sources and countercase"}</button>
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
