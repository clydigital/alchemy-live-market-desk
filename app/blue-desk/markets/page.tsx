import HormuzCrossings from "@/components/blue-desk/HormuzCrossings";
import BlueDeskMarketReader from "./BlueDeskMarketReader";
import { getHormuzMonitor } from "@/lib/hormuz-monitor";
import Link from "next/link";
import { headers } from "next/headers";

import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import PublicGovernmentRateTrendChart from "@/components/blue-desk/PublicGovernmentRateTrendChart";
import { MarketIcon, type MarketIconName } from "@/components/blue-desk/MarketIcon";
import {
  PUBLIC_MARKET_GROUPS, publicMarketGroup, publicMarketObservations, publicOfficialMacroTrends,
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
  const [monitor, hormuz] = await Promise.all([
    getMarketMonitor().catch(() => null),
    group === "all" || group === "energy" ? getHormuzMonitor() : Promise.resolve(null),
  ]);
  const observations = publicMarketObservations(monitor?.rows || [], group);
  const officialRateTrends = group === "all" || group === "rates" || group === "credit"
    ? publicOfficialMacroTrends(monitor?.rows || [],group) : [];
  const selected = PUBLIC_MARKET_GROUPS.find(item => item.id === group)!;

  return (
    <main className={`${styles.page} ${legibility.publicMarketsLegibility}`} data-blue-desk-markets="public-observations">
      <BlueDeskHeader activePath="/blue-desk/markets" />
      <div className={styles.content}>
        <header className={styles.calendarHero}>
          <div>
            <p className={styles.kicker}>CROSS-ASSET OBSERVATIONS</p>
            <h1><MarketIcon name="market" size={33} /> Markets</h1>
            <p className={styles.heroDeck}>
              Search instruments, filter observed direction, and inspect official rates, inflation and credit trends. All prices carry source dates.
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

        {(group === "all" || group === "rates" || group === "credit") && monitor ? (
          <PublicGovernmentRateTrendChart series={officialRateTrends} nowIso={monitor.updatedAt} />
        ) : null}

        <section aria-labelledby="market-group-heading" className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <h2 id="market-group-heading"><MarketIcon name={GROUP_ICONS[group]} size={24} /> {selected.label}</h2>
              <p>{observations.length} instrument{observations.length === 1 ? "" : "s"}</p>
            </div>
          </div>

          {monitor ? <BlueDeskMarketReader observations={observations} /> : (
            <div className={styles.secondaryPanel} role="status">
              <h3>Market observations unavailable</h3>
              <p className={styles.muted}>The provider did not return source-qualified observations.
                No value or session change has been inferred.</p>
            </div>
          )}

          <p className={styles.publicMarketNote}>
            Changes: rates in bp; others in %. Monthly yields show levels only. Dates are from sources; data may lag.
          </p>
        </section>

        {hormuz ? <HormuzCrossings monitor={hormuz} /> : null}

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
