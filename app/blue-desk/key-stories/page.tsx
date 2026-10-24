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
import desk from "../blue-desk.module.css";
import ui from "../public-insight.module.css";

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
  const brief = await loadEditorialMarketBrief(projectMarketBriefArticles(edition));
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
