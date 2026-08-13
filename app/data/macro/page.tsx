import Link from "next/link";

import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import { Badge, DataState, formatDeskDate, MetricGrid, Panel } from "@/components/live-desk/LiveDeskUi";
import { getDeskData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function MacroDataPage() {
  const data = await getDeskData();
  const ingestionGaps = data.macroReleases.filter((release) => ["released_pending_ingestion", "stale_error"].includes(release.status));
  const latestObservation = [...data.macroObservations]
    .sort((a, b) => Date.parse(b.observation_date) - Date.parse(a.observation_date))[0];

  return (
    <LiveDeskShell
      activePath="/data/macro"
      title="Macro Data"
      description="Current releases and observations remain separate so mixed evidence is not flattened into one bullish or bearish label."
      meta={`Latest observation: ${formatDeskDate(latestObservation?.observation_date)}`}
    >
      <div className={styles.grid}>
        <MetricGrid
          items={[
            { value: data.macroReleases.length, label: "Release records" },
            { value: data.macroObservations.length, label: "Observations loaded" },
            { value: new Set(data.macroObservations.map((item) => item.series_key)).size, label: "Series represented" },
            { value: data.macroReleases.filter((item) => item.revised_previous).length, label: "Rows with revisions" },
            { value: ingestionGaps.length, label: "Visible ingestion gaps" },
          ]}
        />

        {ingestionGaps.length ? (
          <DataState
            state="risk"
            title={`${ingestionGaps.length} past release${ingestionGaps.length === 1 ? "" : "s"} awaiting an official Actual`}
            detail="These events are no longer classified as upcoming. The missing value remains explicit until an official-source adapter persists it."
          />
        ) : null}

        <DataState
          title="Historical vintages are limited"
          detail="Current records show actual, consensus, prior and revised-prior values where available. Earlier publication vintages are not yet fully reconstructable."
        />

        <Panel
          title="Current release monitor"
          description="Verified release records, source links and market questions from the current research feed."
          action={<Link className={styles.link} href="/legacy?tab=Macro%20Data">Open detailed Macro module</Link>}
        >
          <div className={styles.recordList}>
            {data.macroReleases.length ? data.macroReleases.map((release) => {
              const metrics = data.macroReleaseMetrics.filter((metric) => metric.release_id === release.id);
              const gap = ["released_pending_ingestion", "stale_error"].includes(release.status);
              return (
              <article className={styles.record} key={release.id}>
                <div className={styles.recordHeader}>
                  <div>
                    <h3>{release.release_name}</h3>
                    <div className={styles.meta}>{release.agency} · {release.reference_period || "Period unavailable"} · {formatDeskDate(release.published_at || release.release_date)}</div>
                  </div>
                  <div className={styles.inlineMeta}>
                    <Badge tone={gap ? "risk" : release.status === "completed" ? "ready" : "default"}>{release.status.replaceAll("_", " ")}</Badge>
                    <Badge tone={release.source_classification === "official" ? "ready" : "default"}>{release.source_classification}</Badge>
                  </div>
                </div>
                <div className={styles.gridThree}>
                  <div><span className={styles.metaLabel}>Actual</span><p>{release.actual ?? "Unavailable"}{release.unit ? ` ${release.unit}` : ""}</p></div>
                  <div><span className={styles.metaLabel}>Consensus</span><p>{release.consensus ?? "Unavailable"}</p></div>
                  <div><span className={styles.metaLabel}>Prior / revised</span><p>{release.previous ?? "Unavailable"}{release.revised_previous ? ` → ${release.revised_previous}` : ""}</p></div>
                </div>
                {gap ? <DataState state="risk" title="Official Actual ingestion gap" detail={release.ingestion_gap_reason || "The scheduled time has passed but no verified Actual is stored."} /> : null}
                {metrics.length ? (
                  <div className={styles.gridThree}>
                    {metrics.map((metric) => (
                      <div key={metric.id}>
                        <span className={styles.metaLabel}>{metric.label} Â· {metric.transformation}</span>
                        <p>Actual {metric.actual ?? "Unavailable"}{metric.unit ? ` ${metric.unit}` : ""}</p>
                        <p>Consensus {metric.consensus ?? "Unavailable"} Â· Alchemy {metric.alchemy_expectation ?? "Unavailable"}</p>
                      </div>
                    ))}
                  </div>
                ) : null}
                <p>{release.market_interpretation || release.watch_question}</p>
                <a className={styles.link} href={release.source_url} target="_blank" rel="noreferrer">Open source</a>
              </article>
              );
            }) : (
              <DataState state="risk" title="Macro releases are updating" detail="No verified release records are available at the moment. No estimated values are inserted in their place." />
            )}
          </div>
        </Panel>
      </div>
    </LiveDeskShell>
  );
}
