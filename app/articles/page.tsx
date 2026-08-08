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
      description="Published Alchemy coverage remains visible beside current Stories and research updates."
      meta={`${articles.length} published records loaded`}
    >
      <div className={styles.grid}>
        <MetricGrid
          items={[
            { value: articles.length, label: "Published articles" },
            { value: data.stories.length, label: "Tracked Stories" },
            { value: data.updates.length, label: "Recent Story events" },
            { value: data.researchIntake.filter((item) => item.item_type === "alchemy_article").length, label: "Article intake items" },
          ]}
        />

        <Panel
          title="Article memory"
          description="Source-backed Alchemy article records with publication date, author, category and original link."
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
              <DataState state="risk" title="Article records are updating" detail="No published records are available at the moment. No illustrative article values are inserted." />
            )}
          </div>
        </Panel>
      </div>
    </LiveDeskShell>
  );
}
