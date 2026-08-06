import Link from "next/link";

import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import { Badge, DataState, MetricGrid, Panel } from "@/components/live-desk/LiveDeskUi";
import { getDeskData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function StoriesPage() {
  const data = await getDeskData();
  const priorityStories = data.stories.filter((story) => ["develop", "publish"].includes(story.status)).length;
  const coverageBySlug = new Map(data.evidenceCoverage.map((coverage) => [coverage.slug, coverage]));

  return (
    <LiveDeskShell
      activePath="/stories"
      title="Stories"
      description="Persistent market questions, current theses and exact supporting records."
      meta={`${data.stories.length} non-archived Stories`}
    >
      <div className={styles.grid}>
        <MetricGrid
          items={[
            { value: data.stories.length, label: "Tracked Stories" },
            { value: priorityStories, label: "Develop or publish" },
            { value: data.updates.length, label: "Loaded events" },
            { value: data.evidence.length, label: "Evidence records" },
          ]}
        />

        <Panel
          title="Story registry"
          description="Current theses, confidence, catalysts and evidence-room readiness remain visible in one registry."
          action={<Link className={styles.link} href="/legacy?tab=Stories">Open detailed Story board</Link>}
        >
          <div className={styles.recordList}>
            {data.stories.length ? data.stories.map((story) => {
              const coverage = coverageBySlug.get(story.slug);
              return (
                <article className={styles.record} key={story.id}>
                  <div className={styles.recordHeader}>
                    <div>
                      <Link href={`/stories/${story.slug}`}><h3>{story.title}</h3></Link>
                      <div className={styles.meta}>{story.assets?.join(" · ") || "No affected assets recorded"}</div>
                    </div>
                    <div className={styles.inlineMeta}>
                      <Badge tone={["develop", "publish"].includes(story.status) ? "ready" : "default"}>{story.status}</Badge>
                      <Badge tone={story.confidence >= 70 ? "ready" : story.confidence < 45 ? "warn" : "default"}>{story.confidence}% confidence</Badge>
                      {coverage ? <Badge tone={coverage.room_status === "ready" ? "ready" : "warn"}>{coverage.room_status}</Badge> : null}
                    </div>
                  </div>
                  <p>{story.thesis}</p>
                  <div className={styles.gridTwo}>
                    <div><span className={styles.metaLabel}>Market question</span><p>{story.market_question || "Not recorded"}</p></div>
                    <div><span className={styles.metaLabel}>Next catalyst</span><p>{story.next_catalyst || "Not recorded"}</p></div>
                  </div>
                </article>
              );
            }) : (
              <DataState state="risk" title="Stories are updating" detail="No current Story records are available. No illustrative Stories are inserted in their place." />
            )}
          </div>
        </Panel>
      </div>
    </LiveDeskShell>
  );
}
