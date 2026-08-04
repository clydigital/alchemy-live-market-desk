"use client";

import { useMemo, useState } from "react";
import type { EarningsCall, GuidanceItem, Story } from "@/lib/data";
import type { MarketData, MarketSeries } from "@/lib/market";

type EarningsFilter = "All" | "Semis" | "Cloud" | "Platforms";

type CompanyRecord = {
  ticker: string;
  name: string;
  group: Exclude<EarningsFilter, "All">;
  call: EarningsCall | null;
  guidance: GuidanceItem[];
  series?: MarketSeries;
  story?: Story;
};

const SEMIS = new Set(["AMD", "NVDA", "AVGO", "MU", "MRVL", "INTC", "QCOM", "TSM", "ASML", "ARM"]);
const CLOUD = new Set(["MSFT", "AMZN", "GOOGL", "META", "ORCL"]);

function group(ticker: string): CompanyRecord["group"] {
  if (SEMIS.has(ticker)) return "Semis";
  if (CLOUD.has(ticker)) return "Cloud";
  return "Platforms";
}

function dateLabel(value: string | null) {
  if (!value) return "Date pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

function pct(value: number | null | undefined) {
  return typeof value === "number" ? `${value >= 0 ? "+" : ""}${value.toFixed(1)}%` : "—";
}

function value(value: number | null | undefined) {
  if (typeof value !== "number") return "—";
  return value >= 1000 ? value.toLocaleString("en-US", { maximumFractionDigits: 1 }) : value.toFixed(2);
}

function companies(calls: EarningsCall[], guidance: GuidanceItem[], market: MarketData, stories: Story[]) {
  const latestCall = new Map<string, EarningsCall>();
  for (const call of [...calls].sort((a, b) => new Date(b.call_date || 0).getTime() - new Date(a.call_date || 0).getTime())) {
    if (!latestCall.has(call.ticker)) latestCall.set(call.ticker, call);
  }
  const tickers = [...new Set([...latestCall.keys(), ...guidance.flatMap((item) => item.ticker ? [item.ticker] : [])])];
  return tickers.map((ticker): CompanyRecord => {
    const call = latestCall.get(ticker) || null;
    const relatedGuidance = guidance.filter((item) => item.ticker === ticker);
    return {
      ticker,
      name: call?.company_name || relatedGuidance[0]?.entity || ticker,
      group: group(ticker),
      call,
      guidance: relatedGuidance,
      series: market.series.find((item) => item.symbol === ticker),
      story: stories.find((story) => story.assets?.includes(ticker)),
    };
  }).sort((a, b) => {
    const aTime = new Date(a.call?.call_date || a.guidance[0]?.published_at || 0).getTime();
    const bTime = new Date(b.call?.call_date || b.guidance[0]?.published_at || 0).getTime();
    return bTime - aTime;
  });
}

export default function EarningsHub({ calls, guidance, market, stories }: { calls: EarningsCall[]; guidance: GuidanceItem[]; market: MarketData; stories: Story[] }) {
  const [filter, setFilter] = useState<EarningsFilter>("All");
  const [selectedTicker, setSelectedTicker] = useState<string | null>(calls[0]?.ticker || guidance.find((item) => item.ticker)?.ticker || null);
  const records = useMemo(() => companies(calls, guidance, market, stories), [calls, guidance, market, stories]);
  const visible = filter === "All" ? records : records.filter((record) => record.group === filter);
  const selected = records.find((record) => record.ticker === selectedTicker) || visible[0] || records[0];
  const readyCalls = calls.filter((call) => /ready|complete|official|reviewed/i.test(call.transcript_status)).length;
  const companyGuidance = guidance.filter((item) => item.category !== "fed");
  const linkedStories = new Set(records.flatMap((record) => record.story ? [record.story.id] : [])).size;
  const primaryGuidance = selected?.guidance[0];
  const risk = selected?.call?.capex || selected?.story?.strongest_contradiction || primaryGuidance?.market_interpretation || "Risk assessment awaits a reviewed transcript or filing.";
  const boon = selected?.call?.demand || selected?.story?.strongest_support || primaryGuidance?.current_view || "Boon assessment awaits a reviewed transcript or filing.";
  const nextTest = selected?.story?.next_catalyst || selected?.call?.guidance || primaryGuidance?.current_view || "Next official filing or earnings call.";

  return <div className="earnings-hub tab-page">
    <header className="earnings-hub-hero">
      <div>
        <span>EARNINGS HUB</span>
        <h2>Results become evidence, not just headlines.</h2>
        <p>Calls, filings, guidance, capex, demand and the market reaction are reconciled before they change an active story.</p>
      </div>
      <div className="earnings-hub-kpis">
        <span><small>CALLS</small><b>{calls.length}</b></span>
        <span><small>TRANSCRIPTS READY</small><b>{readyCalls}</b></span>
        <span><small>GUIDANCE ITEMS</small><b>{companyGuidance.length}</b></span>
        <span><small>LINKED STORIES</small><b>{linkedStories}</b></span>
      </div>
    </header>

    <div className="earnings-hub-controls">
      <div role="tablist" aria-label="Earnings group">
        {(["All", "Semis", "Cloud", "Platforms"] as EarningsFilter[]).map((item) => <button key={item} className={filter === item ? "active" : ""} onClick={() => setFilter(item)}>{item}</button>)}
      </div>
      <span>{records.length} tracked companies · official records only</span>
    </div>

    {selected ? <section className="earnings-focus">
      <div className="earnings-company-rail" aria-label="Tracked earnings calls">
        {visible.map((record) => <button key={record.ticker} className={selected.ticker === record.ticker ? "active" : ""} onClick={() => setSelectedTicker(record.ticker)}>
          <i>{record.ticker}</i>
          <span><b>{record.name}</b><small>{record.call?.fiscal_period || record.guidance[0]?.period || "Current period"} · {record.call?.transcript_status || "Guidance only"}</small></span>
          <em className={(record.series?.change21d || 0) >= 0 ? "positive" : "negative"}>{pct(record.series?.change21d)}</em>
        </button>)}
      </div>

      <article className="earnings-company-detail">
        <header>
          <div><span>{selected.group} · {selected.call?.transcript_status || "GUIDANCE RECORD"}</span><h3>{selected.name}</h3><p>{selected.call?.summary || selected.call?.relevance_reason || primaryGuidance?.current_view || "The desk is waiting for a reviewed primary record."}</p></div>
          <div className="earnings-price"><small>{selected.ticker}</small><b>{value(selected.series?.last)}</b><span className={(selected.series?.change21d || 0) >= 0 ? "positive" : "negative"}>21D {pct(selected.series?.change21d)}</span><em>{dateLabel(selected.call?.call_date || primaryGuidance?.published_at || null)}</em></div>
        </header>

        <div className="earnings-intelligence-grid">
          <div><small>GUIDANCE</small><p>{selected.call?.guidance || primaryGuidance?.current_view || "Not recorded"}</p></div>
          <div><small>CAPEX / SUPPLY</small><p>{selected.call?.capex || selected.guidance.find((item) => /capex|capacity|supply/i.test(`${item.guidance_type} ${item.metric}`))?.current_view || "Not recorded"}</p></div>
          <div><small>DEMAND</small><p>{selected.call?.demand || selected.guidance.find((item) => /demand|revenue|backlog|cloud/i.test(`${item.guidance_type} ${item.metric}`))?.current_view || "Not recorded"}</p></div>
          <div><small>WHAT CHANGED</small><p>{selected.call?.prior_quarter_change || primaryGuidance?.wording_change || primaryGuidance?.prior_view || "No reviewed comparison yet"}</p></div>
        </div>

        <div className="earnings-balance">
          <div className="earnings-risk"><span>RISK</span><p>{risk}</p></div>
          <div className="earnings-boon"><span>BOON</span><p>{boon}</p></div>
        </div>

        <footer>
          <div><small>NEXT DECIDING TEST</small><b>{nextTest}</b></div>
          <div className="earnings-source-links">{selected.guidance.slice(0, 3).map((item) => <a key={item.id} href={item.source_url} target="_blank" rel="noreferrer">{item.source_classification.replaceAll("_", " ")} ↗</a>)}{selected.series?.sourceUrl && <a href={selected.series.sourceUrl} target="_blank" rel="noreferrer">Price history ↗</a>}</div>
        </footer>
      </article>
    </section> : <div className="earnings-empty"><b>No reviewed earnings records are available.</b><p>Add an official call, filing or guidance record before the hub displays a company.</p></div>}
  </div>;
}
