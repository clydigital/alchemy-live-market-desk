"use client";

import { useState } from "react";

const STORAGE_KEY = "alchemy-presenter-technical-fundamentals-v1";
const MESSAGE_TYPE = "ALCHEMY_PRESENTER_TECHNICAL_SHARE_V1";
const ALLOWED_HYBRID_ORIGINS = new Set([
  "https://alchemy-hybrid-market-desk.vercel.app",
  "https://alchemy-hybrid-market-desk-rogue-magazine.vercel.app",
]);
const CHECK_KEYS = new Set([
  "dxy-4h", "dxy-1d", "jxy", "us02y-30y", "spx-log-channel-rollover",
  "us10y-real", "hy-credit", "vix", "equity-breadth", "gold", "oil",
  "move-vix", "copper-gold",
]);

type ManualRecord = {
  key: string;
  technical: string;
  lastBreak: string;
  observedOn: string;
  fundamentals: string;
  alignment: string;
  evidenceUrl: string;
  notes: string;
  updatedAt: string;
  revision: number;
};

function savedManualReadings(): ManualRecord[] {
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!parsed || typeof parsed !== "object" || !("version" in parsed) || parsed.version !== 1
    || !("checks" in parsed) || !Array.isArray(parsed.checks)) {
    throw new Error("Live checklist storage has an unsupported format.");
  }
  return parsed.checks.filter((item: unknown): item is Record<string, unknown> =>
    !!item && typeof item === "object" && CHECK_KEYS.has(String((item as Record<string, unknown>).key))
    && typeof (item as Record<string, unknown>).updatedAt === "string"
    && !!(item as Record<string, unknown>).updatedAt
    && /^\d{4}-\d{2}-\d{2}$/.test(String((item as Record<string, unknown>).observedOn))
  ).slice(0, 13).map((item) => ({
    key: String(item.key),
    technical: String(item.technical || "").slice(0, 80),
    lastBreak: String(item.lastBreak || "").slice(0, 40),
    observedOn: String(item.observedOn),
    fundamentals: String(item.fundamentals || "").slice(0, 600),
    alignment: String(item.alignment || "unassessed").slice(0, 20),
    evidenceUrl: String(item.evidenceUrl || "").slice(0, 700),
    notes: String(item.notes || "").slice(0, 700),
    updatedAt: String(item.updatedAt).slice(0, 35),
    revision: Number.isInteger(item.revision) ? Number(item.revision) : 0,
  }));
}

export default function SharePresenterTechnicalChecksPage() {
  const [status, setStatus] = useState("");
  const [count, setCount] = useState<number | null>(null);
  function share() {
    const params = new URLSearchParams(window.location.search);
    const origin = params.get("origin") || "";
    const nonce = params.get("nonce") || "";
    if (!ALLOWED_HYBRID_ORIGINS.has(origin) || !/^[A-Za-z0-9_-]{16,128}$/.test(nonce) || !window.opener) {
      setStatus("This window was not opened by a supported Hybrid Desk. Open it using Hybrid's Import from Live button.");
      return;
    }
    try {
      const checks = savedManualReadings();
      window.opener.postMessage({
        type: MESSAGE_TYPE,
        version: 1,
        nonce,
        checks,
        transferredAt: new Date().toISOString(),
      }, origin);
      setCount(checks.length);
      setStatus("Sent to the requesting Hybrid tab. Return to Hybrid to confirm the imported readings.");
    } catch {
      setStatus("Live's browser-local checklist could not be read. Nothing was shared.");
    }
  }
  return <main style={{ background: "#151027", color: "#f6f2ff", minHeight: "100vh", padding: "clamp(20px,6vw,72px)", fontFamily: "Arial, sans-serif" }}>
    <section style={{ maxWidth: 690, margin: "auto", border: "1px solid #645582", borderRadius: 20, padding: 28 }}>
      <small style={{ letterSpacing: 2, color: "#c6a7fd" }}>PRESENTER-OWNED · NON-CANONICAL · MANUAL TRANSFER</small>
      <h1>Share technical readings with Hybrid</h1>
      <p>This sends only your dated, saved Technical × Fundamentals Check readings from this Live Desk browser to the Hybrid tab that opened this window.</p>
      <p>Unsaved example values are excluded. Nothing is written to Supabase, the Dossier, Stories, or historical editions. This is a one-time browser-to-browser transfer, not continuous synchronisation.</p>
      <button type="button" onClick={share} style={{ padding: "14px 18px", background: "#c4f6ca", color: "#172331", border: 0, borderRadius: 10, fontWeight: 700, cursor: "pointer" }}>
        Send saved readings to Hybrid
      </button>
      {status ? <p role="status">{status} {count !== null ? "(" + count + " dated readings)" : ""}</p> : null}
      <p><a href="/presenter/technical-checks" style={{ color: "#d6c3ff" }}>Return to Live checklist</a></p>
    </section>
  </main>;
}
