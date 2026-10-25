import Link from "next/link";
import { headers } from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import { blueDeskPublicHref } from "@/lib/blue-desk-host";
import { formatDualDeskTime } from "@/lib/blue-desk-time";
import { getLiveDeskHomepageDailyBrief } from "@/lib/hybrid-publication";
import { projectMarketBriefArticles } from "@/lib/market-brief-articles";
import { loadEditorialMarketBrief } from "@/lib/market-brief-editorial-data";
import { getCurrentVerifiedMarketMotion } from "@/lib/market-motion";
import { selectVerifiedNewsBriefs } from "@/lib/market-brief-news";
import { projectFrozenTrackedStories } from "@/lib/blue-desk-tracked-stories";
import { getEconomicCalendar } from "@/lib/calendar";
import { getForwardEarningsEvents } from "@/lib/forward-earnings-sources";
import { buildPresenterCalendar } from "@/lib/presenter-calendar";
import { selectBlueDeskUpcoming } from "@/lib/blue-desk-calendar";
import { readableSourceArticleLead } from "@/lib/blue-desk-cashflow-reader-copy";
import styles from "./daily-report.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Daily Market Report | Bluebelly",
  description: "Source-dated market developments, competing explanations and upcoming deciding events.",
};

const trim = (s: string, limit = 330) => s.length > limit ? s.slice(0, limit).replace(/\s+\S*$/, "") + "…" : s;

