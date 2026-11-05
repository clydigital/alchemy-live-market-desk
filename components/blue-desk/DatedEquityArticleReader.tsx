import Link from "next/link";
import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import { blueDeskPublicHref } from "@/lib/blue-desk-host";
import { DATED_EQUITY_ARTICLES, type DatedEquityArticle } from "@/lib/bluebelly-dated-equity-articles";
import { SECTOR_DIVERGENCES } from "@/lib/bluebelly-sector-divergences";
import styles from "./DatedEquityArticleReader.module.css";

type Props = {article: DatedEquityArticle; host: string | null};

/** Exact allowlisted query-string editions; no public route to private drafts. */
export default function DatedEquityArticleReader({ article, host }: Props) {
  const newsroom = blueDeskPublicHref("/blue-desk/newsroom", host);
  const markets = blueDeskPublicHref("/blue-desk/markets", host);
  const sector = SECTOR_DIVERGENCES.find(s => s.etf === article.ticker);
  const peers = DATED_EQUITY_ARTICLES.filter(a => a.id !== article.id).sort((a,b) => a.rank - b.rank);
  return <main className={styles.page} data-dated-equity-reader={article.id} data-equity-edition="2026-11-05">
    <BlueDeskHeader activePath="/blue-desk/newsroom" />
    <article className={styles.article}>
      <nav className={styles.back} aria-label="Editorial navigation">
        <Link href={newsroom + "#sector-divergences"}>← Newsroom</Link>
        <Link href={markets + "#sector-divergences"}>Market comparisons</Link>
      </nav>
      <header className={styles.hero}>
        <p className={styles.kicker}>BLUEBELLY NEWSROOM / {article.category}</p>
        <h1>{article.title}</h1>
        <p className={styles.dek}>{article.summary}</p>
        <p className={styles.date}><strong>DATED EDITORIAL · 5 NOVEMBER 2026</strong> · Price observation: {article.priceSession}. Returns exclude distributions and are not live quotes.</p>
      </header>
      {sector ? <aside className={styles.tape} aria-label={sector.etf + " historical comparison"}>
        <div><span>ETF {sector.etf}</span><strong>{sector.oneDay} <small>1D</small></strong></div>
        <div><span>5 trading sessions</span><strong>{sector.fiveDay}</strong></div>
        <div><span>20 trading sessions</span><strong>{sector.twentyDay}</strong></div>
        <p><b>Names to compare:</b> {sector.leaders} · {sector.laggards}.</p>
      </aside> : <aside className={styles.tape} aria-label="Solarvest dated issuer reading">
        <div><span>Bursa Malaysia</span><strong>SLVEST <small>0215</small></strong></div>
        <div><span>FY2026 revenue</span><strong>RM757.1m</strong></div>
        <div><span>Unbilled orders</span><strong>RM2.37bn</strong></div>
        <p>Malaysian equities and US solar-company share changes refer to different local market sessions. US SLV is a silver ETF, not Solarvest.</p>
      </aside>}
      <div className={styles.prose}>
        {article.sections.map((section, i) => <section key={i} className={styles.section}>
          {section.heading ? <h2>{section.heading}</h2> : null}
          {section.paragraphs.map((p, j) => <p key={j}>{p}</p>)}
        </section>)}
        <aside className={styles.disclaimer}>
          <strong>What this edition does and does not establish.</strong> This article connects a dated price tape with independently reported company financials. It does not prove fund flows, a permanent market regime or whether a lagging stock is undervalued. Order books are not cash receipts. Products may not be offered by your broker.
        </aside>
      </div>
      <section className={styles.sources} aria-labelledby="equity-reader-sources">
        <h2 id="equity-reader-sources">Original reports and price sources</h2>
        <p>Company periods, prices and source dates differ. Follow issuer disclosures for later revisions or results.</p>
        <ul>{article.sources.map(source => <li key={source.url}><a href={source.url} target="_blank" rel="noopener noreferrer">{source.label}</a></li>)}</ul>
        <p>Historical US price comparisons: Longbridge regular-session, unadjusted OHLC through 4 November 2026. Source material does not imply that a quoted stock is a constituent of the named ETF unless the dated issuer/sponsor holdings list verifies it.</p>
      </section>
      <nav className={styles.related} aria-label="Read another market divergence">
        <h2>More from this market split</h2>
        <div className={styles.relatedGrid}>
          {peers.map(a => <Link href={newsroom + "?divergence=" + encodeURIComponent(a.id)} key={a.id}>
            <span>{a.category}</span>
            <strong>{a.title}</strong>
          </Link>)}
        </div>
      </nav>
    </article>
  </main>;
}
