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
 const [state,setState]=useState<"idle"|"loading">("idle");
 const [notice,setNotice]=useState("");
 const load=async()=>{
  if(state!=="idle")return;setState("loading");setNotice("");
  try{
   const r=await fetch("/api/owner/macropulse-briefs",{credentials:"same-origin",cache:"no-store"});
   const d=await r.json() as {briefs?:Brief[];error?:string};
   if(!r.ok||!d.briefs)throw Error(d.error||"Review queue unavailable");
   setBriefs(d.briefs);setNotice(d.briefs.length?"Read original links and check dates before relying on a claim.":"No new digests awaiting review.");
  }catch(e){setNotice(e instanceof Error?e.message:"Review queue unavailable");}
  finally{setState("idle");}
 };
 return <section className={css.workbench} data-owner-macropulse-queue="private-reading">
  <div className={css.head}><div>
   <p className={css.kicker}>MACROPULSE → BLUEBELLY · EDITORIAL DELIVERY</p>
   <h2>My MacroPulse research</h2>
   <p>Research briefs delivered here stay private. They are not source-verified News or canonical Dossier decisions.</p>
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
    <p className={css.warning}>PRIVATE RESEARCH ONLY · This is a source-attributed research lead, not independently verified News. Public publication is disabled.</p>
   </article>)}
  <p role="status" className={css.status}>{notice}</p>
 </section>;
}
