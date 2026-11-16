import type {LiveLensResearch} from "@/lib/bluebelly-regime-live-research";
import type {LensCardSignal} from "@/lib/bluebelly-regime-lens-card-signal";

export function RegimeLiveCardEvidence({read}:{read:LiveLensResearch}){
 const latest=read.facts[0]??read.briefs[0]??read.leads[0];
 const label=read.facts.length?"SOURCE-QUALIFIED":read.briefs.length?"PUBLISHED RESEARCH · UNADJUDICATED":read.leads.length?"ATTRIBUTED LEAD · UNVERIFIED":"NO FRESH MATCH";
 return <div data-live-lens-research={label} style={{borderTop:"1px solid var(--bb-card-border)",paddingTop:10,marginTop:8}}>
  <small style={{color:"var(--bb-muted)"}}>{label}{latest?" · "+latest.at.slice(0,10):""}</small>
  <p style={{fontSize:13,margin:"5px 0",lineHeight:1.45}}>{latest?latest.title.slice(0,240):read.partial?"Source coverage incomplete; current evidence unavailable.":"No fresh matching evidence in the bounded shared feed."}</p>
  <small>{latest?latest.source+" · ":""}{read.facts.length} facts / {read.briefs.length} research / {read.leads.length} leads{read.partial?" · partial coverage":""}</small>
 </div>;
}

export default function RegimeLiveEvidence({read,signal}:{read:LiveLensResearch;signal:LensCardSignal}){
 const groups=[{label:"Source-qualified observations",rows:read.facts},{label:"Published research · unadjudicated",rows:read.briefs},{label:"Attributed X / creator leads · unverified",rows:read.leads}];
 return <section id="live-evidence" data-live-regime-evidence="shared-research-projection" style={{border:"1px solid var(--bb-card-border)",background:"var(--bb-surface)",borderRadius:10,padding:18,margin:"16px 0"}}>
  <small style={{color:"var(--bb-muted)"}}>AUTOMATIC / EXISTING RESEARCH FEEDS · REFRESHES EVERY 10 MINUTES WHILE OPEN</small>
  <h2 style={{margin:"8px 0"}}>Latest evidence &amp; market reading</h2>
  <div data-lens-status={signal.tone}><strong>{signal.label} · {signal.readout}</strong><p>{signal.scope} · {signal.sourceDate??"No current source session"}</p></div>
  {read.partial?<p>Some readers are unavailable. Missing inputs do not establish that the outlook is unchanged.</p>:null}
  {groups.map(group=><div key={group.label} style={{marginTop:14}}><h3 style={{fontSize:16,margin:"0 0 8px"}}>{group.label} ({group.rows.length})</h3>
   {!group.rows.length?<small>No fresh matching records in this bounded feed.</small>:group.rows.map(row=><article key={row.id+row.url} style={{borderTop:"1px solid var(--bb-card-border)",padding:"10px 0"}}>
    <small>{row.source} · {row.at.slice(0,10)} UTC</small><p style={{margin:"5px 0"}}><a href={row.url} target="_blank" rel="noopener noreferrer"><strong>{row.title}</strong></a></p>{row.detail?<p style={{margin:0}}>{row.detail}</p>:null}
   </article>)}
  </div>)}
  <small>These are read-time topical matches of stored research, not a new canonical verdict. Historical reviewed assessments remain available below.</small>
 </section>;
}
