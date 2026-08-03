"use client";

import { useMemo, useState } from "react";
import type { AlchemyArticle } from "@/lib/alchemy";
import type { ChartRequest, EarningsCall, Story, Update } from "@/lib/data";

type Props = {
  stories: Story[];
  calls: EarningsCall[];
  updates: Update[];
  charts: ChartRequest[];
  articles: AlchemyArticle[];
};

type Tab = "Overview" | "Stories" | "Articles" | "Signals" | "Earnings" | "Charts" | "Ledger";
type ArticleFilter = "All" | "Revisit now" | "Material evolution" | "Incremental" | "Little changed";
type Range = "7D" | "30D" | "90D" | "1Y";

type DisplayStory = {
  id: string;
  slug: string;
  title: string;
  thesis: string;
  confidence: number;
  support: string;
  contradiction: string;
  marketQuestion: string;
  next: string;
  status: string;
  assets: string[];
};

type ArticleMemory = AlchemyArticle & {
  story: DisplayStory | null;
  alignment: number;
  changeScore: number;
  changeLabel: Exclude<ArticleFilter, "All">;
  changeKey: "stable" | "incremental" | "material" | "revisit";
  latestChange: string;
  changeDetail: string;
  materialUpdates: Update[];
};

const stopWords = new Set(["the", "and", "for", "with", "that", "this", "from", "into", "after", "before", "over", "under", "what", "will", "can", "could", "should", "market", "markets", "alchemy", "today", "week", "latest", "strong", "higher", "lower"]);

function tokens(value: string) {
  return [...new Set(value.toLowerCase().split(/[^a-z0-9]+/).filter((word) => word.length > 2 && !stopWords.has(word)))];
}

function articleDate(value: string | null) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function articleLevel(score: number): Pick<ArticleMemory, "changeLabel" | "changeKey"> {
  if (score >= 70) return { changeLabel: "Revisit now", changeKey: "revisit" };
  if (score >= 45) return { changeLabel: "Material evolution", changeKey: "material" };
  if (score >= 20) return { changeLabel: "Incremental", changeKey: "incremental" };
  return { changeLabel: "Little changed", changeKey: "stable" };
}

function updateWeight(update: Update) {
  const text = `${update.update_type} ${update.headline} ${update.detail || ""}`.toLowerCase();
  if (/invalid|reversal|contradiction|break|shock|intervention/.test(text)) return 30;
  if (/earnings|guidance|policy|confirmed|confirmation|evidence/.test(text)) return 21;
  if (/catalyst|data|price|technical|monitor/.test(text)) return 14;
  return 10;
}

const fallbackStories: DisplayStory[] = [
  {
    id: "earnings-support",
    slug: "earnings-support",
    title: "Can earnings keep the market alive?",
    thesis: "Strong results can support the index, but guidance, breadth and the rate backdrop decide whether the support lasts.",
    confidence: 60,
    support: "Headline earnings growth remains strong and major cloud platforms are still reporting robust demand.",
    contradiction: "The index can rise while the average stock, free cash flow and market breadth remain fragile.",
    marketQuestion: "Are earnings improving faster than the discount rate and valuation pressure?",
    next: "AMD earnings, ISM data and the US employment report.",
    status: "active",
    assets: ["SPX", "NDX", "RSP"],
  },
  {
    id: "ai-capex",
    slug: "ai-capex",
    title: "AI revenue versus capex",
    thesis: "Demand is real, but the market is separating visible monetisation from spending that still requires patience.",
    confidence: 57,
    support: "Cloud growth, backlog and accelerator demand continue to expand.",
    contradiction: "Capex, depreciation and cash-flow pressure are rising faster at several spenders.",
    marketQuestion: "Is AI-linked revenue scaling quickly enough to justify the buildout?",
    next: "AMD Data Center growth, gross margin and guidance.",
    status: "monitor",
    assets: ["AMD", "MSFT", "AMZN", "GOOGL"],
  },
  {
    id: "oil-physical",
    slug: "oil-physical",
    title: "Oil peace versus physical tightness",
    thesis: "Crude can price diplomatic relief before tanker access, freight and refined-product supply normalise.",
    confidence: 54,
    support: "Product cracks and shipping constraints can remain tight even as crude falls.",
    contradiction: "OPEC+ supply additions and de-escalation can remove the immediate risk premium.",
    marketQuestion: "Is the market removing geopolitical premium faster than physical conditions improve?",
    next: "Hormuz traffic, freight, inventories and product cracks.",
    status: "monitor",
    assets: ["WTI", "BRENT", "ULSD"],
  },
  {
    id: "yen-unwind",
    slug: "yen-unwind",
    title: "Yen carry unwind",
    thesis: "Intervention can trigger the move, but rates and cross-yen breadth decide whether it becomes durable.",
    confidence: 48,
    support: "Broad yen buying and stretched positioning can accelerate quickly.",
    contradiction: "The carry advantage remains substantial while the US-Japan rate gap stays wide.",
    marketQuestion: "Is the yen move broad enough to become a sustained carry unwind?",
    next: "USDJPY, AUDJPY and GBPJPY confirmation.",
    status: "watch",
    assets: ["USDJPY", "AUDJPY", "GBPJPY"],
  },
];

