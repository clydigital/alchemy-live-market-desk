import Link from "next/link";

import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import { Badge, DataState, MetricGrid, Panel } from "@/components/live-desk/LiveDeskUi";
import { getDeskData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HeatmapsPage() {
  const data = await getDeskData();
  const sectors = new Set(data.marketStateRecords.map((item) => item.sector));

  return (
    <LiveDeskShell
      activePath="/data/heatmaps"
      title="Heatmaps"
      description="Market-state, breadth and historical context belong in one destination. PR 1 exposes loader health before adding percentile and drill-down logic."
      meta={`${data.marketStateRecords.length} market-state records returned`}
    >
      <div className={styles.grid}>
        <MetricGrid
          items={[
            { value: data.marketStateRecords.length, label: "State records" },
            { value: sectors.size, label: "Sectors represented" },
            { value: data.marketObservations.length, label: "Market observations" },
            { value: data.marketStateRecords.filter((item) => item.freshness_status === "stale").length, label: "Marked stale" },
          ]}
        />

        {!data.marketStateRecords.length ? (
          <DataState
            state="risk"
            title="Market-state ledger unavailable"
            detail="The current Live loader requests market_state_ledger, but no relation or rows were returned during the audit. PR 1 shows that gap explicitly instead of rendering an empty heatmap as a valid zero state."
          />
        ) : null}

        <Panel
          title="Current market-state records"
          description="No percentile is calculated unless sufficient history exists. Current records remain visible as raw state entries."
          action={<Link className={styles.link} href="/legacy?tab=Market%20State">Open legacy Market State</Link>}
        >
          <div className={styles.recordList}>
            {data.marketStateRecords.length ? data.marketStateRecords.map((item) => (
              <article className={styles.record} key={item.id}>
                <div className={styles.recordHeader}>
                  <div>
                    <h3>{item.sector}: {item.sub_industry}</h3>
                    <div className={styles.meta}>{item.module_key} · {item.source_name}</div>
                  </div>
                  <div className={styles.inlineMeta}>
                    <Badge tone={item.freshness_status === "stale" ? "warn" : "ready"}>{item.freshness_status || "unknown freshness"}</Badge>
                    <Badge>{item.direction}</Badge>
                  </div>
                </div>
                <p>{item.evidence_summary}</p>
                <div className={styles.gridTwo}>
                  <div><span className={styles.metaLabel}>Risk</span><p>{item.risk}</p></div>
                  <div><span className={styles.metaLabel}>Boon</span><p>{item.boon}</p></div>
                </div>
              </article>
            )) : (
              <DataState title="No state cells available" detail={`${data.marketObservations.length} market observations remain loaded, but the state ledger required to classify them is unavailable.`} />
            )}
          </div>
        </Panel>
      </div>
    </LiveDeskShell>
  );
}
