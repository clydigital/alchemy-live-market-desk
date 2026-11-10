import type {TopicInfluenceRead,InfluenceLead,InfluenceSourceState} from "@/lib/bluebelly-topic-influence";
import s from "./TopicInfluencePanel.module.css";

type Props={input:TopicInfluenceRead;compact?:boolean};
function sourceList(label:string,state:InfluenceSourceState,rows:InfluenceLead[]){
 return <div className={s.sourceGroup}>
  <h3>{label} <small>{rows.length} lead{rows.length===1?"":"s"}</small></h3>
  {rows.length?rows.map(item=><article key={item.id} className={s.lead} data-influence-source={item.source}>
   <div className={s.meta}><span>{item.sourceName} · {item.source==="CREATOR"?"Transcript-backed commentary":"Public X post"}</span>
    <span>Published {item.publishedAt.slice(0,16).replace("T"," ")} UTC</span></div>
   <strong>{item.title}</strong>
   <p>{item.excerpt}</p>
   <p className={s.test}><b>Next check:</b> {item.nextCheck}</p>
   <small>{item.reviewedAt?"Research capture: "+item.reviewedAt.slice(0,16).replace("T"," ")+" UTC":"Capture clock not supplied"} · UNVERIFIED / NOT CANONICAL</small>
   <a href={item.url} target="_blank" rel="noopener noreferrer">Original {item.source==="X"?"post":"video"} ↗</a>
  </article>):
   <p className={s.empty}>{state==="UNAVAILABLE"?
    "Source reader unavailable; this is not evidence of no news.":
    label==="X Wire"?"No matching recent stored posts in the available 48-hour window.":
    "No matching transcript-reviewed creator arguments in the available 14-day window."}</p>}
 </div>;
}
/** One source-attributed, bounded feed; no verified market outcome or editorial promotion. */
export default function TopicInfluencePanel({input,compact=false}:Props){
 return <section id={"influence-"+input.topic} className={compact?s.compact:s.panel}
   data-influence-topic={input.topic} data-influence-verification="unverified-discovery">
  {!compact?<header className={s.heading}>
   <span>NEW QUESTIONS / SOURCE-ATTRIBUTED DISCOVERY</span>
   <h2>{input.topic==="ai"?"What creators and X Wire are making us check":"Fresh leads to test"}</h2>
   <p>Recent commentary may introduce an investigation or countercase. It cannot revise the reviewed outlook until original sources and market observations support a change.</p>
  </header>:<p className={s.compactIntro}>Unverified public posts and transcript-reviewed creator interpretations. Use them to decide what to investigate, not as evidence of a deal, market move or regime change.</p>}
  <div className={s.groups}>
   {sourceList("X Wire",input.xState,input.x)}
   {sourceList("Creator transcripts",input.creatorState,input.creators)}
  </div>
  <p className={s.caveat}>Topic relevance is not verification. Published source time differs from collection and interpretation time; raw transcripts and private research notes are not displayed. No automatic Story or Regime change.</p>
 </section>;
}
