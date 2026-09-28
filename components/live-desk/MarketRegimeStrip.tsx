import Link from "next/link";

import type { ProjectedRegime } from "@/lib/regimes";

import styles from "./market-regime-strip.module.css";

function stateTone(regime: ProjectedRegime) {
  if (regime.stateKind === "unresolved") return "unresolved";
  if (/coverage gap/i.test(regime.state)) return "gap";
  return "active";
}

export default function MarketRegimeStrip({
  regimes,
}: {
  regimes: ProjectedRegime[];
}) {
  const others = regimes.filter((regime) => regime.slug !== "global-cost-of-capital");

  return (
    <section className={styles.section} aria-labelledby="other-market-regimes">
      <div className={styles.header}>
        <div>
          <span className={styles.kicker}>OTHER MARKET REGIMES</span>
          <h3 id="other-market-regimes">The structural stories behind the market</h3>
          <p>
            US rates are shown above because they are the highest-frequency macro regime. These are the other durable
            Regimes the Live Desk is currently tracking.
          </p>
        </div>
        <Link className={styles.allLink} href="/regimes">Open all Market Regimes →</Link>
      </div>

      <div className={styles.grid}>
        {others.map((regime) => (
          <Link className={styles.card} data-state={stateTone(regime)} href={`/regimes/${regime.slug}`} key={regime.slug}>
            <div className={styles.cardTop}>
              <span>{regime.shortTitle}</span>
              <b>{regime.state}</b>
            </div>
            <p>{regime.whyItMatters}</p>
            <div className={styles.meta}>
              <span>{regime.durableStories.length} durable</span>
              <span>{regime.contextStories.length} context</span>
            </div>
            {regime.latestNode ? (
              <div className={styles.latest}>
                <small>Latest contribution</small>
                <strong>{regime.latestNode.title}</strong>
              </div>
            ) : (
              <div className={styles.latest}>
                <small>Latest contribution</small>
                <strong>No current contribution yet</strong>
              </div>
            )}
          </Link>
        ))}
      </div>
    </section>
  );
}
