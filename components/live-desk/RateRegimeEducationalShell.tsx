import type { RateEducationalProjection } from "@/lib/rate-regime-educational-projection";

import styles from "./rate-regime-educational-shell.module.css";

function formatBp(value: number | null) {
  if (value === null) return "n/a";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)} bp`;
}

function formatPct(value: number | null) {
  return value === null ? "n/a" : `${value.toFixed(2)}%`;
}

function dateLabel(value: string | null) {
  if (!value) return "No current timestamp";
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export default function RateRegimeEducationalShell({
  projection,
  compact = false,
}: {
  projection: RateEducationalProjection;
  compact?: boolean;
}) {
  return (
    <section className={styles.shell} data-compact={compact ? "true" : "false"}>
      <header className={styles.header}>
        <div>
          <span className={styles.kicker}>{projection.displayLabel} · EDUCATIONAL READ</span>
          <h2>What is happening, why it matters, and what changes the view</h2>
        </div>
        <div className={styles.meta}>
          <span>{projection.contractVersion}</span>
          <span>{projection.dossierId ? `Dossier ${projection.dossierId.slice(0, 8)}` : "No Dossier ID"}</span>
          <span>As of {dateLabel(projection.asOf)}</span>
        </div>
      </header>

      <article className={styles.quick}>
        <div className={styles.quickHead}>
          <span className={styles.kicker}>QUICK READ · 10 SECOND VERSION</span>
          {projection.dominantDriver ? <b>{projection.dominantDriver.subgroupLabel}</b> : <b>Driver unresolved</b>}
        </div>
        {projection.quickRead.map((sentence, index) => <p key={index}>{sentence}</p>)}
      </article>

      <div className={styles.grid}>
        <article className={styles.catalyst}>
          <span className={styles.kicker}>{projection.latestCatalyst?.interpretationPending ? "LATEST OBSERVED RATE INPUT" : "LATEST RATE CATALYST"}</span>
          {projection.latestCatalyst ? (
            <>
              <h3>{projection.latestCatalyst.title}</h3>
              <p>{projection.latestCatalyst.detail}</p>
              <div className={styles.meta}>
                <span>{projection.latestCatalyst.state.replaceAll("_", " ")}</span>
                <span>{dateLabel(projection.latestCatalyst.timestamp)}</span>
              </div>
              {projection.latestCatalyst.interpretationPending ? (
                <small>Observed input only. The canonical Dossier has not yet accepted a causal interpretation for this item.</small>
              ) : null}
            </>
          ) : (
            <p>No canonical rates catalyst is currently attached to this Regime.</p>
          )}
        </article>

        <article className={styles.test}>
          <span className={styles.kicker}>WHAT WOULD CHANGE THE READ?</span>
          {projection.currentTest ? (
            <>
              <div className={styles.testHead}>
                <h3>{projection.currentTest.question}</h3>
                <b>{projection.currentTest.divergence} divergence</b>
              </div>
              <p><strong>Confirm:</strong> {projection.currentTest.confirmationCondition}</p>
              <p><strong>Invalidate:</strong> {projection.currentTest.invalidationCondition}</p>
              <p><strong>Research next:</strong> {projection.currentTest.researchNext}</p>
              <small>{projection.currentTest.candidateCount} structured mechanism candidate{projection.currentTest.candidateCount === 1 ? "" : "s"} in the canonical Dossier.</small>
            </>
          ) : (
            <p>No exact linked rates investigation is active. The shell will not manufacture a confirmation or invalidation test.</p>
          )}
        </article>
      </div>

      <article className={styles.explanation}>
        <header>
          <span className={styles.kicker}>WHY THIS IS HAPPENING · ADAPTIVE EXPLANATION</span>
          <small>Canonical explanation only — no new research is run here.</small>
        </header>
        <div className={styles.explanationGrid}>
          {projection.adaptiveExplanation.map((item, index) => (
            <div className={styles.explanationStep} key={item.key}>
              <b>{String(index + 1).padStart(2, "0")}</b>
              <div>
                <strong>{item.label}</strong>
                <p>{item.text}</p>
              </div>
            </div>
          ))}
        </div>
      </article>

      {projection.ratePath ? (
        <article className={styles.ratePath}>
          <header>
            <div>
              <span className={styles.kicker}>RATE PATH DIAGNOSTIC · SYSTEM 1</span>
              <h3>Front end versus long end</h3>
            </div>
            <div className={styles.pathBadges}>
              <span>{projection.ratePath.moveClass.replaceAll("_", " ")}</span>
              <span>{projection.ratePath.separationState.replaceAll("_", " ")}</span>
            </div>
          </header>
          <p>{projection.ratePath.detail}</p>
          <div className={styles.curveGrid}>
            {projection.ratePath.points.map((point) => (
              <div className={styles.curvePoint} key={point.maturity}>
                <small>{point.maturity}</small>
                <strong>{formatPct(point.yieldPct)}</strong>
                <span>{formatBp(point.change5dBp)} · 5D</span>
              </div>
            ))}
          </div>
          <div className={styles.spreadGrid}>
            {projection.ratePath.spreads.map((spread) => (
              <div className={styles.spread} key={spread.key}>
                <strong>{spread.key}</strong>
                <span>{formatBp(spread.bps)}</span>
                <small>{spread.change5dBp === null ? "No 5D slope change" : `${formatBp(spread.change5dBp)} 5D slope change`}</small>
              </div>
            ))}
          </div>
          <small>
            Front end {projection.ratePath.frontEndDirection.toLowerCase()} ({formatBp(projection.ratePath.frontEndChange5dBp)}) · long end {projection.ratePath.longEndDirection.toLowerCase()} ({formatBp(projection.ratePath.longEndAverageChange5dBp)} average) · as of {dateLabel(projection.ratePath.asOf)}.
          </small>
        </article>
      ) : null}

      <article className={styles.board}>
        <header>
          <span className={styles.kicker}>WHAT THE MARKET IS SAYING</span>
          <small>Each row keeps its own freshness and ownership.</small>
        </header>
        <div className={styles.boardGrid}>
          {projection.stateBoard.map((row) => (
            <div className={styles.row} key={row.key}>
              <div className={styles.rowHead}>
                <strong>{row.label}</strong>
                <span data-kind={row.stateKind}>{row.state}</span>
              </div>
              <p>{row.detail}</p>
              <small>{row.stateKind === "system1" ? "System 1" : row.stateKind === "interpreted" ? "System 2 / Story" : "Unresolved"} · {row.source} · {dateLabel(row.asOf)}</small>
            </div>
          ))}
        </div>
      </article>

      {!compact && projection.education ? (
        <article className={styles.education}>
          <span className={styles.kicker}>EXPLAIN LIKE I’M NEW TO BONDS</span>
          <p>{projection.education.plainEnglish}</p>
          <small><strong>Structural counterfactual:</strong> {projection.education.counterfactual}</small>
        </article>
      ) : null}
    </section>
  );
}
