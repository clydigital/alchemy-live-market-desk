import HormuzCrossings from "@/components/blue-desk/HormuzCrossings";
import EarningsFundamentals from "@/components/blue-desk/EarningsFundamentals";
import EarningsInvestorDeepDive from "@/components/blue-desk/EarningsInvestorDeepDive";
import {getEarningsCase} from "@/lib/bluebelly-earnings-investor-stories";
import { getHormuzMonitor } from "@/lib/hormuz-monitor";
import Link from "next/link";
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
  all: "global", ai: "chip", rates: "rates", energy: "oil",
  fx: "currency", credit: "credit", equities: "equities", metals: "gold",
};

export default async function BlueDeskMarketsPage({ searchParams }: Props) {
  const query = await searchParams;
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
  const [monitor, hormuz] = await Promise.all([
    getMarketMonitor().catch(() => null),
    group === "all" || group === "energy" ? getHormuzMonitor() : Promise.resolve(null),
  ]);
  const observations = publicMarketObservations(monitor?.rows || [], group);

  const selected = PUBLIC_MARKET_GROUPS.find(item => item.id === group)!;

  return (
    <main className={`${styles.page} ${legibility.publicMarketsLegibility}`} data-blue-desk-markets="public-observations">
      <BlueDeskHeader activePath="/blue-desk/markets" />
      <div className={styles.content}>
        <header className={`${styles.calendarHero} ${legibility.marketHero}`}>
          <div>
            <p className={styles.kicker}>CROSS-ASSET OBSERVATIONS</p>
            <h1><MarketIcon name="market" size={33} /> Markets</h1>
            <p className={styles.heroDeck}>
              Observed levels and session changes, with source dates.
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

        <nav aria-label="Market group" className={`${styles.publicMarketGroups} ${legibility.marketGroups}`}>
          {PUBLIC_MARKET_GROUPS.map(item => (
            <Link
              key={item.id}
              href={blueDeskPublicHref("/blue-desk/markets?group=" + item.id, host)}
              className={group === item.id ? styles.calendarTabActive : styles.calendarTab}
              aria-current={group === item.id ? "page" : undefined}
            >
              <MarketIcon name={GROUP_ICONS[item.id] || "market"} size={17} />
              {item.label}
            </Link>
          ))}
        </nav>

        <section className={`${styles.section} ${legibility.marketSection}`} aria-label="TradingView market chart" data-market-chart-provider="tradingview">
          <div className={styles.sectionHead}><div>
            <h2>Market charts · TradingView</h2>
            <p>Interactive TradingView prices and yields. The source-dated observations below are separate; the widget is not evidence of a specific event reaction.</p>
          </div></div>
          <TradingViewChart initial={TV_MARKET_GROUP_DEFAULTS[group] || "us10y"} showPicker />
        </section>

        <section aria-labelledby="market-group-heading" className={`${styles.section} ${legibility.marketSection}`}>
          <div className={styles.sectionHead}>
            <div>
              <h2 id="market-group-heading"><MarketIcon name={GROUP_ICONS[group]} size={24} /> {selected.label}</h2>
              <p>{observations.length} instrument{observations.length === 1 ? "" : "s"}</p>
            </div>
          </div>

          <PublicMarketScreener key={group} observations={observations} group={group} dataAvailable={Boolean(monitor)} />
        </section>

        <details id="earnings-research" className={`${styles.section} ${legibility.marketSection}`} data-earnings-reader-entry="seven-company">
          <summary>Optional: seven company earnings and financing investigations</summary>
          <p>Original-source investor research. These are dated investigations, not a live earnings-result feed. <Link href="#coreweave-credit-watch">Jump to the CoreWeave financing case</Link> after expanding.</p>
          <EarningsFundamentals amazonFeatureHref={blueDeskPublicHref("/blue-desk/key-stories",host)+"?feature=amazon-cash-test-october-2026"} deepBaseHref={blueDeskPublicHref("/blue-desk/markets",host)} />
        </details>

        {hormuz ? <HormuzCrossings monitor={hormuz} /> : null}

        <div className={styles.lastLinks}>
          <h2>Continue reading</h2>
          <div className={styles.quickLinks}>
            <Link href={blueDeskPublicHref("/blue-desk", host)}>Market stories →</Link>
            <Link href="#earnings-research">Earnings &amp; fundamentals →</Link>
            <Link href={blueDeskPublicHref("/blue-desk/calendar", host)}>Economic calendar →</Link>
            <Link href={blueDeskPublicHref("/blue-desk/hormuz", host)}>Hormuz / oil / distillates watch →</Link>
          </div>
        </div>
        <footer className={styles.footer}><span>Blue Desk</span></footer>
      </div>
    </main>
  );
}
