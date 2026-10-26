"use client";

import {useMemo, useState} from "react";
import {MONITOR_SPECS, type PresenterCheckItem} from "@/lib/presenter-technical-checks";
import {reconcilePresenterObservations} from "@/lib/presenter-technical-reconciliation";
import ui from "./presenter-lab-checks.module.css";

const OPTIONS = ["Not checked","Holding uptrend","Holding downtrend","Upper-band break",
  "Lower-band break","Strengthening","Weakening","Recovering","Deteriorating",
  "Rangebound","Mixed","Rising channel intact","Rollover watch","Rollover confirmed"];
function syntheticChecks():PresenterCheckItem[]{
  return MONITOR_SPECS.map(spec=>({
    ...spec,technical:"Not checked",lastBreak:"Not checked",observedOn:"",
    fundamentals:"",alignment:"unassessed",evidenceUrl:"",notes:"",updatedAt:"",
  }));
}

/** This public UI fixture has no database, network, secret, live signal, or save path. */
export default function PresenterLabChecks(){
  const [checks,setChecks]=useState<PresenterCheckItem[]>(syntheticChecks);
  const [selected,setSelected]=useState(MONITOR_SPECS[0].key);
  const [showAdditional,setShowAdditional]=useState(false);
  const [filter,setFilter]=useState<"all"|"dated"|"unchecked">("all");
  const projection=useMemo(()=>reconcilePresenterObservations(checks,null,new Date().toISOString()),[checks]);
  const active=checks.find(check=>check.key===selected)!;
  const activeRow=projection.rows.find(row=>row.key===selected)!;
  const visible=projection.rows.filter(row=>(row.group==="Core"||showAdditional)
    && (filter==="all"||(filter==="dated"?row.observationState!=="NOT_SAVED":row.observationState==="NOT_SAVED")));
  const dated=projection.rows.filter(row=>row.observationState!=="NOT_SAVED").length;
  function change(values:Partial<PresenterCheckItem>){
    setChecks(old=>old.map(check=>check.key!==selected?check:{...check,...values}));
  }
  function markSyntheticObservation(){
    const stamp=new Date().toISOString();
    change({observedOn:stamp.slice(0,10),updatedAt:stamp,alignment:"unassessed"});
  }
  return <section className={ui.root} data-presenter-lab-checks="synthetic-only">
    <header className={ui.header}>
      <div><span className={ui.kicker}>PUBLIC PREVIEW · SYNTHETIC INPUTS</span>
        <h2>Technical × Fundamentals</h2>
        <p>Test all 14 monitor interactions without signing in. This demonstration has no market measurements, owner observations, Dossier evidence or model access. Nothing entered here is saved to your account.</p>
      </div>
      <div className={ui.total}>{dated} / 14 <small>Demo observations marked</small></div>
    </header>
    <div className={ui.toolbar}>
      <button type="button" onClick={()=>setShowAdditional(value=>!value)} aria-expanded={showAdditional}>
        {showAdditional?"Hide seven additional checks":"Show all 14 checks"}
      </button>
      <label>Display <select value={filter} onChange={e=>setFilter(e.target.value as typeof filter)}>
        <option value="all">All</option><option value="dated">Marked</option><option value="unchecked">Not marked</option>
      </select></label>
      <button type="button" onClick={()=>{setChecks(syntheticChecks());setFilter("all");}}>Reset demo only</button>
    </div>
    <div className={ui.layout}>
      <nav aria-label="Synthetic technical checks" className={ui.list}>
        {visible.map(row=><button type="button" key={row.key}
          aria-current={row.key===selected?"true":undefined}
          className={row.key===selected?ui.selected:ui.item}
          onClick={()=>setSelected(row.key)}>
          <span>{row.group} · {row.observationState.replaceAll("_"," ")}</span>
          <strong>{row.title}</strong>
          <small>{row.ownerReading||"No dated observation"}</small>
        </button>)}
        {!visible.length?<p>No checks match this filter.</p>:null}
      </nav>
      <article className={ui.detail}>
        <span className={ui.kicker}>SYNTHETIC MONITOR · NEVER A LIVE SIGNAL</span>
        <h3>{activeRow.title}</h3>
        <label>Demonstration reading
          <select value={active.technical} onChange={e=>change({technical:e.target.value})}>
            {OPTIONS.map(status=><option key={status}>{status}</option>)}
          </select>
        </label>
        <label>Unverified private-note example
          <textarea value={active.notes} rows={3} maxLength={500}
            onChange={e=>change({notes:e.target.value})}
            placeholder="Type a hypothetical stream note; it stays in this page state only."/>
        </label>
        <button type="button" onClick={markSyntheticObservation}>Mark demo observation (today)</button>
        <dl className={ui.facts}>
          <dt>Last saved observation</dt><dd>{activeRow.observedOn||"None · demo only"}</dd>
          <dt>Dossier context</dt><dd>{activeRow.dossierContext||"Unavailable — no private reader queried"}</dd>
          <dt>Independent reconciliation</dt><dd>{activeRow.verdict}</dd>
          <dt>Check next</dt><dd>{activeRow.confirmOrInvalidate}</dd>
        </dl>
        <div className={ui.script}><strong>Presenter wording · demonstration only</strong>
          <p>{activeRow.presenterTalkingPoint}</p>
        </div>
        <p className={ui.warning}>An owner-entered technical reading cannot become canonical evidence. Agreement or disagreement requires an exact verified instrument and timeframe — a general macro lens is not enough.</p>
      </article>
    </div>
  </section>;
}
