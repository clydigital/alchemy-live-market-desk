"use client";

import { useMemo, useState, type CSSProperties } from "react";

import type {
  ArticleChangeDirection,
  ArticleChangeLinkBasis,
  ArticleIdeaDirection,
  ArticleIdeaSource,
  ArticleIdeaStatus,
} from "@/lib/article-idea-status";
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
  chartIdeas: Array<{
    id: string;
    storyId: string | null;
    storyTitle: string;
    storyHref: string;
    instrument: string;
    timeframe: string;
    overlay: string | null;
    question: string;
    confirmationArea: string | null;
    invalidationArea: string | null;
    targetArea: string | null;
    direction: ArticleIdeaDirection;
    currentPrice: number | null;
    publicationPrice: number | null;
    sincePublication: number | null;
    change5d: number | null;
    change21d: number | null;
    status: ArticleIdeaStatus;
    statusReason: string;
    sourceName: string | null;
    sourceUrl: string | null;
    marketLabel: string | null;
    isProxy: boolean;
    ideaSource: ArticleIdeaSource;
    tradingViewUrl: string | null;
  }>;
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

type ArticleTab = "charts" | "changes";

const IDEA_LABELS: Record<ArticleIdeaStatus, string> = {
  active: "Waiting",
  likely_validated: "Triggered",
  likely_invalidated: "Invalidated",
  target_hit: "Target hit",
  needs_review: "Review",
};

const DIRECTION_LABELS: Record<ArticleIdeaDirection, string> = {
  bullish: "Bullish case",
  bearish: "Bearish case",
  ambiguous: "Conditional case",
};

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

function formatPrice(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "N/A";
  return new Intl.NumberFormat("en-GB", { maximumFractionDigits: value >= 100 ? 2 : 4 }).format(value);
}

function ArticleVisual({ article }: { article: ArticleMemoryItem }) {
  return article.image ? (
    <a className={styles.image} href={article.url} target="_blank" rel="noreferrer">
      <img src={article.image} alt="" loading="lazy" referrerPolicy="no-referrer" />
    </a>
  ) : (
    <div className={styles.imageFallback}><span>Alchemy Markets</span><b>{article.category}</b></div>
  );
}

function ArticleHeading({ article }: { article: ArticleMemoryItem }) {
  return (
    <>
      <div className={styles.eyebrow}>
        <span>{article.category}</span>
        <time dateTime={article.publishedAt || undefined}>{article.publishedLabel}</time>
      </div>
      <a href={article.url} target="_blank" rel="noreferrer"><h3>{article.title}</h3></a>
      <p>{article.summary}</p>
      <div className={styles.meta}>{article.author}</div>
    </>
  );
}

function SetupCard({ idea, index }: { idea: ArticleMemoryItem["chartIdeas"][number]; index: number }) {
  const sourceExternal = idea.ideaSource === "published_article";
  return (
    <article className={styles.ideaCard} data-status={idea.status} data-direction={idea.direction}>
      <header className={styles.setupHeader}>
        <div className={styles.setupIdentity}>
          <span>Idea {index + 1} · {idea.instrument}</span>
          <strong>{DIRECTION_LABELS[idea.direction]}</strong>
          <small>{idea.overlay || (sourceExternal ? "Article-derived levels" : "Recorded chart levels")}</small>
        </div>
        <div className={styles.currentPrice} data-status={idea.status}>
          <span>Now</span>
          <b>{formatPrice(idea.currentPrice)}</b>
        </div>
      </header>

      <div className={styles.setupState}>
        <b>{IDEA_LABELS[idea.status]}</b>
        <span>{idea.statusReason}</span>
      </div>

      <div className={styles.levelGrid}>
        <div className={styles.triggerLevel}>
          <span>Trigger</span>
          <strong>{idea.confirmationArea || "Not extracted"}</strong>
        </div>
        <div className={styles.targetLevel}>
          <span>Target</span>
          <strong>{idea.targetArea || "Open"}</strong>
        </div>
        <div className={styles.invalidationLevel}>
          <span>Invalidate</span>
          <strong>{idea.invalidationArea || "Not recorded"}</strong>
        </div>
      </div>

      <div className={styles.ideaLinks}>
        {idea.tradingViewUrl ? <a href={idea.tradingViewUrl} target="_blank" rel="noreferrer">Chart ↗</a> : null}
        {idea.sourceUrl ? <a href={idea.sourceUrl} target="_blank" rel="noreferrer">Live price: {idea.sourceName || "market data"} ↗</a> : null}
        <a href={idea.storyHref} target={sourceExternal ? "_blank" : undefined} rel={sourceExternal ? "noreferrer" : undefined}>
          {sourceExternal ? "Source article ↗" : "Research Story →"}
        </a>
      </div>
    </article>
  );
}

export default function ArticleMemoryWorkspace({ articles }: { articles: ArticleMemoryItem[] }) {
  const [tab, setTab] = useState<ArticleTab>("charts");
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
        ...article.chartIdeas.flatMap((idea) => [idea.instrument, idea.question, idea.marketLabel || ""]),
        ...article.changeState.updates.map((update) => update.headline),
      ].some((value) => value.toLowerCase().includes(needle));
    });
  }, [articles, category, query]);

  const chartCount = articles.reduce((sum, article) => sum + article.chartIdeas.length, 0);
  const changedCount = articles.filter((article) => article.changeState.updateCount > 0).length;

  return (
    <div className={styles.workspace}>
      <div className={styles.tabs} role="tablist" aria-label="Article monitoring views">
        <button type="button" role="tab" aria-selected={tab === "charts"} className={tab === "charts" ? styles.activeTab : ""} onClick={() => setTab("charts")}>
          <span>Live Setups</span>
          <b>{chartCount}</b>
          <small>Key levels versus current price</small>
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
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, market, level or later change" />
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

      {tab === "charts" ? (
        <>
          <div className={styles.methodNote}>
            <strong>Level check</strong>
            <span>Each directional case is kept separately. Waiting means the trigger has not been reached. Triggered means the level has been crossed and the setup is still alive. Red is reserved for a setup that triggered and then invalidated.</span>
          </div>
          <div className={styles.grid}>
            {filtered.map((article) => (
              <article className={styles.card} id={`article-${article.id}`} key={article.id}>
                <ArticleVisual article={article} />
                <div className={styles.body}>
                  <ArticleHeading article={article} />

                  {article.chartIdeas.length ? (
                    <div className={styles.ideaList}>
                      {article.chartIdeas.map((idea, index) => <SetupCard idea={idea} index={index} key={idea.id} />)}
                    </div>
                  ) : (
                    <div className={styles.unlinked}>No usable support, resistance, trigger or target setup could be extracted from this article.</div>
                  )}

                  <footer>
                    <div>
                      {article.tradingViewLinks.length ? <span>{article.tradingViewLinks.length} TradingView link{article.tradingViewLinks.length === 1 ? "" : "s"}</span> : null}
                      {article.intakeStatus ? <span>{article.intakeStatus}</span> : null}
                      {article.candidateScore !== null ? <span>Research score {article.candidateScore}</span> : null}
                    </div>
                    <a href={`#article-${article.id}`}>Record #{article.id.slice(0, 10)}</a>
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
