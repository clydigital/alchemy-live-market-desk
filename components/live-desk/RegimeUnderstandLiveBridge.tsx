import Link from "next/link";

import type { UnderstandLiveBridge } from "@/lib/regime-understand-live-bridge";

import styles from "./regime-understand-live-bridge.module.css";

function displayDate(value: string | null) {
  if (!value) return "No timestamp";
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(parsed);
}

export default function RegimeUnderstandLiveBridge({
  bridge,
}: {
  bridge: UnderstandLiveBridge;
}) {
  return (
    <section className={styles.bridge}>
      <header className={styles.header}>
        <div>
          <small>UNDERSTAND → LIVE</small>
          <h3>{bridge.subgroupLabel}: structural mechanism to current evidence</h3>
          <p>
            The left side is the governed mechanism. The right side shows the current persisted interpretation and the exact test that would confirm or break it.
          </p>
        </div>
        <div className={styles.coverage}>
          <span>{bridge.coverage.telemetryCount} telemetry</span>
          <span>{bridge.coverage.liveReasoningCount} live hypotheses</span>
          <span>
            {bridge.coverage.observedEdgeCount + bridge.coverage.supportedEdgeCount} observed / supported edges
          </span>
        </div>
      </header>

      <div className={styles.flow}>
        <article className={styles.stage}>
          <small>01 / STRUCTURE</small>
          <strong>{bridge.structuralWhy}</strong>
          <p>{bridge.structuralMechanism}</p>
        </article>

        <div className={styles.arrow}>→</div>

        <article className={styles.stage}>
          <small>02 / CURRENT INTERPRETATION</small>
          {bridge.liveStory ? (
            <>
              <div className={styles.meta}>
                <span>{bridge.liveStory.storyTitle}</span>
                <span>{Math.round(bridge.liveStory.confidence)}% confidence</span>
                <span>{bridge.liveStory.decisionState.replaceAll("_", " ")}</span>
              </div>
              <strong>{bridge.liveStory.question}</strong>
              <p>{bridge.liveStory.mechanism}</p>
              <span className={styles.timestamp}>Updated {displayDate(bridge.liveStory.updatedAt)}</span>
            </>
          ) : (
            <p>No persisted primary hypothesis is available for a durable Story in this subgroup. The structural mechanism remains visible without a manufactured live explanation.</p>
          )}
        </article>

        <div className={styles.arrow}>→</div>

        <article className={styles.stage}>
          <small>03 / WHAT CHANGED NOW</small>
          {bridge.latestContribution ? (
            <>
              <div className={styles.meta}>
                <span>{bridge.latestContribution.state.replaceAll("_", " ")}</span>
                <span>{displayDate(bridge.latestContribution.timestamp)}</span>
              </div>
              <strong>{bridge.latestContribution.title}</strong>
              <p>{bridge.latestContribution.detail}</p>
              {bridge.latestContribution.href ? (
                <a href={bridge.latestContribution.href}>Open contribution →</a>
              ) : null}
            </>
          ) : (
            <p>No recent contribution node is available for this subgroup.</p>
          )}
        </article>

        <div className={styles.arrow}>→</div>

        <article className={styles.stage}>
          <small>04 / TEST THE READ</small>
          {bridge.nextTest ? (
            <>
              <div className={styles.meta}>
                <span>{bridge.nextTest.divergence} divergence</span>
              </div>
              <strong>{bridge.nextTest.question}</strong>
              {bridge.nextTest.expectedReaction ? (
                <p><b>Expected:</b> {bridge.nextTest.expectedReaction}</p>
              ) : null}
              {bridge.nextTest.observedReaction ? (
                <p><b>Observed:</b> {bridge.nextTest.observedReaction}</p>
              ) : null}
              <p><b>Research next:</b> {bridge.nextTest.researchNext}</p>
              <p><b>Confirm:</b> {bridge.nextTest.confirmationCondition}</p>
              <p><b>Invalidate:</b> {bridge.nextTest.invalidationCondition}</p>
            </>
          ) : (
            <p>No exact linked investigation is available. LIVE does not invent a test from unrelated market moves.</p>
          )}
        </article>
      </div>

      {bridge.liveStory?.causalChain.length ? (
        <div className={styles.liveEdges}>
          <div className={styles.edgeHeader}>
            <small>LIVE CAUSAL EDGES</small>
            <span>
              {bridge.coverage.inferredEdgeCount} inferred · {bridge.coverage.speculativeEdgeCount} speculative
            </span>
          </div>
          <div className={styles.edgeGrid}>
            {bridge.liveStory.causalChain.map((edge, index) => (
              <article data-evidence={edge.evidenceState} key={`${bridge.liveStory!.storyId}:edge:${index}`}>
                <strong>{edge.from}</strong>
                <span>→ {edge.relationship} →</span>
                <strong>{edge.to}</strong>
                <small>
                  {edge.evidenceState.replaceAll("_", " ")} · {edge.evidenceCount} evidence ref{edge.evidenceCount === 1 ? "" : "s"}
                </small>
              </article>
            ))}
          </div>
          <Link href={`/stories/${bridge.liveStory.storyId}`} className={styles.hiddenLink}>
            Open Story
          </Link>
        </div>
      ) : null}
    </section>
  );
}
