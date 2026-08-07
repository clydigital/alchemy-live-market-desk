import ArticleMemoryWorkspace from "@/components/live-desk/ArticleMemoryWorkspace";
import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import { DataState, formatDeskDate, MetricGrid, Panel } from "@/components/live-desk/LiveDeskUi";
import { getAlchemyArticles } from "@/lib/alchemy";
import { assessArticleChanges, assessChartIdea } from "@/lib/article-idea-status";
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
    const linkedStoryMap = new Map<string, (typeof data.stories)[number]>();

    (intake?.affected_story_slugs || []).forEach((slug) => {
      const story = storyBySlug.get(slug);
      if (story) linkedStoryMap.set(story.id, story);
    });
    exactSources.forEach((source) => {
      if (!source.story_id) return;
      const story = storyById.get(source.story_id);
      if (story) linkedStoryMap.set(story.id, story);
    });

    const linkedStoryRecords = Array.from(linkedStoryMap.values());
    const relatedStories = linkedStoryRecords.map((story) => ({
      id: story.id,
      slug: story.slug,
      title: story.title,
      href: `/stories/${story.slug}`,
    }));

    const chartIdeas = linkedStoryRecords.flatMap((story) =>
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

    const sourcePublicationDate = exactSources
      .map((source) => source.publication_date || source.observation_date)
      .filter((value): value is string => Boolean(value))
      .sort()[0] || null;
    const publishedAt = article.publishedAt || sourcePublicationDate;
    const changeState = assessArticleChanges(
      publishedAt,
      linkedStoryRecords.map((story) => ({ id: story.id, slug: story.slug })),
      data.updates,
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
      description="Published article memory with two monitoring views: current-price checks for recorded chart ideas and a post-publication Change Meter."
      meta={`${records.length} published records loaded`}
    >
      <div className={styles.grid}>
        <MetricGrid
          items={[
            { value: records.length, label: "Published articles" },
            { value: records.filter((article) => article.chartIdeas.length).length, label: "Chart-linked articles" },
            { value: assessedIdeas, label: "Rules-assessed ideas" },
            { value: changedArticles, label: "Articles with later changes" },
          ]}
        />

        <DataState
          state={chartIdeas.length || changedArticles ? "ready" : "warn"}
          title={chartIdeas.length || changedArticles ? "Article monitoring records available" : "Published memory loaded without monitoring links"}
          detail="Article Charts uses exact article-source or intake links to persistent Stories, then compares their structured chart requests with current market series. Change Meter uses dated Story updates recorded after publication. Unstored targets are never presented as hit."
        />

        <Panel
          title="Article monitor"
          description="Switch between Article Charts and Change Meter. Search and category filters apply to both views."
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
