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

function ageLabel(value: string | null) {
  if (!value) return "source time unavailable";
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return value;
  const hours = Math.max(0, (Date.now() - time) / 36e5);
  if (hours < 1) return `${Math.max(1, Math.round(hours * 60))}m ago`;
  if (hours < 36) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function numberFrom(value: string | null) {
  if (!value) return null;
  const match = value.replaceAll(",", "").match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

function SnapshotSpark({ previous, current }: { previous: string | null; current: string | null }) {
  const a = numberFrom(previous);
  const b = numberFrom(current);
  if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
  const av = a as number;
  const bv = b as number;
  const min = Math.min(av, bv);
  const max = Math.max(av, bv);
  const span = max - min || Math.max(Math.abs(max), 1);
  const y = (value: number) => 30 - ((value - min) / span) * 22;
  return <svg className={monitorStyles.spark} viewBox="0 0 120 38" role="img" aria-label={`Prior ${previous}, now ${current}`}>
    <line x1="8" y1="31" x2="112" y2="31" />
    <polyline points={`12,${y(av)} 108,${y(bv)}`} />
    <circle cx="12" cy={y(av)} r="3" />
    <circle cx="108" cy={y(bv)} r="3" />
  </svg>;
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
            <div className={monitorStyles.snapshot}>
              <div><small>PRIOR SNAPSHOT</small><strong>{metric.previous || "—"}</strong></div>
              <span>→</span>
              <div><small>NOW · {ageLabel(metric.asOf)}</small><strong>{metric.current || "Not populated"}</strong>{metric.delta ? <em>Δ {metric.delta}</em> : null}</div>
              <SnapshotSpark previous={metric.previous} current={metric.current} />
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
          <p>These are context and contradiction monitors. They can change what the desk investigates, but they do not overrule physical or statistical confirmation by themselves.</p>
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
