import Link from "next/link";
import { headers } from "next/headers";

import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import { blueDeskPublicHref, isBlueDeskPublicReaderHost } from "@/lib/blue-desk-host";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import { MarketIcon } from "@/components/blue-desk/MarketIcon";
import StoryIdentityBalls from "@/components/blue-desk/StoryIdentityBalls";
import { getRecentPublishedStoryReadings } from "@/lib/blue-desk/story-archive-server";
import { newestStoryReadings, paginateStoryReadings, exactPublishedStoryId, type PublishedStoryReading } from "@/lib/blue-desk/story-archive";
import { storyMatchesSubject } from "@/lib/blue-desk/story-identity";
import { buildPresenterCalendar } from "@/lib/presenter-calendar";
import { selectBlueDeskUpcoming } from "@/lib/blue-desk-calendar";
import { getEconomicCalendar } from "@/lib/calendar";
import { getForwardEarningsEvents } from "@/lib/forward-earnings-sources";
import { getLiveDeskHomepageDailyBrief } from "@/lib/hybrid-publication";
import { getMarketMonitor } from "@/lib/market-monitor-public";
import { getCurrentMarketMotion, getCurrentVerifiedMarketMotion } from "@/lib/market-motion";
import { projectMarketBriefArticles } from "@/lib/market-brief-articles";
import { loadEditorialMarketBrief } from "@/lib/market-brief-editorial-data";
import { selectVerifiedNewsBriefs } from "@/lib/market-brief-news";
import { rankBlueDeskImpactFeed } from "@/lib/blue-desk-impact-feed";
import { selectFrozenSourceFact } from "@/lib/blue-desk-factual-feature";
import { publicMarketObservations, PUBLIC_MARKET_GROUPS } from "@/lib/blue-desk-public-markets";
import { buildBlueDeskDailyMarketMap } from "@/lib/blue-desk-daily-market-map";
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

