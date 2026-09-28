import Link from "next/link";

import type { ProjectedRegime } from "@/lib/regimes";
import styles from "./regime-workspace.module.css";

function stateKindLabel(kind: ProjectedRegime["stateKind"]) {
  if (kind === "system1") return "System 1";
  if (kind === "interpreted") return "Story-led";
  return "Coverage gap";
}

export default function RegimeBoard({ regimes }: { regimes: ProjectedRegime[] }) {
  return (
    <div className={styles.board}>
      <div className={styles.cardGrid}>
        {regimes.map((regime) => (
          <article className={styles.card} key={regime.slug}>
            <div className={styles.cardBody}>
              <header className={styles.cardHead}>
                <div>
                  <span className={styles.kicker}>{stateKindLabel(regime.stateKind)} · {regime.confidence}</span>
                  <h2>{regime.title}</h2>
                </div>
                <span className={styles.state} data-kind={regime.stateKind}>{regime.state}</span>
              </header>

              <p className={styles.why}><strong>Why it matters:</strong> {regime.whyItMatters}</p>
              <p className={styles.mechanism}>{regime.mechanism}</p>

              <div className={styles.subgroupStrip}>
                {regime.subgroups.map((subgroup) => (
                  <Link
                    key={subgroup.key}
                    className={styles.subgroupPill}
                    data-accent={subgroup.accent}
                    href={`/regimes/${regime.slug}?subgroup=${subgroup.key}`}
                  >
                    {subgroup.label} <b>{subgroup.durableStories.length}</b>
                    {subgroup.contextStories.length ? <small> +{subgroup.contextStories.length} context</small> : null}
                  </Link>
                ))}
              </div>

              {regime.latestNode ? (
                <div className={styles.latest}>
                  <small>LATEST CONTRIBUTION · {regime.latestNode.state.replaceAll("_", " ")}</small>
                  <strong>{regime.latestNode.title}</strong>
                  <p className={styles.summary}>{regime.latestNode.detail}</p>
                </div>
              ) : null}

              <div className={styles.linkRow}>
                <Link href={`/regimes/${regime.slug}`}>Open Regime →</Link>
                <Link href={regime.hybridHref}>Explain in Hybrid →</Link>
              </div>
            </div>
            <footer className={styles.cardFooter}>
              <span>{regime.durableStories.length} durable · {regime.contextStories.length} context/coverage</span>
              <span>{regime.asOf ? `Updated ${new Date(regime.asOf).toLocaleString("en-GB", { timeZone: "Asia/Kuala_Lumpur", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}` : "No current timestamp"}</span>
            </footer>
          </article>
        ))}
      </div>
    </div>
  );
}
