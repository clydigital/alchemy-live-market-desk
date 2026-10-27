import Link from "next/link";
import { headers } from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import { ScopeStrip } from "@/components/blue-desk/EntityIdentity";
import InvestorTest from "@/components/blue-desk/InvestorTest";
import NewsroomLensExplorer from "@/components/blue-desk/NewsroomLensExplorer";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import { blueDeskPublicHref } from "@/lib/blue-desk-host";
import { getCurrentVerifiedMarketMotion } from "@/lib/market-motion";
import { selectVerifiedNewsBriefs } from "@/lib/market-brief-news";
import { getOriginalPressNews } from "@/lib/blue-desk-original-press-news-server";
import { combineQualifiedNews } from "@/lib/blue-desk-qualified-news";
import { projectLivingMarketTopics } from "@/lib/blue-desk-living-topics";
import { getPublicThesisLedger } from "@/lib/blue-desk-thesis-ledger-server";
import {orderStoriesByLatestMotion} from "@/lib/blue-desk-thesis-ledger";
import {classifyPublicStory,PUBLIC_STORY_CATEGORIES} from "@/lib/blue-desk-story-categories";
import StoryEditorialArticle from "@/components/blue-desk/StoryEditorialArticle";
import {selectFlagshipInvestorTest} from "@/lib/blue-desk-investor-test";
import {getStoryMotionRecency} from "@/lib/blue-desk-story-motion-recency-server";
import { getPublicSourceObservations } from "@/lib/blue-desk-source-observations";
import { buildPresenterCalendar } from "@/lib/presenter-calendar";
import { selectBlueDeskUpcoming } from "@/lib/blue-desk-calendar";
import { getEconomicCalendar } from "@/lib/calendar";
import { getForwardEarningsEvents } from "@/lib/forward-earnings-sources";
import {calendarHumanStake} from "@/lib/blue-desk-calendar-human-stakes";
import desk from "../blue-desk.module.css";
import ui from "./key-stories.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Market Catalysts and Stories | Bluebelly",
  description: "Dated market catalysts explained in human terms, upcoming company decisions and historical Story context.",
};

