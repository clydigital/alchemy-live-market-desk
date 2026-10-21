import Link from "next/link";
import { headers } from "next/headers";

import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import MarketsMonitor from "@/components/live-desk/MarketsMonitor";
import { isBlueDeskPublicReaderHost } from "@/lib/blue-desk-host";
import { getGlobalFlowMonitor } from "@/lib/global-flow-monitor";
import PublicGovernmentRateTrendChart from "@/components/blue-desk/PublicGovernmentRateTrendChart";
import { MarketIcon, type MarketIconName } from "@/components/blue-desk/MarketIcon";
import {
  PUBLIC_MARKET_GROUPS, publicMarketGroup, publicMarketObservations, publicGovernmentRateTrends,
} from "@/lib/blue-desk-public-markets";
import { blueDeskPublicHref } from "@/lib/blue-desk-host";
import { getMarketMonitor } from "@/lib/market-monitor-public";
import styles from "../blue-desk.module.css";
import BlueDeskMarketReader from "./BlueDeskMarketReader";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Markets | Blue Desk",
  description: "Source-dated observations across stocks, rates, energy, currencies and credit.",
};

type Props = {
  searchParams: Promise<{ group?: string | string[] }>;
};

const GROUP_ICONS: Record<string, MarketIconName> = {
  all: "global", ai: "chip", rates: "rates", energy: "oil",
  fx: "currency", credit: "credit", equities: "equities", metals: "gold",
};

export default async function BlueDeskMarketsPage({ searchParams }: Props) {
  const query = await searchParams;
  const group = publicMarketGroup(query.group);
  const host = (await headers()).get("host");

  // Exact Hybrid tape, inside the Blue Desk shell for signed-in owner hosts.
  // Public Bluebelly and canonical Live retain the existing bounded,
  // source-only DTO; neither receives HOT/RSI, signals, or price histories.
  if (!isBlueDeskPublicReaderHost(host)) {
    const [fullMonitor, flows] = await Promise.all([
      getMarketMonitor(),
      getGlobalFlowMonitor(),
    ]);
    return (
      <main className={styles.page} data-blue-desk-markets="hybrid-owner-tape">
        <BlueDeskHeader activePath="/blue-desk/markets" />
        <div className={styles.content}>
          <MarketsMonitor monitor={fullMonitor} flows={flows} hybridTape />
        </div>
      </main>
    );
  }
  const monitor = await getMarketMonitor().catch(() => null);
  const observations = publicMarketObservations(monitor?.rows || [], group);
  const officialRateTrends = group === "all" || group === "rates"
    ? publicGovernmentRateTrends(monitor?.rows || []) : [];
  const selected = PUBLIC_MARKET_GROUPS.find(item => item.id === group)!;

  return (
    <main className={styles.page} data-blue-desk-markets="public-observations">
      <BlueDeskHeader activePath="/blue-desk/markets" />
      <div className={styles.content}>
        <header className={styles.calendarHero}>
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

        <nav aria-label="Market group" className={styles.publicMarketGroups}>
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

        {(group === "all" || group === "rates") && monitor ? (
          <PublicGovernmentRateTrendChart series={officialRateTrends} nowIso={monitor.updatedAt} />
        ) : null}

        <section aria-labelledby="market-group-heading" className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <h2 id="market-group-heading"><MarketIcon name={GROUP_ICONS[group]} size={24} /> {selected.label}</h2>
              <p>{observations.length} instrument{observations.length === 1 ? "" : "s"}</p>
            </div>
          </div>

          {observations.length ? (
            <BlueDeskMarketReader observations={observations} />
          ) : (
            <div className={styles.secondaryPanel} role="status">
              <h3>Observations unavailable</h3>
              <p className={styles.muted}>
                {monitor
                  ? "No source-qualified prices for this group."
                  : "Market data unavailable."}
              </p>
            </div>
          )}

          <p className={styles.publicMarketNote}>
            Changes: rates in bp; others in %. Monthly yields show levels only. Dates are from sources; data may lag.
          </p>
        </section>

        <div className={styles.lastLinks}>
          <h2>Continue reading</h2>
          <div className={styles.quickLinks}>
            <Link href={blueDeskPublicHref("/blue-desk", host)}>Market stories →</Link>
            <Link href={blueDeskPublicHref("/blue-desk/calendar", host)}>Economic calendar →</Link>
          </div>
        </div>
        <footer className={styles.footer}><span>Blue Desk</span></footer>
      </div>
    </main>
  );
}