const fallbackCharts = [
  { id: "c1", instrument: "SPX vs RSP", timeframe: "Daily", question: "Is earnings support broadening beyond megacaps?", overlay: "Equal-weight comparison", status: "requested" },
  { id: "c2", instrument: "AMD · SOXX · Nasdaq", timeframe: "Daily", question: "Is AMD entering results as a leader or crowded rebound?", overlay: "Indexed performance", status: "requested" },
  { id: "c3", instrument: "Hyperscaler capex vs FCF", timeframe: "Quarterly", question: "Which AI spenders are converting investment into cash?", overlay: "Cloud growth", status: "requested" },
];

const trendPaths: Record<Range, { primary: string; secondary: string }> = {
  "7D": {
    primary: "M0 180 C70 155 105 170 165 138 S270 104 335 123 S455 78 520 98 S650 45 720 66 S840 55 920 24",
    secondary: "M0 236 C90 224 150 230 220 205 S350 199 430 178 S565 166 650 141 S780 132 920 108",
  },
  "30D": {
    primary: "M0 195 C80 150 135 183 205 142 S320 92 390 126 S505 88 575 105 S700 50 770 72 S860 48 920 30",
    secondary: "M0 250 C100 235 150 246 235 214 S355 222 420 180 S555 184 650 151 S780 145 920 112",
  },
  "90D": {
    primary: "M0 212 C85 192 140 202 215 160 S330 128 400 144 S520 94 590 119 S700 73 785 83 S865 62 920 42",
    secondary: "M0 264 C95 252 155 258 235 230 S360 212 430 218 S565 185 650 176 S790 148 920 132",
  },
  "1Y": {
    primary: "M0 230 C65 208 125 239 190 190 S300 158 365 174 S470 115 550 140 S680 90 755 96 S845 68 920 44",
    secondary: "M0 278 C80 264 155 271 220 251 S340 236 425 229 S560 205 650 190 S790 174 920 150",
  },
};

function clamp(value: number | null | undefined, fallback = 55) {
  return Math.max(0, Math.min(100, Math.round(value ?? fallback)));
}

