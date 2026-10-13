/** Optional FMP REST reader. Never promotes vendor records to canonical evidence. */
export const FMP_STABLE_ORIGIN = "https://financialmodelingprep.com";
export type FmpEndpoint =
  | "cash-flow-statement"
  | "income-statement"
  | "balance-sheet-statement"
  | "analyst-estimates"
  | "earnings-calendar";
export type FmpReadState = "ready" | "unconfigured" | "unavailable" | "restricted";
export type FmpReadResult = {
  state: FmpReadState;
  endpoint: FmpEndpoint;
  sourceUrl: string;
  symbol: string | null;
  records: Record<string, unknown>[];
  retrievedAt: string | null;
  note: string | null;
};
type FmpOptions = {
  endpoint: FmpEndpoint;
  symbol?: string;
  period?: "quarter" | "annual";
  from?: string;
  to?: string;
  limit?: number;
  apiKey?: string;
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
};
function dateOk(x: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(x)
    && Number.isFinite(Date.parse(x + "T00:00:00Z"))
    && new Date(x + "T00:00:00Z").toISOString().startsWith(x);
}
function readFmpKey(options: FmpOptions) {
  const env = options.env ?? process.env;
  return (options.apiKey ?? env.FMP_API ?? env.FMP_API_KEY ?? "").trim();
}

/**
 * The Basic plan may reject statement / estimates endpoints. Such failures are
 * explicit; caller must not silently substitute other fiscal definitions.
 */
export async function readFmpRecords(options: FmpOptions): Promise<FmpReadResult> {
  const sourceUrl = "https://site.financialmodelingprep.com/developer/docs/stable/" + options.endpoint;
  const base: FmpReadResult = {
    state: "unavailable", endpoint: options.endpoint, sourceUrl,
    symbol: options.symbol ?? null, records: [], retrievedAt: null, note: null,
  };
  if (!["cash-flow-statement", "income-statement", "balance-sheet-statement",
    "analyst-estimates", "earnings-calendar"].includes(options.endpoint)) {
    return { ...base, note: "FMP_ENDPOINT_NOT_ALLOWED" };
  }
  if (options.endpoint === "earnings-calendar") {
    if (!options.from || !options.to || !dateOk(options.from) || !dateOk(options.to)) {
      return { ...base, note: "FMP_INVALID_DATE_RANGE" };
    }
    const span = (Date.parse(options.to) - Date.parse(options.from)) / 86400000;
    if (span < 0 || span > 90) return { ...base, note: "FMP_DATE_RANGE_OUT_OF_BOUNDS" };
  } else if (!options.symbol || !/^[A-Z0-9][A-Z0-9.^-]{0,19}$/.test(options.symbol)) {
    return { ...base, note: "FMP_INVALID_SYMBOL" };
  }
  const key = readFmpKey(options);
  if (!key) return { ...base, state: "unconfigured", note: "FMP_API_NOT_CONFIGURED" };
  const url = new URL("/stable/" + options.endpoint, FMP_STABLE_ORIGIN);
  url.searchParams.set("apikey", key);
  if (options.symbol && options.endpoint !== "earnings-calendar") {
    url.searchParams.set("symbol", options.symbol);
  }
  if (options.endpoint === "earnings-calendar") {
    url.searchParams.set("from", options.from!);
    url.searchParams.set("to", options.to!);
  } else {
    url.searchParams.set("limit", String(Math.min(10, Math.max(1, Math.trunc(options.limit ?? 2)))));
    if (options.period) url.searchParams.set("period", options.period);
  }
  try {
    const response = await (options.fetchImpl ?? fetch)(url.toString(), {
      headers: { accept: "application/json" },
      cache: "no-store",
      signal: AbortSignal.timeout(12000),
    });
    // Do not return request URL, body on error, or raw provider error text.
    if (response.status === 401 || response.status === 402 || response.status === 403) {
      return { ...base, state: "restricted", note: "FMP_ACCESS_DENIED_" + response.status };
    }
    if (!response.ok) return { ...base, note: "FMP_HTTP_" + response.status };
    const payload: unknown = await response.json();
    if (!Array.isArray(payload)) return { ...base, note: "FMP_RESPONSE_INVALID_OR_RESTRICTED" };
    // FMP can report an entitlement error inside HTTP 200; never accept it as a datum.
    if (payload.some(row => row && typeof row === "object" &&
      ("Error Message" in row || "error" in row || "Error" in row))) {
      return { ...base, state: "restricted", note: "FMP_PAYLOAD_ACCESS_ERROR" };
    }
    const records = payload.filter((row): row is Record<string, unknown> =>
      Boolean(row && typeof row === "object" && !Array.isArray(row)));
    if (!records.length) return { ...base, note: "FMP_NO_USABLE_RECORDS" };
    if (options.endpoint !== "earnings-calendar" &&
      records.some(row => row.symbol !== options.symbol)) {
      return { ...base, note: "FMP_SYMBOL_MISMATCH_OR_MISSING" };
    }
    return { ...base, state: "ready", retrievedAt: new Date().toISOString(), records, note: null };
  } catch {
    return { ...base, note: "FMP_REQUEST_FAILED" };
  }
}