export default async function KeyStories({searchParams}:{searchParams?:Promise<{story?:string;category?:string}>}){
  const params=await searchParams;
  const now = new Date();
  const host = (await headers()).get("host");
  const [raw, theses, observations, originalPress, macro, earnings] = await Promise.all([
    getCurrentVerifiedMarketMotion({ limit: 36 }).catch(() => []),
    getPublicThesisLedger(now,24).catch(() => []),
    getPublicSourceObservations(now,8).catch(() => []),
    getOriginalPressNews(now,18).catch(() => []),
    getEconomicCalendar().catch(() => []),
    getForwardEarningsEvents({now}).catch(() => ({events:[],coverage:"unavailable" as const,warning:"Earnings coverage unavailable"})),
  ]);
  const motionRecency=await getStoryMotionRecency(theses.map(x=>x.id),now).catch(()=>[]);
  const orderedTheses=orderStoriesByLatestMotion(theses,motionRecency,now);
  // Query-only reader: the existing /key-stories host rule applies unchanged.
  const storySlug=typeof params?.story==="string"&&/^[a-z0-9-]{1,150}$/.test(params.story)?params.story:null;
  if(storySlug){
    const selected=orderedTheses.find(story=>story.slug===storySlug);
    return <main className={desk.page} data-bluebelly-stories="source-limited-reading-mode">
      <BlueDeskHeader activePath="/blue-desk/key-stories"/>
      <div className={desk.content}>
        {selected?<StoryEditorialArticle story={selected}
          backHref={blueDeskPublicHref("/blue-desk/key-stories",host)}/>:
          <section className={ui.empty} data-article-not-found="true">
            <h1>Story unavailable</h1>
            <p>The requested Story is not in the approved public research index.</p>
            <Link href={blueDeskPublicHref("/blue-desk/key-stories",host)}>Return to all Stories</Link>
          </section>}
      </div>
    </main>;
  }
  const requestedCategory=typeof params?.category==="string"?params.category:"All";
  const activeCategory=PUBLIC_STORY_CATEGORIES.some(c=>c===requestedCategory)?requestedCategory:"All";
  const visibleTheses=activeCategory==="All"?orderedTheses:
    orderedTheses.filter(story=>classifyPublicStory(story)===activeCategory);
  const indexHref=blueDeskPublicHref("/blue-desk/key-stories",host);
  const investorTest=selectFlagshipInvestorTest(orderedTheses);
  const motionNews = selectVerifiedNewsBriefs(raw, now, 18);
  const news = combineQualifiedNews(motionNews,originalPress,18);
  const topics = projectLivingMarketTopics(news);
  const calendar=buildPresenterCalendar(macro,earnings,now);
  const upcoming=selectBlueDeskUpcoming(calendar,now).slice(0,5);
  // A missing verified-news feed should promote genuinely sourced upcoming events,
  // not a blank live-headline panel or an unverified social claim.
  const liveCatalystSection=(
    <section className={ui.section} aria-labelledby="catalysts-first" data-catalyst-led="verified-only">
        <p className={ui.kicker}>WHAT IS ACTUALLY HAPPENING</p>
        <h2 id="catalysts-first">The events with consequences</h2>
        <p>These are dated, source-verified developments. The human stakes and possible transmission
          below are explanatory context, not proof that markets have already moved because of the event.</p>
        {topics.length ? <div className={ui.catalystGrid}>
          {topics.slice(0,5).map(topic=>{
            const lead=topic.updates[0];
            return <article className={ui.catalystCard} key={topic.id} id={topic.id}>
              <p className={ui.kicker}>REPORTED CATALYST · {topic.title.toUpperCase()}</p>
              <h3>{lead.headline}</h3>
              <p className={ui.catalystFact}>{lead.summary}</p>
              <p className={ui.catalystClock}>Event <DualTimestamp value={lead.occurredAt}/></p>
              <div className={ui.humanStakes}>
                <strong>Why people with money at stake care</strong>
                <p>{topic.humanStake}</p>
              </div>
              <p className={ui.catalystMechanism}><strong>How it could move markets:</strong> {topic.marketMechanism}</p>
              <p className={ui.catalystQuestion}><strong>The investor's next question:</strong> {topic.guidingQuestion}</p>
              <a href={lead.sourceUrl} rel="noopener noreferrer" target="_blank">
                {lead.sourceName} · original dated report
              </a>
              {topic.updates.length>1 ? <div className={ui.sourceTrail}>
                <strong>{topic.updates.length-1} other source-dated update{topic.updates.length===2?"":"s"} in this theme</strong>
                {topic.updates.slice(1,3).map(item=><p key={item.id}>
                  <a href={item.sourceUrl} rel="noopener noreferrer" target="_blank">{item.headline}</a>
                  {" · "}<DualTimestamp value={item.occurredAt}/>
                </p>)}
              </div>:null}
            </article>;
          })}
        </div> : <p className={ui.empty}>No verified fresh catalyst could be admitted.
          The calendar and historical themes below remain available, but are not today's verified news.</p>}
      </section>
  );
  const upcomingDecisionSection=(
    <section className={ui.section} aria-labelledby="upcoming-decisions" data-upcoming-decisions="source-calendar">
        <p className={ui.kicker}>WHAT COULD CHANGE THE PICTURE</p>
        <h2 id="upcoming-decisions">The next scheduled decisions</h2>
        <p>Company earnings and economic releases are where expectations meet actual numbers.
          These dates come from the existing source-listed calendar; an upcoming event is not a reported result.</p>
        {upcoming.length ? <div className={ui.calendarStrip}>{upcoming.map(event=>
          <article key={event.id} className={ui.calendarCard}>
            <p className={ui.kicker}>{event.kind.toUpperCase()} · {event.status}</p>
            <h3>{event.title}</h3>
            <ScopeStrip assets={event.affectedAssets} max={4} />
            <p className={ui.catalystClock}>Scheduled <DualTimestamp value={event.scheduledAt} sourceDate={event.localDate}/></p>
            <p><strong>Why this matters to people:</strong> {calendarHumanStake(event.title)}</p>
            <p><strong>What investors need answered:</strong> {event.decidingQuestion}</p>
            <p>Consensus {event.consensus||"not established"} · Previous {event.revisedPrevious||event.previous||"unavailable"}</p>
            <a href={event.sourceUrl} rel="noopener noreferrer" target="_blank">{event.sourceName} · release source</a>
          </article>)}</div>:<p className={ui.empty}>No source-listed upcoming event is available in the current calendar window.
          That is a coverage gap, not a forecast of quiet markets.</p>}
        <p><Link href={blueDeskPublicHref("/blue-desk/calendar",host)}>Full dated catalyst calendar</Link></p>
      </section>
  );
  return <main className={desk.page} data-bluebelly-stories="catalyst-led"
    data-living-topics="dossier-independent">
    <BlueDeskHeader activePath="/blue-desk/key-stories" />
    <div className={desk.content}>
      <header className={ui.intro}>
        <p className={desk.kicker}>STORY DESK / CATALYSTS FIRST</p>
        <h1>What happened — and why should anyone care?</h1>
        <p>Events move markets. But is the opportunity worth the risk? Start with what happened,
          see what investors are paying for, then examine what could change the verdict.</p>
        <p>Source-verified developments and longer-running research are labelled separately.
          A compelling thesis is not the same as an observed market reaction.</p>
        <Link className={ui.returnLink}
          href={blueDeskPublicHref("/blue-desk/daily-report",host)}>
          Read the Daily Report
        </Link>
        {" · "}
        <Link className={ui.returnLink} href="#newsroom-title">Browse Newsroom topics</Link>
      </header>
      <div className={ui.summary}>
        <span>{theses.length} ongoing market stories</span>
        <span>{topics.length} fresh news themes</span>
        <span>{news.length} source-verified development{news.length === 1 ? "" : "s"}</span>
        <span>As of <DualTimestamp value={now.toISOString()} /></span>
      </div>
      <section className={ui.section} aria-labelledby="persistent-theses" data-persistent-thesis-ledger="source-identity">
        <p className={ui.kicker}>THE STORY LIBRARY</p>
        <h2 id="persistent-theses">Key Stories by market theme</h2>
        <p>Read the enduring market questions as articles, with recorded evidence limits and deciding tests.
           Fresh source-verified developments appear separately below.</p>
        <nav className={ui.categoryFilters} aria-label="Filter Key Stories by market category">
          <Link href={indexHref} aria-current={activeCategory==="All"?"page":undefined}
            className={activeCategory==="All"?ui.categorySelected:ui.categoryLink}>All Stories</Link>
          {PUBLIC_STORY_CATEGORIES.map(category=><Link key={category}
            href={indexHref+"?category="+encodeURIComponent(category)}
            aria-current={activeCategory===category?"page":undefined}
            className={activeCategory===category?ui.categorySelected:ui.categoryLink}>
            {category}
          </Link>)}
        </nav>
        {visibleTheses.length?<div className={ui.cards}>{visibleTheses.map(thesis=>
          <article className={ui.card} id={"thesis-"+thesis.slug} key={thesis.id} data-stored-story={thesis.status}>
            <p className={ui.kicker}>{classifyPublicStory(thesis)} · ONGOING RESEARCH</p>
            <h3><Link href={indexHref+"?story="+encodeURIComponent(thesis.slug)}>{thesis.title}</Link></h3>
            <p className={ui.storyIntro}>{thesis.thesis}</p>
            <p className={ui.timeNote}>{thesis.latestMotionAt?
              <>LINKED CONTEXT · {thesis.latestMotionVerification==="VERIFIED"?"SOURCE-VERIFIED EVENT":"UNVERIFIED RESEARCH LEAD"} · <DualTimestamp value={thesis.latestMotionAt}/> · </>:null}
              Last researched <DualTimestamp value={thesis.updatedAt}/>. Historical thesis, not a confirmed live market reaction.</p>
            <Link className={ui.storyRead} href={indexHref+"?story="+encodeURIComponent(thesis.slug)}>
              Read the explanation, countercase and next test →
            </Link>
          </article>)}</div>:
          <p className={ui.empty}>No Stories are currently available in this category. Try All Stories; this does not imply an inactive market.</p>}
      </section>
      {investorTest ? <InvestorTest view={investorTest}/> : null}
      {topics.length ? <>{liveCatalystSection}{upcomingDecisionSection}</> : <>
        {upcomingDecisionSection}
        <p className={ui.coverageNote}>No recent source-verified headline passed the Live News gate.
          Scheduled catalysts are shown first instead of filling this space with unverified X speculation.
          Historical Story research follows below.</p>
      </>}
      <NewsroomLensExplorer news={news} asOf={now.toISOString()} />
      <section className={ui.section} aria-labelledby="recent-originals">
        <h2 id="recent-originals">Latest original-source market observations</h2>
        <p>Exact dated measurements or official releases only. A market close does not explain its own cause,
          and an old observation does not become new because it was retrieved again.</p>
        {observations.length?<div className={ui.cards}>{observations.map(item=>
          <article className={ui.card} key={item.id}>
            <p className={ui.kicker}>{item.kind==="MARKET_OBSERVATION"?"LAST COMPLETED MARKET OBSERVATION":"ORIGINAL RELEASE"}</p>
            <p>{item.description}</p>
            <small>Event time <DualTimestamp value={item.eventAt}/></small>
            <a href={item.sourceUrl} rel="noopener noreferrer" target="_blank">{item.sourceName} · original source</a>
          </article>
        )}</div>:<p className={ui.empty}>No qualifying recent original-source measurements. This is not evidence of an inactive market.</p>}
      </section>

    </div>
  </main>;
}
