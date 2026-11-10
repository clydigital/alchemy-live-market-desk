import {getManualSweeps} from "@/lib/bluebelly-manual-sweeps";
import type {TopicInfluenceRead,InfluenceLead} from "@/lib/bluebelly-topic-influence";
import s from "./TopicInfluencePanel.module.css";

type Props={input:TopicInfluenceRead;compact?:boolean};
const stamp=(value:string)=>value.slice(0,16).replace("T"," ")+" UTC";
function reasonRow(item:InfluenceLead){
 return <li key={item.id} className={s.lead} data-influence-source={item.source}>
  <div className={s.meta}><span>{item.source==="X"?"X Wire":"Reviewed transcript"} · {item.sourceName}</span>
   <time dateTime={item.publishedAt}>Source {stamp(item.publishedAt)}</time></div>
  <strong>{item.reason}</strong>
  {item.source==="X"?<p>{item.excerpt}</p>:<p>Creator video: {item.title}. Transcript interpretation exists; the underlying claims are not independently verified here.</p>}
  <p className={s.test}><b>Check:</b> {item.nextCheck}</p>
  <div className={s.receipt}><small>{item.reviewedAt?"Captured "+stamp(item.reviewedAt):"Capture time unavailable"} · UNVERIFIED / NOT CANONICAL</small>
   <a href={item.url} target="_blank" rel="noopener noreferrer">Open original {item.source==="X"?"X post":"video"} ↗</a></div>
 </li>;
}
/** Fresh source records change the questions; only an editorially approved manual
 * sweep can add an authored, dated explanation. Neither changes Regime evidence. */
export default function TopicInfluencePanel({input,compact=false}:Props){
 const manual=getManualSweeps(input.topic,new Date(input.checkedAt));
 const leads=[...input.x,...input.creators].sort((a,b)=>b.publishedAt.localeCompare(a.publishedAt));
 return <section id={"influence-"+input.topic} className={compact?s.compact:s.panel}
   data-influence-topic={input.topic} data-influence-verification="unverified-discovery">
  <header className={s.heading}>
   <span>LIVE SOURCE REASONS / NO AUTOMATIC VERDICT</span>
   <h2>Why this is on watch</h2>
   <p>Automatically refreshed from the existing X Wire and completed transcript-review ledgers. These are reasons to investigate, not established causes or changes to the reviewed Regime outlook.</p>
   <small>Checked {stamp(input.checkedAt)} · X: {input.xState.toLowerCase()} · Transcripts: {input.creatorState.toLowerCase()}</small>
  </header>
  {leads.length?<ol className={s.reasons}>{leads.map(reasonRow)}</ol>:
   <p className={s.empty}>{input.xState==="UNAVAILABLE"||input.creatorState==="UNAVAILABLE"?
    "One or more research feeds are unavailable; no absence-of-news conclusion is possible.":
    "No matching recent, admitted X Wire or reviewed transcript reasons in these source windows."}</p>}
  {manual.map(sweep=><section key={sweep.id} className={s.manual} data-manual-sweep={sweep.id}>
   <div className={s.manualHead}><span>{sweep.date} — MANUAL SWEEP FINDINGS</span>
    <h3>{sweep.title}</h3><small>Research conducted {stamp(sweep.researchAt)} · Editorially committed, not live canonical Evidence</small></div>
   <ol>{sweep.findings.map((finding,index)=><li key={index}>
    <strong>{finding.reason}</strong>
    <small>{finding.status==="RESEARCH_LEAD"?"RESEARCH LEAD — NOT VERIFIED":
     finding.status==="CONTRADICTED"?"CONTRADICTED — SEE SOURCE":"SOURCE-CORROBORATED — SEE SOURCE"} · Source dated {stamp(finding.sourcePublishedAt)}</small>
    {finding.nextCheck?<p><b>Next check:</b> {finding.nextCheck}</p>:null}
    <a href={finding.sourceUrl} target="_blank" rel="noopener noreferrer">{finding.sourceName} ↗</a>
   </li>)}</ol>
  </section>)}
  <p className={s.caveat}>Auto-update = newly stored source receipts appear on page refresh, without a new schedule. X posts are unverified; completed transcript review does not make a creator claim true. Manual sweeps remain source-linked editorial research and cannot rewrite canonical Regime assessments.</p>
 </section>;
}
