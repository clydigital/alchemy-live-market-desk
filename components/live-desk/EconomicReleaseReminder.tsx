import styles from "./economic-release-reminder.module.css";

export type OverviewEconomicRelease = {
  id: string;
  event: string;
  date: string;
  timeLabel: string;
  referencePeriod: string | null;
  status: "Scheduled" | "Released";
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  revisedPrevious: string | null;
  decidingQuestion: string;
  affectedAssets: string[];
  sourceName: string;
  sourceUrl: string;
};

type Props = {
  release: OverviewEconomicRelease | null;
};

function displayValue(value: string | null, fallback: string) {
  return value && value.trim() ? value : fallback;
}

function releaseDateLabel(date: string) {
  const parsed = new Date(`${date}T00:00:00+08:00`);
  if (Number.isNaN(parsed.getTime())) return date;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(parsed);
}

export default function EconomicReleaseReminder({ release }: Props) {
  if (!release) return null;

  const released = release.status === "Released" && Boolean(release.actual);

  return (
    <section className={styles.reminder} aria-label="Immediate high-impact economic release">
      <div className={styles.signal} aria-hidden="true"><span /></div>
      <div className={styles.main}>
        <header className={styles.header}>
          <div>
            <span className={styles.kicker}>Immediate economic release</span>
            <h2>{release.event}</h2>
          </div>
          <span className={styles.status} data-released={released ? "true" : "false"}>
            {released ? "Released" : "Awaiting release"}
          </span>
        </header>

        <div className={styles.schedule}>
          <strong>{releaseDateLabel(release.date)}</strong>
          <span>{release.timeLabel}</span>
          {release.referencePeriod ? <span>{release.referencePeriod}</span> : null}
          <span>High impact</span>
        </div>

        <div className={styles.values}>
          <div data-primary="true">
            <span>Actual</span>
            <strong>{displayValue(release.actual, "Awaiting release")}</strong>
          </div>
          <div>
            <span>Forecast</span>
            <strong>{displayValue(release.forecast, "Not loaded")}</strong>
          </div>
          <div>
            <span>Previous</span>
            <strong>{displayValue(release.previous, "Not loaded")}</strong>
            {release.revisedPrevious ? <small>Revised: {release.revisedPrevious}</small> : null}
          </div>
        </div>

        <div className={styles.footer}>
          <div>
            <span>Desk question</span>
            <p>{release.decidingQuestion}</p>
          </div>
          <div className={styles.assets}>
            {release.affectedAssets.slice(0, 6).map((asset) => <span key={asset}>{asset}</span>)}
          </div>
          <a href={release.sourceUrl} target="_blank" rel="noreferrer">{release.sourceName} ↗</a>
        </div>
      </div>
    </section>
  );
}
