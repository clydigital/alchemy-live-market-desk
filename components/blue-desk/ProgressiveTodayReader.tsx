import Link from "next/link";
import type {NewsBriefV1} from "@/lib/market-brief-news";
import type {PresenterCalendar} from "@/lib/presenter-calendar";
import {decisionTopics, decisionSourceFreshness} from "@/lib/bluebelly-decision-brief";
import {selectBlueDeskUpcoming} from "@/lib/blue-desk-calendar";
import {blueDeskPublicHref} from "@/lib/blue-desk-host";
import DualTimestamp from "./DualTimestamp";
import styles from "./ProgressiveTodayReader.module.css";

/**
 * Public-facing, read-only projection of already qualified desk material.
 * Detail is progressively disclosed; this component never upgrades a story's
 * evidence status or introduces a new publication/research path.
 */
export default function ProgressiveTodayReader({news,calendar,now,host}:{
  news:readonly NewsBriefV1[];
  calendar:PresenterCalendar;
  now:Date;
  host:string|null;
}){
  const allTopics=decisionTopics(news,calendar,now);
  const current=allTopics.filter(item=>item.status!=="UPCOMING");
  const lead=current[0]||allTopics[0];
  const headlines=current.slice(0,4);
  const events=selectBlueDeskUpcoming(calendar,now,7).slice(0,3);
  const stories=blueDeskPublicHref("/blue-desk/key-stories",host);
  const newsroom=blueDeskPublicHref("/blue-desk/newsroom",host);
  const calendarHref=blueDeskPublicHref("/blue-desk/calendar",host);
  return <div className={styles.shell} data-progressive-reading="today-v1">
    <div className={styles.eyebrowRow}>
      <span><b>TODAY</b> / BLUEBELLY MARKET INTELLIGENCE</span>
      <small>Source-dated briefing · <DualTimestamp value={now.toISOString()}/></small>
    </div>
    <header className={styles.hero} aria-label="Market in 30 seconds">
      <div className={styles.heroMain}>
        <p className={styles.eyebrow}>THE MARKET IN 30 SECONDS</p>
        <h1>{lead?.title||"What can we verify today?"}</h1>
        <p className={styles.summary}>{lead?(lead.status==="UPCOMING"?"Upcoming, not yet released. "+lead.why:lead.fact):"Current source-qualified coverage is unavailable. The calendar and research archive remain accessible."}</p>
        <nav className={styles.heroActions} aria-label="Read more">
          <a className={styles.primaryAction} href="#today-headlines">Get the quick news <span aria-hidden="true">→</span></a>
          <Link className={styles.secondaryAction} href={stories}>Explore Key Stories</Link>
        </nav>
      </div>
      <aside className={styles.heroAside} aria-label="Three developments to know">
        <h2>THREE DEVELOPMENTS TO KNOW</h2>
        {allTopics.slice(0,3).map((item,index)=><Link key={item.id} className={styles.topLine} href={stories+item.href}>
          <span aria-hidden="true">{String(index+1).padStart(2,"0")}</span>
          <div><strong>{item.title}</strong><small>{item.status==="UPCOMING"?"Upcoming · outcome pending":item.status==="FEATURE"?"Dated feature":"Source-qualified update"}</small></div>
        </Link>)}
        {!allTopics.length?<p>No qualified developments currently available.</p>:null}
        <p className={styles.heroNote}>Original releases, interpretations and dated market reactions retain separate evidence status.</p>
      </aside>
    </header>

    <section className={styles.newsSection} id="today-headlines" aria-labelledby="today-headlines-title">
      <div className={styles.heading}>
        <div><p className={styles.eyebrow}>01 / THE HEADLINES</p><h2 id="today-headlines-title">What deserves your attention</h2>
          <p>Get the point in seconds. Expand only the story you want.</p></div>
        <Link href={newsroom}>All news →</Link>
      </div>
      {headlines.length?<div className={styles.newsList}>
        {headlines.map((item,index)=><article key={item.id} className={styles.newsRow} data-progressive-story={item.id}>
          <div className={styles.newsNumber}>{String(index+1).padStart(2,"0")}</div>
          <div className={styles.newsBody}>
            <div className={styles.meta}><span>{item.status==="FEATURE"?"FEATURE":"NEWS"}</span>
              <span>{decisionSourceFreshness(item.at,item.status,now)}</span>
              <DualTimestamp value={item.at.includes("T")?item.at:null} sourceDate={item.at}/>
            </div>
            <h3><Link href={stories+item.href}>{item.title}</Link></h3>
            <p>{item.fact}</p>
            <p className={styles.point}><b>THE POINT</b> {item.why}</p>
            <details className={styles.expansion}>
              <summary>Expand explanation <span aria-hidden="true">⌄</span></summary>
              <div className={styles.expandedBody}>
                <h4>How it could affect markets</h4>
                <p>{item.mechanism}</p>
                <h4>What would change the reading?</h4>
                <p>{item.test}</p>
                <div className={styles.storyActions}>
                  <Link href={stories+item.href}>Full explanation →</Link>
                  <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.sourceName} · original source ↗</a>
                </div>
                <small>Market implications are conditional; this is not an independently verified event-window price reaction.</small>
              </div>
            </details>
          </div>
        </article>)}
      </div>:<div className={styles.empty}>No recently qualified headlines are available. This is a coverage gap, not a claim that nothing happened. <Link href={newsroom}>Browse dated Newsroom →</Link></div>}
    </section>

    <div className={styles.lowerGrid}>
      <section className={styles.questionPanel} aria-labelledby="today-themes-title">
        <div className={styles.panelHead}><h2 id="today-themes-title">Big questions behind the news</h2><Link href={stories}>Key Stories →</Link></div>
        <p className={styles.panelIntro}>Keep the continuing market thesis separate from today's headline.</p>
        <Link href={stories+"?category=ai"}><strong>Does AI growth turn into free cash flow?</strong><span>AI &amp; earnings <b>→</b></span></Link>
        <Link href={stories+"?category=other"}><strong>Is the rally broadening beyond a few leaders?</strong><span>Market breadth <b>→</b></span></Link>
        <Link href={stories+"?category=rates"}><strong>What are bond yields actually pricing?</strong><span>Rates &amp; Fed <b>→</b></span></Link>
      </section>
      <section className={styles.calendarPanel} id="today-calendar" aria-labelledby="today-calendar-title">
        <div className={styles.panelHead}><h2 id="today-calendar-title">On the calendar</h2><Link href={calendarHref}>Full calendar →</Link></div>
        {events.map(item=><div className={styles.calendarEvent} key={item.id}>
          <strong>{item.title}</strong>
          <p>{item.decidingQuestion}</p>
          <small>{item.scheduledAt?<DualTimestamp value={item.scheduledAt}/>:item.localDate+" · date only"} · {item.status==="scheduled"?"Outcome pending":"Review release"}</small>
        </div>)}
        {!events.length?<p className={styles.empty}>No source-qualified forward events available.</p>:null}
      </section>
    </div>
  </div>;
}
