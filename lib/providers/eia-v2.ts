import {fetchOfficialWpsrCsv} from "./eia-wpsr-csv.ts";
export const EIA_WEEKLY_PETROLEUM_ROUTE = "https://api.eia.gov/v2/petroleum/sum/sndw/data/";

export const EIA_WEEKLY_SERIES = {
  crudeStocksExSpr: { id: "WCESTUS1", label: "Crude stocks excluding SPR", canonicalUnit: "MBBL" },
  gasolineStocks: { id: "WGTSTUS1", label: "Total gasoline stocks", canonicalUnit: "MBBL" },
  distillateStocks: { id: "WDISTUS1", label: "Distillate fuel oil stocks", canonicalUnit: "MBBL" },
  refineryUtilisation: { id: "WPULEUS3", label: "Refinery operable utilisation", canonicalUnit: "%" },
  refineryCrudeInputs: { id: "WCRRIUS2", label: "Refiner net input of crude oil", canonicalUnit: "MBBL/D" },
  crudeProduction: { id: "WCRFPUS2", label: "Field production of crude oil", canonicalUnit: "MBBL/D" },
  sprStocks: { id: "WCSSTUS1", label: "Crude oil stocks in SPR", canonicalUnit: "MBBL" },
  gasolineProductSupplied: { id: "WGFUPUS2", label: "Finished motor gasoline product supplied", canonicalUnit: "MBBL/D" },
} as const;

export type EiaWeeklyMetricKey = keyof typeof EIA_WEEKLY_SERIES;

export const EIA_WEEKLY_ROUTE_GROUPS = {
  stocks: {
    url: "https://api.eia.gov/v2/petroleum/stoc/wstk/data/",
    series: ["crudeStocksExSpr", "gasolineStocks", "distillateStocks", "sprStocks"],
  },
  refinery: {
    url: "https://api.eia.gov/v2/petroleum/pnp/wiup/data/",
    series: ["refineryUtilisation", "refineryCrudeInputs"],
  },
  supply: {
    url: EIA_WEEKLY_PETROLEUM_ROUTE,
    series: ["crudeProduction", "gasolineProductSupplied"],
  },
} as const;
export type EiaWeeklyRouteGroup = keyof typeof EIA_WEEKLY_ROUTE_GROUPS;


export type EiaWeeklyObservation = {
  period: string;
  value: number;
  units: string | null;
  rawUnits: string | null;
};

export type EiaWeeklyMetric = {
  key: EiaWeeklyMetricKey;
  seriesId: string;
  label: string;
  canonicalUnit: string;
  latest: EiaWeeklyObservation;
  previous: EiaWeeklyObservation | null;
};

export type EiaWeeklyPetroleumSnapshot = {
  state: "ready" | "unconfigured" | "unavailable";
  asOf: string | null;
  retrievedAt: string | null;
  metrics: Partial<Record<EiaWeeklyMetricKey, EiaWeeklyMetric>>;
  sourceName: "U.S. Energy Information Administration";
  sourceUrl: string;
  note: string | null;
};

type EiaRow = {
  period?: unknown;
  series?: unknown;
  value?: unknown;
  units?: unknown;
};

const ID_TO_KEY = new Map<string, EiaWeeklyMetricKey>(
  Object.entries(EIA_WEEKLY_SERIES).map(([key, value]) => [value.id, key as EiaWeeklyMetricKey]),
);

