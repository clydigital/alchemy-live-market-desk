import CurrentMarketUpdates from "@/components/blue-desk/CurrentMarketUpdates";
import DecisionBrief from "@/components/blue-desk/DecisionBrief";
import ProgressiveTodayReader from "@/components/blue-desk/ProgressiveTodayReader";
import PublishedResearchDispatches from "@/components/blue-desk/PublishedResearchDispatches";
import {projectPublishedResearchFocus} from "@/lib/blue-desk-published-research-focus";
import Link from "next/link";
import { headers } from "next/headers";

import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import { blueDeskPublicHref, isBlueDeskPublicReaderHost } from "@/lib/blue-desk-host";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import BluebellyNewsfront from "@/components/blue-desk/BluebellyNewsfront";
import EditorialStoryArt from "@/components/blue-desk/EditorialStoryArt";
import { EntityMark, ScopeStrip } from "@/components/blue-desk/EntityIdentity";
import { MarketIcon } from "@/components/blue-desk/MarketIcon";
import { buildPresenterCalendar } from "@/lib/presenter-calendar";
import { selectBlueDeskUpcoming } from "@/lib/blue-desk-calendar";
import { getEconomicCalendar } from "@/lib/calendar";
import { getForwardEarningsEvents } from "@/lib/forward-earnings-sources";

import { getMarketMonitor } from "@/lib/market-monitor-public";
import {selectPostEventRecaps} from "@/lib/bluebelly-post-event-recap";



import { selectVerifiedNewsBriefs } from "@/lib/market-brief-news";
import { getOriginalPressNews } from "@/lib/blue-desk-original-press-news-server";
import {getCompletedOfficialMacroNews} from "@/lib/blue-desk-canonical-macro-news-server";
import { combineQualifiedNews } from "@/lib/blue-desk-qualified-news";
import { projectLivingMarketTopics } from "@/lib/blue-desk-living-topics";
import catalyst from "./catalyst-note.module.css";


import tracked from "./tracked-stories.module.css";
import { getCurrentVerifiedMarketMotion } from "@/lib/market-motion";
import { getPublicSourceObservations } from "@/lib/blue-desk-source-observations";
import { getPublicThesisLedger } from "@/lib/blue-desk-thesis-ledger-server";
import {storyMarketTransmission} from "@/lib/blue-desk-thesis-ledger";
import {classifyPublicStory} from "@/lib/blue-desk-story-categories";
import {getPublishedMacroPulseBriefs} from "@/lib/blue-desk-macropulse-brief-server";
import {projectWhatsNewTrends} from "@/lib/blue-desk-whats-new-trends";
import WhatsNewTrendDashboard from "@/components/blue-desk/WhatsNewTrendDashboard";

import styles from "./blue-desk.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Blue Desk | Market Intelligence",
  description: "Market stories, rates and upcoming events.",
};



const YIELD_IDS = ["us2y", "us5y-fred", "us10y-fred", "us20y-fred", "us30y-fred"];

