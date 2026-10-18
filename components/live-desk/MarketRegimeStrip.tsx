"use client";

import Link from "next/link";
import { useRef } from "react";

import type { ProjectedRegime } from "@/lib/regimes";
import styles from "./market-regime-strip.module.css";

export type HomepageStoryCard = {
  id: string;
  slug: string;
  title: string;
  thesis: string;
  status: string;
  priority: number;
  nextTest: string | null;
};

export type HomepageVerifiedMotion = {
  id: string;
  headline: string;
  occurredAt: string;
  sourceName: string;
  sourceUrl: string;
  storyHref: string | null;
  regimeHref: string | null;
  nextTest: string | null;
};

function stateTone(regime: ProjectedRegime) {
  if (regime.stateKind === "unresolved") return "unresolved";
  if (/coverage gap/i.test(regime.state)) return "gap";
  return "active";
}

function moveRail(node: HTMLDivElement | null, direction: -1 | 1) {
  if (!node) return;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  node.scrollBy({
    left: direction * Math.max(240, node.clientWidth * 0.75),
    behavior: reducedMotion ? "auto" : "smooth",
  });
}

function formatOccurredAt(value: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "Event time unavailable";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(parsed)) + " MYT";
}

export default function MarketRegimeStrip({
  regimes,
  stories = [],
  spotlight = null,
}: {
  regimes: ProjectedRegime[];
  stories?: HomepageStoryCard[];
  spotlight?: HomepageVerifiedMotion | null;
}) {
  const regimeRail = useRef<HTMLDivElement>(null);
  const storyRail = useRef<HTMLDivElement>(null);
  const orderedRegimes = [...regimes].sort((a, b) =>
    Number(b.slug === "global-cost-of-capital") - Number(a.slug === "global-cost-of-capital")
  );

  return (
    <section className={styles.section} aria-label="Regimes and persistent Stories">
      {spotlight ? (
        <aside className={styles.spotlight} aria-label="Verified high-priority market development">
          <div className={styles.spotlightTop}>
            <span>VERIFIED HIGH-PRIORITY MOTION · NOT A REGIME DECISION</span>
            <time dateTime={spotlight.occurredAt}>{formatOccurredAt(spotlight.occurredAt)}</time>
          </div>
          <h3>{spotlight.headline}</h3>
          {spotlight.nextTest ? <p><strong>Next test:</strong> {spotlight.nextTest}</p> : null}
          <div className={styles.spotlightLinks}>
            {spotlight.regimeHref ? <Link href={spotlight.regimeHref}>Related Regime →</Link> : null}
            {spotlight.storyHref ? <Link href={spotlight.storyHref}>Related Story →</Link> : null}
            <Link href="/whats-new">Open Market Motion →</Link>
            <a href={spotlight.sourceUrl} target="_blank" rel="noreferrer">{spotlight.sourceName} ↗</a>
          </div>
        </aside>
      ) : null}

      <div className={styles.header}>
        <div>
          <span className={styles.kicker}>MARKET REGIMES</span>
          <h3 id="home-market-regimes">What markets are pricing now</h3>
          <p>Swipe or use the arrows to browse the five existing Regimes. US rates are first; each card links to the full evidence-aware Regime view.</p>
        </div>
        <div className={styles.navigation}>
          <Link className={styles.allLink} href="/regimes">All Regimes →</Link>
          <button type="button" onClick={() => moveRail(regimeRail.current, -1)} aria-label="Scroll regimes backward">←</button>
          <button type="button" onClick={() => moveRail(regimeRail.current, 1)} aria-label="Scroll regimes forward">→</button>
        </div>
      </div>

      <div className={styles.rail} ref={regimeRail} role="region" aria-labelledby="home-market-regimes" tabIndex={0}>
        {orderedRegimes.map((regime) => (
          <Link className={styles.card} data-state={stateTone(regime)} href={"/regimes/" + regime.slug} key={regime.slug}>
            <div className={styles.cardTop}>
              <span>{regime.shortTitle}</span>
              <b>{regime.state}</b>
            </div>
            <p>{regime.whyItMatters}</p>
            <div className={styles.meta}>
              <span>{regime.durableStories.length} durable Stories</span>
              <span>{regime.contextStories.length} context</span>
              {regime.asOf ? <span>As of {regime.asOf.slice(0, 10)}</span> : <span>As-of unavailable</span>}
            </div>
            {regime.latestNode ? (
              <div className={styles.latest}>
                <small>
                  {regime.latestNode.sourceKind === "dossier_motion"
                    ? "System 2 Dossier context · non-state"
                    : "Latest contribution"}
                </small>
                <strong>{regime.latestNode.title}</strong>
              </div>
            ) : (
              <div className={styles.latest}>
                <small>Latest contribution</small>
                <strong>No current contribution yet</strong>
              </div>
            )}
          </Link>
        ))}
      </div>

      <div className={styles.header}>
        <div>
          <span className={styles.kicker}>PERSISTENT STORIES</span>
          <h3 id="home-persistent-stories">The narratives being tested</h3>
          <p>Multiple enduring Story records, ranked by their existing deterministic priority. Motion and creator leads do not become Story truth by appearing here.</p>
        </div>
        <div className={styles.navigation}>
          <Link className={styles.allLink} href="/stories">All Stories →</Link>
          <button type="button" onClick={() => moveRail(storyRail.current, -1)} aria-label="Scroll Stories backward">←</button>
          <button type="button" onClick={() => moveRail(storyRail.current, 1)} aria-label="Scroll Stories forward">→</button>
        </div>
      </div>
      {stories.length ? (
        <div className={styles.rail} ref={storyRail} role="region" aria-labelledby="home-persistent-stories" tabIndex={0}>
          {stories.map((story) => (
            <Link className={styles.storyCard} href={"/stories/" + story.slug} key={story.id}>
              <div className={styles.storyTop}>
                <span>PRIORITY {story.priority}</span>
                <span>{story.status}</span>
              </div>
              <h4>{story.title}</h4>
              <p>{story.thesis}</p>
              <div className={styles.latest}>
                <small>What could change this view</small>
                <strong>{story.nextTest || "No explicit canonical next test recorded."}</strong>
              </div>
            </Link>
          ))}
        </div>
      ) : <p className={styles.empty}>No persistent Story records are currently available.</p>}
    </section>
  );
}
