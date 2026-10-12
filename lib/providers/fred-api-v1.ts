/** Optional FRED/ALFRED API v1 reader. No schedules, writes, or Story authority. */
export const FRED_API_ORIGIN = "https://api.stlouisfed.org";
export type FredReadState = "ready" | "unconfigured" | "unavailable";
export type FredObservation = {
  date: string;
  value: number;
  realtimeStart: string;
  realtimeEnd: string;
};
export type FredReadResult = {
  state: FredReadState;
  seriesId: string;
  sourceUrl: string;
  retrievedAt: string | null;
  vintageDate: string | null;
  observations: FredObservation[];
  note: string | null;
};
type FredOptions = {
  apiKey?: string;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  vintageDate?: string;
  limit?: number;
};
function validDay(day: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(day)
    && Number.isFinite(Date.parse(day + "T00:00:00Z"))
    && new Date(day + "T00:00:00Z").toISOString().startsWith(day);
}
function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
function readFredKey(options: FredOptions) {
  const env = options.env ?? process.env;
  return (options.apiKey ?? env.FRED_API ?? env.FRED_API_KEY ?? "").trim();
}

/**
 * Explicit vintageDate requests an ALFRED historical snapshot, not today's
 * revised series. Values retain each observation's own realtime boundaries.
 */
export async function readFredSeries(
  seriesId: string,
  options: FredOptions = {},
): Promise<FredReadResult> {
  const sourceUrl = "https://fred.stlouisfed.org/series/" + encodeURIComponent(seriesId);
  const base: FredReadResult = {
    state: "unavailable", seriesId, sourceUrl,
    retrievedAt: null, vintageDate: options.vintageDate ?? null,
    observations: [], note: null,
  };
  if (!/^[A-Z][A-Z0-9_]{1,31}$/.test(seriesId)) {
    return { ...base, note: "INVALID_SERIES_ID" };
  }
  if (options.vintageDate && !validDay(options.vintageDate)) {
    return { ...base, note: "INVALID_VINTAGE_DATE" };
  }
  const key = readFredKey(options);
  if (!key) return { ...base, state: "unconfigured", note: "FRED_API_NOT_CONFIGURED" };

  const url = new URL("/fred/series/observations", FRED_API_ORIGIN);
  url.searchParams.set("series_id", seriesId);
  url.searchParams.set("api_key", key);
  url.searchParams.set("file_type", "json");
  url.searchParams.set("sort_order", "desc");
  url.searchParams.set("limit", String(Math.min(100, Math.max(1, Math.trunc(options.limit ?? 12)))));
  if (options.vintageDate) {
    url.searchParams.set("vintage_dates", options.vintageDate);
    url.searchParams.set("observation_end", options.vintageDate);
  }
  try {
    const response = await (options.fetchImpl ?? fetch)(url.toString(), {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    // Never return the request URL: it contains the API key.
    if (!response.ok) return { ...base, note: "FRED_HTTP_" + response.status };
    const data = asRecord(await response.json());
    const rows = data?.observations;
    if (!Array.isArray(rows)) return { ...base, note: "FRED_RESPONSE_INVALID" };
    const observations: FredObservation[] = [];
    for (const input of rows) {
      const row = asRecord(input);
      if (!row || typeof row.date !== "string" || !validDay(row.date)) continue;
      if (options.vintageDate && row.date > options.vintageDate) continue;
      const value = typeof row.value === "string" && row.value.trim() !== "."
        ? Number(row.value) : null;
      if (value === null || !Number.isFinite(value)) continue;
      const rtStart = row.realtime_start;
      const rtEnd = row.realtime_end;
      if (typeof rtStart !== "string" || typeof rtEnd !== "string"
        || !validDay(rtStart) || !validDay(rtEnd)) continue;
      observations.push({ date: row.date, value, realtimeStart: rtStart, realtimeEnd: rtEnd });
    }
    if (!observations.length) return { ...base, note: "FRED_NO_VALID_OBSERVATIONS" };
    return { ...base, state: "ready", retrievedAt: new Date().toISOString(), observations, note: null };
  } catch {
    return { ...base, note: "FRED_REQUEST_FAILED" };
  }
}
