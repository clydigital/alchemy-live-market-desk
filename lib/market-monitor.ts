import { unstable_cache } from "next/cache";

import { getMarketData, type MarketSeries, type PricePoint } from "@/lib/market";

export type MarketMonitorType =
  | "Major Index"
  | "Sector"
  | "AI / Semis"
  | "MAG7"
  | "Metal"
  | "Energy"
  | "FX"
  | "Rates"
  | "Credit / Risk"
  | "IPO / New Issue"
  | "Crypto";

export type MarketMonitorPoint = PricePoint & {
  open?: number | null;
  high?: number | null;
  low?: number | null;
};

export type MarketMonitorRow = {
  id: string;
  symbol: string;
  label: string;
  type: MarketMonitorType;
  benchmark: string | null;
  last: number | null;
  previousClose: number | null;
  sessionOpen: number | null;
  dayChange: number | null;
  gapChange: number | null;
  change3d: number | null;
  change5d: number | null;
  rsi: number | null;
  stochRsi: number | null;
  volPercentile: number | null;
  relative5d: number | null;
  attentionScore: number;
  hot: boolean;
  contradiction: boolean;
  tags: string[];
  asOf: string | null;
  frequency: "daily" | "monthly";
  sourceName: string;
  sourceUrl: string;
  points: Array<{ time: number; close: number }>;
};

export type MarketContradiction = {
  id: string;
  title: string;
  detail: string;
  assets: string[];
  priority: number;
  researchQuestion: string;
};

export type MarketResearchTrigger = {
  id: string;
  priority: number;
  assets: string[];
  reason: string;
  researchQuestion: string;
};

export type MarketMonitor = {
  updatedAt: string;
  rows: MarketMonitorRow[];
  contradictions: MarketContradiction[];
  researchTriggers: MarketResearchTrigger[];
  limitations: string[];
};

type NasdaqAssetClass = "stocks" | "etf" | "index";
type ExtraSpec = {
  id: string;
  providerSymbol: string;
  assetClass: NasdaqAssetClass;
  label: string;
  type: MarketMonitorType;
  benchmark?: string;
};

type BaseSpec = {
  id: string;
  sourceSymbol: string;
  label: string;
  type: MarketMonitorType;
  benchmark?: string;
};

type RawSeries = {
  id: string;
  symbol: string;
  label: string;
  type: MarketMonitorType;
  benchmark: string | null;
  points: MarketMonitorPoint[];
  sourceName: string;
  sourceUrl: string;
  frequency: "daily" | "monthly";
};

const HISTORY_DAYS = 470;
const EXTRA_REVALIDATE = 60 * 60;

