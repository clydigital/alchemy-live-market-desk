import type { RateEducationalProjection } from "@/lib/rate-regime-educational-projection";

import styles from "./rate-regime-educational-shell.module.css";

function formatBp(value: number | null) {
  if (value === null) return "n/a";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)} bp`;
}

function formatPct(value: number | null) {
  return value === null ? "n/a" : `${value.toFixed(2)}%`;
}

function formatMovePct(value: number | null) {
  if (value === null) return "n/a";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function formatUsdBn(value: number | null) {
  return value === null ? "n/a" : `${value.toFixed(1)}bn`;
}

function formatJpyBn(value: number | null) {
  if (value === null) return "n/a";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)} JPY bn`;
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

      {projection.longEnd ? (
        <article className={styles.longEnd}>
          <header>
            <div>
              <span className={styles.kicker}>WHY ARE LONG YIELDS MOVING? · OBSERVED FIRST</span>
              <h3>10Y nominal versus real yield and inflation compensation</h3>
            </div>
            <div className={styles.pathBadges}>
              <span>{projection.longEnd.observedState.replaceAll("_", " ")}</span>
              <span>Term premium: {projection.longEnd.termPremiumAvailability}</span>
            </div>
          </header>

          <div className={styles.decompositionGrid}>
            <div>
              <small>10Y NOMINAL</small>
              <strong>{formatPct(projection.longEnd.nominal10y.levelPct)}</strong>
              <span>{formatBp(projection.longEnd.nominal10y.change5dBp)} · 5D</span>
            </div>
            <div>
              <small>10Y REAL YIELD</small>
              <strong>{formatPct(projection.longEnd.real10y.levelPct)}</strong>
              <span>{formatBp(projection.longEnd.real10y.change5dBp)} · 5D</span>
            </div>
            <div>
              <small>10Y BREAKEVEN</small>
              <strong>{formatPct(projection.longEnd.breakeven10y.levelPct)}</strong>
              <span>{formatBp(projection.longEnd.breakeven10y.change5dBp)} · 5D</span>
            </div>
            <div>
              <small>UNASSIGNED RESIDUAL</small>
              <strong>{formatBp(projection.longEnd.residualBp)}</strong>
              <span>Not automatically “term premium”</span>
            </div>
          </div>

          <div className={styles.longEndNotes}>
            <p><strong>Observed decomposition:</strong> real yield + breakeven account for {formatBp(projection.longEnd.accountedChangeBp)} of the 10Y move when both are available.</p>
            <p><strong>Term premium:</strong> {projection.longEnd.termPremiumDetail}</p>
            <p><strong>Treasury market structure:</strong> {projection.longEnd.marketStructureDetail}</p>
            <p><strong>Volatility:</strong> {projection.longEnd.volatilityDetail}</p>
          </div>

          {projection.longEnd.gaps.length ? (
            <div className={styles.gaps}>
              <strong>Still missing</strong>
              {projection.longEnd.gaps.map((gap) => <span key={gap}>{gap}</span>)}
            </div>
          ) : null}
          <small>Observed components are System 1. Assigning the remaining move to supply, term premium, foreign demand or positioning requires specific evidence / System 2 reasoning. As of {dateLabel(projection.longEnd.asOf)}.</small>
        </article>
      ) : null}

      {projection.goldCrossCheck ? (
        <article className={styles.longEnd}>
          <header>
            <div>
              <span className={styles.kicker}>GOLD CROSS-CHECK · CANONICAL REACTION AUDIT</span>
              <h3>Real yields / dollar / gold after the current trigger</h3>
            </div>
            <div className={styles.pathBadges}>
              <span>{projection.goldCrossCheck.coverage.present}/3 legs observed</span>
            </div>
          </header>

          <div className={styles.decompositionGrid}>
            <div>
              <small>10Y REAL YIELD</small>
              <strong>{projection.goldCrossCheck.realYield10y ? formatPct(projection.goldCrossCheck.realYield10y.levelPct) : "Unresolved"}</strong>
              <span>{projection.goldCrossCheck.realYield10y ? `${formatBp(projection.goldCrossCheck.realYield10y.change5dBp)} · 5D` : "No canonical real-yield leg"}</span>
            </div>
            <div>
              <small>DXY REACTION</small>
              <strong>{projection.goldCrossCheck.dxyReaction ? projection.goldCrossCheck.dxyReaction.relation : "Unresolved"}</strong>
              <span>
                {projection.goldCrossCheck.dxyReaction
                  ? `Expected ${projection.goldCrossCheck.dxyReaction.expectedDirection.toLowerCase()} · observed ${projection.goldCrossCheck.dxyReaction.observedDirection.toLowerCase()} ${formatMovePct(projection.goldCrossCheck.dxyReaction.observedChangePct)} via ${projection.goldCrossCheck.dxyReaction.observedInstrument}`
                  : "No exact DXY post-trigger reaction attached"}
              </span>
            </div>
            <div>
              <small>GOLD REACTION</small>
              <strong>{projection.goldCrossCheck.goldReaction ? projection.goldCrossCheck.goldReaction.relation : "Unresolved"}</strong>
              <span>
                {projection.goldCrossCheck.goldReaction
                  ? `Expected ${projection.goldCrossCheck.goldReaction.expectedDirection.toLowerCase()} · observed ${projection.goldCrossCheck.goldReaction.observedDirection.toLowerCase()} ${formatMovePct(projection.goldCrossCheck.goldReaction.observedChangePct)} via ${projection.goldCrossCheck.goldReaction.observedInstrument}`
                  : "No exact gold post-trigger reaction attached"}
              </span>
            </div>
          </div>

          {projection.goldCrossCheck.coverage.missing.length ? (
            <div className={styles.gaps}>
              <strong>Still missing</strong>
              {projection.goldCrossCheck.coverage.missing.map((gap) => <span key={gap}>{gap}</span>)}
            </div>
          ) : null}

          <small>
            This cross-check only displays canonical System 1/Dossier observations. A real-yield, DXY and gold combination can test the textbook rates channel, but this presentation layer does not infer causality or fill a missing reaction leg.
          </small>
        </article>
      ) : null}

      {projection.globalDuration ? (
        <article className={styles.globalDuration}>
          <header>
            <div>
              <span className={styles.kicker}>GLOBAL DURATION / JAPAN / FOREIGN TREASURY DEMAND</span>
              <h3>Are U.S. rates moving alone?</h3>
            </div>
            <div className={styles.pathBadges}>
              <span>{projection.globalDuration.state.replaceAll("_", " ")}</span>
              <span>{projection.globalDuration.globalLabelEligible ? "GLOBAL LABEL CONFIRMED" : "US–JAPAN ONLY"}</span>
            </div>
          </header>

          <p>{projection.globalDuration.relative.detail}</p>

          <div className={styles.globalGrid}>
            <div className={styles.globalCard}>
              <small>JGB CURVE · DAILY</small>
              <strong>2Y {formatPct(projection.globalDuration.jgb.y2)} · 10Y {formatPct(projection.globalDuration.jgb.y10)} · 30Y {formatPct(projection.globalDuration.jgb.y30)}</strong>
              <span>5D: {formatBp(projection.globalDuration.jgb.change2y5dBp)} / {formatBp(projection.globalDuration.jgb.change10y5dBp)} / {formatBp(projection.globalDuration.jgb.change30y5dBp)}</span>
              <span>Source date {projection.globalDuration.jgb.asOf || "unresolved"}</span>
            </div>

            <div className={styles.globalCard}>
              <small>UST ↔ JGB GAP · COMPARABLE TENORS</small>
              <strong>10Y {formatBp(projection.globalDuration.relative.ustJgb10yBp)} · 30Y {formatBp(projection.globalDuration.relative.ustJgb30yBp)}</strong>
              <span>5D gap change: 10Y {formatBp(projection.globalDuration.relative.ustJgb10yChange5dBp)} · 30Y {formatBp(projection.globalDuration.relative.ustJgb30yChange5dBp)}</span>
            </div>

            <div className={styles.globalCard}>
              <small>USDJPY · DAILY</small>
              <strong>{projection.globalDuration.fx.usdJpy === null ? "n/a" : projection.globalDuration.fx.usdJpy.toFixed(3)}</strong>
              <span>{formatMovePct(projection.globalDuration.fx.change5dPct)} · 5D</span>
              <span>{projection.globalDuration.fx.detail}</span>
            </div>

            <div className={styles.globalCard}>
              <small>TIC JAPAN TREASURY HOLDINGS · MONTHLY</small>
              <strong>{formatUsdBn(projection.globalDuration.tic.japanHoldingsUsdBn)}</strong>
              <span>{projection.globalDuration.tic.direction.replaceAll("_", " ")} · monthly change {formatUsdBn(projection.globalDuration.tic.japanMonthlyChangeUsdBn)}</span>
              <span>Period {projection.globalDuration.tic.period || "unresolved"}</span>
            </div>

            <div className={styles.globalCard}>
              <small>JAPAN MOF OUTWARD LONG-TERM DEBT · WEEKLY</small>
              <strong>{formatJpyBn(projection.globalDuration.japanFlows.outwardLongTermDebtNetPurchaseJpyBn)}</strong>
              <span>{projection.globalDuration.japanFlows.direction.replaceAll("_", " ")}</span>
              <span>{projection.globalDuration.japanFlows.periodLabel || "Period unresolved"} · foreign long-term debt generally, not Treasury-specific</span>
            </div>
          </div>

          <div className={styles.comparability}>
            <strong>Do not merge these clocks.</strong>
            <p>{projection.globalDuration.comparabilityDetail}</p>
            {projection.globalDuration.tic.custodyAttributionCaveat ? (
              <small><strong>TIC attribution caveat:</strong> {projection.globalDuration.tic.custodyAttributionCaveat}</small>
            ) : null}
          </div>

          {!projection.globalDuration.globalLabelEligible ? (
            <small>Current evidence supports a U.S.–Japan rates comparison. A broader “global duration” label still needs comparable Bund and gilt confirmation.</small>
          ) : null}

          {projection.globalDuration.gaps.length ? (
            <div className={styles.gaps}>
              <strong>Still missing</strong>
              {projection.globalDuration.gaps.map((gap) => <span key={gap}>{gap}</span>)}
            </div>
          ) : null}

          <small>System 1 reports the observations and comparable-tenor spreads. Causal claims about repatriation, hedging, foreign demand or carry require the canonical Dossier / System 2. As of {dateLabel(projection.globalDuration.asOf)}.</small>
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
