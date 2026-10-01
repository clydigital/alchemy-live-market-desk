import Link from "next/link";

import type {
  MarketMotionAttentionTier,
  MarketMotionLifecycleState,
  MarketMotionVerificationState,
  MarketMotionWritingPotential,
} from "@/lib/market-motion";

import styles from "./market-motion-overview.module.css";

export type MarketMotionOverviewItem = {
  id: string;
  headline: string;
  category: string;
  lifecycleState: MarketMotionLifecycleState;
  verificationState: MarketMotionVerificationState;
  attentionTier: MarketMotionAttentionTier;
  attentionScore: number;
  writingPotential: MarketMotionWritingPotential;
  attentionReasons: string[];
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

function MotionCard({
  item,
  journeyMode = false,
}: {
  item: MarketMotionOverviewItem;
  journeyMode?: boolean;
}) {
  return (
    <article className={styles.card} key={item.id}>
      <div className={styles.meta}>
        <span data-attention={item.attentionTier.toLowerCase()}>
          {item.attentionTier} · {item.attentionScore}
        </span>
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
        {journeyMode ? (
          <>
            <p><strong>Why it matters:</strong> {item.whyInteresting}</p>
            {item.marketReaction ? <p><strong>Market reaction:</strong> {item.marketReaction}</p> : null}
          </>
        ) : (
          <>
            {item.marketReaction ? <p><strong>Reaction:</strong> {item.marketReaction}</p> : null}
            <p><strong>Why it matters:</strong> {item.whyInteresting}</p>
          </>
        )}
      </div>

      <div className={styles.bridge}>
        <span>BIG-PICTURE BRIDGE</span>
        <strong>{item.bigPictureBridge}</strong>
      </div>

      <div className={styles.utility}>
        <span>WRITING POTENTIAL · {item.writingPotential}</span>
        {item.attentionReasons.length ? <small>{item.attentionReasons.join(" · ")}</small> : null}
      </div>

      {item.nextTest ? (
        <p className={styles.next}>
          <strong>{journeyMode ? "Investigate / write next:" : "Next test:"}</strong> {item.nextTest}
        </p>
      ) : null}

      <footer>
        <div className={styles.links}>
          {item.storyHref && item.storyTitle ? <Link href={item.storyHref}>Story · {item.storyTitle}</Link> : null}
          {item.regimeHref && item.regimeLabel ? <Link href={item.regimeHref}>Regime · {item.regimeLabel}</Link> : null}
        </div>
        <a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.sourceName} ↗</a>
      </footer>
    </article>
  );
}

export default function MarketMotionOverview({
  items,
  eyebrow = "MARKET MOTION",
  title = "What moved the story today?",
  description = "Fresh hooks only. Motion can confirm, challenge or test a durable Story, but it does not become the Story by itself.",
  emptyText = "No fresh Motion item has cleared the Live contract yet. The desk will not manufacture a hook from stale or unverified headlines.",
  showFullTapeLink = true,
  journeyMode = false,
}: {
  items: MarketMotionOverviewItem[];
  eyebrow?: string;
  title?: string;
  description?: string;
  emptyText?: string;
  showFullTapeLink?: boolean;
  journeyMode?: boolean;
}) {
  const groups = [
    {
      tier: "PRIMARY" as const,
      title: "Primary Motion",
      description: "The developments most likely to change today's narrative, create an article angle, or demand immediate follow-up.",
      items: items.filter((item) => item.attentionTier === "PRIMARY"),
    },
    {
      tier: "SECONDARY" as const,
      title: "Secondary Motion",
      description: "Useful smaller developments and supporting details that add texture without dominating the current tape.",
      items: items.filter((item) => item.attentionTier === "SECONDARY"),
    },
  ].filter((group) => group.items.length);

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

      {items.length ? groups.map((group) => (
        <div className={styles.tierGroup} key={group.tier}>
          <div className={styles.tierHead}>
            <div>
              <span>{group.tier}</span>
              <h3>{group.title}</h3>
              <p>{group.description}</p>
            </div>
            <strong>{group.items.length}</strong>
          </div>
          <div className={styles.grid}>
            {group.items.map((item) => <MotionCard item={item} journeyMode={journeyMode} key={item.id} />)}
          </div>
        </div>
      )) : (
        <div className={styles.empty}>{emptyText}</div>
      )}
    </section>
  );
}
