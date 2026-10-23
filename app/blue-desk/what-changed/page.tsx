import Link from "next/link";
import { headers } from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import { blueDeskPublicHref } from "@/lib/blue-desk-host";
import { getCurrentVerifiedMarketMotion } from "@/lib/market-motion";
import { selectVerifiedNewsBriefs } from "@/lib/market-brief-news";
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
  const brief=await loadEditorialMarketBrief(projectMarketBriefArticles(edition));
  const material=brief.articles.filter(a=>a.editorial.storyEligible).slice(0,4);
  return <main className={styles.page} data-bluebelly-section="what-changed">
    <BlueDeskHeader activePath="/what-changed"/>
    <div className={styles.content}>
      <header className={layout.heading}>
        <div><p className={styles.kicker}>SOURCE-VERIFIED NEWS TAPE</p>
          <h1>What changed?</h1>
          <p>Original events, newest first. An observed headline is not proof of how markets reacted;
            underlying yields, prices and Dossier interpretation are separate checks.</p>
        </div>
        <Link href={blueDeskPublicHref("/blue-desk",host)}>← Market summary</Link>
      </header>
      <div className={layout.stats}>
        <span>{news.length} verified reports within 48 hours</span>
        <span>Based on event time, not collection time</span>
        <span>Source links retained</span>
      </div>
      {news.length?<div className={layout.newsColumns}>
        <div className={layout.newsTape}>
          {news.map((item,index)=><article key={item.id} className={layout.newsItem}>
            <div className={layout.storyTop}>
              <span className={styles.kicker}>{index===0?"MOST RECENT":"VERIFIED REPORT"} · {item.sourceKind}</span>
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
