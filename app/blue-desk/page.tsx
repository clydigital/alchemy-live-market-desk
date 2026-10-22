import Link from "next/link";
import { headers } from "next/headers";

import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import { blueDeskPublicHref, isBlueDeskPublicReaderHost } from "@/lib/blue-desk-host";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import { MarketIcon } from "@/components/blue-desk/MarketIcon";
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

export default async function BlueDeskPage() {
  const now = new Date();
  const host = (await headers()).get("host");
  const publicHost = isBlueDeskPublicReaderHost(host);
  const [latest, macro, earnings, monitor, motions, verifiedMotions] = await Promise.all([
    getLiveDeskHomepageDailyBrief({ fresh: true }).catch(() => null),
    getEconomicCalendar().catch(() => []),
    getForwardEarningsEvents({ now }).catch(() => ({
      events: [], coverage: "unavailable" as const, warning: "Earnings source unavailable",
    })),
    getMarketMonitor().catch(() => null),
    getCurrentMarketMotion({ limit: 24 }).catch(() => []),
    getCurrentVerifiedMarketMotion({ limit: 24 }).catch(() => []),
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
  const newsFeature = verifiedNews.find(news =>
    !freshFeature || Date.parse(news.occurredAt) > featureTime
  ) || null;
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
  const articles = brief.articles.filter(article => article.editorial.readiness !== "RESEARCH_ONLY").slice(0, 6);
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
    <main className={styles.page} data-blue-desk-convergence="phase-1">
      <BlueDeskHeader activePath="/blue-desk" />
      <div className={styles.content}>
        <section className={styles.newsFirst} aria-labelledby="blue-desk-news-title">
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.kicker}>LATEST MOTIONS &amp; NEWS · VERIFIED SOURCES</p>
              <h1 id="blue-desk-news-title"><MarketIcon name="divergence" size={31} /> What happened in markets?</h1>
              <p>Events first, market observations next, interpretation afterwards. Each verified headline has an original report and event time.</p>
            </div>
            {!publicHost ? <Link className={styles.textLink} href="/whats-new">Investigate all Motions →</Link> : null}
          </div>
          <div className={styles.newsFirstGrid}>
            {verifiedNews.length ? verifiedNews.map((news, index) => (
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

        <section className={styles.dailyMap} aria-labelledby="daily-map-title" data-market-map-contract={dailyMap.contractVersion}>
          <div className={styles.dailyMapHeading}>
            <div>
              <p className={styles.kicker}>SOURCE-DATED MARKET SUMMARY</p>
              <h1 id="daily-map-title">The market, from eight angles</h1>
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

        <section className={styles.section} aria-labelledby="stories-title">
          <div className={styles.sectionHead}>
            <div>
              <h2 id="stories-title"><MarketIcon name="layers" size={24} /> Key market stories</h2>
            </div>
            {!publicHost ? <Link href="/articles" className={styles.textLink}>All articles →</Link> : null}
          </div>
          <div className={styles.storyGrid}>
            {articles.length ? articles.map(article => (
              <article key={article.articleId} className={styles.storyCard}>
                <span className={styles.kicker}>{article.category} · {article.editorial.storyEligible ? article.interpretationStatus : article.editorial.readiness === "READY" ? "SOURCED ANALYSIS" : "DEVELOPING"}</span>
                <h3>{article.title}</h3>
                <p>{ellipsis(article.deck || article.paragraphs[0]?.text || "")}</p>
                <div className={styles.storyBottom}>
                  <DualTimestamp value={article.generatedAt} className={styles.cardTime} />
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
                <Link href="/presenter">Presenter Deck (sign-in) →</Link>
                <Link href="/calendar">Public calendar →</Link>
              </>
            ) : (
              <>
                <Link href="/blue-desk/changes">What changed in our view →</Link>
                <Link href="/blue-desk/dossier">Dossier archive →</Link>
                <Link href="/regimes">Market Regimes →</Link>
                <Link href="/hybrid-output/prepare">Presenter Studio →</Link>
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
