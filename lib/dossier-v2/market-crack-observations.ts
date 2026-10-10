/**
 * Read-only, quantified market-monitor diagnostics for the Market Dossier.
 *
 * Inputs are the *existing provider price histories*. No price is invented,
 * no provider metadata is a canonical intelligence_evidence UUID and no result
 * is allowed to mutate persistent Story state.
 */
export type MarketCrackSeries = {
  id: string;
  symbol: string;
  label: string;
  asOf: string | null;
  last: number | null;
  frequency: "daily" | "monthly";
  sourceName: string;
  sourceUrl: string;
  points?: Array<{ time: number; close: number }>;
};
export type MarketCrackObservation = {
  key: "hy_oas_20s" | "ig_oas_20s" | "smh_qqq_20s" | "xlf_spx_20s" | "rsp_spx_20s";
  label: string;
  status: "OK" | "UNAVAILABLE";
  reason: string | null;
  observedValue: number | null;
  unit: "basis_points" | "percentage_points";
  lastDate: string | null;
  baselineDate: string | null;
  sessions: number;
  sources: MarketCrackSeries[];
};

const LOOKBACK_SESSIONS = 20;
const MAX_OBSERVATION_AGE_MS = 5 * 86_400_000;
const MAX_WINDOW_SPAN_MS = 45 * 86_400_000;

const DEFINITIONS: Array<{
  key: MarketCrackObservation["key"];
  label: string;
  ids: readonly string[];
  unit: MarketCrackObservation["unit"];
}> = [
  { key: "hy_oas_20s", label: "US high-yield OAS 20-session change", ids: ["hy-oas"], unit: "basis_points" },
  { key: "ig_oas_20s", label: "US investment-grade OAS 20-session change", ids: ["ig-oas"], unit: "basis_points" },
  { key: "smh_qqq_20s", label: "SMH minus QQQ 20-session return", ids: ["smh", "ndx"], unit: "percentage_points" },
  { key: "xlf_spx_20s", label: "XLF minus S&P 500 cash 20-session return", ids: ["xlf", "spx"], unit: "percentage_points" },
  { key: "rsp_spx_20s", label: "RSP minus S&P 500 cash 20-session return", ids: ["rsp", "spx"], unit: "percentage_points" },
];

const EXACT_FRED_OAS: Record<string, string> = {
  "hy-oas": "BAMLH0A0HYM2",
  "ig-oas": "BAMLC0A0CM",
};

function midnight(date: string) {
  const time = /^\d{4}-\d{2}-\d{2}$/.test(date) ? Date.parse(date + "T00:00:00Z") : Number.NaN;
  return Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date ? time : null;
}

function measuredPoints(series: MarketCrackSeries, asOf: number): Map<string, number> {
  const map = new Map<string, number>();
  const latestDeclared = series.asOf ? midnight(series.asOf) : null;
  if (latestDeclared === null || series.frequency !== "daily") return map;
  for (const point of series.points ?? []) {
    if (!Number.isFinite(point.time) || !Number.isFinite(point.close) || point.close <= 0) continue;
    const ms = point.time * 1000;
    if (ms > asOf || ms > latestDeclared + 86_400_000) continue;
    const date = new Date(ms).toISOString().slice(0, 10);
    // A provider exposes only a trading date, not a precise release time.
    // Do not mark the day's close available until that UTC day has ended.
    if (midnight(date)! + 86_400_000 > asOf) continue;
    if (midnight(date) === null || date > series.asOf!) continue;
    // Duplicate provider updates for the same date are reduced to one close.
    map.set(date, point.close);
  }
  return map;
}

function unresolved(
  definition: typeof DEFINITIONS[number],
  sources: MarketCrackSeries[],
  reason: string,
): MarketCrackObservation {
  return {
    key: definition.key,
    label: definition.label,
    status: "UNAVAILABLE",
    reason,
    observedValue: null,
    unit: definition.unit,
    lastDate: null,
    baselineDate: null,
    sessions: 0,
    sources,
  };
}

/**
 * Compare 21 *identically dated* observations (20 intervals), not each ETF's
 * arbitrary recent data window. FRED OAS series are in percentage points; 
 * (latest - baseline) * 100 gives basis points, never percent return.
 */
export function deriveMarketCrackObservations(
  rows: MarketCrackSeries[],
  asOf: string,
): MarketCrackObservation[] {
  const asOfMs = Date.parse(asOf);
  const byId = new Map(rows.map((row) => [row.id, row]));
  return DEFINITIONS.map((definition) => {
    const sources = definition.ids.flatMap((id) => {
      const row = byId.get(id);
      return row ? [row] : [];
    });
    if (!Number.isFinite(asOfMs)) return unresolved(definition, sources, "INVALID_AS_OF");
    if (sources.length !== definition.ids.length) return unresolved(definition, sources, "MISSING_PROVIDER_SERIES");
    if (sources.some((row) => row.frequency !== "daily")) return unresolved(definition, sources, "NONDAILY_SERIES");
    if (sources.some((row) => !row.sourceUrl.startsWith("https://"))) return unresolved(definition, sources, "SOURCE_URL_UNAVAILABLE");
    if (sources.some((row) => EXACT_FRED_OAS[row.id] && (
      row.symbol !== EXACT_FRED_OAS[row.id] || row.sourceName !== "Federal Reserve Economic Data"
    ))) return unresolved(definition, sources, "UNVERIFIED_OAS_SERIES");

    const histories = sources.map((row) => measuredPoints(row, asOfMs));
    const common = [...histories[0].keys()].filter((date) => histories.every((points) => points.has(date))).sort().reverse();
    if (common.length < LOOKBACK_SESSIONS + 1) {
      return unresolved(definition, sources, "INSUFFICIENT_MATCHED_SESSIONS");
    }
    const lastDate = common[0], baselineDate = common[LOOKBACK_SESSIONS];
    const latestMs = midnight(lastDate)!;
    const baselineMs = midnight(baselineDate)!;
    if (latestMs > asOfMs || asOfMs - latestMs > MAX_OBSERVATION_AGE_MS) {
      return unresolved(definition, sources, "STALE_OBSERVATION");
    }
    if (latestMs - baselineMs > MAX_WINDOW_SPAN_MS) {
      return unresolved(definition, sources, "INCOMPLETE_20_SESSION_WINDOW");
    }
    if (sources.some((source) => {
      const publishedMs = source.asOf ? midnight(source.asOf) : null;
      return publishedMs === null || publishedMs - latestMs > 5 * 86_400_000;
    })) return unresolved(definition, sources, "MATCHED_SERIES_LAG");

    const first = histories[0], aLatest = first.get(lastDate)!, aEarlier = first.get(baselineDate)!;
    let value: number;
    if (definition.unit === "basis_points") {
      value = (aLatest - aEarlier) * 100;
    } else {
      const second = histories[1];
      const bLatest = second.get(lastDate)!;
      const bEarlier = second.get(baselineDate)!;
      value = ((aLatest / aEarlier - 1) - (bLatest / bEarlier - 1)) * 100;
    }
    return {
      key: definition.key,
      label: definition.label,
      status: "OK",
      reason: null,
      observedValue: Math.round((value + Number.EPSILON) * 100) / 100,
      unit: definition.unit,
      lastDate,
      baselineDate,
      sessions: LOOKBACK_SESSIONS,
      sources,
    };
  });
}
