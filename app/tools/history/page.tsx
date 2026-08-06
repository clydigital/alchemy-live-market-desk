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
      description="The History Cabinet begins as a route over existing Story updates and research-run records. Full thesis, vintage, correction and snapshot replay requires the persistence schema in PR 2 and PR 5."
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
          title="History is not yet fully reconstructable"
          detail="Current Story rows and macro release rows can still be overwritten. This route is a transparent view of existing records, not a claim that complete historical replay already exists."
        />

        <div className={styles.gridTwo}>
          <Panel title="Research-run ledger" description="Private run health is shown when the service-role view is available.">
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
              )) : <DataState title="Research-run ledger unavailable" detail="The private research_run_status view returned no rows in this environment." />}
            </div>
          </Panel>

          <Panel title="Current Story update history" description="These are the existing dated update rows, newest first.">
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
              }) : <DataState title="No Story updates returned" detail="The update table returned no history rows." />}
            </div>
          </Panel>
        </div>

        <Link className={styles.link} href="/legacy?tab=Ledger">Open the current legacy Ledger</Link>
      </div>
    </LiveDeskShell>
  );
}
