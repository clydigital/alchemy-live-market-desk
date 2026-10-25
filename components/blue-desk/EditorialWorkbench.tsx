"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { EditorialPriceCard } from "@/lib/editorial-price-context";
import type { EditorialSlate, SlateIdea } from "@/lib/editorial-slate-core";
import { editorialPriceLines } from "@/lib/editorial-price-context";
import InvestigationWorkbench from "./InvestigationWorkbench";
import {parseExternalResearch,chatResearchTransferPrompt} from "@/lib/editorial-external-research";
import { mergeInvestigationIntoDraftPacket, type InvestigationResult } from "@/lib/editorial-investigation";
import { editorialGuidingQuestions } from "@/lib/editorial-question-guide";
import styles from "./editorial-studio.module.css";

type Kind = "COTD" | "OB";
type Draft = {
  kind:Kind; title:string; meta:string; assetId:string;
  hook:string; catalysts:string; forwardCatalysts:string; sources:string;
  expectation:string; observed:string; explanation:string; alternative:string;
  confirmation:string; invalidation:string; missingProof:string; chart1:string;chart2:string;chart3:string;
  body:string;
};
const STORAGE="bluebelly-editorial-workbench-v1";
const PREVIEW_STORAGE="bluebelly-editorial-lab-demo-v1";
const EMPTY:Draft={
  kind:"COTD",title:"",meta:"",assetId:"",hook:"",catalysts:"",forwardCatalysts:"",sources:"",
  expectation:"",observed:"",explanation:"",alternative:"",
  confirmation:"",invalidation:"",missingProof:"",chart1:"",chart2:"",chart3:"",body:"",
};
const RUN=["Market in 60 seconds","What changed overnight","Three-session / five-session check",
  "Charts and the countercase","Next catalysts and viewer questions"];
