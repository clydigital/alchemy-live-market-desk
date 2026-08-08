"use client";

import Link from "next/link";
import { useMemo, useState, type CSSProperties } from "react";

import { storyTagTone, type StoryTag } from "@/lib/story-tags";
import styles from "./legacy-overview-story-tags.module.css";

type LegacyTaggedStory = {
  id: string;
  slug: string;
  title: string;
  thesis: string;
  confidence: number;
  status: string;
  assets: string[];
  tags: StoryTag[];
};

type Props = {
  stories: LegacyTaggedStory[];
};

export default function LegacyOverviewStoryTags({ stories }: Props) {
  const [activeTag, setActiveTag] = useState<"All" | StoryTag>("All");
  const tags = useMemo(() => {
    const values = new Set<StoryTag>();
    stories.forEach((story) => story.tags.forEach((tag) => values.add(tag)));
    return Array.from(values);
  }, [stories]);
  const visibleStories = activeTag === "All" ? stories : stories.filter((story) => story.tags.includes(activeTag));

  return (
    <section className={styles.stage} aria-label="Legacy Overview Story tags">
      <div className={styles.panel}>
        <header>
          <div>
            <span>LEGACY OVERVIEW · STORY TAXONOMY</span>
            <h2>Filter the Story map by market theme</h2>
            <p>Tags are drawn from each Story&apos;s recorded thesis, assets and named catalysts. No placeholder Stories are added.</p>
          </div>
          <Link href="/stories">Open route-based Stories</Link>
        </header>

        <div className={styles.filters}>
          <button className={activeTag === "All" ? styles.active : ""} onClick={() => setActiveTag("All")}>All <b>{stories.length}</b></button>
          {tags.map((tag) => (
            <button
              key={tag}
              data-tone={storyTagTone(tag)}
              className={activeTag === tag ? styles.active : ""}
              onClick={() => setActiveTag(tag)}
            >
              {tag} <b>{stories.filter((story) => story.tags.includes(tag)).length}</b>
            </button>
          ))}
        </div>

        {visibleStories.length ? (
          <div className={styles.storyGrid}>
            {visibleStories.slice(0, 8).map((story) => {
              const score = Math.min(100, Math.max(0, Math.round(story.confidence)));
              const wheelStyle = { "--legacy-story-score": `${score * 3.6}deg` } as CSSProperties;
              return (
                <article key={story.id}>
                  <div className={styles.storyHead}>
                    <div>
                      <span>{story.status}</span>
                      <h3><Link href={`/stories/${story.slug}`}>{story.title}</Link></h3>
                    </div>
                    <div className={styles.scoreWheel} style={wheelStyle} aria-label={`${score}% confidence`}><b>{score}</b></div>
                  </div>
                  <p>{story.thesis}</p>
                  <div className={styles.tagRow}>
                    {story.tags.map((tag) => <span key={tag} data-tone={storyTagTone(tag)}>{tag}</span>)}
                  </div>
                  <div className={styles.assets}>{story.assets.slice(0, 6).map((asset) => <span key={asset}>{asset}</span>)}</div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className={styles.empty}>No Stories currently match this tag.</div>
        )}
      </div>
    </section>
  );
}
