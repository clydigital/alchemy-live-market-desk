import Link from "next/link";
import { headers } from "next/headers";

import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import { MarketIcon, type MarketIconName } from "@/components/blue-desk/MarketIcon";
import {
  PUBLIC_MARKET_GROUPS, publicMarketGroup, publicMarketObservations,
  type PublicMarketObservation,
} from "@/lib/blue-desk-public-markets";
import { blueDeskPublicHref } from "@/lib/blue-desk-host";
import { getMarketMonitor } from "@/lib/market-monitor-public";
import styles from "../blue-desk.module.css";

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

function displayLevel(row: PublicMarketObservation) {
  if (row.last === null) return "Unavailable";
  const value = row.last.toLocaleString("en-GB", {
    maximumFractionDigits: Math.abs(row.last) >= 1000 ? 1 : 3,
  });
  // Treasury-rate feed values are percentage yields. Other instrument types
  // keep the source's native numerical scale rather than an inferred unit.
  return row.type === "Rates" ? `${value}%` : value;
}

function displayChange(row: PublicMarketObservation) {
  if (row.change === null) return "Not available";
  const positive = row.change > 0 ? "+" : "";
  return `${positive}${row.change.toFixed(2)}${row.changeUnit === "bp" ? " bp" : "%"}`;
}

function sourceLabel(row: PublicMarketObservation) {
  return row.asOf ? `Observation: ${row.asOf}` : "Observation date unavailable";
}

export default async function BlueDeskMarketsPage({ searchParams }: Props) {
  const query = await searchParams;
  const group = publicMarketGroup(query.group);
  const host = (await headers()).get("host");
  const monitor = await getMarketMonitor().catch(() => null);
  const observations = publicMarketObservations(monitor?.rows || [], group);
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

        <section aria-labelledby="market-group-heading" className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <h2 id="market-group-heading"><MarketIcon name={GROUP_ICONS[group]} size={24} /> {selected.label}</h2>
              <p>{observations.length} instrument{observations.length === 1 ? "" : "s"}</p>
            </div>
          </div>

          {observations.length ? (
            <div className={styles.publicMarketTableScroll}>
              <table className={styles.publicMarketTable}>
                <thead>
                  <tr>
                    <th scope="col">Instrument</th>
                    <th scope="col">Last observed</th>
                    <th scope="col">Session change</th>
                    <th scope="col">Source and vintage</th>
                  </tr>
                </thead>
                <tbody>
                  {observations.map(row => (
                    <tr key={row.id}>
                      <th scope="row">
                        <strong>{row.label}</strong>
                        <span>{row.symbol} · {row.type}</span>
                      </th>
                      <td className={styles.publicMarketNumber}>{displayLevel(row)}</td>
                      <td className={styles.publicMarketNumber}>{displayChange(row)}</td>
                      <td className={styles.publicMarketSource}>
                        <span>{sourceLabel(row)} · {row.frequency} observation</span>
                        {row.sourceUrl ? (
                          <a href={row.sourceUrl} target="_blank" rel="noreferrer">
                            {row.sourceName} · original data ↗
                          </a>
                        ) : <span>Original-source link unavailable</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
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
            Session changes require daily-frequency observations. Government-rate
            changes are in basis points; other reported price changes are percentages.
            Monthly fallback yields show their last level only. Data may lag live prices.
          </p>
          <p className={styles.publicMarketNote}>
            The source date is the observation vintage, not the time this page loaded.
            Other public Stories and the calendar retain their own independent publication dates.
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
