import Link from "next/link";
import DualTimestamp from "./DualTimestamp";
import type {DailyReportProjection} from "@/lib/bluebelly-daily-report-projection";
import {decisionSourceFreshness} from "@/lib/bluebelly-decision-brief";
import styles from "./DailyFiveTopicBrief.module.css";

const eventLabel=(at:string)=>/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(at)
 ?at+" · source date, exact release time not verified":at;
const readerLink=(href:string,reader:string)=>/^[?][a-zA-Z0-9?=&%_-]{1,200}$/.test(href)?reader+href:reader;

export default function DailyFiveTopicBrief({report,now,reader,calendar}:{report:DailyReportProjection;now:Date;reader:string;calendar:string}){
 return <section className={styles.report} data-daily-report-lead="five-source-qualified-topics" aria-labelledby="daily-report-title">
  <header className={styles.header}>
   <p className={styles.kicker}>BLUEBELLY / DAILY MARKET REPORT · ROLLING PUBLIC READER</p>
   <h1 id="daily-report-title">Today's market decisions</h1>
   <p className={styles.deck}>The important developments, the possible economic effect and the evidence that would change the interpretation. Full figures and original sources remain in each story.</p>
   <div className={styles.meta}>
    <span>Report read at <DualTimestamp value={now.toISOString()}/></span>
    <span>{report.stories.length} source-qualified topics · {report.freshWithin48h} newly verified releases within 48 hours</span>
   </div>
   {report.status==="RECENT_REVIEWED_ONLY"?<p className={styles.coverage} role="status">
    No new verified release is among these five topics for the past 48 hours. Earlier reviewed developments remain visible with their source dates; this does not prove no new releases occurred.
   </p>:report.status==="NO_QUALIFIED_SOURCES"?<p className={styles.coverage} role="status">
    No source-qualified market developments are available for this rolling report. Do not interpret an empty feed as a quiet market.
   </p>:null}
  </header>
  {report.stories.length?<div className={styles.cards}>
    {report.stories.map((item,index)=><article className={styles.card} key={item.id} data-daily-report-story={item.id}>
     <div className={styles.cardMeta}>
      <strong>{String(index+1).padStart(2,"0")} / {decisionSourceFreshness(item.at,item.status,now)}</strong>
      <span>{eventLabel(item.at)}</span>
     </div>
     <h2>{item.title}</h2>
     <p className={styles.brief} data-quick-market-brief="public-source-qualified">{item.why}</p>
     <div className={styles.effects}>
      <p><strong>What the source reports:</strong> {item.fact}</p>
      <p><strong>Why it could matter:</strong> {item.mechanism}</p>
      <p><strong>What needs checking:</strong> {item.test}</p>
     </div>
     <p className={styles.boundary}>Economic implications are conditional unless established by the source. A specific price reaction or a “priced in” explanation requires separately matched evidence.</p>
     <div className={styles.actions}>
      <Link href={readerLink(item.href,reader)}>Full story and supporting figures</Link>
      <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">Original: {item.sourceName}</a>
     </div>
    </article>)}
   </div>:null}
  <section className={styles.forward} aria-labelledby="daily-forward-title">
   <h2 id="daily-forward-title">The next decisions</h2>
   {report.upcoming.length?<div className={styles.catalysts}>
    {report.upcoming.map(item=><article key={item.id}>
      <strong>{item.title}</strong><small>{eventLabel(item.at)} · scheduled / outcome pending</small>
      <p>{item.test}</p>
      <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.sourceName} · source</a>
     </article>)}
   </div>:<p>No official upcoming events currently meet this reader's source and time checks. <Link href={calendar}>Open the full economic and earnings calendar</Link>.</p>}
  </section>
  <footer className={styles.footer}>
   <p>This is a rolling public, source-led briefing, not a fixed archival edition or automatically approved AI report. For the complete private Daily Intelligence edition and its history, use My Desk after signing in.</p>
   <Link href="/my-reports">Open My Desk · owner only</Link>
  </footer>
 </section>;
}
