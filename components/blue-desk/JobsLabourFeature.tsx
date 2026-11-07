import type { JobsPublicProjection } from "@/lib/macro/jobs-public-projection";
import styles from "./JobsLabourFeature.module.css";

function signed(value: number, digits = 0) {
  return (value > 0 ? "+" : "") + value.toFixed(digits);
}
function releaseDate(value: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Date unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    day: "numeric", month: "short", year: "numeric", timeZone: "UTC",
  }).format(new Date(value));
}
function conditionMove(current: number, previous: number | null, unit: string) {
  if (previous === null) return "Prior reading unavailable";
  const delta = Math.round((current - previous) * 10) / 10;
  if (Math.abs(delta) < 0.05) return "Unchanged from previous month";
  return signed(delta, 1) + (unit === "%" ? " percentage points" : " hours") + " m/m";
}

export default function JobsLabourFeature({ data }: { data: JobsPublicProjection }) {
  return (
    <section className={styles.section} id="jobs-monitor" aria-labelledby="us-jobs-heading"
      data-us-jobs-status={data.status} data-us-jobs-source-vintage={data.sourceVintage ?? "unverified"}>
      <div className={styles.header}>
        <div>
          <p className={styles.kicker}>US LABOUR MARKET · OFFICIAL BLS</p>
          <h2 id="us-jobs-heading">Jobs: headline vs. reality</h2>
          <p>Compare payroll growth with industry breadth and worker conditions.
            A sector&apos;s net employment change is not gross hires or layoffs.</p>
        </div>
        <span className={styles.period}>{data.period ?? "Awaiting verified release"}</span>
      </div>

      {data.status === "ready" && data.headlineChangeK !== null ? <>
        <div className={styles.stats}>
          <div className={styles.stat}>
            <span>Headline nonfarm payrolls</span>
            <strong>{signed(data.headlineChangeK)}K</strong>
            <small>Net jobs · month on month</small>
          </div>
          <div className={styles.stat}>
            <span>Industry breadth</span>
            <strong>{data.growing}/{data.sectorCount}</strong>
            <small>{data.shrinking} contracting · {data.unchanged} unchanged</small>
          </div>
          <div className={styles.stat}>
            <span>Broad U-6 unemployment</span>
            <strong>{data.u6 ? data.u6.current.toFixed(1) + "%" : "—"}</strong>
            <small>{data.u6 ? conditionMove(data.u6.current, data.u6.previous, "%") : "Source missing"}</small>
          </div>
          <div className={styles.stat}>
            <span>Private-sector workweek</span>
            <strong>{data.weeklyHours ? data.weeklyHours.current.toFixed(1) + "h" : "—"}</strong>
            <small>{data.weeklyHours ? conditionMove(data.weeklyHours.current, data.weeklyHours.previous, "hours") : "Source missing"}</small>
          </div>
        </div>
        <div className={styles.insights}>
          <h3>Contradictions to investigate</h3>
          {data.divergences.length ? (
            <ul>
              {data.divergences.map(signal => <li key={signal.code}>
                <strong>{signal.finding}</strong>
                <span>{signal.nextTest}</span>
              </li>)}
            </ul>
          ) : <p>None of the defined divergence conditions were confirmed by this release.
            That does not prove the labour market is uniformly strong.</p>}
        </div>
        <details className={styles.details}>
          <summary>Explore all {data.sectorCount} major industries</summary>
          <div className={styles.tableScroll}>
            <table>
              <caption>Seasonally adjusted net employment change, thousands. Non-overlapping BLS major industries.</caption>
              <thead><tr><th scope="col">Industry</th><th scope="col">Monthly change</th></tr></thead>
              <tbody>{data.sectors.map(sector => <tr key={sector.seriesId}>
                <th scope="row">{sector.label}</th>
                <td data-direction={sector.changeK > 0 ? "up" : sector.changeK < 0 ? "down" : "flat"}>
                  {signed(sector.changeK, Number.isInteger(sector.changeK) ? 0 : 1)}K
                </td>
              </tr>)}</tbody>
            </table>
          </div>
          <p className={styles.reconciliation}>Sector total: {data.summedChangeK === null ? "unavailable" :
            signed(data.summedChangeK, 1) + "K"}; published headline: {signed(data.headlineChangeK)}K.
            Small differences arise from reporting precision.</p>
        </details>
      </> : <div className={styles.unavailable}>
        <strong>Data verification incomplete</strong>
        <p>{data.reason || "A source-verified snapshot is not available."}
          {" "}The system will not display an inferred employment breadth signal.</p>
      </div>}

      <footer className={styles.footer}>
        <span>Published {releaseDate(data.releasedAt)} · {data.sourceVintage === "original_archived_release"
          ? "Original BLS release, recovered after publication" :
          data.sourceVintage === "current_api_vintage"
            ? "Current BLS API vintage, subject to revisions" : "Source vintage unverified"}</span>
        {data.sourceUrl ? <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer">
          BLS release &amp; source tables ↗</a> : null}
        <span>{data.forecastState === "frozen"
          ? "Dated forecast source on record" : "No verified frozen pre-release forecast — no beat/miss claim"}</span>
      </footer>
    </section>
  );
}