export default async function DailyReportPage() {
  const now = new Date();
  const host = (await headers()).get("host");
  const [edition, verified, macro, earnings] = await Promise.all([
    getLiveDeskHomepageDailyBrief({ fresh: true }).catch(() => null),
    getCurrentVerifiedMarketMotion({ limit: 36 }).catch(() => []),
    getEconomicCalendar().catch(() => []),
    getForwardEarningsEvents({ now }).catch(() => ({
      events: [], coverage: "unavailable" as const, warning: "Earnings source unavailable",
    })),
  ]);
  const projected = await loadEditorialMarketBrief(projectMarketBriefArticles(edition));
  // This is a public read model, not a new LLM completion or a source-admission
  // path. Never treat researcher notes or Motion as accepted Story evidence.
  const admitted = projected.articles
    .filter(article => article.editorial.readiness === "READY").slice(0, 5);
  const news = selectVerifiedNewsBriefs(verified, now, 8);
  const frozen = projectFrozenTrackedStories(edition);
  const calendar = buildPresenterCalendar(macro, earnings, now);
  const upcoming = selectBlueDeskUpcoming(calendar, now, 14).slice(0, 8);
  const etToday = formatDualDeskTime(now)?.etDay ?? now.toISOString().slice(0, 10);
  const editionDay = edition?.published_at
    ? formatDualDeskTime(edition.published_at)?.etDay : null;
  const editionCurrent = editionDay === etToday;
  const storyHref = (article: (typeof admitted)[number]) => blueDeskPublicHref(
    "/blue-desk/stories/" + encodeURIComponent(article.articleId) +
    "?edition=" + encodeURIComponent(article.editionId), host,
  );
  const economics = upcoming.filter(e => e.kind === "economic");
  const results = upcoming.filter(e => e.kind === "earnings");

  return <main className={styles.page} data-daily-report="source-dated-read-model-v1">
    <BlueDeskHeader activePath="/blue-desk/daily-report" />
    <div className={styles.shell}>
      <header className={styles.hero}>
        <p className={styles.eyebrow}>MARKET INTELLIGENCE / DAILY REPORT</p>
        <h1>What is happening in the markets?</h1>
        <p className={styles.lead}>The latest verified developments, what the existing
          research can explain, where the market still disagrees, and the
          upcoming releases that could change the outlook.</p>
        <div className={styles.meta}>
          <span>Report read at <DualTimestamp value={now.toISOString()} /></span>
          {edition?.published_at ? <span>Research edition <DualTimestamp value={edition.published_at} /></span> :
            <span>Research edition unavailable</span>}
          <span>{editionCurrent ? "Current ET-day edition" : "No current ET-day edition confirmed"}</span>
        </div>
        <p className={styles.context}>This is a source-qualified read of the latest published
          Dossier, verified news and forward calendar, <strong>not a newly generated
          MacroPulse/Research Gate investigation</strong>. When the research edition is older
          than today, historical reasoning is shown as such. A missing research
          result is not silently recreated from headlines.</p>
      </header>

      <section className={styles.section} aria-labelledby="developments">
        <div className={styles.heading}>
          <p className={styles.eyebrow}>01 / WHAT IS NEW?</p>
          <h2 id="developments">Developments worth attention</h2>
          <p>Only recent source-verified factual updates. A news event alone does
            not mean the canonical Story thesis has changed.</p>
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
            from this feed. This does not mean nothing happened.</p>}
      </section>

      <section className={styles.section} aria-labelledby="reasoning">
        <div className={styles.heading}>
          <p className={styles.eyebrow}>02 / THE MECHANICS</p>
          <h2 id="reasoning">Why could markets react this way?</h2>
          <p>Existing evidence-admitted research, pinned to its publication.
            An observed fact and its proposed effect on assets are not the same claim.</p>
        </div>
        {admitted.length ? <div className={styles.readings}>{admitted.map(article => {
          const copy = readableSourceArticleLead(
            article.title, article.editorial.evidenceClaims,
            article.dossierAsOf || article.generatedAt,
          );
          const mechanism = article.paragraphs.find(p => p.role === "mechanism");
          const reaction = article.paragraphs.find(p => p.role === "reaction");
          const contradiction = article.paragraphs.find(p => p.role === "contradiction");
          return <article className={styles.reading} key={article.articleId}>
            <p className={styles.eyebrow}>{article.category} · {article.interpretationStatus}</p>
            <h3>{copy?.headline || article.title}</h3>
            <p className={styles.deck}>{copy?.deck || article.deck}</p>
            <dl className={styles.questions}>
              <div><dt>What is the proposed mechanism?</dt>
                <dd>{mechanism ? trim(mechanism.text) : "The edition does not establish a source-backed mechanism."}</dd></div>
              <div><dt>What did the market actually do?</dt>
                <dd>{reaction ? trim(reaction.text) : "A matching market reaction is not established."}</dd></div>
              <div><dt>What doesn't fit?</dt>
                <dd>{contradiction ? trim(contradiction.text) :
                  "No independently supported contradiction is recorded in this edition."}</dd></div>
              <div><dt>What would change the view?</dt>
                <dd>{article.conditionalOutlook ||
                  article.confirmationTests?.[0] ||
                  article.invalidationTests?.[0] ||
                  "A discriminating confirmation or invalidation test is still required."}</dd></div>
            </dl>
            <p className={styles.readingFoot}><span>Edition <DualTimestamp value={article.generatedAt} /></span>
              <Link href={storyHref(article)}>Read exact published analysis</Link></p>
          </article>;
        })}</div> : <p className={styles.empty}>No source-admitted explanatory article
          qualified in the latest edition. Fresh news above remains independently readable;
          the desk cannot invent a causal interpretation to fill the gap.</p>}
      </section>

      <section className={styles.section} aria-labelledby="storywatch">
        <div className={styles.heading}>
          <p className={styles.eyebrow}>03 / ONGOING THESES</p>
          <h2 id="storywatch">What remains unresolved?</h2>
          <p>Frozen historical Story versions remain available for comparison.
            These are watch questions, not fresh verdicts or evidence of a current move.</p>
        </div>
        {frozen?.tracks.length ? <div className={styles.watchGrid}>
          {frozen.tracks.slice(0, 6).map(track => <article key={track.storyId} className={styles.watch}>
            <h3>{track.question}</h3>
            <p><strong>Next deciding test:</strong> {track.nextTest ||
              "The frozen edition does not name a precise next observation."}</p>
            <small>Last assessed: {track.assessedAt || "unavailable"} · no accepted change in this edition</small>
          </article>)}
        </div> : <p className={styles.empty}>No eligible carried-forward Story
          context was attached to this publication.</p>}
        <p><Link href={blueDeskPublicHref("/blue-desk/key-stories", host)}>
          Explore tracked Story history
        </Link></p>
      </section>

      <section className={styles.section} aria-labelledby="forward">
        <div className={styles.heading}>
          <p className={styles.eyebrow}>04 / WHAT TO WATCH NEXT</p>
          <h2 id="forward">Calendar and earnings catalysts</h2>
          <p>Source-listed forward events, not predictions of release outcomes.</p>
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
                    : event.localDate + " · date only"}</span>
                  {event.decidingQuestion ? <p>{event.decidingQuestion}</p> : null}
                  {event.verificationState === "reported" ?
                    <small>Provider-reported date · check issuer confirmation</small> : null}
                </article>) : <p>None in the selected source-qualified 14-day window.</p>}
            </section>)}
        </div>
        <p><Link href={blueDeskPublicHref("/blue-desk/calendar",host)}>Open Calendar + Earnings Hub</Link></p>
      </section>

      <footer className={styles.footer}>
        Research boundary: MacroPulse and Research Gate may supply discovery and
        investigation, but their unadmitted leads do not become canonical evidence.
        No new Story thesis, market price, scheduled event or article is created by this page.
      </footer>
    </div>
  </main>;
}
