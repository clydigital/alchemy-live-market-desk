import Link from "next/link";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import {DESK_EDITORIAL_EDITION,DESK_EDITORIAL_UPDATES,DESK_WATCHLIST} from "@/lib/bluebelly-current-editorial";
import {editorialCalendarDay,isEditorialUpdatedToday} from "@/lib/bluebelly-editorial-freshness";

const shell:React.CSSProperties={border:"1px solid var(--bb-line,var(--bb-card-border))",background:"var(--bb-surface,#082b3c)",color:"var(--bb-text,#edf8ff)",padding:"clamp(16px,2.4vw,26px)",margin:"12px 0 20px"};
const muted:React.CSSProperties={color:"var(--bb-muted,#abc8d2)",fontSize:12,lineHeight:1.6};
const updated:React.CSSProperties={display:"inline-block",border:"1px solid var(--bb-accent,#65d6eb)",padding:"3px 8px",fontSize:10,fontWeight:800,letterSpacing:".06em",color:"var(--bb-accent,#65d6eb)",whiteSpace:"nowrap",marginLeft:9};
const linkStyle:React.CSSProperties={color:"var(--bb-accent,#8edcf7)",fontWeight:750,textDecoration:"underline",textUnderlineOffset:3};
export function EditorialUpdatedToday({initialPublishedOn,editorialUpdatedAt,now}:{
 initialPublishedOn:string;editorialUpdatedAt?:string|null;now:Date;
}){
 return isEditorialUpdatedToday(initialPublishedOn,editorialUpdatedAt,now)
  ?<span style={updated} data-editorial-updated-today="MYT" title="Editorial content amended today, Malaysia time; not the time the page was viewed">Updated today · MYT</span>:null;
}
export default function CurrentMarketUpdates({host,mode="full",now=new Date()}:{
 host:string|null;mode?:"mast"|"full"|"compact";now?:Date;
}){
 const isCurrent=editorialCalendarDay(now)===DESK_EDITORIAL_EDITION;
 const href=(path:string)=>blueDeskPublicHref("/blue-desk"+path,host);
 const dateLabel="4 NOV 2026";
 const [lead,sweden,amd]=DESK_EDITORIAL_UPDATES;
 if(mode==="mast")return <div data-bluebelly-date-brief="2026-11-04" style={{
  display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:8,
  padding:"9px clamp(18px,2.5vw,40px)",background:"var(--bb-raised,#062b3c)",borderBottom:"1px solid var(--bb-line,#31596d)",
  color:"var(--bb-text,#effaff)",fontSize:12,
 }}>
  <span><strong>{isCurrent?"4 NOV · LATEST EDITORIAL":"DATED EDITORIAL · "+dateLabel}</strong>{" · "}{lead.headline}
   <EditorialUpdatedToday initialPublishedOn={lead.initialPublishedOn} editorialUpdatedAt={lead.editorialUpdatedAt} now={now}/>
  </span>
  <Link href={href(lead.readerHref)} style={linkStyle}>Read updated story →</Link>
 </div>;
 return <section data-bluebelly-current-editorial={DESK_EDITORIAL_EDITION} style={shell} aria-label="4 November market updates and what to view">
  <div style={{display:"flex",alignItems:"baseline",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
   <span style={{fontSize:11,fontWeight:800,letterSpacing:".12em",color:"var(--bb-accent,#74d9ed)"}}>
    {isCurrent?"TODAY'S EDITORIAL UPDATES":"DATED DESK RESEARCH"} · {dateLabel}
   </span>
   <Link style={linkStyle} href={href("/newsroom")}>Browse all verified news →</Link>
  </div>
  <h2 style={{fontSize:mode==="full"?"clamp(23px,3vw,34px)":"clamp(18px,2.5vw,25px)",lineHeight:1.2,margin:"10px 0",color:"var(--bb-text,#effaff)"}}>
   The election changed the tape. The data still disagree.
  </h2>
  <p style={{maxWidth:"100ch",margin:"0 0 18px",lineHeight:1.6}}>
   An initial AI-led sell-off turned into a partial rebound as markets reassessed the Democratic congressional sweep.
   AMD delivered strong chip sales but weaker quarterly cash generation, while Sweden raised rates because of inflation and energy costs.
   These are different developments, not proof of one unified risk-on or risk-off regime.
  </p>
  <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,265px),1fr))",gap:12}}>
   {[lead,sweden,amd].map(item=><article key={item.id} data-market-update-card={item.id} style={{
    border:"1px solid var(--bb-line,#2e596d)",background:"var(--bb-canvas,#051d2c)",padding:16,minWidth:0,
   }}>
    <p style={{...muted,margin:"0 0 8px",fontWeight:750}}>{item.topics.join(" / ").toUpperCase()} · {item.sourceDay}
      <EditorialUpdatedToday initialPublishedOn={item.initialPublishedOn} editorialUpdatedAt={item.editorialUpdatedAt} now={now}/>
    </p>
    <h3 style={{fontSize:16,lineHeight:1.35,margin:"0 0 9px",color:"var(--bb-text,#effaff)"}}>
     <Link href={href(item.readerHref)} style={{color:"inherit",textDecoration:"none"}}>{item.headline}</Link>
    </h3>
    <p style={{fontSize:13,lineHeight:1.55,margin:"0 0 12px"}}>{item.summary}</p>
    {mode==="full"?<p style={muted}><strong>What changes the reading:</strong> {item.nextTest}</p>:null}
    <div style={{display:"flex",flexWrap:"wrap",gap:12,fontSize:12}}>
     <Link href={href(item.readerHref)} style={linkStyle}>Full explanation →</Link>
     <a href={item.sourceUrl} style={linkStyle} rel="noopener noreferrer" target="_blank">Original source ↗</a>
    </div>
   </article>)}
  </div>
  {mode==="full"?<div style={{marginTop:20}}>
   <h3 style={{fontSize:15,margin:"0 0 9px"}}>What to view next</h3>
   <div data-market-watchlist="dated-and-testable" style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(min(100%,240px),1fr))",gap:10}}>
    {DESK_WATCHLIST.map(row=><div key={row.title} style={{borderTop:"1px solid var(--bb-line,#325a67)",padding:"12px 0"}}>
      <strong style={{fontSize:13}}>{row.title}</strong>
      <p style={{...muted,margin:"5px 0"}}>{row.instruments}</p>
      <p style={{fontSize:12,margin:"5px 0 8px"}}>{row.question}</p>
      <Link href={href(row.href)} style={linkStyle}>Open watch →</Link>
    </div>)}
   </div>
  </div>:null}
  <p style={{...muted,margin:"15px 0 0"}}>Source-dated 4 November editorial; not a live quote screen. Election results (AP), global market interpretation (Reuters), issuer figures (AMD) and the Swedish policy decision (Riksbank) have separate sources. No causality or analyst-consensus surprise is invented. {isCurrent?"Updated labels refer to recorded editorial revisions today in Malaysia.":"This is a previous edition; no story is marked updated today."}</p>
 </section>;
}
