import ArticleMemoryWorkspace from "@/components/live-desk/ArticleMemoryWorkspace";
import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import { DataState, formatDeskDate, MetricGrid, Panel } from "@/components/live-desk/LiveDeskUi";
import { getAlchemyArticles } from "@/lib/alchemy";
import { getDeskData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ArticlesPage() {
  const [articles, data] = await Promise.all([getAlchemyArticles(30), getDeskData()]);
  const storyBySlug = new Map(data.stories.map((story) => [story.slug, story]));
  const intakeByUrl = new Map(
    data.researchIntake
      .filter((item) => item.item_type === "alchemy_article")
      .map((item) => [item.url.replace(/\/$/, ""), item]),
  );

  const records = articles.map((article) => {
    const intake = intakeByUrl.get(article.url.replace(/\/$/, ""));
    const relatedStories = (intake?.affected_story_slugs || [])
      .flatMap((slug) => {
        const story = storyBySlug.get(slug);
        return story ? [{ title: story.title, href: `/stories/${story.slug}` }] : [];
      });

    return {
      id: article.id,
      title: article.title,
      url: article.url,
      category: article.category,
      publishedAt: article.publishedAt,
      publishedLabel: formatDeskDate(article.publishedAt),
      author: article.author,
      image: article.image,
      summary: article.summary,
      relatedStories,
      intakeStatus: intake?.status || null,
      candidateScore: typeof intake?.candidate_score === "number" ? intake.candidate_score : null,
    };
  });

  return (
    <LiveDeskShell
      activePath="/articles"
      title="Articles"
      description="Published Alchemy coverage, visual article memory and exact links back to the research Stories that informed each piece."
      meta={`${records.length} published records loaded`}
    >
      <div className={styles.grid}>
        <MetricGrid
          items={[
            { value: records.length, label: "Published articles" },
            { value: new Set(records.map((article) => article.category)).size, label: "Article categories" },
            { value: records.filter((article) => article.relatedStories.length).length, label: "Story-linked articles" },
            { value: data.researchIntake.filter((item) => item.item_type === "alchemy_article").length, label: "Article intake records" },
          ]}
        />

        <DataState
          state={records.some((article) => article.relatedStories.length) ? "ready" : "warn"}
          title={records.some((article) => article.relatedStories.length) ? "Article-to-Story links available" : "Published memory loaded without Story links"}
          detail="Story links are shown only when the article intake record explicitly names an affected Story. No title-keyword relationship is presented as a confirmed link."
        />

        <Panel
          title="Article memory"
          description="Search published coverage by title, category, author or explicitly linked research Story. Original article images and links remain external."
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
