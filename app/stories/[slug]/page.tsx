import Link from "next/link";
import { notFound } from "next/navigation";

import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import { Badge, DataState, formatDeskDate, MetricGrid, Panel } from "@/components/live-desk/LiveDeskUi";
import { getDeskData } from "@/lib/data";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ slug: string }>;
};

export default async function StoryDetailPage({ params }: PageProps) {
  const { slug } = await params;
  const data = await getDeskData();
  const story = data.stories.find((candidate) => candidate.slug === slug);
  if (!story) notFound();

  const updates = data.updates.filter((update) => update.story_id === story.id);
  const evidence = data.evidence.filter((item) => item.story_id === story.id);
  const sources = data.sources.filter((source) => source.story_id === story.id);
  const charts = data.charts.filter((chart) => chart.story_id === story.id);
  const coverage = data.evidenceCoverage.find((item) => item.slug === story.slug);

  return (
    <LiveDeskShell
      activePath="/stories"
      eyebrow="Persistent Story"
      title={story.title}
      description={story.thesis}
      meta={(
        <>
          <span className={styles.metaLabel}>Current state</span><br />
          {story.status} · {story.confidence}% confidence
        </>
      )}
    >
      <div className={styles.grid}>
        <MetricGrid
          items={[
            { value: updates.length, label: "Story events loaded" },
            { value: evidence.length, label: "Evidence records" },
            { value: sources.length, label: "Linked sources" },
            { value: charts.length, label: "Chart requests" },
          ]}
        />

        <div className={styles.gridTwo}>
          <Panel title="Current thesis state" description="This is the current mutable Story row. PR 2 will preserve every thesis revision separately.">
            <div className={styles.recordList}>
              <article className={styles.record}>
                <span className={styles.metaLabel}>Market belief</span>
                <p>{story.dominant_narrative || story.market_question || "Not recorded"}</p>
              </article>
              <article className={styles.record}>
                <span className={styles.metaLabel}>Accepted explanation</span>
                <p>{story.best_explanation || "Not recorded"}</p>
              </article>
              <article className={styles.record}>
                <span className={styles.metaLabel}>Strongest support</span>
                <p>{story.strongest_support || "Not recorded"}</p>
              </article>
              <article className={styles.record}>
                <span className={styles.metaLabel}>Strongest contradiction</span>
                <p>{story.strongest_contradiction || "Not recorded"}</p>
              </article>
            </div>
          </Panel>

          <Panel title="Test and portfolio map" description="Confirmation and invalidation remain explicit even before versioned thesis records are introduced.">
            <div className={styles.recordList}>
              <article className={styles.record}>
                <span className={styles.metaLabel}>Confirmation</span>
                <p>{story.confirmation_trigger || "Not recorded"}</p>
              </article>
              <article className={styles.record}>
                <span className={styles.metaLabel}>Invalidation</span>
                <p>{story.invalidation_trigger || "Not recorded"}</p>
              </article>
              <article className={styles.record}>
                <span className={styles.metaLabel}>Next catalyst</span>
                <p>{story.next_catalyst || "Not recorded"}</p>
              </article>
              <article className={styles.record}>
                <span className={styles.metaLabel}>Affected assets</span>
                <p>{story.assets?.join(" · ") || "No assets mapped"}</p>
              </article>
              {coverage ? <DataState state={coverage.room_status === "ready" ? "ready" : "warn"} title={`Evidence room: ${coverage.room_status}`} detail={`${coverage.source_count} sources, ${coverage.evidence_count} evidence records, ${coverage.contradiction_count} contradiction(s), ${coverage.unresolved_count} unresolved test(s).`} /> : null}
            </div>
          </Panel>
        </div>

        <Panel title="Story event timeline" description="Existing updates are retained in date order. PR 2 will add the full append-only event taxonomy.">
          <div className={styles.recordList}>
            {updates.length ? updates.map((update) => (
              <article className={styles.record} key={update.id}>
                <div className={styles.recordHeader}>
                  <div>
                    <h3>{update.headline}</h3>
                    <div className={styles.meta}>{formatDeskDate(update.observed_at || update.created_at)}</div>
                  </div>
                  <Badge>{update.update_type}</Badge>
                </div>
                {update.detail ? <p>{update.detail}</p> : null}
              </article>
            )) : <DataState title="No Story events returned" detail="The current update table contains no linked events for this Story." />}
          </div>
        </Panel>

        <div className={styles.gridTwo}>
          <Panel title="Evidence" description="Current evidence is shown without reclassifying fact, inference or interpretation.">
            <div className={styles.recordList}>
              {evidence.length ? evidence.slice(0, 20).map((item) => (
                <article className={styles.record} key={item.id}>
                  <div className={styles.recordHeader}>
                    <h3>{item.claim}</h3>
                    <Badge tone={item.strength >= 80 ? "ready" : item.strength < 50 ? "warn" : "default"}>{item.strength}</Badge>
                  </div>
                  {item.detail ? <p>{item.detail}</p> : null}
                  <div className={styles.meta}>{item.evidence_type} · {formatDeskDate(item.created_at)}</div>
                </article>
              )) : <DataState title="No evidence returned" detail="The evidence query returned no linked records for this Story." />}
            </div>
          </Panel>

          <Panel title="Sources" description="Every linked source remains traceable to its exact URL or locator.">
            <div className={styles.recordList}>
              {sources.length ? sources.slice(0, 20).map((source) => (
                <article className={styles.record} key={source.id}>
                  <div className={styles.recordHeader}>
                    <div>
                      <a href={source.url} target="_blank" rel="noreferrer"><h3>{source.title}</h3></a>
                      <div className={styles.meta}>{source.publisher} · {source.source_type}</div>
                    </div>
                    <Badge>{source.reliability_score}</Badge>
                  </div>
                  <p>{source.notes || `Published ${formatDeskDate(source.publication_date)}. Observed ${formatDeskDate(source.observation_date)}.`}</p>
                </article>
              )) : <DataState title="No source records returned" detail="This Story has no linked source rows in the current loader result." />}
            </div>
          </Panel>
        </div>

        <Link className={styles.link} href="/stories">← Back to Stories</Link>
      </div>
    </LiveDeskShell>
  );
}
