"use client";
import {useState} from "react";
import css from "./daily-report-writer.module.css";
type SourceLink={url:string;label:string;kind:string};
type Brief={
 id:string;digest_sha256:string;source_pulse_id:string;source_page_url:string;
 source_published_at:string;headline:string;standfirst:string;
 what_changed:string;why_it_matters:string;countercase:string;
 watch_next:string;source_links:SourceLink[];
};
type Checks={sources:boolean;clocks:boolean;countercase:boolean;publicLabel:boolean};
const EMPTY:Checks={sources:false,clocks:false,countercase:false,publicLabel:false};
export default function MacroPulseBriefQueue(){
 const [briefs,setBriefs]=useState<Brief[]>([]);
 const [checks,setChecks]=useState<Record<string,Checks>>({});
 const [state,setState]=useState<"idle"|"loading"|"publishing">("idle");
 const [notice,setNotice]=useState("");
 const load=async()=>{
  if(state!=="idle")return;
  setState("loading");setNotice("");
  try{
   const r=await fetch("/api/owner/macropulse-briefs",{credentials:"same-origin",cache:"no-store"});
   const d=await r.json() as {briefs?:Brief[];error?:string};
   if(!r.ok||!d.briefs)throw Error(d.error||"Review queue unavailable");
   setBriefs(d.briefs);setChecks({});
   setNotice(d.briefs.length
    ?"Read original links and check event clocks before any public research approval."
    :"No new digests awaiting review.");
  }catch(e){setNotice(e instanceof Error?e.message:"Review queue unavailable");}
  finally{setState("idle");}
 };
 const mark=(id:string,field:keyof Checks,value:boolean)=>
  setChecks(prev=>({...prev,[id]:{...(prev[id]||EMPTY),[field]:value}}));
 const approve=async(brief:Brief)=>{
  const check=checks[brief.id]||EMPTY;
  if(state!=="idle"||!Object.values(check).every(Boolean))return;
  setState("publishing");setNotice("");
  try{
   const r=await fetch("/api/owner/macropulse-briefs",{
    method:"POST",credentials:"same-origin",cache:"no-store",
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({
      id:brief.id,digestSha256:brief.digest_sha256,
      checkedSources:check.sources,checkedTimeWindows:check.clocks,
      checkedCountercase:check.countercase,approvePublicResearch:check.publicLabel,
    }),
   });
   const d=await r.json() as {status?:string;id?:string;error?:string};
   if(!r.ok||d.status!=="published"||d.id!==brief.id)
    throw Error(d.error||"Approval was not verified");
   setBriefs(prev=>prev.filter(x=>x.id!==brief.id));
   setChecks(prev=>{const next={...prev};delete next[brief.id];return next;});
   setNotice("Owner-reviewed research published. Check public Today and Newsroom; this is not source-verified breaking news.");
  }catch(e){setNotice(e instanceof Error?e.message:"Publication unavailable");}
  finally{setState("idle");}
 };
 return <section id="macropulse-review" className={css.workbench} data-owner-macropulse-queue="private-review">
  <div className={css.head}><div>
    <p className={css.kicker}>MACROPULSE → BLUEBELLY · EDITORIAL REVIEW</p>
    <h2>Review incoming research dispatches</h2>
    <p>Delivery is private. Publication requires explicit owner approval after original-source and timeline checks. It never changes canonical evidence or a market Regime.</p>
   </div>
   <button type="button" disabled={state!=="idle"} onClick={()=>void load()}>
    {state==="loading"?"Loading…":"Load proposed briefs"}</button>
  </div>
  {briefs.map(brief=>{
   const checked=checks[brief.id]||EMPTY;
   const ready=Object.values(checked).every(Boolean);
   return <article key={brief.id} className={css.panel} data-owner-review-pulse={brief.id}
      style={{marginBottom:16}}>
    <h3>{brief.headline}</h3>
    <p><strong>Source Pulse:</strong> {brief.source_pulse_id} · {brief.source_published_at}</p>
    <p><a target="_blank" rel="noreferrer" href={brief.source_page_url}>Original MacroPulse research</a></p>
    <p><strong>Standfirst:</strong> {brief.standfirst}</p>
    <p><strong>What changed:</strong> {brief.what_changed}</p>
    <p><strong>Why it may matter:</strong> {brief.why_it_matters}</p>
    <p><strong>Countercase:</strong> {brief.countercase}</p>
    <p><strong>Watch next:</strong> {brief.watch_next}</p>
    <h4>Source links — verify individually</h4>
    {brief.source_links.map(link=><p key={link.url}>
      {link.kind} · <a target="_blank" rel="noopener noreferrer" href={link.url}>{link.label}</a>
    </p>)}
    <div style={{display:"grid",gap:10,margin:"12px 0"}}>
      <label><input type="checkbox" checked={checked.sources} onChange={e=>mark(brief.id,"sources",e.target.checked)}/>
        {" "}I opened and checked the original sources and separated attributed reporting from established facts.</label>
      <label><input type="checkbox" checked={checked.clocks} onChange={e=>mark(brief.id,"clocks",e.target.checked)}/>
        {" "}I checked event, publication and observation clocks; no price reaction is implied without a measured window.</label>
      <label><input type="checkbox" checked={checked.countercase} onChange={e=>mark(brief.id,"countercase",e.target.checked)}/>
        {" "}I checked the countercase and next test and corrected misleading assertions before approval.</label>
      <label><input type="checkbox" checked={checked.publicLabel} onChange={e=>mark(brief.id,"publicLabel",e.target.checked)}/>
        {" "}Publish this as attributed, owner-reviewed research, NOT independently verified breaking news.</label>
    </div>
    <button type="button" disabled={!ready||state!=="idle"} onClick={()=>void approve(brief)}>
      {state==="publishing"?"Publishing…":"Approve research dispatch for Bluebelly"}
    </button>
    <p className={css.warning}>UNREVIEWED UNTIL APPROVED · No automatic public publication.</p>
   </article>;
  })}
  <p role="status" className={css.status}>{notice}</p>
 </section>;
}
