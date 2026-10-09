import ArticleMemoryWorkspace from "@/components/live-desk/ArticleMemoryWorkspace";
import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import { DataState, formatDeskDate, MetricGrid, Panel } from "@/components/live-desk/LiveDeskUi";
import { getAlchemyArticles } from "@/lib/alchemy";
import { assessArticleChanges, type ArticleChangeLinkBasis } from "@/lib/article-idea-status";
import { articleSummaryBullets } from "@/lib/article-bullet-summary";
import { getDeskData } from "@/lib/data";
import { explicitlyMentionedAssets } from "@/lib/instrument-mentions";

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
  const [articles, data] = await Promise.all([getAlchemyArticles(30), getDeskData()]);
  const storyBySlug = new Map(data.stories.map((story) => [story.slug, story]));
  const storyById = new Map(data.stories.map((story) => [story.id, story]));
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

    const exactLinkCount = linkedStoryMap.size;

    if (!exactLinkCount) {
      // Keep article-to-Story discovery independent from speculative price setups.
      const mentionText = `${article.title} ${article.summary} ${article.bodyText.slice(0, 8_000)}`;
      const assetMatches = data.stories
        .map((story) => ({
          story,
          score: explicitlyMentionedAssets(mentionText, story.assets || []).length,
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
      summaryBullets: articleSummaryBullets(article),
      tradingViewLinks: article.tradingViewLinks,
      relatedStories,
      intakeStatus: intake?.status || null,
      candidateScore: typeof intake?.candidate_score === "number" ? intake.candidate_score : null,
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

  const changedArticles = records.filter((article) => article.changeState.updateCount > 0).length;

  return (
    <LiveDeskShell
      activePath="/articles"
      title="Articles"
      description="Quick takeaways from published Alchemy Markets articles, with links to the full story and later developments."
      meta={`${records.length} published records loaded`}
    >
      <div className={styles.grid}>
        <MetricGrid
          items={[
            { value: records.length, label: "Published articles" },
            { value: records.filter((article) => article.summaryBullets.length > 1).length, label: "Multi-point summaries" },
            { value: records.filter((article) => article.relatedStories.length).length, label: "Linked to research Stories" },
            { value: changedArticles, label: "Articles with later changes" },
          ]}
        />

        <DataState
          state={records.length ? "ready" : "warn"}
          title={records.length ? "Article summaries available" : "Awaiting published articles"}
          detail="Highlights come from each article's published copy, without invented trading scenarios or unrelated live prices. The Change Meter separately tracks updates linked to recorded research Stories."
        />

        <Panel
          title="Article monitor"
          description="Read the main points from each published article or switch to the post-publication Change Meter. Search and category filters apply to both views."
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
