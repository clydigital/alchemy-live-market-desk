import Link from "next/link";
import EditorialStoryArt from "./EditorialStoryArt";
import DualTimestamp from "./DualTimestamp";
import type {decisionTopics} from "@/lib/bluebelly-decision-brief";
import s from "./NewsroomBriefableEvents.module.css";
type Topic=ReturnType<typeof decisionTopics>[number];

/** Separate verified/scheduled decision lane. This is not a second news feed. */
export default function NewsroomBriefableEvents({topics,readerHref}:{topics:readonly Topic[];readerHref:string}){
 const items=topics.filter(t=>t.status==="UPCOMING"||t.status==="FEATURE"||t.href.startsWith("?brief=")).slice(0,5);
 if(!items.length)return null;
 return <section className={s.section} aria-label="Market decisions and ready-to-brief explainers" data-newsroom-briefable="separate-from-news-wire">
  <header className={s.header}>
   <div><p className={s.eyebrow}>SOURCE-QUALIFIED BRIEFING / NOT ALL BREAKING NEWS</p>
    <h2>What you can explain on air</h2>
    <p>Already-reported results, a dated editorial explainer and the next official decisions. Each opens a short in-house explanation.</p></div>
   <small>{items.length} briefable decision{items.length===1?"":"s"}</small>
  </header>
  <div className={s.grid}>
   {items.map(item=><article key={item.id} className={s.card}>
    <div className={s.art}><EditorialStoryArt headline={item.title} summary={item.fact} compact/></div>
    <div className={s.body}>
     <p className={s.tag}>{item.status==="UPCOMING"?"UPCOMING · OUTCOME UNKNOWN":item.status==="FEATURE"?"PUBLISHED EXPLAINER · DATED":"ISSUER-VERIFIED RESULTS · COMPARISON UNVERIFIED"}</p>
     <h3><Link href={readerHref+item.href}>{item.title}</Link></h3>
     <small><DualTimestamp value={item.at.includes("T")?item.at:null} sourceDate={item.at.slice(0,10)}/></small>
     <p className={s.fact}>{item.status==="UPCOMING"?item.why:item.fact}</p>
     <p className={s.next}><strong>Next check:</strong> {item.test}</p>
     <div className={s.links}><Link href={readerHref+item.href}>Read the Bluebelly explanation →</Link>
      <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.sourceName} · source ↗</a></div>
    </div>
   </article>)}
  </div>
  <p className={s.note}>These are not additional accepted news-wire records. No unreported announcement, consensus surprise or asset reaction is inferred.</p>
 </section>;
}
