import Link from "next/link";
import { headers } from "next/headers";

import BlueDeskHeader from "@/components/blue-desk/BlueDeskHeader";
import MarketsMonitor from "@/components/live-desk/MarketsMonitor";
import { blueDeskPublicHref } from "@/lib/blue-desk-host";
import { getGlobalFlowMonitor } from "@/lib/global-flow-monitor";
import { getMarketMonitor } from "@/lib/market-monitor-public";
import styles from "@/app/blue-desk/blue-desk.module.css";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Markets Terminal | Blue Desk",
  description: "Read-only cross-asset prices, rates, flows and research diagnostics.",
};

/**
 * Full read-only Markets terminal, independently of interactive owner login.
 *
 * The only anonymous entry is /owner/markets on the canonical Live hostname.
 * Do not mount the owner operational shell: its navigation and research-status
 * controls have a separate access policy. MarketsMonitor itself is client-side
 * display, filtering and expansion only; it does not write to the backend.
 */
export default async function MarketsTerminalPage() {
  const host = (await headers()).get("host");
  const [monitor, flows] = await Promise.all([
    getMarketMonitor(),
    getGlobalFlowMonitor(),
  ]);

  return (
    <main className={styles.page} data-blue-desk-terminal="read-only">
      <BlueDeskHeader activePath="/blue-desk/markets" />
      <div className={styles.content}>
        <header className={styles.calendarHero}>
          <div>
            <p className={styles.kicker}>FULL CROSS-ASSET TERMINAL · READ ONLY</p>
            <h1>Markets terminal</h1>
            <p className={styles.heroDeck}>
              Source-dated prices, momentum, contradictions and physical flows.
              Research flags highlight what to investigate; they are not trading signals
              or canonical Story adjudications.
            </p>
          </div>
        </header>
        <MarketsMonitor monitor={monitor} flows={flows} />
        <footer className={styles.footer}>
          <span>Blue Desk</span>
          <Link href={blueDeskPublicHref("/blue-desk/markets", host)}>
            Source-only markets view →
          </Link>
        </footer>
      </div>
    </main>
  );
}
