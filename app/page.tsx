import { redirect } from "next/navigation";

import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import OverviewWorkspace from "@/components/live-desk/OverviewWorkspace";
import { formatDeskDate } from "@/components/live-desk/LiveDeskUi";
import { getDeskData } from "@/lib/data";
import { legacyTabRedirect } from "@/lib/live-desk/routes";
import { getMarketData } from "@/lib/market";
import { getStoryRecordLayer } from "@/lib/persistence/read";
import { getStableStoryFallbackImage } from "@/lib/story-fallback-images";
import { getStoryHeaderImages } from "@/lib/story-images";
import { deriveStoryTags } from "@/lib/story-tags";

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

  const [data, market, recordLayer] = await Promise.all([getDeskData(), getMarketData(), getStoryRecordLayer()]);
  const latestRun = data.researchRuns[0];
  const marketContextCount = data.marketObservations.length;
  const mainBreadth = market.breadth.find((item) => item.id === "large-cap") || market.breadth[0];
  const benchmark = market.series.find((series) => series.symbol === "^GSPC");
  const storyById = new Map(data.stories.map((story) => [story.id, story]));

  const storyRows = data.stories.slice(0, 12);
  const storyImages = await getStoryHeaderImages(storyRows.map((story) => story.id), data.sources);
  const stories = storyRows.map((story) => {
    const image = storyImages.get(story.id);
    const fallback = getStableStoryFallbackImage(story.id);
    return {
      id: story.id,
      slug: story.slug,
      title: story.title,
      thesis: story.thesis,
      status: story.article_verdict || story.status,
      confidence: story.confidence,
      assets: story.assets || [],
      tags: deriveStoryTags(story, 6),
      imageUrl: image?.imageUrl || fallback.dataUri,
      fallbackImageUrl: fallback.dataUri,
      imageKind: image?.kind || "fallback" as const,
      imageSourceUrl: image?.articleUrl || null,
      imageSourceTitle: image?.articleTitle || null,
      imagePublisher: image?.publisher || null,
    };
  });

  const changes = recordLayer.available
    ? recordLayer.events.slice(0, 6).map((event) => {
      const story = storyById.get(event.story_id);
      return {
        id: event.id,
        headline: event.headline,
        detail: event.detail,
        date: formatDeskDate(event.event_at),
        storyTitle: story?.title || null,
        updateType: event.event_type,
        recordHref: story ? `/stories/${story.slug}#event-${event.id}` : `/whats-new#record-${event.id}`,
      };
    })
    : data.updates.slice(0, 6).map((update) => {
      const story = storyById.get(update.story_id);
      return {
        id: update.id,
        headline: update.headline,
        detail: update.detail,
        date: formatDeskDate(update.observed_at || update.created_at),
        storyTitle: story?.title || null,
        updateType: update.update_type,
        recordHref: story ? `/stories/${story.slug}#event-${update.id}` : `/whats-new#record-${update.id}`,
      };
    });

  const latestRecordAt = recordLayer.available
    ? recordLayer.events[0]?.event_at
    : data.updates[0]?.observed_at || data.updates[0]?.created_at;

  const systems = [
    latestRun ? {
      title: `${latestRun.schedule_slot} run: ${latestRun.status}`,
      detail: `Scheduled ${formatDeskDate(latestRun.scheduled_for)}. ${latestRun.updates_published} Story updates published. ${latestRun.warnings.length} warning(s) recorded.`,
      tone: latestRun.status === "completed" ? "ready" as const : latestRun.status === "failed" ? "risk" as const : "warn" as const,
    } : {
      title: "Research-run status is updating",
      detail: "The latest private run record is not currently available. Story and evidence records remain accessible.",
      tone: "warn" as const,
    },
    {
      title: marketContextCount ? "Market context loaded" : "Market context is updating",
      detail: marketContextCount
        ? `${marketContextCount} market observations are available to the desk.`
        : "Current market observations have not returned yet. Research records remain available while prices refresh.",
      tone: marketContextCount ? "ready" as const : "warn" as const,
    },
    {
      title: stories.length ? `${stories.length} Stories mapped` : "Story map is updating",
      detail: stories.length
        ? `Story records retain their thesis, confidence, assets and controlled market-theme tags. ${recordLayer.available ? "Immutable event links are active." : "Dated update links are active."}`
        : "No Story records were returned. The Overview does not insert illustrative replacements.",
      tone: stories.length ? "ready" as const : "risk" as const,
    },
  ];

  return (
    <LiveDeskShell
      activePath="/"
      title="Overview"
      description="Current research health, persistent Story state and exact record access in one operational view."
      meta={(
        <>
          <span className={styles.metaLabel}>Latest material record</span><br />
          {formatDeskDate(latestRecordAt)}
        </>
      )}
    >
      <OverviewWorkspace
        stories={stories}
        changes={changes}
        systems={systems}
        metrics={{
          stories: data.stories.length,
          sources: data.sources.length,
          evidence: data.evidence.length,
          charts: data.charts.length,
        }}
        pulse={{
          score: Number.isFinite(market.pulseWeek) ? market.pulseWeek : null,
          lastWeekScore: null,
          label: "This week",
          benchmarkMove: benchmark?.change5d ?? null,
          above50: mainBreadth?.current.above50 ?? null,
          above200: mainBreadth?.current.above200 ?? null,
        }}
      />
    </LiveDeskShell>
  );
}
