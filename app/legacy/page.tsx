import LegacyOverviewStoryTags from "@/components/LegacyOverviewStoryTags";
import MarketWorkspace from "@/components/MarketWorkspace";
import { runAccuracyCheck } from "@/lib/accuracy";
import { getAlchemyArticles } from "@/lib/alchemy";
import { getEconomicCalendar } from "@/lib/calendar";
import { getDeskData } from "@/lib/data";
import { getMarketData } from "@/lib/market";
import { deriveStoryTags } from "@/lib/story-tags";
import { dashboardAuthRequired } from "@/lib/supabase/config";

export const dynamic = "force-dynamic";

type LegacyPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function LegacyPage({ searchParams }: LegacyPageProps) {
  const [data, articles, market, calendarEvents, query] = await Promise.all([
    getDeskData(),
    getAlchemyArticles(),
    getMarketData(),
    getEconomicCalendar(),
    searchParams,
  ]);
  const accuracy = runAccuracyCheck(market);
  const authRequired = dashboardAuthRequired();
  const tabValue = Array.isArray(query.tab) ? query.tab[0] : query.tab;
  const showOverviewTags = !tabValue || tabValue === "Overview";
  const taggedStories = data.stories.slice(0, 12).map((story) => ({
    id: story.id,
    slug: story.slug,
    title: story.title,
    thesis: story.thesis,
    confidence: story.confidence,
    status: story.article_verdict || story.status,
    assets: story.assets || [],
    tags: deriveStoryTags(story, 6),
  }));

  return (
    <>
      {authRequired && (
        <form
          action="/auth/signout"
          method="post"
          style={{
            position: "fixed",
            top: 14,
            right: 16,
            zIndex: 1000,
          }}
        >
          <button
            type="submit"
            style={{
              border: "1px solid rgba(255,255,255,.16)",
              borderRadius: 10,
              background: "rgba(10,12,24,.86)",
              color: "#e9e6f5",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 800,
              padding: "9px 12px",
            }}
          >
            Sign out
          </button>
        </form>
      )}
      {showOverviewTags ? <LegacyOverviewStoryTags stories={taggedStories} /> : null}
      <MarketWorkspace
        {...data}
        articles={articles}
        market={market}
        accuracy={accuracy}
        calendarEvents={calendarEvents}
      />
    </>
  );
}
