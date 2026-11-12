import Link from "next/link";
import type {PowerStackResearchGroup} from "@/lib/power-stack-research-links";
import {powerStackResearchHref} from "@/lib/power-stack-research-links";
import s from "@/app/power-stack/private-power-stack.module.css";

const sourceDate=(iso:string)=>iso.slice(0,10);
const state=(status:string)=>status==="SOURCE_CORROBORATED"?"SOURCE-CORROBORATED":
 status==="CONTRADICTED"?"CONTRADICTED":"RESEARCH LEAD";
export default function PowerStackResearchImpact({groups}:{
 groups:readonly PowerStackResearchGroup[];
}){
 const relevant=new Set(groups.flatMap(group=>group.assets.map(asset=>asset.ticker)));
 return <section className={s.section} id="power-stack-research-impact"
   data-power-stack-research-impact="owner-sourced-not-canonical"
   aria-labelledby="power-stack-research-title">
  <div className={s.researchHeading}>
   <div>
    <p className={s.researchEyebrow}>PRIVATE / SOURCE-LINKED CONTEXT</p>
    <h2 id="power-stack-research-title">Research affecting my portfolio</h2>
    <p>Matched against your recorded holdings, watchlist and bond ideas, not live brokerage positions.
     This projects Bluebelly's existing Regime, Hormuz, X Wire and reviewed creator research.
     It does not re-score assets or imply that a sector headline proves an issuer-specific change.</p>
   </div>
   <div className={s.researchCount} aria-label="Power Stack research matching coverage">
    <strong>{relevant.size}</strong>
    <span>MATCHED SYMBOLS</span>
    <small>{groups.length} research lenses</small>
   </div>
  </div>
  {groups.length?<div className={s.researchGrid}>
   {groups.map(group=><article key={group.topic} className={s.researchCard}
      data-power-stack-impact-topic={group.topic}>
    <div className={s.researchCardTop}>
     <span className={s.researchEyebrow}>{group.channel}</span>
     <Link href={powerStackResearchHref(group.topic)} className={s.researchDeepLink}>Open {group.title} ↗</Link>
    </div>
    <h3>{group.title}</h3>
    {group.assets.length?
     <div className={s.researchAssets}>
      {group.assets.slice(0,12).map(asset=><span key={asset.ticker} className={s.researchAsset}
       title={asset.name+" · "+(asset.scope==="archived_holding"?"historical holding":asset.scope==="archived_watchlist"?"historical watchlist":"bond idea")}>
       {asset.ticker}<small>{asset.scope==="archived_holding"?"H":asset.scope==="bond_watch"?"B":"W"}</small>
      </span>)}
      {group.assets.length>12?<details className={s.researchMoreAssets}>
       <summary>+{group.assets.length-12} more matched symbols</summary>
       <div className={s.researchAssets}>{group.assets.slice(12).map(asset=>
        <span key={asset.ticker} className={s.researchAsset}>{asset.ticker}</span>)}</div>
      </details>:null}
     </div>:
     <p className={s.researchGeneral}>Market-wide lens · no individual holding-specific claim</p>}
    <p className={s.researchTransmission}>{group.transmission}</p>
    {group.manuals.map(sweep=><div key={sweep.id} className={s.researchManual}
      data-power-stack-manual-source={sweep.id}>
     <span className={s.researchEyebrow}>{sweep.date} · MANUAL SWEEP FINDINGS</span>
     <h4>{sweep.title}</h4>
     <ol className={s.researchFindings}>{sweep.findings.slice(0,2).map((finding,index)=>
      <li key={sweep.id+":"+index}>
       <p>{finding.reason}</p>
       <div className={s.researchSourceLine}>
        <small>{state(finding.status)} · {sourceDate(finding.sourcePublishedAt)}</small>
        <a href={finding.sourceUrl} target="_blank" rel="noopener noreferrer">{finding.sourceName} ↗</a>
       </div>
       {finding.nextCheck?<small>Next: {finding.nextCheck}</small>:null}
      </li>)}</ol>
    </div>)}
    {group.leads.length?<div className={s.researchLeads}>
     <span className={s.researchEyebrow}>AUTOMATIC / UNVERIFIED SOURCE LEADS</span>
     <ul>{group.leads.map(lead=><li key={lead.id}>
      <span>{lead.source==="X"?"X Wire":"Reviewed video"} · {sourceDate(lead.publishedAt)}</span>
      <a href={lead.url} target="_blank" rel="noopener noreferrer">{lead.sourceName}: {lead.reason} ↗</a>
     </li>)}</ul>
    </div>:null}
    {!group.manual&&!group.leads.length?<p className={s.researchGeneral}>
     Source reader unavailable; no conclusion is drawn from missing information.</p>:null}
   </article>)}
  </div>:<p className={s.researchGeneral}>No source-linked research matches the currently recorded instruments.
   This does not establish that the investment theses are unchanged.</p>}
  <p className={s.researchDisclaimer}>H = archived holding · W = watchlist · B = bond idea. These are relevance links,
   not buy/sell signals or automatically verified issuer findings. The source date is not a quote timestamp.
   Original holdings, rankings, entry conditions and invalidation rules remain unchanged.</p>
 </section>;
}
