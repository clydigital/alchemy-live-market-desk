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
  maturity: "durable" | "early" | "seed" | "episode" | "stale" | "reasoning_gap";
  maturityReason: string;
  reasoningAction: "queued_review" | "waiting_new_evidence" | "needs_routing_check" | "no_canonical_evidence" | null;
  pendingReasoningReviewCount: number;
  lastReasoningEvidenceAt: string | null;
  lastReasoningEvaluatedAt: string | null;
  evidenceRoom: string | null;
  evidenceSourceCount: number;
  tier1SourceCount: number;
  unresolvedEvidenceCount: number;
  evidenceGateScore: number | null;
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
  const [role, setRole] = useState<"Current drivers" | "Reasoning gaps" | "Queued reasoning" | "Waiting evidence" | "Evidence thin" | "Catalyst review" | "Context only" | "All">("Current drivers");

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
      if (role === "Reasoning gaps" && story.maturity !== "reasoning_gap") return false;
      if (role === "Queued reasoning" && story.reasoningAction !== "queued_review") return false;
      if (role === "Waiting evidence" && !["waiting_new_evidence", "no_canonical_evidence"].includes(story.reasoningAction || "")) return false;
      if (role === "Evidence thin" && story.evidenceRoom !== "thin") return false;
      if (role === "Catalyst review" && !story.catalystRecalibrationRequired) return false;
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
            <option>Reasoning gaps</option>
            <option>Queued reasoning</option>
            <option>Waiting evidence</option>
            <option>Evidence thin</option>
            <option>Catalyst review</option>
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
        {filtered.length} of {stories.length} Stories shown · {role === "Current drivers" ? "Regime-driving only" : role === "Reasoning gaps" ? "Missing canonical Story reasoning" : role === "Queued reasoning" ? "Canonical reasoning gaps with owned review work queued" : role === "Waiting evidence" ? "Reasoning gaps that need new canonical evidence before another review can matter" : role === "Evidence thin" ? "Thin evidence rooms" : role === "Catalyst review" ? "Catalyst recalibration required" : role === "Context only" ? "Context / needs work" : "All maturity states"}
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
              {story.maturity !== "durable" ? (
                <li className={styles.contextNote}>
                  {story.maturity === "reasoning_gap" ? "Reasoning gap: " : "Context only: "}{story.maturityReason}
                </li>
              ) : null}
              {story.maturity === "reasoning_gap" ? (
                <li className={styles.contextNote}>
                  {story.reasoningAction === "queued_review"
                    ? `Work status: queued for full review · ${story.pendingReasoningReviewCount} trigger${story.pendingReasoningReviewCount === 1 ? "" : "s"}. A full reasoning cycle can progress this; maintenance-only refresh cannot manufacture V1 reasoning.`
                    : story.reasoningAction === "waiting_new_evidence"
                      ? "Work status: reviewed against the latest linked evidence. New canonical evidence is required before another review can legitimately change maturity."
                      : story.reasoningAction === "no_canonical_evidence"
                        ? "Work status: no canonical evidence timestamp is attached yet. Acquire and link evidence before attempting to mature this Story."
                        : story.reasoningAction === "needs_routing_check"
                          ? "Work status: newer canonical evidence exists but no Story review is queued. Check evidence-to-Story routing before treating this as reviewed."
                          : "Work status: reasoning diagnostics are temporarily unavailable."}
                </li>
              ) : null}
              {story.evidenceRoom === "thin" ? (
                <li className={styles.contextNote}>
                  Evidence thin: {story.evidenceSourceCount} source{story.evidenceSourceCount === 1 ? "" : "s"} · {story.tier1SourceCount} Tier 1 · gate {story.evidenceGateScore ?? "n/a"}
                  {story.unresolvedEvidenceCount ? ` · ${story.unresolvedEvidenceCount} unresolved` : ""}
                </li>
              ) : null}
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

      {!filtered.length ? <div className={styles.empty}>No Stories match the current filters. Switch Market role to “All” to inspect stale, seed, early, episode or reasoning-gap context.</div> : null}
    </div>
  );
}
