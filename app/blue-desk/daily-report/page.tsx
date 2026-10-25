import Link from "next/link";
import { headers } from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import { blueDeskPublicHref } from "@/lib/blue-desk-host";
import { formatDualDeskTime } from "@/lib/blue-desk-time";
import { getCurrentVerifiedMarketMotion } from "@/lib/market-motion";
import { selectVerifiedNewsBriefs } from "@/lib/market-brief-news";
import { getOriginalPressNews } from "@/lib/blue-desk-original-press-news-server";
import { combineQualifiedNews } from "@/lib/blue-desk-qualified-news";
import { projectLivingMarketTopics } from "@/lib/blue-desk-living-topics";
import { listPublishedReports, getLatestPublishedDailyReport } from "@/lib/editorial-publications-server";
import { getEconomicCalendar } from "@/lib/calendar";
import { getForwardEarningsEvents } from "@/lib/forward-earnings-sources";
import { buildPresenterCalendar } from "@/lib/presenter-calendar";
import { selectBlueDeskUpcoming } from "@/lib/blue-desk-calendar";
import styles from "./daily-report.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Daily Market Report | Bluebelly",
  description: "A rolling source-dated briefing, related approved analysis and upcoming market catalysts.",
};

export default async function DailyReportPage() {
  const now = new Date();
  const host = (await headers()).get("host");
  // All feeds are existing public read models. There is no Dossier, Story
  // adjudication or model completion in this GET path.
  const [verified, reports, latestReviewed, macro, earnings, originalPress] = await Promise.all([
    getCurrentVerifiedMarketMotion({ limit: 36 }).catch(() => []),
    listPublishedReports(8).catch(() => []),
    getLatestPublishedDailyReport().catch(() => null),
    getEconomicCalendar().catch(() => []),
    getForwardEarningsEvents({ now }).catch(() => ({
      events: [], coverage: "unavailable" as const, warning: "Earnings source unavailable",
    })),
    getOriginalPressNews(now,18).catch(() => []),
  ]);
  const motionNews = selectVerifiedNewsBriefs(verified, now, 18);
  const news = combineQualifiedNews(motionNews,originalPress,18);
  const topics = projectLivingMarketTopics(news);
  const calendar = buildPresenterCalendar(macro, earnings, now);
  const upcoming = selectBlueDeskUpcoming(calendar, now, 14).slice(0, 12);
  const economics = upcoming.filter(e => e.kind === "economic").slice(0, 6);
  const results = upcoming.filter(e => e.kind === "earnings").slice(0, 6);
  const reportHref = (id:string) => blueDeskPublicHref("/blue-desk/reports/" + id, host);
  const calendarHref = blueDeskPublicHref("/blue-desk/calendar", host);

  return <main className={styles.page} data-daily-report="dossier-independent-v2">
    <BlueDeskHeader activePath="/blue-desk/daily-report" />
    <div className={styles.shell}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>MARKET INTELLIGENCE / DAILY REPORT</p>
        <h1>What is happening in the markets?</h1>
        <p className={styles.lead}>A rolling overview of confirmed developments,
          related analyst articles and the events that could change the outlook.
          Facts are separated from explanations that still need testing.</p>
        <div className={styles.meta}>
          <span>Read at <DualTimestamp value={now.toISOString()} /></span>
          <span>{news.length} source-verified update{news.length === 1 ? "" : "s"} in the latest 48-hour window</span>
          <span>{topics.length} active research topic{topics.length === 1 ? "" : "s"}</span>
        </div>
        <p className={styles.context}>Live news is not automatically a complete
          research judgement. This page does not generate new analysis, verify
          MacroPulse/Research Gate Notion outputs or assert event-to-price causality.
          Analyst conclusions below are from independently reviewed, dated publications.
          There is <strong>no Dossier approval or frozen Story requirement</strong>.</p>
      </header>

      <section className={styles.section} aria-labelledby="reviewed-daily-report"
        data-reviewed-daily-report={latestReviewed ? "published" : "awaiting-review"}>
        <div className={styles.heading}>
          <p className={styles.eyebrow}>OWNER-REVIEWED DAILY EDITION</p>
          <h2 id="reviewed-daily-report">
            {latestReviewed ? latestReviewed.title : "Researched report awaiting editorial review"}
          </h2>
          <p>Unlike the source-dated updates below, this is where the full
            analyst explanation appears after independent source checks, an
            approved fixed PDF and the existing publication gate.</p>
        </div>
        {latestReviewed ? <article className={styles.reading}>
          <p className={styles.eyebrow}>PUBLISHED · IMMUTABLE EDITION</p>
          <p className={styles.readingFoot}>
            <span>Published <DualTimestamp value={latestReviewed.published_at}/></span>
            <Link href={reportHref(latestReviewed.id)}>Open reviewed edition and PDF</Link>
          </p>
          {latestReviewed.body.split(/\n\s*\n/).filter(Boolean).map((part,i)=>
            /^#{1,3}\s/.test(part) ?
              <h3 key={i}>{part.replace(/^#{1,3}\s+/,"")}</h3> :
              <p key={i}>{part}</p>
          )}
          <h3>Reviewed research references</h3>
          <ul>{latestReviewed.source_urls.map(url=>
            <li key={url}><a href={url} target="_blank" rel="noreferrer">
              {new URL(url).hostname} · original link</a></li>)}</ul>
        </article> : <p className={styles.empty}>
          The latest current market facts remain available below. No newly researched
          owner-approved report has been published yet; headlines and Notion research
          are not silently promoted into a finished analysis.
        </p>}
      </section>

      <section className={styles.section} aria-labelledby="developments">
        <div className={styles.heading}>
          <p className={styles.eyebrow}>01 / WHAT IS NEW?</p>
          <h2 id="developments">Developments worth attention</h2>
          <p>These items passed the existing factual source-verification filter.
            Their timestamps show when the events occurred, not when a thesis was refreshed.</p>
        </div>
        {news.length ? <div className={styles.newsList}>{news.slice(0, 10).map(item =>
          <article key={item.id} className={styles.news}>
            <h3>{item.headline}</h3>
            <p>{item.summary}</p>
            <div className={styles.row}><DualTimestamp value={item.occurredAt} />
              <a href={item.sourceUrl} target="_blank" rel="noreferrer">
                {item.sourceName} · original report
              </a></div>
          </article>)}</div> :
          <p className={styles.empty}>No fresh source-verified news is available
            from this feed. This does not mean nothing happened; provider coverage
            or research verification may be incomplete.</p>}
      </section>

      <section className={styles.section} aria-labelledby="reasoning">
        <div className={styles.heading}>
          <p className={styles.eyebrow}>02 / WHY IT MATTERS</p>
          <h2 id="reasoning">Moving parts and market implications</h2>
          <p>Live source updates identify what happened. Explanations need evidence
            connecting each economic step, the exposed assets, expected versus
            observed price action, and the competing explanation.</p>
        </div>
        {topics.length ? <div className={styles.readings}>
          {topics.map(topic =>
            <article key={topic.id} className={styles.reading}>
              <p className={styles.eyebrow}>ACTIVE TOPIC · {topic.updates.length} VERIFIED UPDATE{topic.updates.length === 1 ? "" : "S"}</p>
              <h3>{topic.title}</h3>
              <p className={styles.deck}><strong>What changed:</strong> {topic.updates[0].headline}</p>
              <dl className={styles.questions}>
                <div><dt>What do we know?</dt><dd>{topic.updates[0].summary}</dd></div>
                <div><dt>Which mechanism should be tested?</dt><dd>{topic.guidingQuestion}</dd></div>
                <div><dt>Is the asset reaction confirmed?</dt>
                  <dd>Not established by this news feed. Check dated instrument
                    observations before attributing the price move to the event.</dd></div>
                <div><dt>What would challenge the explanation?</dt>
                  <dd>Compare independent original sources, market expectations,
                    affected assets and the next relevant event.</dd></div>
              </dl>
              <p className={styles.readingFoot}>
                <span>Latest event <DualTimestamp value={topic.latestObservedAt} /></span>
                <Link href={blueDeskPublicHref("/blue-desk/key-stories",host) + "#" + topic.id}>
                  Examine topic and sources
                </Link>
              </p>
            </article>)}
        </div> : <p className={styles.empty}>No active source-verified themes
          qualified in the 48-hour window. Historical topics are not recycled
          as current analysis.</p>}
      </section>

      <section className={styles.section} aria-labelledby="published">
        <div className={styles.heading}>
          <p className={styles.eyebrow}>03 / APPROVED EDITORIAL ANALYSIS</p>
          <h2 id="published">Read the deeper explanations</h2>
          <p>These articles were independently reviewed and published.
            They are immutable historical editorial assessments, not dynamically
            revised verdicts about today's market.</p>
        </div>
        {reports.length ? <div className={styles.watchGrid}>{reports.slice(0,6).map(report =>
          <article key={report.id} className={styles.watch}>
            <p className={styles.eyebrow}>{report.kind === "COTD" ? "CHART OF THE DAY" : "OPENING BELL"}</p>
            <h3>{report.title}</h3>
            <p>{report.excerpt}</p>
            <small>Published <DualTimestamp value={report.published_at} /></small>
            <p><Link href={reportHref(report.id)}>Read article, evidence links and PDF</Link></p>
          </article>)}</div> :
          <p className={styles.empty}>No approved editorial articles are available.
            The writer can prepare an OB or COTD without a Dossier approval;
            publication still requires the existing owner review.</p>}
      </section>

      <section className={styles.section} aria-labelledby="forward">
        <div className={styles.heading}>
          <p className={styles.eyebrow}>04 / WHAT TO WATCH NEXT</p>
          <h2 id="forward">Calendar and earnings catalysts</h2>
          <p>Source-listed future events are deciding questions, not predictions.</p>
        </div>
        <div className={styles.twoCols}>
          {[{label:"Economic releases",rows:economics},{label:"Earnings",rows:results}].map(group =>
            <section className={styles.watch} key={group.label}>
              <h3>{group.label}</h3>
              {group.rows.length ? group.rows.map(event =>
                <article className={styles.event} key={event.id}>
                  <strong>{event.title}</strong>
                  <span>{event.scheduledAt
                    ? formatDualDeskTime(event.scheduledAt)?.et || event.scheduledAt
                    : event.localDate + " · source date only"}</span>
                  {event.decidingQuestion ? <p>{event.decidingQuestion}</p> : null}
                  {event.verificationState === "reported" ?
                    <small>Provider-reported date · check issuer confirmation</small> : null}
                  <small>{event.sourceName}</small>
                </article>) :
                <p>None in the selected source-qualified 14-day window.</p>}
            </section>)}
        </div>
        {calendar.sourceHealth.warnings.length ?
          <p className={styles.context}>Calendar coverage: {calendar.sourceHealth.warnings.join(" ")}</p> : null}
        <p><Link href={calendarHref}>Open Calendar + Earnings Hub</Link></p>
      </section>

      <footer className={styles.footer}>Verification boundaries: recent news is a
        dated source observation, not proof of causality. A topic groups news
        for easier reading, not an accepted long-term thesis. Upcoming releases,
        issuer earnings and approved articles retain separate source and time labels.
        No Dossier, Story version or research record is mutated by this page.</footer>
    </div>
  </main>;
}
