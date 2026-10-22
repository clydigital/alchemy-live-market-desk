"use client";

import { useState } from "react";
import { checkLyPresenterDraft, type LyArticleKind } from "@/lib/presenter-ly-writing-qc";
import ui from "@/app/blue-desk/presenter/presenter.module.css";

/** Local, non-persisted, non-publishing editing surface. */
type SourcePack={headline:string|null;editionId:string|null;dossierId:string|null;
 snippets:Array<{label:string;text:string;sourceUrl:string|null;sourceName:string|null;basis:string}>};
function sourcePackOutline(kind:LyArticleKind,pack:SourcePack):string{
 const sources=pack.snippets.slice(0,9).map(item=>
  [item.label.toUpperCase()+" ["+item.basis+"]",item.text,
  item.sourceUrl?"Original: "+item.sourceName+" — "+item.sourceUrl:
   "Frozen source context only; independently verify before publication"].join("\n")
 );
 return [
  "RESEARCH OUTLINE ONLY — NOT APPROVED FOR PUBLICATION",
  "Exact edition: "+(pack.editionId||"unavailable"),
  "Frozen Dossier: "+(pack.dossierId||"unavailable"),
  ...sources,
  kind==="COTD"?"COTD angle: one verified timely catalyst":
   "OB angle: rates, credit, energy, equities and competing scenarios",
  "OPENING: [Write a specific plain-English lead using current verified facts]",
  "MARKET REACTION: [Verify exact session and chart against a licensed original source]",
  "COUNTERCASE: [State the strongest alternative explanation]",
  "CONFIRMATION / INVALIDATION: [Specify measurable levels or releases]",
  "LY QC: [Check source times, title, charts, permissions and editorial approval]",
 ].join("\n\n");
}
export default function PresenterEditorialDraftEditor({kind,sourcePack}:{kind:LyArticleKind;sourcePack?:SourcePack}) {
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
    {sourcePack?.snippets.length?<button type="button" className={ui.action}
      disabled={Boolean(body.trim())}
      onClick={()=>{
        if(body.trim())return;
        setTitle(sourcePack.headline||"");
        setBody(sourcePackOutline(kind,sourcePack));
      }}>Start from admitted source pack →</button>:null}
    <p>The starter contains only frozen source passages and explicit research gaps. It is not a finished article.</p>
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
