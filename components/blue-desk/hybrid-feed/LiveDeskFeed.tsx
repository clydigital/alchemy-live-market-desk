// @ts-nocheck
// Hybrid source mirror for Blue Desk owner-only read-only parity.
"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import ResearchDashboard from "./ResearchDashboard";

const tabs = [
  { id: "research", label: "Research", icon: "difference" },
  { id: "state", label: "Market State", icon: "radar" },
  { id: "calendar", label: "Calendar", icon: "calendar_month" },
  { id: "earnings", label: "Earnings", icon: "finance_mode" },
];
const sectors = ["All", "AI", "Oil", "Metals", "FX", "Yen", "Wine"];

function dateLabel(value) {
  if (!value) return "TBC";
  return new Date(`${value}T12:00:00`).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

function signed(value) {
  if (typeof value !== "number") return "Price pending";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}% / 21D`;
}

function FeedHeader({ feed, tab, setTab }) {
  const xp = [...(feed.marketState || []), ...(feed.calendar || []), ...(feed.earnings || [])].reduce((sum, item) => sum + (item.missionXp || 0), 0);
  const gateOpen = feed.accuracy?.updateGate === "open";
  const syncLabel = !feed.connected ? "DEGRADED" : gateOpen ? "VERIFIED" : feed.accuracy?.updateGate === "blocked" ? "BLOCKED" : "REVIEW";
  return <>
    <section className="live-feed-hero">
      <div><span>CANONICAL DESK SYNC</span><h1>Live evidence becomes research missions.</h1><p>The original desk owns the facts, sources and freshness. Hybrid adds progression, decisions and review without rebuilding the same research layer.</p></div>
      <aside className={`accuracy-${feed.accuracy?.status || "warning"}`}><small>{feed.connected ? "LIVE DESK CONNECTED" : "LOCAL FALLBACK"}</small><strong>{syncLabel}</strong><p>{feed.generatedAt ? `Generated ${new Date(feed.generatedAt).toLocaleString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}` : "Awaiting source timestamp"}</p></aside>
    </section>
    <section className="live-feed-score" aria-label="Live feed score">
      <span><small>STATE MODULES</small><b>{feed.marketState?.length || 0}</b></span>
      <span><small>G7 EVENTS</small><b>{feed.calendar?.length || 0}</b></span>
      <span><small>EARNINGS TESTS</small><b>{feed.earnings?.length || 0}</b></span>
      <span><small>XP AVAILABLE</small><b>{xp}</b></span>
      <span className={`accuracy-${feed.accuracy?.status || "warning"}`}><small>DATA GATE</small><b>{feed.accuracy?.score || 0}</b></span>
    </section>
    <nav className="live-feed-tabs" aria-label="Live desk feed views">{tabs.map((item) => <button key={item.id} className={tab === item.id ? "active" : ""} onClick={() => setTab(item.id)}><span className="material-symbols-outlined">{item.icon}</span><b>{item.label}</b></button>)}</nav>
  </>;
}

function StateView({ feed }) {
  const [sector, setSector] = useState("All");
  const modules = sector === "All" ? feed.marketState : feed.marketState.filter((item) => item.sector === sector);
  return <section className="feed-state-view">
    <header className="feed-section-head"><div><span>RISK / BOON LEDGER</span><h2>Pick the changing mechanism, then enter its journey.</h2></div><div className="feed-sector-filter">{sectors.map((item) => <button key={item} className={sector === item ? "active" : ""} onClick={() => setSector(item)}>{item}</button>)}</div></header>
    <div className="feed-state-labels"><span>Module</span><span>State</span><span>Risk / boon</span><span>Mission</span></div>
    <div className="feed-state-list">{modules.map((item) => <article key={item.id} className={`feed-state-row tone-${String(item.direction).toLowerCase().replace(" ", "-")}`}>
      <div><small>{item.sector}</small><h3>{item.subIndustry}</h3><i>{item.move}</i></div>
      <div><strong>{item.status}</strong><span className="feed-meter"><i style={{ width: `${Math.max(5, item.score || 0)}%` }} /></span><small>{item.direction} / {item.freshness}</small></div>
      <div className="feed-risk-boon"><p><b>RISK</b>{item.risk}</p><p><b>BOON</b>{item.boon}</p></div>
      <div className="feed-mission"><span>+{item.missionXp || 10} XP</span><b>{item.nextTest}</b>{item.storySlug ? <Link href={`https://alchemy-hybrid-market-desk.vercel.app/journeys/${item.storySlug}`}>Enter journey <span className="material-symbols-outlined">arrow_forward</span></Link> : <a href={item.sourceUrl} target="_blank" rel="noreferrer">Open source <span className="material-symbols-outlined">open_in_new</span></a>}</div>
    </article>)}{!modules.length && <div className="feed-empty">No live market-state modules are available. The existing journeys remain usable.</div>}</div>
  </section>;
}

