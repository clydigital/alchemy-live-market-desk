export const BEA_DATA_URL = "https://apps.bea.gov/api/data";

export const BEA_SERIES = {
  gdp: { tableName: "T10105", lineNumber: "1", label: "Gross domestic product (current-dollar level)" },
  pcePriceIndex: { tableName: "T20304", lineNumber: "1", label: "Personal consumption expenditures price index" },
} as const;

export type BeaMetric = keyof typeof BEA_SERIES;

export type BeaObservation = {
  metric: BeaMetric;
  tableName: string;
  lineNumber: string;
  seriesId: string;
  label: string;
  period: string;
  value: number;
  unit: string | null;
  frequency: "Q";
};

export type BeaSnapshot = {
  state: "ready" | "partial" | "unconfigured" | "unavailable";
  observations: BeaObservation[];
  retrievedAt: string | null;
  sourceName: "U.S. Bureau of Economic Analysis";
  sourceUrl: string;
  note: string | null;
};

type BeaRow = {
  TableName?: unknown;
  LineNumber?: unknown;
  LineDescription?: unknown;
  TimePeriod?: unknown;
  DataValue?: unknown;
  Unit?: unknown;
  CL_UNIT?: unknown;
  METRIC_NAME?: unknown;
  UNIT_MULT?: unknown;
};

export function buildBeaDataUrl(apiKey: string, years: string, tableName: string = BEA_SERIES.gdp.tableName) {
  const url = new URL(BEA_DATA_URL);
  url.searchParams.set("UserID", apiKey);
  url.searchParams.set("method", "GetData");
  url.searchParams.set("datasetname", "NIPA");
  // BEA NIPA GetData accepts exactly ONE TableName per request.
  const allowedTables: readonly string[] = [BEA_SERIES.gdp.tableName, BEA_SERIES.pcePriceIndex.tableName];
  if (!allowedTables.includes(tableName)) {
    throw new Error("BEA_TABLE_NOT_ALLOWED");
  }
  url.searchParams.set("TableName", tableName);
  url.searchParams.set("Frequency", "Q");
  url.searchParams.set("Year", years);
  url.searchParams.set("ResultFormat", "JSON");
  return url.toString();
}

export function buildBeaDataUrls(apiKey: string, years: string) {
  return Object.values(BEA_SERIES).map(series => buildBeaDataUrl(apiKey, years, series.tableName));
}

function unavailable(note: string, retrievedAt: string | null = null): BeaSnapshot {
  return {
    state: "unavailable", observations: [], retrievedAt,
    sourceName: "U.S. Bureau of Economic Analysis", sourceUrl: BEA_DATA_URL, note,
  };
}

