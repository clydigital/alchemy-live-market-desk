import LiveDeskShell, { styles } from "@/components/live-desk/LiveDeskShell";
import { Badge, DataState, formatDeskDate, MetricGrid, Panel } from "@/components/live-desk/LiveDeskUi";
import { getAlchemyArticles } from "@/lib/alchemy";
import { getDeskData } from "@/lib/data";

export const dynamic = "force-dynamic";

export default async function ArticlesPage() {
  const [articles, data] = await Promise.all([getAlchemyArticles(24), getDeskData()]);

  return (
    <LiveDeskShell
      activePath="/articles"
      title="Articles"
      description="Published Alchemy coverage remains linked to the current research engine. Durable comparison history and duplicate decisions remain a later persistence task."
      meta={`${articles.length} published records loaded`}
    >
      <div className={styles.grid}>
        <MetricGrid
          items={[
            { value: articles.length, label: "Published articles" },
            { value: data.stories.length, label: "Active Stories" },
            { value: data.updates.length, label: "Recent Story events" },
            { value: data.researchIntake.filter((item) => item.item_type === "alchemy_article").length, label: "Article intake items" },
          ]}
        />

        <Panel
          title="Article memory"
          description="These are source-backed Alchemy article records. PR 4 will persist article-to-Story comparisons and rejection reasons rather than calculating them only in the client."
        >
          <div className={styles.recordList}>
            {articles.length ? articles.map((article) => (
              <article className={styles.record} key={article.id}>
                <div className={styles.recordHeader}>
                  <div>
                    <a href={article.url} target="_blank" rel="noreferrer"><h3>{article.title}</h3></a>
                    <div className={styles.meta}>{article.author} · {formatDeskDate(article.publishedAt)}</div>
                  </div>
                  <Badge>{article.category}</Badge>
                </div>
                <p>{article.summary}</p>
              </article>
            )) : (
              <DataState state="risk" title="No article records returned" detail="The Alchemy article loader returned no records. No mock article values are inserted." />
            )}
          </div>
        </Panel>
      </div>
    </LiveDeskShell>
  );
}
