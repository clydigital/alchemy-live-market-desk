import { NextResponse } from "next/server";

import { getDeskData } from "@/lib/data";
import { getMarketMonitor } from "@/lib/market-monitor-public";

export const revalidate = 60;

type ThemeSpec = {
  theme: string;
  stateKeywords: string[];
  monitorTypes?: string[];
  rowKeywords?: string[];
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

function stateMatches(spec: ThemeSpec, sector: string, subIndustry: string) {
  const haystack = `${sector} ${subIndustry}`.toLowerCase();
  return spec.stateKeywords.some((keyword) => haystack.includes(keyword));
}

function rowMatches(spec: ThemeSpec, row: { type: string; id: string; symbol: string; label: string }) {
  if (spec.monitorTypes?.includes(row.type)) return true;
  const haystack = `${row.id} ${row.symbol} ${row.label}`.toLowerCase();
  return (spec.rowKeywords ?? []).some((keyword) => haystack.includes(keyword));
}

export async function GET() {
  const [desk, monitor] = await Promise.all([getDeskData(), getMarketMonitor()]);

  const publicStates = desk.marketStateRecords.map((record) => ({
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
  }));

  const themes = THEME_SPECS.map((spec) => {
    const states = publicStates.filter((record) => stateMatches(spec, record.sector, record.subIndustry));
    const rows = monitor.rows.filter((row) => rowMatches(spec, row));

    const stateScores = states.map((record) => textScore(`${record.direction} ${record.status}`));
    const marketScores = rows
      .filter((row) => typeof row.change5d === "number")
      .map((row) => clamp((row.change5d ?? 0) / 4, -1, 1));

    const stateAverage = stateScores.length ? stateScores.reduce((a, b) => a + b, 0) / stateScores.length : 0;
    const marketAverage = marketScores.length ? marketScores.reduce((a, b) => a + b, 0) / marketScores.length : 0;
    const rawScore = stateScores.length && marketScores.length
      ? stateAverage * 1.25 + marketAverage * 0.75
      : stateScores.length
        ? stateAverage * 1.5
        : marketAverage * 1.25;
    const score = Math.round(clamp(rawScore, -2, 2) * 10) / 10;
    const confidence = clamp(25 + states.length * 9 + rows.length * 3, 25, 95);

    const drivers = [
      ...states.slice(0, 3).map((record) => record.evidenceSummary).filter(Boolean),
      ...rows
        .filter((row) => row.hot || row.contradiction || (row.attentionScore ?? 0) > 55)
        .slice(0, 2)
        .map((row) => `${row.label}: 5D ${typeof row.change5d === "number" ? `${row.change5d.toFixed(1)}%` : "n/a"}; ${row.tags.join(", ")}`),
    ].slice(0, 4);

    return {
      theme: spec.theme,
      score,
      confidence,
      regime: score >= 0.8 ? "supportive" : score <= -0.8 ? "cautious" : "neutral",
      drivers,
      nextTests: states.map((record) => record.nextTest).filter(Boolean).slice(0, 3),
      stateCount: states.length,
      marketRowCount: rows.length,
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
      version: 1,
      source: "Alchemy Live Market Desk",
      generatedAt: new Date().toISOString(),
      marketUpdatedAt: monitor.updatedAt,
      themes,
      contradictions: monitor.contradictions.slice(0, 8),
      researchTriggers: monitor.researchTriggers.slice(0, 8),
      marketRows,
      marketStates: publicStates.slice(0, 80),
      note: "Read-only, sanitized context feed for Power Stack. It exposes no credentials, transcript text, private run metadata, or mutation route.",
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
