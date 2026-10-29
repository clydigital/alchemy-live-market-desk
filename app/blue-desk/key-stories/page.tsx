import Link from "next/link";
import { headers } from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import { ScopeStrip } from "@/components/blue-desk/EntityIdentity";
import InvestorTest from "@/components/blue-desk/InvestorTest";
import RbnzDecisionFeature from "@/components/blue-desk/RbnzDecisionFeature";
import AmazonFomcFeatures, {EDITORIAL_FEATURES} from "@/components/blue-desk/AmazonFomcFeatures";
import EarningsInvestorDeepDive from "@/components/blue-desk/EarningsInvestorDeepDive";
import {getEarningsCase} from "@/lib/bluebelly-earnings-investor-stories";
import NewsroomLensExplorer from "@/components/blue-desk/NewsroomLensExplorer";
import EditorialStoryArt from "@/components/blue-desk/EditorialStoryArt";
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
import VerifiedCatalystArticle from "@/components/blue-desk/VerifiedCatalystArticle";
import ShortNewsRecap, {recapFromDecision,recapFromNews} from "@/components/blue-desk/ShortNewsRecap";
import KeyStoryDeepArticle from "@/components/blue-desk/KeyStoryDeepArticle";
import {OCTOBER_FED_DEPTH,storyCoverageForNews,storyDepthForNews} from "@/lib/bluebelly-key-story-depth";
import NewsroomEventReader from "@/components/blue-desk/NewsroomEventReader";
import {PostEventRecapArticle} from "@/components/blue-desk/PostEventRecap";
import {findPostEventRecap} from "@/lib/bluebelly-post-event-recap";
import {getEventSocialContext} from "@/lib/bluebelly-event-social-server";
import {bankDecisionById} from "@/lib/bluebelly-bank-decision-snapshots";
import {reportedEditorialById} from "@/lib/bluebelly-reported-editorial";
import {decisionTopics} from "@/lib/bluebelly-decision-brief";
import {getRecentVerifiedEarningsScorecards} from "@/lib/blue-desk-earnings-results";
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