function CalendarView({ feed }) {
  const [windowDays, setWindowDays] = useState(30);
  const [country, setCountry] = useState("All G7");
  const countries = ["All G7", ...new Set(feed.calendar.map((item) => item.country))];
  const now = Date.now();
  const events = feed.calendar.filter((item) => {
    const eventTime = new Date(`${item.date}T23:59:59`).getTime();
    return eventTime >= now - 86400000 && eventTime <= now + windowDays * 86400000 && (country === "All G7" || item.country === country);
  });
  return <section className="feed-calendar-view">
    <header className="feed-section-head"><div><span>HIGH-IMPACT G7 CALENDAR</span><h2>Turn the next release into a scored forecast.</h2></div><div className="feed-calendar-controls"><select value={country} onChange={(event) => setCountry(event.target.value)}>{countries.map((item) => <option key={item}>{item}</option>)}</select><div>{[7, 30, 90, 180].map((item) => <button key={item} className={windowDays === item ? "active" : ""} onClick={() => setWindowDays(item)}>{item}D</button>)}</div></div></header>
    <div className="feed-calendar-list">{events.map((item) => <article key={item.id} className="feed-calendar-row">
      <time><b>{dateLabel(item.date)}</b><span>{item.timeLabel}</span></time>
      <div><small>{item.country} / {item.category}</small><h3>{item.event}</h3><p>{item.decidingQuestion}</p></div>
      <div className="feed-consensus"><span><small>ACTUAL</small><b>{item.actual || "Awaiting"}</b></span><span><small>CONSENSUS</small><b>{item.consensus || "Unreviewed"}</b></span><span><small>PREVIOUS</small><b>{item.previous || "-"}</b></span></div>
      <div className="feed-mission"><span>+{item.missionXp || 20} XP</span><b>Write the forecast before release, then score the reaction.</b><a href={item.sourceUrl} target="_blank" rel="noreferrer">{item.sourceName || "Official source"} <span className="material-symbols-outlined">open_in_new</span></a></div>
    </article>)}{!events.length && <div className="feed-empty">No events match this window. Broaden the date or country filter.</div>}</div>
  </section>;
}

function EarningsView({ feed }) {
  const [selectedId, setSelectedId] = useState(feed.earnings[0]?.id || null);
  const selected = useMemo(() => feed.earnings.find((item) => item.id === selectedId) || feed.earnings[0] || null, [feed.earnings, selectedId]);
  if (!selected) return <div className="feed-empty">No official earnings records are available from the live desk.</div>;
  return <section className="feed-earnings-view">
    <header className="feed-section-head"><div><span>EARNINGS PROOF LAB</span><h2>Test management claims against the active story.</h2></div><p>{feed.earnings.length} company records from the canonical desk</p></header>
    <div className="feed-earnings-layout">
      <nav aria-label="Earnings companies">{feed.earnings.map((item) => <button key={item.id} className={selected.id === item.id ? "active" : ""} onClick={() => setSelectedId(item.id)}><b>{item.ticker}</b><span>{item.companyName}</span><i>{signed(item.change21d)}</i></button>)}</nav>
      <article className="feed-earnings-detail">
        <header><div><small>{selected.fiscalPeriod} / {String(selected.transcriptStatus || "").replaceAll("_", " ")}</small><h2>{selected.companyName}</h2><p>{selected.summary}</p></div><div><b>{selected.price ? Number(selected.price).toLocaleString("en-GB", { maximumFractionDigits: 2 }) : "-"}</b><span>{signed(selected.change21d)}</span></div></header>
        <div className="feed-earnings-facts"><section><small>GUIDANCE</small><p>{selected.guidance || "Not recorded"}</p></section><section><small>CAPEX / SUPPLY</small><p>{selected.capex || "Not recorded"}</p></section><section><small>DEMAND</small><p>{selected.demand || "Not recorded"}</p></section><section><small>WHAT CHANGED</small><p>{selected.whatChanged || "Awaiting prior-period comparison"}</p></section></div>
        <div className="feed-earnings-verdict"><section><small>RISK</small><p>{selected.risk}</p></section><section><small>BOON</small><p>{selected.boon}</p></section></div>
        <footer><div><span>+{selected.missionXp || 15} XP PROOF TEST</span><b>{selected.nextTest}</b></div>{selected.storySlug ? <Link href={`https://alchemy-hybrid-market-desk.vercel.app/journeys/${selected.storySlug}`}>Enter linked journey <span className="material-symbols-outlined">arrow_forward</span></Link> : selected.sourceUrl ? <a href={selected.sourceUrl} target="_blank" rel="noreferrer">Official source <span className="material-symbols-outlined">open_in_new</span></a> : null}</footer>
      </article>
    </div>
  </section>;
}

export default function LiveDeskFeed({ feed, data, initialTab = "research" }) {
  const [tab, setTab] = useState(initialTab);
  return <div className="live-feed-page"><FeedHeader feed={feed} tab={tab} setTab={setTab}/>{tab === "research" ? <ResearchDashboard stories={data?.stories || []} feed={feed} newsThreads={data?.newsThreads || []} updates={data?.updates || []} macroObservations={data?.macroObservations || []} marketObservations={data?.marketObservations || []}/> : tab === "state" ? <StateView feed={feed}/> : tab === "calendar" ? <CalendarView feed={feed}/> : <EarningsView feed={feed}/>}</div>;
}