const RUN_MIN=[1,16,13,16,14];
function normalizeDraft(value:unknown):Draft {
  if(!value||typeof value!=="object")return {...EMPTY};
  const raw=value as Record<string,unknown>, cleaned={...EMPTY};
  for(const k of Object.keys(EMPTY) as Array<keyof Draft>){
    const v=raw[k];if(typeof v==="string")(cleaned as Record<string,string>)[k]=v.slice(0,k==="body"?15000:4500);
  }
  if(cleaned.kind!=="OB"&&cleaned.kind!=="COTD")cleaned.kind="COTD";
  return cleaned;
}
function safeHttps(raw:string) {
  try {const u=new URL(raw);return u.protocol==="https:"&&!u.username&&!u.password?u.toString():null;}
  catch{return null;}
}
function signed(n:number) {return (n>0?"+":"")+n.toFixed(2);}
function short(v:string,empty="Not supplied") {return v.trim()||empty;}
function articlePacket(d:Draft,card:EditorialPriceCard|null) {
  return [
    "# "+(d.title.trim()||"Untitled "+d.kind+" — unpublished draft"),
    "**Mode:** "+d.kind+" | **Status:** PRIVATE WORKING DRAFT — independently verify all owner-entered claims and levels",
    "**Meta:** "+short(d.meta),
    "## Opening",
    short(d.hook),
    "## Catalyst chronology (source + event time required)",
    short(d.catalysts,"Not verified or entered"),
    "## Price comparison — observed daily-source bars",
    card?editorialPriceLines(card):"No instrument selected. Daily/3-session/5-session price comparisons UNKNOWN.",
    "## Upcoming calendar and earnings (source dates; do not invent results)",
    short(d.forwardCatalysts,"No upcoming agency or issuer event verified or entered."),
    "## Textbook expectation",
    short(d.expectation),
    "## Actual reaction (owner notes; unverified until independently checked)",
    short(d.observed),
    "## Most plausible mechanism — conditional",
    short(d.explanation),
    "## Strongest counter-explanation",
    short(d.alternative),
    "## Unresolved source and price evidence",
    short(d.missingProof,"No verification-gap notes entered; this does not imply full verification."),
    "## Chart checks (not confirmed setups)",
    [d.chart1,d.chart2,d.chart3].filter(Boolean).map((x,i)=>(i+1)+". "+x).join("\n")||"No inspected charts.",
    "## Article text (author-owned)",
    short(d.body,"Write from verified evidence only; no article has been generated."),
    "## Confirmation",
    short(d.confirmation),
    "## Invalidation",
    short(d.invalidation),
    "## Original source URLs (not automatically verified)",
    short(d.sources),
    "## Publication gate",
    "Verify original URLs, exact release time, exchange session, contract/split, chart structures and every claimed price or causal link before using client-facing.",
  ].join("\n\n");
}
function writingRequest(d:Draft,card:EditorialPriceCard|null) {
  return [
    "Draft a client-facing "+d.kind+" in LY style, British English, simple trader-to-trader wording. Follow the canonical LY Style Guide.",
    "COTD leads with price/technical observation; OB leads with the actual catalyst and then the asset reaction.",
    "Lead with what happened, compare previous completed session, three completed sessions and five completed sessions.",
    "Explain why price rose, fell or diverged versus what normally should happen; distinguish competing hypotheses from fact.",
    "Preserve missing prices as UNKNOWN. The market snapshot is daily dated source observations, not event-timed ticks or verified chart patterns.",
    "Do not use an unverified sentence from the owner's notes as fact. Verify first with original issuer/official/exchange sources and dated price data; if unavailable omit or mark conditional.",
    "Max three charts, each tied to a deciding technical question; chart annotations and EMA20/50 1σ, EMA100 0.5σ, EMA200 0.25σ are suggestions until inspected.",
    "Title at most 63 characters, meta at most 150, paragraphs at most 3 sentences. COTD target 600–800 words. Short readable, no hype.",
    "Explain the complete plain-English mechanism one moving part per sentence: who acts, what changes immediately, the missing link, the assets exposed and the catch.",
    "Separate expected reaction, actual measured response, alternatives, uncertainties and what the next original source could resolve.",
    "Reference genuinely scheduled economic calendar and issuer earnings only when original date/period and timing precision are supplied; distinguish reported from confirmed dates.",
    "Show a countercase and confirmation/invalidation. Do not invent cited numbers or causal certainty.",
    "ARTICLE NOTES / UNVERIFIED INPUTS:",
    articlePacket(d,card),
  ].join("\n\n");
}
function Field({label,value,onChange,rows=2,placeholder}:{
  label:string;value:string;onChange:(v:string)=>void;rows?:number;placeholder?:string;
}){
  return <label className={styles.field}><span>{label}</span>
    <textarea value={value} rows={rows} placeholder={placeholder} onChange={e=>onChange(e.target.value)}/>
  </label>;
}
export default function EditorialWorkbench({priceCards,mode,readError,slate,slateStatus,previewMode=false}:{
  priceCards:EditorialPriceCard[];mode:"editorial"|"presenter";readError:boolean;
  slate:EditorialSlate|null;slateStatus:"available"|"empty"|"storage_unavailable";
  previewMode?:boolean;
}){
  const [draft,setDraft]=useState<Draft>({...EMPTY});
  const [loaded,setLoaded]=useState(false);
  const [copied,setCopied]=useState("");
  const [generationState,setGenerationState]=useState<"idle"|"draft"|"revise">("idle");
  const [investigation,setInvestigation]=useState<InvestigationResult|null>(null);
  const [externalResearch,setExternalResearch]=useState("");
  const [importStatus,setImportStatus]=useState("");
  const [externalKind,setExternalKind]=useState<Kind>("OB");
  const [importedResearch,setImportedResearch]=useState(false);
  const [generationError,setGenerationError]=useState("");
  const [revisionInstruction,setRevisionInstruction]=useState("");
  const [runNotes,setRunNotes]=useState<string[]>(RUN.map(()=>""));
  const [onAir,setOnAir]=useState(false);
  const [onAirIndex,setOnAirIndex]=useState(0);
  useEffect(()=>{
    try{const raw=localStorage.getItem(previewMode?PREVIEW_STORAGE:STORAGE);
      if(raw){const parsed=JSON.parse(raw) as {draft?:unknown,runNotes?:unknown};
        setDraft(normalizeDraft(parsed.draft));
        const restoredNotes=parsed.runNotes;
        if(Array.isArray(restoredNotes))setRunNotes(RUN.map((_,i)=>
          typeof restoredNotes[i]==="string" ? (restoredNotes[i] as string).slice(0,2500):""));
      }
    }catch{/* Browser-only private notes never overwrite canonical data. */}
    setLoaded(true);
  },[]);
  useEffect(()=>{if(!loaded)return;try{localStorage.setItem(previewMode?PREVIEW_STORAGE:STORAGE,JSON.stringify({draft,runNotes}));}catch{/* no durable server write */}},[draft,runNotes,loaded]);
  function update<K extends keyof Draft>(key:K,value:Draft[K]){setDraft(d=>({...d,[key]:value}));}
  const selected=useMemo(()=>priceCards.find(c=>c.id===draft.assetId)||null,[priceCards,draft.assetId]);
  const packet=articlePacket(draft,selected);
  const prompt=writingRequest(draft,selected);
  async function copy(label:string,value:string){
    try{await navigator.clipboard.writeText(value);setCopied(label+" copied");}
    catch{setCopied("Clipboard unavailable — select and copy the preview text below.");}
  }
  function selectSlateIdea(idea:SlateIdea){
    setInvestigation(null);
    if((draft.title||draft.body)&&!window.confirm("Replace the working article notes with this saved idea? Your existing browser draft will be overwritten."))return;
    const format:Kind=idea.format==="BOTH"?"OB":idea.format;
    setDraft({
      ...EMPTY,kind:format,assetId:"",title:idea.title.slice(0,63),
      hook:idea.hook,catalysts:idea.catalystTimeline,
      expectation:idea.expectation,observed:idea.priceReaction,
      explanation:idea.mechanism,alternative:idea.countercase,
      confirmation:idea.nextTrigger,
      invalidation:"",missingProof:idea.missingProof,
      sources:[...new Set([...idea.sourceUrls,...(slate?.sources||[])])].join("\n"),
      chart1:idea.chartGuidance[0]||"",chart2:idea.chartGuidance[1]||"",
      chart3:idea.chartGuidance[2]||"",
      body:"",
    });
    setGenerationError("");
    setCopied("Scheduled idea loaded as PRIVATE working notes. Check original sources before generating.");
  }
  function applyExternalResearch(){
    if(!previewMode)return;
    const parsed=parseExternalResearch(externalResearch,externalKind);
    if(!parsed.ok){setImportStatus(parsed.error);return;}
    const entry=parsed.research;
    if((draft.title.trim()||draft.body.trim())&&!window.confirm(
      "Replace the current local draft with imported research? This does not affect private or canonical records."))return;
    setDraft({...EMPTY,kind:entry.kind,title:entry.title,meta:entry.meta,
      hook:entry.hook,body:entry.body,catalysts:entry.catalysts,
      expectation:entry.expectation,observed:entry.observed,
      explanation:entry.explanation,alternative:entry.alternative,
      confirmation:entry.confirmation,invalidation:entry.invalidation,
      missingProof:entry.missingProof,chart1:entry.chart1,
      chart2:entry.chart2,chart3:entry.chart3,sources:entry.sources});
    setInvestigation(null);
    setImportedResearch(true);
    setImportStatus("Imported into editable local draft · "+entry.sourceCount+
      " HTTPS source candidate(s) · all claims require independent review.");
    setCopied("");
  }
  async function copyResearchPrompt(){
    try{
      await navigator.clipboard.writeText(chatResearchTransferPrompt(externalKind));
      setImportStatus("Research prompt copied. Paste into ChatGPT with connected sources, then import the response here.");
    }catch{setImportStatus("Clipboard blocked; select and copy the prompt below.");}
  }
  async function runGeneration(action:"draft"|"revise"){
    if(previewMode){
      // This public lab NEVER invokes owner APIs or external models.
      const text=[
        "# DEVELOPMENT EXAMPLE — NOT GENERATED RESEARCH",
        "Draft type: "+draft.kind+".",
        "Market question: "+(draft.title||"Not supplied"),
        "Catalyst notes: "+(draft.catalysts||"Unverified"),
        "Proposed mechanism: "+(draft.explanation||"Unknown"),
        "Countercase: "+(draft.alternative||"Unknown"),
        "NEXT TEST: "+(draft.confirmation||"Requires original sources"),
        "DISCLAIMER: Offline template only. No Gemini calls, market verification,",
        "canonical Evidence, Story changes or PDF publication occurred.",
      ].join("\n\n");
      update("body",text);
      setGenerationError("");
      setCopied("Offline demo template prepared; no model/API called.");
      return;
    }
    if(generationState!=="idle")return;
    if(!draft.title.trim()||!draft.catalysts.trim()||!draft.sources.trim()){
      setGenerationError("Enter a headline, dated catalysts and original source URLs first.");
      return;
    }
    if(action==="revise"&&!draft.body.trim()){
      setGenerationError("There is no article body to revise yet.");
      return;
    }
    if(action==="draft"&&draft.body.trim()&&
       !window.confirm("Replace your current article body with a new model-generated draft?"))return;
    setGenerationError("");
    setGenerationState(action);
    try{
      const response=await fetch("/api/owner/editorial-generate",{
        method:"POST",credentials:"same-origin",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          action,kind:draft.kind,title:draft.title,
          packet:mergeInvestigationIntoDraftPacket(writingRequest(draft,selected),investigation),existingBody:draft.body,
          instructions:revisionInstruction,
        }),
      });
      const result=await response.json() as {body?:string;error?:string;status?:string};
      if(!response.ok||!result.body)throw new Error(result.error||"Generation unavailable");
      update("body",result.body);
      setCopied(action==="draft"?"AI draft added — NOT fact-checked or published.":
        "AI revision added — verify every figure and source before publication.");
    }catch(e){
      setGenerationError(e instanceof Error?e.message:"Generation unavailable");
    }finally{setGenerationState("idle");}
  }
  const sourceLinks=draft.sources.split(/\s+/).map(s=>safeHttps(s.trim())).filter((s):s is string=>!!s).slice(0,10);
  const articleReady=draft.title.trim().length>0&&draft.title.length<=63&&draft.meta.length<=150
    &&Boolean(draft.catalysts.trim()&&draft.sources.trim()&&draft.explanation.trim()
      &&draft.alternative.trim()&&draft.confirmation.trim()&&draft.invalidation.trim());
  const hasComparedPrices=selected?.comparisons.every(c=>c.change!==null)??false;
  const checks=[["Core editorial inputs",articleReady],["1 / 3 / 5-session source bars",hasComparedPrices],
    ["Original-source links entered",sourceLinks.length>0],["Chart setup manually inspected",false]] as const;
  const notes=runNotes.map((n,i)=>RUN[i]+" ("+RUN_MIN[i]+" min)\n"+(n||"Unprepared"));
  return (
    <div className={styles.layout}>
      {previewMode?(
        <nav className={styles.subnav} aria-label="No-login lab navigation">
          <Link href="/">← Back to public Bluebelly</Link>
          <strong>NO-LOGIN UI LAB · SYNTHETIC DATA ONLY</strong>
        </nav>
      ):(
        <nav className={styles.subnav} aria-label="Private studio views">
          <Link href="/owner/editorial" aria-current={mode==="editorial"?"page":undefined}>Article writing</Link>
          <Link href="/owner/presenter" aria-current={mode==="presenter"?"page":undefined}>Presenter view</Link>
          <Link href="/hybrid-output/prepare">Edition-pinned prep ↗</Link>
          <Link href="/owner/x-wire">X research leads ↗</Link>
        </nav>
      )}
      <div className={styles.status}><strong>{previewMode?"Temporary development UI — not live research":"Owner-only research workspace"}</strong>
        <span>{previewMode?"Demo slate or imported user research; local-only notes. Server research, model drafting, private records and publication are unavailable here.":"Notes save locally in this browser; scheduled research and canonical source evidence remain separate."}</span></div>
      {previewMode?<section className={styles.panel} data-external-research-transfer="local-only"
        aria-label="Paste externally researched article">
        <header className={styles.panelHead}>
          <h2>Import real research from ChatGPT</h2>
          <small>Offline bridge · no owner login · local draft only</small>
        </header>
        <p className={styles.help}>
          Research with ChatGPT and the plugins you already connect.
          Copy the sourced result here to edit an OB or COTD without using the
          locked Gemini route. Original links are preserved as candidates.
          Importing is <strong>not independent verification</strong>.
          No contents are uploaded to Bluebelly.
        </p>
        <div className={styles.actions}>
          <label className={styles.lineField}>
            <span>Research format</span>
            <select value={externalKind} onChange={e=>setExternalKind(e.target.value==="COTD"?"COTD":"OB")}>
              <option value="OB">Opening Bell</option>
              <option value="COTD">Chart of the Day</option>
            </select>
          </label>
          <button type="button" onClick={copyResearchPrompt}>Copy ChatGPT research prompt</button>
        </div>
        <details className={styles.externalPrompt}>
          <summary>Show the research prompt and supported JSON fields</summary>
          <pre>{chatResearchTransferPrompt(externalKind)}</pre>
        </details>
        <label className={styles.field}>
          <span>Paste full research brief or JSON (max 32,000 characters)</span>
          <textarea value={externalResearch} rows={8} maxLength={32_000}
            placeholder='Paste ChatGPT research text with source URLs, or a structured JSON object containing title, body, sources, countercase and missingProof.'
            onChange={e=>{setExternalResearch(e.target.value);setImportStatus("");}}/>
        </label>
        <div className={styles.actions}>
          <button type="button" disabled={!externalResearch.trim()} onClick={applyExternalResearch}>
            Import into local editable article
          </button>
        </div>
        <p className={styles.small} role="status">{importStatus||"Plain Markdown/text and JSON are supported. This never calls a server-side API."}</p>
      </section>:null}
      <section className={styles.panel} aria-label="Scheduled editorial slate">
        <header className={styles.panelHead}>
          <h2>09:00 Editorial Slate</h2>
          <small>{slate?slate.dayMyt+" MYT · "+slate.ageLabel:
            slateStatus==="storage_unavailable"?"Storage unavailable":"No stored scheduled slate yet"}</small>
        </header>
        {!slate?<p className={styles.help}>The weekday writing task must successfully hand off its three sourced ideas to the private slate ledger. No placeholder headlines are invented. You can still write manually.</p>:<>
          <p className={styles.help}>{slate.verificationStatus==="partial"?
            "PARTIAL SOURCE COVERAGE — verify unresolved catalysts and price windows.":
            "Source-checked research suggestions; article wording and technical setups still require manual review."} {slate.notes}</p>
          <div className={styles.slateGrid}>
            {slate.ideas.map(idea=><article key={idea.rank} className={styles.slateCard}>
              <p className={styles.kicker}>#{idea.rank} · {idea.format}</p>
              <h3>{idea.title}</h3>
              <p>{idea.hook}</p>
              <p className={styles.small}>Price: {idea.priceReaction||"UNKNOWN"}</p>
              <p className={styles.small}>Next test: {idea.nextTrigger||"Not recorded"}</p>
              <p className={styles.small}>Charts: {idea.chartGuidance.length?idea.chartGuidance.join(" · "):"None verified"}</p>
              <div className={styles.actions}><button type="button" onClick={()=>selectSlateIdea(idea)}>Use this angle</button></div>
            </article>)}
          </div>
        </>}
      </section>
      {previewMode&&importedResearch?<p className={styles.externalImportBanner} role="note">
        Imported research remains UNVERIFIED. The offline investigation preview below uses
        simulated UNKNOWN price windows and does not validate the imported market claims.
      </p>:null}
      {mode==="editorial"?(
        <InvestigationWorkbench
          initialQuestion={draft.title}
          selectedAssetId={selected?.id||null}
          packet={writingRequest(draft,selected).slice(0,12_800)}
          onUse={setInvestigation}
          previewMode={previewMode}
        />
      ):null}
      {mode==="presenter"?(
        <div className={styles.columns}>
          <section className={styles.panel}>
            <header className={styles.panelHead}><h2>On-air running order</h2><small>60 minutes · editable notes</small></header>
            {onAir?(
              <div className={styles.air}>
                <p className={styles.kicker}>ON AIR · {onAirIndex+1} / {RUN.length}</p>
                <h2>{RUN[onAirIndex]}</h2><p>{RUN_MIN[onAirIndex]} minutes</p>
                <pre>{runNotes[onAirIndex]||"No notes prepared."}</pre>
                <div className={styles.actions}>
                  <button disabled={onAirIndex===0} onClick={()=>setOnAirIndex(i=>Math.max(0,i-1))}>Previous</button>
                  <button disabled={onAirIndex===RUN.length-1} onClick={()=>setOnAirIndex(i=>Math.min(RUN.length-1,i+1))}>Next</button>
                  <button onClick={()=>setOnAir(false)}>Exit on-air</button>
                </div>
              </div>
            ):(
              <>
                {RUN.map((name,i)=><Field key={name}
                  label={(i+1)+". "+name+" · "+RUN_MIN[i]+" min"}
                  rows={3} value={runNotes[i]}
                  placeholder={i===0?"Lead with what changed, not a guessed price.":i===2?"1D / 3-session / 5-session price observations and disagreements":undefined}
                  onChange={v=>setRunNotes(n=>n.map((old,j)=>j===i?v:old))}/>)}
                <div className={styles.actions}><button onClick={()=>{setOnAirIndex(0);setOnAir(true);}}>Enter on-air view</button>
                  <button onClick={()=>copy("Presenter rundown",notes.join("\n\n"))}>Copy rundown</button></div>
              </>
            )}
          </section>
          <aside className={styles.panel}>
            <header className={styles.panelHead}><h2>Market context</h2><small>Daily observations only</small></header>
            <p className={styles.help}>The chart checklist and source comparison are independent; neither proves a technical setup. Verify the live screen before making an on-air claim.</p>
            <AssetPicker cards={priceCards} value={draft.assetId} onChange={v=>update("assetId",v)} />
            <PriceContext card={selected} readError={readError}/>
            <h3>Current article angle</h3>
            <p>{short(draft.title,"No headline prepared")}</p>
            <p className={styles.small}>{short(draft.hook,"Add an opener in Article writing.")}</p>
            <p className={styles.small}>Next confirmation: {short(draft.confirmation)}</p>
            <p className={styles.small}>Invalidation: {short(draft.invalidation)}</p>
            <Link href="/owner/editorial">Edit editorial notes →</Link>
          </aside>
        </div>
      ):(
        <div className={styles.columns}>
          <section className={styles.panel}>
            <header className={styles.panelHead}><h2>OB / COTD writing desk</h2><small>Writer owns the final interpretation</small></header>
            <div className={styles.kind}>
              <button aria-pressed={draft.kind==="COTD"} onClick={()=>update("kind","COTD")}>COTD · chart-first</button>
              <button aria-pressed={draft.kind==="OB"} onClick={()=>update("kind","OB")}>Opening Bell · catalyst-first</button>
            </div>
            <details className={styles.panel} data-editorial-guiding-questions={draft.kind}>
              <summary>Guiding questions for {draft.kind === "COTD" ? "Chart of the Day" : "Opening Bell"}</summary>
              <p className={styles.help}>Build an explanation a non-specialist can follow.
                Work from the chart or catalyst through each economic step, and return to the
                affected asset. Missing evidence stays unknown.</p>
              <ol>
                {editorialGuidingQuestions(draft.kind).map(item =>
                  <li key={item.id}>
                    <strong>{item.question}</strong>
                    <p className={styles.help}>{item.evidenceCheck}</p>
                  </li>)}
              </ol>
              <p className={styles.help}>Upcoming figures and earnings:
                {" "}<Link href="/blue-desk/calendar#earnings-hub">Calendar + Earnings Hub</Link>.
                Verify issuer dates and economic releases before citing them.</p>
            </details>
            <label className={styles.lineField}><span>Working headline ({draft.title.length}/63)</span>
              <input maxLength={63} value={draft.title} onChange={e=>update("title",e.target.value)}
                placeholder="What changed, which asset, why it matters"/></label>
            <label className={styles.lineField}><span>Meta description ({draft.meta.length}/150)</span>
              <input maxLength={150} value={draft.meta} onChange={e=>update("meta",e.target.value)}
                placeholder="One factual, specific sentence"/></label>
            <Field label="Opening · what the reader should care about" value={draft.hook}
              onChange={v=>update("hook",v)} placeholder="The decisive move or verified catalyst, in plain English."/>
            <Field label="Catalyst timeline · date, event, original URL" value={draft.catalysts} rows={4}
              onChange={v=>update("catalysts",v)} placeholder="Newest first, dated. What happened yesterday, over three sessions, and last week?"/>
            <Field label="Upcoming economic calendar + issuer earnings · what could change the view?" rows={3}
              value={draft.forwardCatalysts} onChange={v=>update("forwardCatalysts",v)}
              placeholder="Official date, agency/issuer URL, consensus if sourced, exposed markets and the exact question the result will answer."/>
            <Field label="What should price normally have done?" value={draft.expectation}
              onChange={v=>update("expectation",v)} placeholder="A pre-event expectation, not a prediction retrofitted to the tape."/>
            <Field label="Observed reaction · exact session and source" value={draft.observed}
              onChange={v=>update("observed",v)} placeholder="Never treat a live quote as a closing price."/>
            <Field label="Why could it be rising / falling? · mechanism" value={draft.explanation}
              onChange={v=>update("explanation",v)}
              placeholder="Actor → immediate change → the missing causal step → affected markets. One step per sentence, then explain the catch."/>
            <Field label="What else could explain it? · countercase" value={draft.alternative}
              onChange={v=>update("alternative",v)}/>
            <Field label="What confirms the idea?" value={draft.confirmation}
              onChange={v=>update("confirmation",v)}/>
            <Field label="What invalidates it?" value={draft.invalidation}
              onChange={v=>update("invalidation",v)}/>
            <Field label="Missing evidence · UNKNOWN comparisons and unverified claims" rows={3} value={draft.missingProof}
              onChange={v=>update("missingProof",v)}/>
            <Field label="Original source URLs · one per line" rows={3} value={draft.sources}
              onChange={v=>update("sources",v)}/>
            <h3>Chart storyboard · maximum three</h3>
            <p className={styles.help}>Choose 4H, daily or weekly. Check EMA20/50 ±1σ, EMA100 ±0.5σ and EMA200 ±0.25σ only where relevant. Never state a band break without inspecting dated chart bars.</p>
            <Field label="Chart 1 · instrument, timeframe, deciding question" value={draft.chart1}
              onChange={v=>update("chart1",v)}/>
            <Field label="Chart 2 · different evidence or contradiction" value={draft.chart2}
              onChange={v=>update("chart2",v)}/>
            <Field label="Chart 3 · only if necessary" value={draft.chart3}
              onChange={v=>update("chart3",v)}/>
            <Field label="Editable article body · your own draft" value={draft.body} rows={13}
              onChange={v=>update("body",v)}
              placeholder="The scheduled writing brain supplies the daily idea slate. Write and refine client-facing copy here, or copy the source-grounded brief for an assisted draft."/>
            <div className={styles.actions}>
              <button type="button" disabled={generationState!=="idle"} onClick={()=>runGeneration("draft")}>
                {generationState==="draft"?"Generating…":(previewMode?"Create offline example":"Generate article draft")}
              </button>
              <button onClick={()=>copy("Writing request",prompt)}>Copy AI writing brief</button>
              <button onClick={()=>copy("Markdown draft",packet)}>Copy draft Markdown</button>
              {previewMode?<button type="button" disabled={!draft.body.trim()} onClick={()=>window.print()}>
                Print unverified draft / Save as PDF
              </button>:null}
              {previewMode?<button type="button" disabled={!draft.body.trim()} onClick={()=>copy(
                "Unapproved publisher packet",
                JSON.stringify({kind:draft.kind,title:draft.title,meta:draft.meta,
                 body:draft.body,sources:sourceLinks},null,2)
              )}>Copy unapproved publication JSON</button>:null}
            </div>
            <label className={styles.lineField}>
              <span>Revision instruction · optional</span>
              <input value={revisionInstruction} onChange={e=>setRevisionInstruction(e.target.value.slice(0,900))}
                placeholder="Tighten the opening, shorten paragraphs, strengthen the countercase…"/>
            </label>
            <div className={styles.actions}>
              <button type="button" disabled={generationState!=="idle"||!draft.body.trim()}
                onClick={()=>runGeneration("revise")}>{generationState==="revise"?"Revising…":(previewMode?"Refresh offline example":"Revise article with AI")}</button>
            </div>
            <p className={styles.small} role="status">{generationError||copied||
              "Generation is optional and owner-initiated. Outputs remain PRIVATE and UNVERIFIED until sourced review."}</p>
          </section>
          <aside className={styles.side}>
            <section className={styles.panel}>
              <h2>Daily / 3-session / weekly tape</h2>
              <AssetPicker cards={priceCards} value={draft.assetId} onChange={v=>update("assetId",v)}/>
              <PriceContext card={selected} readError={readError}/>
            </section>
            <section className={styles.panel}>
              <h2>LY editorial checks</h2>
              {checks.map(([name,ok])=><div className={styles.check} key={name}>
                <span>{name}</span><strong>{ok?"Ready for review":"Check"}</strong></div>)}
              <p className={styles.help}>“Ready for review” is not a fact-check or authorisation to publish. Event-timed reactions, source dates, technical chart observations and causal conclusions need independent validation.</p>
              <p className={styles.help}>COTD: 600–800 words preferred, maximum three charts. OB: move → catalyst → consequence → countercase → next trigger.</p>
            </section>
            <section className={styles.panel}>
              <h2>Source packet preview</h2>
              <pre className={styles.preview}>{packet}</pre>
              <p className={styles.help}>Daily brief generated from owner text and pre-existing monitor data; nothing is pushed into canonical research.</p>
            </section>
          </aside>
        </div>
      )}
      {previewMode&&draft.body.trim()?<section className={styles.printDraft}
        data-print-local-draft="unverified">
        <p className={styles.printStatus}>WORKING DRAFT · EXTERNAL RESEARCH UNVERIFIED · NOT APPROVED</p>
        <h1>{draft.title||"Untitled market analysis"}</h1>
        <p className={styles.printMeta}>{draft.kind} · Owner-edited browser copy · Source checks pending</p>
        <div className={styles.printText}>{draft.body}</div>
        <h2>Original-source candidates to verify</h2>
        <ul>{sourceLinks.map(url=><li key={url}>{url}</li>)}</ul>
        <p>{draft.missingProof||"Original source, event clock and chart verification required."}</p>
      </section>:null}
    </div>
  );
}
function AssetPicker({cards,value,onChange}:{
  cards:EditorialPriceCard[];value:string;onChange:(v:string)=>void;
}){
  return <label className={styles.lineField}><span>Market / instrument</span>
    <select value={value} onChange={e=>onChange(e.target.value)}>
      <option value="">Select a sourced instrument</option>
      {cards.map(card=><option key={card.id} value={card.id}>{card.label} · {card.symbol}</option>)}
    </select>
  </label>;
}
function PriceContext({card,readError}:{
  card:EditorialPriceCard|null;readError:boolean;
}){
  if(!card)return <p className={styles.help}>{readError?
    "Market monitor unavailable; historical returns UNKNOWN.":"Select a market to inspect dated price context."}</p>;
  return <div className={styles.price}>
    <p className={styles.kicker}>{card.status} · {card.lastDate||"UNDATED"}</p>
    <strong>{card.lastClose===null?"UNKNOWN":card.lastClose.toLocaleString("en-GB",{maximumFractionDigits:3})}
      <span>{card.levelUnit}</span></strong>
    <p className={styles.small}>Source: {card.source}
      {card.sourceUrl?<a href={card.sourceUrl} target="_blank" rel="noopener noreferrer">Original series ↗</a>:null}</p>
    <table><thead><tr><th>Period</th><th>Reference</th><th>Change</th></tr></thead>
      <tbody>{card.comparisons.map(c=><tr key={c.sessions}>
        <td>{c.label}</td><td>{c.referenceDate||"Unknown"}</td>
        <td>{c.change===null?"Unknown":c.unit==="bp"?signed(c.change)+" bp":
          (c.percent===null?"Unknown":signed(c.percent)+"%")}</td>
      </tr>)}</tbody></table>
    <p className={styles.help}>{card.caution}</p>
  </div>;
}
