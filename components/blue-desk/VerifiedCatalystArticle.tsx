import Link from "next/link";
import {TOPIC_RESEARCH} from "@/lib/bluebelly-newsroom-context";
import {EDITORIAL_REGIME_LENSES} from "@/lib/bluebelly-editorial-architecture";
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
 const research=EDITORIAL_REGIME_LENSES.filter(lens=>(TOPIC_RESEARCH[topic.id]??[]).includes(lens.id));
 const regimeHref=backHref.replace(/\/newsroom\/?$/,"/regime-watch");
 if(!lead||updates.length===0)return null;
 return <article className={styles.article}
   data-catalyst-reader="verified-source-timeline" data-catalyst-topic={topic.id}>
   <nav className={styles.back} aria-label="Story breadcrumbs">
     <Link href={backHref}>Newsroom</Link><span aria-hidden="true">/</span>
     <span>{topic.title}</span>
   </nav>
   <header className={styles.hero}>
     <p className={styles.kicker}>SOURCE-VERIFIED NEWS · {topic.title.toUpperCase()}</p>
     <h1>{lead.headline}</h1>
     <p className={styles.deck}>{lead.summary}</p>
     <p className={styles.date}>Latest verified event <DualTimestamp value={topic.latestObservedAt}/></p>
     <p className={styles.sourceLead}><a href={lead.sourceUrl} rel="noopener noreferrer" target="_blank">Read the latest original report · {lead.sourceName} ↗</a></p>
   </header>
   <div className={styles.body}>
     <section className={styles.chapter} aria-labelledby="why-care">
       <h2 id="why-care">Why does this matter?</h2>
       <p>{topic.humanStake}</p>
       <p>{topic.marketMechanism}</p>
       <p className={styles.hint}>These are possible consequences, not a confirmed market-price reaction.</p>
     </section>
     <section className={styles.chapter} aria-labelledby="what-next">
       <h2 id="what-next">What should I watch next?</h2>
       <p>{topic.guidingQuestion}</p>
       {research.length?<div data-newsroom-research-connection="topic-navigation"><h3>Related market research</h3>{research.map(lens=><p key={lens.id}><Link href={regimeHref+"/"+lens.id}>{lens.name} ↗</Link> — {lens.question}</p>)}<p className={styles.hint}>These are related research questions, not a finding that this news changed the regime.</p></div>:null}
     </section>
     <details className={styles.moreDetails}>
       <summary>See all {updates.length} verified update{updates.length===1?"":"s"} and source links</summary>
       <div className={styles.moreBody}>
         <p className={styles.hint}>These are dated original-source reports, oldest first. The timeline is not a complete market history.</p>
         <ol className={styles.timeline}>
           {updates.map((event,index)=><li className={styles.event} key={event.id}>
             <p className={styles.eventNumber}>REPORTED UPDATE {index+1}</p>
             <p className={styles.eventClock}><DualTimestamp value={event.occurredAt}/></p>
             <h3>{event.headline}</h3>
             <p>{event.summary}</p>
             <a href={event.sourceUrl} rel="noopener noreferrer" target="_blank">{event.sourceName} · original source</a>
           </li>)}
         </ol>
         <h3>What is still unknown?</h3>
         <p>The reports show what was announced. They do not establish what investors expected beforehand, how prices reacted after the news, or whether this event caused the move.</p>
         <p>{updates.length} source-verified report{updates.length===1?"":"s"}. Unverified social posts and opinions are not treated as confirmed facts.</p>
       </div>
     </details>
     <footer className={styles.footer}>
       <Link href={backHref}>Return to Newsroom</Link>
     </footer>
   </div>
 </article>;
}
