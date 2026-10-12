"use client";

import { useEffect, useMemo, useState } from "react";

import {
  defaultPresenterSegments,
  presenterSessionReadiness,
  readPresenterSessionDraft,
  PRESENTER_PREP_SESSION_VERSION,
  type PresenterSegment,
} from "@/lib/presenter-prep-session";

import styles from "./presenter-prep-session.module.css";

type Props = {
  editionId: string;
  dossierId: string;
  sourceCounts: { stories: number; motions: number; events: number; researchGaps: number };
};

function storageKey(editionId: string, dossierId: string) {
  return "alchemy:presenter-prep:v1:" + encodeURIComponent(editionId) + ":" + encodeURIComponent(dossierId);
}

export default function PresenterPrepSession({ editionId, dossierId, sourceCounts }: Props) {
  const [segments, setSegments] = useState<PresenterSegment[]>(defaultPresenterSegments);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [onAir, setOnAir] = useState(false);
  const [current, setCurrent] = useState(0);
  const key = storageKey(editionId, dossierId);
  const readiness = useMemo(() => presenterSessionReadiness(segments), [segments]);

  useEffect(() => {
    let restored: PresenterSegment[] | null = null;
    try {
      const saved = window.localStorage.getItem(key);
      restored = saved ? readPresenterSessionDraft(JSON.parse(saved), editionId, dossierId) : null;
    } catch {
      // A malformed or inaccessible local store cannot alter market source data.
    }
    setSegments(restored || defaultPresenterSegments());
    setLoadedKey(key);
    setOnAir(false);
    setCurrent(0);
  }, [key, editionId, dossierId]);

  useEffect(() => {
    if (loadedKey !== key) return;
    try {
      window.localStorage.setItem(key, JSON.stringify({
        version: PRESENTER_PREP_SESSION_VERSION,
        editionId,
        dossierId,
        segments,
      }));
    } catch {
      // Prep remains usable in-memory when browser storage is not available.
    }
  }, [segments, key, loadedKey, editionId, dossierId]);

  function update(id: PresenterSegment["id"], fields: Partial<PresenterSegment>) {
    setSegments((parts) => parts.map((part) => part.id === id ? { ...part, ...fields } : part));
  }

  function move(index: number, direction: -1 | 1) {
    setSegments((parts) => {
      const target = index + direction;
      if (target < 0 || target >= parts.length) return parts;
      const next = [...parts];
      const picked = next.splice(index, 1)[0]!;
      next.splice(target, 0, picked);
      return next;
    });
  }

  if (onAir) {
    const selected = segments[Math.min(current, segments.length - 1)]!;
    return (
      <section className={styles.airPanel} aria-label="Presenter on-air view">
        <header className={styles.toolbar}>
          <div><span className={styles.eyebrow}>ON-AIR VIEW · PRESENTER NOTES ONLY</span>
            <p>{current + 1} / {segments.length} · {readiness.totalMinutes} minutes planned</p>
          </div>
          <button type="button" onClick={() => setOnAir(false)}>Exit on-air view</button>
        </header>
        <h2>{selected.title}</h2>
        <p className={styles.airTime}>{selected.minutes} min · {selected.prepared ? "Prepared" : "Not prepared"}</p>
        <div className={styles.airNotes}>{selected.notes.trim() || "No notes added for this segment."}</div>
        <footer className={styles.toolbar}>
          <button type="button" disabled={current === 0} onClick={() => setCurrent((value) => Math.max(value - 1, 0))}>Previous</button>
          <button type="button" disabled={current === segments.length - 1} onClick={() => setCurrent((value) => Math.min(value + 1, segments.length - 1))}>Next segment</button>
        </footer>
        <p className={styles.disclaimer}>Prepared notes are not verified market evidence. Refer to the pinned Journey and Dossier for research.</p>
      </section>
    );
  }

  return (
    <section className={styles.wrapper} aria-label="Presenter preparation">
      <div className={styles.toolbar}>
        <div>
          <span className={styles.eyebrow}>PRESENTER-OWNED SESSION · LOCAL TO THIS BROWSER</span>
          <h3>60-minute running order</h3>
          <p>Independent speaker notes. Nothing written here changes canonical research.</p>
        </div>
        <button className={styles.primary} type="button" onClick={() => setOnAir(true)}>Open on-air view</button>
      </div>

      <div className={styles.statusRow}>
        <strong>{readiness.totalMinutes} / 60 min</strong>
        <span>{readiness.preparedCount} / {segments.length} blocks prepared</span>
        <span className={readiness.readyForOnAir ? styles.complete : styles.incomplete}>
          {readiness.readyForOnAir ? "RUNNING ORDER COMPLETE" : "PREPARATION IN PROGRESS"}
        </span>
      </div>
      <p className={styles.disclaimer}>
        Evidence remains separate: {sourceCounts.stories} canonical Stories · {sourceCounts.motions} frozen Motion · {sourceCounts.events} events · {sourceCounts.researchGaps} research-status cases.
        A 60-minute plan may be complete even when evidence is incomplete or no new Story qualifies.
      </p>

      <div className={styles.segmentList}>
        {segments.map((part, index) => (
          <article className={styles.segment} key={part.id}>
            <div className={styles.segmentTop}>
              <span className={styles.index}>{index + 1}</span>
              <div className={styles.segmentName}>
                <h4>{part.title}</h4>
                <label className={styles.tick}>
                  <input type="checkbox" checked={part.prepared}
                    onChange={(event) => update(part.id, { prepared: event.target.checked })} />
                  Prepared for delivery
                </label>
              </div>
              <label className={styles.duration}>
                Minutes
                <input aria-label={"Minutes for " + part.title} type="number" min={0} max={60} step={1}
                  value={part.minutes}
                  onChange={(event) => update(part.id, {
                    minutes: Math.max(0, Math.min(60, Math.round(Number(event.target.value) || 0))),
                  })} />
              </label>
              <div className={styles.reorder}>
                <button type="button" aria-label={"Move " + part.title + " earlier"}
                  disabled={index === 0} onClick={() => move(index, -1)}>↑</button>
                <button type="button" aria-label={"Move " + part.title + " later"}
                  disabled={index === segments.length - 1} onClick={() => move(index, 1)}>↓</button>
              </div>
            </div>
            <label className={styles.notesLabel} htmlFor={"notes-" + part.id}>Private presenter notes</label>
            <textarea id={"notes-" + part.id} rows={3} maxLength={4000}
              value={part.notes}
              placeholder="What should I say? Which chart or contradiction should I explain?"
              onChange={(event) => update(part.id, { notes: event.target.value })} />
          </article>
        ))}
      </div>
      <p className={styles.disclaimer}>Notes and completion status are saved locally for this exact edition and Dossier. They are not synchronised, published or submitted to the research pipeline.</p>
    </section>
  );
}