const BASE_SPECS: BaseSpec[] = [
  { id: "spx", sourceSymbol: "^GSPC", label: "S&P 500", type: "Major Index" },
  { id: "rsp", sourceSymbol: "RSP", label: "S&P 500 Equal Weight", type: "Major Index", benchmark: "spx" },
  { id: "nasdaq-comp", sourceSymbol: "^IXIC", label: "Nasdaq Composite", type: "Major Index", benchmark: "spx" },
  { id: "soxx", sourceSymbol: "SOXX", label: "SOXX Semiconductors", type: "AI / Semis", benchmark: "ndx" },
  { id: "amd", sourceSymbol: "AMD", label: "AMD", type: "AI / Semis", benchmark: "ndx" },
  { id: "aapl", sourceSymbol: "AAPL", label: "Apple", type: "MAG7", benchmark: "ndx" },
  { id: "msft", sourceSymbol: "MSFT", label: "Microsoft", type: "MAG7", benchmark: "ndx" },
  { id: "amzn", sourceSymbol: "AMZN", label: "Amazon", type: "MAG7", benchmark: "ndx" },
  { id: "googl", sourceSymbol: "GOOGL", label: "Alphabet", type: "MAG7", benchmark: "ndx" },
  { id: "meta", sourceSymbol: "META", label: "Meta", type: "MAG7", benchmark: "ndx" },
  { id: "nvda", sourceSymbol: "NVDA", label: "Nvidia", type: "MAG7", benchmark: "ndx" },
  { id: "tsla", sourceSymbol: "TSLA", label: "Tesla", type: "MAG7", benchmark: "ndx" },
  { id: "gold", sourceSymbol: "GLD", label: "Gold · GLD proxy", type: "Metal" },
  { id: "silver", sourceSymbol: "SLV", label: "Silver · SLV proxy", type: "Metal", benchmark: "gold" },
  { id: "copper", sourceSymbol: "CPER", label: "Copper · CPER proxy", type: "Metal" },
  { id: "gdx", sourceSymbol: "GDX", label: "Gold Miners · GDX", type: "Metal", benchmark: "gold" },
  { id: "dxy", sourceSymbol: "UUP", label: "US Dollar · UUP proxy", type: "FX" },
  { id: "eur", sourceSymbol: "FXE", label: "Euro · FXE proxy", type: "FX" },
  { id: "gbp", sourceSymbol: "FXB", label: "Sterling · FXB proxy", type: "FX" },
  { id: "cad", sourceSymbol: "FXC", label: "Canadian Dollar · FXC proxy", type: "FX" },
  { id: "usdjpy", sourceSymbol: "JPY=X", label: "USDJPY · ECB cross", type: "FX" },
  { id: "wti", sourceSymbol: "CL=F", label: "WTI Spot", type: "Energy" },
  { id: "brent", sourceSymbol: "BZ=F", label: "Brent Spot", type: "Energy" },
  { id: "gasoline", sourceSymbol: "RB=F", label: "NYH Gasoline Spot", type: "Energy", benchmark: "wti" },
  { id: "distillate", sourceSymbol: "HO=F", label: "NYH Heating Oil Spot", type: "Energy", benchmark: "wti" },
  { id: "us5y", sourceSymbol: "^FVX", label: "US 5Y Yield", type: "Rates" },
  { id: "us10y", sourceSymbol: "^TNX", label: "US 10Y Yield", type: "Rates" },
  { id: "us30y", sourceSymbol: "^TYX", label: "US 30Y Yield", type: "Rates" },
];

