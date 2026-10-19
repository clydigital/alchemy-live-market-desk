import Link from "next/link";
import { headers } from "next/headers";

import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import { blueDeskPublicHref } from "@/lib/blue-desk-host";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import { buildPresenterCalendar } from "@/lib/presenter-calendar";
import { selectBlueDeskUpcoming } from "@/lib/blue-desk-calendar";
import { getEconomicCalendar } from "@/lib/calendar";
import { getForwardEarningsEvents } from "@/lib/forward-earnings-sources";
import { getHybridPresenterEditionCandidates } from "@/lib/hybrid-publication";
import { getMarketMonitor } from "@/lib/market-monitor-public";
import { getCurrentMarketMotion } from "@/lib/market-motion";
import { projectMarketBriefArticles } from "@/lib/market-brief-articles";
import { loadEditorialMarketBrief } from "@/lib/market-brief-editorial-data";
import styles from "./blue-desk.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Blue Desk | Alchemy Market Intelligence",
  description: "Market stories, rates and upcoming events.",
};



const YIELD_IDS = ["us2y", "us5y-fred", "us10y-fred", "us20y-fred", "us30y-fred"];

function safeSource(url: string) {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && !parsed.username && !parsed.password;
  } catch {
    return false;
  }
}

function ellipsis(value: string, max = 175) {
  if (value.length <= max) return value;
  return value.slice(0, max).replace(/\s+\S*$/, "") + "…";
}

export default async function BlueDeskPage() {
  const now = new Date();
  const host = (await headers()).get("host");
  const [editions, macro, earnings, monitor, motions] = await Promise.all([
    getHybridPresenterEditionCandidates().catch(() => []),
    getEconomicCalendar().catch(() => []),
    getForwardEarningsEvents({ now }).catch(() => ({
      events: [], coverage: "unavailable" as const, warning: "Earnings source unavailable",
    })),
    getMarketMonitor().catch(() => null),
    getCurrentMarketMotion({ limit: 24 }).catch(() => []),
  ]);

  // Existing publication snapshots remain the only article authority.
  const latest = editions[0] || null;
  const brief = await loadEditorialMarketBrief(projectMarketBriefArticles(latest));
  const feature = brief.articles.find(article => article.editorial.readiness === "READY") || null;
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

  // Verified Motion is context, not a System 2 Regime decision.
  const verified = motions.filter(motion =>
    motion.verification_state === "VERIFIED" && safeSource(motion.source_url)
  ).slice(0, 6);

  return (
    <main className={styles.page} data-blue-desk-convergence="phase-1">
      <BlueDeskHeader activePath="/blue-desk" />
      <div className={styles.content}>

        <section className={styles.hero} aria-label="Latest canonical Market Brief">
          <div className={styles.heroStory}>
            <p className={styles.kicker}>TOP STORY</p>
            <h1>{feature ? feature.title : "Market Brief in review"}</h1>
            <p className={styles.heroDeck}>
              {feature
                ? feature.deck
                : "No Story has cleared source and explanation checks."}
            </p>
            <div className={styles.tags}>
              <span className={styles.tag}>{feature?.interpretationStatus || "REVIEW"}</span>
              {latest ? <span className={styles.tag}>Edition {latest.id}</span> : null}
            </div>
            <div className={styles.heroFooter}>
              <Link className={styles.primaryAction} href={feature ? storyHref(feature) : "/articles"}>Read story →</Link>
              {latest ? <DualTimestamp value={latest.published_at} className={styles.heroTime} /> : null}
            </div>
          </div>
          <aside className={styles.rates} aria-label="Observed US Treasury yield context">
            <h2>Rates &amp; yields</h2>
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
            <Link href="/markets" className={styles.textLink}>Cross-asset monitor →</Link>
          </aside>
        </section>

        <section className={styles.section} aria-labelledby="stories-title">
          <div className={styles.sectionHead}>
            <div>
              <h2 id="stories-title">Key market stories</h2>
            </div>
            <Link href="/articles" className={styles.textLink}>All articles →</Link>
          </div>
          <div className={styles.storyGrid}>
            {articles.length ? articles.map(article => (
              <article key={article.articleId} className={styles.storyCard}>
                <span className={styles.kicker}>{article.category} · {article.editorial.readiness === "READY" ? article.interpretationStatus : "DEVELOPING"}</span>
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
              <Link className={styles.textLink} href="/whats-new">Investigate →</Link>
            </div>
            {verified.length ? verified.map(motion => (
              <article key={motion.id} className={styles.motionRow}>
                <p className={styles.kicker}>{motion.category} · VERIFIED SOURCE</p>
                <h3>{motion.headline}</h3>
                <p>{ellipsis(motion.what_happened)}</p>
                <div className={styles.motionMeta}>
                  <DualTimestamp value={motion.occurred_at} className={styles.cardTime} />
                  <a href={motion.source_url} rel="noreferrer" target="_blank">{motion.source_name} ↗</a>
                </div>
              </article>
            )) : <p className={styles.empty}>No source-verified Motion items are available. A quiet feed is not a Regime conclusion.</p>}
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
            <h2>Dossier, Journey and presenter preparation</h2>
          </div>
          <div className={styles.quickLinks}>
            <Link href="/dossier">Current Dossier →</Link>
            <Link href="/regimes">Market Regimes →</Link>
            <Link href="/hybrid-output/prepare">Presenter Studio →</Link>
            <Link href="/presenter/technical-checks">Technical Checks →</Link>
          </div>
        </section>

        <footer className={styles.footer}><span>Blue Desk</span></footer>
      </div>
    </main>
  );
}
