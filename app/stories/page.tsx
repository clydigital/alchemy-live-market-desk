import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import StoriesRegistry from "@/components/live-desk/StoriesRegistry";
import { Badge, DataState, MetricGrid, Panel } from "@/components/live-desk/LiveDeskUi";
import { getDeskData } from "@/lib/data";
import { getStoryHeaderImages } from "@/lib/story-images";
import { getStoryRecordLayer } from "@/lib/persistence/read";
import { deriveStoryTags } from "@/lib/story-tags";

export const dynamic = "force-dynamic";

export default async function StoriesPage() {
  const [data, recordLayer] = await Promise.all([getDeskData(), getStoryRecordLayer()]);
  const storyImages = await getStoryHeaderImages(data.stories.map((story) => story.id), data.sources);
  const priorityStories = data.stories.filter((story) => /develop|publish/i.test(story.article_verdict || story.status)).length;
  const coverageBySlug = new Map(data.evidenceCoverage.map((coverage) => [coverage.slug, coverage]));
  const legacyEventCounts = new Map<string, number>();
  data.updates.forEach((update) => legacyEventCounts.set(update.story_id, (legacyEventCounts.get(update.story_id) || 0) + 1));

  const persistentEventCounts = new Map<string, number>();
  recordLayer.events.forEach((event) => persistentEventCounts.set(event.story_id, (persistentEventCounts.get(event.story_id) || 0) + 1));
  const versionCounts = new Map<string, number>();
  recordLayer.thesisVersions.forEach((version) => versionCounts.set(version.story_id, (versionCounts.get(version.story_id) || 0) + 1));

  const registryStories = data.stories.map((story) => {
    const image = storyImages.get(story.id);
    return {
      id: story.id,
      slug: story.slug,
      title: story.title,
      thesis: story.thesis,
      status: story.article_verdict || story.status,
      confidence: story.confidence,
      assets: story.assets || [],
      tags: deriveStoryTags(story, 8),
      marketQuestion: story.market_question,
      nextCatalyst: story.next_catalyst,
      evidenceRoom: coverageBySlug.get(story.slug)?.room_status || null,
      eventCount: recordLayer.available ? (persistentEventCounts.get(story.id) || 0) : (legacyEventCounts.get(story.id) || 0),
      versionCount: recordLayer.available ? (versionCounts.get(story.id) || 0) : null,
      imageUrl: image?.imageUrl || null,
      imageSourceUrl: image?.articleUrl || null,
      imagePublisher: image?.publisher || null,
      imageKind: image?.kind || null,
    };
  });

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
            { value: recordLayer.available ? recordLayer.events.length : data.updates.length, label: "Dated Story events" },
            { value: data.evidence.length, label: "Evidence records" },
          ]}
        />

        <DataState
          state={recordLayer.available ? "ready" : "warn"}
          title={recordLayer.available ? "Versioned Story history available" : "Current thesis view active"}
          detail={recordLayer.available
            ? `${recordLayer.thesisVersions.length} immutable thesis versions and ${recordLayer.events.length} append-only Story events are available.`
            : "The registry is using current Story records and exact links to dated updates. Historical full-thesis versions will appear after the approved persistence migration is applied."}
        />

        <Panel
          title="Story registry"
          description="Search by thesis, asset, catalyst or controlled market tag. Each Story opens a stable record with exact event, evidence and source links."
          action={<Badge tone={recordLayer.available ? "ready" : "default"}>{recordLayer.available ? "Versioned" : "Current records"}</Badge>}
        >
          {registryStories.length ? (
            <StoriesRegistry stories={registryStories} />
          ) : (
            <DataState state="risk" title="Stories are updating" detail="No current Story records are available. No illustrative Stories are inserted in their place." />
          )}
        </Panel>
      </div>
    </LiveDeskShell>
  );
}
