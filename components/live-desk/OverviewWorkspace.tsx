"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";

import { storyTagTone, type StoryTag } from "@/lib/story-tags";
import EconomicReleaseReminder, { type OverviewEconomicRelease, type OverviewReleaseStoryLink } from "./EconomicReleaseReminder";
import StoryHeaderImage from "./StoryHeaderImage";
import styles from "./overview-workspace.module.css";

export type OverviewStory = {
  id: string;
  slug: string;
  title: string;
  thesis: string;
  status: string;
  confidence: number;
  assets: string[];
  tags: StoryTag[];
  imageUrl: string | null;
  fallbackImageUrl: string;
  imageKind: "research" | "fallback" | null;
  imageSourceUrl: string | null;
  imageSourceTitle: string | null;
  imagePublisher: string | null;
};

export type OverviewChange = {
  id: string;
  headline: string;
  detail: string | null;
  date: string;
  storyTitle: string | null;
  updateType: string;
  recordHref: string;
};

export type OverviewSystemState = {
  title: string;
  detail: string;
  tone: "ready" | "warn" | "risk";
};

type Props = {
  stories: OverviewStory[];
  changes: OverviewChange[];
  systems: OverviewSystemState[];
  immediateRelease: OverviewEconomicRelease | null;
  releaseStories: OverviewReleaseStoryLink[];
  metrics: {
    stories: number;
    sources: number;
    evidence: number;
    charts: number;
  };
  pulse: {
    score: number | null;
    lastWeekScore: number | null;
    label: string;
    benchmarkMove: number | null;
    above50: number | null;
    above200: number | null;
  };
};

