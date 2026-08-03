export type PricePoint = { time: number; close: number };

export type MarketSeries = {
  symbol: string;
  label: string;
  sourceUrl: string;
  points: PricePoint[];
  last: number | null;
  change5d: number | null;
  change21d: number | null;
};

export type BreadthFrame = {
  above20: number;
  above50: number;
  above200: number;
  newHighs20: number;
  newLows20: number;
};

export type BreadthSnapshot = {
  id: string;
  label: string;
  sampleSize: number;
  current: BreadthFrame;
  weekAgo: BreadthFrame;
  monthAgo: BreadthFrame;
};

export type CrackSeries = {
  id: string;
  label: string;
  formula: string;
  sourceUrl: string;
  points: PricePoint[];
  last: number | null;
  change5d: number | null;
  change21d: number | null;
};

export type MarketData = {
  updatedAt: string;
  series: MarketSeries[];
  breadth: BreadthSnapshot[];
  cracks: CrackSeries[];
  pulseWeek: number;
  pulseMonth: number;
  limitation: string | null;
};

const CORE_SYMBOLS: Record<string, string> = {
  "^GSPC": "S&P 500",
  RSP: "S&P 500 Equal Weight",
  "^IXIC": "Nasdaq Composite",
  SOXX: "Semiconductors",
  AMD: "AMD",
  AAPL: "Apple",
  MSFT: "Microsoft",
  AMZN: "Amazon",
  GOOGL: "Alphabet",
  META: "Meta",
  NVDA: "Nvidia",
  TSLA: "Tesla",
  "JPY=X": "USDJPY",
  "CL=F": "WTI crude",
  "BZ=F": "Brent crude",
  "RB=F": "RBOB gasoline",
  "HO=F": "ULSD / heating oil",
  "^FVX": "US 5-year yield",
  "^TNX": "US 10-year yield",
  "^TYX": "US 30-year yield",
};

const MAG7 = ["AAPL", "MSFT", "AMZN", "GOOGL", "META", "NVDA", "TSLA"];
const AI_BASKET = ["NVDA", "AMD", "AVGO", "MRVL", "MU", "TSM", "ASML", "ARM", "ANET", "DELL", "HPE", "SMCI", "VRT", "CEG", "GEV", "MSFT", "AMZN", "GOOGL", "META", "ORCL"];
const LARGE_CAP_PROXY = [
  "AAPL","MSFT","AMZN","GOOGL","META","NVDA","TSLA","BRK-B","JPM","V","MA","UNH","LLY","XOM","CVX","JNJ","PG","HD","COST","WMT","ABBV","KO","PEP","MRK","BAC","CRM","ORCL","CSCO","ACN","MCD","NFLX","AMD","INTC","QCOM","TXN","AVGO","IBM","GE","CAT","BA","HON","UPS","RTX","LMT","NOC","GS","MS","BLK","C","WFC","SPGI","AXP","TMO","DHR","ABT","AMGN","GILD","PFE","BMY","MDT","ISRG","LOW","NKE","SBUX","BKNG","DIS","CMCSA","T","VZ","NEE","DUK","SO","COP","SLB","EOG","LIN","APD","MMM","DE","GM","F","UNP","FDX","ADBE","NOW","PANW","CRWD","MU","AMAT","LRCX","KLAC","ASML","TSM","PLTR","UBER","ABNB","PYPL","INTU","SNOW"
];

function yahooChartUrl(symbol: string) {
  return `https://finance.yahoo.com/quote/${encodeURIComponent(symbol)}/chart/`;
}

function pctChange(points: PricePoint[], sessions: number) {
  if (points.length <= sessions) return null;
  const last = points.at(-1)?.close;
  const prior = points.at(-(sessions + 1))?.close;
  if (!last || !prior) return null;
  return ((last / prior) - 1) * 100;
}

function normaliseYahooResult(item: any): PricePoint[] {
  const response = item?.response?.[0];
  const times: number[] = response?.timestamp || [];
  const closes: Array<number | null> = response?.indicators?.quote?.[0]?.close || [];
  return times.flatMap((time, index) => {
    const close = closes[index];
    return typeof close === "number" && Number.isFinite(close) ? [{ time, close }] : [];
  });
}

async function fetchSpark(symbols: string[]) {
  const unique = [...new Set(symbols)];
  const batches: string[][] = [];
  for (let index = 0; index < unique.length; index += 45) batches.push(unique.slice(index, index + 45));
  const results = await Promise.allSettled(batches.map(async (batch) => {
    const endpoint = `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${encodeURIComponent(batch.join(","))}&range=1y&interval=1d`;
    const response = await fetch(endpoint, {
      headers: { "user-agent": "Alchemy Live Desk market monitor" },
      next: { revalidate: 1800 },
    });
    if (!response.ok) throw new Error(`Yahoo ${response.status}`);
    return response.json();
  }));
  const map = new Map<string, PricePoint[]>();
  for (const result of results) {
    if (result.status !== "fulfilled") continue;
    for (const item of result.value?.spark?.result || []) map.set(item.symbol, normaliseYahooResult(item));
  }
  return map;
}

