import Link from "next/link";

import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import { Badge, DataState, formatDeskDate, MetricGrid, Panel } from "@/components/live-desk/LiveDeskUi";
import { getDeskData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function HistoryPage() {
  const data = await getDeskData();
  const failedRuns = data.researchRuns.filter((run) => run.status === "failed" || run.status === "blocked");

  return (
    <LiveDeskShell
      activePath="/tools/history"
      title="History"
      description="Dated Story updates and research-run records provide an inspectable record of what changed and when."
      meta={`${data.updates.length + data.researchRuns.length} loaded history records`}
    >
      <div className={styles.grid}>
        <MetricGrid
          items={[
            { value: data.updates.length, label: "Story updates" },
            { value: data.researchRuns.length, label: "Research runs" },
            { value: failedRuns.length, label: "Blocked or failed runs" },
            { value: data.evidence.length, label: "Active evidence rows" },
          ]}
        />

        <DataState
          title="Historical replay is currently partial"
          detail="This view preserves dated update and run records. Earlier versions of every mutable Story and release field are not yet available for complete point-in-time reconstruction."
        />

        <div className={styles.gridTwo}>
          <Panel title="Research-run ledger" description="Completed, blocked and failed research runs remain visible with their summaries and warnings.">
            <div className={styles.recordList}>
              {data.researchRuns.length ? data.researchRuns.map((run) => (
                <article className={styles.record} key={run.id}>
                  <div className={styles.recordHeader}>
                    <div>
                      <h3>{run.run_key}</h3>
                      <div className={styles.meta}>{run.schedule_slot} · {formatDeskDate(run.scheduled_for)}</div>
                    </div>
                    <Badge tone={run.status === "completed" ? "ready" : run.status === "failed" ? "risk" : "warn"}>{run.status}</Badge>
                  </div>
                  <p>{run.summary || `${run.candidates_kept} candidates kept, ${run.evidence_added} evidence links added and ${run.updates_published} updates published.`}</p>
                  {run.warnings.length ? <p>{run.warnings.join(" · ")}</p> : null}
                </article>
              )) : <DataState title="Research-run history is updating" detail="No private run records are available at the moment. Dated Story updates remain visible beside this panel." />}
            </div>
          </Panel>

          <Panel title="Current Story update history" description="Existing dated update rows, newest first.">
            <div className={styles.recordList}>
              {data.updates.length ? data.updates.map((update) => {
                const story = data.stories.find((candidate) => candidate.id === update.story_id);
                return (
                  <article className={styles.record} key={update.id}>
                    <div className={styles.recordHeader}>
                      <div>
                        {story ? <Link href={`/stories/${story.slug}`}><h3>{update.headline}</h3></Link> : <h3>{update.headline}</h3>}
                        <div className={styles.meta}>{formatDeskDate(update.observed_at || update.created_at)}{story ? ` · ${story.title}` : ""}</div>
                      </div>
                      <Badge>{update.update_type}</Badge>
                    </div>
                    {update.detail ? <p>{update.detail}</p> : null}
                  </article>
                );
              }) : <DataState title="No dated Story updates" detail="The current update feed has no retained rows." />}
            </div>
          </Panel>
        </div>

        <Link className={styles.link} href="/legacy?tab=Ledger">Open detailed research Ledger</Link>
      </div>
    </LiveDeskShell>
  );
}
