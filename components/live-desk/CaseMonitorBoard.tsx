import { enrichCaseMonitorBoard } from "@/lib/case-monitor-overlays";
import type { CaseMonitorBoard as CaseMonitorBoardData } from "@/lib/case-monitors";
import monitorStyles from "./case-monitor-board.module.css";

function localTime(value: string | null) {
  if (!value) return "Awaiting source update";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

export default async function CaseMonitorBoard({ board }: { board: CaseMonitorBoardData | null }) {
  const effectiveBoard = await enrichCaseMonitorBoard(board);
  if (!effectiveBoard) return null;
  return (
    <section className={monitorStyles.board} id="monitors">
      <header className={monitorStyles.header}>
        <div>
          <span className={monitorStyles.kicker}>QUESTION MONITOR</span>
          <h2>{effectiveBoard.stateLabel}</h2>
          <p>{effectiveBoard.summary}</p>
        </div>
        <div className={`${monitorStyles.state} ${monitorStyles[effectiveBoard.state]}`}>
          <span>{effectiveBoard.state.replaceAll("_", " ")}</span>
          <strong>{localTime(effectiveBoard.updatedAt)}</strong>
        </div>
      </header>

      <div className={monitorStyles.metrics}>
        {effectiveBoard.metrics.map((metric) => (
          <article className={`${monitorStyles.metric} ${monitorStyles[metric.state]}`} key={metric.id}>
            <div className={monitorStyles.metricTop}>
              <span>{metric.kind.replaceAll("_", " ")}</span>
              <small>{metric.cadence}</small>
            </div>
            <h3>{metric.label}</h3>
            <div className={monitorStyles.reading}>
              <strong>{metric.current || "Not populated"}</strong>
              {metric.previous ? <span>Prior {metric.previous}{metric.delta ? ` · Δ ${metric.delta}` : ""}</span> : null}
            </div>
            <p className={monitorStyles.question}>{metric.question}</p>
            <p>{metric.interpretation}</p>
            <dl>
              {metric.confirmationCondition ? <div><dt>Confirms when</dt><dd>{metric.confirmationCondition}</dd></div> : null}
              {metric.invalidationCondition ? <div><dt>Invalidates when</dt><dd>{metric.invalidationCondition}</dd></div> : null}
            </dl>
            <footer>
              <span>{metric.sourceName} · {localTime(metric.asOf)}</span>
              {metric.sourceUrl ? <a href={metric.sourceUrl} target="_blank" rel="noreferrer">SOURCE ↗</a> : null}
            </footer>
          </article>
        ))}
      </div>

      <div className={monitorStyles.signalSection}>
        <div className={monitorStyles.signalHead}>
          <div><span className={monitorStyles.kicker}>SOURCE WATCHES</span><h3>Statements, X, YouTube and research intake</h3></div>
          <p>These can move the case, but they do not overrule physical or statistical confirmation by themselves.</p>
        </div>
        <div className={monitorStyles.signals}>
          {effectiveBoard.signals.map((signal) => (
            <article key={signal.id}>
              <span>{signal.label} · {signal.kind}</span>
              <h4>{signal.headline}</h4>
              {signal.detail ? <p>{signal.detail}</p> : null}
              <small>{signal.sourceName} · {localTime(signal.asOf)}{signal.verification ? ` · ${signal.verification}` : ""}</small>
              {signal.sourceUrl ? <a href={signal.sourceUrl} target="_blank" rel="noreferrer">OPEN SOURCE ↗</a> : null}
            </article>
          ))}
        </div>
      </div>

      {effectiveBoard.gaps.length ? <div className={monitorStyles.gaps}>
        <span className={monitorStyles.kicker}>MONITOR COVERAGE GAPS</span>
        <p>{effectiveBoard.gaps.join(" · ")}</p>
      </div> : null}
    </section>
  );
}
