"use client";

import { useMemo } from "react";

import type { ResearchIntakeQueueItem, ResearchRunStatus } from "@/lib/data";
import { researchScheduleHealth } from "@/lib/research-update";

type Props = {
  runs: ResearchRunStatus[];
  intake: ResearchIntakeQueueItem[];
};

function time(value: string | null) {
  if (!value) return "Not completed";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(value));
}

export default function ResearchUpdateMonitor({ runs, intake }: Props) {
  const health = useMemo(() => researchScheduleHealth(runs), [runs]);
  const latest = runs[0];
  const transcriptGaps = intake.filter((item) => item.item_type === "video" && item.transcript_status !== "ready");
  const divergences = intake.filter((item) => item.divergence_kind !== "none");
  const articleReviews = intake
    .filter((item) => item.item_type === "alchemy_article" && item.recommended_action === "review_article")
    .sort((a, b) => (a.article_position || 31) - (b.article_position || 31));
  const evidenceGaps = intake.filter((item) =>
    item.recommended_action === "recalibrate_story" && (item.evidence_links?.length || 0) < 4,
  );

  return (
    <section className={`panel update-engine ${health.state}`}>
      <header className="update-engine-head">
        <div>
          <small>TWICE-DAILY UPDATE ENGINE</small>
          <h3>{health.state === "healthy" ? "Both research cycles are current" : health.state === "not_configured" ? "The update ledger is not connected yet" : "A research cycle needs attention"}</h3>
          <p>Every run proves its source checks, transcript coverage, dated article scope, evidence threshold and publication decision.</p>
        </div>
        <strong>{health.state === "healthy" ? "CURRENT" : health.state === "not_configured" ? "SETUP" : "ATTENTION"}</strong>
      </header>

      <div className="update-schedule">
        {health.due.map((slot) => (
          <article className={slot.status} key={slot.slot}>
            <span>{slot.label}</span>
            <b>{slot.status === "complete" ? "Completed" : slot.status === "blocked" ? "Blocked" : "Missed"}</b>
            <small>{slot.completedAt ? time(slot.completedAt) : `Due ${time(slot.expectedAt)}`}</small>
          </article>
        ))}
        <article className="latest">
          <span>LAST SUCCESS</span>
          <b>{health.latestCompletedAt ? time(health.latestCompletedAt) : "No completed run"}</b>
          <small>{health.warningCount} recent warning{health.warningCount === 1 ? "" : "s"}</small>
        </article>
      </div>

      <div className="update-run-kpis">
        <span><b>{latest?.videos_found || 0}</b><small>new videos</small></span>
        <span><b>{latest?.transcripts_ready || 0}</b><small>transcripts ready</small></span>
        <span><b>{latest?.news_scanned || 0}</b><small>news items scanned</small></span>
        <span><b>{latest?.articles_scanned || 0}</b><small>dated articles checked</small></span>
        <span><b>{latest?.evidence_added || 0}</b><small>evidence links</small></span>
        <span><b>{latest?.updates_published || 0}</b><small>views recalibrated</small></span>
      </div>

      <div className="update-queues">
        <article>
          <header><span>DIVERGENCES</span><b>{divergences.length}</b></header>
          {divergences.slice(0, 3).map((item) => <a href={item.url} target="_blank" rel="noreferrer" key={item.id}><small>{item.divergence_kind.replaceAll("_", " ")}</small><b>{item.title}</b><p>{item.divergence_note || "Statistics and reporting are not moving together."}</p></a>)}
          {!divergences.length && <p className="queue-empty">No statistics/news divergence is queued.</p>}
        </article>
        <article>
          <header><span>ARTICLE REVIEWS</span><b>{articleReviews.length}</b></header>
          {articleReviews.slice(0, 3).map((item) => <a href={item.url} target="_blank" rel="noreferrer" key={item.id}><small>#{item.article_position} · {time(item.published_at)}</small><b>{item.title}</b><p>{item.review_reason || item.summary}</p></a>)}
          {!articleReviews.length && <p className="queue-empty">No material change among retained recent articles.</p>}
        </article>
        <article>
          <header><span>BLOCKERS</span><b>{transcriptGaps.length + evidenceGaps.length}</b></header>
          {transcriptGaps.slice(0, 2).map((item) => <a href={item.url} target="_blank" rel="noreferrer" key={item.id}><small>TRANSCRIPT {item.transcript_status}</small><b>{item.publisher}</b><p>{item.title}</p></a>)}
          {evidenceGaps.slice(0, 2).map((item) => <a href={item.url} target="_blank" rel="noreferrer" key={item.id}><small>{item.evidence_links?.length || 0}/4 EVIDENCE LINKS</small><b>{item.title}</b><p>Story recalibration remains blocked.</p></a>)}
          {!transcriptGaps.length && !evidenceGaps.length && <p className="queue-empty">No transcript or evidence blockers are queued.</p>}
        </article>
      </div>

      <footer>
        <span>Canonical timezone: Asia/Kuala_Lumpur</span>
        <a href="/api/research-update" target="_blank" rel="noreferrer">Open machine-readable run ledger</a>
      </footer>
    </section>
  );
}
