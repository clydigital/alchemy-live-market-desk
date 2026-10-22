import Link from "next/link";
import { headers } from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import StoryIdentityBalls from "@/components/blue-desk/StoryIdentityBalls";
import { getRecentPublishedStoryReadings } from "@/lib/blue-desk/story-archive-server";
import { exactPublishedStoryId,newestStoryReadings,paginateStoryReadings,type PublishedStoryReading } from "@/lib/blue-desk/story-archive";
import { storyMatchesSubject } from "@/lib/blue-desk/story-identity";
import { blueDeskPublicHref } from "@/lib/blue-desk-host";
import { getLiveDeskHomepageDailyBrief } from "@/lib/hybrid-publication";
import { projectMarketBriefArticles } from "@/lib/market-brief-articles";
import { loadEditorialMarketBrief } from "@/lib/market-brief-editorial-data";
import styles from "../blue-desk.module.css";
import detail from "./public-sections.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"Key Market Stories | Bluebelly",description:"Source-dated market stories, countercases and original references."};
export default async function BlueberryKeyStories({searchParams}:{searchParams:Promise<{page?:string|string[];subject?:string|string[]}>}) {
  const query=await searchParams;
  const requestedPage=typeof query.page==="string" && /^\d{1,3}$/.test(query.page)?Number(query.page):1;
  const subject=typeof query.subject==="string" && /^[A-Z0-9]{2,12}$/.test(query.subject)?query.subject:"";
  const host=(await headers()).get("host");
  const edition=await getLiveDeskHomepageDailyBrief({fresh:true}).catch(()=>null);
  const brief=await loadEditorialMarketBrief(projectMarketBriefArticles(edition));
  const archive=await getRecentPublishedStoryReadings().catch(()=>[]);
  const fallback:PublishedStoryReading[]=brief.articles.flatMap(article=>{
    const storyId=exactPublishedStoryId(article);
    return storyId && article.editorial.readiness!=="RESEARCH_ONLY" && edition
      ?[{article,storyId,editionId:article.editionId,publishedAt:edition.published_at}]:[];
  });
  const history=archive.length?archive:fallback;
  const latestReadings=newestStoryReadings(history);
  const filtered=subject?latestReadings.filter(entry=>
    storyMatchesSubject(entry.article.title,entry.article.deck,entry.article.subjectAssets||[],subject)):latestReadings;
  const pages=paginateStoryReadings(filtered,requestedPage);
  const articles=pages.items;
  const pageHref=(page:number,tag=subject)=>blueDeskPublicHref("/blue-desk/key-stories",host)+
    "?page="+page+(tag?"&subject="+encodeURIComponent(tag):"");

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
      <div className={detail.stats}><span>{pages.total} ongoing Story threads · page {pages.page}/{pages.pages}</span>
        <span>Last publication: {edition?.published_at?new Date(edition.published_at).toLocaleDateString("en-GB",{timeZone:"UTC"}):"not available"}</span>
        <span>{brief.blockedReason?"Some editorial material was withheld":"Original-source reader"}</span>
      </div>
      {articles.length?<div className={detail.featureGrid}>{articles.map(({article,storyId},index)=>{
        const href=blueDeskPublicHref("/blue-desk/stories/"+encodeURIComponent(article.articleId)+"?edition="+encodeURIComponent(article.editionId),host);
        return <article key={article.articleId} className={detail.article} data-story-readiness={article.editorial.readiness}>
          <div className={detail.storyTop}><span className={styles.kicker}>{article.category}</span>
            <span>{article.editorial.storyEligible?"CANONICAL STORY":"SOURCED ANALYSIS"}</span></div>
          <StoryIdentityBalls title={article.title} deck={article.deck} assets={article.subjectAssets}
              hrefBase={blueDeskPublicHref("/blue-desk/key-stories",host)}/>
          <small>Latest source-admitted report · ongoing Story</small>
          <h2>{index===0?"Lead — ":""}{article.title}</h2>
          <p>{article.deck}</p>
          <dl className={detail.facts}>
            <div><dt>Interpretation</dt><dd>{article.interpretationStatus}</dd></div>
            <div><dt>Original sources</dt><dd>{article.sourceLinks.length}</dd></div>
          </dl>
          <div className={detail.articleFoot}><DualTimestamp value={article.generatedAt} sourceDate={article.generatedAt}/>
            {history.filter(previous=>previous.storyId===storyId).length>1?<span>{history.filter(previous=>previous.storyId===storyId).length-1} earlier reports</span>:null}
            <Link href={href}>Open full evidence &amp; countercase →</Link>
            <Link href={blueDeskPublicHref("/blue-desk/presenter?edition="+encodeURIComponent(article.editionId)
              +"&story="+encodeURIComponent(storyId),host)}>Prepare Story · owner →</Link></div>
        </article>;
      })}</div>:<section className={styles.secondaryPanel} role="status">
        <h2>No source-admitted article in this edition</h2>
        <p>{brief.blockedReason||"The frozen publication cannot establish a client-facing story. This is not a signal that markets have stopped moving."}</p>
        <Link href={blueDeskPublicHref("/blue-desk/what-changed",host)}>Read independently verified news →</Link>
      </section>}
      <nav className={styles.storyPager} aria-label="Story archive pages">
        {pages.page>1?<Link href={pageHref(pages.page-1)}>← Newer reports</Link>:<span>Newest reports</span>}
        <span>Page {pages.page} of {pages.pages}</span>
        {pages.page<pages.pages?<Link href={pageHref(pages.page+1)}>Earlier Stories →</Link>:<span>Archive window complete</span>}
      </nav>
      {subject?<p><Link href={pageHref(1,"")}>Clear {subject} subject filter ×</Link></p>:null}
      <p className={styles.coverage}>The latest 24 published editions are indexed. Earlier individual editions keep their immutable permalinks.</p>
            <section className={detail.callout}>
        <h2>Research faster</h2>
        <p>Read a selected Story's original sources and invalidation tests, then open the owner Presenter Deck to turn the strongest verified catalyst into a COTD or OB research pack.</p>
        <Link className={styles.primaryAction} href={blueDeskPublicHref("/blue-desk/presenter",host)}>Presenter research →</Link>
      </section>
    </div>
  </main>;
}
