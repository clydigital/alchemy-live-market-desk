import { unstable_cache } from "next/cache";

export type PricePoint = { time: number; close: number };

export type MarketSeries = {
  symbol: string;
  label: string;
  sourceName: string;
  sourceUrl: string;
  points: PricePoint[];
  last: number | null;
  change5d: number | null;
  change21d: number | null;
};

export type BreadthFrame = {
  asOf: string | null;
  sampleSize: number;
  above20: number;
  above50: number;
  above200: number;
  newHighs20: number;
  newLows20: number;
};

export type BreadthSnapshot = {
  id: string;
  label: string;
  sourceName: string;
  sampleSize: number;
  targetSize: number;
  current: BreadthFrame;
  weekAgo: BreadthFrame;
  monthAgo: BreadthFrame;
};

export type CrackSeries = {
  id: string;
  label: string;
  sourceName: string;
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

type NasdaqAssetClass = "stocks" | "etf" | "index";
type NasdaqRequest = { providerSymbol: string; assetClass: NasdaqAssetClass };

type SeriesSpec = {
  symbol: string;
  providerSymbol: string;
  assetClass: NasdaqAssetClass;
  label: string;
};

const HISTORY_DAYS = 470;
const CLIENT_HISTORY_SESSIONS = 280;
const NASDAQ_REVALIDATE = 60 * 60 * 12;
const OFFICIAL_REVALIDATE = 60 * 60 * 6;

const CORE_NASDAQ: SeriesSpec[] = [
  { symbol: "^GSPC", providerSymbol: "SPY", assetClass: "etf", label: "S&P 500 (SPY proxy)" },
  { symbol: "RSP", providerSymbol: "RSP", assetClass: "etf", label: "S&P 500 Equal Weight" },
  { symbol: "^IXIC", providerSymbol: "COMP", assetClass: "index", label: "Nasdaq Composite" },
  { symbol: "SOXX", providerSymbol: "SOXX", assetClass: "etf", label: "Semiconductors" },
  { symbol: "AMD", providerSymbol: "AMD", assetClass: "stocks", label: "AMD" },
  { symbol: "AAPL", providerSymbol: "AAPL", assetClass: "stocks", label: "Apple" },
  { symbol: "MSFT", providerSymbol: "MSFT", assetClass: "stocks", label: "Microsoft" },
  { symbol: "AMZN", providerSymbol: "AMZN", assetClass: "stocks", label: "Amazon" },
  { symbol: "GOOGL", providerSymbol: "GOOGL", assetClass: "stocks", label: "Alphabet" },
  { symbol: "META", providerSymbol: "META", assetClass: "stocks", label: "Meta" },
  { symbol: "NVDA", providerSymbol: "NVDA", assetClass: "stocks", label: "Nvidia" },
  { symbol: "TSLA", providerSymbol: "TSLA", assetClass: "stocks", label: "Tesla" },
  { symbol: "GLD", providerSymbol: "GLD", assetClass: "etf", label: "Gold (GLD proxy)" },
  { symbol: "SLV", providerSymbol: "SLV", assetClass: "etf", label: "Silver (SLV proxy)" },
  { symbol: "CPER", providerSymbol: "CPER", assetClass: "etf", label: "Copper (CPER proxy)" },
  { symbol: "GDX", providerSymbol: "GDX", assetClass: "etf", label: "Gold miners (GDX proxy)" },
  { symbol: "UUP", providerSymbol: "UUP", assetClass: "etf", label: "US Dollar (UUP proxy)" },
  { symbol: "FXE", providerSymbol: "FXE", assetClass: "etf", label: "Euro (FXE proxy)" },
  { symbol: "FXB", providerSymbol: "FXB", assetClass: "etf", label: "Sterling (FXB proxy)" },
  { symbol: "FXC", providerSymbol: "FXC", assetClass: "etf", label: "Canadian dollar (FXC proxy)" },
  { symbol: "EWJ", providerSymbol: "EWJ", assetClass: "etf", label: "Japan equities (EWJ proxy)" },
];

const MAG7 = ["AAPL", "MSFT", "AMZN", "GOOGL", "META", "NVDA", "TSLA"];
const AI_BASKET = ["NVDA", "AMD", "AVGO", "MRVL", "MU", "TSM", "ASML", "ARM", "ANET", "DELL", "HPE", "SMCI", "VRT", "CEG", "GEV", "MSFT", "AMZN", "GOOGL", "META", "ORCL"];
const LARGE_CAP_PROXY = [
  "AAPL","MSFT","AMZN","GOOGL","META","NVDA","TSLA","BRK-B","JPM","V","MA","UNH","LLY","XOM","CVX","JNJ","PG","HD","COST","WMT","ABBV","KO","PEP","MRK","BAC","CRM","ORCL","CSCO","ACN","MCD","NFLX","AMD","INTC","QCOM","TXN","AVGO","IBM","GE","CAT","BA","HON","UPS","RTX","LMT","NOC","GS","MS","BLK","C","WFC","SPGI","AXP","TMO","DHR","ABT","AMGN","GILD","PFE","BMY","MDT","ISRG","LOW","NKE","SBUX","BKNG","DIS","CMCSA","T","VZ","NEE","DUK","SO","COP","SLB","EOG","LIN","APD","MMM","DE","GM","F","UNP","FDX","ADBE","NOW","PANW","CRWD","MU","AMAT","LRCX","KLAC","ASML","TSM","PLTR","UBER","ABNB","PYPL","INTU","SNOW"
];

const STOCK_SYMBOL_OVERRIDES: Record<string, string> = { "BRK-B": "BRK.B" };

const EIA_SERIES = {
  wti: {
    symbol: "CL=F",
    label: "WTI spot",
    code: "RWTC",
    sourceUrl: "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?f=D&n=PET&s=RWTC",
  },
  brent: {
    symbol: "BZ=F",
    label: "Brent spot",
    code: "RBRTE",
    sourceUrl: "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?f=D&n=PET&s=RBRTE",
  },
  gasoline: {
    symbol: "RB=F",
    label: "NYH gasoline spot",
    code: "EER_EPMRU_PF4_Y35NY_DPG",
    sourceUrl: "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?f=D&n=PET&s=EER_EPMRU_PF4_Y35NY_DPG",
  },
  distillate: {
    symbol: "HO=F",
    label: "NYH heating-oil spot",
    code: "EER_EPD2F_PF4_Y35NY_DPG",
    sourceUrl: "https://www.eia.gov/dnav/pet/hist/LeafHandler.ashx?f=D&n=PET&s=EER_EPD2F_PF4_Y35NY_DPG",
  },
};

function pctChange(points: PricePoint[], sessions: number) {
  if (points.length <= sessions) return null;
  const last = points.at(-1)?.close;
  const prior = points.at(-(sessions + 1))?.close;
  if (typeof last !== "number" || typeof prior !== "number" || prior === 0) return null;
  return ((last / prior) - 1) * 100;
}

function parseNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/[$,%]/g, "").replace(/,/g, "").trim();
  if (!cleaned || cleaned === "--" || cleaned === "N/A") return null;
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : null;
}

function isoDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function nasdaqSourceUrl(symbol: string, assetClass: NasdaqAssetClass) {
  const section = assetClass === "stocks" ? "stocks" : assetClass === "etf" ? "etf" : "index";
  return `https://www.nasdaq.com/market-activity/${section}/${symbol.toLowerCase()}/historical`;
}

function providerKey(request: NasdaqRequest) {
  return `${request.assetClass}:${request.providerSymbol}`;
}

function stockProviderSymbol(symbol: string) {
  return STOCK_SYMBOL_OVERRIDES[symbol] || symbol;
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

async function fetchNasdaqHistory(request: NasdaqRequest): Promise<PricePoint[]> {
  const end = new Date();
  const start = new Date(end.getTime() - HISTORY_DAYS * 86400000);
  const endpoint = `https://api.nasdaq.com/api/quote/${encodeURIComponent(request.providerSymbol)}/historical?assetclass=${request.assetClass}&fromdate=${isoDate(start)}&todate=${isoDate(end)}&limit=5000`;
  const response = await fetch(endpoint, {
    headers: {
      "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/126 Safari/537.36",
      accept: "application/json, text/plain, */*",
      origin: "https://www.nasdaq.com",
      referer: "https://www.nasdaq.com/market-activity/",
    },
    next: { revalidate: NASDAQ_REVALIDATE },
  });
  if (!response.ok) throw new Error(`Nasdaq ${response.status}`);
  const payload = await response.json();
  if (payload?.status?.rCode !== 200) throw new Error(`Nasdaq ${request.providerSymbol} unavailable`);
  const rows: Array<Record<string, string>> = payload?.data?.tradesTable?.rows || [];
  return rows.flatMap((row) => {
    const close = parseNumber(row.close);
    const match = row.date?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (close === null || !match) return [];
    const time = Date.UTC(Number(match[3]), Number(match[1]) - 1, Number(match[2])) / 1000;
    return [{ time, close }];
  }).sort((a, b) => a.time - b.time);
}

async function fetchNasdaqHistories(requests: NasdaqRequest[]) {
  const unique = [...new Map(requests.map((request) => [providerKey(request), request])).values()];
  const rows = await mapLimit(unique, 16, async (request) => {
    try {
      return [providerKey(request), await fetchNasdaqHistory(request)] as const;
    } catch {
      return [providerKey(request), [] as PricePoint[]] as const;
    }
  });
  return new Map<string, PricePoint[]>(rows);
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();
}

const MONTHS: Record<string, number> = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5,
  Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11,
};

