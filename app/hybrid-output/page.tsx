import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import { Badge, DataState, MetricGrid, Panel } from "@/components/live-desk/LiveDeskUi";
import { getDeskData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HybridOutputPage() {
  const data = await getDeskData();
  const readyCoverage = data.evidenceCoverage.filter((item) => item.room_status === "ready");
  const blockedCoverage = data.evidenceCoverage.filter((item) => item.room_status !== "ready");

  return (
    <LiveDeskShell
      activePath="/hybrid-output"
      title="Hybrid Output"
      description="Review the handoff from canonical Live research records to the interpretative Hybrid experience."
      meta={`${readyCoverage.length} evidence rooms currently marked ready`}
    >
      <div className={styles.grid}>
        <MetricGrid
          items={[
            { value: data.stories.length, label: "Available Stories" },
            { value: readyCoverage.length, label: "Evidence rooms ready" },
            { value: blockedCoverage.length, label: "Rooms incomplete" },
            { value: 0, label: "Archived editions" },
          ]}
        />

        <DataState
          title="Historical Hybrid editions are not yet archived"
          detail="The current Hybrid Desk consumes current research records. Earlier editions cannot yet be replayed as complete, approved point-in-time packages."
        />

        <div className={styles.gridTwo}>
          <Panel title="Current readiness view" description="Evidence coverage for the Stories available to the current Hybrid experience.">
            <div className={styles.recordList}>
              {data.evidenceCoverage.length ? data.evidenceCoverage.map((coverage) => (
                <article className={styles.record} key={coverage.slug}>
                  <div className={styles.recordHeader}>
                    <div>
                      <h3>{coverage.title}</h3>
                      <div className={styles.meta}>{coverage.source_count} sources · {coverage.evidence_count} evidence records · {coverage.chart_count} charts</div>
                    </div>
                    <Badge tone={coverage.room_status === "ready" ? "ready" : "warn"}>{coverage.room_status}</Badge>
                  </div>
                  <p>{coverage.contradiction_count} contradiction(s), {coverage.unresolved_count} unresolved test(s), readiness score {coverage.gate_score}.</p>
                </article>
              )) : (
                <DataState title="Evidence coverage is updating" detail="No current coverage rows are available. Story records remain accessible from the main desk." />
              )}
            </div>
          </Panel>

          <Panel title="Edition integrity" description="What a durable historical Hybrid edition must retain.">
            <div className={styles.recordList}>
              <article className={styles.record}><h3>Included and excluded records</h3><p>Each edition should retain the exact Live records used and the reason for each inclusion or exclusion.</p></article>
              <article className={styles.record}><h3>Freshness and unavailable fields</h3><p>Stale or unavailable source state must remain visible rather than being replaced with a substitute narrative.</p></article>
              <article className={styles.record}><h3>Approval and reproducibility</h3><p>Generated time, methodology version, approval state and edition contents should remain fixed once published.</p></article>
            </div>
          </Panel>
        </div>

        <a className={styles.primaryButton} href="https://alchemy-hybrid-market-desk.vercel.app/overview" target="_blank" rel="noreferrer">Open current Hybrid Desk ↗</a>
      </div>
    </LiveDeskShell>
  );
}