function clampScore(value: number | null) {
  if (value === null || !Number.isFinite(value)) return null;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function formatMove(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "Updating";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}%`;
}

function scoreState(score: number | null) {
  if (score === null) return { label: "Updating", tone: "neutral" };
  if (score >= 60) return { label: "Constructive", tone: "positive" };
  if (score >= 48) return { label: "Balanced", tone: "mixed" };
  return { label: "Fragile", tone: "negative" };
}

export default function OverviewWorkspace({ stories, changes, systems, immediateRelease, releaseStories, metrics, pulse }: Props) {
  const availableTags = useMemo(() => {
    const tags = new Set<StoryTag>();
    stories.forEach((story) => story.tags.forEach((tag) => tags.add(tag)));
    return Array.from(tags);
  }, [stories]);
  const [activeTag, setActiveTag] = useState<"All" | StoryTag>("All");
  const [selectedSlug, setSelectedSlug] = useState(stories[0]?.slug || "");
  const filteredStories = useMemo(
    () => activeTag === "All" ? stories : stories.filter((story) => story.tags.includes(activeTag)),
    [activeTag, stories],
  );
  const activeStory = filteredStories.find((story) => story.slug === selectedSlug) || filteredStories[0] || null;
  const mapStories = filteredStories.slice(0, 5);
  const score = clampScore(pulse.score);
  const lastWeekScore = clampScore(pulse.lastWeekScore);
  const state = scoreState(score);
  const lastWeekState = scoreState(lastWeekScore);
  const wheelStyle = {
    "--overview-score": `${(score || 0) * 3.6}deg`,
  } as CSSProperties;

  return (
    <div className={styles.workspace}>
      <section className={styles.heroGrid}>
        <article className={`${styles.panel} ${styles.snapshot}`}>
          <header className={styles.panelHeader}>
            <div>
              <span className={styles.kicker}>Research snapshot</span>
              <h2>What the desk is carrying now</h2>
            </div>
            <Link href="/whats-new">Open changes</Link>
          </header>
          <div className={styles.metricGrid}>
            <div className={styles.metricPurple}><strong>{metrics.stories}</strong><span>Tracked Stories</span></div>
            <div className={styles.metricBlue}><strong>{metrics.sources}</strong><span>Loaded sources</span></div>
            <div className={styles.metricGreen}><strong>{metrics.evidence}</strong><span>Active evidence</span></div>
            <div className={styles.metricAmber}><strong>{metrics.charts}</strong><span>Chart requests</span></div>
          </div>
          <div className={styles.snapshotFooter}>
            <span>Persistent research, dated updates and route-owned records stay linked.</span>
            <Link href="/stories">Open all Stories</Link>
          </div>
        </article>

        <article className={`${styles.panel} ${styles.pulsePanel}`}>
          <header className={styles.panelHeader}>
            <div>
              <span className={styles.kicker}>Market pulse</span>
              <h2>{pulse.label}</h2>
            </div>
          </header>
          <div className={styles.pulseBody}>
            <div>
              <strong className={styles.pulseNumber}>{score ?? "—"}</strong>
              <span>Market score</span>
              <b data-tone={state.tone}>{state.label}</b>
            </div>
            <div className={styles.scoreWheel} style={wheelStyle} aria-label={score === null ? "Market score updating" : `Market score ${score} out of 100`}>
              <span>{score ?? "—"}</span>
            </div>
          </div>
          <div className={styles.weekComparison}>
            <div data-current="true">
              <span>This week</span>
              <strong>{score ?? "—"}</strong>
              <small>{state.label}</small>
            </div>
            <div>
              <span>Last week</span>
              <strong>{lastWeekScore ?? "—"}</strong>
              <small>{lastWeekScore === null ? "Historical score not yet recorded" : lastWeekState.label}</small>
            </div>
          </div>
          <div className={styles.pulseDrivers}>
            <div><strong>{formatMove(pulse.benchmarkMove)}</strong><span>S&amp;P 500, five sessions</span></div>
            <div><strong>{pulse.above50 === null ? "Updating" : `${pulse.above50}%`}</strong><span>Above 50-day</span></div>
            <div><strong>{pulse.above200 === null ? "Updating" : `${pulse.above200}%`}</strong><span>Above 200-day</span></div>
          </div>
        </article>
      </section>

      <EconomicReleaseReminder release={immediateRelease} relatedStories={releaseStories} />

      <section className={`${styles.panel} ${styles.storyPanel}`}>
        <header className={styles.panelHeader}>
          <div>
            <span className={styles.kicker}>Persistent Story map</span>
            <h2>Filter the desk by market theme</h2>
          </div>
          <Link href="/stories">View all</Link>
        </header>

        <div className={styles.tagFilters} aria-label="Story tag filters">
          <button className={activeTag === "All" ? styles.activeFilter : ""} onClick={() => setActiveTag("All")}>All <b>{stories.length}</b></button>
          {availableTags.map((tag) => (
            <button key={tag} data-tone={storyTagTone(tag)} className={activeTag === tag ? styles.activeFilter : ""} onClick={() => setActiveTag(tag)}>
              {tag} <b>{stories.filter((story) => story.tags.includes(tag)).length}</b>
            </button>
          ))}
        </div>

        {activeStory ? (
          <div className={styles.storyLayout}>
            <div className={styles.storyMap} aria-label="Gantz ball Story map">
              <svg viewBox="0 0 600 600" preserveAspectRatio="none" aria-hidden="true">
                <path d="M300 300 C220 155 145 130 75 112" />
                <path d="M300 300 C380 155 455 138 525 145" />
                <path d="M300 300 C420 350 472 438 535 500" />
                <path d="M300 300 C180 360 128 445 65 500" />
                <path d="M300 300 C300 205 300 115 300 45" />
              </svg>
              <Link className={styles.storyCore} href={`/stories/${activeStory.slug}`}>
                <small>Selected Story</small>
                <strong>{activeStory.title}</strong>
                <span>{activeStory.confidence}% confidence</span>
              </Link>
              {mapStories.map((story, index) => (
                <button
                  key={story.id}
                  className={`${styles.storyNode} ${styles[`node${index + 1}`] || ""} ${story.slug === activeStory.slug ? styles.selectedNode : ""}`}
                  onClick={() => setSelectedSlug(story.slug)}
                >
                  {story.title}
                </button>
              ))}
            </div>

            <article className={styles.storyDetail}>
              <div className={styles.storyHeading}>
                <div>
                  <span>{activeStory.status}</span>
                  <h3>{activeStory.title}</h3>
                </div>
                <strong>{activeStory.confidence}</strong>
              </div>

              <StoryHeaderImage
                title={activeStory.title}
                imageUrl={activeStory.imageUrl}
                fallbackImageUrl={activeStory.fallbackImageUrl}
                imageKind={activeStory.imageKind}
                publisher={activeStory.imagePublisher}
                sourceUrl={activeStory.imageSourceUrl}
                sourceTitle={activeStory.imageSourceTitle}
                className={styles.storyImage}
              />

              <p>{activeStory.thesis}</p>
              <div className={styles.tagRow}>
                {activeStory.tags.map((tag) => <span key={tag} data-tone={storyTagTone(tag)}>{tag}</span>)}
              </div>
              <div className={styles.assetRow}>
                {activeStory.assets.slice(0, 7).map((asset) => <span key={asset}>{asset}</span>)}
              </div>
              <Link href={`/stories/${activeStory.slug}`}>Open full Story record</Link>
            </article>
          </div>
        ) : (
          <div className={styles.emptyState}>No Stories currently match this tag.</div>
        )}
      </section>

      <section className={styles.lowerGrid}>
        <article className={`${styles.panel} ${styles.systemPanel}`}>
          <header className={styles.panelHeader}>
            <div>
              <span className={styles.kicker}>Research system</span>
              <h2>Current operating state</h2>
            </div>
          </header>
          <div className={styles.systemList}>
            {systems.map((item) => (
              <div key={item.title} data-tone={item.tone}>
                <i />
                <span><strong>{item.title}</strong><small>{item.detail}</small></span>
              </div>
            ))}
          </div>
        </article>

        <article className={`${styles.panel} ${styles.changePanel}`}>
          <header className={styles.panelHeader}>
            <div>
              <span className={styles.kicker}>Latest material changes</span>
              <h2>What changed in the record</h2>
            </div>
            <Link href="/whats-new">View feed</Link>
          </header>
          <div className={styles.changeList}>
            {changes.length ? changes.map((change) => (
              <article key={change.id}>
                <div>
                  <span>{change.updateType}</span>
                  <time>{change.date}</time>
                </div>
                <h3>{change.headline}</h3>
                <p>{change.detail || "The dated update is available in the Story record."}</p>
                <footer className={styles.changeRecordFooter}>
                  {change.storyTitle ? <small>{change.storyTitle}</small> : <small>Independent record</small>}
                  <Link href={change.recordHref}>Open exact record #{change.id.slice(0, 8)}</Link>
                </footer>
              </article>
            )) : <div className={styles.emptyState}>No dated material changes are available at the moment.</div>}
          </div>
        </article>
      </section>
    </div>
  );
}
