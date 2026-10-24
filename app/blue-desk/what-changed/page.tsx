import Link from "next/link";
import { headers } from "next/headers";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import DualTimestamp from "@/components/blue-desk/DualTimestamp";
import { getCurrentVerifiedMarketMotion } from "@/lib/market-motion";
import { selectVerifiedNewsBriefs } from "@/lib/market-brief-news";
import { getLiveDeskHomepageDailyBrief } from "@/lib/hybrid-publication";
import { projectMarketBriefArticles } from "@/lib/market-brief-articles";
import { loadEditorialMarketBrief } from "@/lib/market-brief-editorial-data";
import { blueDeskPublicHref } from "@/lib/blue-desk-host";
import desk from "../blue-desk.module.css";
import ui from "../public-insight.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "What Changed | Bluebelly",
  description: "Original-source verified market catalysts with distinct dated research context.",
};
export default async function WhatChanged() {
  const host = (await headers()).get("host");
  const [raw, edition] = await Promise.all([
    getCurrentVerifiedMarketMotion({limit:40}).catch(() => []),
    getLiveDeskHomepageDailyBrief({fresh:true}).catch(() => null),
  ]);
  const news = selectVerifiedNewsBriefs(raw,new Date(),18);
  const brief = await loadEditorialMarketBrief(projectMarketBriefArticles(edition));
  const related = brief.articles.filter(a => a.editorial.storyEligible).slice(0,5);
  return <main className={desk.page} data-bluebelly-expanded="what-changed">
    <BlueDeskHeader activePath="/what-changed" />
    <div className={desk.content}>
      <header className={ui.intro}><div>
        <p className={desk.kicker}>WHAT CHANGED / VERIFIED FACTS</p>
        <h1>New catalysts and follow-through</h1>
        <p>The latest independently checked reports, ordered by event time.
          The report, what prices did and what a Story now means are separate
          questions. A verified headline does not itself establish a market reaction.</p>
      </div><Link href={blueDeskPublicHref("/blue-desk",host)}>← Market overview</Link></header>
      <div className={ui.meta}><span>{news.length} qualifying reports in 48h</span>
        <span>Original report linked</span><span>Prices require dated observations</span></div>
      <section className={ui.section} aria-labelledby="developments-title">
        <h2 id="developments-title">Verified developments</h2>
        {news.length ? <div className={ui.grid}>{news.map(item=>
          <article className={ui.card} key={item.id}>
            <p className={ui.eyebrow}>FACTUAL NEWS · {item.sourceKind}</p>
            <h3>{item.headline}</h3><p>{item.summary}</p>
            <small><DualTimestamp value={item.occurredAt} sourceDate={item.occurredAt}/></small>
            <a className={ui.sourceLink} href={item.sourceUrl} target="_blank" rel="noopener noreferrer">
              {item.sourceName} · read original report ↗</a>
          </article>)}</div> :
          <div className={ui.empty}>No qualified verified news within the 48-hour event window.
            This may be an ingestion or verification gap—not evidence that markets are quiet.
            Publication archives and dated market data remain separate.</div>}
      </section>
      <section className={ui.section} aria-labelledby="follow-through-title">
        <h2 id="follow-through-title">How to investigate follow-through</h2>
        <p>Check Treasury yields, the dollar and oil using source-dated market observations.
          We do not assign a causal price response when the exact event window is unavailable.</p>
        <div className={ui.tabs}>
          <Link href={blueDeskPublicHref("/blue-desk/rates",host)}>Rates and yield curve →</Link>
          <Link href={blueDeskPublicHref("/blue-desk/markets",host)}>Cross-asset prices →</Link>
          <Link href={blueDeskPublicHref("/blue-desk/calendar",host)}>Upcoming events →</Link>
        </div>
      </section>
      <section className={ui.section} aria-labelledby="related-title">
        <h2 id="related-title">Related admitted analysis</h2>
        {related.length ? <div className={ui.grid}>{related.map(a=>
          <article className={ui.card} key={a.articleId}>
            <p className={ui.eyebrow}>{a.category} · {a.interpretationStatus}</p>
            <h3>{a.title}</h3><p>{a.deck}</p>
            <Link href={blueDeskPublicHref("/blue-desk/stories/" + encodeURIComponent(a.articleId)
              + "?edition=" + encodeURIComponent(a.editionId),host)}>Read exact published analysis →</Link>
          </article>)}</div> : <div className={ui.empty}>No source-admitted Story explanation in the current edition.
            Do not substitute an unrelated historical thesis.</div>}
      </section>
    </div>
  </main>;
}
