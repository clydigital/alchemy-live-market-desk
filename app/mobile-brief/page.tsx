"use client";

import { useEffect, useRef, useState } from "react";
import { createLatestMobileBriefRequestGate } from "./refresh-gate.ts";
import type { BriefLoadState } from "./logic.ts";
import { dossierWarnings, evidenceCount, formatBriefDate, formatMarketChange, formatMarketLast, formatObservationLabel, formatSourceName, getMobileBriefStatus, getSectionState, loadMobileSnapshot, sanitizeSourceUrl, snapshotHealth, snapshotRows } from "./logic.ts";
import type { Snapshot } from "./logic.ts";


const panel: React.CSSProperties = { border: "1px solid #303b55", borderRadius: 14, padding: 18, background: "#171e30" };
const muted: React.CSSProperties = { color: "#aab8d2", fontSize: 13 };

function renderStringList(items: string[] | null | undefined, missingText: string, emptyText: string) {
  const state = getSectionState(items);
  if (state.status === "not_supplied") {
    return <p style={muted}>{missingText}</p>;
  }
  if (state.status === "empty") {
    return <p style={muted}>{emptyText}</p>;
  }
  return (
    <ul style={{ paddingLeft: 20, marginBottom: 0 }}>
      {state.items.map((item, index) => (
        <li key={index} style={{ marginBottom: 7 }}>
          {item}
        </li>
      ))}
    </ul>
  );
}

