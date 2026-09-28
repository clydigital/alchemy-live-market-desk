"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { storyTagTone, type StoryTag } from "@/lib/story-tags";
import mediaStyles from "./stories-registry-media.module.css";
import styles from "./stories-registry.module.css";
import StoryHeaderImage from "./StoryHeaderImage";

export type StoryRegistryItem = {
  id: string;
  slug: string;
  title: string;
  thesis: string;
  lifecycle: string;
  editorialVerdict: string | null;
  confidence: number;
  assets: string[];
  tags: StoryTag[];
  marketQuestion: string | null;
  nextCatalyst: string | null;
  catalystStatus: "missing" | "ongoing" | "upcoming" | "due" | "expired" | "resolved";
  catalystRecalibrationRequired: boolean;
  maturity: "durable" | "early" | "seed" | "episode" | "stale";
  maturityReason: string;
  evidenceRoom: string | null;
  eventCount: number;
  versionCount: number | null;
  imageUrl: string | null;
  fallbackImageUrl: string;
  imageSourceUrl: string | null;
  imagePublisher: string | null;
  imageKind: "research" | "fallback" | null;
  regimes: Array<{ slug: string; label: string }>;
  hybridHref: string;
};

export default function StoriesRegistry({ stories }: { stories: StoryRegistryItem[] }) {
  const [query, setQuery] = useState("");
  const [tag, setTag] = useState<"All" | StoryTag>("All");
  const [status, setStatus] = useState("All");
  const [role, setRole] = useState<"Current drivers" | "Context only" | "All">("Current drivers");

  const tags = useMemo(() => {
    const counts = new Map<StoryTag, number>();
    stories.forEach((story) => story.tags.forEach((item) => counts.set(item, (counts.get(item) || 0) + 1)));
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]);
  }, [stories]);

  const statuses = useMemo(() => Array.from(new Set(stories.map((story) => story.lifecycle))).sort(), [stories]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return stories.filter((story) => {
      if (tag !== "All" && !story.tags.includes(tag)) return false;
      if (status !== "All" && story.lifecycle !== status) return false;
      if (role === "Current drivers" && story.maturity !== "durable") return false;
      if (role === "Context only" && story.maturity === "durable") return false;
      if (!needle) return true;
      return [story.title, story.thesis, story.marketQuestion || "", story.nextCatalyst || "", story.editorialVerdict || "", ...story.assets, ...story.tags, ...story.regimes.map((regime) => regime.label)]
        .some((value) => value.toLowerCase().includes(needle));
    });
  }, [query, role, status, stories, tag]);

  return (
    <div className={styles.registry}>
      <div className={styles.controls}>
        <label className={styles.search}>
          <span>Search Stories</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Title, asset, thesis or catalyst" />
        </label>
        <label>
          <span>Market role</span>
          <select value={role} onChange={(event) => setRole(event.target.value as typeof role)}>
            <option>Current drivers</option>
            <option>Context only</option>
            <option>All</option>
          </select>
        </label>
        <label>
          <span>Lifecycle</span>
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

      <div className={styles.resultLine}>
        {filtered.length} of {stories.length} Stories shown · {role === "Current drivers" ? "Regime-driving only" : role === "Context only" ? "Context / needs work" : "All maturity states"}
      </div>

      <div className={styles.cards}>
        {filtered.map((story) => (
          <article className={styles.card} key={story.id}>
            <StoryHeaderImage
              title={story.title}
              imageUrl={story.imageUrl}
              fallbackImageUrl={story.fallbackImageUrl}
              imageKind={story.imageKind}
              publisher={story.imagePublisher}
              sourceUrl={story.imageSourceUrl}
              className={mediaStyles.storyImage}
            />

            <header>
              <div>
                <div className={styles.statusLine}>
                  <span>{story.lifecycle}</span>
                  <span data-maturity={story.maturity}>{story.maturity}</span>
                  <small>{story.confidence}% thesis confidence</small>
                </div>
                <Link href={`/stories/${story.slug}`}><h3>{story.title}</h3></Link>
              </div>
              <strong>{story.confidence}</strong>
            </header>

            <ul className={mediaStyles.keyPoints}>
              <li>{story.thesis}</li>
              {story.assets.length ? <li>Affected markets: {story.assets.slice(0, 6).join(", ")}.</li> : null}
              {story.marketQuestion ? <li>{story.marketQuestion}</li> : null}
              {story.nextCatalyst ? (
                <li className={story.catalystRecalibrationRequired ? styles.expiredCatalyst : undefined}>
                  {story.catalystRecalibrationRequired ? "Catalyst needs recalibration: " : "Next test: "}{story.nextCatalyst}
                </li>
              ) : null}
              {story.maturity !== "durable" ? <li className={styles.contextNote}>Context only: {story.maturityReason}</li> : null}
            </ul>

            <div className={styles.tags}>
              {story.regimes.map((regime) => (
                <Link href={`/regimes/${regime.slug}`} key={regime.slug}>{regime.label}</Link>
              ))}
              {story.tags.map((item) => <span key={item} data-tone={storyTagTone(item)}>{item}</span>)}
            </div>

            <div className={styles.assets}>
              {story.assets.slice(0, 8).map((asset) => <span key={asset}>{asset}</span>)}
            </div>

            <footer>
              <div>
                <span>{story.eventCount} dated event{story.eventCount === 1 ? "" : "s"}</span>
                <span>{story.versionCount === null ? "Current thesis" : `${story.versionCount} thesis version${story.versionCount === 1 ? "" : "s"}`}</span>
                {story.evidenceRoom ? <span>Evidence room: {story.evidenceRoom}</span> : null}
                {story.editorialVerdict ? <span>Editorial: {story.editorialVerdict}</span> : null}
              </div>
              <div>
                <Link href={story.hybridHref}>Explain →</Link>
                {" · "}
                <Link href={`/stories/${story.slug}`}>Open record →</Link>
              </div>
            </footer>
          </article>
        ))}
      </div>

      {!filtered.length ? <div className={styles.empty}>No Stories match the current filters. Switch Market role to “All” to inspect stale, seed, early or episode context.</div> : null}
    </div>
  );
}
