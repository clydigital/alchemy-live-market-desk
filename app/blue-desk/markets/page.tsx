import EarningsFundamentals from "@/components/blue-desk/EarningsFundamentals";
import EarningsInvestorDeepDive from "@/components/blue-desk/EarningsInvestorDeepDive";
import {getEarningsCase} from "@/lib/bluebelly-earnings-investor-stories";
import Link from "next/link";
import PublishedResearchDispatches from "@/components/blue-desk/PublishedResearchDispatches";
import {getPublishedMacroPulseBriefs} from "@/lib/blue-desk-macropulse-brief-server";
import {projectPublishedResearchFocus,researchForPublicLens} from "@/lib/blue-desk-published-research-focus";
import { headers } from "next/headers";

import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import TradingViewChart from "@/components/blue-desk/TradingViewChart";
import PublicMarketScreener from "@/components/blue-desk/PublicMarketScreener";
import {TV_MARKET_GROUP_DEFAULTS} from "@/lib/bluebelly-editorial-visuals";
import { MarketIcon, type MarketIconName } from "@/components/blue-desk/MarketIcon";
import {
  PUBLIC_MARKET_GROUPS, publicMarketGroup, publicMarketObservations,
} from "@/lib/blue-desk-public-markets";
import { blueDeskPublicHref } from "@/lib/blue-desk-host";
import { getMarketMonitor } from "@/lib/market-monitor-public";
import {getSourceDatedBreadth} from "@/lib/bluebelly-breadth-reader";
import {currentReviewedPublicFocus} from "@/lib/bluebelly-reviewed-public-focus";
import {calculateBreadthRow,marketParticipationResearch} from "@/lib/bluebelly-breadth-dated";
import styles from "../blue-desk.module.css";
import legibility from "./legibility.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Markets | Blue Desk",
  description: "Source-dated observations across stocks, rates, energy, currencies and credit.",
};

type Props = {
  searchParams: Promise<{ group?: string | string[]; view?: string | string[]; ticker?: string | string[] }>;
};

const GROUP_ICONS: Record<string, MarketIconName> = {
  all: "global", ai: "chip", breadth: "equities", rates: "rates", energy: "oil",
  fx: "currency", credit: "credit", equities: "equities", metals: "gold",
};

const BREADTH_WATCHES = [
  {symbol:"S5TW",label:"S&P 500 · above 20D",family:"S&P 500"},
  {symbol:"S5FI",label:"S&P 500 · above 50D",family:"S&P 500"},
  {symbol:"S5OH",label:"S&P 500 · above 100D",family:"S&P 500"},
  {symbol:"S5TH",label:"S&P 500 · above 200D",family:"S&P 500"},
  {symbol:"NDFI",label:"Nasdaq 100 · above 50D",family:"Nasdaq 100"},
  {symbol:"NDTH",label:"Nasdaq 100 · above 200D",family:"Nasdaq 100"},
  {symbol:"R2FI",label:"Russell 2000 · above 50D",family:"Russell 2000"},
  {symbol:"R2TH",label:"Russell 2000 · above 200D",family:"Russell 2000"},
] as const;

