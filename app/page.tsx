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

  return (
    <LiveDeskShell
      activePath="/"
      title="Overview"
      description="The V8 front door keeps research freshness, persistent Story state and exact record access visible without removing the existing operational workspace."
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
            { value: data.stories.length, label: "Active Stories" },
            { value: data.sources.length, label: "Loaded sources" },
            { value: data.evidence.length, label: "Active evidence" },
            { value: data.charts.length, label: "Chart requests" },
          ]}
        />

        <div className={styles.gridTwo}>
          <Panel title="Research system status" description="Operational health is shown explicitly rather than converted into an empty dashboard.">
            <div className={styles.recordList}>
              {latestRun ? (
                <DataState
                  state={latestRun.status === "completed" ? "ready" : latestRun.status === "failed" ? "risk" : "warn"}
                  title={`${latestRun.schedule_slot} run: ${latestRun.status}`}
                  detail={`Scheduled ${formatDeskDate(latestRun.scheduled_for)}. ${latestRun.updates_published} Story updates published. ${latestRun.warnings.length} warning(s) recorded.`}
                />
              ) : (
                <DataState
                  title="Research-run health unavailable"
                  detail="The private research-run view returned no records. This is shown as unavailable rather than interpreted as a healthy empty queue."
                />
              )}
              <DataState
                state={data.marketStateRecords.length ? "ready" : "warn"}
                title={data.marketStateRecords.length ? "Market-state records loaded" : "Market-state ledger unavailable"}
                detail={data.marketStateRecords.length
                  ? `${data.marketStateRecords.length} current state records are available.`
                  : "The current loader requests market_state_ledger, but no rows were returned. The legacy board remains available while the relation is reconciled."}
              />
            </div>
          </Panel>

          <Panel
            title="Persistent Story map"
            description="Current theses remain canonical in Live Core. Thesis versioning arrives in the persistence phase."
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
                    <Badge tone={story.status === "active" ? "ready" : "default"}>{story.status}</Badge>
                  </div>
                  <p>{story.thesis}</p>
                </article>
              )) : (
                <DataState state="risk" title="No Stories returned" detail="The Story query returned no records. Live Core will not substitute illustrative mockup content." />
              )}
            </div>
          </Panel>
        </div>

        <Panel
          title="Latest material changes"
          description="Current Story updates are exposed as dated records. Repeated background should move to What’s New disposition rules in PR 3."
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
              <DataState title="No update records returned" detail="The update feed is empty or unavailable. This state is not presented as proof that nothing changed." />
            )}
          </div>
        </Panel>
      </div>
    </LiveDeskShell>
  );
}