const EXTRA_SPECS: ExtraSpec[] = [
  { id: "ndx", providerSymbol: "QQQ", assetClass: "etf", label: "Nasdaq 100 · QQQ proxy", type: "Major Index", benchmark: "spx" },
  { id: "dow", providerSymbol: "DIA", assetClass: "etf", label: "Dow · DIA proxy", type: "Major Index", benchmark: "spx" },
  { id: "russell", providerSymbol: "IWM", assetClass: "etf", label: "Russell 2000 · IWM proxy", type: "Major Index", benchmark: "spx" },
  { id: "nikkei", providerSymbol: "EWJ", assetClass: "etf", label: "Japan Equities · EWJ proxy", type: "Major Index", benchmark: "spx" },
  { id: "kospi", providerSymbol: "EWY", assetClass: "etf", label: "Korea Equities · EWY proxy", type: "Major Index", benchmark: "spx" },
  { id: "hang-seng", providerSymbol: "EWH", assetClass: "etf", label: "Hong Kong Equities · EWH proxy", type: "Major Index", benchmark: "spx" },
  { id: "csi300", providerSymbol: "ASHR", assetClass: "etf", label: "China A-Shares · ASHR proxy", type: "Major Index", benchmark: "spx" },
  { id: "dax", providerSymbol: "EWG", assetClass: "etf", label: "Germany Equities · EWG proxy", type: "Major Index", benchmark: "spx" },
  { id: "eurostoxx", providerSymbol: "FEZ", assetClass: "etf", label: "Euro Stoxx 50 · FEZ proxy", type: "Major Index", benchmark: "spx" },
  { id: "ftse", providerSymbol: "EWU", assetClass: "etf", label: "UK Equities · EWU proxy", type: "Major Index", benchmark: "spx" },

  { id: "palladium", providerSymbol: "PALL", assetClass: "etf", label: "Palladium · PALL proxy", type: "Metal", benchmark: "gold" },
  { id: "platinum", providerSymbol: "PPLT", assetClass: "etf", label: "Platinum · PPLT proxy", type: "Metal", benchmark: "gold" },
  { id: "natgas", providerSymbol: "UNG", assetClass: "etf", label: "Natural Gas · UNG proxy", type: "Energy", benchmark: "wti" },

  { id: "smh", providerSymbol: "SMH", assetClass: "etf", label: "SMH Semiconductors", type: "AI / Semis", benchmark: "ndx" },
  { id: "botz", providerSymbol: "BOTZ", assetClass: "etf", label: "BOTZ Robotics & AI", type: "AI / Semis", benchmark: "ndx" },
  { id: "aiq", providerSymbol: "AIQ", assetClass: "etf", label: "AIQ Artificial Intelligence", type: "AI / Semis", benchmark: "ndx" },
  { id: "igv", providerSymbol: "IGV", assetClass: "etf", label: "IGV Software", type: "AI / Semis", benchmark: "ndx" },
  { id: "chat", providerSymbol: "CHAT", assetClass: "etf", label: "CHAT Generative AI", type: "AI / Semis", benchmark: "ndx" },
  { id: "avgo", providerSymbol: "AVGO", assetClass: "stocks", label: "Broadcom", type: "AI / Semis", benchmark: "ndx" },
  { id: "tsm", providerSymbol: "TSM", assetClass: "stocks", label: "TSMC", type: "AI / Semis", benchmark: "ndx" },
  { id: "asml", providerSymbol: "ASML", assetClass: "stocks", label: "ASML", type: "AI / Semis", benchmark: "ndx" },
  { id: "arm", providerSymbol: "ARM", assetClass: "stocks", label: "Arm", type: "AI / Semis", benchmark: "ndx" },
  { id: "mu", providerSymbol: "MU", assetClass: "stocks", label: "Micron", type: "AI / Semis", benchmark: "ndx" },
  { id: "mrvl", providerSymbol: "MRVL", assetClass: "stocks", label: "Marvell", type: "AI / Semis", benchmark: "ndx" },
  { id: "orcl", providerSymbol: "ORCL", assetClass: "stocks", label: "Oracle", type: "AI / Semis", benchmark: "ndx" },
  { id: "pltr", providerSymbol: "PLTR", assetClass: "stocks", label: "Palantir", type: "AI / Semis", benchmark: "ndx" },

  { id: "xlk", providerSymbol: "XLK", assetClass: "etf", label: "XLK Technology", type: "Sector", benchmark: "spx" },
  { id: "xlf", providerSymbol: "XLF", assetClass: "etf", label: "XLF Financials", type: "Sector", benchmark: "spx" },
  { id: "xle", providerSymbol: "XLE", assetClass: "etf", label: "XLE Energy", type: "Sector", benchmark: "spx" },
  { id: "xli", providerSymbol: "XLI", assetClass: "etf", label: "XLI Industrials", type: "Sector", benchmark: "spx" },
  { id: "xly", providerSymbol: "XLY", assetClass: "etf", label: "XLY Discretionary", type: "Sector", benchmark: "spx" },
  { id: "xlp", providerSymbol: "XLP", assetClass: "etf", label: "XLP Staples", type: "Sector", benchmark: "spx" },
  { id: "xlv", providerSymbol: "XLV", assetClass: "etf", label: "XLV Healthcare", type: "Sector", benchmark: "spx" },
  { id: "xlu", providerSymbol: "XLU", assetClass: "etf", label: "XLU Utilities", type: "Sector", benchmark: "spx" },
  { id: "xlb", providerSymbol: "XLB", assetClass: "etf", label: "XLB Materials", type: "Sector", benchmark: "spx" },
  { id: "xlre", providerSymbol: "XLRE", assetClass: "etf", label: "XLRE Real Estate", type: "Sector", benchmark: "spx" },
  { id: "xlc", providerSymbol: "XLC", assetClass: "etf", label: "XLC Communication", type: "Sector", benchmark: "spx" },

  { id: "hyg", providerSymbol: "HYG", assetClass: "etf", label: "High Yield Credit · HYG", type: "Credit / Risk", benchmark: "spx" },
  { id: "lqd", providerSymbol: "LQD", assetClass: "etf", label: "Investment Grade Credit · LQD", type: "Credit / Risk", benchmark: "spx" },
  { id: "jnk", providerSymbol: "JNK", assetClass: "etf", label: "High Yield Credit · JNK", type: "Credit / Risk", benchmark: "spx" },
  { id: "vixy", providerSymbol: "VIXY", assetClass: "etf", label: "VIX Futures · VIXY proxy", type: "Credit / Risk" },

  { id: "spcx", providerSymbol: "SPCX", assetClass: "etf", label: "SPCX New-Issue / SPAC", type: "IPO / New Issue", benchmark: "spx" },
  { id: "ipo", providerSymbol: "IPO", assetClass: "etf", label: "Renaissance IPO ETF", type: "IPO / New Issue", benchmark: "spx" },

  { id: "aud", providerSymbol: "FXA", assetClass: "etf", label: "Australian Dollar · FXA proxy", type: "FX" },
  { id: "jpy", providerSymbol: "FXY", assetClass: "etf", label: "Japanese Yen · FXY proxy", type: "FX" },
  { id: "chf", providerSymbol: "FXF", assetClass: "etf", label: "Swiss Franc · FXF proxy", type: "FX" },
  { id: "cnh", providerSymbol: "CYB", assetClass: "etf", label: "Chinese Yuan · CYB proxy", type: "FX" },

  { id: "btc", providerSymbol: "IBIT", assetClass: "etf", label: "Bitcoin · IBIT proxy", type: "Crypto", benchmark: "spx" },
  { id: "eth", providerSymbol: "ETHA", assetClass: "etf", label: "Ether · ETHA proxy", type: "Crypto", benchmark: "spx" },
];

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function parseNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[$,%]/g, "").replace(/,/g, "").trim();
  if (!cleaned || cleaned === "--" || cleaned === "N/A") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

