import { NextResponse } from "next/server";

import { getDeskData } from "@/lib/data";
import { getMarketMonitor } from "@/lib/market-monitor-public";

export const revalidate = 60;

const MARKET_FRESH_HOURS = 18;
const STATE_FRESH_HOURS = 36;

type ThemeSpec = {
  theme: string;
  stateKeywords: string[];
  monitorTypes?: string[];
  rowKeywords?: string[];
};

type PublicState = {
  sector: string;
  subIndustry: string;
  status: string;
  direction: string;
  evidenceSummary: string;
  beneficiaries: string[];
  losers: string[];
  nextTest: string;
  observedAt: string | null;
  freshnessStatus: string | null;
  updatedAt: string;
  sourceName: string;
  sourceUrl: string;
};

const THEME_SPECS: ThemeSpec[] = [
  {
    theme: "AI / Data centres",
    stateKeywords: ["ai", "semiconductor", "semis", "data center", "data centre", "cloud", "hyperscale", "server"],
    monitorTypes: ["AI / Semis", "MAG7"],
    rowKeywords: ["nasdaq", "semiconductor", "nvidia", "broadcom", "tsmc", "micron", "oracle"],
  },
  {
    theme: "Power / Grid",
    stateKeywords: ["power", "grid", "utility", "electric", "transmission", "transformer", "substation", "cable"],
    rowKeywords: ["utilities", "industrial", "natural gas"],
  },
  {
    theme: "Nuclear",
    stateKeywords: ["nuclear", "reactor", "smr", "power generation"],
    rowKeywords: ["utilities", "natural gas"],
  },
  {
    theme: "Uranium / Fuel",
    stateKeywords: ["uranium", "enrichment", "haleu", "nuclear fuel"],
    rowKeywords: ["uranium"],
  },
  {
    theme: "Oil & Gas",
    stateKeywords: ["oil", "gas", "lng", "refining", "energy", "upstream", "midstream", "pipeline"],
    monitorTypes: ["Energy"],
    rowKeywords: ["wti", "brent", "natural gas", "oil"],
  },
  {
    theme: "Metals",
    stateKeywords: ["copper", "silver", "gold", "palladium", "platinum", "metal", "mining"],
    monitorTypes: ["Metal"],
    rowKeywords: ["copper", "silver", "gold", "palladium", "platinum"],
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function textScore(value: string | null | undefined) {
  const text = (value ?? "").toLowerCase();
  if (/strong bullish|very bullish|accelerat|improv|supportive|bullish|positive|uptrend|rising|expansion/.test(text)) return 1;
  if (/strong bearish|very bearish|deteriorat|weak|cautious|bearish|negative|downtrend|falling|contraction/.test(text)) return -1;
  return 0;
}

function timestampFresh(value: string | null | undefined, hours: number) {
  if (!value) return false;
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) return false;
  return Date.now() - parsed <= hours * 60 * 60 * 1000;
}

function stateIsFresh(record: PublicState) {
  if (/stale|expired|outdated/i.test(record.freshnessStatus ?? "")) return false;
  return timestampFresh(record.updatedAt || record.observedAt, STATE_FRESH_HOURS);
}

function stateMatches(spec: ThemeSpec, sector: string, subIndustry: string) {
  const haystack = `${sector} ${subIndustry}`.toLowerCase();
  return spec.stateKeywords.some((keyword) => haystack.includes(keyword));
}

function rowMatches(spec: ThemeSpec, row: { type: string; id: string; symbol: string; label: string }) {
  if (spec.monitorTypes?.includes(row.type)) return true;
  const haystack = `${row.id} ${row.symbol} ${row.label}`.toLowerCase();
  return (spec.rowKeywords ?? []).some((keyword) => haystack.includes(keyword));
}

function themeTextMatches(spec: ThemeSpec, value: string) {
  const text = value.toLowerCase();
  return [...spec.stateKeywords, ...(spec.rowKeywords ?? [])].some((keyword) => text.includes(keyword));
}

function latestTimestamp(values: Array<string | null | undefined>) {
  const valid = values
    .map((value) => ({ value, ms: value ? Date.parse(value) : Number.NaN }))
    .filter((item): item is { value: string; ms: number } => Boolean(item.value) && !Number.isNaN(item.ms))
    .sort((a, b) => b.ms - a.ms);
  return valid[0]?.value ?? null;
}

export async function GET() {
  const [desk, monitor] = await Promise.all([getDeskData(), getMarketMonitor()]);

  const publicStates: PublicState[] = desk.marketStateRecords.map((record) => ({
    sector: record.sector,
    subIndustry: record.sub_industry,
    status: record.status,
    direction: record.direction,
    evidenceSummary: record.evidence_summary,
    beneficiaries: record.beneficiaries,
    losers: record.losers,
    nextTest: record.next_test,
    observedAt: record.observed_at,
    freshnessStatus: record.freshness_status,
    updatedAt: record.updated_at,
    sourceName: record.source_name,
    sourceUrl: record.source_url,
  }));

  const themes = THEME_SPECS.map((spec) => {
    const states = publicStates.filter((record) => stateMatches(spec, record.sector, record.subIndustry));
    const rows = monitor.rows.filter((row) => rowMatches(spec, row));

    const freshStates = states.filter(stateIsFresh);
    const freshRows = rows.filter(
      (row) => row.frequency === "daily" && typeof row.change5d === "number" && timestampFresh(row.asOf, MARKET_FRESH_HOURS),
    );

    const stateWeight = freshStates.length && freshRows.length ? 1.25 : freshStates.length ? 1.5 : 0;
    const marketWeight = freshStates.length && freshRows.length ? 0.75 : freshRows.length ? 1.25 : 0;

    const stateSignals = freshStates.map((record, index) => {
      const score = textScore(`${record.direction} ${record.status}`);
      return {
        id: `state-${spec.theme}-${index}`,
        kind: "market_state",
        title: `${record.sector} · ${record.subIndustry}`,
        detail: record.evidenceSummary || `${record.direction} · ${record.status}`,
        score,
        themeContribution: freshStates.length ? score * stateWeight / freshStates.length : 0,
        affectedAssets: [...new Set([...(record.beneficiaries ?? []), ...(record.losers ?? [])])],
        sourceName: record.sourceName || "Alchemy Live Desk",
        sourceUrl: record.sourceUrl || null,
        observedAt: record.updatedAt || record.observedAt,
        nextTest: record.nextTest || null,
        fresh: true,
      };
    });

    const marketSignals = freshRows.map((row, index) => {
      const score = clamp((row.change5d ?? 0) / 4, -1, 1);
      const details = [
        `5D ${typeof row.change5d === "number" ? `${row.change5d.toFixed(1)}%` : "n/a"}`,
        typeof row.dayChange === "number" ? `day ${row.dayChange.toFixed(1)}%` : null,
        typeof row.rsi === "number" ? `RSI ${row.rsi.toFixed(0)}` : null,
        row.tags?.length ? row.tags.join(", ") : null,
      ].filter(Boolean).join(" · ");
      return {
        id: `market-${spec.theme}-${row.id || index}`,
        kind: "market_row",
        title: row.label,
        detail: details,
        score,
        themeContribution: freshRows.length ? score * marketWeight / freshRows.length : 0,
        affectedAssets: [row.symbol || row.id].filter(Boolean),
        sourceName: row.sourceName || "Market monitor",
        sourceUrl: row.sourceUrl || null,
        observedAt: row.asOf || monitor.updatedAt,
        nextTest: null,
        fresh: true,
      };
    });

    const contextHaystack = (item: { title?: string; detail?: string; reason?: string; researchQuestion?: string; assets?: string[] }) =>
      [item.title, item.detail, item.reason, item.researchQuestion, ...(item.assets ?? [])].filter(Boolean).join(" ");

    const contradictionSignals = monitor.contradictions
      .filter((item) => themeTextMatches(spec, contextHaystack(item)))
      .slice(0, 3)
      .map((item, index) => ({
        id: `contradiction-${spec.theme}-${item.id || index}`,
        kind: "contradiction",
        title: item.title,
        detail: item.detail,
        score: 0,
        themeContribution: 0,
        affectedAssets: item.assets,
        sourceName: "Alchemy contradiction engine",
        sourceUrl: null,
        observedAt: monitor.updatedAt,
        nextTest: item.researchQuestion,
        priority: item.priority,
        fresh: timestampFresh(monitor.updatedAt, MARKET_FRESH_HOURS),
      }));

    const triggerSignals = monitor.researchTriggers
      .filter((item) => themeTextMatches(spec, contextHaystack(item)))
      .slice(0, 3)
      .map((item, index) => ({
        id: `trigger-${spec.theme}-${item.id || index}`,
        kind: "research_trigger",
        title: `Research trigger · ${item.assets.join(", ")}`,
        detail: item.reason,
        score: 0,
        themeContribution: 0,
        affectedAssets: item.assets,
        sourceName: "Alchemy research trigger",
        sourceUrl: null,
        observedAt: monitor.updatedAt,
        nextTest: item.researchQuestion,
        priority: item.priority,
        fresh: timestampFresh(monitor.updatedAt, MARKET_FRESH_HOURS),
      }));

    const scoredSignals = [...stateSignals, ...marketSignals];
    const rawScore = scoredSignals.reduce((sum, signal) => sum + signal.themeContribution, 0);
    const score = Math.round(clamp(rawScore, -2, 2) * 10) / 10;
    const watchSignals = [...contradictionSignals, ...triggerSignals];
    const signals = [...scoredSignals, ...watchSignals].sort((a, b) => Math.abs(b.themeContribution) - Math.abs(a.themeContribution));
    const fresh = scoredSignals.length > 0;
    const freshestAt = latestTimestamp(signals.filter((signal) => signal.fresh).map((signal) => signal.observedAt));
    const confidence = clamp(25 + freshStates.length * 10 + freshRows.length * 4 + watchSignals.length * 2, 25, 95);

    const drivers = signals
      .filter((signal) => Math.abs(signal.themeContribution) > 0.01 || signal.kind === "contradiction")
      .slice(0, 4)
      .map((signal) => signal.detail)
      .filter(Boolean);

    return {
      theme: spec.theme,
      score,
      confidence,
      regime: score >= 0.8 ? "supportive" : score <= -0.8 ? "cautious" : "neutral",
      fresh,
      freshestAt,
      staleAfterHours: MARKET_FRESH_HOURS,
      drivers,
      signals,
      nextTests: states.map((record) => record.nextTest).filter(Boolean).slice(0, 3),
      stateCount: states.length,
      freshStateCount: freshStates.length,
      marketRowCount: rows.length,
      freshMarketRowCount: freshRows.length,
    };
  });

  const marketRows = monitor.rows
    .filter((row) => ["AI / Semis", "MAG7", "Energy", "Metal", "Major Index"].includes(row.type))
    .map((row) => ({
      id: row.id,
      symbol: row.symbol,
      label: row.label,
      type: row.type,
      last: row.last,
      dayChange: row.dayChange,
      change5d: row.change5d,
      rsi: row.rsi,
      stochRsi: row.stochRsi,
      attentionScore: row.attentionScore,
      hot: row.hot,
      contradiction: row.contradiction,
      tags: row.tags,
      asOf: row.asOf,
      frequency: row.frequency,
      sourceName: row.sourceName,
      sourceUrl: row.sourceUrl,
    }));

  return NextResponse.json(
    {
      version: 2,
      source: "Alchemy Live Market Desk",
      generatedAt: new Date().toISOString(),
      marketUpdatedAt: monitor.updatedAt,
      themes,
      contradictions: monitor.contradictions.slice(0, 8),
      researchTriggers: monitor.researchTriggers.slice(0, 8),
      marketRows,
      marketStates: publicStates.slice(0, 80),
      note: "Read-only, sanitized context feed for Power Stack. Signal contributions are explanatory only. No credentials, transcript text, private run metadata, or mutation route are exposed.",
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Cache-Control": "public, s-maxage=60, stale-while-revalidate=300",
      },
    },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
