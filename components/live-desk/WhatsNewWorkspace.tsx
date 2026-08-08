"use client";

import { useMemo, useState } from "react";

import styles from "./whats-new-workspace.module.css";

export type WhatsNewDelta = {
  id: string;
  kind: string;
  stream: "Story" | "Statement" | "News";
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
      return [delta.title, delta.detail, delta.kind, delta.storyTitle || "", delta.verification || ""]
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
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Headline, Story or source status" />
        </label>
      </div>

      <div className={styles.resultLine}>{filtered.length} record{filtered.length === 1 ? "" : "s"} shown</div>

      <div className={styles.feed}>
        {filtered.map((delta) => (
          <article className={styles.record} id={`record-${delta.id}`} key={delta.id}>
            <div className={styles.rail} data-stream={delta.stream.toLowerCase()} />
            <div className={styles.body}>
              <header>
                <div>
                  <div className={styles.eyebrow}>
                    <span>{delta.stream}</span>
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
                <a href={`#record-${delta.id}`} aria-label={`Link to ${delta.title}`}>Record link #{delta.id.slice(0, 8)}</a>
              </footer>
            </div>
          </article>
        ))}
      </div>

      {!filtered.length ? <div className={styles.empty}>No recent records match the current filters.</div> : null}
    </div>
  );
}
