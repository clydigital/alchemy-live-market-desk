import type { PresenterCalendarEvent } from "@/lib/presenter-calendar";
import {
  projectEarningsWeekTiles,
  type EarningsTile,
  type EarningsTileEnrichment,
} from "@/lib/blue-desk-earnings-grid";
import { formatDualDeskTime } from "@/lib/blue-desk-time";
import styles from "./EarningsWeekGrid.module.css";

const SESSIONS = [
  { key: "bmo", label: "Before open" },
  { key: "amc", label: "After close" },
  { key: "unknown", label: "Time unconfirmed" },
] as const;

function mondayEt(now: Date) {
  const today = formatDualDeskTime(now)?.etDay ?? now.toISOString().slice(0, 10);
  const date = new Date(today + "T12:00:00Z");
  const offset = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - offset);
  return date;
}

function Tile({ tile }: { tile: EarningsTile }) {
  const badge = tile.ticker === "—" ? "?" : tile.ticker.slice(0, 2);
  return (
    <article className={styles.tile} data-earnings-ticker={tile.ticker}>
      <div className={styles.tileTop}>
        <span className={styles.monogram} aria-hidden="true">{badge}</span>
        <div className={styles.identity}>
          <strong>{tile.ticker}</strong>
          <span>{tile.name}</span>
        </div>
        {tile.impliedMove ? (
          <strong className={styles.move} title="Absolute options-implied move; not a directional forecast">
            ±{tile.impliedMove.absolutePct.toFixed(2)}%
          </strong>
        ) : null}
      </div>
      <div className={styles.tileFoot}>
        <span>{tile.official ? "Issuer listed" : "Provider date"}</span>
        <span>{tile.calendarDayBasis === "source_date_only" ? "Date only" : "ET day"}</span>
      </div>
      <a className={styles.source} href={tile.sourceUrl} target="_blank" rel="noreferrer">
        Source &amp; details
      </a>
    </article>
  );
}

/**
 * Data-driven Bluebelly Earnings Hub grid: new source records make new tiles.
 * BMO/AMC require separately evidenced release-session metadata. A confirmed
 * conference-call time never automatically becomes a results-release time.
 */
export default function EarningsWeekGrid({
  records,
  now,
  enrichments = {},
}: {
  records: PresenterCalendarEvent[];
  now: Date;
  enrichments?: Readonly<Record<string, EarningsTileEnrichment>>;
}) {
  const start = mondayEt(now);
  const tiles = projectEarningsWeekTiles(records, enrichments);
  const days = Array.from({ length: 5 }, (_, index) => {
    const date = new Date(start);
    date.setUTCDate(start.getUTCDate() + index);
    const day = date.toISOString().slice(0, 10);
    return {
      day,
      label: new Intl.DateTimeFormat("en-GB", { weekday: "long", timeZone: "UTC" }).format(date),
      number: new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }).format(date),
      records: tiles.filter((item) => item.calendarDay === day),
    };
  });
  const outside = tiles.filter((tile) => !days.some((day) => day.day === tile.calendarDay));
  const ranked = tiles.filter((tile) => tile.impliedMove).sort(
    (a, b) => (b.impliedMove?.absolutePct || 0) - (a.impliedMove?.absolutePct || 0),
  );

  return (
    <section className={styles.wrap} aria-label="Source-dated US earnings week in company tiles" data-earnings-grid="v1">
      <div className={styles.heading}>
        <h3>This week's earnings</h3>
        <p>US trading week · ET where the instant is known · no invented release hours</p>
      </div>
      <div className={styles.board}>
        {days.map((day) => (
          <section key={day.day} className={styles.day}>
            <div className={styles.dayHead}>
              <strong>{day.label}</strong>
              <span>{day.number}</span>
            </div>
            {SESSIONS.map((session) => {
              const inSession = day.records.filter((tile) => tile.session === session.key);
              return (
                <div key={session.key} className={styles.session} data-earnings-session={session.key}>
                  <h4>{session.label} <small>{inSession.length}</small></h4>
                  <div className={styles.tiles}>
                    {inSession.map((tile) => <Tile key={tile.id} tile={tile} />)}
                    {!inSession.length ? <span className={styles.empty}>—</span> : null}
                  </div>
                </div>
              );
            })}
          </section>
        ))}
      </div>
      {outside.length ? (
        <p className={styles.caveat}>Other source-dated records: {outside.map((tile) => tile.ticker).join(", ")}. See the complete source records below.</p>
      ) : null}
      {ranked.length ? (
        <section className={styles.ranking} aria-label="Expected options-implied moves">
          <h4>Expected move ranking · absolute, not directional</h4>
          <div className={styles.rankTiles}>{ranked.map((tile) => <Tile key={tile.id} tile={tile} />)}</div>
          <p className={styles.caveat}>Each percentage needs a separately dated options source and expiry. Missing estimates are omitted, not set to zero.</p>
        </section>
      ) : null}
      <p className={styles.caveat}>Unconfirmed release sessions remain unclassified even when an earnings conference call has a confirmed time. This is a selected watchlist, not a complete exchange-wide calendar.</p>
    </section>
  );
}
