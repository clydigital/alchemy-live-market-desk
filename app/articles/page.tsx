import ArticleMemoryWorkspace from "@/components/live-desk/ArticleMemoryWorkspace";
import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import { DataState, formatDeskDate, MetricGrid, Panel } from "@/components/live-desk/LiveDeskUi";
import { getAlchemyArticles } from "@/lib/alchemy";
import {
  assessArticleChanges,
  assessChartIdea,
  instrumentMatchesAsset,
  type ArticleChartIdea,
  type ArticleChangeLinkBasis,
} from "@/lib/article-idea-status";
import { extractArticleScenarios } from "@/lib/article-scenario-extractor";
import { getDeskData } from "@/lib/data";
import { getMarketData } from "@/lib/market";

export const dynamic = "force-dynamic";

function canonicalUrl(value: string) {
  try {
    const url = new URL(value);
    url.hash = "";
    url.search = "";
    return `${url.hostname.replace(/^www\./, "")}${url.pathname.replace(/\/$/, "")}`.toLowerCase();
  } catch {
    return value.replace(/[?#].*$/, "").replace(/\/$/, "").toLowerCase();
  }
}

function ideaKey(idea: ArticleChartIdea) {
  return [
    idea.instrument,
    idea.direction,
    idea.confirmationArea || "",
    idea.targetArea || "",
    idea.invalidationArea || "",
    idea.question,
  ].join("|").toUpperCase().replace(/\s+/g, " ").trim();
}

function dedupeIdeas(structured: ArticleChartIdea[], articleNative: ArticleChartIdea[]) {
  const seen = new Set<string>();
  const ideas: ArticleChartIdea[] = [];
  for (const idea of [...structured, ...articleNative]) {
    const key = ideaKey(idea);
    if (seen.has(key)) continue;
    seen.add(key);
    ideas.push(idea);
  }
  return ideas.slice(0, 8);
}

export default async function ArticlesPage() {
  const [articles, data, market] = await Promise.all([getAlchemyArticles(30), getDeskData(), getMarketData()]);
  const storyBySlug = new Map(data.stories.map((story) => [story.slug, story]));
  const storyById = new Map(data.stories.map((story) => [story.id, story]));
  const chartsByStory = new Map<string, typeof data.charts>();
  data.charts.forEach((chart) => {
    if (!chart.story_id) return;
    const existing = chartsByStory.get(chart.story_id) || [];
    existing.push(chart);
    chartsByStory.set(chart.story_id, existing);
  });

  const intakeByUrl = new Map(
    data.researchIntake
      .filter((item) => item.item_type === "alchemy_article")
      .map((item) => [canonicalUrl(item.url), item]),
  );
  const sourcesByUrl = new Map<string, typeof data.sources>();
  data.sources.forEach((source) => {
    const key = canonicalUrl(source.url);
    const existing = sourcesByUrl.get(key) || [];
    existing.push(source);
    sourcesByUrl.set(key, existing);
  });

  const records = articles.map((article) => {
    const articleKey = canonicalUrl(article.url);
    const intake = intakeByUrl.get(articleKey);
    const exactSources = sourcesByUrl.get(articleKey) || [];
    const linkedStoryMap = new Map<string, { story: (typeof data.stories)[number]; relation: "exact" | "asset" }>();

    (intake?.affected_story_slugs || []).forEach((slug) => {
      const story = storyBySlug.get(slug);
      if (story) linkedStoryMap.set(story.id, { story, relation: "exact" });
    });
    exactSources.forEach((source) => {
      if (!source.story_id) return;
      const story = storyById.get(source.story_id);
      if (story) linkedStoryMap.set(story.id, { story, relation: "exact" });
    });

    const articleNativeIdeas = extractArticleScenarios(article, market.series, data.marketObservations);
    const exactLinkCount = linkedStoryMap.size;

    if (!exactLinkCount && articleNativeIdeas.length) {
      const assetMatches = data.stories
        .map((story) => ({
          story,
          score: articleNativeIdeas.reduce(
            (sum, idea) => sum + (story.assets || []).filter((asset) => instrumentMatchesAsset(idea.instrument, asset)).length,
            0,
          ),
        }))
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score || b.story.confidence - a.story.confidence)
        .slice(0, 3);
      assetMatches.forEach(({ story }) => linkedStoryMap.set(story.id, { story, relation: "asset" }));
    }

    const linkedStoryRecords = Array.from(linkedStoryMap.values());
    const relatedStories = linkedStoryRecords.map(({ story, relation }) => ({
      id: story.id,
      slug: story.slug,
      title: story.title,
      href: `/stories/${story.slug}`,
      relation,
    }));

    const structuredIdeas = linkedStoryRecords.flatMap(({ story }) =>
      (chartsByStory.get(story.id) || []).map((chart) =>
        assessChartIdea(
          chart,
          story.title,
          `/stories/${story.slug}`,
          market.series,
          data.marketObservations,
        ),
      ),
    );
    const chartIdeas = dedupeIdeas(structuredIdeas, articleNativeIdeas);

    const sourcePublicationDate = exactSources
      .map((source) => source.publication_date || source.observation_date)
      .filter((value): value is string => Boolean(value))
      .sort()[0] || null;
    const publishedAt = article.publishedAt || sourcePublicationDate;
    const linkBasis: ArticleChangeLinkBasis = exactLinkCount ? "exact" : linkedStoryRecords.length ? "asset" : "none";
    const changeState = assessArticleChanges(
      publishedAt,
      linkedStoryRecords.map(({ story }) => ({ id: story.id, slug: story.slug })),
      data.updates,
      linkBasis,
    );

    return {
      id: article.id,
      title: article.title,
      url: article.url,
      category: article.category,
      publishedAt,
      publishedLabel: formatDeskDate(publishedAt),
      author: article.author,
      image: article.image,
      summary: article.summary,
      tradingViewLinks: article.tradingViewLinks,
      relatedStories,
      intakeStatus: intake?.status || null,
      candidateScore: typeof intake?.candidate_score === "number" ? intake.candidate_score : null,
      chartIdeas,
      changeState: {
        ...changeState,
        latestUpdateLabel: formatDeskDate(changeState.latestUpdateAt),
        updates: changeState.updates.map((update) => ({
          ...update,
          dateLabel: formatDeskDate(update.date),
        })),
      },
    };
  });

  const chartIdeas = records.flatMap((article) => article.chartIdeas);
  const assessedIdeas = chartIdeas.filter((idea) => idea.status !== "needs_review").length;
  const changedArticles = records.filter((article) => article.changeState.updateCount > 0).length;

  return (
    <LiveDeskShell
      activePath="/articles"
      title="Articles"
      description="Published ideas reduced to their live price levels: bullish and bearish cases, current price, trigger, target and invalidation."
      meta={`${records.length} published records loaded`}
    >
      <div className={styles.grid}>
        <MetricGrid
          items={[
            { value: records.length, label: "Published articles" },
            { value: records.filter((article) => article.chartIdeas.length).length, label: "Articles with level checks" },
            { value: assessedIdeas, label: "Live setups assessed" },
            { value: changedArticles, label: "Articles with later changes" },
          ]}
        />

        <DataState
          state={chartIdeas.length || changedArticles ? "ready" : "warn"}
          title={chartIdeas.length || changedArticles ? "Article level checks available" : "Published memory loaded without monitoring links"}
          detail="Article setups are kept as separate bullish and bearish cases. Current market price is checked against the actual trigger, target and invalidation levels; an untriggered setup remains waiting rather than being judged by the move since publication."
        />

        <Panel
          title="Article monitor"
          description="Switch between live price setups and the post-publication Change Meter. Search and category filters apply to both views."
        >
          {records.length ? (
            <ArticleMemoryWorkspace articles={records} />
          ) : (
            <DataState state="risk" title="Article records are updating" detail="No published records are available at the moment. No illustrative article values are inserted." />
          )}
        </Panel>
      </div>
    </LiveDeskShell>
  );
}
