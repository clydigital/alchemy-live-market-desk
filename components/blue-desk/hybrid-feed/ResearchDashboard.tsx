// @ts-nocheck
// Hybrid source mirror for Blue Desk owner-only read-only parity.
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import RelationshipChart from "./RelationshipChart";
import { buildResearchAssessment } from "@/lib/blue-desk-hybrid-feed/research-dashboard";
import { journeyQuestion } from "@/lib/blue-desk-hybrid-feed/pulse";

function shortDate(value) {
  if (!value) return "Timestamp pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function metric(value, unit = "") {
  if (!Number.isFinite(Number(value))) return "Pending";
  const number = Number(value);
  return `${number >= 0 ? "+" : ""}${number.toFixed(2)}${unit}`;
}

function tone(value) {
  return String(value || "Mixed").toLowerCase().replace(" ", "-");
}

function integrityLabel(state) {
  if (state === "healthy") return "HEALTHY";
  if (state === "degraded") return "DEGRADED";
  return "REVIEW";
}

export default function ResearchDashboard({
  stories = [],
  focusedStory = null,
  feed,
  newsThreads = [],
  updates = [],
  macroObservations = [],
  marketObservations = [],
  embedded = false,
}) {
  const availableStories = useMemo(() => stories.filter((story) => story.status !== "archived").slice(0, 12), [stories]);
  const [selectedSlug, setSelectedSlug] = useState(focusedStory?.slug || availableStories[0]?.slug || null);
  const story = focusedStory || availableStories.find((item) => item.slug === selectedSlug) || availableStories[0] || null;
  const assessment = useMemo(() => story ? buildResearchAssessment({ story, feed, newsThreads, updates, macroObservations, marketObservations, stories: availableStories }) : null, [story, feed, newsThreads, updates, macroObservations, marketObservations, availableStories]);

  if (!story || !assessment) return <div className="feed-empty">No active story is available for dashboard research.</div>;

  const dataQuarantined = assessment.dataIntegrityState === "degraded";

  return <section className={`research-dashboard ${embedded ? "embedded" : "portfolio"}`}>
    <header className="research-dashboard-head">
      <div><span>STATISTICS + NARRATIVE</span><h2>{embedded ? "Does the dashboard confirm the story?" : "Research dashboard"}</h2><p>{journeyQuestion(story)}</p></div>
      <aside className={`accuracy-${assessment.accuracy.status}`}><small>MARKET DATA INTEGRITY</small><b>{integrityLabel(assessment.dataIntegrityState)}</b><time>{shortDate(assessment.accuracy.checkedAt || assessment.marketUpdatedAt || assessment.generatedAt)}</time></aside>
    </header>

    {!focusedStory && <nav className="research-story-tabs" aria-label="Research dashboard stories">{availableStories.map((item) => <button key={item.slug} className={story.slug === item.slug ? "active" : ""} onClick={() => setSelectedSlug(item.slug)} title={item.market_question || item.title}><span>{item.assets?.[0] || "STORY"}</span><b>{journeyQuestion(item)}</b></button>)}</nav>}

    <section className={`research-accuracy-gate ${assessment.accuracy.status}`}>
      <span className="material-symbols-outlined">{dataQuarantined ? "warning" : assessment.accuracyGateOpen ? "verified" : "rule"}</span>
      <div><small>LIVE MARKET-DATA INTEGRITY</small><h3>{assessment.accuracy.summary}</h3><p>{dataQuarantined ? "Affected statistical modules are quarantined. Canonical research continues with unaffected traceable evidence, and the gap remains visible as research debt." : "Integrity diagnostics inform how much trust to place in the statistical modules; they do not gate the canonical Story."}</p></div>
      <b>{assessment.accuracy.score || 0}<small>/100</small></b>
      <a href="https://alchemy-live-market-desk.vercel.app/api/accuracy-check" target="_blank" rel="noreferrer">Inspect checks <span className="material-symbols-outlined">open_in_new</span></a>
    </section>

    <div className="research-score-strip" aria-label="Research outcome score">
      <span><small>BASE CONFIDENCE</small><b>{assessment.baseConfidence}%</b></span>
      <span className={assessment.adjustment >= 0 ? "positive" : "negative"}><small>DATA-ADJUSTED</small><b>{assessment.adjustedConfidence}%</b><i>{assessment.adjustment >= 0 ? "+" : ""}{assessment.adjustment} pts</i></span>
      <span className={`tone-${tone(assessment.statLean)}`}><small>STATISTICS</small><b>{dataQuarantined ? "QUARANTINED" : assessment.statLean}</b><i>{dataQuarantined ? "affected modules excluded" : `${assessment.statStrength}% directional`}</i></span>
      <span className={`tone-${tone(assessment.newsLean)}`}><small>LINKED NEWS</small><b>{assessment.newsLean}</b><i>{assessment.narrative.length} records</i></span>
      <span className={assessment.divergence ? "negative" : assessment.agreement ? "positive" : "mixed"}><small>RELATIONSHIP</small><b>{assessment.divergence ? "DIVERGENCE" : assessment.agreement ? "AGREEMENT" : dataQuarantined ? "DATA DEGRADED" : "UNRESOLVED"}</b></span>
    </div>

    <section className={`research-outcome ${assessment.divergence ? "divergence" : assessment.agreement ? "agreement" : "unresolved"}`}>
      <div><span className="material-symbols-outlined">{dataQuarantined ? "warning" : assessment.divergence ? "difference" : assessment.agreement ? "done_all" : "pending"}</span><div><small>ANALYSIS OUTCOME</small><h3>{assessment.outcome}</h3></div></div>
      <b>{assessment.adjustedConfidence}% PRIOR</b>
    </section>

    <div className="research-dashboard-grid">
      <section className="research-statistics">
        <header><div><span>LIVE STATISTICAL MODULES</span><h3>{assessment.domain} dashboard</h3></div><b>{assessment.statistics.length} checks</b></header>
        <div className="research-stat-list">{assessment.statistics.map((item) => <article key={item.id} className={`research-stat-row tone-${tone(item.direction)}`}>
          <div><small>{item.sector}</small><h4>{item.subIndustry}</h4><span>{item.status} / {item.freshness}</span></div>
          <div className="research-stat-value"><b>{item.move}</b><span><i style={{ width: `${Math.max(4, item.score || 0)}%` }} /></span><small>{item.score || 0}/100 magnitude</small></div>
          <div><small>{item.direction === "Risk" ? "RISK CHANNEL" : item.direction === "Boon" ? "BOON CHANNEL" : "OPEN CHANNEL"}</small><p>{item.direction === "Risk" ? item.risk : item.direction === "Boon" ? item.boon : item.nextTest}</p></div>
          <a href={item.sourceUrl} target="_blank" rel="noreferrer" title={`Open ${item.sourceName}`}><span className="material-symbols-outlined">open_in_new</span></a>
        </article>)}</div>
        {!assessment.statistics.length && <div className="feed-empty">No direct Live Desk module maps to this story yet.</div>}

        <div className="research-series-grid">{assessment.series.map((item) => <article key={item.key}>
          <small>{item.label}</small><b>{metric(item.value, item.unit)}</b>{item.change !== null && <span>{metric(item.change, " pts")} from prior observation</span>}<time>{shortDate(item.date)} / {item.observations} observations</time>
          <a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.sourceName} <span className="material-symbols-outlined">open_in_new</span></a>
        </article>)}</div>
      </section>

      <aside className="research-narrative">
        <header><div><span>NEWS / LEDGER SIGNAL</span><h3>What the narrative says</h3></div><b className={`tone-${tone(assessment.newsLean)}`}>{assessment.newsLean}</b></header>
        <div>{assessment.narrative.map((item) => {
          const itemTone = item.signal > 0.1 ? "Boon" : item.signal < -0.1 ? "Risk" : "Mixed";
          return <article key={`${item.type}-${item.id}`}>
            <header><span>{item.type}</span><b className={`tone-${tone(itemTone)}`}>{itemTone}</b></header>
            <h4>{item.headline}</h4><p>{item.detail}</p>
            <footer><time>{shortDate(item.publishedAt)}</time>{item.sourceUrl ? <a href={item.sourceUrl} target="_blank" rel="noreferrer">Verify <span className="material-symbols-outlined">open_in_new</span></a> : <span>{item.sourceName}</span>}</footer>
          </article>;
        })}{!assessment.narrative.length && <div className="feed-empty">No linked news or material ledger update is available.</div>}</div>
      </aside>
    </div>

    <RelationshipChart story={story} macroObservations={macroObservations} marketObservations={marketObservations} title="Do the stored statistics confirm the market relationship?" />

    <section className="research-awareness">
      <header><div><span>STORIES TO BE AWARE OF</span><h3>Adjacent risks and transmission channels</h3></div><b>{assessment.relatedStories.length}</b></header>
      <div>{assessment.relatedStories.map((item) => <Link key={item.slug} href={`https://alchemy-hybrid-market-desk.vercel.app/journeys/${item.slug}`}>
        <small>{item.awarenessReason}</small><h4>{item.displayQuestion}</h4><footer><span>{item.assets?.slice(0, 3).join(" / ")}</span><b>{item.confidence}%</b></footer>
      </Link>)}</div>
    </section>
  </section>;
}