async function fetchEiaDaily(code: string, sourceUrl: string): Promise<PricePoint[]> {
  const response = await fetch(sourceUrl, {
    headers: { "user-agent": "Mozilla/5.0 (Alchemy Live Desk)" },
    next: { revalidate: OFFICIAL_REVALIDATE },
  });
  if (!response.ok) throw new Error(`EIA ${response.status}`);
  const html = await response.text();
  const points: PricePoint[] = [];
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)) {
    const cells = [...row[1].matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)].map((match) => stripHtml(match[1]));
    if (cells.length < 2) continue;
    const label = cells[0];
    const match = label.match(/^(\d{4})\s+([A-Z][a-z]{2})-\s*(\d{1,2})\s+to\s+/);
    if (!match || MONTHS[match[2]] === undefined) continue;
    const start = Date.UTC(Number(match[1]), MONTHS[match[2]], Number(match[3]));
    for (let index = 0; index < Math.min(5, cells.length - 1); index += 1) {
      const close = parseNumber(cells[index + 1]);
      if (close === null) continue;
      points.push({ time: (start + index * 86400000) / 1000, close });
    }
  }
  const deduped = [...new Map(points.map((point) => [point.time, point])).values()]
    .sort((a, b) => a.time - b.time)
    .slice(-420);
  if (!deduped.length) throw new Error(`EIA ${code} parse failed`);
  return deduped;
}

