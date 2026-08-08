"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { storyTagTone, type StoryTag } from "@/lib/story-tags";
import styles from "./stories-registry.module.css";

export type StoryRegistryItem = {
  id: string;
  slug: string;
  title: string;
  thesis: string;
  status: string;
  confidence: number;
  assets: string[];
  tags: StoryTag[];
  marketQuestion: string | null;
  nextCatalyst: string | null;
  evidenceRoom: string | null;
  eventCount: number;
  versionCount: number | null;
};

export default function StoriesRegistry({ stories }: { stories: StoryRegistryItem[] }) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<"All" | StoryTag>("All");
  const [status, setStatus] = useState("All");

  const tags = useMemo(() => {
    const counts = new Map<StoryTag, number>();
    stories.forEach((story) => story.tags.forEach((item) => counts.set(item, (counts.get(item) || 0) + 1)));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [stories]);

  const statuses = useMemo(() => Array.from(new Set(stories.map((story) => story.status))).sort(), [stories]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return stories.filter((story) => {
      if (tag !== "All" && !story.tags.includes(tag)) return false;
      if (status !== "All" && story.status !== status) return false;
      if (!needle) return true;
      return [story.title, story.thesis, story.marketQuestion || "", story.nextCatalyst || "", ...story.assets, ...story.tags]
        .some((value) => value.toLowerCase().includes(needle));
    });
  }, [query, status, stories, tag]);

  return (
    <div className={styles.registry}>
      <div className={styles.controls}>
        <label className={styles.search}>
          <span>Search Stories</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, asset, thesis or catalyst" />
        </label>
        <label>
          <span>Status</span>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option>All</option>
            {statuses.map((item) => <option key={item}>{item}</option>)}
          </select>
        </label>
      </div>

      <div className={styles.tagBar} aria-label="Filter Stories by tag">
        <button className={tag === "All" ? styles.active : ""} onClick={() => setTag("All")}>All <b>{stories.length}</b></button>
        {tags.map(([item, count]) => (
          <button key={item} data-tone={storyTagTone(item)} className={tag === item ? styles.active : ""} onClick={() => setTag(item)}>
            {item} <b>{count}</b>
          </button>
        ))}
      </div>

      <div className={styles.resultLine}>{filtered.length} of {stories.length} Stories shown</div>

      <div className={styles.cards}>
        {filtered.map((story) => (
          <article className={styles.card} key={story.id}>
            <header>
              <div>
                <div className={styles.statusLine}>
                  <span>{story.status}</span>
                  <small>{story.confidence}% confidence</small>
                </div>
                <Link href={`/stories/${story.slug}`}><h3>{story.title}</h3></Link>
              </div>
              <strong>{story.confidence}</strong>
            </header>

            <p>{story.thesis}</p>

            <div className={styles.tags}>
              {story.tags.map((item) => <span key={item} data-tone={storyTagTone(item)}>{item}</span>)}
            </div>

            <div className={styles.assets}>
              {story.assets.slice(0, 8).map((asset) => <span key={asset}>{asset}</span>)}
            </div>

            <div className={styles.tests}>
              <div><span>Market question</span><p>{story.marketQuestion || "Not yet recorded"}</p></div>
              <div><span>Next catalyst</span><p>{story.nextCatalyst || "Not yet recorded"}</p></div>
            </div>

            <footer>
              <div>
                <span>{story.eventCount} dated event{story.eventCount === 1 ? "" : "s"}</span>
                <span>{story.versionCount === null ? "Current thesis" : `${story.versionCount} thesis version${story.versionCount === 1 ? "" : "s"}`}</span>
                {story.evidenceRoom ? <span>Evidence room: {story.evidenceRoom}</span> : null}
              </div>
              <Link href={`/stories/${story.slug}`}>Open record →</Link>
            </footer>
          </article>
        ))}
      </div>

      {!filtered.length ? <div className={styles.empty}>No Stories match the current filters.</div> : null}
    </div>
  );
}