export default async function KeyStories({searchParams}:{searchParams?:Promise<{story?:string;category?:string;catalyst?:string;feature?:string;page?:string;news?:string;brief?:string;policy?:string;reported?:string;postEvent?:string}>}){
  const params=await searchParams;
  const now = new Date();
  const host = (await headers()).get("host");
  // Public, allowlisted post-event recaps reuse previously reviewed source
  // snapshots; arbitrary query IDs never select private research or a URL.
  const recapId=typeof params?.postEvent==="string"&&/^[a-z0-9_-]{1,150}$/i.test(params.postEvent)?params.postEvent:null;
  const postEvent=recapId?findPostEventRecap(recapId,[],now):null;
  if(postEvent){
    const commentary=postEvent.kind==="bank"
      ?await getEventSocialContext(postEvent.id,postEvent.releaseAt,now).catch(()=>[])
      :[];
    return <main className={desk.page} data-key-story="post-event-source-reviewed">
      <BlueDeskHeader activePath="/blue-desk/key-stories"/>
      <div className={desk.content}><PostEventRecapArticle recap={postEvent} socialPosts={commentary}
        backHref={blueDeskPublicHref("/blue-desk/key-stories",host)}/></div>
    </main>;
  }
  const editorialKind=params?.feature==="amazon-cash-test-october-2026"?"amazon":params?.feature==="fomc-october-2026"?"fomc":null;
  if(editorialKind)return <main className={desk.page}><BlueDeskHeader activePath="/blue-desk/key-stories"/><div className={desk.content}><Link href={blueDeskPublicHref("/blue-desk/key-stories",host)}>← All Key Stories</Link><AmazonFomcFeatures kind={editorialKind}/></div></main>;
  // This known public October FOMC edition has a separately reviewed source
  // packet. Its permanent bookmark must not expire with the seven-day news tape.
  // A query cannot select other editorial or private records.
  if(params?.news==="e378d91d-deb9-4148-88c5-ab6bf5ef367f")return <main className={desk.page} data-bluebelly-news="depth-reviewed-original-event">
    <BlueDeskHeader activePath="/blue-desk/key-stories"/>
    <div className={desk.content}><KeyStoryDeepArticle depth={OCTOBER_FED_DEPTH}
      backHref={blueDeskPublicHref("/blue-desk/key-stories",host)}
      relatedHref={blueDeskPublicHref("/blue-desk/key-stories",host)+"?feature=fomc-october-2026"}/></div>
  </main>;
  // Dated and bounded on-site editor-verified policy / reported-rumour readers.
  // They are NOT accepted original-RSS NewsBrief records or private research.
  const policy=typeof params?.policy==="string"?bankDecisionById(params.policy,now):null;
  const reported=typeof params?.reported==="string"?reportedEditorialById(params.reported,now):null;
  // Existing accepted, low-trust social leads are context, never proof of
  // the policy decision. Failed reads degrade to the official link.
  const socialPosts=policy?await getEventSocialContext(policy.id,policy.releaseAt,now).catch(()=>[]):[];
  if(policy||reported) return <main className={desk.page}>
    <BlueDeskHeader activePath="/blue-desk/key-stories"/>
    <div className={desk.content}><NewsroomEventReader
      event={policy?{kind:"bank",value:policy}:{kind:"reported",value:reported!}}
      socialPosts={socialPosts}
      backHref={blueDeskPublicHref("/blue-desk/newsroom",host)}/></div>
  </main>;
  const [raw, theses, observations, originalPress, macro, earnings] = await Promise.all([
    getCurrentVerifiedMarketMotion({ limit: 36 }).catch(() => []),
    getPublicThesisLedger(now,24).catch(() => []),
    getPublicSourceObservations(now,8).catch(() => []),
    getOriginalPressNews(now,18,7).catch(() => []),
    getEconomicCalendar().catch(() => []),
    getForwardEarningsEvents({now}).catch(() => ({events:[],coverage:"unavailable" as const,warning:"Earnings coverage unavailable"})),
  ]);
  if(params?.feature === "rbnz-october-2026") return <main className={desk.page}><BlueDeskHeader activePath="/blue-desk/key-stories"/><div className={desk.content}><Link href={blueDeskPublicHref("/blue-desk/key-stories",host)}>← All Key Stories</Link><RbnzDecisionFeature /></div></main>;
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
  const pageNumber=Math.max(1,Math.min(Math.ceil(visibleTheses.length/6)||1,Number.parseInt(params?.page||"1",10)||1));
  const pageTheses=visibleTheses.slice((pageNumber-1)*6,pageNumber*6);
  const indexHref=blueDeskPublicHref("/blue-desk/key-stories",host);
  const investorTest=selectFlagshipInvestorTest(orderedTheses);
  const motionNews = selectVerifiedNewsBriefs(raw, now, 18);
  const recentNews = combineQualifiedNews(motionNews,originalPress,18);
  const news = recentNews.filter(n=>Date.parse(n.occurredAt)<=+now && +now-Date.parse(n.occurredAt)<=48*3600000);
  const earlierNews=recentNews.filter(n=>!news.some(current=>current.id===n.id));
  const topics = projectLivingMarketTopics(news);
  const calendar=buildPresenterCalendar(macro,earnings,now);
  // The same bounded public page serves read-only, source-qualified short explainers.
  // A query never admits an arbitrary URL, record, unpublished research item, or owner document.
  const newsId=typeof params?.news==="string"&&/^[a-z0-9_-]{1,150}$/i.test(params.news)?params.news:null;
  if(newsId){
    const event=recentNews.find(n=>n.id===newsId);
    // Reuse a reviewed packet for any matching original, clock-qualified
    // public news receipt. No on-page research or trust in arbitrary IDs.
    const researched=event?storyDepthForNews(event):null;
    if(event&&researched)return <main className={desk.page} data-bluebelly-news="depth-reviewed-original-event">
      <BlueDeskHeader activePath="/blue-desk/key-stories"/>
      <div className={desk.content}><KeyStoryDeepArticle receipt={event} depth={researched}
        backHref={blueDeskPublicHref("/blue-desk/key-stories",host)}
        relatedHref={blueDeskPublicHref("/blue-desk/key-stories",host)+(researched.relatedHref||"")}/></div>
    </main>;
    return <main className={desk.page} data-bluebelly-news="single-receipt-reader">
      <BlueDeskHeader activePath="/blue-desk/key-stories"/>
      <div className={desk.content}>{event?
        <ShortNewsRecap recap={recapFromNews(event)} coverage={storyCoverageForNews(event)} backHref={blueDeskPublicHref("/blue-desk/key-stories",host)}/>:
        <section className={ui.empty}><h1>Report unavailable</h1>
         <p>That report is outside the verified public news window.</p>
         <Link href={blueDeskPublicHref("/blue-desk/key-stories",host)}>All Key Stories</Link></section>}</div>
    </main>;
  }
  const briefId=typeof params?.brief==="string"&&/^[a-z0-9_:-]{1,150}$/i.test(params.brief)?params.brief:null;
  // Preserve the exact pre-print Amazon bookmark as a historical reading
  // edition after the calendar window expires. This is not a Q3 actuals feed.
  if(briefId==="earnings:mev_146cecdc376b7290256b1a81")return <main className={desk.page} data-earnings-bookmark="immutable-dated-preview">
    <BlueDeskHeader activePath="/blue-desk/key-stories"/>
    <div className={desk.content}>
      <Link href={blueDeskPublicHref("/blue-desk/key-stories",host)}>← All Key Stories</Link>
      <AmazonFomcFeatures kind="amazon"/>
      <p><Link href={blueDeskPublicHref("/blue-desk/markets",host)+"?view=earnings&ticker=AMZN"}>Read the full Amazon business model, cash-flow bridge and balance-sheet investor investigation →</Link></p>
    </div>
  </main>;
  if(briefId){
    // The home DecisionBrief displays only the top five topics and only one
    // earnings headline. Deep-linked official issuer events must remain
    // readable even when another company's release has higher attention.
    const issuerEvent=calendar.events.find(e=>
      e.id===briefId && e.kind==="earnings" && e.status==="scheduled" && e.verificationState==="official");
    const earningsReceipt=getRecentVerifiedEarningsScorecards(now,7).find(e=>e.id===briefId)||null;
    const selected=decisionTopics(news,calendar,now).find(t=>t.id===briefId) ||
      (earningsReceipt ? {
        id:earningsReceipt.id,title:earningsReceipt.headline,
        fact:earningsReceipt.company+" · "+earningsReceipt.fiscalPeriod+": "+earningsReceipt.metrics.filter(m=>m.state==="measured").map(m=>m.name+" "+m.value).join("; "),
        why:earningsReceipt.conclusion,test:earningsReceipt.nextTest,
        at:earningsReceipt.releaseDay,sourceUrl:earningsReceipt.sourceUrl,
        sourceName:earningsReceipt.sourceName,
        href:"?brief="+encodeURIComponent(earningsReceipt.id),
        status:"NEW" as const,mechanism:earningsReceipt.outlook,
        assets:[earningsReceipt.ticker],priority:2,
      } : null) ||

      (issuerEvent ? {
        id:issuerEvent.id,title:issuerEvent.title,
        fact:"Scheduled issuer event; no verified release outcome yet.",
        why:issuerEvent.decidingQuestion,test:issuerEvent.decidingQuestion,
        at:issuerEvent.scheduledAt||issuerEvent.localDate,
        sourceUrl:issuerEvent.sourceUrl,sourceName:issuerEvent.sourceName,
        href:"?brief="+encodeURIComponent(issuerEvent.id),
        status:"UPCOMING" as const,mechanism:"Test reported sales and profit against prior guidance, then follow operating cash, capex and the next outlook.",
        assets:issuerEvent.affectedAssets,priority:2,
      }:null);
    // An official Amazon earnings calendar receipt is a preview, not a results
    // statement. Route readers to the already researched long-form financial
    // story instead of the bare four-field calendar recap. Keep the query
    // allowlist: no arbitrary brief or private source can select this article.
    if(selected?.status==="UPCOMING" && selected.assets.includes("AMZN") && !earningsReceipt) {
      return <main className={desk.page} data-bluebelly-earnings-preview="dated-primary-source-research">
        <BlueDeskHeader activePath="/blue-desk/key-stories"/>
        <div className={desk.content}>
          <Link href={blueDeskPublicHref("/blue-desk/key-stories",host)}>← All Key Stories</Link>
          <AmazonFomcFeatures kind="amazon" />
          <p>Read the <Link href={blueDeskPublicHref("/blue-desk/markets",host)+"?view=earnings&ticker=AMZN"}>complete Amazon financial investigation →</Link> or the <Link href={blueDeskPublicHref("/blue-desk/markets",host)+"#earnings-fundamentals"}>seven-company investor tests</Link>. Financial figures are dated; no forthcoming Q3 result is inferred.</p>
        </div>
      </main>;
    }
    // Route only authenticated-to-source, public issuer calendar events to a
    // pre-reviewed company dossier; never read arbitrary user-supplied URLs.
    const knownTicker=issuerEvent?.affectedAssets.find(t=>getEarningsCase(t));
    if(selected?.status==="UPCOMING" && knownTicker && !earningsReceipt){
      return <main className={desk.page} data-bluebelly-earnings-preview="full-dated-financial-investigation">
        <BlueDeskHeader activePath="/blue-desk/key-stories"/>
        <div className={desk.content}>
          <EarningsInvestorDeepDive ticker={knownTicker} backHref={blueDeskPublicHref("/blue-desk/markets",host)}/>
        </div>
      </main>;
    }
    return <main className={desk.page} data-bluebelly-news="decision-recap-reader">
      <BlueDeskHeader activePath="/blue-desk/key-stories"/>
      <div className={desk.content}>{selected?
        <ShortNewsRecap recap={recapFromDecision(selected,earningsReceipt)}
           backHref={blueDeskPublicHref("/blue-desk/key-stories",host)}/>:
        <section className={ui.empty}><h1>Decision brief unavailable</h1>
         <p>The requested event is not in the current approved source-qualified slate.</p>
         <Link href={blueDeskPublicHref("/blue-desk/key-stories",host)}>All Key Stories</Link></section>}</div>
    </main>;
  }
  // The dated event explainer is rolling public news, not a thesis revision.
  const catalystId=typeof params?.catalyst==="string"&&/^[a-z0-9-]{1,80}$/.test(params.catalyst)
    ?params.catalyst:null;
  if(catalystId){
    const selected=topics.find(topic=>topic.id===catalystId);
    return <main className={desk.page} data-bluebelly-stories="verified-catalyst-reading-mode">
      <BlueDeskHeader activePath="/blue-desk/key-stories"/>
      <div className={desk.content}>
        {selected?<VerifiedCatalystArticle topic={selected} backHref={indexHref}/>:
          <section className={ui.empty} data-catalyst-unavailable="true">
            <h1>Verified event coverage unavailable</h1>
            <p>The requested event theme is not in the current source-verified news window.
              Historical Story research remains separate from fresh news.</p>
            <Link href={indexHref}>Return to Key Stories</Link>
          </section>}
      </div>
    </main>;
  }
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
              <h3><Link href={indexHref+"?catalyst="+encodeURIComponent(topic.id)}>{lead.headline}</Link></h3>
              <p className={ui.catalystFact}>{lead.summary}</p>
              <p className={ui.catalystClock}>Event <DualTimestamp value={lead.occurredAt}/></p>
              <div className={ui.humanStakes}>
                <strong>Why people with money at stake care</strong>
                <p>{topic.humanStake}</p>
              </div>
              <p className={ui.catalystMechanism}><strong>How it could move markets:</strong> {topic.marketMechanism}</p>
              <p className={ui.catalystQuestion}><strong>The investor's next question:</strong> {topic.guidingQuestion}</p>
              <p><Link className={ui.storyRead} href={indexHref+"?catalyst="+encodeURIComponent(topic.id)}>
                Read the dated event sequence and what comes next →
              </Link></p>
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
        <p className={desk.kicker}>BLUEBELLY / THE STORY DESK</p>
        <h1>Key stories, explained.</h1>
        <p>Start with what surprised the market. Follow the decision, the money, the contradiction and the next test—with original sources close at hand.</p>
        <nav className={ui.indexNav} aria-label="Key Stories sections">
          {topics.length ? <a href="#current-developments">Latest developments</a> : null}
          {earlierNews.length?<a href="#recent-reports">Earlier this week</a>:null}
          <a href="#persistent-theses">Browse by topic</a>
          <a href="#upcoming-decisions">What's next</a>
          <Link href={blueDeskPublicHref("/blue-desk/markets",host)+"#earnings-fundamentals"}>Earnings &amp; fundamentals</Link>
          <Link href={indexHref+"?feature=rbnz-october-2026"}>RBNZ explainer</Link>
        </nav>
      </header>

      <div className={ui.summary} aria-label="Desk coverage" data-coverage-hud="public-source-counts">
        <div className={ui.summaryMetric}><strong>{news.length}</strong><span>Source-verified news updates</span></div>
        <div className={ui.summaryMetric}><strong>{topics.length}</strong><span>Active news themes</span></div>
        <div className={ui.summaryMetric}><strong>{theses.length}</strong><span>Ongoing research stories</span></div>
        <div className={ui.summaryTimestamp}>
          <span className={ui.summaryLabel}>FEED CHECKED</span>
          <DualTimestamp value={now.toISOString()} className={ui.summaryTime} />
        </div>
      </div>
      <section className={ui.section} aria-label="Dated editorial features"><h2>The decision and the money</h2><p><Link href={blueDeskPublicHref("/blue-desk/markets",host)+"#earnings-fundamentals"}>Investor fundamentals: Amazon, Intel, SanDisk, AMD, Apple, Pfizer and Palantir →</Link></p><div className={ui.cards}>{EDITORIAL_FEATURES.map(feature=><article className={ui.card} key={feature.id}><p className={ui.kicker}>DATED EDITORIAL · 29 OCTOBER 2026</p><h3><Link href={indexHref+"?feature="+feature.id}>{feature.title}</Link></h3><p>{feature.summary}</p></article>)}</div></section>
      <section className={ui.section} id="current-developments" aria-label="Current event readers"><h2>Current developments</h2><div className={ui.cards}>{topics.map(topic=><article className={ui.card} key={topic.id}><p className={ui.kicker}>VERIFIED NEWS · <DualTimestamp value={topic.latestObservedAt}/></p><h3><Link href={indexHref+"?catalyst="+topic.id}>{topic.updates[0].headline}</Link></h3><p>{topic.guidingQuestion}</p></article>)}<article className={ui.card}><p className={ui.kicker}>DATED FEATURE · 28 OCTOBER 2026</p><h3><Link href={indexHref+"?feature=rbnz-october-2026"}>New Zealand’s surprise pause</Link></h3><p>Why a hold can surprise: follow expectations, the decision and the reported currency response.</p></article></div></section>
      {earlierNews.length?<section className={ui.section} id="recent-reports" aria-label="More verified reports from this week">
        <p className={ui.kicker}>SOURCE-VERIFIED / DATED PREVIOUS DAYS</p>
        <h2>More news from the past seven days</h2>
        <p>Previously published original-source announcements and dated official analyses. They are not new breaking events or proof of a market reaction.</p>
        <div className={ui.cards}>{earlierNews.map(n=><article className={ui.card} key={n.id}>
          <div style={{maxWidth:240,marginBottom:12}}><EditorialStoryArt headline={n.headline} summary={n.summary} compact/></div>
          <p className={ui.kicker}>EARLIER REPORT · <DualTimestamp value={n.occurredAt}/></p>
          <h3><Link href={indexHref+"?news="+encodeURIComponent(n.id)}>{n.headline}</Link></h3>
          <p>{storyCoverageForNews(n).status==="RESEARCH_ENRICHED"
            ? "Full dated analysis available: previous, expectation, actual, market implications and evidence limits."
            : n.sourceName.includes("official analysis")
            ? "Official analytical publication verified. Its dated findings are not a newly announced policy decision or an independently measured price reaction."
            : "Original announcement verified. Prior expectations, numerical comparison and actual market response remain research gaps."}</p>
          <Link className={ui.storyRead} href={indexHref+"?news="+encodeURIComponent(n.id)}>{storyCoverageForNews(n).status==="RESEARCH_ENRICHED"?"Read the financial investigation →":"Read source notice and research gaps →"}</Link>
          <p><small>{n.sourceName} · verified original report</small></p>
        </article>)}</div>
      </section>:null}
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
        {visibleTheses.length?<div className={ui.cards}>{pageTheses.map(thesis=>
          <article className={ui.card} id={"thesis-"+thesis.slug} key={thesis.id} data-stored-story={thesis.status}>
            <p className={ui.kicker}>{classifyPublicStory(thesis)} · ONGOING RESEARCH</p>
            <h3><Link href={indexHref+"?story="+encodeURIComponent(thesis.slug)}>{thesis.title}</Link></h3>
            <p className={ui.storyIntro}>{thesis.question}</p>
            <p><strong>Next test:</strong> {thesis.nextTest || "No dated test recorded."}</p>
            <details><summary>Supporting and contradicting signals</summary><p>{thesis.support || "Supporting evidence unavailable in this snapshot."}</p><p>{thesis.contradiction || "Counter-evidence unavailable in this snapshot."}</p></details>
            <p className={ui.timeNote}>{thesis.latestMotionAt?
              <>LINKED CONTEXT · {thesis.latestMotionVerification==="VERIFIED"?"SOURCE-VERIFIED EVENT":"UNVERIFIED RESEARCH LEAD"} · <DualTimestamp value={thesis.latestMotionAt}/> · </>:null}
              Last researched <DualTimestamp value={thesis.updatedAt}/>. Historical thesis, not a confirmed live market reaction.</p>
            <Link className={ui.storyRead} href={indexHref+"?story="+encodeURIComponent(thesis.slug)}>
              Read the explanation, countercase and next test →
            </Link>
          </article>)}</div>:
          <p className={ui.empty}>No Stories are currently available in this category. Try All Stories; this does not imply an inactive market.</p>}
      </section>
      <nav className={ui.categoryFilters} aria-label="Research pages">{Array.from({length:Math.ceil(visibleTheses.length/6)},(_,i)=><Link key={i} aria-current={pageNumber===i+1?"page":undefined} href={indexHref+"?category="+encodeURIComponent(activeCategory)+"&page="+(i+1)}>Page {i+1}</Link>)}</nav>
      {upcomingDecisionSection}
      <details><summary>Research tools, source observations and further reading</summary>
      {investorTest ? <InvestorTest view={investorTest}/> : null}
      {topics.length ? liveCatalystSection :
        <p className={ui.coverageNote}>No recent source-verified headline passed the Live News gate.
          The scheduled decisions above remain visible, while unverified X speculation is excluded.</p>}
      <NewsroomLensExplorer news={news} asOf={now.toISOString()} />
      <section className={ui.section} aria-labelledby="manual-feature-stories" data-independent-research-features="source-linked-archive">
        <p className={ui.kicker}>EXPLORE THE BIGGER PICTURE</p>
        <h2 id="manual-feature-stories">Deep research and historical comparisons</h2>
        <p>The market does not begin and end with today’s headlines. Read the wider investigations and their unresolved questions.</p>
        <div className={ui.cards}>
          <article className={ui.card}><h3>New Zealand’s surprise pause</h3><p>Expectations, the rate decision and the currency response — a dated October 2026 feature.</p><Link href={indexHref+"?feature=rbnz-october-2026"}>Read the RBNZ story →</Link></article>
          <article className={ui.card}>
            <p className={ui.kicker}>ASIA EQUITIES · 27 OCTOBER 2026</p>
            <div style={{maxWidth:370,marginBottom:12}}><EditorialStoryArt motif="china" headline="Asia AI equities"/></div>
            <h3>China's AI crash vs Korea, Taiwan, Hong Kong and Japan</h3>
            <p>What fell, why the chip markets disagree and what would confirm a broader contagion.</p>
            <Link href={blueDeskPublicHref("/blue-desk/features/asia-equities",host)}>Read Asia story and manual research →</Link>
          </article>
          <article className={ui.card}>
            <p className={ui.kicker}>GLOBAL BONDS · FRANCE VS GREECE</p>
            <div style={{maxWidth:370,marginBottom:12}}><EditorialStoryArt motif="bonds" headline="Sovereign bond stress"/></div>
            <h3>Greece's 2010 crisis versus France's bond scare</h3>
            <p>What 178 basis points signalled, why the spread retreated and how to test sovereign contagion.</p>
            <Link href={blueDeskPublicHref("/blue-desk/features/global-bonds",host)}>Read global bonds story and manual research →</Link>
          </article>
        </div>
      </section>


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

      </details>
    </div>
  </main>;
}
