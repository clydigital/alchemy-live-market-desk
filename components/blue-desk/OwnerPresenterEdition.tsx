"use client";

import {useEffect,useMemo,useState} from "react";
import {
 presenterSavedBranch,readyPresenterCopy,
 type ChartDirection,type ReadyPresenterEdition,
} from "@/lib/bluebelly-presenter-ready-edition";
import type {PresenterCheckItem} from "@/lib/presenter-technical-checks";
import styles from "./owner-presenter-edition.module.css";

const OPTIONS:readonly {id:ChartDirection;label:string}[]=[
 {id:"bullish",label:"Bullish chart"},
 {id:"bearish",label:"Bearish chart"},
 {id:"inconclusive",label:"Mixed / unknown"},
];
type SavedStatus="loading"|"ready"|"unavailable";
export default function OwnerPresenterEdition({edition}:{edition:ReadyPresenterEdition}){
 const [selected,setSelected]=useState<Record<string,ChartDirection|null>>({});
 const [suggestions,setSuggestions]=useState<Record<string,ChartDirection>>({});
 const [savedState,setSavedState]=useState<SavedStatus>("loading");
 const [copyState,setCopyState]=useState("");
 useEffect(()=>{
  let live=true;
  const load=async()=>{
   try{
    const r=await fetch("/api/presenter/technical-checks",{credentials:"same-origin",cache:"no-store"});
    if(!r.ok)throw Error("not authorised");
    const body=await r.json() as {contractVersion?:string;checks?:PresenterCheckItem[]};
    if(body.contractVersion!=="technical-checks/3"||!Array.isArray(body.checks))
      throw Error("wrong contract");
    const byKey=new Map(body.checks.map(check=>[check.key,check]));
    const suggestionsNext:Record<string,ChartDirection>={};
    for(const c of edition.charts){
     if(!c.observedCheckKey)continue;
     const direction=presenterSavedBranch(byKey.get(c.observedCheckKey),c.timeframe,edition.asOf);
     if(direction)suggestionsNext[c.id]=direction;
    }
    if(!live)return;
    setSuggestions(suggestionsNext);
    // Saved owner observations may initialise a *selection*, not verify a chart.
    setSelected(old=>{
     const next={...old};
     for(const [key,value] of Object.entries(suggestionsNext))
      if(!(key in next))next[key]=value;
     return next;
    });
    setSavedState("ready");
   }catch{if(live)setSavedState("unavailable");}
  };
  void load();
  return ()=>{live=false;};
 },[edition]);
 const copyText=useMemo(()=>readyPresenterCopy(edition,selected),[edition,selected]);
 async function copy(){
  try{await navigator.clipboard.writeText(copyText);setCopyState("Full selected script copied");}
  catch{setCopyState("Clipboard unavailable. Select and copy the script below.");}
 }
 const count=Object.values(selected).filter(Boolean).length;
 return <article className={styles.shell} id="presenter-ready-edition"
  data-ready-presenter-edition={edition.contractVersion}>
  <header className={styles.intro}>
   <div>
    <p className={styles.eyebrow}>PRIVATE · WRITTEN SCRIPT · CURRENT SOURCE VINTAGE</p>
    <h2>{edition.title}</h2>
    <p>Prepared as of <time dateTime={edition.asOf}>{edition.asOf}</time> ·
     {" "}{edition.status.replaceAll("_"," ").toLowerCase()}</p>
    <p className={styles.policy}>This is the presentation itself. Research, source references
     and scripted chart outcomes are included. Select the branch that matches a chart
     you have inspected; selections are not market-feed verification.</p>
   </div>
   <div className={styles.actions}>
    <button type="button" onClick={copy}>Copy completed script</button>
    <a href="#presenter-charts">Jump to chart passages</a>
    <span role="status" aria-live="polite">{copyState}</span>
   </div>
  </header>
  <section className={styles.opening}>
   <p className={styles.eyebrow}>SAY THIS FIRST</p>
   <p className={styles.spoken}>{edition.opening}</p>
  </section>
  {edition.sections.map(section=><section className={styles.act} key={section.id}>
   <h3>{section.title}</h3>
   {section.paragraphs.map((p,i)=><p key={i}>{p}</p>)}
   {section.sources.length?<div className={styles.sources}>
    <strong>Original reports and dated price sources</strong>
    {section.sources.map((s,i)=><a key={i} href={s.url} target="_blank" rel="noopener noreferrer">
     {s.label} · {s.eventTime}</a>)}
   </div>:null}
   {section.evidenceIds.length?<details className={styles.evidence}>
    <summary>Show exact Dossier evidence UUIDs</summary>
    <p>{section.evidenceIds.join(", ")}</p>
   </details>:null}
  </section>)}
  <section id="presenter-charts" className={styles.chartArea}>
   <p className={styles.eyebrow}>CHART POSITIONS · SPEAKABLE BRANCHES</p>
   <h3>What to say when the chart appears</h3>
   <p className={styles.guide}>The four-hour chart tells us about timing. The daily
    chart tells us whether the move persists across sessions. The weekly chart
    tells us whether the larger market structure agrees. The chart has not been
    inspected by this edition.</p>
   <p className={styles.cloud}>Saved chart checklist: {savedState==="ready"?
     "read (owner-entered notes are not independent proof)":savedState==="loading"?"loading":
     "unavailable; all branches require manual chart selection"}.
     {" "}{count} of {edition.charts.length} passages selected.</p>
   <div className={styles.charts}>
    {edition.charts.map(chart=>{
     const choice=selected[chart.id]||null;
     const voice=choice?chart[choice]:chart.inconclusive;
     return <section className={styles.chart} key={chart.id}
       data-chart-timeframe={chart.timeframe} data-chart-id={chart.id}>
      <div className={styles.chartTop}>
       <h4>{chart.symbol} <span>{chart.timeframe}</span></h4>
       <p className={styles.anchor}>{chart.chartLabel}</p>
       <p className={styles.timeframe}>{chart.timeframeMeaning}</p>
      </div>
      <div className={styles.switch} role="group" aria-label={"Choose "+chart.symbol+" "+chart.timeframe+" chart outcome"}>
       {OPTIONS.map(option=><button type="button" key={option.id}
         className={choice===option.id?styles.active:styles.option}
         aria-pressed={choice===option.id}
         onClick={()=>setSelected(old=>({...old,[chart.id]:option.id}))}>
        {option.label}</button>)}
      </div>
      {suggestions[chart.id]?<p className={styles.suggestion}>
       Owner-saved {chart.timeframe} observation suggests {suggestions[chart.id]}.
       Not chart-verified; correct the selection if the current candle differs.</p>:null}
      {!choice?<p className={styles.neutral}>No observed direction selected.
       The inconclusive script below is the safe default.</p>:null}
      <p className={styles.spoken}>{voice}</p>
      <p><strong>Bigger picture:</strong> {chart.higherTimeframe}</p>
      <p className={styles.data}>{chart.sourceLine}</p>
     </section>;
    })}
   </div>
  </section>
  <section className={styles.close}>
   <p className={styles.eyebrow}>THE CLOSE · READ ALOUD</p>
   <p className={styles.spoken}>{edition.closing}</p>
   <p className={styles.guard}>Creator transcripts: not integrated as independently
    verified market facts in this edition. Unsupported creator assertions cannot
    fill a gap in the current market evidence.</p>
  </section>
  <details className={styles.full}>
   <summary>Full combined transcript with chosen chart passages</summary>
   <pre>{copyText}</pre>
  </details>
 </article>;
}
