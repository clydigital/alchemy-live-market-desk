import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import { Badge, DataState, formatDeskDate, Panel } from "@/components/live-desk/LiveDeskUi";
import WhatsNewWorkspace, { type WhatsNewDelta } from "@/components/live-desk/WhatsNewWorkspace";
import { getDeskData } from "@/lib/data";
import { getStoryRecordLayer } from "@/lib/persistence/read";

export const dynamic = "force-dynamic";

export default async function WhatsNewPage() {
  const [data, recordLayer] = await Promise.all([getDeskData(), getStoryRecordLayer()]);
  const storyById = new Map(data.stories.map((story) => [story.id, story]));

  const storyDeltas: WhatsNewDelta[] = recordLayer.available
    ? recordLayer.events.map((event) => {
      const story = storyById.get(event.story_id);
      return {
        id: event.id,
        kind: event.event_type,
        stream: "Story" as const,
        title: event.headline,
        detail: event.detail || "No additional detail was stored for this Story event.",
        dateLabel: formatDeskDate(event.event_at),
        timestamp: event.event_at,
        href: story ? `/stories/${story.slug}#event-${event.id}` : null,
        external: false,
        verification: event.impact,
        storyTitle: story?.title || null,
      };
    })
    : data.updates.map((update) => {
      const story = storyById.get(update.story_id);
      const timestamp = update.observed_at || update.created_at;
      return {
        id: update.id,
        kind: update.update_type,
        stream: "Story" as const,
        title: update.headline,
        detail: update.detail || "No additional detail was stored for this update.",
        dateLabel: formatDeskDate(timestamp),
        timestamp,
        href: story ? `/stories/${story.slug}#event-${update.id}` : null,
        external: false,
        verification: "Dated Story update",
        storyTitle: story?.title || null,
      };
    });

  const deltas: WhatsNewDelta[] = [
    ...storyDeltas,
    ...data.statements.map((statement) => ({
      id: statement.id,
      kind: "statement",
      stream: "Statement" as const,
      title: `${statement.speaker}: ${statement.topic}`,
      detail: statement.market_interpretation || statement.quote_excerpt,
      dateLabel: formatDeskDate(statement.statement_date),
      timestamp: statement.statement_date,
      href: statement.source_url || null,
      external: true,
      verification: statement.verification_status,
      storyTitle: null,
    })),
    ...data.newsThreads.map((thread) => ({
      id: thread.id,
      kind: thread.category || thread.source_type,
      stream: "News" as const,
      title: thread.headline,
      detail: thread.current_view || thread.summary,
      dateLabel: formatDeskDate(thread.published_at),
      timestamp: thread.published_at,
      href: thread.source_url || null,
      external: true,
      verification: thread.source_type,
      storyTitle: null,
    })),
  ].sort((a, b) => Date.parse(b.timestamp || "") - Date.parse(a.timestamp || "")).slice(0, 60);

  return (
    <LiveDeskShell
      activePath="/whats-new"
      title="What’s New"
      description="Material Story changes, verified statements and relevant news records with stable links back to their exact context."
      meta={`${deltas.length} recent records shown`}
    >
      <div className={styles.grid}>
        <DataState
          state={recordLayer.available ? "ready" : "warn"}
          title={recordLayer.available ? "Append-only Story events active" : "Dated Story update links active"}
          detail={recordLayer.available
            ? "The delta stream is reading immutable Story events and links each item to its exact place in the Story timeline."
            : "The stream links current dated updates to exact Story anchors. Immutable event history will take over after the approved persistence migration is applied."}
        />

        <Panel
          title="Current delta stream"
          description="Filter recent material records by stream or search across headlines, Stories and verification state."
          action={<Badge tone={recordLayer.available ? "ready" : "default"}>{recordLayer.available ? "Versioned events" : "Current events"}</Badge>}
        >
          {deltas.length ? (
            <WhatsNewWorkspace deltas={deltas} />
          ) : (
            <DataState state="risk" title="Recent records are updating" detail="No update, statement or news records are available at the moment. This is not treated as proof that the market was quiet." />
          )}
        </Panel>
      </div>
    </LiveDeskShell>
  );
}
