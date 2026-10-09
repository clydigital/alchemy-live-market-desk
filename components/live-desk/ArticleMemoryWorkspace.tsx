"use client";

import { useMemo, useState, type CSSProperties } from "react";

import type { ArticleChangeDirection, ArticleChangeLinkBasis } from "@/lib/article-idea-status";
import styles from "./article-memory-workspace.module.css";

export type ArticleMemoryItem = {
  id: string;
  title: string;
  url: string;
  category: string;
  publishedAt: string | null;
  publishedLabel: string;
  author: string;
  image: string | null;
  summary: string;
  tradingViewLinks: string[];
  relatedStories: Array<{ id: string; slug: string; title: string; href: string; relation: "exact" | "asset" }>;
  intakeStatus: string | null;
  candidateScore: number | null;
  summaryBullets: string[];
  changeState: {
    load: number;
    direction: ArticleChangeDirection;
    updateCount: number;
    latestUpdateAt: string | null;
    latestUpdateLabel: string;
    summary: string;
    linkBasis: ArticleChangeLinkBasis;
    updates: Array<{
      id: string;
      type: string;
      headline: string;
      detail: string | null;
      date: string;
      dateLabel: string;
      href: string;
      directionalWeight: number;
      intensityWeight: number;
    }>;
  };
};

type ArticleTab = "summaries" | "changes";

const CHANGE_LABELS: Record<ArticleChangeDirection, string> = {
  reinforced: "Reinforced",
  mixed: "Mixed change",
  challenged: "Challenged",
  invalidated: "Invalidated",
  unchanged: "No recorded change",
};

const LINK_BASIS_LABELS: Record<ArticleChangeLinkBasis, string> = {
  exact: "Exact article-to-Story link",
  asset: "Shared recorded asset",
  none: "No Story relationship",
};

