import Link from "next/link";
import DualTimestamp from "./DualTimestamp";
import type {PublicResearchFocus} from "@/lib/blue-desk-published-research-focus";

type Mode="today"|"newsroom"|"market"|"hormuz";
export default function PublishedResearchDispatches({
 items,mode="today",readerHref="/newsroom",
}:{items:readonly PublicResearchFocus[];mode?:Mode;readerHref?:string}){
 if(!items.length)return null;
 const compact=mode==="market"||mode==="hormuz";
 const name=mode==="today"?"Latest reviewed research":
  mode==="newsroom"?"Reviewed research dispatches":
  mode==="hormuz"?"Research context for Hormuz":"Research context for energy markets";
 return <section id={mode==="newsroom"?"research-dispatches":undefined}
  data-published-research-dispatches={mode} aria-label={name}
  style={{margin:"20px 0",border:"1px solid var(--border, #566675)",borderRadius:12,padding:"14px 18px"}}>
   <header style={{marginBottom:12}}>
    <p style={{fontSize:11,letterSpacing:".12em",fontWeight:750,marginBottom:5}}>
     BLUEBELLY / SOURCE-DATED RESEARCH · OWNER REVIEWED</p>
    <h2 style={{fontSize:compact?18:23,margin:"4px 0 8px"}}>{name}</h2>
    <p style={{fontSize:13,opacity:.82,margin:0}}>
     Attributed editorial interpretation, not independently source-verified breaking news
     or a canonical Story/Regime decision. Original event dates are preserved.
    </p>
   </header>
   <div style={{display:"grid",gridTemplateColumns:compact?"1fr":"repeat(auto-fit,minmax(min(100%,300px),1fr))",gap:12}}>
    {items.slice(0,compact?2:3).map(item=><article key={item.id}
     data-research-dispatch={item.id}
     style={{padding:"12px 14px",border:"1px solid var(--border, #566675)",borderRadius:8}}>
      <small style={{fontWeight:700}}>RESEARCH-DERIVED · NOT CANONICAL · {item.region.toUpperCase()}</small>
      <h3 style={{fontSize:compact?16:19,margin:"8px 0"}}>{item.headline}</h3>
      <p>{item.standfirst}</p>
      <p><strong>Why it could matter:</strong> {item.whyItMatters}</p>
      <details><summary>Countercase, next test and source provenance</summary>
       <p><strong>What changed:</strong> {item.whatChanged}</p>
       <p><strong>Countercase:</strong> {item.countercase}</p>
       <p><strong>Watch next:</strong> {item.nextTest}</p>
       <p>Original research edition: <DualTimestamp value={item.sourcePublishedAt}/></p>
       <p>Owner approval: <DualTimestamp value={item.reviewedAt}/></p>
       <ul>{item.sourceLinks.map(link=><li key={link.url}>
        <a href={link.url} target="_blank" rel="noopener noreferrer">{link.label} · {link.kind}</a>
       </li>)}</ul>
      </details>
      <p style={{fontSize:12,margin:"10px 0 0"}}>
       Source edition: <DualTimestamp value={item.sourcePublishedAt}/> ·{" "}
       <a href={item.sourcePageUrl} target="_blank" rel="noopener noreferrer">Original research ↗</a>
       {mode!=="newsroom"?<> · <Link href={readerHref+"#research-dispatches"}>Newsroom research context →</Link></>:null}
      </p>
     </article>)}
   </div>
  </section>;
}
