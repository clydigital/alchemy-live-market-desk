"use client";

import { useEffect, useState } from "react";

type Snapshot = {
  contractVersion: string;
  generatedAt?: string;
  dossier?: { status: string; dossierId: string; asOf: string; degraded: boolean };
  regime?: { headline: string; answer: string; regimeImplication: string; whatWouldChangeMind: string; rateRegime?: { state?: string } };
  monetarySignals?: { summary: string; confirming: string[]; contradicting: string[]; unresolved: string[] };
  marketState?: { selectedRows: Array<{ id: string; symbol: string; label: string; last: number | null; change5d: number | null; asOf: string | null }> };
  stories?: unknown[];
  stockRadar?: unknown;
  contradictions?: Array<{ id: string; title: string; detail: string }>;
  researchGaps?: string[];
  guardrails?: string[];
  sourceHealth?: Record<string, string>;
};

const panel: React.CSSProperties = { border: "1px solid #303b55", borderRadius: 14, padding: 18, background: "#171e30" };
const muted: React.CSSProperties = { color: "#aab8d2", fontSize: 13 };
const formatDate = (value?: string | null) => value ? new Date(value).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" }) : "Unknown";
const list = (items?: string[]) => items?.length ? <ul style={{ paddingLeft: 20, marginBottom: 0 }}>{items.map((item, index) => <li key={index} style={{ marginBottom: 7 }}>{item}</li>)}</ul> : <p style={muted}>No items reported.</p>;

export default function MobileIntelligenceBrief() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [requestedAt, setRequestedAt] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/market-intelligence-snapshot", { cache: "no-store" });
      if (!response.ok) throw new Error(response.status === 503 ? "No usable Dossier presentation is available." : `Snapshot unavailable (HTTP ${response.status}).`);
      const result: Snapshot = await response.json();
      if (result.contractVersion !== "market-intelligence-snapshot/v1" || !result.dossier || !result.regime) throw new Error("Unexpected snapshot contract. No assessment shown.");
      setSnapshot(result);
      setRequestedAt(new Date().toISOString());
    } catch (cause) {
      // Keep the last successful snapshot visible, explicitly marked as cached.
      setError(cause instanceof Error ? cause.message : "Unable to load the snapshot.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  const stale = snapshot?.dossier?.asOf ? Date.now() - Date.parse(snapshot.dossier.asOf) > 24 * 60 * 60 * 1000 : true;
  const degraded = snapshot?.dossier?.degraded || snapshot?.dossier?.status !== "current";
  return <main style={{ maxWidth: 780, margin: "0 auto", padding: "22px 16px 80px", color: "#f1f5fc", fontFamily: "system-ui, sans-serif", lineHeight: 1.55 }}>
    <header style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center", marginBottom: 18 }}>
      <div><a href="/" style={{ ...muted, color: "#a8c7ff" }}>← Live Desk</a><h1 style={{ fontSize: 26, margin: "8px 0 0" }}>Market intelligence brief</h1></div>
      <button type="button" disabled={loading} onClick={() => void refresh()} style={{ padding: "9px 13px", borderRadius: 9, border: "1px solid #7d9bcf", color: "white", background: "#253b63" }}>{loading ? "Loading…" : "Refresh"}</button>
    </header>
    <p style={muted}>Read-only view of the existing Live Desk assessment. This page does not create research or change Stories.</p>
    {error && <section role="alert" style={{ ...panel, borderColor: "#c28c64", marginBottom: 14 }}><strong>Live snapshot unavailable</strong><p>{error}</p><p style={muted}>{snapshot ? "Showing the last snapshot loaded in this browser session; it may be outdated." : "No fallback assessment is invented. Consult the existing MacroPulse separately."}</p></section>}
    {!snapshot && !loading && <p>No verified market assessment available.</p>}
    {snapshot && <>
      <section style={{ ...panel, marginBottom: 14 }}>
        <div style={muted}>Dossier: {formatDate(snapshot.dossier?.asOf)} · Retrieved: {formatDate(requestedAt)} · Generated: {formatDate(snapshot.generatedAt)}</div>
        {(stale || degraded || error) && <p style={{ color: "#ffcf92" }}>Caution: {stale ? "Dossier is more than 24 hours old. " : ""}{degraded ? "Selected Dossier is degraded or a fallback. " : ""}{error ? "Latest refresh failed." : ""}</p>}
        <h2 style={{ fontSize: 21, marginBottom: 4 }}>{snapshot.regime?.headline || "Regime assessment"}</h2>
        <p>{snapshot.regime?.answer}</p><p>{snapshot.regime?.regimeImplication}</p>
        <p style={muted}>US rate regime: {snapshot.regime?.rateRegime?.state || "Unresolved"}</p>
        <strong>What would change the assessment?</strong><p>{snapshot.regime?.whatWouldChangeMind || "Not specified."}</p>
      </section>
      <section style={{ ...panel, marginBottom: 14 }}><h2>Confirmation and disagreement</h2><p>{snapshot.monetarySignals?.summary}</p><h3>Contradicting signals</h3>{list(snapshot.monetarySignals?.contradicting)}<h3>Unresolved signals</h3>{list(snapshot.monetarySignals?.unresolved)}</section>
      <section style={{ ...panel, marginBottom: 14 }}><h2>Market watch</h2><p style={muted}>These are observations, not causal claims. Changes are five-session percentages where supplied.</p><div style={{ display: "grid", gap: 8 }}>{snapshot.marketState?.selectedRows?.map(row => <div key={row.id} style={{ borderBottom: "1px solid #303b55", paddingBottom: 7 }}><strong>{row.label || row.symbol}</strong> · {row.last ?? "n/a"} · 5D {row.change5d === null ? "n/a" : `${row.change5d?.toFixed(2)}%`}<div style={muted}>As of {row.asOf || "unknown"}</div></div>)}</div></section>
      <section style={{ ...panel, marginBottom: 14 }}><h2>Contradictions</h2>{snapshot.contradictions?.length ? snapshot.contradictions.map(item => <div key={item.id}><strong>{item.title}</strong><p>{item.detail}</p></div>) : <p style={muted}>None reported in this snapshot.</p>}</section>
      <section style={{ ...panel, marginBottom: 14 }}><h2>Research gaps</h2>{list(snapshot.researchGaps)}</section>
      <section style={{ ...panel, marginBottom: 14 }}><h2>Provider health</h2>{Object.entries(snapshot.sourceHealth || {}).map(([key, value]) => <div key={key} style={{ ...muted, marginBottom: 5 }}>{key}: <strong>{value}</strong></div>)}<h3>Guardrails</h3>{list(snapshot.guardrails)}</section>
    </>}
  </main>;
}
