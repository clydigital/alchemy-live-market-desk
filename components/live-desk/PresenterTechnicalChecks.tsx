"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import styles from "./presenter-technical-checks.module.css";

type Alignment = "unassessed" | "aligned" | "diverging" | "mixed";
type Check = {
  key: string; title: string; group: "Core" | "Additional";
  technical: string; lastBreak: string; observedOn: string;
  fundamentals: string; alignment: Alignment; evidenceUrl: string;
  notes: string; updatedAt: string; revision: number;
};
type Log = { key: string; title: string; technical: string; alignment: Alignment; observedOn: string; updatedAt: string };
type Stored = { version: 1; checks: Check[]; history: Log[] };
const STORAGE_KEY = "alchemy-presenter-technical-fundamentals-v1";
const SPECS: Array<Pick<Check, "key" | "title" | "group" | "technical" | "lastBreak">> = [
  { key: "dxy-4h", title: "DXY · 4H EMA20 ± 1σ band", group: "Core", technical: "Holding uptrend", lastBreak: "UPPER" },
  { key: "dxy-1d", title: "DXY · 1D EMA20 ± 1σ band", group: "Core", technical: "Holding uptrend", lastBreak: "Not checked" },
  { key: "jxy", title: "JXY · Yen strength / weakness", group: "Core", technical: "Not checked", lastBreak: "Not applicable" },
  { key: "us02y-30y", title: "US02Y–US30Y · Yield spread · GOLD IDEA", group: "Core", technical: "Recovering", lastBreak: "Not applicable" },
  { key: "spx-log-channel-rollover", title: "SPX RISING LOG CHANNEL IDEA + ROLLOVER IDEA", group: "Core", technical: "Not checked", lastBreak: "Not applicable" },
  { key: "us10y-real", title: "US10Y real yield · Duration pressure", group: "Additional", technical: "Not checked", lastBreak: "Not applicable" },
  { key: "hy-credit", title: "US high-yield credit spreads · Stress", group: "Additional", technical: "Not checked", lastBreak: "Not applicable" },
  { key: "vix", title: "VIX · Volatility regime", group: "Additional", technical: "Not checked", lastBreak: "Not applicable" },
  { key: "equity-breadth", title: "SPX / NDX · Trend and market breadth", group: "Additional", technical: "Not checked", lastBreak: "Not applicable" },
  { key: "gold", title: "Gold · Yield and dollar sensitivity", group: "Additional", technical: "Not checked", lastBreak: "Not applicable" },
  { key: "oil", title: "Oil · Inflation and supply risk", group: "Additional", technical: "Not checked", lastBreak: "Not applicable" },
  { key: "move-vix", title: "MOVE–VIX · Rates-to-equity volatility transmission", group: "Additional", technical: "Not checked", lastBreak: "Not applicable" },
  { key: "copper-gold", title: "Copper/Gold · Cyclical growth impulse", group: "Additional", technical: "Not checked", lastBreak: "Not applicable" },
];
const coreCount = SPECS.filter((check) => check.group === "Core").length;
const STATUS = [
  "Not checked", "Holding uptrend", "Holding downtrend", "Upper-band break",
  "Lower-band break", "Strengthening", "Weakening", "Recovering", "Deteriorating", "Rangebound", "Mixed",
  "Rising channel intact", "Rollover watch", "Rollover confirmed",
];
const BREAKS = ["Not applicable", "Not checked", "UPPER", "LOWER"];
const ALIGNMENTS: Alignment[] = ["unassessed", "aligned", "diverging", "mixed"];

const seed = (): Stored => ({
  version: 1,
  checks: SPECS.map((s) => ({
    ...s, observedOn: "", fundamentals: "", alignment: "unassessed",
    evidenceUrl: "", notes: "", updatedAt: "", revision: 0,
  })),
  history: [],
});

function readStorage(): Stored {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seed();
    const value = JSON.parse(raw) as Partial<Stored>;
    if (value.version !== 1 || !Array.isArray(value.checks)) return seed();
    const previous = new Map(value.checks.filter((c): c is Check => !!c && typeof c.key === "string").map((c) => [c.key, c]));
    const fallback = seed();
    return {
      version: 1,
      checks: fallback.checks.map((fresh) => {
        const old = previous.get(fresh.key);
        if (!old) return fresh;
        return {
          ...fresh,
          technical: typeof old.technical === "string" && STATUS.includes(old.technical) ? old.technical : fresh.technical,
          lastBreak: typeof old.lastBreak === "string" && BREAKS.includes(old.lastBreak) ? old.lastBreak : fresh.lastBreak,
          observedOn: typeof old.observedOn === "string" && /^\d{4}-\d{2}-\d{2}$/.test(old.observedOn) ? old.observedOn : "",
          fundamentals: typeof old.fundamentals === "string" ? old.fundamentals.slice(0, 600) : "",
          alignment: ALIGNMENTS.includes(old.alignment) ? old.alignment : "unassessed",
          evidenceUrl: typeof old.evidenceUrl === "string" ? old.evidenceUrl.slice(0, 700) : "",
          notes: typeof old.notes === "string" ? old.notes.slice(0, 700) : "",
          updatedAt: typeof old.updatedAt === "string" ? old.updatedAt : "",
          revision: Number.isInteger(old.revision) ? old.revision : 0,
        };
      }),
      history: Array.isArray(value.history) ? value.history.filter((h) => h && typeof h.key === "string").slice(0, 30) : [],
    };
  } catch {
    return seed();
  }
}

