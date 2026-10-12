export const BEA_DATA_URL = "https://apps.bea.gov/api/data";

export const BEA_SERIES = {
  gdp: { tableName: "T10101", lineNumber: "1", label: "Gross domestic product" },
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
  state: "ready" | "unconfigured" | "unavailable";
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
};

export function buildBeaDataUrl(apiKey: string, years: string) {
  const url = new URL(BEA_DATA_URL);
  url.searchParams.set("UserID", apiKey);
  url.searchParams.set("method", "GetData");
  url.searchParams.set("datasetname", "NIPA");
  url.searchParams.set("TableName", [...new Set(Object.values(BEA_SERIES).map((item) => item.tableName))].join(","));
  url.searchParams.set("Frequency", "Q");
  url.searchParams.set("Year", years);
  url.searchParams.set("ResultFormat", "JSON");
  return url.toString();
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
      unit: typeof row.Unit === "string" ? row.Unit : typeof row.CL_UNIT === "string" ? row.CL_UNIT : null,
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
  try {
    const response = await (options?.fetchImpl ?? fetch)(buildBeaDataUrl(apiKey, years), {
      headers: { accept: "application/json" }, signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return unavailable(`BEA request failed with HTTP ${response.status}.`);
    return parseBeaPayload(await response.json());
  } catch (error) {
    return unavailable(`BEA request failed: ${error instanceof Error ? error.message : "unknown network error"}.`);
  }
}
