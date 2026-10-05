export const BARCHART_HISTORY_URL = "https://ondemand.websol.barchart.com/getHistory.json";
export const BARCHART_MOVE_SYMBOL = "$MOVE";

export type BarchartMoveProviderState = "ready" | "unconfigured" | "unavailable";

export type BarchartMovePoint = {
  time: number;
  close: number;
};

export type BarchartMoveSnapshot = {
  state: BarchartMoveProviderState;
  retrievedAt: string;
  sourceName: "Barchart OnDemand · ICE BofA MOVE Index";
  sourceUrl: string;
  symbol: typeof BARCHART_MOVE_SYMBOL;
  points: BarchartMovePoint[];
  warnings: string[];
};

type FetchLike = typeof fetch;

function compactDate(date: Date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function numberValue(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function pointTime(row: Record<string, unknown>) {
  const candidate =
    typeof row.timestamp === "string" ? row.timestamp
      : typeof row.tradingDay === "string" ? `${row.tradingDay}T00:00:00Z`
        : null;
  if (!candidate) return null;
  const parsed = Date.parse(candidate);
  return Number.isFinite(parsed) ? Math.floor(parsed / 1000) : null;
}

export function parseBarchartMovePayload(
  payload: unknown,
  retrievedAt = new Date().toISOString(),
): BarchartMoveSnapshot {
  const record = payload && typeof payload === "object" && !Array.isArray(payload)
    ? payload as Record<string, unknown>
    : {};
  const status = record.status && typeof record.status === "object" && !Array.isArray(record.status)
    ? record.status as Record<string, unknown>
    : {};
  const rows = Array.isArray(record.results) ? record.results : [];

  const points = rows.flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const row = value as Record<string, unknown>;
    const time = pointTime(row);
    const close = numberValue(row.close);
    return time === null || close === null ? [] : [{ time, close }];
  })
    .sort((a, b) => a.time - b.time);

  const deduped = [...new Map(points.map((point) => [point.time, point])).values()];
  const code = numberValue(status.code);
  const ready = code === 200 && deduped.length >= 2;

  return {
    state: ready ? "ready" : "unavailable",
    retrievedAt,
    sourceName: "Barchart OnDemand · ICE BofA MOVE Index",
    sourceUrl: "https://www.barchart.com/stocks/quotes/$MOVE/historical-download",
    symbol: BARCHART_MOVE_SYMBOL,
    points: ready ? deduped : [],
    warnings: ready
      ? []
      : [`Barchart MOVE history unavailable${code === null ? "" : ` (status ${code})`}.`],
  };
}

export function barchartMoveQueryUrl(now = new Date(), apiKey = "REDACTED") {
  const end = new Date(now);
  const start = new Date(now.getTime() - 120 * 86_400_000);
  const url = new URL(BARCHART_HISTORY_URL);
  url.searchParams.set("apikey", apiKey);
  url.searchParams.set("symbol", BARCHART_MOVE_SYMBOL);
  url.searchParams.set("type", "daily");
  url.searchParams.set("startDate", compactDate(start));
  url.searchParams.set("endDate", compactDate(end));
  url.searchParams.set("maxRecords", "180");
  url.searchParams.set("order", "asc");
  return url.toString();
}

export async function fetchBarchartMoveSnapshot(options: {
  now?: Date;
  apiKey?: string | null;
  fetchImpl?: FetchLike;
} = {}): Promise<BarchartMoveSnapshot> {
  const now = options.now ?? new Date();
  const retrievedAt = now.toISOString();
  const apiKey = options.apiKey === undefined
    ? process.env.BARCHART_API_KEY ?? null
    : options.apiKey;

  if (!apiKey?.trim()) {
    return {
      state: "unconfigured",
      retrievedAt,
      sourceName: "Barchart OnDemand · ICE BofA MOVE Index",
      sourceUrl: "https://www.barchart.com/stocks/quotes/$MOVE/historical-download",
      symbol: BARCHART_MOVE_SYMBOL,
      points: [],
      warnings: ["BARCHART_API_KEY is not configured; direct MOVE history is disabled."],
    };
  }

  const fetchImpl = options.fetchImpl ?? fetch;
  const url = barchartMoveQueryUrl(now, apiKey.trim());

  try {
    const response = await fetchImpl(url, {
      headers: {
        accept: "application/json",
        "user-agent": "Alchemy Live Desk MOVE adapter",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8_000),
    });
    if (!response.ok) {
      return {
        state: "unavailable",
        retrievedAt,
        sourceName: "Barchart OnDemand · ICE BofA MOVE Index",
        sourceUrl: "https://www.barchart.com/stocks/quotes/$MOVE/historical-download",
        symbol: BARCHART_MOVE_SYMBOL,
        points: [],
        warnings: [`Barchart MOVE request failed with HTTP ${response.status}.`],
      };
    }
    return parseBarchartMovePayload(await response.json(), retrievedAt);
  } catch (error) {
    return {
      state: "unavailable",
      retrievedAt,
      sourceName: "Barchart OnDemand · ICE BofA MOVE Index",
      sourceUrl: "https://www.barchart.com/stocks/quotes/$MOVE/historical-download",
      symbol: BARCHART_MOVE_SYMBOL,
      points: [],
      warnings: [`Barchart MOVE acquisition failed: ${error instanceof Error ? error.message : String(error)}`],
    };
  }
}
