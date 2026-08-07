"use client";

import { useMemo, useState } from "react";

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
  relatedStories: Array<{ title: string; href: string }>;
  intakeStatus: string | null;
  candidateScore: number | null;
};

export default function ArticleMemoryWorkspace({ articles }: { articles: ArticleMemoryItem[] }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("All");
  const categories = useMemo(() => Array.from(new Set(articles.map((article) => article.category))).sort(), [articles]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return articles.filter((article) => {
      if (category !== "All" && article.category !== category) return false;
      if (!needle) return true;
      return [article.title, article.summary, article.author, article.category, ...article.relatedStories.map((story) => story.title)]
        .some((value) => value.toLowerCase().includes(needle));
    });
  }, [articles, category, query]);

  return (
    <div className={styles.workspace}>
      <div className={styles.controls}>
        <label>
          <span>Search article memory</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, author, category or related Story" />
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

      <div className={styles.grid}>
        {filtered.map((article) => (
          <article className={styles.card} id={`article-${article.id}`} key={article.id}>
            {article.image ? (
              <a className={styles.image} href={article.url} target="_blank" rel="noreferrer">
                <img src={article.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
              </a>
            ) : (
              <div className={styles.imageFallback}><span>Alchemy Markets</span><b>{article.category}</b></div>
            )}
            <div className={styles.body}>
              <div className={styles.eyebrow}>
                <span>{article.category}</span>
                <time dateTime={article.publishedAt || undefined}>{article.publishedLabel}</time>
              </div>
              <a href={article.url} target="_blank" rel="noreferrer"><h3>{article.title}</h3></a>
              <p>{article.summary}</p>
              <div className={styles.meta}>{article.author}</div>

              {article.relatedStories.length ? (
                <div className={styles.storyLinks}>
                  <span>Linked research Stories</span>
                  {article.relatedStories.map((story) => <a key={story.href} href={story.href}>{story.title}</a>)}
                </div>
              ) : (
                <div className={styles.unlinked}>No Story link recorded in article intake.</div>
              )}

              <footer>
                <div>
                  {article.intakeStatus ? <span>{article.intakeStatus}</span> : null}
                  {article.candidateScore !== null ? <span>Research score {article.candidateScore}</span> : null}
                </div>
                <a href={`#article-${article.id}`}>Record #{article.id.slice(0, 10)}</a>
              </footer>
            </div>
          </article>
        ))}
      </div>

      {!filtered.length ? <div className={styles.empty}>No published articles match the current filters.</div> : null}
    </div>
  );
}
