"use client";

import { useEffect,useState } from "react";
import type { InvestigationMode,InvestigationResult } from "@/lib/editorial-investigation";
import styles from "./editorial-studio.module.css";

export default function InvestigationWorkbench({
 initialQuestion,packet,onUse,
}:{
 initialQuestion:string;packet:string;onUse:(result:InvestigationResult|null)=>void;
}){
 const [mode,setMode]=useState<InvestigationMode>("IMPACT");
 const [question,setQuestion]=useState(initialQuestion);
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
    body:JSON.stringify({mode,question,packet:packet.slice(0,12_800)}),
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
  <div className={styles.actions}>
   <button type="button" disabled={busy||question.trim().length<12||packet.trim().length<100}
     onClick={investigate}>{busy?"Researching original sources…":"Investigate sources and countercase"}</button>
  </div>
  {error?<p role="alert" className={styles.investigationWarning}>{error}</p>:null}
  {result?<div className={styles.investigationResult}>
   <p className={styles.kicker}>RESEARCH LEADS · UNVERIFIED · NOT A STORY UPDATE</p>
   <pre className={styles.investigationNarrative}>{result.narrative}</pre>
   <h3>Grounding references ({result.sources.length})</h3>
   <p className={styles.help}>{result.groundedSupportCount} supported passage(s) reported
    by the search provider. Individual sources still require direct checking.</p>
   {result.sources.length?<ul className={styles.investigationSources}>
     {result.sources.map(s=><li key={s.url}><a href={s.url} rel="noopener noreferrer"
       target="_blank">{s.title}</a> <small>· {s.domain}
       · {s.supportCount ? s.supportCount+" search-linked passage(s)":"No passage attribution"}</small></li>)}
   </ul>:<p className={styles.investigationWarning}>No machine-readable sources were returned.</p>}
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
