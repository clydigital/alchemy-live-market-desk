import Link from "next/link";

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

export type OverviewReleaseStoryLink = {
  slug: string;
  title: string;
  reason: string;
};

type Props = {
  releases: OverviewEconomicRelease[];
  relatedStories?: OverviewReleaseStoryLink[];
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

export default function EconomicReleaseReminder({ releases, relatedStories = [] }: Props) {
  if (!releases.length) {
    return (
      <section className={styles.reminder} aria-label="Weekly high-impact economic events">
        <div className={styles.signal} aria-hidden="true"><span /></div>
        <div className={styles.main}>
          <header className={styles.header}>
            <div>
              <span className={styles.kicker}>Upcoming high-impact events · this week</span>
              <h2>Weekly economic risk calendar</h2>
            </div>
            <span className={styles.status}>Coverage check</span>
          </header>
          <p>No verified high-impact events were loaded for the current window. Calendar coverage may be incomplete.</p>
        </div>
      </section>
    );
  }

  return (
    <section className={styles.reminder} aria-label="Weekly high-impact economic events">
      <div className={styles.signal} aria-hidden="true"><span /></div>
      <div className={styles.main}>
        <header className={styles.header}>
          <div>
            <span className={styles.kicker}>Upcoming high-impact events · this week</span>
            <h2>Weekly economic risk calendar</h2>
          </div>
          <span className={styles.status}>{releases.length} event{releases.length === 1 ? "" : "s"}</span>
        </header>

        {releases.map((release) => {
          const released = release.status === "Released" && Boolean(release.actual);
          return (
            <article key={release.id}>
              <div className={styles.schedule}>
                <strong>{releaseDateLabel(release.date)}</strong>
                <span>{release.timeLabel}</span>
                {release.referencePeriod ? <span>{release.referencePeriod}</span> : null}
                <span>{released ? "Released" : "High impact"}</span>
              </div>

              <h3>{release.event}</h3>
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
            </article>
          );
        })}

        {relatedStories.length ? (
          <div className={styles.storyLinks}>
            <div>
              <span>Nearest event feeds into active Stories</span>
              <small>The nearest release is attached to the desk questions most likely to change when it lands.</small>
            </div>
            <div className={styles.storyLinkList}>
              {relatedStories.map((story) => (
                <Link href={`/stories/${story.slug}`} key={story.slug}>
                  <strong>{story.title}</strong>
                  <small>{story.reason}</small>
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
