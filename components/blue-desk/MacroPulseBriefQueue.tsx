"use client";
import {useState} from "react";
import css from "./daily-report-writer.module.css";
type Link={url:string;label:string;kind:string};
type Brief={
 id:string;source_pulse_id:string;source_page_url:string;source_published_at:string;
 headline:string;standfirst:string;what_changed:string;why_it_matters:string;
 countercase:string;watch_next:string;source_links:Link[];
};
export default function MacroPulseBriefQueue(){
 const [briefs,setBriefs]=useState<Brief[]>([]);
 const [checked,setChecked]=useState<Record<string,boolean[]>>({});
 const [state,setState]=useState<"idle"|"loading"|"publishing">("idle");
 const [notice,setNotice]=useState("");
 const load=async()=>{
  if(state!=="idle")return;setState("loading");setNotice("");
  try{
   const r=await fetch("/api/owner/macropulse-briefs",{credentials:"same-origin",cache:"no-store"});
   const d=await r.json() as {briefs?:Brief[];error?:string};
   if(!r.ok||!d.briefs)throw Error(d.error||"Review queue unavailable");
   setBriefs(d.briefs);setNotice(d.briefs.length?"Review original links and qualifications before publishing.":"No new digests awaiting review.");
  }catch(e){setNotice(e instanceof Error?e.message:"Review queue unavailable");}
  finally{setState("idle");}
 };
 const publish=async(id:string)=>{
  if(state!=="idle"||!(checked[id]||[]).every(Boolean)||
     (checked[id]||[]).length!==3)return;
  if(!window.confirm("Publish this attributed MacroPulse research digest? It is NOT verified News and will be displayed as a dated, research-derived analysis."))return;
  setState("publishing");setNotice("");
  try{
   const r=await fetch("/api/owner/macropulse-briefs",{
    method:"POST",credentials:"same-origin",headers:{"Content-Type":"application/json"},
    body:JSON.stringify({id,action:"publish",sourcesChecked:true,qualificationsChecked:true,copyApproved:true}),
   });
   const d=await r.json() as {error?:string};
   if(!r.ok)throw Error(d.error||"Publication rejected");
   setBriefs(previous=>previous.filter(b=>b.id!==id));
   setNotice("Research digest published to the public Daily Report, marked as research-derived rather than independently verified News.");
  }catch(e){setNotice(e instanceof Error?e.message:"Publication failed");}
  finally{setState("idle");}
 };
 return <section className={css.workbench} data-owner-macropulse-queue="approval-required">
  <div className={css.head}><div>
   <p className={css.kicker}>MACROPULSE → BLUEBELLY · EDITORIAL DELIVERY</p>
   <h2>Research digest review</h2>
   <p>Composio/ChatGPT may submit attributed drafts here. Dossier, Motion
     verification and immutable approved PDF articles are separate workflows.</p>
   </div>
   <button type="button" disabled={state!=="idle"} onClick={load}>
    {state==="loading"?"Reading review queue…":"Load proposed briefs"}</button>
  </div>
  {briefs.map(brief=><article key={brief.id} className={css.panel} style={{marginBottom:16}}>
    <h3>{brief.headline}</h3>
    <p><strong>Source Pulse:</strong> {brief.source_pulse_id} · {brief.source_published_at}</p>
    <p><a target="_blank" rel="noreferrer" href={brief.source_page_url}>Original MacroPulse research</a></p>
    <p><strong>Standfirst:</strong> {brief.standfirst}</p>
    <p><strong>What changed:</strong> {brief.what_changed}</p>
    <p><strong>Why it matters:</strong> {brief.why_it_matters}</p>
    <p><strong>Countercase:</strong> {brief.countercase}</p>
    <p><strong>Watch next:</strong> {brief.watch_next}</p>
    <h4>Original-source and reported links (verify individually)</h4>
    {brief.source_links.map(link=><p key={link.url}>
      {link.kind} · <a target="_blank" rel="noopener noreferrer" href={link.url}>{link.label}</a>
    </p>)}
    {[
      "I opened the sources and confirmed dates, attribution, units and any directly quoted claims.",
      "I checked that unverified physical flows, price reactions and causal explanations remain labelled as uncertain.",
      "I reviewed the reader-facing copy and permit this research-derived digest to appear publicly.",
    ].map((label,i)=><label key={i} style={{display:"flex",alignItems:"start",gap:10}}>
      <input type="checkbox" style={{width:18,marginTop:4}}
       checked={Boolean(checked[brief.id]?.[i])}
       onChange={e=>setChecked(old=>({...old,[brief.id]:
         [0,1,2].map(j=>j===i?e.target.checked:Boolean(old[brief.id]?.[j]))}))}/>
      {label}
    </label>)}
    <button type="button" disabled={state!=="idle"||checked[brief.id]?.filter(Boolean).length!==3}
      onClick={()=>publish(brief.id)}>Approve research digest for Bluebelly</button>
   </article>)}
  <p role="status" className={css.status}>{notice}</p>
 </section>;
}
