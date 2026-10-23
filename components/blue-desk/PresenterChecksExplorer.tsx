"use client";
import { useEffect, useMemo, useState } from "react";
import ui from "@/app/blue-desk/presenter/v6-studio.module.css";

type State = "aligned" | "diverging" | "mixed" | "unassessed";
type Check = {
  key: string; title: string; group: string; technical: string;
  lastBreak: string; observedOn: string; fundamentals: string;
  alignment: State; evidenceUrl: string; notes: string; updatedAt: string;
};
type Cloud = {contractVersion:string; revision:number; updatedAt:string; checks:Check[]};
const FILTERS: Array<{id:State|"all";name:string}> = [
  {id:"all",name:"All 14"}, {id:"aligned",name:"Potential match"},
  {id:"mixed",name:"Mixed"}, {id:"diverging",name:"Diverging"},
  {id:"unassessed",name:"Unchecked"},
];
const sourceReady=(c:Check)=>Boolean(c.observedOn&&c.updatedAt&&/^https:\/\//i.test(c.evidenceUrl||""));
export default function PresenterChecksExplorer() {
  const [checks,setChecks]=useState<Check[]>([]);
  const [revision,setRevision]=useState<number|null>(null);
  const [status,setStatus]=useState<"loading"|"ready"|"auth"|"error">("loading");
  const [filter,setFilter]=useState<State|"all">("all");
  const [selected,setSelected]=useState("dxy-4h");
  useEffect(()=>{
    const controller=new AbortController();
    fetch("/api/presenter/technical-checks",{cache:"no-store",credentials:"same-origin",signal:controller.signal})
      .then(async response=>{if(!response.ok){setStatus(response.status===401||response.status===403?"auth":"error");return;}
        const data=await response.json() as Cloud;
        if(data.contractVersion!=="technical-checks/3"||!Array.isArray(data.checks)||data.checks.length!==14){setStatus("error");return;}
        setChecks(data.checks);setRevision(data.revision);setStatus("ready");
      }).catch(()=>{if(!controller.signal.aborted)setStatus("error");});
    return ()=>controller.abort();
  },[]);
  const visible=useMemo(()=>checks.filter(c=>filter==="all"||c.alignment===filter),[checks,filter]);
  const chosen=visible.find(c=>c.key===selected)||visible[0];
  const count=checks.filter(c=>sourceReady(c)).length;
  return <section className={ui.explorer} aria-label="Saved chart checks and fundamental reconciliation">
    <div className={ui.lens}><strong>Personal technical input ≠ verified market evidence.</strong> This panel reads your saved owner checklist. It does not change the canonical Story, Regime or Dossier.</div>
    <div className={ui.checkSplit}>
      <div className={ui.box}>
        <span className={ui.kicker}>14 TECHNICAL MONITORS · EXISTING CLOUD CHECKLIST</span>
        <h2>Your chart checklist</h2>
        <p className={ui.muted}>Select a monitor to compare your technical reading with the fundamental context and the notes you saved.</p>
        <div className={ui.filters} role="group" aria-label="Filter technical checklist">
          {FILTERS.map(f=><button key={f.id} type="button" aria-pressed={filter===f.id}
            className={filter===f.id?ui.active:""}
            onClick={()=>{setFilter(f.id);setSelected("");}}>{f.name}</button>)}
        </div>
        {status==="loading"&&<p role="status">Loading your authenticated technical-checks/3 revision…</p>}
        {status==="auth"&&<p role="status">Approved owner login is required to read this checklist.</p>}
        {status==="error"&&<p role="status">Cloud checklist unavailable. No sample prices or dates were substituted.</p>}
        {status==="ready"&&<>
          <p className={ui.muted}>{count} of 14 have dated, source-linked presenter entries · cloud revision {revision}</p>
          <div className={ui.monitorList}>
          {visible.map(c=><button type="button" key={c.key} onClick={()=>setSelected(c.key)}
            className={[ui.monitor,chosen?.key===c.key?ui.monitorActive:""].join(" ")} aria-pressed={chosen?.key===c.key}>
            <span className={ui.marker} data-alignment={c.alignment}/>
            <span><strong>{c.title}</strong><small>{c.observedOn||"Undated · unverified"} · {c.alignment}</small></span><span>›</span>
          </button>)}
          </div>
          {!visible.length&&<p className={ui.muted}>No entries in this category.</p>}
        </>}
      </div>
      <div className={ui.box}>
        {chosen?<><div className={ui.selectedTop}><div>
          <span className={ui.kicker}>TECHNICAL × FUNDAMENTAL</span>
          <h2>{chosen.title}</h2>
          <p className={ui.muted}>{chosen.observedOn? "Chart observation: "+chosen.observedOn : "No dated chart observation"} · {chosen.group}</p>
        </div><span className={ui.chip}>{chosen.alignment.toUpperCase()}</span></div>
          <div className={ui.reasons}>
            <div><h3>Your chart reading</h3><p>{chosen.updatedAt?chosen.technical:"Unsaved default: "+chosen.technical+". Confirm the chart before presenting this as observed."}{chosen.key.startsWith("dxy")?" Last recorded EMA band break: "+chosen.lastBreak+".":""}</p></div>
            <div><h3>What the fundamentals show</h3><p>{chosen.fundamentals||"No fundamental comparison saved for this monitor. Check original publisher data and the exact Dossier."}</p></div>
            <div><h3>How to explain it on air</h3><p>{chosen.notes||"Presenter speaking notes are missing. Explain what the chart suggests, what dated evidence supports it and where they may disagree."}</p></div>
            <div><h3>What could challenge it?</h3><p>Check the other side: a dated price-band break, rate/credit or physical-market observations over the same period, and an alternative explanation. An apparent match is not proof of causality.</p></div>
          </div>
          <div className={ui.sourceLine}>{sourceReady(chosen)?<a href={chosen.evidenceUrl} target="_blank" rel="noreferrer noopener">Open chart / source ↗</a>:
            "No dated HTTPS evidence link; interpretation remains presenter-only."}</div>
        </>:<p className={ui.muted}>Choose a saved monitor to inspect its reading and countercheck.</p>}
      </div>
    </div>
  </section>;
}
