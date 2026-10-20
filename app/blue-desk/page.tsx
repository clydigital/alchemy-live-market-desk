import Link from "next/link";
import { headers } from "next/headers";

import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import { BLUEBELLY_PRESENTATION_HOST, blueDeskPublicHref } from "@/lib/blue-desk-host";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
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
import styles from "./blue-desk.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Blue Desk | Alchemy Market Intelligence",
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
  const publicHost = (host || "").trim().toLowerCase().replace(/:443$/, "") === BLUEBELLY_PRESENTATION_HOST;
  const [latest, macro, earnings, monitor, motions, verifiedMotions] = await Promise.all([
    getLiveDeskHomepageDailyBrief({ fresh: true }).catch(() => null),
    getEconomicCalendar().catch(() => []),
    getForwardEarningsEvents({ now }).catch(() => ({
      events: [], coverage: "unavailable" as const, warning: "Earnings source unavailable",
    })),
    getMarketMonitor().catch(() => null),
    getCurrentMarketMotion({ limit: 24 }).catch(() => []),
    getCurrentVerifiedMarketMotion({ limit: 12 }).catch(() => []),
  ]);

  // Existing publication snapshots remain the only article authority.
  const brief = await loadEditorialMarketBrief(projectMarketBriefArticles(latest));
  const feature = brief.articles.find(article => article.editorial.storyEligible) || null;
  // A source-verified factual report is independently eligible to be read:
  // it is NOT a new canonical Story or Regime interpretation.
  const verifiedNews = selectVerifiedNewsBriefs(verifiedMotions, now, 6);
  const newsFeature = feature ? null : (verifiedNews[0] || null);
  // Primary-source facts are a separate fallback, NEVER a promoted Story.
  const sourceFact = feature || newsFeature ? null : selectFrozenSourceFact(brief, now);
  const storyHref = (article: (typeof brief.articles)[number]) => blueDeskPublicHref(
    "/blue-desk/stories/" + encodeURIComponent(article.articleId) + "?edition=" + encodeURIComponent(article.editionId), host,
  );
  const articles = brief.articles.filter(article => article.editorial.readiness !== "RESEARCH_ONLY").slice(0, 6);
  const yields = YIELD_IDS.map(id => monitor?.rows.find(row => row.id === id)).filter(
    (row): row is NonNullable<typeof row> => Boolean(row),
  );

  // The established presenter-calendar/1 adapter owns time admission and coverage.
  const calendar = buildPresenterCalendar(macro, earnings, now);
  const upcoming = selectBlueDeskUpcoming(calendar, now).slice(0, 6);

  return (
    <main className={styles.page} data-blue-desk-convergence="phase-1">
      <BlueDeskHeader activePath="/blue-desk" />
      <div className={styles.content}>

        <section className={styles.hero} aria-label="Latest canonical Market Brief">
          <div className={styles.heroStory}>
            <p className={styles.kicker}>{feature ? "TOP STORY" : newsFeature ? "VERIFIED NEWS BRIEF" : sourceFact ? "PRIMARY-SOURCE OBSERVATION" : "MARKET BRIEF"}</p>
            <h1>{feature?.title || newsFeature?.headline || sourceFact?.claimText || "Market Brief in review"}</h1>
            <p className={styles.heroDeck}>
              {feature?.deck || newsFeature?.summary || (sourceFact ? "A reported measurement from the frozen publication. Its wider market implications remain unresolved." : "No source-supported public market report is available.")}
            </p>
            <div className={styles.tags}>
              <span className={styles.tag}>{feature ? feature.interpretationStatus : newsFeature ? "SOURCE-VERIFIED REPORT" : sourceFact ? "FACT ONLY · NOT A STORY VERDICT" : "REVIEW"}</span>
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
            <h2 id="rates-title">Rates &amp; yields</h2>
            {yields.length ? yields.map(row => (
              <div className={styles.rateRow} key={row.id}>
                <div>
                  <span>{row.label}</span>
                  <small>{row.sourceName} · {row.frequency} series</small>
                  <DualTimestamp value={row.asOf} sourceDate={row.asOf} className={styles.rateTime} />
                </div>
                <strong>{row.last === null ? "—" : row.last.toFixed(2) + "%"}</strong>
              </div>
            )) : <p className={styles.empty}>Yield observations currently unavailable.</p>}
            {!publicHost ? <Link href="/markets" className={styles.textLink}>Cross-asset monitor →</Link> : null}
          </aside>
        </section>

        <section className={styles.section} aria-labelledby="stories-title">
          <div className={styles.sectionHead}>
            <div>
              <h2 id="stories-title">Key market stories</h2>
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
                <h3>Publication coverage is incomplete</h3>
                <p>{brief.blockedReason || "No source-grounded Market Brief articles are available in this edition."}</p>
              </article>
            )}
          </div>
        </section>

        <div className={styles.lowerGrid}>
          <section className={styles.secondaryPanel} aria-labelledby="motion-title">
            <div className={styles.sectionHead}>
              <div>
                <p className={styles.kicker}>MARKET MOTION</p>
                <h2 id="motion-title">What changed</h2>
              </div>
              {!publicHost ? <Link className={styles.textLink} href="/whats-new">Investigate →</Link> : null}
            </div>
            {verifiedNews.length ? verifiedNews.map(news => (
              <article key={news.id} className={styles.motionRow}>
                <p className={styles.kicker}>NEWS BRIEF · SOURCE VERIFIED · NO STORY ADJUDICATION</p>
                <h3>{news.headline}</h3>
                <p>{ellipsis(news.summary)}</p>
                <div className={styles.motionMeta}>
                  <DualTimestamp value={news.occurredAt} className={styles.cardTime} />
                  <a href={news.sourceUrl} rel="noreferrer" target="_blank">{news.sourceName} ↗</a>
                </div>
              </article>
            )) : <p className={styles.empty}>No source-verified factual News Briefs are available. A quiet feed is not a Regime conclusion.</p>}
          </section>

          <section className={styles.secondaryPanel} aria-labelledby="calendar-title">
            <div className={styles.sectionHead}>
              <div>
                <h2 id="calendar-title">Coming up</h2>
              </div>
              <Link className={styles.textLink} href={blueDeskPublicHref("/blue-desk/calendar", host)}>Full calendar →</Link>
            </div>
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
            )) : <p className={styles.empty}>No confirmed upcoming events in the seven-day feed. Check source coverage.</p>}
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
                <Link href="/#stories-title">Key market stories →</Link>
                <Link href="/#rates-title">Observed Treasury yields →</Link>
                <Link href="/calendar">Public calendar →</Link>
              </>
            ) : (
              <>
                <Link href="/dossier">Current Dossier →</Link>
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