export function parseBeaPayload(payload: unknown, options?: { retrievedAt?: string | null }): BeaSnapshot {
  const retrievedAt = options?.retrievedAt ?? new Date().toISOString();
  const root = payload && typeof payload === "object" ? payload as { BEAAPI?: unknown } : {};
  const api = root.BEAAPI && typeof root.BEAAPI === "object" ? root.BEAAPI as { Results?: unknown } : {};
  const results = api.Results && typeof api.Results === "object" ? api.Results as { Data?: unknown; Error?: unknown } : {};
  if (results.Error) return unavailable("BEA returned an API error.", retrievedAt);
  if (!Array.isArray(results.Data)) return unavailable("BEA returned a response without a valid data array.", retrievedAt);

  const tableMap = new Map<string, { metric: BeaMetric; lineNumber: string; label: string }>(
    Object.entries(BEA_SERIES).map(([metric, item]) => [item.tableName, {
      metric: metric as BeaMetric, lineNumber: item.lineNumber, label: item.label,
    }]),
  );
  const observations = (results.Data as BeaRow[]).flatMap((row): BeaObservation[] => {
    const table = typeof row.TableName === "string" ? tableMap.get(row.TableName) : undefined;
    const lineNumber = typeof row.LineNumber === "string" ? row.LineNumber : "";
    const period = typeof row.TimePeriod === "string" ? row.TimePeriod : "";
    const rawValue = typeof row.DataValue === "string" ? Number(row.DataValue.replace(/,/g, "").trim()) : Number.NaN;
    if (!table || table.lineNumber !== lineNumber || !/^\d{4}Q[1-4]$/.test(period) || !Number.isFinite(rawValue)) return [];
    return [{
      metric: table.metric, tableName: row.TableName as string, lineNumber,
      seriesId: `NIPA:${row.TableName}:${lineNumber}`,
      label: typeof row.LineDescription === "string" && row.LineDescription.trim() ? row.LineDescription.trim() : table.label,
      period, value: rawValue,
      unit: typeof row.Unit === "string" ? row.Unit :
        typeof row.METRIC_NAME === "string" && typeof row.UNIT_MULT === "string"
          ? row.METRIC_NAME + " × 10^" + row.UNIT_MULT :
        typeof row.CL_UNIT === "string" ? row.CL_UNIT : null,
      frequency: "Q",
    }];
  }).sort((a, b) => b.period.localeCompare(a.period) || a.metric.localeCompare(b.metric));

  if (!observations.length) return unavailable("BEA returned no usable observations for the registered GDP/PCE series.", retrievedAt);
  return {
    state: "ready", observations, retrievedAt,
    sourceName: "U.S. Bureau of Economic Analysis", sourceUrl: BEA_DATA_URL, note: null,
  };
}

export async function fetchBeaSnapshot(
  apiKey: string | undefined,
  options?: { fetchImpl?: typeof fetch; years?: string; now?: Date },
): Promise<BeaSnapshot> {
  if (!apiKey?.trim()) return {
    state: "unconfigured", observations: [], retrievedAt: null,
    sourceName: "U.S. Bureau of Economic Analysis", sourceUrl: BEA_DATA_URL,
    note: "BEA_API_KEY is not configured.",
  };
  const currentYear = (options?.now ?? new Date()).getUTCFullYear();
  const years = options?.years ?? Array.from({ length: 5 }, (_, index) => String(currentYear - index)).reverse().join(",");
  // BEA NIPA cannot query multiple tables in one request; fetch two bounded
  // official tables in parallel and fail closed on partial results.
  const tableNames = [...new Set(Object.values(BEA_SERIES).map(series => series.tableName))];
  const outcomes = await Promise.all(tableNames.map(async tableName => {
    try {
      const response = await (options?.fetchImpl ?? fetch)(buildBeaDataUrl(apiKey, years, tableName), {
        headers: { accept: "application/json" }, signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) return { tableName, snapshot: unavailable(`BEA_HTTP_${response.status}`) };
      const parsed = parseBeaPayload(await response.json());
      const observations = parsed.observations.filter(row => row.tableName === tableName);
      if (parsed.state !== "ready" || !observations.length) {
        return { tableName, snapshot: unavailable("BEA_TABLE_NO_VALID_ROWS") };
      }
      return { tableName, snapshot: { ...parsed, observations } };
    } catch {
      // Transport errors can include a URL with UserID. Never expose them.
      return { tableName, snapshot: unavailable("BEA_REQUEST_FAILED") };
    }
  }));
  const successful = outcomes.filter(result => result.snapshot.state === "ready");
  const observations = successful.flatMap(result => result.snapshot.observations)
    .sort((a, b) => b.period.localeCompare(a.period) || a.metric.localeCompare(b.metric));
  const allReady = successful.length === tableNames.length;
  const ready = successful.length > 0;
  const failed = outcomes.filter(result => result.snapshot.state !== "ready");
  return {
    state: allReady ? "ready" : ready ? "partial" : "unavailable",
    observations,
    retrievedAt: ready ? new Date().toISOString() : null,
    sourceName: "U.S. Bureau of Economic Analysis",
    sourceUrl: BEA_DATA_URL,
    note: allReady ? null : "BEA_TABLES_INCOMPLETE: " +
      failed.map(result => result.tableName + ":" + (result.snapshot.note ?? "NO_VALID_ROWS")).join(", "),
  };

}
