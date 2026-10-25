"use client";

import {useState} from "react";
import Link from "next/link";
import css from "./daily-report-writer.module.css";

type Handoff={
  contractVersion:string;assembledAt:string;notionStatus:string;
  warnings:string[];newsCount:number;packet:string;sourceUrls:string[];
  sourcePages:Array<{kind:string;title:string;url:string;retrievedAt:string}>;
  calendarWarnings:string[];error?:string;
};
export default function DailyReportWriter(){
  const [research,setResearch]=useState<Handoff|null>(null);
  const [title,setTitle]=useState("Daily Market Report");
  const [body,setBody]=useState("");
  const [revision,setRevision]=useState("");
  const [busy,setBusy]=useState<"idle"|"read"|"draft"|"revise">("idle");
  const [notice,setNotice]=useState("");
  const [editedPacket,setEditedPacket]=useState("");
  const [selectedSources,setSelectedSources]=useState("");
  async function load(){
    if(busy!=="idle")return;
    setBusy("read");setNotice("");
    try{
      const res=await fetch("/api/owner/daily-research",{cache:"no-store",credentials:"same-origin"});
      const data=await res.json() as Handoff;
      if(!res.ok||!data.packet)throw Error(data.error||"Research intake is unavailable.");
      setResearch(data);
      setEditedPacket(data.packet);
      setSelectedSources("");
      setNotice("Source-dated packet loaded. Verify cited originals before drafting or publishing.");
    }catch(e){setNotice(e instanceof Error?e.message:"Research unavailable");}
    finally{setBusy("idle");}
  }
  async function generate(action:"draft"|"revise"){
    if(busy!=="idle"||!research)return;
    if(editedPacket.trim().length<100){setNotice("Research packet is too short.");return;}
    if(action==="revise"&&!body.trim()){setNotice("There is no draft to revise.");return;}
    if(action==="draft"&&body.trim()&&!window.confirm("Replace current report draft?"))return;
    setBusy(action);setNotice("");
    try{
      const res=await fetch("/api/owner/editorial-generate",{
        method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({kind:"DAILY_REPORT",action,title,
          packet:editedPacket.slice(0,24000),
          existingBody:body,instructions:revision}),
      });
      const data=await res.json() as {body?:string;error?:string};
      if(!res.ok||!data.body)throw Error(data.error||"Model drafting unavailable.");
      setBody(data.body);
      setNotice("Private unverified draft generated. Review all prices, original citations and any causal claim.");
    }catch(e){setNotice(e instanceof Error?e.message:"Model unavailable");}
    finally{setBusy("idle");}
  }
  const copy=async(value:string)=>{
    try{await navigator.clipboard.writeText(value);setNotice("Copied to clipboard.");}
    catch{setNotice("Clipboard unavailable; select text and copy manually.");}
  };
  return <section className={css.workbench} data-owner-daily-report-writer="review-required">
    <div className={css.head}>
      <div>
        <p className={css.kicker}>PRIVATE WORKSPACE / NOT PUBLICATION</p>
        <h2>Research and draft the Daily Report</h2>
        <p>Bring current MacroPulse and Research Gap together with verified
          headlines, measured market data and upcoming releases. The research
          handoff and model output are not themselves original-source verification.</p>
      </div>
      <button disabled={busy!=="idle"} type="button" onClick={load}>
        {busy==="read"?"Reading sources…":"Read latest research"}
      </button>
    </div>
    {research ? <div className={css.grid}>
      <section className={css.panel}>
        <h3>Research provenance</h3>
        <p><strong>Notion:</strong> {research.notionStatus.replaceAll("_"," ")}.
          {" "}<strong>Verified news items:</strong> {research.newsCount}.</p>
        <p><strong>Packet assembled:</strong> {research.assembledAt}</p>
        {research.notionStatus==="NOT_CONFIGURED" ? <p className={css.warning}>
          Server-side Notion integration unavailable. To read the live workspace
          automatically, configure the owner-only NOTION_API_TOKEN and explicitly
          share the MacroPulse and Research Gap collections with that integration.
          Do not treat this incomplete packet as a complete market sweep.
        </p>:null}
        {[...research.warnings,...research.calendarWarnings].map((w,i)=>
          <p className={css.warning} key={i}>{w}</p>)}
        <h4>Source pages read</h4>
        {research.sourcePages.length ? research.sourcePages.map(p=>
          <p key={p.url}><a target="_blank" rel="noreferrer" href={p.url}>
            {p.kind} · {p.title}</a></p>) :
          <p>No live Notion page was retrieved by this server.</p>}
        <label>Research packet — editable but unverified
          <textarea rows={22} value={editedPacket}
            onChange={e=>setEditedPacket(e.target.value.slice(0,24000))}/>
        </label>
        <button type="button" onClick={()=>copy(editedPacket)}>Copy source packet</button>
      </section>
      <section className={css.panel}>
        <h3>Analyst draft and source review</h3>
        <label>Report headline (max 63 characters)
          <input maxLength={63} value={title} onChange={e=>setTitle(e.target.value)}/>
        </label>
        <div className={css.actions}>
          <button type="button" onClick={()=>generate("draft")} disabled={busy!=="idle"||!title.trim()}>
            {busy==="draft"?"Drafting…":"Generate researched report draft"}
          </button>
          <button type="button" onClick={()=>generate("revise")} disabled={busy!=="idle"||!body.trim()}>
            {busy==="revise"?"Revising…":"Revise existing draft"}
          </button>
        </div>
        <label>Revision instruction
          <input value={revision} maxLength={900}
            placeholder="Explain the physical oil-to-inflation mechanism more clearly…"
            onChange={e=>setRevision(e.target.value)}/>
        </label>
        <label>Editable Daily Report — not reviewed, not published
          <textarea rows={28} value={body} onChange={e=>setBody(e.target.value.slice(0,15000))}
            placeholder="Generate a report from the research packet, or write your own evidence-based analysis."/>
        </label>
        <label>Original-source URLs selected for your independent review (maximum 12)
          <textarea rows={5} value={selectedSources}
            placeholder={"https://www.example.gov/original-release\nhttps://www.example.com/issuer-filing"}
            onChange={e=>setSelectedSources(e.target.value.slice(0,5500))}/>
        </label>
        <p className={css.warning}>The imported source packet may contain up to 40 candidate links,
          including Notion, social posts, calendars and hypotheses. None are automatically
          cleared for publication. Select only the original documents you have checked.
          The publisher separately requires your approval and a matching PDF.</p>
        <p className={css.warning}>Publication gate: independently check original
          source documents, event and market observation times, alternative causes,
          actual versus expected readings, calendar/earnings precision and publication rights.</p>
        <div className={css.actions}>
          <button type="button" disabled={!body.trim()}
            onClick={()=>{
              const urls=[...new Set(selectedSources.split(/\s+/).map(x=>x.trim()).filter(Boolean))];
              if(!urls.length||urls.length>12||
                 urls.some(x=>{try{const u=new URL(x);return u.protocol!=="https:"||Boolean(u.username||u.password);}catch{return true;}})){
                setNotice("Select 1–12 complete original-source HTTPS URLs. Candidate links are not automatically approved.");
                return;
              }
              copy(JSON.stringify({
                kind:"DAILY_REPORT",title,body,sourceUrls:urls,
                researchAsOf:research.assembledAt,reviewStatus:"UNVERIFIED",
              },null,2));
            }}>Copy review packet</button>
          <button type="button" disabled={!body.trim()} onClick={()=>copy(body)}>Copy report text</button>
        </div>
        <p>Review and publication are separate decisions.
          {" "}<Link href="/owner/publications">Approved article publisher</Link>
          {" · "}<Link href="/blue-desk/daily-report">Public Daily Report</Link>
        </p>
      </section>
    </div> : <div className={css.empty}>Read the current sources to begin. No report
      has been generated or verified in this session.</div>}
    <p className={css.status} role="status">{notice}</p>
  </section>;
}
