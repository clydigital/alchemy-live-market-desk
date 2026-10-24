import Link from "next/link";
import { headers } from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import { blueDeskPublicHref } from "@/lib/blue-desk-host";
import { getLiveDeskHomepageDailyBrief } from "@/lib/hybrid-publication";
import { projectMarketBriefArticles } from "@/lib/market-brief-articles";
import { loadEditorialMarketBrief } from "@/lib/market-brief-editorial-data";
import { getCurrentVerifiedMarketMotion } from "@/lib/market-motion";
import { selectVerifiedNewsBriefs } from "@/lib/market-brief-news";
import { projectFrozenTrackedStories } from "@/lib/blue-desk-tracked-stories";
import { getTrackedOriginalSources } from "@/lib/blue-desk-tracked-evidence";
import desk from "../blue-desk.module.css";
import ui from "../public-insight.module.css";
import watch from "./key-stories.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Key Market Stories | Bluebelly",
  description: "Source-admitted interpretations and independently verified developments.",
};

export default async function KeyStories() {
  const host = (await headers()).get("host");
  const [edition, raw] = await Promise.all([
    getLiveDeskHomepageDailyBrief({fresh:true}).catch(() => null),
    getCurrentVerifiedMarketMotion({limit:18}).catch(() => []),
  ]);
  const tracker = projectFrozenTrackedStories(edition);
  const [brief, originalSources] = await Promise.all([
    loadEditorialMarketBrief(projectMarketBriefArticles(edition)),
    getTrackedOriginalSources(tracker),
  ]);
  // An article's original edition ID is the only valid permalink authority.
  const stories = brief.articles
    .filter(article => article.editorial.readiness !== "RESEARCH_ONLY")
    .slice(0,12);
  const news = selectVerifiedNewsBriefs(raw, new Date(), 6);
  const href = (article:typeof stories[number]) =>
    blueDeskPublicHref("/blue-desk/stories/" + encodeURIComponent(article.articleId)
      + "?edition=" + encodeURIComponent(article.editionId),host);
  return <main className={desk.page} data-bluebelly-expanded="key-stories">
    <BlueDeskHeader activePath="/key-stories" />
    <div className={desk.content}>
      <header className={ui.intro}><div>
        <p className={desk.kicker}>MARKET VIEW / STORY THREADS</p>
        <h1>Key market stories</h1>
        <p>Read the evidence, the countercase and the next test behind each published view.
          Fresh source-verified reports are shown separately: they are not automatic
          changes to a canonical Story or Regime.</p>
      </div><Link href={blueDeskPublicHref("/blue-desk",host)}>← Market overview</Link></header>
      <section className={ui.section} aria-labelledby="story-list-title">
        <h2 id="story-list-title">Published analysis</h2>
        <div className={ui.meta}>
          <span>{edition?.published_at ? "Edition published " + edition.published_at : "Publication unavailable"}</span>
          <span>{stories.length} source-admitted reading(s)</span>
          <span>Exact-edition links</span>
        </div>
        {stories.length ? <div className={ui.grid}>{stories.map(article =>
          <article className={ui.card} key={article.articleId}>
            <p className={ui.eyebrow}>{article.category} · {article.interpretationStatus}</p>
            <h3>{article.title}</h3><p>{article.deck}</p>
            <small><DualTimestamp value={article.generatedAt} sourceDate={article.generatedAt}/></small>
            <p>Next test: {article.conditionalOutlook || "No canonical test admitted for this edition."}</p>
            <Link href={href(article)}>Read exact published interpretation →</Link>
          </article>)}</div> :
          <div className={ui.empty}>No source-admitted Story analysis in the latest edition.
            This does not prove there were no market developments. The publication
            handoff is under review; older editions have not been substituted as current.</div>}
      </section>
      <section className={watch.section}
        data-bluebelly-tracked-stories="frozen-context"
        aria-labelledby="ongoing-story-watch">
        <h2 id="ongoing-story-watch">Ongoing Story watch</h2>
        <p>These are carried-forward questions from the last frozen Dossier.
          They are not new developments, fresh evidence or newly accepted thesis changes.
          Only a dated source can qualify as a historical fact.</p>
        <div className={watch.summary}>
          <span>{tracker?.tracks.length ?? 0} previously tracked threads</span>
          <span>{tracker?.currentAcceptedStoryCount ?? 0} accepted Story records in this edition</span>
          <span>Edition published: {tracker?.publishedAt ?? "Unavailable"}</span>
          <span>Frozen Dossier as of: {tracker?.dossierAsOf ?? "Unavailable"}</span>
        </div>
        {tracker?.tracks.length ?
          <div className={watch.cards}>
            {tracker.tracks.map((thread, index) =>
              <article className={watch.card} id={"story-" + thread.storyId}
                key={thread.storyId}>
                <p className={watch.kicker}>THREAD {String(index + 1).padStart(2, "0")} · HISTORICAL CONTEXT</p>
                <h3>{thread.question}</h3>
                <p>No new accepted Story change. The question is not evidence of
                  present-day market conditions.</p>
                <div className={watch.test}>
                  <strong>What to verify next</strong>
                  <p>{thread.nextTest || "No dated next test was recorded."}</p>
                </div>
                <small>Last attention assessment: {thread.assessedAt ?? "Not recorded"}</small>
                <div className={watch.test}>
                  <strong>Original sources available at the frozen Dossier date</strong>
                  {(originalSources.get(thread.storyId) ?? []).length ?
                    (originalSources.get(thread.storyId) ?? []).map(item =>
                      <div key={item.evidenceId}>
                        <p>{item.claimExcerpt}</p>
                        <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
                          {item.sourceName} — original source
                        </a>
                        <small>Evidence available: {item.availableAt}</small>
                      </div>) :
                    <p>No historical original source passed the time and provenance
                      checks for this thread. Do not treat the question as a verified fact.</p>}
                </div>
                <small>{thread.evidenceReferenceCount} frozen canonical evidence
                  reference(s), not independently re-verified current facts</small>
                <small>Canonical Story ID: {thread.storyId}</small>
                <small>Thesis version ID: {thread.thesisVersionId}</small>
              </article>)}
          </div> :
          <div className={watch.empty}>No admissible carried-forward Story
            threads for this edition. This is a coverage gap, not proof
            that the market themes have disappeared.</div>}
      </section>
      <section className={ui.section} aria-labelledby="story-news-title">
        <h2 id="story-news-title">Fresh verified developments</h2>
        <p>These original reports may be newer than the latest accepted Story thesis.</p>
        {news.length ? <div className={ui.grid}>{news.map(item=>
          <article className={ui.card} key={item.id}>
            <p className={ui.eyebrow}>SOURCE-VERIFIED FACT · NOT STORY EVIDENCE</p>
            <h3>{item.headline}</h3><p>{item.summary}</p>
            <small><DualTimestamp value={item.occurredAt} sourceDate={item.occurredAt}/></small>
            <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.sourceName} — original report ↗</a>
          </article>)}</div> : <div className={ui.empty}>No independently source-verified items within the freshness window.
            Treat this as feed coverage, not as market calm.</div>}
      </section>
    </div>
  </main>;
}