function sourceIsValid(url: string): boolean {
  if (!url) return false;
  try {
    return ["https:", "http:"].includes(new URL(url).protocol);
  } catch { return false; }
}

function readiness(check: Check): string {
  if (!check.updatedAt) return "Example · undated";
  const days = Math.floor((Date.now() - Date.parse(check.updatedAt)) / 86_400_000);
  return days > 7 ? "Stale · review due" : "Presenter updated";
}

function promptFor(check: Check): string {
  return [
    "Help me review this Alchemy Live Desk presenter technical checklist item. Do not assume the technical observation is verified.",
    "Indicator: " + check.title,
    "Presenter reading: " + check.technical,
    "Last EMA band breakout: " + check.lastBreak,
    "Observation date: " + (check.observedOn || "NOT CONFIRMED"),
    "Fundamental hypothesis: " + (check.fundamentals || "not entered"),
    "Source: " + (check.evidenceUrl || "not supplied"),
    "Compare with latest macro fundamentals and original sources. Distinguish aligned, diverging, mixed and unassessed.",
    "Suggest a concise spoken interpretation, contradiction, what to check next, and source links. Do not modify production or claim this presenter note is canonical evidence.",
  ].join("\n");
}

export default function PresenterTechnicalChecks({ compact = false }: { compact?: boolean }) {
  const [data, setData] = useState<Stored>(seed);
  const [hydrated, setHydrated] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Check | null>(null);
  const [showAdditional, setShowAdditional] = useState(false);
  const [message, setMessage] = useState("");
  useEffect(() => {
    const reload = () => setData(readStorage());
    reload(); setHydrated(true);
    window.addEventListener("storage", reload);
    return () => window.removeEventListener("storage", reload);
  }, []);
  const save = () => {
    if (!draft || !draft.observedOn) {
      setMessage("Choose the observation date before saving.");
      return;
    }
    if (draft.evidenceUrl && !sourceIsValid(draft.evidenceUrl)) {
      setMessage("Source URL must begin with https:// or http://.");
      return;
    }
    const now = new Date().toISOString();
    const previous = data.checks.find((check) => check.key === draft.key);
    const final: Check = {
      ...draft,
      fundamentals: draft.fundamentals.trim().slice(0, 600),
      notes: draft.notes.trim().slice(0, 700),
      updatedAt: now,
      revision: (previous?.revision || 0) + 1,
    };
    const next: Stored = {
      version: 1,
      checks: data.checks.map((check) => check.key === final.key ? final : check),
      history: [{
        key: final.key, title: final.title, technical: final.technical,
        alignment: final.alignment, observedOn: final.observedOn, updatedAt: now,
      }, ...data.history].slice(0, 30),
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      setData(next); setEditing(null); setDraft(null);
      setMessage("Saved in this browser. Not synced to a server or canonical research.");
    } catch {
      setMessage("Storage unavailable; the update was not saved.");
    }
  };
  const startEdit = (check: Check) => {
    setEditing(check.key); setDraft({ ...check }); setMessage("");
  };
  const set = (change: Partial<Check>) => setDraft((current) => current ? { ...current, ...change } : null);
  const visible = data.checks.filter((check) => check.group === "Core" || (!compact && showAdditional));
  const aligned = data.checks.filter((check) => check.updatedAt && check.alignment === "aligned" && sourceIsValid(check.evidenceUrl));
  return (
    <section className={styles.feed} aria-label="Presenter technical and fundamentals checklist">
      <header className={styles.header}>
        <div>
          <span className={styles.eyebrow}>PRESENTER-OWNED · NON-CANONICAL</span>
          <h3>Technical × Fundamentals Check</h3>
          <p>Personal chart readings against current macro drivers. Undated initial readings are examples, not verified market data.</p>
        </div>
        {compact ? <Link className={styles.action} href="/presenter/technical-checks">Open checklist ↗</Link> : null}
      </header>
      <div className={styles.summary}>
        <span>{data.checks.filter((c) => !!c.updatedAt).length} / {data.checks.length} reviewed</span>
        <span>{aligned.length} source-linked alignment{aligned.length === 1 ? "" : "s"}</span>
        <span>Updates {hydrated ? "saved locally" : "loading"}</span>
      </div>
      <div className={styles.nodes}>
        {visible.map((check) => {
          const supported = check.updatedAt && check.alignment === "aligned" && sourceIsValid(check.evidenceUrl);
          return (
            <article key={check.key} className={styles.node}>
              <div className={styles.nodeTop}>
                <div>
                  <span className={styles.eyebrow}>{check.group} · {readiness(check)}</span>
                  <h4>{check.title}</h4>
                </div>
                <span className={styles.state}>{check.technical}</span>
              </div>
              <div className={styles.detail}>
                <span>Observed: {check.observedOn || "Date not confirmed"}</span>
                <span>Updated: {check.updatedAt ? new Date(check.updatedAt).toLocaleDateString("en-GB") : "Undated example"}</span>
                {check.key.startsWith("dxy-") ? <span>Last break: {check.lastBreak}</span> : null}
                <span>Fundamentals: {check.alignment.toUpperCase()}</span>
              </div>
              {supported ? <p className={styles.alignment}>TECH + FUNDAMENTALS ALIGN · Presenter assessment; check linked evidence.</p> : null}
              {check.alignment === "aligned" && !supported ? <p className={styles.warning}>Alignment requires a dated update and source link.</p> : null}
              {check.fundamentals ? <p className={styles.small}>{check.fundamentals}</p> : null}
              <div className={styles.actions}>
                <button type="button" onClick={() => startEdit(check)}>Update reading</button>
                {!compact ? <a href={"https://chatgpt.com/?q=" + encodeURIComponent(promptFor(check))} target="_blank" rel="noreferrer">Review with ChatGPT ↗</a> : null}
                {!compact ? <button type="button" onClick={async () => {
                  try {
                    await navigator.clipboard.writeText(promptFor(check));
                    setMessage("ChatGPT review prompt copied. Open ChatGPT and paste it; apply any changes here manually.");
                  } catch { setMessage("Clipboard denied. Open ChatGPT and describe this indicator manually."); }
                }}>Copy ChatGPT prompt</button> : null}
                {sourceIsValid(check.evidenceUrl) ? <a href={check.evidenceUrl} target="_blank" rel="noreferrer">Source ↗</a> : null}
              </div>
              {editing === check.key && draft ? (
                <div className={styles.editor}>
                  <label>Technical reading<select value={draft.technical} onChange={(event) => set({ technical: event.target.value })}>
                    {STATUS.map((status) => <option key={status}>{status}</option>)}
                  </select></label>
                  {check.key.startsWith("dxy-") ? <label>Last completed band break<select value={draft.lastBreak} onChange={(event) => set({ lastBreak: event.target.value })}>
                    {BREAKS.filter((b) => b !== "Not applicable").map((value) => <option key={value}>{value}</option>)}
                  </select></label> : null}
                  <label>Chart observation date<input type="date" max={new Date().toISOString().slice(0, 10)} value={draft.observedOn} onChange={(event) => set({ observedOn: event.target.value })}/></label>
                  <label>Technical versus fundamentals<select value={draft.alignment} onChange={(event) => set({ alignment: event.target.value as Alignment })}>
                    {ALIGNMENTS.map((a) => <option key={a} value={a}>{a.toUpperCase()}</option>)}
                  </select></label>
                  <label>Fundamental driver / contradiction<textarea rows={2} maxLength={600} value={draft.fundamentals} onChange={(event) => set({ fundamentals: event.target.value })} placeholder="E.g. yield spreads narrow despite DXY upper break; why?"/></label>
                  <label>Original source URL<input type="url" value={draft.evidenceUrl} onChange={(event) => set({ evidenceUrl: event.target.value })} placeholder="https://..."/></label>
                  <label>Livestream talking point<textarea rows={2} maxLength={700} value={draft.notes} onChange={(event) => set({ notes: event.target.value })}/></label>
                  <div className={styles.actions}>
                    <button type="button" onClick={save}>Save observation</button>
                    <button type="button" onClick={() => { setEditing(null); setDraft(null); }}>Cancel</button>
                  </div>
                  <p className={styles.small}>Only an observation entered here can be saved. This does not change the Dossier, canonical evidence or frozen Journey editions.</p>
                </div>
              ) : null}
            </article>
          );
        })}
      </div>
      {!compact ? <>
        <div className={styles.actions}>
          <button type="button" onClick={() => setShowAdditional(!showAdditional)}>{showAdditional ? "Hide" : "Show"} additional live-stream checks ({SPECS.length - coreCount})</button>
          <a href="https://chatgpt.com/" target="_blank" rel="noreferrer">Open ChatGPT ↗</a>
        </div>
        <details className={styles.history}>
          <summary>Recent manual updates ({data.history.length})</summary>
          {data.history.length ? data.history.slice(0, 12).map((entry, i) =>
            <p key={i}>{new Date(entry.updatedAt).toLocaleString("en-GB")} · {entry.title} · {entry.technical} · {entry.alignment}</p>
          ) : <p>No dated observations saved yet.</p>}
        </details>
      </> : null}
      {message ? <p className={styles.feedback} role="status">{message}</p> : null}
      <p className={styles.disclaimer}>Updates are stored only in the current browser on the Live Desk domain. Other browsers/devices will not see them. This is a presenter reminder, not an automated price feed or verified fundamental signal.</p>
    </section>
  );
}
