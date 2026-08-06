import { redirect } from "next/navigation";

import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import OverviewWorkspace from "@/components/live-desk/OverviewWorkspace";
import { formatDeskDate } from "@/components/live-desk/LiveDeskUi";
import { getDeskData } from "@/lib/data";
import { legacyTabRedirect } from "@/lib/live-desk/routes";
import { getMarketData } from "@/lib/market";
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

  const [data, market] = await Promise.all([getDeskData(), getMarketData()]);
  const latestRun = data.researchRuns[0];
  const latestUpdate = data.updates[0];
  const marketContextCount = data.marketObservations.length;
  const mainBreadth = market.breadth.find((item) => item.id === "large-cap") || market.breadth[0];
  const benchmark = market.series.find((series) => series.symbol === "^GSPC");

  const stories = data.stories.slice(0, 12).map((story) => ({
    id: story.id,
    slug: story.slug,
    title: story.title,
    thesis: story.thesis,
    status: story.article_verdict || story.status,
    confidence: story.confidence,
    assets: story.assets || [],
    tags: deriveStoryTags(story, 6),
  }));

  const changes = data.updates.slice(0, 6).map((update) => {
    const story = data.stories.find((candidate) => candidate.id === update.story_id);
    return {
      id: update.id,
      headline: update.headline,
      detail: update.detail,
      date: formatDeskDate(update.observed_at || update.created_at),
      storyTitle: story?.title || null,
      updateType: update.update_type,
    };
  });

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
        ? "Story records retain their thesis, confidence, assets and controlled market-theme tags."
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
          {formatDeskDate(latestUpdate?.observed_at || latestUpdate?.created_at)}
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
          label: "This week",
          benchmarkMove: benchmark?.change5d ?? null,
          above50: mainBreadth?.current.above50 ?? null,
          above200: mainBreadth?.current.above200 ?? null,
        }}
      />
    </LiveDeskShell>
  );
}
