import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import StoriesRegistry from "@/components/live-desk/StoriesRegistry";
import { Badge, DataState, MetricGrid, Panel } from "@/components/live-desk/LiveDeskUi";
import { getDeskData } from "@/lib/data";
import { getStoryRecordLayer } from "@/lib/persistence/read";
import { classifyRegimeStory, getRegimeDefinition, routeStoryToRegimes } from "@/lib/regimes";
import { getStableStoryFallbackImage } from "@/lib/story-fallback-images";
import { assessStoryCatalyst, catalystDisplayLabel } from "@/lib/story-hygiene";
import { getStoryHeaderImages } from "@/lib/story-images";
import { deriveStoryTags } from "@/lib/story-tags";

export const dynamic = "force-dynamic";

export default async function StoriesPage() {
  const [data, recordLayer] = await Promise.all([getDeskData(), getStoryRecordLayer()]);
  const storyImages = await getStoryHeaderImages(data.stories.map((story) => story.id), data.sources);
  const priorityStories = data.stories.filter((story) => /develop|publish/i.test(story.article_verdict || "")).length;
  const coverageBySlug = new Map(data.evidenceCoverage.map((coverage) => [coverage.slug, coverage]));
  const legacyEventCounts = new Map<string, number>();
  data.updates.forEach((update) => legacyEventCounts.set(update.story_id, (legacyEventCounts.get(update.story_id) || 0) + 1));

  const persistentEventCounts = new Map<string, number>();
  recordLayer.events.forEach((event) => persistentEventCounts.set(event.story_id, (persistentEventCounts.get(event.story_id) || 0) + 1));
  const versionCounts = new Map<string, number>();
  const latestVersionByStory = new Map<string, (typeof recordLayer.thesisVersions)[number]>();
  recordLayer.thesisVersions.forEach((version) => {
    versionCounts.set(version.story_id, (versionCounts.get(version.story_id) || 0) + 1);
    const prior = latestVersionByStory.get(version.story_id);
    if (!prior || version.version_number > prior.version_number || (
      version.version_number === prior.version_number && version.effective_at > prior.effective_at
    )) latestVersionByStory.set(version.story_id, version);
  });

  const now = new Date();
  const registryStories = data.stories.map((story) => {
    const image = storyImages.get(story.id);
    const fallback = getStableStoryFallbackImage(story.id);
    const version = latestVersionByStory.get(story.id);
    const current = {
      ...story,
      title: version?.title || story.title,
      thesis: version?.thesis || story.thesis,
      market_question: version?.market_question || story.market_question,
      next_catalyst: version?.next_catalyst || story.next_catalyst,
      assets: version?.assets || story.assets || [],
    };
    const maturity = classifyRegimeStory(story, version);
    const catalyst = assessStoryCatalyst({
      nextCatalyst: current.next_catalyst,
      version,
      now,
    });
    const regimes = routeStoryToRegimes(story, version)
      .map((route) => getRegimeDefinition(route.regime))
      .filter((regime, index, all): regime is NonNullable<typeof regime> => Boolean(regime) && all.findIndex((item) => item?.slug === regime?.slug) === index)
      .map((regime) => ({ slug: regime.slug, label: regime.shortTitle }));
    return {
      id: story.id,
      slug: story.slug,
      title: current.title,
      thesis: current.thesis,
      lifecycle: version?.status || story.status,
      editorialVerdict: version?.article_verdict ?? story.article_verdict,
      confidence: version?.confidence ?? story.confidence,
      assets: current.assets,
      tags: deriveStoryTags(current, 8),
      marketQuestion: current.market_question,
      nextCatalyst: catalystDisplayLabel(catalyst),
      catalystStatus: catalyst.status,
      catalystRecalibrationRequired: catalyst.recalibrationRequired,
      maturity: maturity.maturity,
      maturityReason: maturity.reason,
      evidenceRoom: coverageBySlug.get(story.slug)?.room_status || null,
      eventCount: recordLayer.available ? (persistentEventCounts.get(story.id) || 0) : (legacyEventCounts.get(story.id) || 0),
      versionCount: recordLayer.available ? (versionCounts.get(story.id) || 0) : null,
      imageUrl: image?.imageUrl || fallback.dataUri,
      fallbackImageUrl: fallback.dataUri,
      imageSourceUrl: image?.articleUrl || null,
      imagePublisher: image?.publisher || null,
      imageKind: image?.kind || "fallback" as const,
      regimes,
      hybridHref: `/hybrid-output?story=${encodeURIComponent(story.slug)}`,
    };
  });

  return (
    <LiveDeskShell
      activePath="/stories"
      title="Stories"
      description="Living market theses inside durable Regimes. Visible headlines follow the latest accepted Story version while identity and history stay stable."
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