export default async function BlueDeskMarketsPage({ searchParams }: Props) {
  const query = await searchParams;
  const now = new Date();
  const group = publicMarketGroup(query.group);
  const host = (await headers()).get("host");
  // Keep the public route allowlist unchanged: a bounded query selects only
  // one of seven dated editorial cases, never arbitrary owner records.
  const readTicker=typeof query.ticker==="string"?query.ticker:"";
  const detail=query.view==="earnings"?getEarningsCase(readTicker):null;
  if(detail)return <main className={styles.page} data-bluebelly-markets-view="earnings-investor-dossier">
    <BlueDeskHeader activePath="/blue-desk/markets" />
    <div className={styles.content}>
      <EarningsInvestorDeepDive ticker={detail.ticker} backHref={blueDeskPublicHref("/blue-desk/markets",host)} />
    </div>
  </main>;
  const [monitor,breadthHistory,researchDigests] = await Promise.all([
    getMarketMonitor().catch(() => null),
    getSourceDatedBreadth().catch(()=>({series:[],retrievalStatus:"fallback" as const})),
    getPublishedMacroPulseBriefs(6).catch(()=>[]),
  ]);
  // No personal Power Stack registry may be fetched in anonymous Markets.
  const monitoredRows=publicMarketObservations(monitor?.rows || [],group);
  const breadthObservations = group==="all" || group==="breadth"
    ? BREADTH_WATCHES.map(item=>calculateBreadthRow(
        item.symbol,item.label,breadthHistory.series.find(row=>row.symbol===item.symbol)))
    : [];
  const observations=[...monitoredRows,...breadthObservations];
  const participation=marketParticipationResearch([
    ...publicMarketObservations(monitor?.rows||[],"all"),
    ...BREADTH_WATCHES.map(item=>calculateBreadthRow(
      item.symbol,item.label,breadthHistory.series.find(row=>row.symbol===item.symbol))),
  ]);
  const breadthPrimary=["S5FI","S5TH"].map(symbol=>
    BREADTH_WATCHES.find(row=>row.symbol===symbol)!
  ).map(item=>({item,reading:calculateBreadthRow(item.symbol,item.label,
    breadthHistory.series.find(row=>row.symbol===item.symbol))}));
  const breadthValue=(n:number|null,unit:"%"|"pp")=>
    n===null?"—":`${n>0&&unit==="pp"?"+":""}${n.toFixed(2)}${unit==="pp"?" pp":"%"}`;

  const selected = PUBLIC_MARKET_GROUPS.find(item => item.id === group)!;
  const reviewedFocus=(group==="all"||group==="energy")?currentReviewedPublicFocus(now):[];
  const lens=group==="all"?"all":group==="energy"?"energy":group==="rates"?"rates":group==="ai"?"ai":null;
  const editorialResearch=lens?researchForPublicLens(projectPublishedResearchFocus(researchDigests,now,6),lens):[];

  return (
    <main className={`${styles.page} ${legibility.publicMarketsLegibility} ${legibility.compactMarkets}`} data-blue-desk-markets="public-observations">
      <BlueDeskHeader activePath="/blue-desk/markets" />
      <div className={styles.content}>
        <header className={`${styles.calendarHero} ${legibility.marketHero}`}>
          <div>
            <p className={styles.kicker}>CROSS-ASSET OBSERVATIONS</p>
            <h1><MarketIcon name="market" size={33} /> Markets</h1>
            <p className={styles.heroDeck}>
              Breadth first. Compare market leadership in one place.
            </p>
          </div>
          <div className={styles.calendarClock}>
            <span className={styles.kicker}>SOURCE COVERAGE</span>
            <strong className={styles.publicMarketTotal}>
              {monitor ? `${monitor.rows.length} instruments` : "Temporarily unavailable"}
            </strong>
            <small>Source dates appear alongside prices</small>
          </div>
        </header>

        <nav aria-label="Markets page sections" className={legibility.focusNavigation}
          data-markets-primary="breadth-and-comparison">
          <a href="#breadth-watch-heading">Market breadth</a>
          <a href="#market-group-heading">ETF comparisons</a>
          <a href="#advanced-market-charts">Open charts</a>
        </nav>
        <PublishedResearchDispatches items={editorialResearch} mode="market"
          readerHref={blueDeskPublicHref("/blue-desk/newsroom",host)}/>
        {reviewedFocus.map(focus=><section key={focus.id} data-markets-reviewed-catalyst={focus.id}
          className={legibility.marketSection} style={{padding:"14px 18px",margin:"10px 0"}}>
          <p className={styles.kicker}>REVIEWED ENERGY CATALYST · {focus.eventDay} · SOURCE DATE ONLY</p>
          <h2>{focus.headline}</h2><p>{focus.fact}</p>
          <p><strong>Market test:</strong> {focus.test} This is not evidence of a verified price reaction.</p>
          <p><Link href={blueDeskPublicHref("/blue-desk/key-stories",host)+focus.href}>Read the source-reviewed story →</Link>
          {" · "}<Link href={blueDeskPublicHref("/blue-desk/hormuz",host)}>Check source-dated crossings and fuel markets →</Link></p>
        </section>)}
        <details className={legibility.categoryDisclosure}>
          <summary>Browse markets by category</summary>
          <nav aria-label="Market group" className={`${styles.publicMarketGroups} ${legibility.marketGroups}`}>
            {PUBLIC_MARKET_GROUPS.map(item=><Link key={item.id}
              href={blueDeskPublicHref("/blue-desk/markets?group="+item.id,host)}
              className={group===item.id?styles.calendarTabActive:styles.calendarTab}
              aria-current={group===item.id?"page":undefined}>
              <MarketIcon name={GROUP_ICONS[item.id]||"market"} size={17}/>
              {item.label}
            </Link>)}
          </nav>
        </details>
        
        <section className={`${styles.section} ${legibility.marketSection}`}
          aria-labelledby="breadth-watch-heading" data-market-breadth-watch="research-first">
          <div className={styles.sectionHead}><div>
            <p className={styles.kicker}>01 / THE HEALTH OF THE RALLY</p>
            <h2 id="breadth-watch-heading">Market breadth</h2>
            <p>Are more stocks joining the move, or is the index being carried by a few leaders?</p>
          </div></div>
          <div className={legibility.breadthPrimary}>
            {breadthPrimary.map(({item,reading})=><article key={item.symbol}
              className={legibility.breadthStat}>
              <div className={legibility.breadthStatHeading}>
                <strong>{item.symbol}</strong><span>{item.label}</span>
              </div>
              <strong className={legibility.breadthLevel}>{breadthValue(reading.last,"%")}</strong>
              <p>Constituents above {item.symbol==="S5FI"?"50":"200"}-day average</p>
              <div className={legibility.breadthChanges}>
                {([{name:"1D",value:reading.change},{name:"3D",value:reading.change3d},
                  {name:"5D",value:reading.change5d}] as const).map(period=><div key={period.name}>
                  <small>{period.name}</small>
                  <strong data-direction={period.value===null?"unknown":period.value>0?"up":period.value<0?"down":"flat"}>
                    {breadthValue(period.value,"pp")}</strong>
                </div>)}
              </div>
              <small>Source session {reading.asOf||"unavailable"} · {reading.dataStatus==="SOURCE_DATED_SECONDARY"?
               "Secondary daily observation":"Stale or unverified"}</small>
            </article>)}
          </div>
          <div className={styles.secondaryPanel} data-breadth-research-diagnostic={participation.status}>
            <h3>{participation.headline}</h3>
            <p>{participation.interpretation}</p>
            <p><strong>What to check next:</strong> {participation.nextTest}</p>
            <small>Through {participation.asOf||"an unavailable source date"} ·
              Source refresh: {breadthHistory.retrievalStatus}.
              Research context, not an automatic Regime/Dossier update or trade signal.</small>
          </div>
          <details className={legibility.breadthMore}>
            <summary>Other breadth charts · Nasdaq and Russell</summary>
            <p>These series are chart links until independently source-dated histories are verified.
              We do not substitute S&P 500 readings for Nasdaq or Russell participation.</p>
            <div className={legibility.breadthGrid}>
              {BREADTH_WATCHES.filter(item=>item.symbol!=="S5FI"&&item.symbol!=="S5TH")
                .map(item=><a key={item.symbol}
                 href={`https://www.tradingview.com/chart/?symbol=INDEX%3A${item.symbol}`}
                 target="_blank" rel="noreferrer" className={legibility.breadthLink}>
                  <strong>{item.symbol}</strong><span>{item.label}</span>
                  <small>Inspect external chart ↗</small>
                </a>)}
            </div>
          </details>
        </section>

        <section aria-labelledby="market-group-heading" className={`${styles.section} ${legibility.marketSection}`}>
          <div className={styles.sectionHead}>
            <div>
              <h2 id="market-group-heading"><MarketIcon name={GROUP_ICONS[group]} size={24} /> {group==="all"?"ETF & sector comparisons":selected.label}</h2>
              <p>Compare source-dated 1D, 3D and 5D sector performance. The full screener is optional.</p>
            </div>
          </div>


          <PublicMarketScreener key={group} observations={observations} group={group} dataAvailable={Boolean(monitor)} />
        </section>

        <details id="advanced-market-charts"
          className={`${styles.section} ${legibility.marketSection} ${legibility.breadthMore}`}
          data-market-chart-provider="tradingview">
          <summary>Market charts · TradingView</summary>
          <p>Interactive charts are optional and are not independent evidence of an event reaction.</p>
          <TradingViewChart initial={TV_MARKET_GROUP_DEFAULTS[group]||"us10y"} showPicker/>
        </details>

        <details id="earnings-research" className={`${styles.section} ${legibility.marketSection}`} data-earnings-reader-entry="seven-company">
          <summary>Optional: seven company earnings and financing investigations</summary>
          <p>Original-source investor research. These are dated investigations, not a live earnings-result feed. <Link href="#coreweave-credit-watch">Jump to the CoreWeave financing case</Link> after expanding.</p>
          <EarningsFundamentals amazonFeatureHref={blueDeskPublicHref("/blue-desk/key-stories",host)+"?feature=amazon-cash-test-october-2026"} deepBaseHref={blueDeskPublicHref("/blue-desk/markets",host)} />
        </details>


        <footer className={styles.footer}><span>Blue Desk</span></footer>
      </div>
    </main>
  );
}
