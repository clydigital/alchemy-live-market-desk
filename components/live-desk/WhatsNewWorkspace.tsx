"use client";

import { useMemo, useState } from "react";

import styles from "./whats-new-workspace.module.css";

export type WhatsNewTopic = "FX" | "Stocks" | "Geopolitics" | "Macro" | "Commodities" | "Earnings" | "Crypto" | "Other";

export type WhatsNewDelta = {
  id: string;
  kind: string;
  stream: "Story" | "Statement" | "News";
  topic: WhatsNewTopic;
  title: string;
  detail: string;
  dateLabel: string;
  timestamp: string | null;
  href: string | null;
  external: boolean;
  verification: string | null;
  storyTitle: string | null;
};

function tone(kind: string) {
  if (/confirm|verified|official|primary/i.test(kind)) return "ready";
  if (/contradict|invalid|risk|warning/i.test(kind)) return "risk";
  if (/catalyst|develop|watch/i.test(kind)) return "warn";
  return "default";
}

function TopicIcon({ topic }: { topic: WhatsNewTopic }) {
  const common = { width: 22, height: 22, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const, "aria-hidden": true };

  if (topic === "FX") return <svg {...common}><path d="M5 7h13M15 4l3 3-3 3M19 17H6M9 14l-3 3 3 3" /></svg>;
  if (topic === "Stocks") return <svg {...common}><path d="M4 18V6M4 18h16M7 14l4-4 3 2 5-6" /><path d="M16 6h3v3" /></svg>;
  if (topic === "Geopolitics") return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M4 12h16M12 4a13 13 0 0 1 0 16M12 4a13 13 0 0 0 0 16" /></svg>;
  if (topic === "Macro") return <svg {...common}><path d="M5 18V11M10 18V6M15 18V9M20 18V4" /><path d="M3 18h19" /></svg>;
  if (topic === "Commodities") return <svg {...common}><path d="M12 3c3 4 6 7 6 11a6 6 0 0 1-12 0c0-4 3-7 6-11Z" /><path d="M9 15c.7 1.3 1.7 2 3 2" /></svg>;
  if (topic === "Earnings") return <svg {...common}><rect x="4" y="7" width="16" height="12" rx="2" /><path d="M9 7V5h6v2M8 12h8M8 15h5" /></svg>;
  if (topic === "Crypto") return <svg {...common}><circle cx="12" cy="12" r="8" /><path d="M9 8h4.5a2 2 0 1 1 0 4H9m0 0h5a2 2 0 1 1 0 4H9m2-10v12m3-12v2m0 8v2" /></svg>;
  return <svg {...common}><path d="M12 3v18M3 12h18" /><circle cx="12" cy="12" r="8" /></svg>;
}

export default function WhatsNewWorkspace({ deltas }: { deltas: WhatsNewDelta[] }) {
  const [stream, setStream] = useState<"All" | WhatsNewDelta["stream"]>("All");
  const [query, setQuery] = useState("");

  const counts = useMemo(() => ({
    All: deltas.length,
    Story: deltas.filter((delta) => delta.stream === "Story").length,
    Statement: deltas.filter((delta) => delta.stream === "Statement").length,
    News: deltas.filter((delta) => delta.stream === "News").length,
  }), [deltas]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return deltas.filter((delta) => {
      if (stream !== "All" && delta.stream !== stream) return false;
      if (!needle) return true;
      return [delta.title, delta.detail, delta.kind, delta.topic, delta.storyTitle || "", delta.verification || ""]
        .some((value) => value.toLowerCase().includes(needle));
    });
  }, [deltas, query, stream]);

  return (
    <div className={styles.workspace}>
      <div className={styles.controls}>
        <div className={styles.segments} aria-label="Filter What’s New by record type">
          {(["All", "Story", "Statement", "News"] as const).map((item) => (
            <button key={item} className={stream === item ? styles.active : ""} onClick={() => setStream(item)}>
              {item} <b>{counts[item]}</b>
            </button>
          ))}
        </div>
        <label className={styles.search}>
          <span>Search recent records</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Headline, market, Story or source status" />
        </label>
      </div>

      <div className={styles.resultLine}>{filtered.length} record{filtered.length === 1 ? "" : "s"} shown</div>

      <div className={styles.feed}>
        {filtered.map((delta) => (
          <article className={styles.record} id={`record-${delta.id}`} key={delta.id} data-topic={delta.topic.toLowerCase()}>
            <div className={styles.topicIcon}><TopicIcon topic={delta.topic} /></div>
            <div className={styles.body}>
              <header>
                <div className={styles.headingBlock}>
                  <div className={styles.eyebrow}>
                    <span>{delta.topic}</span>
                    <span className={styles.streamLabel}>{delta.stream}</span>
                    <time dateTime={delta.timestamp || undefined}>{delta.dateLabel}</time>
                  </div>
                  {delta.href ? (
                    <a href={delta.href} target={delta.external ? "_blank" : undefined} rel={delta.external ? "noreferrer" : undefined}>
                      <h3>{delta.title}</h3>
                    </a>
                  ) : <h3>{delta.title}</h3>}
                </div>
                <div className={styles.badges}>
                  <span data-tone={tone(delta.kind)}>{delta.kind}</span>
                  {delta.verification ? <span data-tone={tone(delta.verification)}>{delta.verification}</span> : null}
                </div>
              </header>
              <p>{delta.detail}</p>
              <footer>
                <span>{delta.storyTitle || "Independent source record"}</span>
                <a href={`#record-${delta.id}`} aria-label={`Link to ${delta.title}`}>#{delta.id.slice(0, 8)}</a>
              </footer>
            </div>
          </article>
        ))}
      </div>

      {!filtered.length ? <div className={styles.empty}>No recent records match the current filters.</div> : null}
    </div>
  );
}