export default async function BlueDeskPage({searchParams}:{searchParams:Promise<{page?:string|string[];subject?:string|string[]}>}) {
  const query=await searchParams;
  const page=typeof query.page==="string" && /^\d{1,3}$/.test(query.page)?Number(query.page):1;
  const subject=typeof query.subject==="string" && /^[A-Z0-9]{2,12}$/.test(query.subject)?query.subject:"";
  const now = new Date();
  const host = (await headers()).get("host");
  const publicHost = isBlueDeskPublicReaderHost(host);
  const [latest, macro, earnings, monitor, motions, verifiedMotions, storyArchive] = await Promise.all([
    getLiveDeskHomepageDailyBrief({ fresh: true }).catch(() => null),
    getEconomicCalendar().catch(() => []),
    getForwardEarningsEvents({ now }).catch(() => ({
      events: [], coverage: "unavailable" as const, warning: "Earnings source unavailable",
    })),
    getMarketMonitor().catch(() => null),
    publicHost ? Promise.resolve([]) : getCurrentMarketMotion({ limit: 24 }).catch(() => []),
    getCurrentVerifiedMarketMotion({ limit: 24 }).catch(() => []),
    getRecentPublishedStoryReadings().catch(() => []),
  ]);

  // Existing publication snapshots remain the only article authority.
  const brief = await loadEditorialMarketBrief(projectMarketBriefArticles(latest));
  // A historical Dossier feature is still readable below, but it cannot
  // monopolise a fresh day's lead. Admission is based on the immutable
  // article date and observed event time, never on the page refresh clock.
  const featureCandidate = brief.articles.find(article => article.editorial.storyEligible) || null;
  const featureTime = featureCandidate ? Date.parse(featureCandidate.generatedAt) : NaN;
  const freshFeature = featureCandidate && Number.isFinite(featureTime)
    && featureTime <= now.getTime()
    && now.getTime() - featureTime <= 48 * 60 * 60 * 1000
    ? featureCandidate : null;
  // Source-verified factual reports do NOT change canonical Story/Regime state.
  const verifiedNews = selectVerifiedNewsBriefs(verifiedMotions, now, 12);
  const impactFeed = rankBlueDeskImpactFeed(verifiedMotions, now, 8);
  const priorityMovers = impactFeed.filter(item => item.attention !== "ROUTINE").slice(0, 4);
  const newsFeature = (impactFeed.find(item => item.attention === "MAJOR"
    && (!freshFeature || Date.parse(item.fact.occurredAt) > featureTime))?.fact
    || verifiedNews.find(news => !freshFeature || Date.parse(news.occurredAt) > featureTime)) || null;
  const feature = newsFeature ? null : freshFeature;
  // An owner-only list of unfinished leads is not public verified news,
  // canonical evidence or authority for a Story mutation.
  const ownerResearchMotions = publicHost ? [] : motions
    .filter(item => item.verification_state !== "VERIFIED"
      && item.lifecycle_state !== "EXPIRED" && item.effective_state !== "EXPIRED"
      && Date.parse(item.occurred_at) <= now.getTime()
      && Date.parse(item.expires_at) > now.getTime())
    .slice(0, 6);
  // Primary-source facts are a separate fallback, NEVER a promoted Story.
  const sourceFact = feature || newsFeature ? null : selectFrozenSourceFact(brief, now);
  const storyHref = (article: (typeof brief.articles)[number]) => blueDeskPublicHref(
    "/blue-desk/stories/" + encodeURIComponent(article.articleId) + "?edition=" + encodeURIComponent(article.editionId), host,
  );
  const fallback:PublishedStoryReading[]=brief.articles.flatMap(article=>{
    const storyId=exactPublishedStoryId(article);
    return storyId && article.editorial.readiness!=="RESEARCH_ONLY" && latest
      ?[{article,storyId,editionId:article.editionId,publishedAt:latest.published_at}]:[];
  });
  const historicalReadings=storyArchive.length?storyArchive:fallback;
  const latestByStory=newestStoryReadings(historicalReadings);
  const filtered=subject?latestByStory.filter(item=>
    storyMatchesSubject(item.article.title,item.article.deck,item.article.subjectAssets||[],subject)):latestByStory;
  const pagination=paginateStoryReadings(filtered,page);
  const articles=pagination.items;
  const storyGridHref=(nextPage:number,filter=subject)=>
    blueDeskPublicHref("/blue-desk",host)
      +"?page="+nextPage+(filter?"&subject="+encodeURIComponent(filter):"")+"#stories-title";
  const previousByStory=new Map(latestByStory.map(item=>[
    item.storyId,historicalReadings.filter(history=>history.storyId===item.storyId).length-1,
  ]));
  // Every desk angle is sourced directly from the already-reviewed public market
  // observation projection. A Dossier does not determine visibility here.
  const publicObservations = PUBLIC_MARKET_GROUPS.filter(group => group.id !== "all")
    .flatMap(group => publicMarketObservations(monitor?.rows || [], group.id))
    .filter((row, index, all) => all.findIndex(item => item.id === row.id) === index);
  const dailyMap = buildBlueDeskDailyMarketMap(publicObservations, now);
  const marketNumber = (value: number, isRate: boolean) =>
    new Intl.NumberFormat("en-GB", { maximumFractionDigits: isRate ? 3 : 2, minimumFractionDigits: isRate ? 2 : 0 }).format(value);
  const yields = YIELD_IDS.map(id => monitor?.rows.find(row => row.id === id)).filter(
    (row): row is NonNullable<typeof row> => Boolean(row),
  );

  // The established presenter-calendar/1 adapter owns time admission and coverage.
  const calendar = buildPresenterCalendar(macro, earnings, now);
  const upcoming7d = selectBlueDeskUpcoming(calendar, now).slice(0, 6);
  const upcomingFallback = upcoming7d.length ? [] : selectBlueDeskUpcoming(calendar, now, 30).slice(0, 3);
  const upcoming = upcoming7d.length ? upcoming7d : upcomingFallback;

  return (
    <main className={styles.page} data-blue-desk-convergence="phase-1" data-bluebelly-home="editorial">
      <BlueDeskHeader activePath="/blue-desk" />
      <div className={styles.content}>
        <div className={styles.homeContextBar} aria-label="Bluebelly homepage sections">
          <div><span className={styles.kicker}>BLUEBELLY / MARKET INTELLIGENCE</span><p>The essential story first. Explore the evidence whenever you need it.</p></div>
          <nav aria-label="Jump to homepage sections"><a href="#impact-title">Market moves</a><a href="#stories-title">Market Stories</a><a href="#calendar-title">Coming up</a></nav>
        </div>

        <section className={styles.hero} aria-label="Latest canonical Market Brief">
          <div className={styles.heroStory}>
            <p className={styles.kicker}><MarketIcon name="market" size={16} /> {feature ? "TOP STORY" : newsFeature ? "VERIFIED NEWS BRIEF" : sourceFact ? "PRIMARY-SOURCE OBSERVATION" : "MARKET BRIEF"}</p>
            <h1>{feature?.title || newsFeature?.headline || sourceFact?.claimText || "Market Brief in review"}</h1>
            <p className={styles.heroDeck}>
              {feature?.deck || newsFeature?.summary || (sourceFact ? "Source-reported observation; interpretation pending." : "No verified market brief available.")}
            </p>
            <div className={styles.tags}>
              <span className={styles.tag}>{feature ? feature.interpretationStatus : newsFeature ? "SOURCE-VERIFIED REPORT" : sourceFact ? "SOURCE FACT · NO INTERPRETATION" : "REVIEW"}</span>
              {(feature || sourceFact) && latest ? <span className={styles.tag}>Edition {latest.id}</span> : null}
            </div>
            <div className={styles.heroFooter}>
              {feature ? (
                <Link className={styles.primaryAction} href={storyHref(feature)}>Read story →</Link>
              ) : newsFeature ? (
                <a className={styles.primaryAction} href={newsFeature.sourceUrl} target="_blank" rel="noreferrer">Read original report ↗</a>
              ) : sourceFact ? (
                <a className={styles.primaryAction} href={sourceFact.sourceUrl} target="_blank" rel="noreferrer">Read {sourceFact.sourceName} report ↗</a>
              ) : (
                publicHost ? <span className={styles.empty}>Awaiting a source-supported publication.</span> : <Link className={styles.primaryAction} href="/articles">All articles →</Link>
              )}
              {feature && exactPublishedStoryId(feature)?<Link className={styles.textLink}
                href={blueDeskPublicHref("/blue-desk/presenter?edition="+encodeURIComponent(feature.editionId)
                  +"&story="+encodeURIComponent(exactPublishedStoryId(feature)!),host)}>
                Prepare this Story · owner →</Link>:null}
              {newsFeature?<Link className={styles.textLink} href={blueDeskPublicHref(
                "/blue-desk/presenter?motion="+encodeURIComponent(newsFeature.id),host)}>
                Prepare verified catalyst · owner →</Link>:null}
              {feature && latest ? <DualTimestamp value={latest.published_at} className={styles.heroTime} /> :
                newsFeature ? <DualTimestamp value={newsFeature.occurredAt} className={styles.heroTime} /> :
                sourceFact ? <DualTimestamp value={sourceFact.publishedAt} className={styles.heroTime} /> : null}
            </div>
          </div>
          <aside className={styles.rates} aria-label="Observed US Treasury yield context">
            <h2 id="rates-title"><MarketIcon name="rates" size={25} /> Rates &amp; yields</h2>
            {yields.length ? yields.map(row => (
              <div className={styles.rateRow} key={row.id}>
                <div>
                  <span>{row.label}</span>
                  <small>{row.sourceName} · {row.frequency} series</small>
                  <DualTimestamp value={row.asOf} sourceDate={row.asOf} className={styles.rateTime} />
                </div>
                <strong>{row.last === null ? "—" : row.last.toFixed(2) + "%"}</strong>
              </div>
            )) : <p className={styles.empty}>Yield data unavailable.</p>}
            <Link href={publicHost ? blueDeskPublicHref("/blue-desk/markets", host) : "/markets"} className={styles.textLink}>Cross-asset monitor →</Link>
          </aside>
        </section>

        <section className={styles.impactSection} aria-labelledby="impact-title" data-bluebelly-impact="consequence-ranked">
          <div className={styles.impactHeading}>
            <div>
              <span className={styles.kicker}>WHAT IS CHANGING THE MARKET?</span>
              <h2 id="impact-title">The developments that matter.</h2>
              <p>Consequence before chronology. Original reporting is separated from the market questions it raises.</p>
            </div>
            <Link className={styles.textLink} href={blueDeskPublicHref("/blue-desk/what-changed",host)}>All verified developments →</Link>
          </div>
          {priorityMovers.length ? <div className={styles.impactGrid}>
            {priorityMovers.map((item,index) => <article className={styles.impactCard} key={item.fact.id}
              data-priority={item.attention} data-rank={index+1}>
              <div className={styles.impactTop}>
                <span>{item.attention==="MAJOR"?"MARKET-WIDE FOCUS":"SIGNIFICANT DEVELOPMENT"} · {item.category.replaceAll("_"," ")}</span>
                <DualTimestamp value={item.fact.occurredAt} sourceDate={item.fact.occurredAt}/>
              </div>
              <h3>{item.fact.headline}</h3>
              <p className={styles.impactFact}>{ellipsis(item.fact.summary,210)}</p>
              {item.researchAngle ? <div className={styles.impactLens}><strong>Why it could matter</strong>
                <p>{item.researchAngle}</p><small>Research interpretation · market impact not independently established</small>
              </div>:null}
              <div className={styles.impactNext}><strong>Watch next</strong><p>{item.nextCheck}</p></div>
              <div className={styles.impactBottom}>
                {item.assets.length ? <div className={styles.impactAssets} aria-label="Referenced assets">
                  {item.assets.map(t=><span key={t}>{t}</span>)}
                </div> : <span className={styles.impactSourceType}>{item.fact.sourceKind.replaceAll("_"," ")} report</span>}
                <a href={item.fact.sourceUrl} target="_blank" rel="noopener noreferrer">{item.fact.sourceName} ↗</a>
              </div>
            </article>)}
          </div> : <div className={styles.impactQuiet}>
            <strong>No current development cleared the higher-impact threshold.</strong>
            <p>That reflects available, dated, source-qualified reports—not evidence that the market is quiet. Check the full source tape and next calendar releases.</p>
            <Link href={blueDeskPublicHref("/blue-desk/what-changed",host)}>Review verified reports →</Link>
          </div>}
        </section>

        <section className={styles.section} aria-labelledby="stories-title">
          <div className={styles.sectionHead}>
            <div>
              <h2 id="stories-title"><MarketIcon name="layers" size={24} /> Key market stories</h2>
              <p className={styles.muted}>Newest source-admitted catalyst for each ongoing Story. Select a ball to filter; earlier reports stay attached to the Story.</p>
            </div>
            {!publicHost ? <Link href="/articles" className={styles.textLink}>All articles →</Link> : null}
            {subject?<Link className={styles.textLink} href={storyGridHref(1,"")}>Clear {subject} filter ×</Link>:<span className={styles.storyPageMeta}>{pagination.total} Story threads · newest first</span>}
          </div>
          <div className={styles.storyGrid}>
            {articles.length ? articles.map(({article,storyId}) => (
              <article key={article.articleId} className={styles.storyCard}>
                <span className={styles.kicker}>{article.category} · {article.editorial.storyEligible ? article.interpretationStatus : article.editorial.readiness === "READY" ? "SOURCED ANALYSIS" : "DEVELOPING"}</span>
                <StoryIdentityBalls title={article.title} deck={article.deck} assets={article.subjectAssets}
                  hrefBase={blueDeskPublicHref("/blue-desk",host)}/>
                <span className={styles.storyCatalystLabel}>Latest source-admitted update · Ongoing Story</span>
                <h3>{article.title}</h3>
                <p>{ellipsis(article.deck || article.paragraphs[0]?.text || "")}</p>
                <div className={styles.storyBottom}>
                  <div className={styles.storyCardDates}>
                    <DualTimestamp value={article.generatedAt} className={styles.cardTime} />
                    {(previousByStory.get(storyId)||0)>0?<small>{previousByStory.get(storyId)} earlier reports</small>:null}
                  </div>
                  <Link href={storyHref(article)}>Read analysis →</Link>
                </div>
              </article>
            )) : (
              <article className={styles.emptyCard}>
                <h3>No published stories</h3>
                <p>{brief.blockedReason || "No published analyses in this edition."}</p>
              </article>
            )}
          </div>
          <nav className={styles.storyPager} aria-label="Key market stories pages">
            {pagination.page>1?<Link href={storyGridHref(pagination.page-1)}>← Newer stories</Link>:<span>Newest stories</span>}
            <span>Page {pagination.page} of {pagination.pages} · {pagination.total} Story threads</span>
            {pagination.page<pagination.pages?<Link href={storyGridHref(pagination.page+1)}>Older stories →</Link>:<span>End of available archive</span>}
          </nav>
          <p className={styles.coverage}>Recent 24 source-published editions are indexed; older exact permalinks remain accessible.</p>
        </section>

        <div className={styles.calendarOnlyGrid}>
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
                  <StoryIdentityBalls title={event.title} deck={event.decidingQuestion} assets={event.affectedAssets}
                    hrefBase={blueDeskPublicHref("/blue-desk",host)} limit={3}/>
                </div>
                <DualTimestamp value={event.scheduledAt} sourceDate={event.localDate} className={styles.eventTime} />
                <p>{event.decidingQuestion}</p>
                <Link className={styles.textLink} href={blueDeskPublicHref(
                  "/blue-desk/presenter?event="+encodeURIComponent(event.id),host)}>Research this calendar event · owner →</Link>
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

        <details className={styles.homeDisclosure} data-home-panel="news">
          <summary className={styles.homeDisclosureSummary}><span><strong>Verified developments</strong><small>{verifiedNews.length} source-qualified reports · original timestamps and links</small></span><span aria-hidden="true">Expand ↓</span></summary>
        <section className={styles.newsFirst} aria-labelledby="blue-desk-news-title">
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.kicker}>LATEST MOTIONS &amp; NEWS · VERIFIED SOURCES</p>
              <h2 id="blue-desk-news-title"><MarketIcon name="divergence" size={31} /> What happened in markets?</h2>
              <p>Events first, market observations next, interpretation afterwards. Each verified headline has an original report and event time.</p>
            </div>
            {!publicHost ? <Link className={styles.textLink} href="/whats-new">Investigate all Motions →</Link> : null}
          </div>
          <div className={styles.newsFirstGrid}>
            {verifiedNews.length ? verifiedNews.slice(0, 4).map((news, index) => (
              <article className={styles.newsFirstCard} key={news.id}>
                <span className={styles.kicker}>{index === 0 ? "LEAD VERIFIED REPORT" : "SOURCE-VERIFIED"} · {news.sourceKind}</span>
                <h2>{news.headline}</h2>
                <p>{ellipsis(news.summary, index < 3 ? 230 : 150)}</p>
                <div className={styles.newsFirstMeta}>
                  <DualTimestamp value={news.occurredAt} sourceDate={news.occurredAt} />
                  <a href={news.sourceUrl} target="_blank" rel="noreferrer">{news.sourceName} ↗</a>
                </div>
              </article>
            )) : <article className={styles.newsFirstCard}>
              <h2>No fresh source-verified news in the feed.</h2>
              <p>That does not establish a quiet market. Source-dated market observations remain available below.</p>
            </article>}
          </div>
          {ownerResearchMotions.length ? (
            <details className={styles.ownerMotions}>
              <summary>{ownerResearchMotions.length} extra research Motions · not verified</summary>
              <div className={styles.ownerMotionGrid}>
                {ownerResearchMotions.map(item => (
                  <article key={item.id}>
                    <span className={styles.kicker}>{item.verification_state} · {item.category}</span>
                    <h3>{item.headline}</h3>
                    <p>{ellipsis(item.what_happened, 175)}</p>
                    <DualTimestamp value={item.occurred_at} sourceDate={item.occurred_at} />
                    <small>Owner context only. This is not evidence or a published market conclusion.</small>
                  </article>
                ))}
              </div>
            </details>
          ) : null}
        </section>

        </details>

        <details className={styles.homeDisclosure} data-home-panel="market-map">
          <summary className={styles.homeDisclosureSummary}><span><strong>Cross-asset market map</strong><small>{dailyMap.observedCount} of {dailyMap.lenses.length} source-dated lenses · full measurement provenance</small></span><span aria-hidden="true">Expand ↓</span></summary>
        <section className={styles.dailyMap} aria-labelledby="daily-map-title" data-market-map-contract={dailyMap.contractVersion}>
          <div className={styles.dailyMapHeading}>
            <div>
              <p className={styles.kicker}>SOURCE-DATED MARKET SUMMARY</p>
              <h2 id="daily-map-title">The market, from eight angles</h2>
              <p>Rates, stocks, breadth, energy, currencies, credit, metals and AI.
                Each reading retains its original observation date. No single Dossier verdict decides this coverage.</p>
            </div>
            <div className={styles.dailyMapStatus} role="status">
              <strong>{dailyMap.observedCount} / {dailyMap.lenses.length} lenses observed</strong>
              <span>{dailyMap.olderCount ? dailyMap.olderCount + " with older-only observations" : "Source dates shown below"}</span>
            </div>
          </div>
          <div className={styles.dailyMapGrid}>
            {dailyMap.lenses.map(lens => (
              <article className={styles.dailyMapCard} key={lens.key} data-lens={lens.key} data-source-state={lens.state}>
                <div className={styles.dailyMapCardHeader}>
                  <h2>{lens.heading}</h2>
                  <span className={styles.lensState}>
                    {lens.state === "UNAVAILABLE" ? "NO VERIFIED LEVEL"
                      : lens.state === "OLDER_SOURCE" ? "OLDER SOURCE" : "SOURCE-DATED"}
                  </span>
                </div>
                {lens.observations.length ? lens.observations.map(row => (
                  <div className={styles.lensMetric} key={row.id}>
                    <div className={styles.lensMetricHead}>
                      <strong>{row.label}</strong>
                      <span>{row.last === null ? "—" : marketNumber(row.last, row.type === "Rates") + (row.type === "Rates" ? "%" : "")}</span>
                    </div>
                    <p className={styles.lensChange}>
                      {row.change !== null && row.frequency === "daily"
                        ? "Previous session: " + (row.change > 0 ? "+" : "") + row.change.toFixed(2) + " " + row.changeUnit
                        : "Previous-session change unavailable"}
                      {row.freshness === "OLDER_OBSERVATION" ? " · older observation" : ""}
                    </p>
                    <div className={styles.lensProvenance}>
                      <DualTimestamp value={row.asOf} sourceDate={row.asOf} className={styles.lensTime} />
                      {row.sourceUrl ? <a href={row.sourceUrl} target="_blank" rel="noreferrer">{row.sourceName} ↗</a> : null}
                    </div>
                  </div>
                )) : <p className={styles.lensEmpty}>No verified observation for this lens. Not a neutral market signal.</p>}
                <p className={styles.lensQuestion}>{lens.question}</p>
                <Link className={styles.dailyMapLink} href={blueDeskPublicHref("/blue-desk/markets?group=" + lens.group, host)}>
                  Explore {lens.heading.toLowerCase()} →
                </Link>
              </article>
            ))}
          </div>
          <p className={styles.dailyMapFootnote}>
            Source times are not page refresh times. A previous-session move does not establish an intraday reaction,
            cause or trade recommendation. Unverified providers are not filled with estimates.
          </p>
        </section>

        </details>

        <section className={styles.lastLinks} aria-label="Desk research and presenter">
          <div>
            <h2>{publicHost ? "Explore public research" : "Dossier, Journey and presenter preparation"}</h2>
          </div>
          <div className={styles.quickLinks}>
            {publicHost ? (
              <>
                <Link href="/key-stories">Key market stories →</Link>
                <Link href="/rates">Observed Treasury yields →</Link>
                <Link href="/what-changed">Verified developments →</Link>
                <Link href="/markets">Public markets →</Link>
                <Link href="/presenter">Presenter Prep (owner sign-in) →</Link>
                <Link href="/learn">Learn the markets →</Link>
                <Link href="/calendar">Public calendar →</Link>
              </>
            ) : (
              <>
                <Link href="/blue-desk/changes">What changed in our view →</Link>
                <Link href="/blue-desk/dossier">Dossier archive →</Link>
                <Link href="/regimes">Market Regimes →</Link>
                <Link href="/blue-desk/presenter">Presenter Prep →</Link>
                <Link href="/presenter/technical-checks">Technical Checks →</Link>
              </>
            )}
          </div>
        </section>

        <footer className={styles.footer}><span>Blue Desk</span></footer>
      </div>
    </main>
  );
}
