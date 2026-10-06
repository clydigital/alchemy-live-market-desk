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
  regimeSlug: string | null;
  regimeLabel: string | null;
  regimeHref: string | null;
  regimeContributionState?: "ACCEPT" | "REFINE" | "PENDING" | null;
  regimeContributionMode?: "DIRECT" | "READ_THROUGH" | null;
  regimeContribution?: string | null;
  regimeContributionRationale?: string | null;
  regimeContributionNextTest?: string | null;
  regimeContributionEvidenceCount?: number;
  investigationHref?: string | null;
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

type MarketMotionRegimeRollupItem = {
  key: string;
  regimeLabel: string;
  regimeHref: string | null;
  directCount: number;
  readThroughCount: number;
  acceptCount: number;
  refineCount: number;
  evidenceCount: number;
  judgements: Array<{
    id: string;
    decision: "ACCEPT" | "REFINE";
    mode: "DIRECT" | "READ_THROUGH";
    conclusion: string;
  }>;
};

function buildMarketMotionRegimeRollup(
  items: MarketMotionOverviewItem[],
): MarketMotionRegimeRollupItem[] {
  const byRegime = new Map<string, MarketMotionRegimeRollupItem>();

  for (const item of items) {
    if (
      !item.regimeLabel
      || !item.regimeContribution
      || (item.regimeContributionState !== "ACCEPT" && item.regimeContributionState !== "REFINE")
      || (item.regimeContributionMode !== "DIRECT" && item.regimeContributionMode !== "READ_THROUGH")
    ) {
      continue;
    }

    const key = item.regimeSlug || item.regimeLabel;
    const regimeHref = item.regimeHref?.split("#")[0] ?? null;
    const current = byRegime.get(key) ?? {
      key,
      regimeLabel: item.regimeLabel,
      regimeHref,
      directCount: 0,
      readThroughCount: 0,
      acceptCount: 0,
      refineCount: 0,
      evidenceCount: 0,
      judgements: [],
    };

    if (item.regimeContributionMode === "DIRECT") current.directCount += 1;
    else current.readThroughCount += 1;

    if (item.regimeContributionState === "ACCEPT") current.acceptCount += 1;
    else current.refineCount += 1;

    current.evidenceCount += item.regimeContributionEvidenceCount ?? 0;
    current.judgements.push({
      id: item.id,
      decision: item.regimeContributionState,
      mode: item.regimeContributionMode,
      conclusion: item.regimeContribution,
    });
    byRegime.set(key, current);
  }

  return [...byRegime.values()].sort((left, right) =>
    right.directCount - left.directCount
    || right.judgements.length - left.judgements.length
    || left.regimeLabel.localeCompare(right.regimeLabel)
  );
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
        <span>{journeyMode ? "MOTION HYPOTHESIS" : "BIG-PICTURE BRIDGE"}</span>
        <strong>{item.bigPictureBridge}</strong>
      </div>

      {journeyMode && (item.regimeLabel || item.regimeContributionState) ? (
        <div
          className={styles.regimeContribution}
          data-state={(item.regimeContributionState || "PENDING").toLowerCase()}
        >
          <div className={styles.regimeContributionHead}>
            <div>
              <span>{item.regimeContributionMode === "READ_THROUGH" ? "DOSSIER READ-THROUGH" : "REGIME CONTRIBUTION"}</span>
              <strong>{item.regimeLabel || "Regime link pending"}</strong>
            </div>
            <em>
              {item.regimeContributionState === "ACCEPT"
                ? "ACCEPTED BY DOSSIER"
                : item.regimeContributionState === "REFINE"
                  ? "REFINED BY DOSSIER"
                  : "MOTION ONLY"}
            </em>
          </div>

          {item.regimeContribution ? (
            <p>
              <strong>{item.regimeContributionMode === "READ_THROUGH" ? "Regime read-through:" : "Contribution:"}</strong>{" "}
              {item.regimeContribution}
            </p>
          ) : (
            <p>
              This Motion is linked to the regime, but the current canonical Dossier has not
              accepted or refined it as a regime contribution yet.
            </p>
          )}

          {item.regimeContributionRationale ? (
            <p><strong>Why:</strong> {item.regimeContributionRationale}</p>
          ) : null}

          {item.regimeContributionMode === "READ_THROUGH" ? (
            <small>
              Story-routed Dossier judgement · shown as non-state Regime read-through only.
            </small>
          ) : null}

          {item.regimeContributionEvidenceCount ? (
            <small>
              {item.regimeContributionEvidenceCount} canonical evidence reference
              {item.regimeContributionEvidenceCount === 1 ? "" : "s"} support this Dossier judgement.
            </small>
          ) : null}

          {item.regimeContributionNextTest ? (
            <p>
              <strong>{item.regimeContributionMode === "READ_THROUGH" ? "Dossier next test:" : "Regime next test:"}</strong>{" "}
              {item.regimeContributionNextTest}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className={styles.utility}>
        <span>WRITING POTENTIAL · {item.writingPotential}</span>
        {item.attentionReasons.length ? <small>{item.attentionReasons.join(" · ")}</small> : null}
      </div>

      {item.nextTest ? (
        <p className={styles.next}>
          <strong>{journeyMode ? "Investigate / write next:" : "Next test:"}</strong> {item.nextTest}
        </p>
      ) : null}

      {journeyMode && item.investigationHref ? (
        <Link className={styles.investigationLink} href={item.investigationHref}>
          Open Motion investigation path →
        </Link>
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
  const regimeRollup = journeyMode ? buildMarketMotionRegimeRollup(items) : [];

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

      {journeyMode && regimeRollup.length ? (
        <div className={styles.regimeRollup}>
          <div className={styles.regimeRollupIntro}>
            <span>DOSSIER → REGIME ROLL-UP</span>
            <h3>What fresh Motion is contributing to the regime map</h3>
            <p>
              Only canonical Dossier ACCEPT/REFINE judgements appear here. Direct Regime routes
              stay separate from Story-routed read-through, and neither label turns raw Motion
              into evidence or a Regime state change by itself.
            </p>
          </div>

          <div className={styles.regimeRollupGrid}>
            {regimeRollup.map((regime) => (
              <article className={styles.regimeRollupCard} key={regime.key}>
                <div className={styles.regimeRollupHead}>
                  <div>
                    <span>REGIME</span>
                    <h4>
                      {regime.regimeHref
                        ? <Link href={regime.regimeHref}>{regime.regimeLabel}</Link>
                        : regime.regimeLabel}
                    </h4>
                  </div>
                  <strong>{regime.judgements.length} judged</strong>
                </div>

                <p className={styles.regimeRollupStats}>
                  {regime.directCount} direct · {regime.readThroughCount} read-through ·{" "}
                  {regime.acceptCount} accept · {regime.refineCount} refine
                  {regime.evidenceCount ? " · " + regime.evidenceCount + " evidence refs" : ""}
                </p>

                <div className={styles.regimeRollupJudgements}>
                  {regime.judgements.slice(0, 3).map((judgement) => (
                    <div data-mode={judgement.mode.toLowerCase()} key={judgement.id}>
                      <span>
                        {judgement.decision} ·{" "}
                        {judgement.mode === "DIRECT" ? "DIRECT REGIME ROUTE" : "STORY READ-THROUGH"}
                      </span>
                      <p>{judgement.conclusion}</p>
                    </div>
                  ))}
                </div>

                {regime.readThroughCount ? (
                  <small>
                    Story read-through is Dossier context only. It does not authorise Regime mutation.
                  </small>
                ) : null}
              </article>
            ))}
          </div>
        </div>
      ) : null}

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
