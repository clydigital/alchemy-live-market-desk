import { normaliseMarketEvent, type MarketEventV1 } from "./market-events.ts";

export const FINNHUB_EARNINGS_ENDPOINT = "https://finnhub.io/api/v1/calendar/earnings";
export const FINNHUB_FORWARD_WINDOW_DAYS = 45;

/** Intentionally curated to the desk's existing equity/AI-capex, bank and energy coverage. */
export const FINNHUB_PRIORITY_SYMBOLS = [
  "JPM", "C", "WFC", "BAC", "GS", "MS", "BLK", "TSM", "NVDA", "AMD", "MU", "AVGO",
  "AMZN", "GOOGL", "MSFT", "META", "ORCL", "CRWV", "AAPL", "NFLX", "TSLA",
  "UNH", "JNJ", "XOM", "CVX", "DAL",
] as const;

const PRIORITY = new Set<string>(FINNHUB_PRIORITY_SYMBOLS);
const SYMBOL_NAMES: Record<string, string> = {
  JPM: "JPMorganChase", C: "Citigroup", WFC: "Wells Fargo", BAC: "Bank of America",
  GS: "Goldman Sachs", MS: "Morgan Stanley", BLK: "BlackRock", TSM: "TSMC",
  NVDA: "NVIDIA", AMD: "AMD", MU: "Micron", AVGO: "Broadcom", AMZN: "Amazon",
  GOOGL: "Alphabet", MSFT: "Microsoft", META: "Meta", ORCL: "Oracle",
  CRWV: "CoreWeave", AAPL: "Apple", NFLX: "Netflix", TSLA: "Tesla",
  UNH: "UnitedHealth", JNJ: "Johnson & Johnson", XOM: "Exxon Mobil",
  CVX: "Chevron", DAL: "Delta Air Lines",
};

export type FinnhubEarningsRow = {
  symbol?: unknown;
  date?: unknown;
  hour?: unknown;
  year?: unknown;
  quarter?: unknown;
  epsEstimate?: unknown;
  epsActual?: unknown;
  revenueEstimate?: unknown;
  revenueActual?: unknown;
};

function validDay(day: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return false;
  const timestamp = Date.parse(day + "T00:00:00Z");
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === day;
}

function asNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function sessionLabel(value: unknown) {
  switch (typeof value === "string" ? value.toLowerCase() : "") {
    case "bmo": return "Before US market open · exact time unconfirmed";
    case "amc": return "After US market close · exact time unconfirmed";
    case "dmh": return "During US market hours · exact time unconfirmed";
    default: return "Reporting time unconfirmed";
  }
}

function estimates(row: FinnhubEarningsRow) {
  const eps = asNumber(row.epsEstimate);
  const revenue = asNumber(row.revenueEstimate);
  return [
    eps === null ? null : "EPS estimate " + eps.toFixed(2),
    revenue === null || revenue < 0 ? null : "Revenue estimate $" +
      new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 2 }).format(revenue),
  ].filter(Boolean).join("; ") || null;
}

export function parseFinnhubEarningsCalendar(payload: unknown, now = new Date()): MarketEventV1[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const rows = (payload as { earningsCalendar?: unknown }).earningsCalendar;
  if (!Array.isArray(rows)) return [];
  const from = now.toISOString().slice(0, 10);
  const to = new Date(now.getTime() + FINNHUB_FORWARD_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  const selected = new Map<string, MarketEventV1>();

  for (const item of rows) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const row = item as FinnhubEarningsRow;
    const symbol = typeof row.symbol === "string" ? row.symbol.trim().toUpperCase() : "";
    const day = typeof row.date === "string" ? row.date.trim() : "";
    if (!PRIORITY.has(symbol) || !validDay(day) || day < from || day > to) continue;
    // An already reported result is not a future earnings announcement.
    if (asNumber(row.epsActual) !== null || asNumber(row.revenueActual) !== null) continue;
    const quarter = asNumber(row.quarter), year = asNumber(row.year);
    const fiscal = quarter !== null && Number.isInteger(quarter) && quarter >= 1 && quarter <= 4 &&
      year !== null && Number.isInteger(year) && year >= 2025 && year <= 2040
      ? "Finnhub fiscal reference Q" + quarter + " " + year + " (verify with issuer)" : null;
    const event = normaliseMarketEvent({
      id: "finnhub:" + symbol + ":" + day,
      occurrenceKey: "finnhub:" + symbol + ":" + (fiscal || day),
      eventType: "earnings", title: SYMBOL_NAMES[symbol] + " earnings",
      startAt: day, timePrecision: "date", timeLabel: sessionLabel(row.hour),
      status: "reported", verificationState: "reported",
      affectedAssets: [symbol], expectedStage: fiscal || "Fiscal period unverified",
      expectation: estimates(row),
      decisiveVariable: symbol === "TSM" || ["NVDA", "AMD", "MU", "AVGO", "META", "MSFT", "AMZN", "GOOGL", "ORCL", "CRWV"].includes(symbol)
        ? "Check revenue, guidance, AI capex and free-cash-flow conversion against estimates."
        : "Check sales, profits, management guidance and credit or financing sensitivity against estimates.",
      transmission: "Finnhub provides a calendar estimate only. Confirm the date with the issuer before using it as an exact catalyst.",
      sourceName: "Finnhub earnings calendar · unconfirmed",
      sourceUrl: "https://finnhub.io/docs/api/earnings-calendar",
      sourceRecordRefs: ["finnhub:" + symbol + ":" + day],
    });
    if (event) selected.set(symbol + ":" + day, event);
  }
  return [...selected.values()].sort((a, b) => (a.startAt || "").localeCompare(b.startAt || ""));
}

/** Server-side only. No token in the URL, client props or log messages. */
export async function fetchFinnhubEarnings({
  apiKey,
  now = new Date(),
  fetchImpl = fetch,
}: {
  apiKey: string;
  now?: Date;
  fetchImpl?: typeof fetch;
}): Promise<MarketEventV1[]> {
  if (!apiKey.trim()) throw new Error("Finnhub API key not configured");
  const from = now.toISOString().slice(0, 10);
  const to = new Date(now.getTime() + FINNHUB_FORWARD_WINDOW_DAYS * 86_400_000).toISOString().slice(0, 10);
  const params = new URLSearchParams({ from, to, international: "true" });
  const response = await fetchImpl(FINNHUB_EARNINGS_ENDPOINT + "?" + params.toString(), {
    headers: { "X-Finnhub-Token": apiKey, Accept: "application/json" },
    next: { revalidate: 60 * 60 * 6 },
    signal: AbortSignal.timeout(8_000),
  });
  if (!response.ok) throw new Error("Finnhub HTTP " + response.status);
  const payload = await response.json() as unknown;
  if (!payload || typeof payload !== "object" || !Array.isArray((payload as { earningsCalendar?: unknown }).earningsCalendar)) {
    throw new Error("Finnhub response lacks earningsCalendar array");
  }
  return parseFinnhubEarningsCalendar(payload, now);
}
