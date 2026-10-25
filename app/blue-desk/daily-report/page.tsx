import Link from "next/link";
import { headers } from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import { blueDeskPublicHref } from "@/lib/blue-desk-host";
import { formatDualDeskTime } from "@/lib/blue-desk-time";
import { getCurrentVerifiedMarketMotion } from "@/lib/market-motion";
import { selectVerifiedNewsBriefs } from "@/lib/market-brief-news";
import { getOriginalPressNews } from "@/lib/blue-desk-original-press-news-server";
import {getPublishedMacroPulseBriefs} from "@/lib/blue-desk-macropulse-brief-server";
import {getLatestPublishedDailyReport} from "@/lib/editorial-publications-server";
import { combineQualifiedNews } from "@/lib/blue-desk-qualified-news";
import { projectLivingMarketTopics } from "@/lib/blue-desk-living-topics";
import { getPublicThesisLedger } from "@/lib/blue-desk-thesis-ledger-server";
import {storyMarketTransmission} from "@/lib/blue-desk-thesis-ledger";
import {getPublicSourceObservations} from "@/lib/blue-desk-source-observations";
import { getEconomicCalendar } from "@/lib/calendar";
import { getForwardEarningsEvents } from "@/lib/forward-earnings-sources";
import { buildPresenterCalendar } from "@/lib/presenter-calendar";
import { selectBlueDeskUpcoming } from "@/lib/blue-desk-calendar";
import styles from "./daily-report.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Daily Market Report | Bluebelly",
  description: "A complete, readable market desk: new developments, longer-running stories, market impact and what to watch next.",
};

