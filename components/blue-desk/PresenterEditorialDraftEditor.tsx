"use client";

import { useState } from "react";
import { checkLyPresenterDraft, type LyArticleKind } from "@/lib/presenter-ly-writing-qc";
import ui from "@/app/blue-desk/presenter/presenter.module.css";

/** Local, non-persisted, non-publishing editing surface. */
export default function PresenterEditorialDraftEditor({kind}:{kind:LyArticleKind}) {
  const [title,setTitle]=useState("");
  const [meta,setMeta]=useState("");
  const [body,setBody]=useState("");
  const qc=checkLyPresenterDraft(kind,title,body,meta);
  const copy=()=>{
    // A user gesture, not a background submission or database mutation.
    if(!navigator.clipboard)return;
    void navigator.clipboard.writeText(
      title+"\n\n"+body+"\n\nMETA: "+meta+"\n"
    );
  };
  return <section className={ui.draftEditor} aria-label={kind+" local copy editor"}>
    <h4>Local LY copy checker</h4>
    <p>Paste or write your own draft to check structure. Nothing is saved, generated or published. The checks cannot prove market facts or source rights.</p>
    <label htmlFor={"headline-"+kind}>Headline</label>
    <input id={"headline-"+kind} value={title} maxLength={130}
      onChange={event=>setTitle(event.target.value)} placeholder="Source-backed, specific headline"/>
    <label htmlFor={"meta-"+kind}>Meta description</label>
    <input id={"meta-"+kind} value={meta} maxLength={220}
      onChange={event=>setMeta(event.target.value)} placeholder="One factual summary for search readers"/>
    <label htmlFor={"body-"+kind}>Article body (British English)</label>
    <textarea id={"body-"+kind} value={body} onChange={event=>setBody(event.target.value)}
      rows={11} placeholder="Write chart first, then explain the mechanism plainly. Include contradiction, validation test and original source URLs."/>
    <div className={ui.draftStats}><strong>{qc.words} words</strong><span>{qc.passes}/{qc.checks.length} mechanical checks</span></div>
    <ul className={ui.draftCheckList}>{qc.checks.map(x=><li key={x.key}>
      <strong className={x.pass?ui.passed:ui.missing}>{x.pass?"PASS":"CHECK"}</strong>
      <span>{x.detail}</span>
    </li>)}</ul>
    <button type="button" className={ui.action} onClick={copy} disabled={!body.trim()}>Copy current draft</button>
    <p className={ui.noPublish}>No autosave, no publication, no source verification. Copy the draft before leaving this page.</p>
  </section>;
}
