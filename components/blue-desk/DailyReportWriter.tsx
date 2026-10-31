"use client";

import {useState} from "react";
import Link from "next/link";
import css from "./daily-report-writer.module.css";
import OwnerHtmlEditionArchive from "./OwnerHtmlEditionArchive";
import {DAILY_BRIEFING_STEPS} from "@/lib/blue-desk-narrative-playbook";
import {HTML_LONGFORM_CHAPTERS,assembleHtmlLongformDraft} from "@/lib/bluebelly-html-longform-generator";

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
type LongformProgress={title:string;packet:string;instructions:string;chapters:string[]};
export default function DailyReportWriter(){
  const [research,setResearch]=useState<Handoff|null>(null);
  const [title,setTitle]=useState("Daily Market Report");
  const [body,setBody]=useState("");
  const [previewHtml,setPreviewHtml]=useState("");
  const [archivedEditionId,setArchivedEditionId]=useState<string|null>(null);
  const [longformProgress,setLongformProgress]=useState<LongformProgress|null>(null);
  const [revision,setRevision]=useState("");
  const [busy,setBusy]=useState<"idle"|"read"|"draft"|"revise"|"preview"|"longform">("idle");
  const [notice,setNotice]=useState("");
  const [editedPacket,setEditedPacket]=useState("");
  const [selectedSources,setSelectedSources]=useState("");
  const [selectedX,setSelectedX]=useState("");
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
      setLongformProgress(null);
      setPreviewHtml("");
      setNotice("Source-dated packet loaded. Verify cited originals before using your private report.");
    }catch(e){setNotice(e instanceof Error?e.message:"Research unavailable");}
    finally{setBusy("idle");}
  }
  async function generate(action:"draft"|"revise"){
    if(busy!=="idle"||!research)return;
    if(editedPacket.trim().length<100){setNotice("Research packet is too short.");return;}
    if(action==="revise"&&!body.trim()){setNotice("There is no draft to revise.");return;}
    if(action==="revise"&&body.length>15000){setNotice("The existing model revision limit is 15,000 characters. Your full draft is preserved; use Editorial Reader preview rather than silently truncating it.");return;}
    if(action==="draft"&&body.trim()&&!window.confirm("Replace current report draft?"))return;
    setLongformProgress(null);
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
      setPreviewHtml("");
      setNotice("Private unverified draft generated. Review all prices, original citations and any causal claim.");
    }catch(e){setNotice(e instanceof Error?e.message:"Model unavailable");}
    finally{setBusy("idle");}
  }
  async function generateFullHtml(resume=false){
    if(busy!=="idle"||!research||editedPacket.trim().length<100){
      setNotice("Read a substantial research packet before generating the HTML report.");return;
    }
    if(!resume&&body.trim()&&!window.confirm("Replace the current article with a full HTML-only report? Save any edits first."))return;
    const current:LongformProgress=resume&&longformProgress?longformProgress:
      {title,packet:editedPacket.slice(0,24000),instructions:revision,chapters:[]};
    if(resume&&(title!==current.title||editedPacket.slice(0,24000)!==current.packet)){
      setNotice("Research/title changed. Start a new source-frozen HTML report rather than joining different evidence snapshots.");return;
    }
    setBusy("longform");setNotice("");setPreviewHtml("");
    const chapters=[...current.chapters];
    try{
      for(let i=chapters.length;i<HTML_LONGFORM_CHAPTERS.length;i++){
        const stage=HTML_LONGFORM_CHAPTERS[i];
        setNotice("HTML report · chapter "+(i+1)+"/"+HTML_LONGFORM_CHAPTERS.length+" · "+stage.heading+". This runs in the open browser only.");
        const response=await fetch("/api/owner/editorial-longform-chapter",{
          method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({title:current.title,packet:current.packet,chapter:stage.key,
            previous:chapters.slice(-2).join("\n\n").slice(-2100),instructions:current.instructions}),
        });
        const result=await response.json().catch(()=>({error:"Invalid model response"})) as {chapter?:string;error?:string};
        if(!response.ok||!result.chapter)throw new Error(result.error||"Chapter generation unavailable");
        chapters.push(result.chapter);
        const partial=assembleHtmlLongformDraft(chapters);
        if(partial.length>75000){
          chapters.pop();
          throw new Error("Generated article exceeds the 75,000-character editor limit. Existing chapters were preserved without truncation");
        }
        const progress={...current,chapters:[...chapters]};
        setLongformProgress(progress);
        setBody(partial);
      }
      const complete=assembleHtmlLongformDraft(chapters);
      if(complete.length>75000)throw new Error("Complete report exceeds private editor length limit; completed chapters retained for review.");
      const previewResponse=await fetch("/api/owner/editorial-reader-preview",{
        method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({title:current.title,body:complete,selectedSources,selectedX,autoArchive:true}),
      });
      if(!previewResponse.ok){
        const reason=await previewResponse.json().catch(()=>({error:"HTML export unavailable"})) as {error?:string};
        throw new Error(reason.error||"HTML export unavailable");
      }
      const html=await previewResponse.text();
      const archiveId=previewResponse.headers.get("X-Bluebelly-Archive-Id");
      if(!html.includes('data-private-reader-v4="true"')||!archiveId)
       throw new Error("Complete HTML was not durably archived; retry preview. Draft chapters are retained.");
      setPreviewHtml(html);setArchivedEditionId(archiveId);
      setNotice("HTML-only report saved automatically to private My Desk history · edition "+archiveId.slice(0,8)+
       " · "+chapters.length+" chapters, "+complete.split(/\s+/).length+" words. PRIVATE_DRAFT — review claims and sources before external use.");
    }catch(e){
      setNotice((e instanceof Error?e.message:"Chapter generation unavailable")+". "+chapters.length+"/"+HTML_LONGFORM_CHAPTERS.length+" chapters retained. "+(chapters.length===HTML_LONGFORM_CHAPTERS.length?"Use Preview full draft to rebuild the HTML export.":"Choose Continue HTML report to resume."));
    }finally{setBusy("idle");}
  }
  async function preview(){
    if(busy!=="idle"||body.trim().length<250||!title.trim()){
      setNotice("Enter at least 250 characters of report text before previewing.");return;
    }
    setBusy("preview");setNotice("");
    try{
      const res=await fetch("/api/owner/editorial-reader-preview",{
        method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({title,body,selectedSources,selectedX,autoArchive:true}),
      });
      if(!res.ok){
        const data=await res.json().catch(()=>({error:"Private reader preview unavailable"})) as {error?:string};
        throw new Error(data.error||"Private reader preview unavailable");
      }
      const html=await res.text();
      const archiveId=res.headers.get("X-Bluebelly-Archive-Id");
      if(!html.includes('data-private-reader-v4="true"')||!archiveId)
       throw new Error("Reader was not saved to the private archive. Retry preview.");
      setPreviewHtml(html);setArchivedEditionId(archiveId);
      setNotice("Private Editorial Reader saved automatically · edition "+archiveId.slice(0,8)+
       ". This is an immutable PRIVATE_DRAFT, not an approved or public report.");
    }catch(e){setNotice(e instanceof Error?e.message:"Private preview unavailable");}
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
            onChange={e=>{setEditedPacket(e.target.value.slice(0,24000));setLongformProgress(null);setPreviewHtml("");}}/>
        </label>
        <button type="button" onClick={()=>copy(editedPacket)}>Copy source packet</button>
      </section>
      <section className={css.panel}>
        <h3>Analyst draft and source review</h3>
        <label>Report headline (max 63 characters)
          <input maxLength={63} value={title} onChange={e=>{setTitle(e.target.value);setPreviewHtml("");setLongformProgress(null);}}/>
        </label>
        <div className={css.actions}>
          <button type="button" onClick={()=>generateFullHtml(false)} disabled={busy!=="idle"||editedPacket.length<100}>
            {busy==="longform"?"Generating HTML chapters…":"Generate full-length HTML report"}
          </button>
          {longformProgress&&longformProgress.chapters.length<HTML_LONGFORM_CHAPTERS.length?
            <button type="button" onClick={()=>generateFullHtml(true)} disabled={busy!=="idle"}>
              Continue HTML report ({longformProgress.chapters.length}/{HTML_LONGFORM_CHAPTERS.length})
            </button>:null}
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
            onChange={e=>{setRevision(e.target.value);setLongformProgress(null);}}/>
        </label>
        <label>Editable chronological Daily Report — not reviewed, not published
          <textarea rows={28} value={body} onChange={e=>{setBody(e.target.value.slice(0,75000));setPreviewHtml("");setLongformProgress(null);}}
            placeholder="Generate a report from the research packet, or write your own evidence-based analysis."/>
        </label>
        <div className={css.actions}>
          <button type="button" onClick={preview} disabled={busy!=="idle"||body.trim().length<250}>
            {busy==="preview"?"Preparing private reader…":"Preview full draft in Editorial Reader v4"}
          </button>
        </div>
        <p className={css.warning}>Full-length drafts up to 75,000 characters can be previewed without cutting their analysis. The server attaches only exact independent matches to your selected original-source URLs. If none qualify, the private draft remains readable but the source ledger shows the coverage gap. All draft claims remain unreviewed.</p>
        {body.trim() ? <details className={css.readAloud} data-private-narrative-preview="unverified">
          <summary>Read-aloud briefing preview</summary>
          <div>{body}</div>
          <p>Private model draft. Check each sourced claim, comparison, date and countercase before relying on it.</p>
        </details> : null}
        <label>Original-source URLs selected for your independent review (maximum 12)
          <textarea rows={5} value={selectedSources}
            placeholder={"https://www.example.gov/original-release\nhttps://www.example.com/issuer-filing"}
            onChange={e=>{setSelectedSources(e.target.value.slice(0,5500));setPreviewHtml("");}}/>
        </label>
        <label>Original X post links to embed (optional, up to five)
          <textarea rows={4} value={selectedX} disabled={busy==="longform"}
            placeholder={"https://x.com/OriginalAccount/status/1234567890123456789"}
            onChange={e=>{setSelectedX(e.target.value.slice(0,3500));setPreviewHtml("");}}/>
        </label>
        <p className={css.warning}>Only exact original X links already recorded by the private X wire will appear, at their recorded publication times. X statements remain attributed, not independently proven market causes. Embeds load only after you click them; the downloaded HTML retains plain-text links offline.</p>
        <p className={css.warning}>The imported source packet may contain up to 40 candidate links,
          including Notion, social posts, calendars and hypotheses. They are unverified candidates. Select only original documents you have checked.
          Public publication remains separate and requires source checking and owner approval; private HTML archival does not publish.</p>
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
    <OwnerHtmlEditionArchive title={title} body={body} selectedSources={selectedSources}
      selectedX={selectedX} previewReady={Boolean(previewHtml)} 
      autoArchivedId={previewHtml?archivedEditionId:null} disabled={busy!=="idle"}/>
    {previewHtml ? <section className={css.editorialPreview} aria-label="Editorial Reader v4 unverified preview" data-reader-preview="private-unverified">
      <h2>Editorial Reader v4 · private formatting preview</h2>
      <p>This is an automatically archived PRIVATE_DRAFT in the approved HTML reading layout, not an approved public edition. Source receipts listed at the end do not independently verify your article claims. X embeds require explicit user interaction.</p>
      <div className={css.actions}>
        <button type="button" onClick={()=>{
          const blob=new Blob([previewHtml],{type:"text/html;charset=utf-8"});
          const url=URL.createObjectURL(blob);
          const a=document.createElement("a");a.href=url;a.download="Bluebelly-Private-Editorial-Reader-PREVIEW.html";a.click();
          URL.revokeObjectURL(url);
        }}>Download HTML report</button>
        <button type="button" onClick={()=>setPreviewHtml("")}>Close preview</button>
      </div>
      <iframe title="Private Editorial Reader v4" className={css.editorialFrame} sandbox="allow-scripts allow-popups" srcDoc={previewHtml}/>
    </section>:null}
    <p className={css.status} role="status">{notice}</p>
  </section>;
}