async function mapLimit<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let cursor = 0;
  async function run() {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, run));
  return results;
}

async function fetchNasdaqHistory(spec: ExtraSpec): Promise<RawSeries> {
  const end = new Date();
  const start = new Date(end.getTime() - HISTORY_DAYS * 86400000);
  const endpoint = `https://api.nasdaq.com/api/quote/${encodeURIComponent(spec.providerSymbol)}/historical?assetclass=${spec.assetClass}&fromdate=${isoDate(start)}&todate=${isoDate(end)}&limit=5000`;
  const response = await fetch(endpoint, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      accept: "application/json, text/plain, */*",
      origin: "https://www.nasdaq.com",
      referer: "https://www.nasdaq.com/market-activity/",
    },
    next: { revalidate: EXTRA_REVALIDATE },
  });
  if (!response.ok) throw new Error(`Nasdaq ${spec.providerSymbol} ${response.status}`);
  const payload = await response.json();
  if (payload?.status?.rCode !== 200) throw new Error(`Nasdaq ${spec.providerSymbol} unavailable`);
  const rows: Array<Record<string, string>> = payload?.data?.tradesTable?.rows || [];
  const points = rows.flatMap((row) => {
    const close = parseNumber(row.close);
    const open = parseNumber(row.open);
    const high = parseNumber(row.high);
    const low = parseNumber(row.low);
    const match = row.date?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (close === null || !match) return [];
    const time = Date.UTC(Number(match[3]), Number(match[1]) - 1, Number(match[2])) / 1000;
    return [{ time, close, open, high, low }];
  }).sort((a, b) => a.time - b.time).slice(-300);
  return {
    id: spec.id,
    symbol: spec.providerSymbol,
    label: spec.label,
    type: spec.type,
    benchmark: spec.benchmark || null,
    points,
    sourceName: `Nasdaq official ${spec.assetClass} history`,
    sourceUrl: `https://www.nasdaq.com/market-activity/${spec.assetClass === "stocks" ? "stocks" : spec.assetClass}/${spec.providerSymbol.toLowerCase()}/historical`,
    frequency: "daily",
  };
}