function frameAt(histories: Map<string, PricePoint[]>, symbols: string[], offset: number): BreadthFrame {
  let valid = 0, above20 = 0, above50 = 0, above200 = 0, newHighs20 = 0, newLows20 = 0;
  for (const symbol of symbols) {
    const points = histories.get(symbol) || [];
    const end = points.length - offset;
    if (end < 21) continue;
    const closes = points.slice(0, end).map((point) => point.close);
    const current = closes.at(-1);
    if (!current) continue;
    valid += 1;
    const mean = (length: number) => closes.length >= length ? closes.slice(-length).reduce((sum, value) => sum + value, 0) / length : null;
    const ma20 = mean(20), ma50 = mean(50), ma200 = mean(200);
    if (ma20 && current > ma20) above20 += 1;
    if (ma50 && current > ma50) above50 += 1;
    if (ma200 && current > ma200) above200 += 1;
    const recent = closes.slice(-20);
    if (recent.length === 20 && current >= Math.max(...recent)) newHighs20 += 1;
    if (recent.length === 20 && current <= Math.min(...recent)) newLows20 += 1;
  }
  const percent = (value: number) => valid ? Math.round(value / valid * 100) : 0;
  return { above20: percent(above20), above50: percent(above50), above200: percent(above200), newHighs20, newLows20 };
}

function breadthSnapshot(histories: Map<string, PricePoint[]>, id: string, label: string, symbols: string[]): BreadthSnapshot {
  const sampleSize = symbols.filter((symbol) => (histories.get(symbol)?.length || 0) >= 50).length;
  return {
    id,
    label,
    sampleSize,
    current: frameAt(histories, symbols, 0),
    weekAgo: frameAt(histories, symbols, 5),
    monthAgo: frameAt(histories, symbols, 21),
  };
}

function alignFormula(histories: Map<string, PricePoint[]>, formula: (values: Record<string, number>) => number, symbols: string[]) {
  const maps = symbols.map((symbol) => new Map((histories.get(symbol) || []).map((point) => [point.time, point.close])));
  const common = [...(maps[0]?.keys() || [])].filter((time) => maps.every((map) => map.has(time))).sort((a, b) => a - b);
  return common.map((time) => ({ time, close: formula(Object.fromEntries(symbols.map((symbol, index) => [symbol, maps[index].get(time)!]))) }));
}

function buildCrack(id: string, label: string, formulaText: string, points: PricePoint[]): CrackSeries {
  return {
    id,
    label,
    formula: formulaText,
    sourceUrl: "https://www.eia.gov/finance/markets/products/prices.php",
    points,
    last: points.at(-1)?.close ?? null,
    change5d: pctChange(points, 5),
    change21d: pctChange(points, 21),
  };
}

function clamp(value: number) { return Math.max(0, Math.min(100, Math.round(value))); }

function calculatePulse(series: MarketSeries[], breadth: BreadthSnapshot, sessions: 5 | 21) {
  const moves = ["^GSPC", "RSP", "SOXX"].map((symbol) => {
    const item = series.find((entry) => entry.symbol === symbol);
    return sessions === 5 ? item?.change5d : item?.change21d;
  }).filter((value): value is number => typeof value === "number");
  const averageMove = moves.length ? moves.reduce((sum, value) => sum + value, 0) / moves.length : 0;
  const prior = sessions === 5 ? breadth.weekAgo : breadth.monthAgo;
  const breadthDelta = breadth.current.above50 - prior.above50;
  const highLow = breadth.current.newHighs20 - breadth.current.newLows20;
  return clamp(50 + averageMove * 3 + (breadth.current.above50 - 50) * .35 + breadthDelta * .7 + highLow * .15);
}

export async function getMarketData(): Promise<MarketData> {
  try {
    const requested = [...Object.keys(CORE_SYMBOLS), ...MAG7, ...AI_BASKET, ...LARGE_CAP_PROXY];
    const histories = await fetchSpark(requested);
    const series = Object.entries(CORE_SYMBOLS).map(([symbol, label]) => {
      const points = histories.get(symbol) || [];
      return { symbol, label, sourceUrl: yahooChartUrl(symbol), points, last: points.at(-1)?.close ?? null, change5d: pctChange(points, 5), change21d: pctChange(points, 21) };
    });
    const breadth = [
      breadthSnapshot(histories, "large-cap", "US large-cap proxy", LARGE_CAP_PROXY),
      breadthSnapshot(histories, "ai-basket", "AI infrastructure basket", AI_BASKET),
      breadthSnapshot(histories, "mag7", "Magnificent Seven", MAG7),
    ];
    const gasoline = alignFormula(histories, (v) => v["RB=F"] * 42 - v["CL=F"], ["RB=F", "CL=F"]);
    const distillate = alignFormula(histories, (v) => v["HO=F"] * 42 - v["CL=F"], ["HO=F", "CL=F"]);
    const threeTwoOne = alignFormula(histories, (v) => ((2 * v["RB=F"] * 42) + (v["HO=F"] * 42) - (3 * v["CL=F"])) / 3, ["RB=F", "HO=F", "CL=F"]);
    const cracks = [
      buildCrack("gasoline", "RBOB gasoline crack", "RBOB × 42 − WTI", gasoline),
      buildCrack("distillate", "ULSD distillate crack", "Heating oil × 42 − WTI", distillate),
      buildCrack("321", "3:2:1 refining crack", "((2 × RBOB × 42) + (ULSD × 42) − (3 × WTI)) ÷ 3", threeTwoOne),
    ];
    return {
      updatedAt: new Date().toISOString(),
      series,
      breadth,
      cracks,
      pulseWeek: calculatePulse(series, breadth[0], 5),
      pulseMonth: calculatePulse(series, breadth[0], 21),
      limitation: breadth[0].sampleSize < 70 ? "Yahoo returned an incomplete large-cap sample. Breadth is shown with the live sample size." : null,
    };
  } catch {
    return { updatedAt: new Date().toISOString(), series: [], breadth: [], cracks: [], pulseWeek: 50, pulseMonth: 50, limitation: "Yahoo market data was temporarily unavailable." };
  }
}