function numberValue(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/,/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function stringValue(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function normalizeUnits(rawUnits: string | null, key: EiaWeeklyMetricKey): string {
  const defaultUnit = EIA_WEEKLY_SERIES[key].canonicalUnit;
  if (!rawUnits) return defaultUnit;
  const upper = rawUnits.toUpperCase().trim();
  if (upper === "THOUSAND BARRELS" || upper === "MBBL") return "MBBL";
  if (upper === "THOUSAND BARRELS PER DAY" || upper === "MBBL/D" || upper === "MBBL/DAY") return "MBBL/D";
  if (upper === "PERCENT" || upper === "%") return "%";
  return rawUnits;
}

export function parseEiaWeeklyPetroleumPayload(
  payload: unknown,
  options?: { retrievedAt?: string | null },
): EiaWeeklyPetroleumSnapshot {
  const retrievedAt = options?.retrievedAt ?? new Date().toISOString();
  const response = payload && typeof payload === "object" && !Array.isArray(payload)
    ? (payload as { response?: unknown }).response
    : null;
  const data = response && typeof response === "object" && !Array.isArray(response)
    ? (response as { data?: unknown }).data
    : null;
  if (!Array.isArray(data)) {
    return {
      state: "unavailable",
      asOf: null,
      retrievedAt: options?.retrievedAt ?? null,
      metrics: {},
      sourceName: "U.S. Energy Information Administration",
      sourceUrl: EIA_WEEKLY_PETROLEUM_ROUTE,
      note: "EIA returned a response without a valid data array.",
    };
  }

  const grouped = new Map<EiaWeeklyMetricKey, EiaWeeklyObservation[]>();
  for (const raw of data as EiaRow[]) {
    const seriesId = stringValue(raw.series);
    const key = seriesId ? ID_TO_KEY.get(seriesId) : undefined;
    const period = stringValue(raw.period);
    const value = numberValue(raw.value);
    if (!key || !period || value === null) continue;
    const rawUnits = stringValue(raw.units);
    const observation: EiaWeeklyObservation = {
      period,
      value,
      units: normalizeUnits(rawUnits, key),
      rawUnits,
    };
    grouped.set(key, [...(grouped.get(key) || []), observation]);
  }

  const metrics: Partial<Record<EiaWeeklyMetricKey, EiaWeeklyMetric>> = {};
  for (const [key, observations] of grouped) {
    const ordered = [...observations].sort((a, b) => b.period.localeCompare(a.period));
    if (!ordered.length) continue;
    const definition = EIA_WEEKLY_SERIES[key];
    metrics[key] = {
      key,
      seriesId: definition.id,
      label: definition.label,
      canonicalUnit: definition.canonicalUnit,
      latest: ordered[0],
      previous: ordered[1] || null,
    };
  }

  const available = Object.values(metrics);
  return {
    state: available.length ? "ready" : "unavailable",
    asOf: available.map((metric) => metric?.latest.period || "").sort().at(-1) || null,
    retrievedAt: available.length ? retrievedAt : (options?.retrievedAt ?? null),
    metrics,
    sourceName: "U.S. Energy Information Administration",
    sourceUrl: EIA_WEEKLY_PETROLEUM_ROUTE,
    note: available.length
      ? null
      : "EIA returned no valid observations for the configured weekly petroleum series.",
  };
}

/** EIA v2 exposes stock, refinery and supply series under DISTINCT routes.
 * A single /sum/sndw query for all eight series cannot correctly retrieve stocks/utilisation.
 */
export function buildEiaWeeklyPetroleumUrl(apiKey: string, group: EiaWeeklyRouteGroup = "supply") {
  const route = EIA_WEEKLY_ROUTE_GROUPS[group];
  const url = new URL(route.url);
  url.searchParams.set("api_key", apiKey);
  url.searchParams.set("frequency", "weekly");
  url.searchParams.set("data[0]", "value");
  for (const key of route.series) {
    url.searchParams.append("facets[series][]", EIA_WEEKLY_SERIES[key].id);
  }
  url.searchParams.set("sort[0][column]", "period");
  url.searchParams.set("sort[0][direction]", "desc");
  url.searchParams.set("offset", "0");
  url.searchParams.set("length", "200");
  return url.toString();
}

export function buildEiaWeeklyPetroleumUrls(apiKey: string) {
  return (Object.keys(EIA_WEEKLY_ROUTE_GROUPS) as EiaWeeklyRouteGroup[])
    .map(group => ({group, url:buildEiaWeeklyPetroleumUrl(apiKey, group)}));
}

const SAFE_EIA_API_ERROR_CODES = new Set([
  "API_KEY_MISSING", "API_KEY_INVALID", "API_KEY_DISABLED",
  "API_KEY_UNVERIFIED", "API_KEY_UNAUTHORIZED", "OVER_RATE_LIMIT",
  "NOT_FOUND",
]);
/** EIA's public gateway returns structured 403 causes. Keep only known codes;
 * never surface raw bodies, secret keys, echo URLs, or arbitrary error text.
 */
export function classifyEiaApiFailure(status:number, body:unknown):string {
  const nested=body && typeof body==="object" && !Array.isArray(body)
    ? (body as {error?:unknown}).error:null;
  const code=nested && typeof nested==="object" && !Array.isArray(nested)
    ? (nested as {code?:unknown}).code:null;
  return "HTTP_"+status+(typeof code==="string" && SAFE_EIA_API_ERROR_CODES.has(code)?":"+code:"");
}

export async function fetchEiaWeeklyPetroleumSnapshot(
  apiKey = process.env.EIA_API_KEY?.trim(),
  options: { fetchImpl?: typeof fetch } = {},
): Promise<EiaWeeklyPetroleumSnapshot> {
  if (!apiKey) {
    const csv=await fetchOfficialWpsrCsv(options);
    if(csv.state==="ready")return csv;
    return {
      state:"unconfigured",asOf:null,retrievedAt:null,metrics:{},
      sourceName:"U.S. Energy Information Administration",
      sourceUrl:"https://www.eia.gov/petroleum/supply/weekly/",
      note:"EIA_API_KEY not configured; OFFICIAL_WPSR_CSV_UNAVAILABLE",
    };
  }

  const retrievedAt = new Date().toISOString();
  const sourceGroups = buildEiaWeeklyPetroleumUrls(apiKey);
  const results = await Promise.all(sourceGroups.map(async ({group,url}) => {
    try {
      const response = await (options.fetchImpl ?? fetch)(url, {
        headers: {
          accept: "application/json",
          "user-agent": "Alchemy Live Desk EIA v2 adapter",
        },
        next: { revalidate: 15 * 60 },
        signal: AbortSignal.timeout(8_000),
      });
      if (!response.ok) {
        let errorBody:unknown=null;
        // Only parse EIA's small gateway error response. Never retain untrusted
        // error messages or query URLs, which contain the API key.
        try {
          const raw=(await response.text()).slice(0,2048);
          errorBody=JSON.parse(raw) as unknown;
        } catch { /* gateway may return HTML */ }
        return {group,snapshot:null,error:classifyEiaApiFailure(response.status,errorBody)};
      }
      const snapshot=parseEiaWeeklyPetroleumPayload(await response.json(),{retrievedAt});
      if (snapshot.state!=="ready") return {group, snapshot:null, error:"NO_VALID_ROWS"};
      return {group,snapshot,error:null};
    } catch {
      // Never expose provider request URLs because they contain the API key.
      return {group,snapshot:null,error:"REQUEST_FAILED"};
    }
  }));
  const metrics: EiaWeeklyPetroleumSnapshot["metrics"] = {};
  for (const result of results) {
    if (result.snapshot) Object.assign(metrics, result.snapshot.metrics);
  }
  const asOf=Object.values(metrics).map(x=>x?.latest.period??"").filter(Boolean).sort().at(-1)??null;
  const missing=results.filter(x=>x.error).map(x=>x.group+":"+x.error);
  // Do not mix observations from two transports or unequal reporting weeks.
  // Prefer one complete, at-least-as-fresh original WPSR snapshot when the
  // API is missing metrics. A failed fallback never invents recovered rows.
  if(Object.keys(metrics).length<8){
    const csv=await fetchOfficialWpsrCsv(options);
    if(csv.state==="ready"&&csv.asOf&&
       (!asOf||csv.asOf>=asOf)&&Object.keys(csv.metrics).length>Object.keys(metrics).length){
      return {...csv,note:csv.note+
        (missing.length?"; API route gap: "+missing.join(", "):"")};
    }
    if(csv.state!=="ready")missing.push("official-wpsr-csv:UNAVAILABLE");
    else if(csv.asOf&&asOf&&csv.asOf<asOf)missing.push("official-wpsr-csv:OLDER_WEEK");
    else missing.push("official-wpsr-csv:PARTIAL");
  }
  return {
    state: asOf?"ready":"unavailable",
    asOf,retrievedAt,metrics,
    sourceName: "U.S. Energy Information Administration",
    sourceUrl: "https://www.eia.gov/opendata/",
    note: missing.length ? "EIA route coverage missing: "+missing.join(", ") : null,
  };
}