function ArticleVisual({ article }: { article: ArticleMemoryItem }) {
  return article.image ? (
    <a className={styles.image} href={article.url} target="_blank" rel="noreferrer">
      <img src={article.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
    </a>
  ) : (
    <div className={styles.imageFallback}><span>Alchemy Markets</span><b>{article.category}</b></div>
  );
}

function ArticleHeading({ article, showSummary = true }: { article: ArticleMemoryItem; showSummary?: boolean }) {
  return (
    <>
      <div className={styles.eyebrow}>
        <span>{article.category}</span>
        <time dateTime={article.publishedAt || undefined}>{article.publishedLabel}</time>
      </div>
      <a href={article.url} target="_blank" rel="noreferrer"><h3>{article.title}</h3></a>
      {showSummary ? <p>{article.summary}</p> : null}
      <div className={styles.meta}>{article.author}</div>
    </>
  );
}

export default function ArticleMemoryWorkspace({ articles }: { articles: ArticleMemoryItem[] }) {
  const [tab, setTab] = useState<ArticleTab>("summaries");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const categories = useMemo(() => Array.from(new Set(articles.map((article) => article.category))).sort(), [articles]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return articles.filter((article) => {
      if (category !== "All" && article.category !== category) return false;
      if (!needle) return true;
      return [
        article.title,
        article.summary,
        article.author,
        article.category,
        ...article.relatedStories.map((story) => story.title),
        ...article.summaryBullets,
        ...article.changeState.updates.map((update) => update.headline),
      ].some((value) => value.toLowerCase().includes(needle));
    });
  }, [articles, category, query]);

  const changedCount = articles.filter((article) => article.changeState.updateCount > 0).length;

  return (
    <div className={styles.workspace}>
      <div className={styles.tabs} role="tablist" aria-label="Article monitoring views">
        <button type="button" role="tab" aria-selected={tab === "summaries"} className={tab === "summaries" ? styles.activeTab : ""} onClick={() => setTab("summaries")}>
          <span>Article Summaries</span>
          <b>{articles.length}</b>
          <small>Published takeaways in bullet points</small>
        </button>
        <button type="button" role="tab" aria-selected={tab === "changes"} className={tab === "changes" ? styles.activeTab : ""} onClick={() => setTab("changes")}>
          <span>Change Meter</span>
          <b>{changedCount}</b>
          <small>News and evidence since publication</small>
        </button>
      </div>

      <div className={styles.controls}>
        <label>
          <span>Search article memory</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, topic, takeaway or later change" />
        </label>
        <label>
          <span>Category</span>
          <select value={category} onChange={(event) => setCategory(event.target.value)}>
            <option>All</option>
            {categories.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>

      <div className={styles.resultLine}>{filtered.length} of {articles.length} published records shown</div>

      {tab === "summaries" ? (
        <>
          <div className={styles.grid}>
            {filtered.map((article) => (
              <article className={styles.card} id={`article-${article.id}`} key={article.id}>
                <ArticleVisual article={article} />
                <div className={styles.body}>
                  <ArticleHeading article={article} showSummary={false} />

                  <section className={styles.highlights} aria-label="Article key takeaways">
                    <strong>Key takeaways</strong>
                    {article.summaryBullets.length ? (
                      <ul>
                        {article.summaryBullets.map((bullet, index) => <li key={index}>{bullet}</li>)}
                      </ul>
                    ) : (
                      <p>Article text is not available for a reliable summary.</p>
                    )}
                  </section>

                  <footer>
                    <div>
                      {article.tradingViewLinks.map((link, index) => (
                        <a key={link} href={link} target="_blank" rel="noreferrer">Chart {index + 1} ↗</a>
                      ))}
                    </div>
                    <a href={article.url} target="_blank" rel="noreferrer">Read full article ↗</a>
                  </footer>
                </div>
              </article>
            ))}
          </div>
        </>
      ) : (
        <div className={styles.changeGrid}>
          {filtered.map((article) => {
            const meterStyle = { "--change-load": `${article.changeState.load}%` } as CSSProperties;
            return (
              <article className={`${styles.card} ${styles.changeCard}`} id={`change-${article.id}`} key={article.id}>
                <ArticleVisual article={article} />
                <div className={styles.body}>
                  <ArticleHeading article={article} />

                  <section className={styles.changeSummary} data-direction={article.changeState.direction}>
                    <header>
                      <div>
                        <span>Change since publication</span>
                        <strong>{CHANGE_LABELS[article.changeState.direction]}</strong>
                      </div>
                      <b>{article.changeState.load}</b>
                    </header>
                    <div className={styles.meterTrack} style={meterStyle}><i /></div>
                    <p>{article.changeState.summary}</p>
                    <div className={styles.changeMeta}>
                      <span>{article.changeState.updateCount} linked update{article.changeState.updateCount === 1 ? "" : "s"}</span>
                      <span>{LINK_BASIS_LABELS[article.changeState.linkBasis]}</span>
                      <span>{article.changeState.latestUpdateAt ? `Latest ${article.changeState.latestUpdateLabel}` : "No later dated change"}</span>
                    </div>
                  </section>

                  {article.changeState.updates.length ? (
                    <div className={styles.changeUpdates}>
                      {article.changeState.updates.map((update) => (
                        <a href={update.href} key={update.id}>
                          <span>{update.type}</span>
                          <strong>{update.headline}</strong>
                          <small>{update.dateLabel}</small>
                        </a>
                      ))}
                    </div>
                  ) : null}

                  <div className={styles.storyLinks}>
                    <span>Related research Stories</span>
                    {article.relatedStories.length
                      ? article.relatedStories.map((story) => (
                        <a key={story.href} href={story.href}>
                          {story.title} <small>{story.relation === "exact" ? "exact link" : "shared asset"}</small>
                        </a>
                      ))
                      : <small>No exact or asset-matched Story is recorded.</small>}
                  </div>

                  <footer>
                    <div><span>Change load, not a trading signal</span></div>
                    <a href={`#change-${article.id}`}>Record #{article.id.slice(0, 10)}</a>
                  </footer>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {!filtered.length ? <div className={styles.empty}>No published articles match the current filters.</div> : null}
    </div>
  );
}