function ellipsis(value: string, max = 175) {
  if (value.length <= max) return value;
  return value.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

export default async function BlueDeskPage({ searchParams }: { searchParams?: Promise<{ storiesPage?: string | string[] }> }) {
  const rawPage = (await searchParams)?.storiesPage;
  const pageText = Array.isArray(rawPage) ? rawPage[0] : rawPage;
  const storyPage = pageText && /^\d{1,2}$/.test(pageText) ? Number(pageText) : 1;
  const now = new Date();
  const host = (await headers()).get("host");
  const publicHost = isBlueDeskPublicReaderHost(host);
  const [macro, earnings, monitor, verifiedMotions, observations, theses, originalPress, digestBriefs] = await Promise.all([
    getEconomicCalendar().catch(() => []),
    getForwardEarningsEvents({ now }).catch(() => ({
      events: [], coverage: "unavailable" as const, warning: "Earnings source unavailable",
    })),
    getMarketMonitor().catch(() => null),
    getCurrentVerifiedMarketMotion({ limit: 36 }).catch(() => []),
    getPublicSourceObservations(now,12).catch(() => []),
    getPublicThesisLedger(now,24).catch(() => []),
    // Both sources are already original-source qualified; the new second
    // arm is READ-ONLY completed macro actuals, not research drafts.
    Promise.all([
      getOriginalPressNews(now,18,7).catch(()=>[]),
      getCompletedOfficialMacroNews(now,18,7).catch(()=>[]),
    ]).then(([press,macroActuals])=>[...press,...macroActuals]),
    getPublishedMacroPulseBriefs(2).catch(() => []),
  ]);
  const motionNews = selectVerifiedNewsBriefs(verifiedMotions, now, 18);
  const recentNews = combineQualifiedNews(motionNews,originalPress,18);
  const verifiedNews = recentNews.filter(n=>Date.parse(n.occurredAt)<=+now && +now-Date.parse(n.occurredAt)<=48*3600000);
  // Display reviewed bank and earnings outcomes first, keeping source-only leads clearly labelled.
  const postEventRecaps=selectPostEventRecaps(recentNews,now,8);
  const newsFeature = verifiedNews[0] || null;
  const featureTopic = newsFeature ? projectLivingMarketTopics([newsFeature])[0] : null;
  const observedFeature = observations[0] || null;
  const olderStory = !newsFeature && !observedFeature ? (theses[0]||null) : null;
  const yields = YIELD_IDS.map(id => monitor?.rows.find(row => row.id === id)).filter(
    (row): row is NonNullable<typeof row> => Boolean(row),
  );

  // The established presenter-calendar/1 adapter owns time admission and coverage.
  const calendar = buildPresenterCalendar(macro, earnings, now);
  const upcoming7d = selectBlueDeskUpcoming(calendar, now).slice(0, 6);
  const upcomingFallback = upcoming7d.length ? [] : selectBlueDeskUpcoming(calendar, now, 30).slice(0, 3);
  const upcoming = upcoming7d.length ? upcoming7d : upcomingFallback;

  return (
    <main className={styles.page} data-blue-desk-convergence="phase-1">
      <BlueDeskHeader activePath="/blue-desk" />
        {!publicHost?<CurrentMarketUpdates host={host} mode="full" now={now}/>:null}
      <div className={styles.content}>
        {publicHost?<ProgressiveTodayReader news={verifiedNews} calendar={calendar} now={now} host={host}/>:
          <DecisionBrief news={verifiedNews} recentNews={recentNews} calendar={calendar} now={now} host={host}
            postEventRecaps={postEventRecaps} storyPage={storyPage}/>}
        {publicHost?<details data-home-detailed-brief="on-demand" style={{margin:"18px 0",border:"1px solid var(--bb-line)",padding:"14px",background:"var(--bb-surface)"}}>
          <summary style={{cursor:"pointer",color:"var(--bb-accent)",fontWeight:700}}>Open the full dated briefing, earnings and event analysis</summary>
          <DecisionBrief news={verifiedNews} recentNews={recentNews} calendar={calendar} now={now} host={host}
            postEventRecaps={postEventRecaps} storyPage={storyPage}/>
        </details>:null}
        <details data-home-archive="on-demand" style={{margin:"18px 0",border:"1px solid var(--bb-line)",padding:"14px",background:"var(--bb-surface)"}}>
          <summary style={{cursor:"pointer",color:"var(--bb-accent)",fontWeight:700}}>Browse more dated investigations and previous research</summary>
          <PublishedResearchDispatches items={projectPublishedResearchFocus(digestBriefs,now,3)}
            mode="today" readerHref={blueDeskPublicHref("/blue-desk/newsroom",host)}/>
          <p data-home-research-archive-link="dated-not-live" style={{margin:"12px 0 6px",fontSize:13,color:"var(--bb-muted)"}}>
            Older investigations are preserved separately.{" "}
            <Link href={blueDeskPublicHref("/blue-desk/research",host)}>Browse the dated Research Library →</Link>
          </p>
        </details>
        {/* Legacy research archive remains accessible on the old desk only; Bluebelly readers use dedicated Markets and Key Stories pages. */}
        {!publicHost ? <>
        {/* Historical, source-dated price SVGs stay visible before the long archive. */}
<WhatsNewTrendDashboard
          cards={projectWhatsNewTrends(monitor?.rows||[],now)}
          marketsHref={blueDeskPublicHref("/blue-desk/markets",host)}/>
        <details><summary>Explore dated observations and previous research</summary>
        <BluebellyNewsfront news={verifiedNews} observations={observations} theses={theses} host={host} now={now}
          upcoming={upcoming.map(event=>({id:event.id,title:event.title,sourceName:event.sourceName,
            scheduledAt:event.scheduledAt??null,localDate:event.localDate,sourceUrl:event.sourceUrl}))}/>
        <details data-legacy-monitor="preserved-as-expandable-support">
          <summary style={{marginTop:25,padding:"11px 16px",border:"1px solid #2c617b",cursor:"pointer",background:"#082f48",color:"#aee7fb",fontSize:13}}>
            Expand source-dated lead detail and Treasury yields
          </summary>
        <section className={styles.hero} aria-label="Latest source-dated market development">
          <div className={styles.heroStory}>
            <p className={styles.kicker}><MarketIcon name="market" size={16} />
              {newsFeature ? "LATEST VERIFIED DEVELOPMENT" : observedFeature ? "LATEST DATED MARKET OBSERVATION" : olderStory ? "ONGOING STORY · HISTORICAL VIEW" : "MARKET NEWS"}
            </p>
            {newsFeature ? <div style={{maxWidth:"280px",marginBottom:"13px"}} data-editorial-lead-art="generated-source-labelled"><EditorialStoryArt headline={newsFeature.headline} summary={newsFeature.summary} compact/></div> : null}
            <h1>{newsFeature?.headline || (observedFeature ? ellipsis(observedFeature.description,125) : "") || olderStory?.title || "No verified market headline available"}</h1>
            <p className={styles.heroDeck}>
              {newsFeature?.summary || (observedFeature ? "Recorded by "+observedFeature.sourceName+". This is an observed source value, not evidence of a new catalyst or its cause." : "") ||
                (olderStory ? storyMarketTransmission(olderStory) : "Source verification or provider coverage may be incomplete. Check the calendar and market monitor.")}
            </p>
            {newsFeature && featureTopic ? <div className={catalyst.featureTake} data-live-feature-stakes="verified-catalyst">
              <p className={catalyst.eyebrow}>WHY THIS STORY MATTERS BEYOND THE HEADLINE</p>
              <p>{featureTopic.humanStake}</p>
              <p><strong>What investors need answered:</strong> {featureTopic.guidingQuestion}</p>
            </div> : null}
            <div className={styles.tags}>
              <span className={styles.tag}>{newsFeature ? "SOURCE-VERIFIED FACT" : observedFeature ? "SOURCE-DOCUMENTED MARKET OBSERVATION" : olderStory ? "DATED STORY CONTEXT" : "NO VERIFIED UPDATE"}</span>
            </div>
            <div className={styles.heroFooter}>
              {newsFeature ? (
                <a className={styles.primaryAction} href={newsFeature.sourceUrl} target="_blank" rel="noreferrer">Read original report ↗</a>
              ) : observedFeature ? (
                <a className={styles.primaryAction} href={observedFeature.sourceUrl} target="_blank" rel="noreferrer">Original market source ↗</a>
              ) : olderStory ? (
                <Link className={styles.primaryAction} href={blueDeskPublicHref("/blue-desk/key-stories",host)+"?story="+olderStory.slug}>Read the ongoing story →</Link>
              ) : (
                <Link className={styles.primaryAction} href={blueDeskPublicHref("/blue-desk/newsroom", host)}>
                  Newsroom →</Link>
              )}
              {newsFeature ? <DualTimestamp value={newsFeature.occurredAt} className={styles.heroTime} /> :
                observedFeature ? <DualTimestamp value={observedFeature.eventAt} sourceDate={observedFeature.eventAt} className={styles.heroTime} /> :
                olderStory ? <DualTimestamp value={olderStory.updatedAt} className={styles.heroTime}/> : null}
            </div>
            <p><Link className={styles.textLink} href={blueDeskPublicHref("/blue-desk/newsroom",host)}>
              Newsroom updates and upcoming catalysts →</Link></p>
          </div>
          <aside className={styles.rates} aria-label="Observed US Treasury yield context">
            <h2 id="rates-title"><MarketIcon name="rates" size={25} /> Rates &amp; yields</h2>
            {yields.length ? yields.map(row => (
              <div className={styles.rateRow} key={row.id}>
                <div>
                  <span><EntityMark kind="country" code="US" size="xs" /> {row.label}</span>
                  <small>{row.sourceName} · {row.frequency} series</small>
                  <DualTimestamp value={row.asOf} sourceDate={row.asOf} className={styles.rateTime} />
                </div>
                <strong>{row.last === null ? "—" : row.last.toFixed(2) + "%"}</strong>
              </div>
            )) : <p className={styles.empty}>Yield data unavailable.</p>}
            <Link href={publicHost ? blueDeskPublicHref("/blue-desk/markets?group=rates", host) : "/markets"} className={styles.textLink}>Explore Treasury yield history →</Link>
            <p><Link href={blueDeskPublicHref("/blue-desk/features/global-bonds",host)} className={styles.textLink}>Global bonds: France vs Greece →</Link></p>
          </aside>
        </section>
        </details>

        {/* Historical manually authored features now live under /research, not in a fixed homepage section. */}

        <section className={styles.section} aria-labelledby="ongoing-stories-head" data-public-thesis-ledger="read-only">
          <div className={styles.sectionHead}>
            <div><p className={styles.kicker}>PERSISTENT RESEARCH · DATED THESIS HISTORY</p>
              <h2 id="ongoing-stories-head"><MarketIcon name="layers" size={24} /> Key stories</h2>
              <p>Four current research perspectives. These are dated interpretations, not a list of today's verified headlines.</p>
            </div>
            <Link className={styles.textLink} href={blueDeskPublicHref("/blue-desk/key-stories",host)}>
              Explore evidence and countercases →
            </Link>
          </div>
          {theses.length ? <div className={tracked.grid} data-home-stories="editorial-lead-four">
            {theses.slice(0,4).map((thesis,index) =>
              <article className={index===0?tracked.lead:tracked.card} key={thesis.id}>
                <p className={tracked.kicker}>{classifyPublicStory(thesis)} · ONGOING RESEARCH</p>
                <h3><Link href={blueDeskPublicHref("/blue-desk/key-stories",host)+"?story="+thesis.slug}>
                  {thesis.title}
                </Link></h3>
                <p>{ellipsis(thesis.thesis,index===0?280:145)}</p>
                <div className={tracked.bottom}>
                  <span>Last researched <DualTimestamp value={thesis.updatedAt} className={styles.cardTime}/></span>
                  <Link href={blueDeskPublicHref("/blue-desk/key-stories",host)+"?story="+thesis.slug}>
                    Read context and countercase →
                  </Link>
                </div>
              </article>)}
          </div> : <p className={styles.empty}>No public Story records are available. Research topics and verified headlines are tracked separately.</p>}
        </section>



        <div className={styles.lowerGrid}>
          <section className={styles.secondaryPanel} aria-labelledby="headline-context-title">
            <div className={styles.sectionHead}>
              <div>
                <p className={styles.kicker}>SOURCE-VERIFIED HEADLINES</p>
                <h2 id="headline-context-title"><MarketIcon name="divergence" size={24} /> In the news</h2>
              </div>
              <Link className={styles.textLink} href={blueDeskPublicHref("/blue-desk/key-stories",host)+"#newsroom-title"}>Explore sourced stories →</Link>
            </div>
            {verifiedNews.length ? verifiedNews.slice(0,4).map(news => (
              <article key={news.id} className={styles.motionRow}>
                <p className={styles.kicker}>VERIFIED NEWS</p>
                <h3>{news.headline}</h3>
                <p>{ellipsis(news.summary)}</p>
                <div className={styles.motionMeta}>
                  <DualTimestamp value={news.occurredAt} className={styles.cardTime} />
                  <a href={news.sourceUrl} rel="noreferrer" target="_blank">{news.sourceName} ↗</a>
                </div>
              </article>
            )) : observations.length ? <>
              <p className={styles.coverage}>No current verified headline. The following are original-source market observations
                from the last 48 hours; they are not fresh event headlines or proof of causality.</p>
              {observations.slice(0,6).map(item=><article key={item.id} className={styles.motionRow}>
                <p className={styles.kicker}>{item.kind==="MARKET_OBSERVATION"?"SOURCE-DOCUMENTED MARKET DATA":"ORIGINAL RELEASE"}</p>
                <h3>{ellipsis(item.description,160)}</h3>
                <div className={styles.motionMeta}>
                  <DualTimestamp value={item.eventAt} className={styles.cardTime}/>
                  <a href={item.sourceUrl} rel="noopener noreferrer" target="_blank">{item.sourceName} ↗</a>
                </div>
              </article>)}
            </> : <p className={styles.empty}>No current verified news or qualifying recent original-source observations. Older claims are not relabelled as fresh.</p>}
          </section>

          <section className={styles.secondaryPanel} aria-labelledby="calendar-title">
            <div className={styles.sectionHead}>
              <div>
                <h2 id="calendar-title"><MarketIcon name="calendar" size={24} /> Coming up</h2>
              </div>
              <Link className={styles.textLink} href={blueDeskPublicHref("/blue-desk/calendar", host)}>Full calendar →</Link>
            </div>
            {upcomingFallback.length ? (
              <p className={styles.coverage}>
                No scheduled events in the seven-day ET calendar window. Showing
                the next source-listed events from the 30-day calendar, not
                confirmed publication times.
              </p>
            ) : null}
            {upcoming.length ? upcoming.map(event => (
              <article key={event.id} className={styles.eventRow}>
                <div className={styles.eventHeading}>
                  <span className={styles.kicker}>{event.kind.toUpperCase()} · {event.status}</span>
                  <h3>{event.title}</h3>
                  <ScopeStrip assets={event.affectedAssets} max={3}/>
                </div>
                <DualTimestamp value={event.scheduledAt} sourceDate={event.localDate} className={styles.eventTime} />
                <p>{event.decidingQuestion}</p>
                <p className={styles.eventFacts}>
                  Actual {event.actual || "pending"} · Consensus {event.consensus || "unavailable"}
                  · Previous {event.revisedPrevious || event.previous || "unavailable"}
                </p>
                <a className={styles.textLink} href={event.sourceUrl} target="_blank" rel="noreferrer">{event.sourceName} ↗</a>
              </article>
            )) : <p className={styles.empty}>No scheduled events in the next 30 days of the current source coverage.</p>}
            {calendar.sourceHealth.warnings.length ? (
              <p className={styles.coverage}>Source coverage: {calendar.sourceHealth.warnings.join(" ")}</p>
            ) : null}
          </section>
        </div>

        <section className={styles.lastLinks} aria-label="Desk research and saved editions">
          <div>
            <h2>{publicHost ? "Explore public research" : "Dossier, research and saved editions"}</h2>
          </div>
          <div className={styles.quickLinks}>
            {publicHost ? (
              <>
                <Link href="/key-stories">Key market stories and research watch →</Link>
                <Link href="/markets?group=rates">Observed Treasury yields and history →</Link>
                <Link href="/markets">Public markets →</Link>
                <Link href="/calendar">Public calendar →</Link>
                <Link href="/calendar#earnings-hub">Company earnings this week →</Link>
                <Link href="/newsroom">Market Newsroom →</Link>
              </>
            ) : (
              <>
                <Link href="/dossier">Current Dossier →</Link>
                <Link href="/regimes">Market Regimes →</Link>
                <Link href="/my-reports">My Desk →</Link>
                <Link href="/presenter/technical-checks">Technical Checks →</Link>
              </>
            )}
          </div>
        </section>

        <footer className={styles.footer}><span>Blue Desk</span></footer>
        </details>
        </> : null}
      </div>
    </main>
  );
}
