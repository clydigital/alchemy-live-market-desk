"use client";
import {useState} from "react";
import {DESK_CHARTS,type DailyArticleIdea} from "@/lib/blue-desk-daily-article-plan";
import styles from "./daily-article-studio.module.css";
type Packet={packet:string;assembledAt:string;notionStatus:string;warnings:string[];sourceUrls:string[];newsCount:number;deliveredBriefCount?:number;deliveredResearch?:{status:"AVAILABLE"|"UNAVAILABLE";count:number;caveat:string};health?:{status:string;sources:{macroPulsePosts:number;researchGapRuns:number};news:{within48h:number}};error?:string};
type Draft={text:string;busy:boolean;error:string};
export default function DailyArticleStudio(){
 const [packet,setPacket]=useState<Packet|null>(null);
 const [ideas,setIdeas]=useState<DailyArticleIdea[]>([]);
 const [drafts,setDrafts]=useState<Record<number,Draft>>({});
 const [sourceOverlap,setSourceOverlap]=useState<Record<number,{status:string;longestMatchedWords:number;note:string}>>({});
 const [busy,setBusy]=useState<"idle"|"research"|"plan"|"draft">("idle");
 const [notice,setNotice]=useState("");
 const read=async()=>{
  if(busy!=="idle")return;
  if(Object.values(drafts).some(d=>d.text)&&!window.confirm(
   "Read a new research packet? Previously generated drafts will be cleared."))return;
  setBusy("research");setNotice("");
  try{
   const res=await fetch("/api/owner/daily-research",{cache:"no-store",credentials:"same-origin"});
   const data=await res.json() as Packet;
   if(!res.ok||!data.packet)throw Error(data.error||"Source research unavailable");
   setPacket(data);setIdeas([]);setDrafts({});setSourceOverlap({});
   setNotice("Research loaded. Article ideas will follow the original source dates and coverage limits.");
  }catch(e){setNotice(e instanceof Error?e.message:"Research unavailable");}
  finally{setBusy("idle");}
 };
 const plan=async()=>{
  if(!packet||busy!=="idle")return;
  if(ideas.length&&!window.confirm("Replace your current four article ideas and drafts?"))return;
  setBusy("plan");setNotice("");
  try{
   const res=await fetch("/api/owner/daily-article-plan",{
    method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({packet:packet.packet,assembledAt:packet.assembledAt}),
   });
   const data=await res.json() as {ideas?:DailyArticleIdea[];error?:string};
   if(!res.ok||!data.ideas?.length)throw Error(data.error||"Article plan unavailable");
   setIdeas(data.ideas);setDrafts({});setSourceOverlap({});
   setNotice(data.ideas.length+" different article angles proposed. Every chart still needs to be opened and checked.");
  }catch(e){setNotice(e instanceof Error?e.message:"Article planning unavailable");}
  finally{setBusy("idle");}
 };
 const draftOne=async(index:number)=>{
  const idea=ideas[index];if(!idea||!packet)return;
  setDrafts(old=>({...old,[index]:{text:old[index]?.text||"",busy:true,error:""}}));
  const chart=idea.chartSymbols.map(c=>DESK_CHARTS[c]).filter(Boolean)
   .map((c,i)=>"Chart "+(i+1)+": "+c.label+" — "+c.prompt).join("\n");
  const brief="PRIVATE EDITORIAL ANGLE: "+idea.angle+"\nWHY THIS AFFECTS MARKETS: "+idea.whyItMatters+
   "\nSOURCE GAPS / COUNTERCASE: "+idea.whatToVerify+
   "\nCHARTS TO CHECK (NOT OBSERVED SIGNALS):\n"+chart+
   "\nWrite a fresh article in natural British English, moving from specific event ->"+
   " economic mechanism -> exposed asset -> countercase -> dated chart confirmation."+
   " Do not lift sentences from source pages or make a trade claim without a chart read.\n";
  try{
   const response=await fetch("/api/owner/editorial-generate",{
    method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({kind:idea.kind,action:"draft",title:idea.title,
      packet:(brief+packet.packet).slice(0,23500),existingBody:"",instructions:""}),
   });
   const data=await response.json() as {body?:string;error?:string;
    originalityReview?:{status:string;longestMatchedWords:number;note:string}};
   if(!response.ok||!data.body)throw Error(data.error||"Private generation unavailable");
   setDrafts(old=>({...old,[index]:{text:data.body||"",busy:false,error:""}}));
   if(data.originalityReview)setSourceOverlap(old=>({...old,[index]:data.originalityReview!}));
  }catch(e){setDrafts(old=>({...old,[index]:{text:old[index]?.text||"",busy:false,
   error:e instanceof Error?e.message:"Draft generation failed"}}));}
 };
 const all=async()=>{
  if(busy!=="idle"||!ideas.length)return;
  if(Object.values(drafts).some(d=>d.text)&&!window.confirm("Regenerate all drafts? Current drafts will be overwritten."))return;
  setBusy("draft");setNotice("");
  // Two requests at a time to respect private model caps and avoid unnecessary
  // four-way concurrent resource load. Each article remains editable separately.
  for(let i=0;i<ideas.length;i+=2)await Promise.all(ideas.slice(i,i+2).map((_idea,j)=>draftOne(i+j)));
  setBusy("idle");setNotice("Draft pass complete. Check each outcome, original source and chart before use.");
 };
 const copy=async(text:string)=>{
  try{await navigator.clipboard.writeText(text);setNotice("Article draft copied.");}
  catch{setNotice("Copy unavailable. Select the draft and copy it manually.");}
 };
 return <div className={styles.shell} data-private-daily-articles="original-four-drafts">
  <div className={styles.hero}>
    <p className={styles.eyebrow}>PRIVATE EDITORIAL DESK · NOT FOR PUBLICATION</p>
    <h1>Four stories worth writing today</h1>
    <p>One research pass, four different angles. We start with what happened,
      explain how the event can reach a market, and finish with the chart and source
      that could prove the idea wrong. Every piece is freshly written from the
      evidence; no outside article is copied into a finished draft.</p>
    <div className={styles.actions}>
      <button type="button" disabled={busy!=="idle"} onClick={read}>
        {busy==="research"?"Reading…":"1. Read today's research"}</button>
      <button type="button" disabled={!packet||busy!=="idle"} onClick={plan}>
        {busy==="plan"?"Planning…":"2. Plan 3–4 distinct articles"}</button>
      <button type="button" disabled={!ideas.length||busy!=="idle"} onClick={all}>
        {busy==="draft"?"Writing private drafts…":"3. Generate all private drafts"}</button>
    </div>
    {packet?<p className={styles.coverage}>Research assembled {packet.assembledAt}.
      {" "}Notion: {packet.notionStatus.replaceAll("_"," ").toLowerCase()}.
      {" "}Verified factual headlines in packet: {packet.newsCount}.
      {packet.health?.status?" · Research health: "+packet.health.status.replaceAll("_"," ").toLowerCase():""}
      {" "}Delivered editorial research drafts in packet: {packet.deliveredBriefCount||0}.\n      {" "}Gaps remain gaps; article generation does not cure missing evidence.</p>:null}
    {packet?.deliveredResearch?.status==="UNAVAILABLE"?<p className={styles.caveat}>The private research-delivery queue could not be read. Do not infer no new posts.</p>:null}
    <p role="status" className={styles.status}>{notice}</p>
  </div>
  {ideas.length?<div className={styles.grid}>{ideas.map((idea,i)=><article className={styles.card} key={idea.title}>
    <p className={styles.eyebrow}>{String(i+1).padStart(2,"0")} / {idea.kind==="COTD"?"CHART-LED FEATURE":"MARKET EXPLAINER"} · PRIVATE DRAFT</p>
    <h2>{idea.title}</h2>
    <p>{idea.angle}</p>
    <p><strong>Why it matters:</strong> {idea.whyItMatters}</p>
    <p className={styles.caveat}><strong>Check before writing:</strong> {idea.whatToVerify}</p>
    <h3>Charts to open</h3>
    <div className={styles.charts}>{idea.chartSymbols.map(symbol=>{
      const c=DESK_CHARTS[symbol];return c?<a key={symbol} target="_blank" rel="noopener noreferrer" href={c.link}>
        <strong>{c.label}</strong><span>{c.prompt}</span></a>:null;
    })}</div>
    {idea.chartChecks.map((check,j)=><p key={j} className={styles.chartCheck}>
      Chart check {j+1}: {check}</p>)}
    <div className={styles.actions}>
      <button type="button" disabled={drafts[i]?.busy||busy!=="idle"}
        onClick={()=>draftOne(i)}>{drafts[i]?.busy?"Writing…":drafts[i]?.text?"Regenerate draft":"Write original draft"}</button>
      {drafts[i]?.text?<button type="button" onClick={()=>copy(drafts[i].text)}>Copy draft</button>:null}
    </div>
    {drafts[i]?.error?<p className={styles.caveat}>{drafts[i].error}</p>:null}
    {sourceOverlap[i]?<p className={styles.caveat}>
      {sourceOverlap[i].status==="REVIEW_SOURCE_OVERLAP"?"Originality check: lengthy wording overlaps the supplied research. Rewrite and review the source before use.":"Originality check: no long exact phrasing detected in supplied notes."}
      {" "}{sourceOverlap[i].note}
    </p>:null}
    {drafts[i]?.text?<label className={styles.draftLabel}>
      Editable private article · all figures and original sources require review
      <textarea rows={19} value={drafts[i].text}
       onChange={e=>setDrafts(old=>({...old,[i]:{text:e.target.value,busy:false,error:old[i]?.error||""}}))}/>
    </label>:null}
  </article>)}</div>:<p className={styles.empty}>Load a current research packet to create today's article plan.
    No stories or charts will be invented merely to fill four slots.</p>}
 </div>;
}
