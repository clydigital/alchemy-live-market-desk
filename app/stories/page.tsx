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
      description="Persistent market questions, current theses and exact supporting records. PR 1 keeps the existing Story rows intact while adding route ownership and deep links."
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
          description="The current thesis fields are still mutable. PR 2 will add append-only Story events and thesis versions before these fields are treated as reconstructable history."
          action={<Link className={styles.link} href="/legacy?tab=Stories">Open legacy Story board</Link>}
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
              <DataState state="risk" title="No Stories returned" detail="The canonical Story query is empty or unavailable. No fallback or illustrative Stories are inserted into this route." />
            )}
          </div>
        </Panel>
      </div>
    </LiveDeskShell>
  );
}
