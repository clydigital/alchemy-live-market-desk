"use client";

import { useEffect, useState } from "react";

import styles from "./video-research-status.module.css";

type VideoResearchStatus = {
  available: boolean;
  generatedAt?: string;
  summary?: { detected: number; transcriptsReady: number; transcriptsFailed: number; transcriptsPending: number };
  channels?: Array<{
    key: string;
    name: string;
    detector: { state: "detected" | "none" | "failed" | "not_run"; label: string };
    transcript: { state: "ready" | "failed" | "pending" | "none"; label: string };
    videos: Array<{ title: string; url: string; publishedAt: string }>;
  }>;
};

function shortDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Date unavailable";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function stateClass(state: string) {
  return state === "detected" || state === "ready"
    ? styles.good
    : state === "failed"
      ? styles.bad
      : styles.neutral;
}

export default function VideoResearchStatus({ endpoint = "/api/video-research-status" }: { endpoint?: string }) {
  const [status, setStatus] = useState<VideoResearchStatus | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch(endpoint, { headers: { Accept: "application/json" }, cache: "no-store", signal: controller.signal })
      .then(async (response) => response.ok ? response.json() : Promise.reject(new Error(`Status ${response.status}`)))
      .then((payload: VideoResearchStatus) => {
        if (!controller.signal.aborted) setStatus(payload);
      })
      .catch(() => {
        if (!controller.signal.aborted) setFailed(true);
      });
    return () => controller.abort();
  }, [endpoint]);

  const detected = status?.summary?.detected || 0;
  const label = failed || status?.available === false
    ? "Video status unavailable"
    : `${detected} new creator video${detected === 1 ? "" : "s"}`;

  return (
    <details className={styles.tooltip}>
      <summary className={failed || status?.available === false ? styles.summaryBad : styles.summary}>
        <span>Creator video intake</span>
        <b>{label}</b>
      </summary>
      <section className={styles.panel} aria-label="Latest monitored creator videos">
        <header>
          <div>
            <span>RESEARCH INPUTS</span>
            <h3>Latest creator videos</h3>
          </div>
          <small>{status?.generatedAt ? `Updated ${shortDate(status.generatedAt)}` : "Loading…"}</small>
        </header>
        {failed || status?.available === false ? (
          <p className={styles.empty}>The Live Desk could not read the latest creator-video run.</p>
        ) : !status ? (
          <p className={styles.empty}>Loading monitored sources…</p>
        ) : (
          <div className={styles.tableWrap}>
            <table>
              <thead><tr><th>Source</th><th>Detector</th><th>Transcript</th><th>Latest video added</th></tr></thead>
              <tbody>
                {(status.channels || []).map((channel) => (
                  <tr key={channel.key}>
                    <th scope="row">{channel.name}</th>
                    <td><span className={`${styles.pill} ${stateClass(channel.detector.state)}`}>{channel.detector.label}</span></td>
                    <td><span className={`${styles.pill} ${stateClass(channel.transcript.state)}`}>{channel.transcript.label}</span></td>
                    <td>{channel.videos.length ? channel.videos.map((video) => (
                      <a key={video.url} href={video.url} target="_blank" rel="noreferrer" title={video.title}>
                        {video.title} <small>· {shortDate(video.publishedAt)} ↗</small>
                      </a>
                    )) : <span className={styles.muted}>No video added</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className={styles.note}>Creator videos remain research leads until a browser or manual transcript is attached and material claims are independently verified.</p>
      </section>
    </details>
  );
}
