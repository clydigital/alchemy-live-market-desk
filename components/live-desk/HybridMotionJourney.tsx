import Link from "next/link";

import type { MarketMotionEditionItem } from "@/lib/market-motion-edition";

import styles from "./hybrid-motion-journey.module.css";

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

function sourceState(item: MarketMotionEditionItem) {
  if (item.verificationState === "VERIFIED") return "Verified";
  if (item.verificationState === "REPORTED") return "Reported";
  if (item.sourceKind === "creator") return "Creator lead";
  return item.verificationState.replaceAll("_", " ");
}

export default function HybridMotionJourney({
  items,
  capturedAt,
}: {
  items: MarketMotionEditionItem[];
  capturedAt: string | null;
}) {
  return (
    <section className={styles.section}>
      <header className={styles.header}>
        <div>
          <span>48H MARKET JOURNEY</span>
          <h2>Start with what actually changed</h2>
          <p>
            Fresh company, sector, macro and geopolitical motion first. Each hook then
            bridges into the larger Story or Regime only where Live has a canonical link.
          </p>
        </div>
        <div className={styles.capture}>
          <small>IMMUTABLE SNAPSHOT</small>
          <strong>{capturedAt ? shortDate(capturedAt) + " MYT" : "Unavailable"}</strong>
        </div>
      </header>

      {items.length ? (
        <div className={styles.timeline}>
          {items.map((item, index) => {
            const writingAngle = item.writingAngles[0] || null;
            const researchQuestion = item.researchQuestions[0] || item.nextTest;
            return (
              <article className={styles.step} key={item.id}>
                <div className={styles.rail}>
                  <span>{String(index + 1).padStart(2, "0")}</span>
                </div>

                <div className={styles.card}>
                  <div className={styles.meta}>
                    <span data-tier={item.attentionTier.toLowerCase()}>
                      {item.attentionTier} · {item.attentionScore}
                    </span>
                    <span>{item.category.replaceAll("_", " ")}</span>
                    <span>{sourceState(item)}</span>
                    <time dateTime={item.occurredAt}>{shortDate(item.occurredAt)} MYT</time>
                  </div>

                  <h3>{item.headline}</h3>

                  {item.tickers.length ? (
                    <div className={styles.tickers}>
                      {item.tickers.slice(0, 6).map((ticker) => <span key={ticker}>{ticker}</span>)}
                    </div>
                  ) : null}

                  <div className={styles.explanation}>
                    <div>
                      <small>WHAT HAPPENED</small>
                      <p>{item.whatHappened}</p>
                    </div>
                    <div>
                      <small>WHY IT IS INTERESTING</small>
                      <p>{item.whyInteresting}</p>
                    </div>
                  </div>

                  {item.marketReaction ? (
                    <div className={styles.tape}>
                      <small>TAPE</small>
                      <p>{item.marketReaction}</p>
                    </div>
                  ) : null}

                  <div className={styles.bridge}>
                    <small>BIG-PICTURE BRIDGE</small>
                    <strong>{item.bigPictureBridge}</strong>
                  </div>

                  {(writingAngle || item.writingPotential !== "LOW") ? (
                    <div className={styles.angle}>
                      <small>WRITING ANGLE · {item.writingPotential}</small>
                      <p>{writingAngle || "This hook has enough asset/company specificity to consider for a COTD or short market note."}</p>
                    </div>
                  ) : null}

                  {researchQuestion ? (
                    <div className={styles.research}>
                      <small>RESEARCH NEXT</small>
                      <p>{researchQuestion}</p>
                    </div>
                  ) : null}

                  <footer>
                    <div className={styles.links}>
                      {item.storySlug && item.storyTitle ? (
                        <Link href={`/stories/${item.storySlug}`}>Story · {item.storyTitle}</Link>
                      ) : null}
                      {item.regimeSlug && item.regimeLabel ? (
                        <Link href={`/regimes/${item.regimeSlug}`}>Regime · {item.regimeLabel}</Link>
                      ) : null}
                    </div>
                    <a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.sourceName} ↗</a>
                  </footer>
                </div>
              </article>
            );
          })}
        </div>
      ) : (
        <div className={styles.empty}>
          No fresh Motion was captured in this immutable edition. Hybrid will not substitute Dossier prose for a missing 48-hour tape.
        </div>
      )}
    </section>
  );
}