export default function MobileIntelligenceBrief() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestedAt, setRequestedAt] = useState<string | null>(null);
  const [hasRefreshed, setHasRefreshed] = useState(false);
  const isInitial = useRef(true);
  const requestGate = useRef(createLatestMobileBriefRequestGate());
  const lastVerified = useRef<BriefLoadState>({ snapshot: null, error: null, requestedAt: null });

  async function refresh() {
    const request = requestGate.current.begin();
    setLoading(true);
    setError(null);
    const result = await loadMobileSnapshot(
      lastVerified.current,
      () => fetch("/api/market-intelligence-snapshot", { cache: "no-store", signal: request.signal }),
    );

    // An older or cancelled request must never replace a later verified snapshot.
    if (!requestGate.current.isCurrent(request)) return;

    if (!isInitial.current) {
      setHasRefreshed(true);
    } else {
      isInitial.current = false;
    }

    lastVerified.current = result;
    setSnapshot(result.snapshot);
    setError(result.error);
    setRequestedAt(result.requestedAt);
    setLoading(false);
  }

  useEffect(() => {
    void refresh();
    return () => requestGate.current.cancel();
  }, []);

  const statusInfo = getMobileBriefStatus({ loading, snapshot, error, hasRefreshed });
  const { stale, degraded } = dossierWarnings(snapshot, Date.now());
  const rows = snapshot ? snapshotRows(snapshot) : [];
  const healthEntries = snapshot ? snapshotHealth(snapshot) : [];

  return <main style={{ maxWidth: 780, margin: "0 auto", padding: "22px 16px 80px", color: "#f1f5fc", background: "#101626", minHeight: "100vh", fontFamily: "system-ui, sans-serif", lineHeight: 1.55 }}>
    <style>{`
      .skip-link {
        position: absolute;
        top: -9999px;
        left: -9999px;
        background: #253b63;
        color: #ffffff;
        padding: 10px 14px;
        border-radius: 8px;
        border: 1px solid #7d9bcf;
        z-index: 1000;
        text-decoration: underline;
      }
      .skip-link:focus {
        top: 12px;
        left: 12px;
      }
      .sr-only {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
      }
    `}</style>
    <a href="#assessment-content" className="skip-link">Skip to assessment content</a>
    <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 18 }}>
      <div><a href="/" style={{ ...muted, color: "#a8c7ff" }}>← Live Desk</a><h1 style={{ fontSize: 26, margin: "8px 0 0" }}>Market intelligence brief</h1></div>
      <button
        type="button"
        disabled={loading}
        aria-busy={loading}
        aria-label={loading ? "Refreshing market intelligence brief" : "Refresh market intelligence brief"}
        onClick={() => void refresh()}
        style={{ padding: "9px 13px", borderRadius: 9, border: "1px solid #7d9bcf", color: "white", background: "#253b63", cursor: loading ? "not-allowed" : "pointer" }}
      >
        {loading ? "Loading…" : "Refresh"}
      </button>
    </header>
    <p style={muted}>Read-only view of the existing Live Desk assessment. This page does not create research or change Stories.</p>

    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {statusInfo.srStatus}
    </div>

    <div id="assessment-content" tabIndex={-1} aria-busy={loading} style={{ outline: "none" }}>
      {error && <section role="alert" style={{ ...panel, borderColor: "#c28c64", marginBottom: 14 }}><strong>Live snapshot unavailable</strong><p>{error}</p><p style={muted}>{snapshot ? "Showing the last snapshot loaded in this browser session; it may be outdated." : "No fallback assessment is invented. Consult the existing MacroPulse separately."}</p></section>}
      {!snapshot && !loading && <p>No verified market assessment available.</p>}
      {snapshot && <>
      <section style={{ ...panel, marginBottom: 14 }}>
        <div style={muted}>Dossier: {formatBriefDate(snapshot.dossier?.asOf)} · Retrieved: {formatBriefDate(requestedAt)} · Generated: {formatBriefDate(snapshot.generatedAt)}</div>
        {(stale || degraded || error) && <p style={{ color: "#ffcf92" }}>Caution: {stale ? "Dossier is more than 24 hours old. " : ""}{degraded ? "Selected Dossier is degraded or a fallback. " : ""}{error ? "Latest refresh failed." : ""}</p>}
        <h2 style={{ fontSize: 21, marginBottom: 4 }}>{snapshot.regime?.headline || "Regime assessment"}</h2>
        <p>{snapshot.regime?.answer}</p><p>{snapshot.regime?.regimeImplication}</p>
        <p style={muted}>US rate regime: {snapshot.regime?.rateRegime?.state || "Unresolved"}</p>
        <strong>What would change the assessment?</strong><p>{snapshot.regime?.whatWouldChangeMind || "Not specified."}</p>
      </section>
      <section style={{ ...panel, marginBottom: 14 }}>
        <h2>Confirmation and disagreement</h2>
        <p>{snapshot.monetarySignals?.summary || "Monetary signal summary not supplied in this snapshot."}</p>
        <h3>Contradicting signals</h3>
        {renderStringList(
          snapshot.monetarySignals?.contradicting,
          "Contradicting signals not supplied in this snapshot.",
          "No contradicting signals reported in this snapshot.",
        )}
        <h3>Unresolved signals</h3>
        {renderStringList(
          snapshot.monetarySignals?.unresolved,
          "Unresolved signals not supplied in this snapshot.",
          "No unresolved signals reported in this snapshot.",
        )}
      </section>
      <section style={{ ...panel, marginBottom: 14 }}>
        <h2>Market watch</h2>
        <p style={muted}>These are observations, not causal claims. Changes are five-session percentages where supplied.</p>
        {rows.length ? (
          <div style={{ display: "grid", gap: 8 }}>
            {rows.map((row, index) => {
              const sourceName = formatSourceName(row.sourceName);
              const safeUrl = sanitizeSourceUrl(row.sourceUrl);
              return (
                <div key={row.id || index} style={{ borderBottom: "1px solid #303b55", paddingBottom: 7 }}>
                  <div><strong>{row.label || row.symbol || "Unspecified asset"}</strong> · {formatMarketLast(row.last)} · 5D {formatMarketChange(row.change5d)}</div>
                  <div style={muted}>
                    Source: {safeUrl ? (
                      <a href={safeUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#a8c7ff", textDecoration: "underline" }}>
                        {sourceName}
                      </a>
                    ) : (
                      <span>{sourceName}</span>
                    )}
                    {" · "}
                    {formatObservationLabel(row.asOf)}
                  </div>
                </div>
              );
            })}
          </div>
        ) : <p style={muted}>No market observations available.</p>}
      </section>
      <section style={{ ...panel, marginBottom: 14 }}>
        <h2>Persistent Stories and causal explanations</h2>
        <p style={muted}>These explanations come from the selected Dossier, not a new assessment. A persistent Story ID is shown only where linked.</p>
        {(() => {
          const state = getSectionState(snapshot.stories);
          if (state.status === "not_supplied") {
            return <p style={muted}>Dossier Stories not supplied in this snapshot.</p>;
          }
          if (state.status === "empty") {
            return <p style={muted}>No Dossier Stories reported in this snapshot.</p>;
          }
          return state.items.map(story => (
            <article key={story.id} style={{ borderTop: "1px solid #303b55", paddingTop: 12, marginTop: 12 }}>
              <h3 style={{ marginBottom: 4 }}>{story.title}</h3>
              <p style={muted}>Assessment: {story.epistemicLabel || "Unclassified"} · Story: {story.persistentStoryId || "Unlinked Dossier Story"} · Evidence refs: {evidenceCount(story.evidenceRefs)}</p>
              <strong>What changed?</strong><p>{story.whatChanged || "No change described."}</p>
              <strong>Why it matters</strong><p>{story.whyItMatters || story.mechanism || "Mechanism not specified."}</p>
              <strong>Market interpretation</strong><p>{story.conclusion || "Not established."}</p>
              <strong>What would change this view?</strong><p>{story.whatWouldChangeMind || "Not specified."}</p>
            </article>
          ));
        })()}
      </section>
      <section style={{ ...panel, marginBottom: 14 }}>
        <h2>Contradictions</h2>
        {(() => {
          const state = getSectionState(snapshot.contradictions);
          if (state.status === "not_supplied") {
            return <p style={muted}>Contradiction details not supplied in this snapshot.</p>;
          }
          if (state.status === "empty") {
            return <p style={muted}>No contradictions reported in this snapshot.</p>;
          }
          return state.items.map(item => (
            <div key={item.id}>
              <strong>{item.title}</strong>
              <p>{item.detail}</p>
            </div>
          ));
        })()}
      </section>
      <section style={{ ...panel, marginBottom: 14 }}>
        <h2>Research gaps</h2>
        {renderStringList(
          snapshot.researchGaps,
          "Research gaps not supplied in this snapshot.",
          "No research gaps reported in this snapshot.",
        )}
      </section>
      <section style={{ ...panel, marginBottom: 14 }}>
        <h2>Provider health</h2>
        {healthEntries.length ? healthEntries.map(([key, value]) => <div key={key} style={{ ...muted, marginBottom: 5 }}>{key}: <strong>{value}</strong></div>) : <p style={muted}>No provider health data reported.</p>}
        <h3>Guardrails</h3>
        {renderStringList(
          snapshot.guardrails,
          "Guardrails not supplied in this snapshot.",
          "No guardrails reported in this snapshot.",
        )}
      </section>
    </>}
    </div>
  </main>;
}
