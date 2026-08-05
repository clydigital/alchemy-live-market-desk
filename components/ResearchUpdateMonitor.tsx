"use client";

import { useMemo } from "react";

import type { ResearchIntakeQueueItem, ResearchRunStatus, ResearchStoryFocus } from "@/lib/data";
import { researchScheduleHealth } from "@/lib/research-update";

type Props = {
  runs: ResearchRunStatus[];
  intake: ResearchIntakeQueueItem[];
  focus: ResearchStoryFocus[];
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

export default function ResearchUpdateMonitor({ runs, intake, focus }: Props) {
  const health = useMemo(() => researchScheduleHealth(runs), [runs]);
  const latestDesk = runs.find((run) => run.schedule_slot === "morning" || run.schedule_slot === "evening");
  const latestVideo = runs.find((run) => run.schedule_slot === "video_midnight" || run.schedule_slot === "video_late_morning");
  const latestFocus = latestDesk
    ? focus.filter((item) => item.run_id === latestDesk.id).sort((a, b) => a.priority - b.priority)
    : [];
  const transcriptGaps = intake.filter((item) =>
    item.item_type === "video"
    && (item.transcript_status !== "ready" || !["reviewed", "listened"].includes(item.video_review_status || "")),
  );
  const evidenceGaps = intake.filter((item) =>
    item.recommended_action === "recalibrate_story" && (item.evidence_links?.length || 0) < 4,
  );
  const blockedIds = new Set([...transcriptGaps, ...evidenceGaps].map((item) => item.id));
  const divergences = intake.filter((item) => item.divergence_kind !== "none" && !blockedIds.has(item.id));
  const materialClaims = intake.flatMap((item) =>
    item.claim_checks.filter((claim) => claim.material).map((claim) => ({ item, claim })),
  );
  const activeFocus = latestFocus.filter((item) => item.decision === "lead" || item.decision === "top_three");

  return (
    <section className={`panel update-engine ${health.state}`}>
      <header className="update-engine-head">
        <div>
          <small>FOUR-SLOT RESEARCH ENGINE</small>
          <h3>{health.state === "healthy" ? "All research slots are current" : health.state === "not_configured" ? "The update ledger is not connected yet" : "A research slot needs attention"}</h3>
          <p>Video discovery is isolated from Desk 1 publication, with freshness, calendar, evidence and claim-verification gates recorded for every run.</p>
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
        <span><b>{latestVideo?.videos_found || 0}</b><small>videos found</small></span>
        <span><b>{latestVideo?.transcripts_ready || 0}</b><small>transcripts ready</small></span>
        <span><b>{latestVideo?.jargon_terms_researched || 0}</b><small>terms researched</small></span>
        <span><b>{latestDesk?.news_scanned || 0}</b><small>news scanned</small></span>
        <span><b>{latestDesk?.expert_notes_added || 0}</b><small>expert notes</small></span>
        <span><b>{latestDesk?.stories_demoted || 0}</b><small>stories demoted</small></span>
        <span><b>{activeFocus.length}</b><small>active Desk 1 focus</small></span>
        <span><b>{latestDesk?.focus_changes_published || 0}</b><small>changes published</small></span>
      </div>

      <div className="update-queues">
        <article>
          <header><span>DESK 1 FOCUS</span><b>{latestFocus.length}</b></header>
          {latestFocus.slice(0, 4).map((item) => <div className="queue-item" key={item.id}><small>{item.decision.replaceAll("_", " ")} | {item.freshness_status.replaceAll("_", " ")}</small><b>{item.headline}</b><p>{item.demotion_reason || item.freshness_reason}</p></div>)}
          {!latestFocus.length && <p className="queue-empty">No Desk 1 focus decisions are recorded.</p>}
        </article>
        <article>
          <header><span>MATERIAL CLAIMS</span><b>{materialClaims.length}</b></header>
          {materialClaims.slice(0, 4).map(({ item, claim }, index) => <a href={item.url} target="_blank" rel="noreferrer" key={`${item.id}-${index}`}><small>{claim.status.replaceAll("_", " ")} | {item.publisher}</small><b>{claim.claim}</b><p>{claim.assessment}</p></a>)}
          {!materialClaims.length && <p className="queue-empty">No material creator claims are retained.</p>}
        </article>
        <article>
          <header><span>CROSS-ASSESSMENT</span><b>{divergences.length}</b></header>
          {divergences.slice(0, 4).map((item) => <a href={item.url} target="_blank" rel="noreferrer" key={item.id}><small>{item.divergence_kind.replaceAll("_", " ")}</small><b>{item.title}</b><p>{item.divergence_note || "Statistics and reporting are not moving together."}</p></a>)}
          {!divergences.length && <p className="queue-empty">No validated statistics/news divergence is queued.</p>}
        </article>
        <article>
          <header><span>BLOCKERS</span><b>{blockedIds.size}</b></header>
          {transcriptGaps.slice(0, 2).map((item) => <a href={item.url} target="_blank" rel="noreferrer" key={item.id}><small>{item.transcript_provider || "NO TRANSCRIPT SOURCE"} | {item.video_review_status || "NO REVIEW"}</small><b>{item.publisher}</b><p>{item.title}</p></a>)}
          {evidenceGaps.filter((item) => !transcriptGaps.some((video) => video.id === item.id)).slice(0, 2).map((item) => <a href={item.url} target="_blank" rel="noreferrer" key={item.id}><small>{item.evidence_links?.length || 0}/4 EVIDENCE LINKS</small><b>{item.title}</b><p>Desk 1 recalibration remains blocked.</p></a>)}
          {!blockedIds.size && <p className="queue-empty">No transcript, review or evidence blockers are queued.</p>}
        </article>
      </div>

      <footer>
        <span>Desk 1 canonical | Desk 2 validated adaptation only | Asia/Kuala_Lumpur</span>
        <a href="/api/research-update" target="_blank" rel="noreferrer">Open machine-readable run ledger</a>
      </footer>
    </section>
  );
}
