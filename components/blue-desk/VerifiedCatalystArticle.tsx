import Link from "next/link";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import type {LivingMarketTopic} from "@/lib/blue-desk-living-topics";
import styles from "./VerifiedCatalystArticle.module.css";

type Props={topic:LivingMarketTopic;backHref:string};
/** One rolling news theme, not a new canonical Story thesis. Every "scene"
 * quotes the dated verified-news projection via its original source URL.
 * Explanatory text is labelled conditional, not converted to market evidence. */
export default function VerifiedCatalystArticle({topic,backHref}:Props){
 const updates=[...topic.updates].sort((a,b)=>Date.parse(a.occurredAt)-Date.parse(b.occurredAt));
 const lead=topic.updates[0];
 if(!lead||updates.length===0)return null;
 return <article className={styles.article}
   data-catalyst-reader="verified-source-timeline" data-catalyst-topic={topic.id}>
   <nav className={styles.back} aria-label="Story breadcrumbs">
     <Link href={backHref}>All Key Stories</Link><span aria-hidden="true">/</span>
     <span>{topic.title}</span>
   </nav>
   <header className={styles.hero}>
     <p className={styles.kicker}>SOURCE-VERIFIED NEWS · {topic.title.toUpperCase()}</p>
     <h1>{lead.headline}</h1>
     <p className={styles.deck}>{lead.summary}</p>
     <p className={styles.date}>Latest verified event <DualTimestamp value={topic.latestObservedAt}/></p>
     <p className={styles.disclosure}>
       This is a rolling news explainer, separate from the permanent Story research record.
       It uses only qualifying dated reports in the current public news window.
       It is not a complete historical timeline or proof that market prices reacted.
     </p>
   </header>
   <div className={styles.body}>
     <section className={styles.chapter} aria-labelledby="what-happened">
       <p className={styles.kicker}>01 · THE REAL EVENTS</p>
       <h2 id="what-happened">How the reported developments unfolded</h2>
       <p className={styles.hint}>{updates.length===1?
        "One source-verified event is available. Further developments must not be implied.":
        updates.length+" source-verified updates are ordered by their reported event timestamps, oldest first."}</p>
       <ol className={styles.timeline}>
         {updates.map((event,index)=><li className={styles.event} key={event.id}>
           <p className={styles.eventNumber}>RECORDED EVENT {index+1}</p>
           <p className={styles.eventClock}><DualTimestamp value={event.occurredAt}/></p>
           <h3>{event.headline}</h3>
           <p>{event.summary}</p>
           <a href={event.sourceUrl} rel="noopener noreferrer" target="_blank">
             {event.sourceName} · original source
           </a>
         </li>)}
       </ol>
     </section>
     <section className={styles.chapter} aria-labelledby="why-care">
       <p className={styles.kicker}>02 · THE LEARNING MOMENT</p>
       <h2 id="why-care">Who could feel the consequences?</h2>
       <p>{topic.humanStake}</p>
       <p className={styles.hint}>This illustrates exposure; it does not establish that the cost or earnings impact has already occurred.</p>
     </section>
     <section className={styles.chapter} aria-labelledby="market-mechanism">
       <p className={styles.kicker}>03 · FOLLOW THE MONEY</p>
       <h2 id="market-mechanism">How this could reach financial markets</h2>
       <p>{topic.marketMechanism}</p>
     </section>
     <section className={styles.chapter} aria-labelledby="missing-piece">
       <p className={styles.kicker}>04 · THE COMPLICATION</p>
       <h2 id="missing-piece">What the evidence still cannot tell us</h2>
       <p>The reported events are source-attributed, but this page does not contain a matched
         pre-event market expectation, completed-session price comparison, or a verified
         explanation of why an asset moved. A plausible mechanism is not a measured reaction.</p>
       <p className={styles.hint}>Topic grouping is editorial navigation. It must never create a canonical Story version or accept a research thesis automatically.</p>
     </section>
     <section className={styles.chapter} aria-labelledby="what-next">
       <p className={styles.kicker}>05 · THE NEXT DECIDING QUESTION</p>
       <h2 id="what-next">What should investors check next?</h2>
       <p>{topic.guidingQuestion}</p>
       <p className={styles.hint}>Watch for a new original release and dated observations before drawing a directional conclusion.</p>
     </section>
     <footer className={styles.footer}>
       <h2>Original sources and coverage</h2>
       <p>{updates.length} distinct source-verified report{updates.length===1?"":"s"} in this rolling topic.
         The article does not carry forward expired news as a new event. No unverified X post,
         creator commentary, scheduled announcement or opinion substitutes for a reported fact.</p>
       <Link href={backHref}>Return to all stories</Link>
     </footer>
   </div>
 </article>;
}
