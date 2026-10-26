"use client";

import {useState} from "react";
import Link from "next/link";
import css from "./daily-report-writer.module.css";
import {DAILY_BRIEFING_STEPS} from "@/lib/blue-desk-narrative-playbook";

type Handoff={
  contractVersion:string;assembledAt:string;notionStatus:string;
  warnings:string[];newsCount:number;deliveredBriefCount?:number;packet:string;sourceUrls:string[];
  deliveredResearch?:{status:"AVAILABLE"|"UNAVAILABLE";count:number;caveat:string};
  researchSourceCandidates?:Array<{url:string;sourcePageUrl:string;kind:"MACROPULSE"|"RESEARCH_GAP";verification:"EXACT_NEWS_SOURCE_MATCH"|"UNVERIFIED_LINK";matchingNewsHeadline:string|null}>;
  sourcePages:Array<{kind:string;title:string;url:string;retrievedAt:string}>;
  calendarWarnings:string[];error?:string;
  health?:{
    contractVersion:string;status:string;message:string;assessedAt:string;
    sources:{macroPulsePosts:number;researchGapRuns:number;exactOriginalMatches:number;unverifiedCandidateLinks:number};
    news:{qualifiedCount:number;within48h:number;latestEventAt:string|null};
    checks:{notionAvailable:boolean;gateIncluded:boolean;fullPulseIncluded:boolean;independentNewsPresent:boolean};
    nextActions:string[];
  };
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
    if(research&&editedPacket!==research.packet&&
       !window.confirm("Replace your edited research packet with a fresh source read? The report draft will remain, but your research-packet edits will be lost."))return;
    setBusy("read");setNotice("");
    try{
      const res=await fetch("/api/owner/daily-research",{cache:"no-store",credentials:"same-origin"});
      const data=await res.json() as Handoff;
      if(!res.ok||!data.packet)throw Error(data.error||"Research intake is unavailable.");
      setResearch(data);
      setEditedPacket(data.packet);
      setSelectedSources("");
      setNotice("Source-dated packet loaded. Verify cited originals before using your private report.");
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
    <aside className={css.narrativeMap} aria-label="Two research and storytelling desks, one evidence packet" data-two-desk-briefing="shared-evidence">
      <p><strong>Research desk:</strong> gathers source-dated facts, comparisons, unknowns and opposing explanations.
        {" "}<strong>Storytelling desk:</strong> explains those same facts in a chronological, Shark Tank-style market story.</p>
      <p className={css.narrativeSpine}>{DAILY_BRIEFING_STEPS.map(step=>step.name).join(" → ")}</p>
      <p>One source packet. No invented market reactions, new research engine or automatic publication.</p>
    </aside>
    {research ? <div className={css.grid}>
      <section className={css.panel}>
        <h3>Research provenance</h3>
        <p><strong>Notion:</strong> {research.notionStatus.replaceAll("_"," ")}.
          {" "}<strong>Verified news items:</strong> {research.newsCount}.</p>
        <p><strong>Packet assembled:</strong> {research.assembledAt}</p>
        <p><strong>Delivered MacroPulse review briefs:</strong> {research.deliveredBriefCount||0}.
          {" "}These are source-attributed research digests, not a live Notion read,
          independent verification or an approved market conclusion.</p>
        {research.deliveredResearch?.status==="UNAVAILABLE"?<p className={css.warning}>Private delivery queue could not be read. Its absence does not mean there were no new research posts.</p>:null}
        {research.notionStatus==="NOT_CONFIGURED" ? <p className={css.warning}>
          Server-side Notion integration unavailable. To read the live workspace
          automatically, configure the owner-only NOTION_API_TOKEN and explicitly
          share the MacroPulse and Research Gap collections with that integration.
          Do not treat this incomplete packet as a complete market sweep.
        </p>:null}
        {[...research.warnings,...research.calendarWarnings].map((w,i)=>
          <p className={css.warning} key={i}>{w}</p>)}
        {research.health ? <section className={css.readiness} aria-label="Research input readiness" data-research-health={research.health.status}>
          <h4>Operational research readiness</h4>
          <p><strong>{research.health.status.replaceAll("_"," ")}</strong> · {research.health.message}</p>
          <p>Full Pulse posts: <strong>{research.health.sources.macroPulsePosts}</strong>
            {" · "}Gate runs: <strong>{research.health.sources.researchGapRuns}</strong>
            {" · "}Independently checked original-document matches: <strong>{research.health.sources.exactOriginalMatches}</strong>
            {" · "}Unverified Notion URLs: <strong>{research.health.sources.unverifiedCandidateLinks}</strong></p>
          <p>Source-verified headlines within 48h: <strong>{research.health.news.within48h}</strong>
            {" · "}Most recent qualified event: <strong>{research.health.news.latestEventAt||"Not available"}</strong></p>
          {research.health.nextActions.map((action,i)=><p key={i} className={css.warning}>{action}</p>)}
          <button type="button" onClick={()=>copy(JSON.stringify(research.health,null,2))}>
            Copy source-health diagnostic
          </button>
        </section>:null}
        <h4>Source pages read</h4>
        {research.sourcePages.length ? research.sourcePages.map(p=>
          <p key={p.url}><a target="_blank" rel="noreferrer" href={p.url}>
            {p.kind} · {p.title}</a></p>) :
          <p>No live Notion page was retrieved by this server.</p>}
        <h4>Notion original-link candidates</h4>
        <p>These links come from research notes. An exact verified-News source match
          confirms the original document was separately checked, not that the Note's interpretation is true.
          Links without a matching receipt still need first-party verification.</p>
        {(research.researchSourceCandidates||[]).length?
          (research.researchSourceCandidates||[]).slice(0,16).map((entry,i)=>
            <p key={entry.url}>
              <strong>{entry.verification==="EXACT_NEWS_SOURCE_MATCH"?"Publisher receipt matched":"Unverified link candidate"}</strong>
              {" · "}{entry.kind} · <a target="_blank" rel="noopener noreferrer" href={entry.url}>
                {new URL(entry.url).hostname} · Source {i+1}</a>
            </p>) :
          <p>No links were extracted from authorised Notion research.</p>}
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
            {busy==="draft"?"Explaining…":"Draft chronological market story"}
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
        <label>Editable chronological Daily Report — not reviewed, not published
          <textarea rows={28} value={body} onChange={e=>setBody(e.target.value.slice(0,15000))}
            placeholder="Generate a report from the research packet, or write your own evidence-based analysis."/>
        </label>
        {body.trim() ? <details className={css.readAloud} data-private-narrative-preview="unverified">
          <summary>Read-aloud briefing preview</summary>
          <div>{body}</div>
          <p>Private model draft. Check each sourced claim, comparison, date and countercase before relying on it.</p>
        </details> : null}
        <label>Original-source URLs selected for your independent review (maximum 12)
          <textarea rows={5} value={selectedSources}
            placeholder={"https://www.example.gov/original-release\nhttps://www.example.com/issuer-filing"}
            onChange={e=>setSelectedSources(e.target.value.slice(0,5500))}/>
        </label>
        <p className={css.warning}>The imported source packet may contain up to 40 candidate links,
          including Notion, social posts, calendars and hypotheses. They are unverified candidates. Select only original documents you have checked.
          The publisher separately requires your approval and a matching PDF.</p>
        <p className={css.warning}>Personal review checklist: independently check original
          source documents, event and market observation times, alternative causes,
          actual versus expected readings, and calendar/earnings precision.</p>
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
        <p>This is your private report. Draft, review, copy or export it for your own use; public publishing is disabled.</p>
      </section>
    </div> : <div className={css.empty}>Read the current sources to begin. No report
      has been generated or verified in this session.</div>}
    <p className={css.status} role="status">{notice}</p>
  </section>;
}