export default async function DailyReportPage() {
  const now = new Date();
  const host = (await headers()).get("host");
  // All feeds are existing public read models. There is no Dossier, Story
  // adjudication or model completion in this GET path.
  const [verified, macro, earnings, originalPress, macroDigests, stories, observations, publishedDaily] = await Promise.all([
    getCurrentVerifiedMarketMotion({ limit: 36 }).catch(() => []),
    getEconomicCalendar().catch(() => []),
    getForwardEarningsEvents({ now }).catch(() => ({
      events: [], coverage: "unavailable" as const, warning: "Earnings source unavailable",
    })),
    getOriginalPressNews(now,18).catch(() => []),
    getPublishedMacroPulseBriefs(10).catch(() => []),
    getPublicThesisLedger(now,24).catch(() => []),
    getPublicSourceObservations(now,16).catch(() => []),
    getLatestPublishedDailyReport().catch(() => null),
  ]);
  const motionNews = selectVerifiedNewsBriefs(verified, now, 18);
  const news = combineQualifiedNews(motionNews,originalPress,18);
  const topics = projectLivingMarketTopics(news);
  const calendar = buildPresenterCalendar(macro, earnings, now);
  const upcoming = selectBlueDeskUpcoming(calendar, now, 14).slice(0, 12);
  const economics = upcoming.filter(e => e.kind === "economic").slice(0, 6);
  const results = upcoming.filter(e => e.kind === "earnings").slice(0, 6);
  const calendarHref = blueDeskPublicHref("/blue-desk/calendar", host);
  const publishedParagraphs = publishedDaily?.body.split(/\n\s*\n/).map(part => part.trim()).filter(Boolean) || [];

  return <main className={styles.page} data-daily-report="dossier-independent-v2">
    <BlueDeskHeader activePath="/blue-desk/daily-report" />
    <div className={styles.shell}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>MARKET INTELLIGENCE / DAILY REPORT</p>
        <h1>Daily Report</h1>
        <p className={styles.lead}>Read the latest editor-reviewed market report, then explore the rolling
          source-verified developments, longer-running stories, market observations
          and upcoming events. The two sections have different publication clocks.</p>
        <div className={styles.meta}>
          <span>Read at <DualTimestamp value={now.toISOString()} /></span>
          <span>{news.length} source-verified update{news.length === 1 ? "" : "s"} in the latest 48-hour window</span>
          <span>{stories.length} ongoing market stories</span>
          <span>{observations.length} dated original-source observations</span>
        </div>
        <p className={styles.context}>A new report, an observed price and a market explanation are
          three different things. We keep their dates and source status separate.
          This is a broad view of available desk inputs, not proof that every market event
          or every MacroPulse post has been independently verified.</p>
      </header>

      <section className={styles.section} aria-labelledby="latest-reviewed-daily-report"
        data-reviewed-daily-report="published-only">
        <div className={styles.heading}>
          <p className={styles.eyebrow}>EDITORIALLY REVIEWED / DATED EDITION</p>
          <h2 id="latest-reviewed-daily-report">Latest published Daily Report</h2>
          <p>Only an explicitly approved publication appears here. It is fixed at its
            publication time, unlike the rolling source updates below.</p>
        </div>
        {publishedDaily ? <article className={styles.publishedReport}>
          <h3>{publishedDaily.title}</h3>
          {publishedDaily.meta_description ? <p className={styles.deck}>{publishedDaily.meta_description}</p> : null}
          <p className={styles.readingFoot}>Published <DualTimestamp value={publishedDaily.published_at}/></p>
          <div className={styles.publishedProse}>
            {publishedParagraphs.map((part,i) => /^#{1,3}\s/.test(part)
              ? <h4 key={i}>{part.replace(/^#{1,3}\s+/,"")}</h4>
              : <p key={i}>{part}</p>)}
          </div>
          <div className={styles.publishedSources}>
            <h4>Original source references</h4>
            <ul>{publishedDaily.source_urls.map(url =>
              <li key={url}><a href={url} target="_blank" rel="noopener noreferrer">{url}</a></li>)}</ul>
          </div>
        </article> : <p className={styles.empty}>No editor-approved Daily Report edition has
          been published yet. The rolling source-based desk context below remains available;
          it is not presented as an approved report.</p>}
      </section>

      <section className={styles.section} aria-labelledby="daily-story-map" data-daily-story-coverage="persistent-and-dated">
        <div className={styles.heading}>
          <p className={styles.eyebrow}>THE BIG PICTURE</p>
          <h2 id="daily-story-map">The stories connecting today's markets</h2>
          <p>Oil, financing costs, company earnings and currencies feed into one another.
            These are continuing desk investigations, not fresh trades or guarantees about direction.</p>
        </div>
        {stories.length ? <div className={styles.readings}>
          {stories.slice(0,8).map(story=><article className={styles.reading} key={story.id}>
            <p className={styles.eyebrow}>{story.status==="develop"?"UNDER INVESTIGATION":"ONGOING STORY"} · historical assessment</p>
            <h3>{story.title}</h3>
            <p className={styles.storyParagraph}>{story.thesis}</p>
            <p className={styles.storyParagraph}><strong>Why markets care:</strong> {storyMarketTransmission(story)}</p>
            {story.contradiction?<p className={styles.storyCaveat}><strong>What could challenge it:</strong> {story.contradiction}</p>:null}
            <p className={styles.readingFoot}>
              <span>Story last updated <DualTimestamp value={story.updatedAt}/></span>
              <Link href={blueDeskPublicHref("/blue-desk/key-stories",host)+"#thesis-"+story.slug}>Read the full story →</Link>
            </p>
          </article>)}
        </div>:<p className={styles.empty}>The stored Stories couldn't be read. This is a research coverage gap, not a quiet market.</p>}
        {stories.length>8?<details className={styles.moreStories}>
          <summary>Explore the other {stories.length-8} tracked stories in this report</summary>
          <div className={styles.readings}>{stories.slice(8).map(story=><article className={styles.reading} key={story.id}>
            <h3>{story.title}</h3>
            <p className={styles.storyParagraph}>{story.thesis}</p>
            <p className={styles.storyParagraph}><strong>Market connection:</strong> {storyMarketTransmission(story)}</p>
            {story.contradiction?<p className={styles.storyCaveat}><strong>What doesn't fit:</strong> {story.contradiction}</p>:null}
            <p className={styles.readingFoot}><span>Last amended <DualTimestamp value={story.updatedAt}/></span>
              <Link href={blueDeskPublicHref("/blue-desk/key-stories",host)+"#thesis-"+story.slug}>Read more →</Link></p>
          </article>)}</div>
        </details>:null}
      </section>

      <section className={styles.section} aria-labelledby="macropulse-editorial" data-macropulse-editorial="attributed-research">
        <div className={styles.heading}>
          <p className={styles.eyebrow}>RESEARCH DESK / MACROPULSE</p>
          <h2 id="macropulse-editorial">What the research is telling us</h2>
          <p>Stories written from dated MacroPulse posts, explaining what changed and why it may matter.
            These are attributed research assessments, not independently verified breaking News,
            and they do not amend a canonical Story or Dossier.</p>
        </div>
        {macroDigests.length ? <div className={styles.readings}>
          {macroDigests.map(brief=><article className={styles.reading} key={brief.id}>
            <p className={styles.eyebrow}>MACROPULSE-DERIVED · EDITOR REVIEWED · {brief.primary_region.toUpperCase()}</p>
            <h3>{brief.headline}</h3>
            <p className={styles.deck}>{brief.standfirst}</p>
            <dl className={styles.questions}>
              <div><dt>What changed?</dt><dd>{brief.what_changed}</dd></div>
              <div><dt>Why should markets care?</dt><dd>{brief.why_it_matters}</dd></div>
              <div><dt>What argues against the idea?</dt><dd>{brief.countercase}</dd></div>
              <div><dt>What should we watch next?</dt><dd>{brief.watch_next}</dd></div>
            </dl>
            <p>Original research: <a href={brief.source_page_url} target="_blank" rel="noopener noreferrer">
              MacroPulse {brief.source_pulse_id}</a>
              {" · "}Pulse published <DualTimestamp value={brief.source_published_at}/>
              {" · "}Editorial edition <DualTimestamp value={brief.published_at}/></p>
            <div className={styles.row}>
              {brief.source_links.map(link=><a key={link.url} href={link.url}
                 target="_blank" rel="noopener noreferrer">{link.label} ({link.kind.replaceAll("_"," ").toLowerCase()})</a>)}
            </div>
            <p className={styles.context}>Research-derived interpretation. Linked sources retain their individual
              evidentiary limits; no event-to-price reaction is independently established by this summary.</p>
          </article>)}
        </div> : <p className={styles.empty}>No owner-reviewed MacroPulse briefs have been delivered yet.
          The source-verified News and research archive remain separate.</p>}
      </section>

      <section className={styles.section} aria-labelledby="developments">
        <div className={styles.heading}>
          <p className={styles.eyebrow}>01 / WHAT IS NEW?</p>
          <h2 id="developments">What actually happened?</h2>
          <p>These items passed the existing factual source-verification filter.
            Their timestamps show when the events occurred, not when a thesis was refreshed.</p>
        </div>
        {news.length ? <div className={styles.newsList}>{news.map(item =>
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
          <h2 id="reasoning">How a headline can reach your portfolio</h2>
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
                <div><dt>How could this spread through the market?</dt><dd>{topic.marketMechanism}</dd></div>
                <div><dt>Which question matters next?</dt><dd>{topic.guidingQuestion}</dd></div>
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

      <section className={styles.section} aria-labelledby="original-observations" data-market-source-coverage="dated-originals">
        <div className={styles.heading}>
          <p className={styles.eyebrow}>THE NUMBERS / ORIGINAL SOURCES</p>
          <h2 id="original-observations">What the data actually shows</h2>
          <p>These are dated exchange, market-data or official-source observations.
            Their dates matter. A later retrieval doesn't create a new market move,
            and a number alone doesn't explain what caused it.</p>
        </div>
        {observations.length?<div className={styles.newsList}>{observations.map(item=>
          <article className={styles.news} key={item.id}>
            <p className={styles.eyebrow}>DATED {item.kind==="MARKET_OBSERVATION"?"MARKET OBSERVATION":"ORIGINAL RELEASE"}</p>
            <p>{item.description}</p>
            <div className={styles.row}>
              <DualTimestamp value={item.eventAt}/>
              <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
                {item.sourceName} · original source</a>
            </div>
          </article>)}</div>:<p className={styles.empty}>
          No qualifying recent original observations are available to this reader.
          That should not be confused with a lack of market activity.</p>}
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

      <footer className={styles.footer}>Coverage note: this report includes all available public,
        source-verified News within the defined event window, the non-archived public Story
        history, recent eligible original observations and the upcoming calendar. It is not
        an exhaustive transcript of every MacroPulse post or every market print.
        Event impact is conditional unless matched market measurements establish it.</footer>
    </div>
  </main>;
}
