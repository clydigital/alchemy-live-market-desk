"use client";

import { useState } from "react";
import type { NewsBriefV1 } from "@/lib/market-brief-news";
import {
  NEWSROOM_LENSES,
  projectVerifiedNewsroom,
  type NewsroomLensId,
} from "@/lib/blue-desk-newsroom-lenses";
import styles from "./NewsroomLensExplorer.module.css";
import EditorialStoryArt from "./EditorialStoryArt";
import TradingViewChart from "./TradingViewChart";
import {storyTvInstrument} from "@/lib/bluebelly-editorial-visuals";

type Props = {
  /** Supply the SAME combineQualifiedNews result already used by Today/Stories. */
  news: readonly NewsBriefV1[];
  /** Explicit server observation time. Never silently claim the browser's today. */
  asOf: string;
};

function eventTime(iso: string): string {
  const date = new Date(iso);
  return Number.isFinite(date.getTime()) ?
    new Intl.DateTimeFormat("en-GB", {
      day: "numeric", month: "short", year: "numeric", hour: "2-digit",
      minute: "2-digit", timeZone: "UTC", hour12: false,
    }).format(date) + " UTC" : "Date unavailable";
}

/**
 * Shared Newsroom reading component. No fetching, client-side secrets,
 * LLM calls, price guesses or Story changes. Existing Today/Stories readers
 * should pass the qualified NewsBriefV1[] already fetched server-side.
 */
export default function NewsroomLensExplorer({ news, asOf }: Props) {
  const [active, setActive] = useState<NewsroomLensId>("ai-innovations");
  const projection = projectVerifiedNewsroom(news, new Date(asOf));
  const selected = projection.groups.find(group => group.id === active) || projection.groups[0];

  return (
    <section className={styles.shell} aria-labelledby="newsroom-title"
      data-bluebelly-newsroom="source-verified"
      data-newsroom-selected={selected.id}>
      <div className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>THE NEWSROOM · ORIGINAL-SOURCE DEVELOPMENTS</p>
          <h2 id="newsroom-title">Follow the story, not just the headline</h2>
          <p className={styles.intro}>
            Three ways to read the same verified events. Topic labels are editorial navigation,
            not a prediction, a confirmed market reaction or a new Dossier verdict.
          </p>
        </div>
        <div className={styles.coverage} aria-label="Newsroom source coverage">
          <strong>{projection.uniqueEligibleCount}</strong>
          <span>qualifying original-source updates</span>
        </div>
      </div>

      <div className={styles.switcher} role="group" aria-label="Choose a newsroom topic">
        {NEWSROOM_LENSES.map(lens => {
          const count = projection.groups.find(group => group.id === lens.id)?.items.length || 0;
          return (
            <button type="button" key={lens.id}
              className={selected.id === lens.id ? styles.selected : styles.topic}
              aria-pressed={selected.id === lens.id}
              onClick={() => setActive(lens.id)}>
              <span>{lens.title}</span>
              <small>{count} report{count === 1 ? "" : "s"}</small>
            </button>
          );
        })}
      </div>

      <div className={styles.sectionIntro} aria-live="polite">
        <h3>{selected.title}</h3>
        <p>{selected.subtitle}</p>
        <p><strong>The investigation:</strong> {selected.question}</p>
      </div>

      {selected.items.length ? (
        <div className={styles.cards}>
          {selected.items.map((item, index) =>
            <article className={index === 0 ? styles.lead : styles.card}
              key={item.id} data-newsroom-record-id={item.id}>
              <div className={styles.editorialArt}><EditorialStoryArt headline={item.headline} summary={item.summary} compact={index !== 0}/></div>
              <p className={styles.status}>{item.evidenceLabel} · {eventTime(item.occurredAt)}</p>
              <h4>{item.headline}</h4>
              <p className={styles.summary}>{item.summary}</p>
              {storyTvInstrument(item.headline) ? <details className={styles.chartDetails}>
                <summary>Explore the matching asset on TradingView</summary>
                <TradingViewChart initial={storyTvInstrument(item.headline)!} compact/>
              </details> : null}
              <div className={styles.footer}>
                <span>Observed {eventTime(item.observedAt)}</span>
                <a href={item.sourceUrl} rel="noopener noreferrer" target="_blank">
                  {item.sourceName} · original source
                  <span aria-hidden="true"> ↗</span>
                </a>
              </div>
            </article>
          )}
        </div>
      ) : (
        <div className={styles.empty} data-newsroom-empty="no-qualified-topic-updates">
          <strong>No qualifying recent {selected.title.toLowerCase()} reports.</strong>
          <p>This is a source-coverage statement, not evidence that nothing happened.
            Check the existing calendar or another newsroom lens; unverified creator claims
            are never used to fill this space.</p>
        </div>
      )}
      <p className={styles.note}>
        {projection.unclassifiedCount > 0 ?
          projection.unclassifiedCount + " other verified update(s) remain in the wider news feed. " : ""}
        Event dates are shown in UTC. A reported development does not establish how prices reacted.
      </p>
    </section>
  );
}
