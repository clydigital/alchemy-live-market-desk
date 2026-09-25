import type { StockedUpEvidenceBriefV1, StockedUpEvidenceItem } from "@/lib/stockedup-evidence-brief";

import styles from "./stockedup-evidence-board.module.css";

function statusMeta(status: StockedUpEvidenceItem["status"]) {
  if (status === "VERIFIED") return { icon: "✓", label: "Verified", tone: "verified" };
  if (status === "PARTIAL") return { icon: "◐", label: "Partial", tone: "partial" };
  return { icon: "○", label: "Creator only", tone: "creator" };
}

function EvidenceColumn({
  title,
  subtitle,
  items,
}: {
  title: string;
  subtitle: string;
  items: StockedUpEvidenceItem[];
}) {
  return (
    <div className={styles.column}>
      <header>
        <strong>{title}</strong>
        <small>{subtitle}</small>
      </header>
      <div className={styles.list}>
        {items.length ? items.map((item) => {
          const meta = statusMeta(item.status);
          return (
            <article key={item.id} data-tone={meta.tone}>
              <div className={styles.itemHead}>
                <span data-tone={meta.tone}>{meta.icon} {meta.label}</span>
                {item.confidence !== null ? <small>{Math.round(item.confidence)}% evidence confidence</small> : null}
              </div>
              <h3>{item.title}</h3>
              <p>{item.detail}</p>
              <footer>
                {item.sourceName ? <span>{item.sourceName}</span> : null}
                {item.affectedAssets.length ? <span>{item.affectedAssets.slice(0, 6).join(" · ")}</span> : null}
              </footer>
            </article>
          );
        }) : <p className={styles.empty}>No items in this lane.</p>}
      </div>
    </div>
  );
}

export default function StockedUpEvidenceBoard({
  brief,
  compact = false,
}: {
  brief: StockedUpEvidenceBriefV1 | null;
  compact?: boolean;
}) {
  if (!brief) return null;

  return (
    <section className={styles.board} data-compact={compact ? "true" : "false"}>
      <header className={styles.boardHead}>
        <div>
          <span>UNDER THE SURFACE · CREATOR VERIFICATION</span>
          <h2>{brief.reportLabel}</h2>
          <p>{brief.summary}</p>
        </div>
        <div className={styles.counts}>
          <div><strong>{brief.verified.length}</strong><span>Verified</span></div>
          <div><strong>{brief.partial.length}</strong><span>Partial</span></div>
          <div><strong>{brief.creatorOnly.length}</strong><span>Creator-only</span></div>
        </div>
      </header>

      <div className={styles.columns}>
        <EvidenceColumn
          title="Canonical facts"
          subtitle="Allowed to strengthen Live reasoning"
          items={brief.verified}
        />
        <EvidenceColumn
          title="Still needs proof"
          subtitle="Useful context, blocked from canonical promotion"
          items={[...brief.partial, ...brief.creatorOnly]}
        />
      </div>
    </section>
  );
}