function shorten(value: string, max = 26) {
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function Icon({ name }: { name: string }) {
  const icons: Record<string, string> = {
    Overview: "▦",
    Stories: "⌘",
    Articles: "▤",
    Signals: "⌁",
    Earnings: "◫",
    Charts: "⌁",
    Ledger: "▣",
  };
  return <span aria-hidden="true">{icons[name] || "✦"}</span>;
}

export default function MarketWorkspace({ stories, calls, updates, charts, articles }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("Overview");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [range, setRange] = useState<Range>("30D");
  const [showActions, setShowActions] = useState(false);
  const [signalWindow, setSignalWindow] = useState<"This week" | "This month">("This week");
  const [articleFilter, setArticleFilter] = useState<ArticleFilter>("All");
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(null);

  const storyViews = useMemo<DisplayStory[]>(() => {
    if (!stories.length) return fallbackStories;
    return stories.slice(0, 8).map((story) => ({
      id: story.id,
      slug: story.slug,
      title: story.title,
      thesis: story.thesis,
      confidence: clamp(story.confidence),
      support: story.strongest_support || story.best_explanation || "Primary evidence remains under review.",
      contradiction: story.strongest_contradiction || "The tape and the evidence are not fully aligned.",
      marketQuestion: story.market_question || "What would force the market to change its current view?",
      next: story.next_catalyst || "Next official release or cross-asset confirmation.",
      status: story.article_verdict || story.status,
      assets: story.assets || [],
    }));
  }, [stories]);

  const articleMemory = useMemo<ArticleMemory[]>(() => {
    return articles.map((article) => {
      const articleWords = tokens(`${article.title} ${article.summary} ${article.category}`);
      const articleText = `${article.title} ${article.summary}`.toLowerCase();
      const ranked = storyViews.map((story) => {
        const storyWords = tokens(`${story.title} ${story.thesis} ${story.marketQuestion} ${story.assets.join(" ")}`);
        const shared = articleWords.filter((word) => storyWords.includes(word));
        const assetHit = story.assets.some((asset) => articleText.includes(asset.toLowerCase()));
        const score = Math.min(100, shared.length * 15 + (assetHit ? 25 : 0));
        return { story, score };
      }).sort((a, b) => b.score - a.score);
      const match = ranked[0]?.score >= 15 ? ranked[0] : null;
      const published = article.publishedAt ? new Date(article.publishedAt).getTime() : 0;
      const materialUpdates = match ? updates
        .filter((update) => update.story_id === match.story.id && (!published || new Date(update.created_at).getTime() > published))
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()) : [];
      const updateScore = materialUpdates.reduce((sum, update) => sum + updateWeight(update), 0);
      const latestAge = materialUpdates[0] ? (Date.now() - new Date(materialUpdates[0].created_at).getTime()) / 86400000 : 999;
      const recencyBoost = materialUpdates.length ? (latestAge <= 2 ? 16 : latestAge <= 7 ? 10 : 4) : 0;
      const confidenceBoost = materialUpdates.length && match && match.story.confidence >= 65 ? 6 : 0;
      const changeScore = Math.min(100, materialUpdates.length ? updateScore + recencyBoost + confidenceBoost : match ? 8 : 0);
      const level = articleLevel(changeScore);
      const latest = materialUpdates[0];
      return {
        ...article,
        story: match?.story || null,
        alignment: match?.score || 0,
        changeScore,
        ...level,
        latestChange: latest?.headline || "No material change recorded since publication.",
        changeDetail: latest?.detail || (match ? `The published view still maps to ${match.story.title}, but the research ledger has not recorded enough new evidence to justify a full recovery yet.` : "No active desk story currently has a strong enough overlap with this article."),
        materialUpdates,
      };
    }).sort((a, b) => b.changeScore - a.changeScore || new Date(b.publishedAt || 0).getTime() - new Date(a.publishedAt || 0).getTime());
  }, [articles, storyViews, updates]);

  const filteredArticles = articleMemory.filter((article) => articleFilter === "All" || article.changeLabel === articleFilter);
  const selectedArticle = articleMemory.find((article) => article.id === selectedArticleId) || filteredArticles[0] || articleMemory[0];
  const revisitArticles = articleMemory.filter((article) => article.changeKey === "revisit" || article.changeKey === "material");

  const chartViews = charts.length
    ? charts.slice(0, 6).map((chart) => ({
        id: chart.id,
        instrument: chart.instrument,
        timeframe: chart.timeframe,
        question: chart.question,
        overlay: chart.overlay || "No overlay",
        status: chart.status,
      }))
    : fallbackCharts;

  const activeStory = storyViews[selectedIndex % storyViews.length];
  const pulse = Math.round(storyViews.slice(0, 3).reduce((sum, story) => sum + story.confidence, 0) / Math.min(3, storyViews.length));
  const activeSignals = storyViews.slice(0, 4);
  const dataSources = Math.max(7, charts.length + calls.length + 3);
  const keySignals = Math.max(12, storyViews.length * 3);
  const hypotheses = Math.max(4, Math.ceil(storyViews.length / 2));
  const paths = trendPaths[range];

  function openAction(tab: Tab) {
    setActiveTab(tab);
    setShowActions(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <main className="site-stage">
      <section className="workspace-shell">
        <header className="workspace-hero">
          <div>
            <span className="eyebrow">RESEARCH WORKSPACE</span>
            <h1>Market Intelligence<br />Workspace</h1>
            <p>Connect evidence, test hypotheses and track what can change the market.</p>
          </div>
          <button className="new-research" onClick={() => setShowActions(true)}><span>✣</span> New research <b>＋</b></button>
        </header>

        <nav className="workspace-tabs" aria-label="Workspace sections">
          {(["Overview", "Stories", "Articles", "Signals", "Earnings", "Charts", "Ledger"] as Tab[]).map((tab) => (
            <button key={tab} className={activeTab === tab ? "active" : ""} onClick={() => setActiveTab(tab)}>
              <Icon name={tab} /> {tab}
            </button>
          ))}
        </nav>

        {activeTab === "Overview" && (
          <div className="overview-grid">
            <article className="panel snapshot-panel">
              <PanelTitle icon="✦" title="Research snapshot" />
              <div className="metric-row">
                <Metric value={storyViews.length} label="Active stories" tone="purple" />
                <Metric value={dataSources} label="Data sources" tone="blue" />
                <Metric value={keySignals} label="Key signals" tone="green" />
                <Metric value={hypotheses} label="Hypotheses" tone="amber" />
              </div>
              <div className="mini-chart-head"><span>Momentum this week <i>i</i></span><strong>↗ 23%</strong></div>
              <svg className="mini-chart" viewBox="0 0 700 190" preserveAspectRatio="none" aria-label="Momentum trend">
                <defs><linearGradient id="miniFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#8d4dff" stopOpacity=".48"/><stop offset="100%" stopColor="#8d4dff" stopOpacity="0"/></linearGradient></defs>
                <path className="chart-grid" d="M0 45H700 M0 95H700 M0 145H700" />
                <path className="chart-area" d="M0 152 C75 113 120 142 185 108 S292 76 352 100 S455 57 520 76 S620 32 700 40 L700 190 L0 190Z" />
                <path className="chart-line" d="M0 152 C75 113 120 142 185 108 S292 76 352 100 S455 57 520 76 S620 32 700 40" />
              </svg>
              <div className="chart-dates"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span></div>
            </article>

            <article className="panel pulse-panel">
              <div className="panel-title-row">
                <PanelTitle icon="⌁" title="Market pulse" />
                <button className="select-button" onClick={() => setSignalWindow(signalWindow === "This week" ? "This month" : "This week")}>{signalWindow}⌄</button>
              </div>
              <div className="pulse-content">
                <div><b>{pulse}</b><span>Market score ⓘ</span><strong>{pulse >= 60 ? "Constructive" : pulse >= 50 ? "Balanced" : "Fragile"}</strong></div>
                <div className="donut" style={{ "--score": `${pulse * 3.6}deg` } as React.CSSProperties}><span>{pulse}</span></div>
              </div>
            </article>

            <article className="panel story-map-panel">
              <div className="panel-title-row"><PanelTitle icon="⌘" title="Story map" /><button className="ghost-button" onClick={() => setActiveTab("Stories")}>View all</button></div>
              <div className="story-map">
                <svg viewBox="0 0 600 360" preserveAspectRatio="none" aria-hidden="true">
                  <path d="M300 182 C245 88 185 83 112 75" />
                  <path d="M300 182 C355 88 425 78 500 90" />
                  <path d="M300 182 C380 208 452 240 515 286" />
                  <path d="M300 182 C220 225 170 255 92 282" />
                  <path d="M300 182 C300 122 298 76 300 28" />
                </svg>
                <button className="story-core" onClick={() => setActiveTab("Stories")}><small>SELECTED STORY</small><b>{shorten(activeStory.title, 32)}</b><span>{activeStory.confidence}%</span></button>
                {storyViews.slice(0, 5).map((story, index) => (
                  <button key={story.id} className={`story-node node-${index + 1} ${selectedIndex === index ? "selected" : ""}`} onClick={() => setSelectedIndex(index)}>{shorten(story.title, 22)}</button>
                ))}
              </div>
            </article>

            <article className="panel signals-panel">
              <div className="panel-title-row"><PanelTitle icon="ϟ" title="Top signals" /><button className="ghost-link" onClick={() => setActiveTab("Signals")}>View all</button></div>
              <div className="signal-list">
                {activeSignals.map((story, index) => (
                  <button key={story.id} onClick={() => { setSelectedIndex(index); setActiveTab("Stories"); }}>
                    <i className={story.confidence >= 60 ? "up" : story.confidence >= 50 ? "mixed" : "down"}>{story.confidence >= 60 ? "↗" : story.confidence >= 50 ? "⌁" : "↘"}</i>
                    <span><b>{shorten(story.title, 28)}</b><small>{story.status} · {story.next}</small></span>
                    <strong>{story.confidence}</strong>
                  </button>
                ))}
              </div>
            </article>

            <article className="panel trend-panel">
              <div className="panel-title-row">
                <PanelTitle icon="▥" title="Trend preview" />
                <div className="range-tabs">{(["7D", "30D", "90D", "1Y"] as Range[]).map((item) => <button key={item} className={range === item ? "active" : ""} onClick={() => setRange(item)}>{item}</button>)}</div>
              </div>
              <div className="trend-legend"><span>Relative market attention</span><i className="purple-dot"/>Central story<i className="blue-dot"/>Confirmation basket</div>
              <svg className="trend-chart" viewBox="0 0 920 300" preserveAspectRatio="none" aria-label="Trend comparison">
                <path className="chart-grid" d="M0 55H920 M0 115H920 M0 175H920 M0 235H920" />
                <path className="trend-primary" d={paths.primary} />
                <path className="trend-secondary" d={paths.secondary} />
              </svg>
              <div className="trend-axis"><span>Start</span><span>25%</span><span>50%</span><span>75%</span><span>Now</span></div>
            </article>

            <article className="panel coverage-preview">
              <div className="panel-title-row"><PanelTitle icon="▤" title="Alchemy article memory" /><button className="ghost-button" onClick={() => setActiveTab("Articles")}>Open coverage map</button></div>
              <div className="coverage-summary"><div><b>{articleMemory.length}</b><span>recent pieces scanned</span></div><div><b>{revisitArticles.length}</b><span>materially evolved</span></div><p>Prior coverage is not a reason to ignore a story. The colour shows how much the evidence has changed since publication.</p></div>
              <div className="coverage-preview-list">{articleMemory.slice(0, 3).map((article) => <button key={article.id} className={`change-${article.changeKey}`} onClick={() => { setSelectedArticleId(article.id); setActiveTab("Articles"); }}><span><small>{article.author} · {articleDate(article.publishedAt)}</small><b>{article.title}</b><em>{article.story ? `Aligns with ${article.story.title}` : "No strong current match"}</em></span><strong>{article.changeScore}<small>change</small></strong></button>)}</div>
            </article>
          </div>
        )}

        {activeTab === "Stories" && (
          <div className="stories-layout tab-page">
            <section className="story-list-panel panel">
              <div className="section-heading"><span>ACTIVE STORIES</span><h2>Choose the question, not the headline</h2></div>
              <div className="story-list">
                {storyViews.map((story, index) => (
                  <button key={story.id} className={selectedIndex === index ? "active" : ""} onClick={() => setSelectedIndex(index)}>
                    <i>{String(index + 1).padStart(2, "0")}</i>
                    <span><b>{story.title}</b><small>{story.marketQuestion}</small></span>
                    <strong>{story.confidence}%</strong>
                  </button>
                ))}
              </div>
            </section>
            <article className="panel story-detail">
              <header><div><span>{activeStory.status}</span><h2>{activeStory.title}</h2></div><div className="confidence-orb"><b>{activeStory.confidence}</b><small>confidence</small></div></header>
              <p className="story-thesis">{activeStory.thesis}</p>
              <div className="evidence-grid">
                <Evidence title="Why the market may be right" text={activeStory.support} tone="support" />
                <Evidence title="Strongest contradiction" text={activeStory.contradiction} tone="risk" />
                <Evidence title="Central question" text={activeStory.marketQuestion} tone="neutral" />
                <Evidence title="Next deciding test" text={activeStory.next} tone="next" />
              </div>
              <footer>{activeStory.assets.map((asset) => <span key={asset}>{asset}</span>)}</footer>
              <div className="related-coverage"><div><small>PRIOR ALCHEMY COVERAGE</small><b>Has this story moved enough to revisit?</b></div>{articleMemory.filter((article) => article.story?.id === activeStory.id).slice(0, 3).map((article) => <button className={`change-${article.changeKey}`} key={article.id} onClick={() => { setSelectedArticleId(article.id); setActiveTab("Articles"); }}><span>{article.title}</span><strong>{article.changeScore}</strong></button>)}{!articleMemory.some((article) => article.story?.id === activeStory.id) && <p>No recent Alchemy piece has a strong match with this story.</p>}</div>
            </article>
          </div>
        )}

        {activeTab === "Articles" && (
          <div className="articles-page tab-page">
            <header className="article-memory-header"><div><span>ALCHEMY ARTICLE MEMORY</span><h2>What have we already said, and what changed?</h2><p>Every piece keeps its published view. Live stories and material updates decide whether it is stable, evolving or ready to revisit.</p></div><div className="change-legend"><span className="change-stable">Little changed</span><span className="change-incremental">Incremental</span><span className="change-material">Material evolution</span><span className="change-revisit">Revisit now</span></div></header>
            <div className="article-filters">{(["All", "Revisit now", "Material evolution", "Incremental", "Little changed"] as ArticleFilter[]).map((filter) => <button key={filter} className={articleFilter === filter ? "active" : ""} onClick={() => setArticleFilter(filter)}>{filter}<b>{filter === "All" ? articleMemory.length : articleMemory.filter((article) => article.changeLabel === filter).length}</b></button>)}</div>
            <div className="article-memory-layout">
              <section className="article-feed">{filteredArticles.map((article) => <article key={article.id} className={`article-card change-${article.changeKey} ${selectedArticle?.id === article.id ? "selected" : ""}`} tabIndex={0} role="button" onClick={() => setSelectedArticleId(article.id)} onKeyDown={(event) => { if (event.key === "Enter") setSelectedArticleId(article.id); }}><div className="article-image" style={article.image ? { backgroundImage: `linear-gradient(180deg, rgba(15,17,43,.05), rgba(15,17,43,.88)), url(${article.image})` } : undefined}><span>{article.category}</span><strong>{article.changeScore}<small>change</small></strong></div><div className="article-copy"><small>{article.author} · {articleDate(article.publishedAt)}</small><h3>{article.title}</h3><p>{article.summary}</p><div><span>{article.story ? `↳ ${article.story.title}` : "No current match"}</span><a href={article.url} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()}>Open piece ↗</a></div></div></article>)}</section>
              {selectedArticle && <aside className={`panel article-detail-panel change-${selectedArticle.changeKey}`}><div className="article-detail-image" style={selectedArticle.image ? { backgroundImage: `linear-gradient(180deg, rgba(14,16,42,.1), #15183a), url(${selectedArticle.image})` } : undefined}><span>{selectedArticle.category}</span><b>{selectedArticle.changeLabel}</b></div><small>{selectedArticle.author} · {articleDate(selectedArticle.publishedAt)}</small><h2>{selectedArticle.title}</h2><div className="change-meter"><span style={{ width: `${selectedArticle.changeScore}%` }} /><b>{selectedArticle.changeScore}/100 change intensity</b></div><section><small>PUBLISHED VIEW</small><p>{selectedArticle.summary}</p></section><section><small>CURRENT STORY ALIGNMENT</small><p>{selectedArticle.story ? `${selectedArticle.alignment}% match with “${selectedArticle.story.title}”. ${selectedArticle.story.thesis}` : "No active story currently clears the alignment threshold."}</p></section><section><small>WHAT CHANGED</small><h3>{selectedArticle.latestChange}</h3><p>{selectedArticle.changeDetail}</p></section><div className="article-detail-actions"><a href={selectedArticle.url} target="_blank" rel="noreferrer">Read original article ↗</a>{selectedArticle.story && <button onClick={() => { const index = storyViews.findIndex((story) => story.id === selectedArticle.story?.id); if (index >= 0) setSelectedIndex(index); setActiveTab("Stories"); }}>Open aligned story →</button>}</div></aside>}
            </div>
          </div>
        )}

        {activeTab === "Signals" && (
          <div className="signals-page tab-page">
            <article className="panel central-question">
              <span>CENTRAL QUESTION 01</span>
              <h2>Can earnings quality outrun yields, valuation and weak breadth?</h2>
              <div className="question-score"><div className="donut small" style={{ "--score": `${pulse * 3.6}deg` } as React.CSSProperties}><span>{pulse}</span></div><p>Support remains possible, but good results must create broader positive reactions rather than only protect the index.</p></div>
              <div className="condition-row"><Condition label="Confirms" text="Beat breadth, better guidance and stronger equal-weight participation."/><Condition label="Invalidates" text="Good results are sold while yields and volatility rise."/></div>
            </article>
            <article className="panel central-question ai-question">
              <span>CENTRAL QUESTION 02</span>
              <h2>Is AI-linked revenue scaling fast enough to justify capex?</h2>
              <div className="pipeline-row">{["CAPEX", "CAPACITY", "USAGE", "REVENUE", "CASH"].map((step, index) => <div key={step}><i>{index + 1}</i><b>{step}</b></div>)}</div>
              <p className="pipeline-note">The market increasingly rewards visible utilisation, backlog and cash conversion while penalising spending that extends the payback period.</p>
            </article>
            <article className="panel causal-panel">
              <PanelTitle icon="⌁" title="Causal transmission" />
              <div className="causal-chain"><span>Results</span><b>→</b><span>Guidance</span><b>→</b><span>Estimate revisions</span><b>→</b><span>Breadth</span><b>→</b><span>Index durability</span></div>
              <div className="signal-cards">{activeSignals.map((story) => <div key={story.id}><small>{story.status}</small><b>{story.title}</b><span>{story.confidence}%</span></div>)}</div>
            </article>
          </div>
        )}

        {activeTab === "Earnings" && (
          <div className="earnings-page tab-page">
            <article className="panel amd-focus">
              <div className="amd-chip"><span>AMD</span><small>04 AUG</small></div>
              <div><span>THE WEEK'S AI PROOF POINT</span><h2>AMD must validate the hardware leg.</h2><p>Data Center growth, gross margin, forward guidance, supply constraints and management confidence decide whether semiconductor enthusiasm has fundamental support.</p><div className="scenario-row"><b>Acceleration</b><b>In-line</b><b>Disappointment</b></div></div>
            </article>
            <section className="call-cards">
              {(calls.length ? calls.slice(0, 6) : []).map((call) => (
                <article className="panel call-card" key={call.id}><header><b>{call.ticker}</b><span>{call.transcript_status}</span></header><h3>{call.company_name}</h3><p>{call.summary || call.relevance_reason || "Tracked because this call can change an active thesis."}</p><dl><dt>GUIDANCE</dt><dd>{call.guidance || "Monitoring"}</dd><dt>CAPEX</dt><dd>{call.capex || "Monitoring"}</dd><dt>DEMAND</dt><dd>{call.demand || "Monitoring"}</dd></dl></article>
              ))}
              {!calls.length && <article className="panel empty-state"><b>No new calls ingested yet.</b><p>The panel will populate automatically when a relevant earnings call enters the research system.</p></article>}
            </section>
          </div>
        )}

        {activeTab === "Charts" && (
          <div className="charts-page tab-page">
            <article className="panel primary-chart-panel">
              <div className="panel-title-row"><div><span className="panel-kicker">PRIMARY CHART</span><h2>{chartViews[0].instrument}</h2><p>{chartViews[0].question}</p></div><div className="range-tabs">{(["7D", "30D", "90D", "1Y"] as Range[]).map((item) => <button key={item} className={range === item ? "active" : ""} onClick={() => setRange(item)}>{item}</button>)}</div></div>
              <svg className="large-chart" viewBox="0 0 1000 430" preserveAspectRatio="none" aria-label="Illustrative chart preview">
                <defs><linearGradient id="largeFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#8d4dff" stopOpacity=".4"/><stop offset="100%" stopColor="#8d4dff" stopOpacity="0"/></linearGradient></defs>
                <path className="chart-grid" d="M0 80H1000 M0 160H1000 M0 240H1000 M0 320H1000 M180 0V400 M380 0V400 M580 0V400 M780 0V400" />
                <path className="large-area" d={`${paths.primary} L920 400 L0 400Z`} transform="scale(1.087 1.32)" />
                <path className="large-line" d={paths.primary} transform="scale(1.087 1.32)" />
                <path className="large-secondary" d={paths.secondary} transform="scale(1.087 1.32)" />
              </svg>
              <div className="chart-footer"><span>{chartViews[0].timeframe}</span><span>{chartViews[0].overlay}</span><b>Illustrative until chart upload</b></div>
            </article>
            <aside className="chart-request-list panel"><PanelTitle icon="▥" title="Requested charts" />{chartViews.map((chart, index) => <button key={chart.id}><i>{String(index + 1).padStart(2, "0")}</i><span><b>{chart.instrument}</b><small>{chart.question}</small></span><em>{chart.status}</em></button>)}</aside>
          </div>
        )}

        {activeTab === "Ledger" && (
          <div className="ledger-page tab-page">
            <article className="panel ledger-panel"><div className="section-heading"><span>RESEARCH LEDGER</span><h2>Only material changes enter the record</h2></div><div className="timeline">{updates.length ? updates.slice(0, 12).map((update, index) => <div key={update.id}><i>{String(index + 1).padStart(2, "0")}</i><span><small>{update.update_type}</small><b>{update.headline}</b><p>{update.detail || "Material update recorded."}</p></span></div>) : <div className="empty-state"><b>The ledger is quiet.</b><p>Repeated background information is excluded until the evidence changes.</p></div>}</div></article>
            <aside className="panel monitor-panel"><PanelTitle icon="◉" title="Persistent monitors" /><div><span>01</span><b>Can earnings keep the market alive?</b><small>Probability history, breadth, guidance and yields.</small></div><div><span>02</span><b>AI revenue versus capex</b><small>Backlog, usage, depreciation and cash conversion.</small></div><div><span>03</span><b>Oil physical disruption</b><small>Cracks, freight, tanker traffic and inventories.</small></div></aside>
          </div>
        )}

        <footer className="workspace-footer"><span>Alchemy Markets · Persistent research state</span><span>Educational use only</span></footer>
      </section>

      {showActions && (
        <div className="action-backdrop" onClick={() => setShowActions(false)}>
          <div className="action-modal" onClick={(event) => event.stopPropagation()}>
            <header><div><span>NEW RESEARCH</span><h2>Where should the desk go next?</h2></div><button onClick={() => setShowActions(false)}>×</button></header>
            <button onClick={() => openAction("Stories")}><i>01</i><span><b>Open Story Lab</b><small>Compare support, contradiction and the next test.</small></span><em>→</em></button>
            <button onClick={() => openAction("Articles")}><i>02</i><span><b>Review prior Alchemy coverage</b><small>See what was said, how the story evolved and whether it is ready to revisit.</small></span><em>→</em></button>
            <button onClick={() => openAction("Charts")}><i>03</i><span><b>Request a chart</b><small>Choose the visual that answers a defined question.</small></span><em>→</em></button>
            <button onClick={() => openAction("Earnings")}><i>04</i><span><b>Review earnings intelligence</b><small>Inspect guidance, capex, demand and wording shifts.</small></span><em>→</em></button>
          </div>
        </div>
      )}
    </main>
  );
}

function PanelTitle({ icon, title }: { icon: string; title: string }) {
  return <div className="panel-title"><i>{icon}</i><h2>{title}</h2></div>;
}

function Metric({ value, label, tone }: { value: number; label: string; tone: string }) {
  return <div className="metric"><b className={tone}>{value}</b><span>{label}</span></div>;
}

function Evidence({ title, text, tone }: { title: string; text: string; tone: string }) {
  return <div className={`evidence ${tone}`}><small>{title}</small><p>{text}</p></div>;
}

function Condition({ label, text }: { label: string; text: string }) {
  return <div><small>{label}</small><p>{text}</p></div>;
}
