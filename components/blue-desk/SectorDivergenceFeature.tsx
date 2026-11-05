import Link from "next/link";
import { DIVERGENCE_US_SESSION, DIVERGENCE_BURSA_SESSION, SECTOR_DIVERGENCES, SOLARVEST_RESEARCH } from "@/lib/bluebelly-sector-divergences";
import styles from "./SectorDivergenceFeature.module.css";
import {DATED_EQUITY_ARTICLES} from "@/lib/bluebelly-dated-equity-articles";

type Props = {
  mode: "markets" | "newsroom";
  crossLinkHref: string;
  articleHrefBase: string;
};

/**
 * A frozen, source-linked editorial edition. Never pretend these historical
 * returns are live quotes or that public market data admitted a canonical story.
 * The existing Newsroom feed, historical readers and private access stay intact.
 */
export default function SectorDivergenceFeature({ mode, crossLinkHref, articleHrefBase }: Props) {
  return (
    <section
      id="sector-divergences"
      className={styles.section}
      aria-labelledby="sector-divergences-heading"
      data-bluebelly-sector-divergences={mode}
      data-price-session="2026-11-04"
    >
      <header className={styles.heading}>
        <div>
          <p className={styles.kicker}>DATED EDITORIAL · US CLOSE 4 NOV 2026</p>
          <h2 id="sector-divergences-heading">
            {mode === "markets" ? "Sector leaders and those left behind" : "The rally split: winners, laggards and what comes next"}
          </h2>
          <p className={styles.deck}>
            From consumer shares to technology, property and solar. Prices show a completed session, not live quotes.
          </p>
        </div>
        <Link className={styles.crossLink} href={crossLinkHref}>
          {mode === "markets" ? "Newsroom analysis" : "Compare markets"}
        </Link>
      </header>

      {mode === "markets" ? (
        <>
          <div className={styles.tableScroll}>
            <table className={styles.table}>
              <caption>Selected names, not a complete constituent ranking. Unadjusted price returns; 4 Nov US regular-session close.</caption>
              <thead>
                <tr>
                  <th scope="col">Sector ETF</th>
                  <th scope="col">1D</th>
                  <th scope="col">5D</th>
                  <th scope="col">20D</th>
                  <th scope="col">Notable leaders</th>
                  <th scope="col">Laggards / catch-up watch</th>
                </tr>
              </thead>
              <tbody>
                {SECTOR_DIVERGENCES.map(item => (
                  <tr key={item.etf}>
                    <th scope="row"><strong>{item.etf}</strong><span className={styles.sectorName}>{item.name}</span>{DATED_EQUITY_ARTICLES.find(a=>a.ticker===item.etf)?<Link href={articleHrefBase+"?divergence="+DATED_EQUITY_ARTICLES.find(a=>a.ticker===item.etf)!.id} className={styles.readerLink}>Read story</Link>:null}</th>
                    <td className={styles.returnCell} data-direction={item.oneDay.startsWith("−") ? "down" : "up"}>{item.oneDay}</td>
                    <td className={styles.returnCell} data-direction={item.fiveDay.startsWith("−") ? "down" : "up"}>{item.fiveDay}</td>
                    <td className={styles.returnCell} data-direction={item.twentyDay.startsWith("−") ? "down" : "up"}>{item.twentyDay}</td>
                    <td>{item.leaders}</td>
                    <td>{item.laggards}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className={styles.smallprint}>
            <strong>Watch, not a buy list:</strong> a lagging share needs better cash flow, orders or valuation support before it becomes a catch-up candidate.
            Source: Longbridge historical regular-session OHLC, {DIVERGENCE_US_SESSION}, excluding dividends.
            US ETFs are benchmarks; availability on any particular broker is unverified. Solarvest is Bursa Malaysia <strong>SLVEST (0215)</strong>, not US-listed SLV.
          </p>
        </>
      ) : (
        <>
          <article id="solarvest-divergence" className={styles.heroStory}>
            <p className={styles.kicker}>MALAYSIA VS US SOLAR · COMPANY FINANCIALS</p>
            <h3>Solarvest's business is booming. Why hasn't every solar company followed?</h3>
            <p>
              Malaysia's <strong>Solarvest (Bursa: SLVEST, 0215)</strong> reported
              FY2026 revenue of <strong>RM{SOLARVEST_RESEARCH.fy26RevenueRmMillion} million</strong>,
              up 41%, and net profit of <strong>RM{SOLARVEST_RESEARCH.fy26NetProfitRmMillion} million</strong>,
              up nearly 54%. Its first FY2027 quarter added RM155.9 million in sales,
              RM19.0 million in net profit and an unbilled construction order book of
              <strong> RM2.37 billion</strong>. The projects are real; the order book is not yet cash in the bank.
            </p>
            <p>
              Competitors show different versions of the opportunity. <strong>Samaiden</strong>
              nearly doubled full-year net profit with modest revenue growth; <strong>Pekat</strong>
              grew quarterly sales and earnings but has a different electrical-infrastructure mix.
              An indicative 5 November 10:50 MYT sector snapshot put Solarvest at roughly 48 times
              trailing earnings, versus about 43 times for Samaiden and 44 times for Pekat.
              Those are expectations-heavy valuations, not automatic bargains.
            </p>
            <p>
              Across the US solar supply chain on 4 November, <strong>Nextracker/NXT +11.12%</strong> and
              <strong> First Solar/FSLR +4.63%</strong> contrasted with <strong>SolarEdge/SEDG −8.70%</strong>.
              Over 20 trading sessions Enphase/ENPH remained <strong>5.82% lower</strong> even after a
              strong one-day rebound. Utility-scale project backlogs are not interchangeable with
              weak residential installation demand. ARRAY's jump also followed a proposed merger
              with Shoals, so it cannot be read as an industry-wide sales acceleration.
            </p>
            <p className={styles.takeaway}>
              <strong>The next test:</strong> signed power contracts and project margins in Malaysia;
              order conversion and operating cash in US equipment companies. Share-price strength
              alone does not verify delivery. Bursa solar shares may not be offered by a given CFD broker.
            </p>
            <p><Link className={styles.readerLink} href={articleHrefBase+"?divergence=solarvest-peers"}>Read the full Solarvest company comparison</Link></p>
            <div className={styles.sources}>
              <a href={SOLARVEST_RESEARCH.fullYearUrl} target="_blank" rel="noopener noreferrer">Solarvest FY2026 results</a>
              <a href={SOLARVEST_RESEARCH.q1ReportUrl} target="_blank" rel="noopener noreferrer">Solarvest Q1FY2027</a>
              <a href="https://www.isaham.my/sector/renewable-energy" target="_blank" rel="noopener noreferrer">Dated peer valuation snapshot</a>
              <a href="https://investor.firstsolar.com/financials/quarterly-results/" target="_blank" rel="noopener noreferrer">First Solar financials</a>
            </div>
            <p className={styles.smallprint}>Malaysia peer valuations: snapshot at 10:50 MYT on 5 Nov 2026; US stock returns: {DIVERGENCE_US_SESSION}. Not simultaneous market sessions.</p>
          </article>

          <div className={styles.storyGrid}>
            {SECTOR_DIVERGENCES.map(item => (
              <details key={item.etf} className={styles.story} data-divergence-ticker={item.etf}>
                <summary>
                  <span className={styles.storyTop}><strong>{item.etf} · {item.name}</strong>
                    <span className={styles.returnCell} data-direction={item.oneDay.startsWith("−") ? "down" : "up"}>{item.oneDay} 1D</span>
                  </span>
                  <span className={styles.storyTease}>{item.leaders} · {item.laggards}</span>
                </summary>
                <div className={styles.storyBody}>
                  <p>{item.context}</p>
                  <p><strong>What would confirm it:</strong> {item.nextTest}</p>
                  {DATED_EQUITY_ARTICLES.find(a=>a.ticker===item.etf)?<p><Link className={styles.readerLink} href={articleHrefBase+"?divergence="+DATED_EQUITY_ARTICLES.find(a=>a.ticker===item.etf)!.id}>Read full company-level analysis</Link></p>:null}
                  <p className={styles.smallprint}>Price returns over 5D: {item.fiveDay}; 20D: {item.twentyDay}. Selected names, not a full ETF holdings ranking. <a href={item.sourceUrl} target="_blank" rel="noopener noreferrer">{item.sourceName}</a>.</p>
                </div>
              </details>
            ))}
          </div>
          <p className={styles.smallprint}>
            Historical sector and company price changes from Longbridge unadjusted daily candles ending {DIVERGENCE_US_SESSION}.
            No dividend adjustment, flow attribution or forecasted gain. Source material and financial examples are dated.
            These public editorial notes are not a canonical Dossier verdict or a trading recommendation.
          </p>
        </>
      )}
    </section>
  );
}
