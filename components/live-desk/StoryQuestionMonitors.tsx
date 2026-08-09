import type { StoryMonitor, StoryMonitorPack } from "@/lib/story-monitors";

import monitorStyles from "./story-question-monitors.module.css";

function stateClass(state: StoryMonitor["state"]) {
  if (state === "confirmed") return monitorStyles.confirmed;
  if (state === "not_confirmed") return monitorStyles.notConfirmed;
  if (state === "waiting") return monitorStyles.waiting;
  if (state === "unavailable") return monitorStyles.unavailable;
  return monitorStyles.mixed;
}

function Sparkline({ monitor }: { monitor: StoryMonitor }) {
  const points = monitor.series || [];
  if (points.length < 2) return null;
  const values = points.map((point) => point.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const coords = points.map((point, index) => {
    const x = points.length === 1 ? 50 : (index / (points.length - 1)) * 100;
    const y = 36 - ((point.value - min) / span) * 30;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  }).join(" ");
  return (
    <div className={monitorStyles.sparkWrap} aria-label={`${monitor.label} recent series`}>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" role="img">
        <line x1="0" y1="36" x2="100" y2="36" className={monitorStyles.sparkBase} />
        <polyline points={coords} className={monitorStyles.sparkLine} />
      </svg>
      <div className={monitorStyles.sparkMeta}>
        <span>{points[0]?.label || new Date(points[0].at).toLocaleDateString("en-GB")}</span>
        <span>{points.at(-1)?.label || new Date(points.at(-1)!.at).toLocaleDateString("en-GB")}</span>
      </div>
    </div>
  );
}

function MonitorCard({ monitor }: { monitor: StoryMonitor }) {
  return (
    <article className={`${monitorStyles.card} ${stateClass(monitor.state)}`}>
      <header>
        <div>
          <span className={monitorStyles.directness}>{monitor.directness === "direct" ? "DIRECT TEST" : "CONTEXT"} · {monitor.category.replaceAll("_", " ")}</span>
          <h4>{monitor.label}</h4>
        </div>
        <strong>{monitor.stateLabel}</strong>
      </header>
      <p className={monitorStyles.question}>{monitor.question}</p>
      <div className={monitorStyles.reading}>{monitor.current}</div>
      {(monitor.previous || monitor.baseline || monitor.delta) ? (
        <dl>
          {monitor.previous ? <div><dt>Previous</dt><dd>{monitor.previous}</dd></div> : null}
          {monitor.baseline ? <div><dt>Baseline</dt><dd>{monitor.baseline}</dd></div> : null}
          {monitor.delta ? <div><dt>Change</dt><dd>{monitor.delta}</dd></div> : null}
        </dl>
      ) : null}
      <Sparkline monitor={monitor} />
      <p className={monitorStyles.interpretation}>{monitor.interpretation}</p>
      <footer>
        <span>{monitor.observedAt ? new Date(monitor.observedAt).toLocaleString("en-GB", { timeZone: "Asia/Kuala_Lumpur", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: false }) : "Timestamp unavailable"}</span>
        {monitor.sourceUrl ? <a href={monitor.sourceUrl} target="_blank" rel="noreferrer">{monitor.sourceName} ↗</a> : <span>{monitor.sourceName}</span>}
      </footer>
      {monitor.freshnessNote ? <small>{monitor.freshnessNote}</small> : null}
    </article>
  );
}

export default function StoryQuestionMonitors({ pack }: { pack: StoryMonitorPack }) {
  const direct = pack.monitors.filter((monitor) => monitor.directness === "direct");
  const context = pack.monitors.filter((monitor) => monitor.directness === "context");
  return (
    <section className={monitorStyles.surface}>
      <div className={`${monitorStyles.assessment} ${stateClass(pack.assessment.state)}`}>
        <div>
          <span>QUESTION STATUS · {pack.assessment.label}</span>
          <h3>{pack.assessment.answer}</h3>
          <p>{pack.assessment.reason}</p>
        </div>
        <aside>
          <b>{pack.directMonitorCount}</b>
          <span>direct monitors</span>
          <small>{pack.sourceCount} source stream{pack.sourceCount === 1 ? "" : "s"}</small>
        </aside>
      </div>

      <div className={monitorStyles.grid}>
        {direct.map((monitor) => <MonitorCard key={monitor.id} monitor={monitor} />)}
      </div>

      {context.length ? (
        <details className={monitorStyles.contextDrawer}>
          <summary>Supporting statement, video and market context ({context.length})</summary>
          <div className={monitorStyles.grid}>{context.map((monitor) => <MonitorCard key={monitor.id} monitor={monitor} />)}</div>
        </details>
      ) : null}
    </section>
  );
}
