import Link from "next/link";
import { headers } from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import { blueDeskPublicHref } from "@/lib/blue-desk-host";
import { getCurrentVerifiedMarketMotion } from "@/lib/market-motion";
import { selectVerifiedNewsBriefs } from "@/lib/market-brief-news";
import { rankBlueDeskImpactFeed } from "@/lib/blue-desk-impact-feed";
import { getLiveDeskHomepageDailyBrief } from "@/lib/hybrid-publication";
import { projectMarketBriefArticles } from "@/lib/market-brief-articles";
import { loadEditorialMarketBrief } from "@/lib/market-brief-editorial-data";
import styles from "../blue-desk.module.css";
import layout from "../key-stories/public-sections.module.css";
export const dynamic="force-dynamic";
export const metadata={title:"What Changed | Bluebelly",description:"Original-source verified developments and their timestamps."};
export default async function PublicWhatChanged() {
  const host=(await headers()).get("host"), now=new Date();
  const [raw,edition]=await Promise.all([
    getCurrentVerifiedMarketMotion({limit:40}).catch(()=>[]),
    getLiveDeskHomepageDailyBrief({fresh:true}).catch(()=>null),
  ]);
  const news=selectVerifiedNewsBriefs(raw,now,18);
  const impact=rankBlueDeskImpactFeed(raw,now,8);
  const major=impact.filter(item=>item.attention!=="ROUTINE").slice(0,5);
  const prioritisedIds=new Set(impact.map(x=>x.fact.id));
  const orderedNews=[...impact.map(x=>x.fact),...news.filter(x=>!prioritisedIds.has(x.id))];
  const brief=await loadEditorialMarketBrief(projectMarketBriefArticles(edition));
  const material=brief.articles.filter(a=>a.editorial.storyEligible).slice(0,4);
  return <main className={styles.page} data-bluebelly-section="what-changed">
    <BlueDeskHeader activePath="/what-changed"/>
    <div className={styles.content}>
      <header className={layout.heading}>
        <div><p className={styles.kicker}>SOURCE-VERIFIED NEWS TAPE</p>
          <h1>What changed?</h1>
          <p>Market consequence first, then the complete source-dated news tape. An observed headline is not proof of how markets reacted;
            underlying yields, prices and Dossier interpretation are separate checks.</p>
        </div>
        <Link href={blueDeskPublicHref("/blue-desk",host)}>← Market summary</Link>
      </header>
      <div className={layout.stats}>
        <span>{news.length} verified reports within 48 hours</span>
        <span>Ranked by materiality, relevance and novelty; source dates retained</span>
        <span>Source links retained</span>
      </div>
      <section className={styles.impactSection} aria-labelledby="what-changed-impact">
        <div className={styles.impactHeading}><div>
          <span className={styles.kicker}>HIGHEST PRIORITY / RESEARCH QUESTIONS</span>
          <h2 id="what-changed-impact">What deserves your attention?</h2>
          <p>Original events are source-verified. Market implications and next checks remain open questions until independently measured.</p>
        </div></div>
        {major.length?<div className={styles.impactGrid}>
          {major.map(item=><article className={styles.impactCard} key={item.fact.id}>
            <div className={styles.impactTop}><span>{item.attention==="MAJOR"?"MARKET-WIDE FOCUS":"SIGNIFICANT DEVELOPMENT"} · {item.category.replaceAll("_"," ")}</span>
              <DualTimestamp value={item.fact.occurredAt} sourceDate={item.fact.occurredAt}/></div>
            <h3>{item.fact.headline}</h3><p className={styles.impactFact}>{item.fact.summary}</p>
            {item.researchAngle?<div className={styles.impactLens}><strong>Why it could matter</strong>
              <p>{item.researchAngle}</p><small>Research interpretation · not an observed price reaction</small></div>:null}
            <div className={styles.impactNext}><strong>Watch next</strong><p>{item.nextCheck}</p></div>
            <div className={styles.impactBottom}>
              <div className={styles.impactAssets}>{item.assets.map(t=><span key={t}>{t}</span>)}</div>
              <a href={item.fact.sourceUrl} rel="noreferrer noopener" target="_blank">{item.fact.sourceName} ↗</a>
            </div>
          </article>)}
        </div>:<div className={styles.impactQuiet}><strong>No high-impact event is source-qualified right now.</strong><p>See all published event reports below; this is not evidence of a quiet market.</p></div>}
      </section>
      {news.length?<div className={layout.newsColumns}>
        <div className={layout.newsTape}>
          {orderedNews.map((item,index)=><article key={item.id} className={layout.newsItem}>
            <div className={layout.storyTop}>
              <span className={styles.kicker}>{index===0?"PRIORITY SOURCE":"VERIFIED REPORT"} · {item.sourceKind}</span>
              <DualTimestamp value={item.occurredAt} sourceDate={item.occurredAt}/>
            </div>
            <h2>{item.headline}</h2><p>{item.summary}</p>
            <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.sourceName} — read original report ↗</a>
          </article>)}
        </div>
        <aside className={layout.contextPanel}>
          <h2>What still needs checking?</h2>
          <p>Did the headline materially change rates, oil, credit or equity breadth?
            A source-verified report alone cannot prove transmission.</p>
          <Link href={blueDeskPublicHref("/blue-desk/rates",host)}>Review Treasury yields →</Link>
          <Link href={blueDeskPublicHref("/blue-desk/markets",host)}>Cross-asset observations →</Link>
          <h3>Related dated analyses</h3>
          {material.map(a=><Link key={a.articleId} href={blueDeskPublicHref("/blue-desk/stories/"+encodeURIComponent(a.articleId)+"?edition="+encodeURIComponent(a.editionId),host)}>{a.title}</Link>)}
          <p>For live presenter investigation, switch to the owner deck. Motion remains non-evidentiary until independently admitted.</p>
          <Link className={styles.primaryAction} href={blueDeskPublicHref("/blue-desk/presenter",host)}>Open Presenter Deck →</Link>
        </aside>
      </div>:<section className={styles.secondaryPanel} role="status">
        <h2>No source-qualified headlines in the last 48 hours</h2>
        <p>This is a feed-coverage outcome, not evidence of a quiet market.
          Review market observations and the official calendar.</p>
        <Link href={blueDeskPublicHref("/blue-desk/markets",host)}>Market observations →</Link>
      </section>}
    </div>
  </main>;
}