async function fetchFredSeries(id: string, label: string): Promise<RawSeries> {
  const endpoint = `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${encodeURIComponent(id)}`;
  const response = await fetch(endpoint, { next: { revalidate: 60 * 60 * 6 }, headers: { "user-agent": "Alchemy Live Desk" } });
  if (!response.ok) throw new Error(`FRED ${id} ${response.status}`);
  const lines = (await response.text()).split(/\r?\n/).slice(1);
  const points = lines.flatMap((line) => {
    const [date, raw] = line.split(",");
    const close = parseNumber(raw);
    const time = Date.parse(`${date}T00:00:00Z`) / 1000;
    return close == null || !Number.isFinite(time) ? [] : [{ time, close }];
  }).slice(-300);
  return {
    id: id === "DGS2" ? "us2y" : id === "IRLTLT01EZM156N" ? "eur10y" : "jp10y",
    symbol: id,
    label,
    type: "Rates",
    benchmark: null,
    points,
    sourceName: "Federal Reserve Economic Data",
    sourceUrl: `https://fred.stlouisfed.org/series/${id}`,
    frequency: id === "DGS2" ? "daily" : "monthly",
  };
}

const loadExtras = unstable_cache(async () => {
  const startTime = Date.now();
  const extraRows = await mapLimit(EXTRA_SPECS, 10, async (spec) => {
    try { return await fetchNasdaqHistory(spec); } catch (err) {
      console.warn(`[PERF] fetchNasdaqHistory failed for ${spec.providerSymbol}:`, String(err));
      return null;
    }
  });
  const rateRows = await Promise.all([
    fetchFredSeries("DGS2", "US 2Y Yield").catch((err) => { console.warn("[PERF] fetchFredSeries DGS2 failed:", String(err)); return null; }),
    fetchFredSeries("IRLTLT01EZM156N", "Euro Area 10Y Yield · monthly").catch((err) => { console.warn("[PERF] fetchFredSeries IRLTLT01EZM156N failed:", String(err)); return null; }),
    fetchFredSeries("IRLTLT01JPM156N", "Japan 10Y Yield · monthly").catch((err) => { console.warn("[PERF] fetchFredSeries IRLTLT01JPM156N failed:", String(err)); return null; }),
  ]);
  const duration = Date.now() - startTime;
  console.log(`[PERF] loadExtras cold execution took ${duration}ms`);
  return [...extraRows, ...rateRows].filter((row): row is RawSeries => Boolean(row));
}, ["alchemy-market-monitor-extras-v1"], { revalidate: EXTRA_REVALIDATE });

function baseRaw(spec: BaseSpec, series: MarketSeries): RawSeries {
  return {
    id: spec.id,
    symbol: series.symbol,
    label: spec.label,
    type: spec.type,
    benchmark: spec.benchmark || null,
    points: series.points.map((point) => ({ ...point })),
    sourceName: series.sourceName,
    sourceUrl: series.sourceUrl,
    frequency: "daily",
  };
}

function pct(points: MarketMonitorPoint[], sessions: number) {
  if (points.length <= sessions) return null;
  const last = points.at(-1)?.close;
  const prior = points.at(-(sessions + 1))?.close;
  if (typeof last !== "number" || typeof prior !== "number" || prior === 0) return null;
  return ((last / prior) - 1) * 100;
}

function rsiSeries(points: MarketMonitorPoint[], period = 14) {
  const closes = points.map((point) => point.close);
  const output: Array<number | null> = Array(closes.length).fill(null);
  if (closes.length <= period) return output;
  let gains = 0;
  let losses = 0;
  for (let index = 1; index <= period; index += 1) {
    const delta = closes[index] - closes[index - 1];
    gains += Math.max(delta, 0);
    losses += Math.max(-delta, 0);
  }
  let avgGain = gains / period;
  let avgLoss = losses / period;
  output[period] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  for (let index = period + 1; index < closes.length; index += 1) {
    const delta = closes[index] - closes[index - 1];
    avgGain = (avgGain * (period - 1) + Math.max(delta, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-delta, 0)) / period;
    output[index] = avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
  }
  return output;
}

