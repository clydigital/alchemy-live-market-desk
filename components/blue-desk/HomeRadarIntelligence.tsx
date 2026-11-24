"use client";

import {createContext,useContext,useEffect,useId,useRef,useState,type ReactNode} from "react";
import type {HomeRadarRead,HomeRadarPulse} from "@/lib/bluebelly-home-radar-intelligence";
import ui from "./HomeRadarIntelligence.module.css";

type RadarContext={
 open:boolean;toggle:()=>void;contentId:string;
};
const radarContext=createContext<RadarContext|null>(null);
const icons:Record<HomeRadarPulse["kind"],string>={
 NEWS:"NEWS",BIG_MOVE:"MOVE",DIVERGENCE:"GAP",CREATOR:"ANALYST",
};
const descriptions:Record<HomeRadarPulse["kind"],string>={
 NEWS:"Latest verified news",BIG_MOVE:"Large observed daily move",
 DIVERGENCE:"Measured relative-performance divergence",
 CREATOR:"Owner-only transcript interpretation",
};
function useRadar(){
 const context=useContext(radarContext);
 if(!context)throw new Error("Radar trigger must be inside RadarIntelligenceShell.");
 return context;
}
function observed(value:string){
 if(/^\d{4}-\d{2}-\d{2}$/.test(value))return value+" · completed session";
 const t=Date.parse(value);
 if(!Number.isFinite(t))return "Time unverified";
 return new Intl.DateTimeFormat("en-GB",{timeZone:"Asia/Kuala_Lumpur",
  day:"numeric",month:"short",hour:"2-digit",minute:"2-digit",hour12:false}).format(new Date(t))+" MYT";
}
function Pulse({item,index}:{item:HomeRadarPulse;index:number}){
 const external=item.href.startsWith("https://");
 const source=item.sourceUrl&&item.sourceUrl!==item.href?item.sourceUrl:null;
 const sourceExternal=!!source&&source.startsWith("https://");
 return <article className={ui.pulse} data-radar-pulse={item.kind} data-pulse-id={item.id}>
  <div className={ui.pulseHead}>
   <span className={ui.counter}>{String(index+1).padStart(2,"0")}</span>
   <span className={ui.kind}>{icons[item.kind]}</span>
   <span className={ui.state}>{item.statusLabel}</span>
  </div>
  <h3><a href={item.href} {...(external?{target:"_blank",rel:"noopener noreferrer"}:{})}>{item.title}</a></h3>
  <p className={ui.summary}>{item.summary}</p>
  <p className={ui.why}>{item.why}</p>
  <div className={ui.clock}><span>{item.clockLabel}</span><time dateTime={item.observedAt}>{observed(item.observedAt)}</time></div>
  <nav className={ui.links} aria-label={descriptions[item.kind]+" links"}>
   <a href={item.href} {...(external?{target:"_blank",rel:"noopener noreferrer"}:{})}>Inspect <span aria-hidden="true">↗</span></a>
   {source?<a href={source} {...(sourceExternal?{target:"_blank",rel:"noopener noreferrer"}:{})}>
     {item.sourceLabel??"Original source"} <span aria-hidden="true">↗</span></a>:null}
  </nav>
 </article>;
}
/** The radar's owner-checked research is passed by the server route.
 * The UI never fetches privileged data or changes any Regime score. */
export default function RadarIntelligenceShell({
 read,children,
}:{read:HomeRadarRead;children:ReactNode}){
 const [open,setOpen]=useState(false);
 const contentId=useId();
 const panel=useRef<HTMLElement>(null);
 useEffect(()=>{
  if(!open)return;
  const reduced=window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  panel.current?.scrollIntoView({behavior:reduced?"instant":"smooth",block:"nearest"});
 },[open]);
 return <radarContext.Provider value={{open,toggle:()=>setOpen(value=>!value),contentId}}>
  {children}
  <section ref={panel} id={contentId} hidden={!open} className={ui.panel}
   data-home-radar-intelligence="source-dated-v1"
   data-radar-creator-access={read.creatorAccess}
   aria-label="Radar: what matters now" tabIndex={-1}>
   <header className={ui.header}>
    <div>
     <p className={ui.eyebrow}>RADAR INTELLIGENCE / CLICK ANY PULSE TO INVESTIGATE</p>
     <h2>What matters <em>now</em><span>.</span></h2>
     <p>Source-verified developments from the rolling 24 hours, plus the largest
      measured moves and same-session divergences. Private analyst transcripts are
      attributed opinions, not facts or automatic regime signals.</p>
    </div>
    <button className={ui.close} type="button" onClick={()=>setOpen(false)}>Close radar ×</button>
   </header>
   <div className={ui.wave} aria-hidden="true"><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/><i/></div>
   <div className={ui.coverage}>
    <span><strong>{read.newsCount}</strong> verified 24h headlines</span>
    <span><strong>{read.moveCount}</strong> large daily moves</span>
    <span><strong>{read.divergenceCount}</strong> matched divergences</span>
    <span><strong>{read.creatorCount}</strong> reviewed creator takes</span>
   </div>
   {read.items.length?
    <div className={ui.rail} tabIndex={0} role="region" aria-label="Scrollable market intelligence pulses">
     {read.items.map((item,i)=><Pulse key={item.id} item={item} index={i}/>)}
    </div>:
    <p className={ui.empty} role="status">No source-qualified pulse meets this radar's current admission rules.
     This is a coverage gap, not evidence that markets are quiet.</p>}
   <footer className={ui.footer}>
    <p><a href="/markets/scanner">Open market scanner →</a></p>
    <p><b>Time windows:</b> News is restricted to the past 24 hours ({observed(read.windowStart)}–{observed(read.windowEnd)}).
     Market moves and divergences use their separately dated latest trading sessions (up to four calendar days).
     Price moves do not prove what caused them.</p>
    <p>{read.creatorAccess==="PRIVATE_LOCKED"?
      <>Transcript-based takes are private. <a href="/my-reports">Sign in to My Desk</a> to inspect reviewed creator reasoning.</>:
      read.creatorAccess==="NO_RECENT_REVIEWED"?
      "No recently reviewed creator digest met the provenance and freshness rules. No opinion was inferred.":
      "Creator claims shown only in an authorised owner session. Independent price/source checks remain separate."}</p>
   </footer>
  </section>
 </radarContext.Provider>;
}
export function RadarIntelligenceTrigger({children,className}:{
 children:ReactNode;className?:string;
}){
 const {open,toggle,contentId}=useRadar();
 return <button type="button" onClick={toggle} className={className}
  aria-label={open?"Close radar intelligence":"Open radar intelligence: what matters now"}
  aria-controls={contentId} aria-expanded={open} data-radar-control="open-intelligence">
  {children}
 </button>;
}
