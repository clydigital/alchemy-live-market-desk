import Link from "next/link";

import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import { Badge, DataState, MetricGrid, Panel } from "@/components/live-desk/LiveDeskUi";
import { getDeskData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ChartsPage() {
  const data = await getDeskData();
  const linked = data.charts.filter((chart) => chart.story_id).length;
  const complete = data.charts.filter((chart) => /complete|ready|done/i.test(chart.status)).length;
  const storyById = new Map(data.stories.map((story) => [story.id, story]));

  return (
    <LiveDeskShell
      activePath="/tools/charts"
      title="Charts"
      description="A lightweight, Story-linked chart catalogue. PR 1 surfaces current chart requests and missing metadata without adding unverified EMA overlays or prototype values."
      meta={`${data.charts.length} chart requests loaded`}
    >
      <div className={styles.grid}>
        <MetricGrid
          items={[
            { value: data.charts.length, label: "Chart requests" },
            { value: linked, label: "Linked to Stories" },
            { value: complete, label: "Marked complete" },
            { value: data.charts.filter((chart) => !chart.story_id).length, label: "Unlinked requests" },
          ]}
        />

        <DataState
          title="Chart-definition lineage is incomplete"
          detail="Current requests record instrument, timeframe, overlay and analytical question. PR 4 must add source series, formula, lookback, verification time, stale state, methodology version and article usage before derived charts are fully auditable."
        />

        <Panel
          title="Current chart request library"
          description="The route preserves real analyst requests. One shared expanded chart stage and category catalogue remain later implementation work."
          action={<Link className={styles.link} href="/legacy?tab=Charts">Open legacy Charts</Link>}
        >
          <div className={styles.recordList}>
            {data.charts.length ? data.charts.map((chart) => {
              const story = chart.story_id ? storyById.get(chart.story_id) : undefined;
              return (
                <article className={styles.record} key={chart.id}>
                  <div className={styles.recordHeader}>
                    <div>
                      <h3>{chart.instrument} · {chart.timeframe}</h3>
                      <div className={styles.meta}>{story ? story.title : "No Story linked"}</div>
                    </div>
                    <Badge tone={/complete|ready|done/i.test(chart.status) ? "ready" : /blocked|failed/i.test(chart.status) ? "risk" : "warn"}>{chart.status}</Badge>
                  </div>
                  <p>{chart.question}</p>
                  <div className={styles.gridThree}>
                    <div><span className={styles.metaLabel}>Overlay</span><p>{chart.overlay || "None recorded"}</p></div>
                    <div><span className={styles.metaLabel}>Confirmation</span><p>{chart.confirmation_area || "Not recorded"}</p></div>
                    <div><span className={styles.metaLabel}>Invalidation</span><p>{chart.invalidation_area || "Not recorded"}</p></div>
                  </div>
                </article>
              );
            }) : (
              <DataState state="risk" title="No chart requests returned" detail="The chart request query returned no records. The route does not insert mock charts." />
            )}
          </div>
        </Panel>
      </div>
    </LiveDeskShell>
  );
}
