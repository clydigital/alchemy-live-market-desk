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
      description="Audit the handoff from canonical Live Core records to the interpretative Hybrid layer. PR 1 exposes readiness gaps without claiming that immutable presentation snapshots already exist."
      meta={`${readyCoverage.length} evidence rooms currently marked ready`}
    >
      <div className={styles.grid}>
        <MetricGrid
          items={[
            { value: data.stories.length, label: "Available Stories" },
            { value: readyCoverage.length, label: "Evidence rooms ready" },
            { value: blockedCoverage.length, label: "Rooms incomplete" },
            { value: 0, label: "Immutable snapshots" },
          ]}
        />

        <DataState
          state="risk"
          title="Versioned Hybrid snapshot contract not installed"
          detail="Hybrid currently consumes current-state records and a Live feed. Historical editions cannot yet preserve included records, excluded records, source freshness, approval state and methodology version as one immutable object."
        />

        <div className={styles.gridTwo}>
          <Panel title="Current readiness view" description="This is an audit of existing evidence coverage, not a generated Hybrid edition.">
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
                  <p>{coverage.contradiction_count} contradiction(s), {coverage.unresolved_count} unresolved test(s), gate score {coverage.gate_score}.</p>
                </article>
              )) : (
                <DataState title="Coverage audit unavailable" detail="The story_evidence_coverage view returned no rows." />
              )}
            </div>
          </Panel>

          <Panel title="Required snapshot contract" description="PR 5 will add immutable snapshot and snapshot-item records after the persistence foundation is approved.">
            <div className={styles.recordList}>
              <article className={styles.record}><h3>Included and excluded records</h3><p>Every snapshot must record exact Live Core IDs and a reason for each inclusion or exclusion.</p></article>
              <article className={styles.record}><h3>Freshness and blocked fields</h3><p>Stale or unavailable source state must remain visible. Hybrid cannot fill a gap with a substitute narrative.</p></article>
              <article className={styles.record}><h3>Approval and reproducibility</h3><p>Generated time, methodology version, approval state and historical edition contents must remain immutable.</p></article>
            </div>
          </Panel>
        </div>

        <a className={styles.primaryButton} href="https://alchemy-hybrid-market-desk.vercel.app/overview" target="_blank" rel="noreferrer">Open current Hybrid Desk ↗</a>
      </div>
    </LiveDeskShell>
  );
}
