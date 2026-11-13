import Link from "next/link";
import type {MarketCompassSummary} from "@/lib/bluebelly-market-compass";
import type {NewsBriefV1} from "@/lib/market-brief-news";
import {sourceCheckedReleaseImpact} from "@/lib/bluebelly-release-impact-brief";
import type {PublicThesis} from "@/lib/blue-desk-thesis-ledger";
import type {PresenterCalendarEvent} from "@/lib/presenter-calendar";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import DualTimestamp from "./DualTimestamp";
import styles from "./DeskWhiteboard.module.css";

function shortened(input:string,max:number):string{
 const value=input.replace(/\s+/g," ").trim();
 return value.length<=max?value:value.slice(0,max-1).replace(/\s+\S*$/,"")+"…";
}

/** A single, bounded, source-dated read model. No second thesis engine,
 * AI generation, quote fetch, market-price cause or live probability. */
export default function DeskWhiteboard({
 compass,news,theses,upcoming,now,host,
}:{
 compass:MarketCompassSummary;
 news:readonly NewsBriefV1[];
 theses:readonly PublicThesis[];
 upcoming:readonly PresenterCalendarEvent[];
 now:Date;
 host:string|null;
}){
 const latest=news.find(item=>Number.isFinite(Date.parse(item.occurredAt)) &&
   Date.parse(item.occurredAt)<=now.getTime() &&
   now.getTime()-Date.parse(item.occurredAt)<=48*3600000);
 const reviewedRelease=latest?sourceCheckedReleaseImpact(latest):null;
 const story=theses[0]??null;
 const catalyst=upcoming[0]??null;
 const open=(path:string)=>blueDeskPublicHref(path,host);
 const stories=open("/blue-desk/key-stories");
 const newsHref=latest?stories+"?news="+encodeURIComponent(latest.id):open("/blue-desk/newsroom");
 const thesisHref=story?stories+"?story="+encodeURIComponent(story.slug):stories;
 return <section className={styles.board} data-bluebelly-desk-whiteboard="existing-evidence-v1"
   aria-labelledby="desk-whiteboard-title">
  <header className={styles.heading}>
   <div><p className={styles.kicker}>DECISION DESK / SOURCE-DATED WHITEBOARD</p>
    <h2 id="desk-whiteboard-title">What matters now?</h2></div>
   <small>Checked <DualTimestamp value={now.toISOString()}/> · No simulated live calls</small>
  </header>
  <div className={styles.grid}>
   <article className={styles.cell} data-whiteboard-cell="market" data-compass-state={compass.state}>
    <span className={styles.label}>01 / MARKET TAPE</span>
    <strong className={styles.marketFlag}>{compass.state==="RISK_ON"?"RISK-ON SESSION":compass.state==="RISK_OFF"?"RISK-OFF SESSION":compass.state==="MIXED"?"MIXED TAPE":"TAPE NOT MEASURED"}</strong>
    <h3>{compass.title}</h3>
    <p>{shortened(compass.explanation,170)}</p>
    <small>{compass.sourceSession?"US session "+compass.sourceSession+" · 1D matched ETFs":"Comparable ETF session unavailable"}</small>
    <Link href={open("/blue-desk/regime-watch")}>Compass &amp; evidence <span aria-hidden="true">↗</span></Link>
   </article>
   <article className={styles.cell} data-whiteboard-cell="release">
    <span className={styles.label}>02 / LATEST VERIFIED CHANGE</span>
    <h3>{reviewedRelease?shortened(reviewedRelease.title,93):
      latest?shortened(latest.headline,93):"No fresh source-qualified update"}</h3>
    <p>{reviewedRelease?shortened(reviewedRelease.lead,200):
      latest?shortened(latest.summary,165):"No new release in the checked 48-hour source window. This is a coverage state, not an empty-news claim."}</p>
    <small>{latest?<><DualTimestamp value={latest.occurredAt}/> · {latest.sourceName}</>:"Source freshness pending"}</small>
    <Link href={newsHref}>{latest?"Read qualified event":"Browse original sources"} <span aria-hidden="true">↗</span></Link>
   </article>
   <article className={styles.cell} data-whiteboard-cell="thesis">
    <span className={styles.label}>03 / WORKING QUESTION</span>
    <h3>{story?shortened(story.question,107):"Which market thesis needs reassessment?"}</h3>
    <p>{story?shortened(story.nextTest||story.contradiction||"Review the original evidence and next test.",165):
      "Open a dated research lens before adopting an investment conclusion."}</p>
    <small>{story?<>Story updated <DualTimestamp value={story.updatedAt}/> · historical interpretation</>:"No eligible public Story record"}</small>
    <Link href={thesisHref}>{story?"Open thesis &amp; countercase":"Browse Key Stories"} <span aria-hidden="true">↗</span></Link>
   </article>
   <article className={styles.cell} data-whiteboard-cell="catalyst">
    <span className={styles.label}>04 / NEXT CATALYST</span>
    <h3>{catalyst?shortened(catalyst.title,100):"Awaiting a verified upcoming event"}</h3>
    <p>{catalyst?shortened(catalyst.decidingQuestion||"What changes the current expectation?",165):
     "Check the economic and earnings calendar for the next confirmed decision point."}</p>
    <small>{catalyst?(catalyst.scheduledAt?<DualTimestamp value={catalyst.scheduledAt}/>:
      catalyst.localDate+" · date only"):"No verified date in this window"}</small>
    <Link href={open("/blue-desk/calendar")}>Event calendar <span aria-hidden="true">↗</span></Link>
   </article>
  </div>
  <footer className={styles.nextTest}>
   <span>WHAT WOULD CHANGE THE READ?</span>
   <p>{shortened(compass.nextTest,245)}</p>
   <Link href={open("/blue-desk/markets?mode=watch")}>Cross-asset comparison ↗</Link>
  </footer>
 </section>;
}