function latestRsi(points: MarketMonitorPoint[]) {
  return rsiSeries(points).at(-1) ?? null;
}

function latestStochRsi(points: MarketMonitorPoint[], period = 14) {
  const values = rsiSeries(points).filter((value): value is number => typeof value === "number");
  if (values.length < period) return null;
  const window = values.slice(-period);
  const current = window.at(-1)!;
  const low = Math.min(...window);
  const high = Math.max(...window);
  if (high === low) return 50;
  return ((current - low) / (high - low)) * 100;
}

function std(values: number[]) {
  if (values.length < 2) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance = values.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function volPercentile(points: MarketMonitorPoint[]) {
  const returns = points.slice(1).map((point, index) => Math.log(point.close / points[index].close)).filter(Number.isFinite);
  if (returns.length < 45) return null;
  const windows: number[] = [];
  for (let index = 20; index <= returns.length; index += 1) {
    const value = std(returns.slice(index - 20, index));
    if (value != null) windows.push(value * Math.sqrt(252));
  }
  const sample = windows.slice(-120);
  const current = sample.at(-1);
  if (current == null || sample.length < 20) return null;
  return sample.filter((value) => value <= current).length / sample.length * 100;
}

function round(value: number | null, digits = 2) {
  return value == null || !Number.isFinite(value) ? null : Number(value.toFixed(digits));
}

function attentionBase(row: Omit<MarketMonitorRow, "attentionScore" | "hot" | "contradiction" | "tags">) {
  let score = 0;
  if (row.dayChange != null) score += Math.min(28, Math.abs(row.dayChange) * 8);
  if (row.change3d != null) score += Math.min(16, Math.abs(row.change3d) * 2.5);
  if (row.change5d != null) score += Math.min(12, Math.abs(row.change5d) * 1.5);
  if (row.gapChange != null) score += Math.min(10, Math.abs(row.gapChange) * 5);
  if (row.rsi != null) score += Math.max(0, Math.abs(row.rsi - 50) - 15) * 0.7;
  if (row.volPercentile != null && row.volPercentile > 70) score += (row.volPercentile - 70) * 0.35;
  if (row.relative5d != null) score += Math.min(10, Math.abs(row.relative5d) * 1.5);
  return Math.max(0, Math.min(100, Math.round(score)));
}

function formatDate(time: number | undefined) {
  return typeof time === "number" ? new Date(time * 1000).toISOString().slice(0, 10) : null;
}

function makeRows(rawSeries: RawSeries[]): MarketMonitorRow[] {
  const prelim = rawSeries.map((raw) => {
    const points = raw.points.filter((point) => Number.isFinite(point.close)).sort((a, b) => a.time - b.time);
    const last = points.at(-1);
    const previous = points.at(-2);
    const previousClose = previous?.close ?? null;
    const sessionOpen = last?.open ?? null;
    const row = {
      id: raw.id,
      symbol: raw.symbol,
      label: raw.label,
      type: raw.type,
      benchmark: raw.benchmark,
      last: last?.close ?? null,
      previousClose,
      sessionOpen,
      dayChange: previousClose && last ? (last.close / previousClose - 1) * 100 : null,
      gapChange: previousClose && sessionOpen ? (sessionOpen / previousClose - 1) * 100 : null,
      change3d: pct(points, 3),
      change5d: pct(points, 5),
      rsi: latestRsi(points),
      stochRsi: latestStochRsi(points),
      volPercentile: volPercentile(points),
      relative5d: null,
      asOf: formatDate(last?.time),
      frequency: raw.frequency,
      sourceName: raw.sourceName,
      sourceUrl: raw.sourceUrl,
      points: points.slice(-64).map((point) => ({ time: point.time, close: point.close })),
    } satisfies Omit<MarketMonitorRow, "attentionScore" | "hot" | "contradiction" | "tags">;
    return row;
  });
  const byId = new Map(prelim.map((row) => [row.id, row]));
  return prelim.map((row) => {
    const benchmark = row.benchmark ? byId.get(row.benchmark) : null;
    const relative5d = row.change5d != null && benchmark?.change5d != null ? row.change5d - benchmark.change5d : null;
    const withRelative = { ...row, relative5d };
    return {
      ...withRelative,
      dayChange: round(withRelative.dayChange),
      gapChange: round(withRelative.gapChange),
      change3d: round(withRelative.change3d),
      change5d: round(withRelative.change5d),
      rsi: round(withRelative.rsi, 1),
      stochRsi: round(withRelative.stochRsi, 1),
      volPercentile: round(withRelative.volPercentile, 0),
      relative5d: round(relative5d),
      attentionScore: attentionBase(withRelative),
      hot: false,
      contradiction: false,
      tags: [],
    } satisfies MarketMonitorRow;
  });
}

function move(row: MarketMonitorRow | undefined, key: "dayChange" | "change5d") {
  return row?.[key] ?? 0;
}

function buildContradictions(rows: MarketMonitorRow[]) {
  const by = new Map(rows.map((row) => [row.id, row]));
  const output: MarketContradiction[] = [];
  const add = (item: MarketContradiction | null) => { if (item) output.push(item); };

  const ndx = by.get("ndx");
  const soxx = by.get("soxx");
  if (ndx && soxx && Math.sign(move(ndx, "dayChange")) !== Math.sign(move(soxx, "dayChange")) && Math.abs(move(ndx, "dayChange") - move(soxx, "dayChange")) >= 1) {
    add({ id: "ndx-soxx", title: "Nasdaq and semis are diverging", detail: `NDX proxy ${move(ndx, "dayChange").toFixed(1)}% vs SOXX ${move(soxx, "dayChange").toFixed(1)}%.`, assets: ["ndx", "soxx"], priority: 88, researchQuestion: "Is tech participation broadening beyond semiconductors, or is AI leadership breaking?" });
  }
  const spx = by.get("spx");
  const rsp = by.get("rsp");
  if (spx && rsp && Math.abs(move(spx, "change5d") - move(rsp, "change5d")) >= 1.5) {
    add({ id: "spx-rsp", title: "Headline index and equal weight are separating", detail: `SPX proxy ${move(spx, "change5d").toFixed(1)}% over 5D vs RSP ${move(rsp, "change5d").toFixed(1)}%.`, assets: ["spx", "rsp"], priority: 82, researchQuestion: "Is the index move becoming more concentrated or is breadth beginning to catch up?" });
  }
  const copper = by.get("copper");
  const china = by.get("csi300");
  const cnh = by.get("cnh");
  if (copper && china && Math.abs(move(copper, "change5d") - move(china, "change5d")) >= 3) {
    add({ id: "copper-china", title: "Copper is decoupling from China equities", detail: `Copper proxy ${move(copper, "change5d").toFixed(1)}% vs China A-shares ${move(china, "change5d").toFixed(1)}% over 5D${cnh ? `; yuan proxy ${move(cnh, "change5d").toFixed(1)}%` : ""}.`, assets: ["copper", "csi300", ...(cnh ? ["cnh"] : [])], priority: 84, researchQuestion: "Is copper responding to a supply shock or non-China demand rather than a broad China growth impulse?" });
  }
  const gold = by.get("gold");
  const us10y = by.get("us10y");
  if (gold && us10y && move(gold, "change5d") > 1 && move(us10y, "change5d") > 2) {
    add({ id: "gold-yields", title: "Gold is rising with US yields", detail: `Gold proxy ${move(gold, "change5d").toFixed(1)}% while the US 10Y yield level is also higher over 5D.`, assets: ["gold", "us10y"], priority: 78, researchQuestion: "What is overpowering the usual rate headwind for gold: sovereign demand, risk hedging, inflation or dollar weakness?" });
  }
  return output.sort((a, b) => b.priority - a.priority);
}

function buildResearchTriggers(rows: MarketMonitorRow[], contradictions: MarketContradiction[]) {
  const triggers: MarketResearchTrigger[] = contradictions.map((item) => ({
    id: `contradiction-${item.id}`,
    priority: item.priority,
    assets: item.assets,
    reason: item.title,
    researchQuestion: item.researchQuestion,
  }));
  for (const row of rows.filter((item) => item.attentionScore >= 65).sort((a, b) => b.attentionScore - a.attentionScore).slice(0, 12)) {
    triggers.push({
      id: `hot-${row.id}`,
      priority: Math.min(95, row.attentionScore),
      assets: [row.id],
      reason: `${row.label} has an Attention Score of ${row.attentionScore}${row.dayChange != null ? ` after a ${row.dayChange >= 0 ? "+" : ""}${row.dayChange.toFixed(1)}% daily move` : ""}.`,
      researchQuestion: `What changed in the verified fundamental, flow or positioning backdrop for ${row.label}, and does it alter an active Story?`,
    });
  }
  return triggers.sort((a, b) => b.priority - a.priority).slice(0, 18);
}

async function loadMarketMonitor(): Promise<MarketMonitor> {
  const [market, extras] = await Promise.all([getMarketData(), loadExtras()]);
  const bySymbol = new Map(market.series.map((series) => [series.symbol, series]));
  const base = BASE_SPECS.flatMap((spec) => {
    const series = bySymbol.get(spec.sourceSymbol);
    return series ? [baseRaw(spec, series)] : [];
  });

  for (const crack of market.cracks) {
    base.push({
      id: `crack-${crack.id}`,
      symbol: crack.id,
      label: crack.label,
      type: "Energy",
      benchmark: "wti",
      points: crack.points,
      sourceName: crack.sourceName,
      sourceUrl: crack.sourceUrl,
      frequency: "daily",
    });
  }

  let rows = makeRows([...base, ...extras]);
  const contradictions = buildContradictions(rows);
  const contradictionIds = new Set(contradictions.flatMap((item) => item.assets));
  rows = rows.map((row) => {
    const tags: string[] = [];
    if (row.rsi != null && row.rsi < 30) tags.push("OVERSOLD");
    if (row.rsi != null && row.rsi > 70) tags.push("OVERBOUGHT");
    if (row.volPercentile != null && row.volPercentile >= 80) tags.push("HIGH VOL");
    if (row.gapChange != null && Math.abs(row.gapChange) >= 1) tags.push(row.gapChange > 0 ? "GAP UP" : "GAP DOWN");
    if (row.relative5d != null && Math.abs(row.relative5d) >= 2) tags.push(row.relative5d > 0 ? "OUTPERFORMING" : "LAGGING");
    if (contradictionIds.has(row.id)) tags.push("CONTRADICTION");
    const attentionScore = Math.min(100, row.attentionScore + (contradictionIds.has(row.id) ? 10 : 0));
    return { ...row, attentionScore, hot: attentionScore >= 65, contradiction: contradictionIds.has(row.id), tags };
  });

  const limitations = [
    market.limitation,
    "Nasdaq/ETF rows are verified daily-history readings, not streaming quotes. Last can therefore represent the latest completed session rather than an intraday price.",
    "Daily open/gap is shown only when the upstream history exposes an opening price.",
    "Euro-area and Japan long-yield fallbacks are monthly until a reliable daily official structured feed is connected; daily momentum fields remain unavailable for those rows.",
    "MOVE and direct spot crypto are not substituted with unrelated instruments; VIXY, IBIT and ETHA are explicitly labelled proxies.",
  ].filter((item): item is string => Boolean(item));

  return {
    updatedAt: new Date().toISOString(),
    rows,
    contradictions,
    researchTriggers: buildResearchTriggers(rows, contradictions),
    limitations,
  };
}

export const getMarketMonitor = unstable_cache(loadMarketMonitor, ["alchemy-cross-asset-market-monitor-v1"], { revalidate: 300 });