function parseCsvLine(line: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    if (char === '"') {
      if (quoted && line[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === "," && !quoted) {
      values.push(value);
      value = "";
    } else {
      value += char;
    }
  }
  values.push(value);
  return values;
}

async function fetchEcbCross(currency: "USD" | "JPY") {
  const endpoint = `https://data-api.ecb.europa.eu/service/data/EXR/D.${currency}.EUR.SP00.A?startPeriod=${isoDate(new Date(Date.now() - HISTORY_DAYS * 86400000))}&format=csvdata`;
  const response = await fetch(endpoint, {
    headers: { accept: "text/csv", "user-agent": "Alchemy Live Desk" },
    next: { revalidate: OFFICIAL_REVALIDATE },
  });
  if (!response.ok) throw new Error(`ECB ${response.status}`);
  const lines = (await response.text()).split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const dateIndex = header.indexOf("TIME_PERIOD");
  const valueIndex = header.indexOf("OBS_VALUE");
  const map = new Map<number, number>();
  for (const line of lines.slice(1)) {
    const fields = parseCsvLine(line);
    const close = parseNumber(fields[valueIndex]);
    const time = Date.parse(`${fields[dateIndex]}T00:00:00Z`) / 1000;
    if (close !== null && Number.isFinite(time)) map.set(time, close);
  }
  return map;
}

async function fetchUsdJpy(): Promise<PricePoint[]> {
  const [usd, jpy] = await Promise.all([fetchEcbCross("USD"), fetchEcbCross("JPY")]);
  return [...jpy.entries()]
    .filter(([time]) => usd.has(time))
    .map(([time, jpyPerEur]) => ({ time, close: jpyPerEur / usd.get(time)! }))
    .sort((a, b) => a.time - b.time);
}

function extractXmlValue(block: string, tag: string) {
  const match = block.match(new RegExp(`<d:${tag}[^>]*>([^<]+)<\\/d:${tag}>`, "i"));
  return match?.[1] || null;
}

async function fetchTreasurySeries() {
  const currentYear = new Date().getUTCFullYear();
  const years = [currentYear - 1, currentYear];
  const responses = await Promise.allSettled(years.map(async (year) => {
    const url = `https://home.treasury.gov/resource-center/data-chart-center/interest-rates/pages/xml?data=daily_treasury_yield_curve&field_tdr_date_value=${year}`;
    const response = await fetch(url, {
      headers: { "user-agent": "Mozilla/5.0 (Alchemy Live Desk)", accept: "application/xml,text/xml,*/*" },
      next: { revalidate: 60 * 60 },
    });
    if (!response.ok) throw new Error(`Treasury ${response.status}`);
    return response.text();
  }));
  const series = new Map<string, PricePoint[]>([["^FVX", []], ["^TNX", []], ["^TYX", []]]);
  const tagMap: Record<string, string> = { "^FVX": "BC_5YEAR", "^TNX": "BC_10YEAR", "^TYX": "BC_30YEAR" };
  for (const result of responses) {
    if (result.status !== "fulfilled") continue;
    for (const match of result.value.matchAll(/<m:properties>([\s\S]*?)<\/m:properties>/gi)) {
      const dateText = extractXmlValue(match[1], "NEW_DATE");
      const time = dateText ? Date.parse(dateText) / 1000 : NaN;
      if (!Number.isFinite(time)) continue;
      for (const [symbol, tag] of Object.entries(tagMap)) {
        const close = parseNumber(extractXmlValue(match[1], tag));
        if (close !== null) series.get(symbol)!.push({ time, close });
      }
    }
  }
  for (const [symbol, points] of series) {
    series.set(symbol, [...new Map(points.map((point) => [point.time, point])).values()].sort((a, b) => a.time - b.time));
  }
  return series;
}

function sessionDate(time: number | null) {
  return time === null ? null : new Date(time * 1000).toISOString().slice(0, 10);
}

function commonSessionTimes(histories: Map<string, PricePoint[]>, symbols: string[]) {
  if (!symbols.length) return [];
  const timeSets = symbols.map((symbol) => new Set((histories.get(symbol) || []).map((point) => point.time)));
  return [...timeSets[0]].filter((time) => timeSets.every((set) => set.has(time))).sort((a, b) => a - b);
}

function frameAt(histories: Map<string, PricePoint[]>, symbols: string[], asOfTime: number | null): BreadthFrame {
  let valid = 0;
  let above20 = 0;
  let above50 = 0;
  let above200 = 0;
  let newHighs20 = 0;
  let newLows20 = 0;
  for (const symbol of symbols) {
    const points = histories.get(symbol) || [];
    const closes = points.filter((point) => asOfTime !== null && point.time <= asOfTime).map((point) => point.close);
    if (closes.length < 200) continue;
    const current = closes.at(-1);
    if (typeof current !== "number") continue;
    valid += 1;
    const mean = (length: number) => closes.slice(-length).reduce((sum, value) => sum + value, 0) / length;
    if (current > mean(20)) above20 += 1;
    if (current > mean(50)) above50 += 1;
    if (current > mean(200)) above200 += 1;
    const previous19 = closes.slice(-20, -1);
    if (previous19.length === 19 && current >= Math.max(...previous19)) newHighs20 += 1;
    if (previous19.length === 19 && current <= Math.min(...previous19)) newLows20 += 1;
  }
  const percent = (value: number) => valid ? Math.round(value / valid * 100) : 0;
  return {
    asOf: sessionDate(asOfTime),
    sampleSize: valid,
    above20: percent(above20),
    above50: percent(above50),
    above200: percent(above200),
    newHighs20,
    newLows20,
  };
}

function breadthSnapshot(histories: Map<string, PricePoint[]>, id: string, label: string, symbols: string[]): BreadthSnapshot {
  const eligible = symbols.filter((symbol) => (histories.get(symbol)?.length || 0) >= 221);
  const sessions = commonSessionTimes(histories, eligible);
  const currentTime = sessions.at(-1) ?? null;
  const weekAgoTime = sessions.at(-6) ?? null;
  const monthAgoTime = sessions.at(-22) ?? null;
  const current = frameAt(histories, eligible, currentTime);
  return {
    id,
    label,
    sourceName: "Nasdaq official daily histories",
    sampleSize: current.sampleSize,
    targetSize: symbols.length,
    current,
    weekAgo: frameAt(histories, eligible, weekAgoTime),
    monthAgo: frameAt(histories, eligible, monthAgoTime),
  };
}

function alignFormula(histories: Map<string, PricePoint[]>, formula: (values: Record<string, number>) => number, symbols: string[]) {
  const maps = symbols.map((symbol) => new Map((histories.get(symbol) || []).map((point) => [point.time, point.close])));
  const common = [...(maps[0]?.keys() || [])].filter((time) => maps.every((map) => map.has(time))).sort((a, b) => a - b);
  return common.map((time) => ({
    time,
    close: formula(Object.fromEntries(symbols.map((symbol, index) => [symbol, maps[index].get(time)!]))),
  }));
}

function buildSeries(symbol: string, label: string, sourceName: string, sourceUrl: string, points: PricePoint[]): MarketSeries {
  const visiblePoints = points.slice(-CLIENT_HISTORY_SESSIONS);
  return {
    symbol,
    label,
    sourceName,
    sourceUrl,
    points: visiblePoints,
    last: visiblePoints.at(-1)?.close ?? null,
    change5d: pctChange(points, 5),
    change21d: pctChange(points, 21),
  };
}

function buildCrack(id: string, label: string, formulaText: string, points: PricePoint[]): CrackSeries {
  const visiblePoints = points.slice(-CLIENT_HISTORY_SESSIONS);
  return {
    id,
    label,
    sourceName: "EIA daily spot prices",
    formula: formulaText,
    sourceUrl: "https://www.eia.gov/dnav/pet/pet_pri_spt_s1_d.htm",
    points: visiblePoints,
    last: visiblePoints.at(-1)?.close ?? null,
    change5d: pctChange(points, 5),
    change21d: pctChange(points, 21),
  };
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function calculatePulse(series: MarketSeries[], breadth: BreadthSnapshot, sessions: 5 | 21) {
  const moves = ["^GSPC", "RSP", "SOXX"].map((symbol) => {
    const item = series.find((entry) => entry.symbol === symbol);
    return sessions === 5 ? item?.change5d : item?.change21d;
  }).filter((value): value is number => typeof value === "number");
  const averageMove = moves.length ? moves.reduce((sum, value) => sum + value, 0) / moves.length : 0;
  const prior = sessions === 5 ? breadth.weekAgo : breadth.monthAgo;
  const breadthDelta = breadth.current.above50 - prior.above50;
  const highLow = breadth.current.newHighs20 - breadth.current.newLows20;
  return clamp(50 + averageMove * 3 + (breadth.current.above50 - 50) * 0.35 + breadthDelta * 0.7 + highLow * 0.15);
}

async function loadMarketData(): Promise<MarketData> {
  const stockUniverse = [...new Set([...MAG7, ...AI_BASKET, ...LARGE_CAP_PROXY])];
  const nasdaqRequests: NasdaqRequest[] = [
    ...CORE_NASDAQ.map(({ providerSymbol, assetClass }) => ({ providerSymbol, assetClass })),
    ...stockUniverse.map((symbol) => ({ providerSymbol: stockProviderSymbol(symbol), assetClass: "stocks" as const })),
  ];

  const [nasdaqResult, treasuryResult, usdJpyResult, eiaResult] = await Promise.allSettled([
    fetchNasdaqHistories(nasdaqRequests),
    fetchTreasurySeries(),
    fetchUsdJpy(),
    Promise.all(Object.values(EIA_SERIES).map(async (item) => [item.symbol, await fetchEiaDaily(item.code, item.sourceUrl)] as const)),
  ]);

  const nasdaq = nasdaqResult.status === "fulfilled" ? nasdaqResult.value : new Map<string, PricePoint[]>();
  const treasury = treasuryResult.status === "fulfilled" ? treasuryResult.value : new Map<string, PricePoint[]>();
  const usdJpy = usdJpyResult.status === "fulfilled" ? usdJpyResult.value : [];
  const eia = eiaResult.status === "fulfilled" ? new Map<string, PricePoint[]>(eiaResult.value) : new Map<string, PricePoint[]>();

  const series: MarketSeries[] = CORE_NASDAQ.map((spec) => buildSeries(
    spec.symbol,
    spec.label,
    `Nasdaq official ${spec.assetClass} history`,
    nasdaqSourceUrl(spec.providerSymbol, spec.assetClass),
    nasdaq.get(providerKey(spec)) || [],
  ));

  series.push(buildSeries(
    "JPY=X",
    "USDJPY (ECB cross)",
    "European Central Bank",
    "https://data.ecb.europa.eu/data/datasets/EXR/EXR.D.JPY.EUR.SP00.A",
    usdJpy,
  ));

  for (const item of Object.values(EIA_SERIES)) {
    series.push(buildSeries(item.symbol, item.label, "U.S. Energy Information Administration", item.sourceUrl, eia.get(item.symbol) || []));
  }

  const treasuryPage = "https://home.treasury.gov/resource-center/data-chart-center/interest-rates/TextView?type=daily_treasury_yield_curve";
  series.push(buildSeries("^FVX", "US 5-year yield", "U.S. Treasury", treasuryPage, treasury.get("^FVX") || []));
  series.push(buildSeries("^TNX", "US 10-year yield", "U.S. Treasury", treasuryPage, treasury.get("^TNX") || []));
  series.push(buildSeries("^TYX", "US 30-year yield", "U.S. Treasury", treasuryPage, treasury.get("^TYX") || []));

  const stockHistories = new Map<string, PricePoint[]>(stockUniverse.map((symbol) => [
    symbol,
    nasdaq.get(providerKey({ providerSymbol: stockProviderSymbol(symbol), assetClass: "stocks" })) || [],
  ]));

  const breadth = [
    breadthSnapshot(stockHistories, "large-cap", "US large-cap proxy", LARGE_CAP_PROXY),
    breadthSnapshot(stockHistories, "ai-basket", "AI infrastructure basket", AI_BASKET),
    breadthSnapshot(stockHistories, "mag7", "Magnificent Seven", MAG7),
  ];

  const energyHistories = new Map<string, PricePoint[]>([
    ["CL=F", eia.get("CL=F") || []],
    ["RB=F", eia.get("RB=F") || []],
    ["HO=F", eia.get("HO=F") || []],
  ]);
  const gasoline = alignFormula(energyHistories, (v) => v["RB=F"] * 42 - v["CL=F"], ["RB=F", "CL=F"]);
  const distillate = alignFormula(energyHistories, (v) => v["HO=F"] * 42 - v["CL=F"], ["HO=F", "CL=F"]);
  const threeTwoOne = alignFormula(energyHistories, (v) => ((2 * v["RB=F"] * 42) + (v["HO=F"] * 42) - (3 * v["CL=F"])) / 3, ["RB=F", "HO=F", "CL=F"]);
  const cracks = [
    buildCrack("gasoline", "Gasoline crack proxy", "NYH gasoline spot × 42 − WTI spot", gasoline),
    buildCrack("distillate", "Distillate crack proxy", "NYH heating-oil spot × 42 − WTI spot", distillate),
    buildCrack("321", "3:2:1 refining crack proxy", "((2 × gasoline × 42) + (heating oil × 42) − (3 × WTI)) ÷ 3", threeTwoOne),
  ];

  const limitations: string[] = [];
  if (breadth[0].sampleSize < breadth[0].targetSize) limitations.push(`Breadth coverage is ${breadth[0].sampleSize}/${breadth[0].targetSize} names.`);
  if (!usdJpy.length) limitations.push("ECB USDJPY cross is temporarily unavailable.");
  if (treasury.get("^TNX")?.length === 0) limitations.push("Treasury yield history is temporarily unavailable.");
  if (!gasoline.length || !distillate.length) limitations.push("EIA crack proxies are temporarily unavailable.");

  return {
    updatedAt: new Date().toISOString(),
    series,
    breadth,
    cracks,
    pulseWeek: calculatePulse(series, breadth[0], 5),
    pulseMonth: calculatePulse(series, breadth[0], 21),
    limitation: limitations.length ? limitations.join(" ") : null,
  };
}

export const getMarketData = unstable_cache(loadMarketData, ["alchemy-market-data-v2"], { revalidate: 300 });
