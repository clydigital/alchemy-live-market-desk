import Link from "next/link";

import type {
  MarketMotionLifecycleState,
  MarketMotionVerificationState,
} from "@/lib/market-motion";

import styles from "./market-motion-overview.module.css";

export type MarketMotionOverviewItem = {
  id: string;
  headline: string;
  category: string;
  lifecycleState: MarketMotionLifecycleState;
  verificationState: MarketMotionVerificationState;
  whatHappened: string;
  marketReaction: string | null;
  whyInteresting: string;
  bigPictureBridge: string;
  nextTest: string | null;
  tickers: string[];
  occurredAt: string;
  sourceName: string;
  sourceUrl: string;
  storyTitle: string | null;
  storyHref: string | null;
  regimeLabel: string | null;
  regimeHref: string | null;
};

function shortDate(value: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "Time unresolved";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
}

function verificationTone(value: MarketMotionVerificationState) {
  if (value === "VERIFIED") return "verified";
  if (value === "CONTRADICTED") return "contradicted";
  if (value === "PARTIAL" || value === "UNRESOLVED") return "partial";
  return "reported";
}

export default function MarketMotionOverview({
  items,
  eyebrow = "MARKET MOTION",
  title = "What moved the story today?",
  description = "Fresh hooks only. Motion can confirm, challenge or test a durable Story, but it does not become the Story by itself.",
  emptyText = "No fresh Motion item has cleared the Live contract yet. The desk will not manufacture a hook from stale or unverified headlines.",
  showFullTapeLink = true,
}: {
  items: MarketMotionOverviewItem[];
  eyebrow?: string;
  title?: string;
  description?: string;
  emptyText?: string;
  showFullTapeLink?: boolean;
}) {
  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <div>
          <span>{eyebrow}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
        {showFullTapeLink ? <Link href="/whats-new">Open full motion tape →</Link> : null}
      </header>

      {items.length ? (
        <div className={styles.grid}>
          {items.map((item) => (
            <article className={styles.card} key={item.id}>
              <div className={styles.meta}>
                <span>{item.category.replaceAll("_", " ")}</span>
                <span data-state={item.lifecycleState.toLowerCase()}>{item.lifecycleState}</span>
                <span data-verification={verificationTone(item.verificationState)}>{item.verificationState}</span>
                <time dateTime={item.occurredAt}>{shortDate(item.occurredAt)} MYT</time>
              </div>

              <h3>{item.headline}</h3>

              {item.tickers.length ? (
                <div className={styles.tickers}>
                  {item.tickers.slice(0, 5).map((ticker) => <span key={ticker}>{ticker}</span>)}
                </div>
              ) : null}

              <div className={styles.body}>
                <p><strong>What happened:</strong> {item.whatHappened}</p>
                {item.marketReaction ? <p><strong>Reaction:</strong> {item.marketReaction}</p> : null}
                <p><strong>Why it matters:</strong> {item.whyInteresting}</p>
              </div>

              <div className={styles.bridge}>
                <span>BIG-PICTURE BRIDGE</span>
                <strong>{item.bigPictureBridge}</strong>
              </div>

              {item.nextTest ? (
                <p className={styles.next}><strong>Next test:</strong> {item.nextTest}</p>
              ) : null}

              <footer>
                <div className={styles.links}>
                  {item.storyHref && item.storyTitle ? <Link href={item.storyHref}>Story · {item.storyTitle}</Link> : null}
                  {item.regimeHref && item.regimeLabel ? <Link href={item.regimeHref}>Regime · {item.regimeLabel}</Link> : null}
                </div>
                <a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.sourceName} ↗</a>
              </footer>
            </article>
          ))}
        </div>
      ) : (
        <div className={styles.empty}>{emptyText}</div>
      )}
    </section>
  );
}
