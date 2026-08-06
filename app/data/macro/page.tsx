import Link from "next/link";

import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import { Badge, DataState, formatDeskDate, MetricGrid, Panel } from "@/components/live-desk/LiveDeskUi";
import { getDeskData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function MacroDataPage() {
  const data = await getDeskData();
  const latestObservation = [...data.macroObservations]
    .sort((a, b) => Date.parse(b.observation_date) - Date.parse(a.observation_date))[0];

  return (
    <LiveDeskShell
      activePath="/data/macro"
      title="Macro Data"
      description="Current releases and observations are exposed without flattening mixed data into a single bullish or bearish label. Durable release vintages arrive in PR 2."
      meta={`Latest observation: ${formatDeskDate(latestObservation?.observation_date)}`}
    >
      <div className={styles.grid}>
        <MetricGrid
          items={[
            { value: data.macroReleases.length, label: "Release records" },
            { value: data.macroObservations.length, label: "Observations loaded" },
            { value: new Set(data.macroObservations.map((item) => item.series_key)).size, label: "Series represented" },
            { value: data.macroReleases.filter((item) => item.revised_previous).length, label: "Rows with revisions" },
          ]}
        />

        <DataState
          title="Vintage storage is not complete"
          detail="The current macro_releases row can hold actual, consensus, prior and revised prior, but it cannot reconstruct every initial and revised vintage. PR 2 will add additive release-event and vintage tables before any existing fields are retired."
        />

        <Panel
          title="Current release monitor"
          description="Values below come from the existing canonical loader. They are not copied from the static V8 mockup."
          action={<Link className={styles.link} href="/legacy?tab=Macro%20Data">Open legacy Macro module</Link>}
        >
          <div className={styles.recordList}>
            {data.macroReleases.length ? data.macroReleases.map((release) => (
              <article className={styles.record} key={release.id}>
                <div className={styles.recordHeader}>
                  <div>
                    <h3>{release.release_name}</h3>
                    <div className={styles.meta}>{release.agency} · {release.reference_period || "Period unavailable"} · {formatDeskDate(release.published_at || release.release_date)}</div>
                  </div>
                  <div className={styles.inlineMeta}>
                    <Badge>{release.status}</Badge>
                    <Badge tone={release.source_classification === "official" ? "ready" : "default"}>{release.source_classification}</Badge>
                  </div>
                </div>
                <div className={styles.gridThree}>
                  <div><span className={styles.metaLabel}>Actual</span><p>{release.actual ?? "Unavailable"}{release.unit ? ` ${release.unit}` : ""}</p></div>
                  <div><span className={styles.metaLabel}>Consensus</span><p>{release.consensus ?? "Unavailable"}</p></div>
                  <div><span className={styles.metaLabel}>Prior / revised</span><p>{release.previous ?? "Unavailable"}{release.revised_previous ? ` → ${release.revised_previous}` : ""}</p></div>
                </div>
                <p>{release.market_interpretation || release.watch_question}</p>
                <a className={styles.link} href={release.source_url} target="_blank" rel="noreferrer">Open source</a>
              </article>
            )) : (
              <DataState state="risk" title="No macro releases returned" detail="The macro release query is empty or unavailable. The page does not substitute prototype values." />
            )}
          </div>
        </Panel>
      </div>
    </LiveDeskShell>
  );
}
