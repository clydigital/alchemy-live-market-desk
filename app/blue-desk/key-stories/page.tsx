import Link from "next/link";
import { headers } from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import { blueDeskPublicHref } from "@/lib/blue-desk-host";
import { getLiveDeskHomepageDailyBrief } from "@/lib/hybrid-publication";
import { projectMarketBriefArticles } from "@/lib/market-brief-articles";
import { loadEditorialMarketBrief } from "@/lib/market-brief-editorial-data";
import styles from "../blue-desk.module.css";
import detail from "./public-sections.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"Key Market Stories | Bluebelly",description:"Source-dated market stories, countercases and original references."};
export default async function BlueberryKeyStories() {
  const host=(await headers()).get("host");
  const edition=await getLiveDeskHomepageDailyBrief({fresh:true}).catch(()=>null);
  const brief=await loadEditorialMarketBrief(projectMarketBriefArticles(edition));
  const articles=brief.articles.filter(a=>a.editorial.readiness!=="RESEARCH_ONLY").slice(0,12);
  return <main className={styles.page} data-bluebelly-section="key-stories">
    <BlueDeskHeader activePath="/key-stories"/>
    <div className={styles.content}>
      <header className={detail.heading}>
        <div><p className={styles.kicker}>SOURCE-LINKED EDITORIAL ARCHIVE</p>
          <h1>Key market stories</h1>
          <p>Follow the underlying question and evidence, not just a one-paragraph homepage headline.
            These are published-edition interpretations, not automatically verified explanations of today's price movement.</p>
        </div>
        <Link href={blueDeskPublicHref("/blue-desk",host)}>← Market summary</Link>
      </header>
      <div className={detail.stats}><span>{articles.length} eligible story readings</span>
        <span>Last publication: {edition?.published_at?new Date(edition.published_at).toLocaleDateString("en-GB",{timeZone:"UTC"}):"not available"}</span>
        <span>{brief.blockedReason?"Some editorial material was withheld":"Original-source reader"}</span>
      </div>
      {articles.length?<div className={detail.featureGrid}>{articles.map((article,index)=>{
        const href=blueDeskPublicHref("/blue-desk/stories/"+encodeURIComponent(article.articleId)+"?edition="+encodeURIComponent(article.editionId),host);
        return <article key={article.articleId} className={detail.article} data-story-readiness={article.editorial.readiness}>
          <div className={detail.storyTop}><span className={styles.kicker}>{article.category}</span>
            <span>{article.editorial.storyEligible?"CANONICAL STORY":"SOURCED ANALYSIS"}</span></div>
          <h2>{index===0?"Lead — ":""}{article.title}</h2>
          <p>{article.deck}</p>
          <dl className={detail.facts}>
            <div><dt>Interpretation</dt><dd>{article.interpretationStatus}</dd></div>
            <div><dt>Original sources</dt><dd>{article.sourceLinks.length}</dd></div>
          </dl>
          <div className={detail.articleFoot}><DualTimestamp value={article.generatedAt} sourceDate={article.generatedAt}/>
            <Link href={href}>Open full evidence &amp; countercase →</Link></div>
        </article>;
      })}</div>:<section className={styles.secondaryPanel} role="status">
        <h2>No source-admitted article in this edition</h2>
        <p>{brief.blockedReason||"The frozen publication cannot establish a client-facing story. This is not a signal that markets have stopped moving."}</p>
        <Link href={blueDeskPublicHref("/blue-desk/what-changed",host)}>Read independently verified news →</Link>
      </section>}
      <section className={detail.callout}>
        <h2>Research faster</h2>
        <p>Read a selected Story's original sources and invalidation tests, then open the owner Presenter Deck to turn the strongest verified catalyst into a COTD or OB research pack.</p>
        <Link className={styles.primaryAction} href={blueDeskPublicHref("/blue-desk/presenter",host)}>Presenter research →</Link>
      </section>
    </div>
  </main>;
}
