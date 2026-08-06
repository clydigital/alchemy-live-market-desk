import Link from "next/link";
import { redirect } from "next/navigation";

import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import { Badge, DataState, formatDeskDate, MetricGrid, Panel } from "@/components/live-desk/LiveDeskUi";
import { getDeskData } from "@/lib/data";
import { legacyTabRedirect } from "@/lib/live-desk/routes";

export const dynamic = "force-dynamic";

type PageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function Page({ searchParams }: PageProps) {
  const query = await searchParams;
  const tabValue = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  const legacyTarget = legacyTabRedirect(tabValue);

  if (legacyTarget) redirect(legacyTarget);
  if (tabValue) redirect(`/legacy?tab=${encodeURIComponent(tabValue)}`);

  const data = await getDeskData();
  const latestRun = data.researchRuns[0];
  const latestUpdate = data.updates[0];
  const topStories = data.stories.slice(0, 5);
  const latestChanges = data.updates.slice(0, 6);
  const priorityStatuses = new Set(["develop", "publish", "active"]);
  const marketContextCount = data.marketObservations.length;

  return (
    <LiveDeskShell
      activePath="/"
      title="Overview"
      description="Current research health, persistent Story state and exact record access in one operational view."
      meta={(
        <>
          <span className={styles.metaLabel}>Latest material record</span><br />
          {formatDeskDate(latestUpdate?.observed_at || latestUpdate?.created_at)}
        </>
      )}
    >
      <div className={styles.grid}>
        <MetricGrid
          items={[
            { value: data.stories.length, label: "Tracked Stories" },
            { value: data.sources.length, label: "Loaded sources" },
            { value: data.evidence.length, label: "Active evidence" },
            { value: data.charts.length, label: "Chart requests" },
          ]}
        />

        <div className={styles.gridTwo}>
          <Panel title="Research system status" description="Scheduled research health and current market context remain visible beside the editorial record.">
            <div className={styles.recordList}>
              {latestRun ? (
                <DataState
                  state={latestRun.status === "completed" ? "ready" : latestRun.status === "failed" ? "risk" : "warn"}
                  title={`${latestRun.schedule_slot} run: ${latestRun.status}`}
                  detail={`Scheduled ${formatDeskDate(latestRun.scheduled_for)}. ${latestRun.updates_published} Story updates published. ${latestRun.warnings.length} warning(s) recorded.`}
                />
              ) : (
                <DataState
                  title="Research-run status is updating"
                  detail="The latest private run record is not currently available. Story and evidence records remain accessible below."
                />
              )}
              <DataState
                state={marketContextCount ? "ready" : "warn"}
                title={marketContextCount ? "Market context loaded" : "Market context is updating"}
                detail={marketContextCount
                  ? `${marketContextCount} market observations are available. Heatmaps also use the live Market State model when reviewed cells have not been stored.`
                  : "Current market observations have not returned yet. The research record remains available while prices refresh."}
              />
            </div>
          </Panel>

          <Panel
            title="Persistent Story map"
            description="Current theses, affected assets and workflow state remain linked to their detailed research records."
            action={<Link className={styles.link} href="/stories">Open Stories</Link>}
          >
            <div className={styles.recordList}>
              {topStories.length ? topStories.map((story) => (
                <article className={styles.record} key={story.id}>
                  <div className={styles.recordHeader}>
                    <div>
                      <Link href={`/stories/${story.slug}`}><h3>{story.title}</h3></Link>
                      <div className={styles.meta}>{story.assets?.slice(0, 5).join(" · ") || "Assets not mapped"}</div>
                    </div>
                    <Badge tone={priorityStatuses.has(story.status) ? "ready" : "default"}>{story.status}</Badge>
                  </div>
                  <p>{story.thesis}</p>
                </article>
              )) : (
                <DataState state="risk" title="No Stories returned" detail="The Story feed returned no records. No illustrative Stories are inserted in its place." />
              )}
            </div>
          </Panel>
        </div>

        <Panel
          title="Latest material changes"
          description="Dated Story updates show what changed, what it affected and which thesis it belongs to."
          action={<Link className={styles.link} href="/whats-new">Open What’s New</Link>}
        >
          <div className={styles.recordList}>
            {latestChanges.length ? latestChanges.map((update) => {
              const story = data.stories.find((candidate) => candidate.id === update.story_id);
              return (
                <article className={styles.record} key={update.id}>
                  <div className={styles.recordHeader}>
                    <div>
                      <h3>{update.headline}</h3>
                      <div className={styles.meta}>{formatDeskDate(update.observed_at || update.created_at)}{story ? ` · ${story.title}` : ""}</div>
                    </div>
                    <Badge>{update.update_type}</Badge>
                  </div>
                  {update.detail ? <p>{update.detail}</p> : null}
                </article>
              );
            }) : (
              <DataState title="Update feed is quiet" detail="No dated update records are available at the moment. Existing Story records remain accessible." />
            )}
          </div>
        </Panel>
      </div>
    </LiveDeskShell>
  );
}
